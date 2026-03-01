import path from 'node:path';
import { promises as fs } from 'node:fs';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import TemplateUploadForm from '@/components/bulksheets/TemplateUploadForm';

import {
  getTemplateStatus,
  getTemplateObjectInfo,
  type TemplateKey,
  type TemplateStatusRow,
  uploadTemplate,
} from '@/lib/bulksheets/templateStore';
import { env } from '@/lib/env';

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  sp_update: 'SP Update',
  sb_update: 'SB Update',
  sp_create: 'SP Create',
};

const TEMPLATE_ORDER: TemplateKey[] = ['sp_update', 'sb_update', 'sp_create'];
const DEFAULT_IMPORT_TEMPLATE_FOLDER = '/mnt/d/Dropbox/AmazonReports/2026-02-11';

type LocalTemplateCandidate = {
  fullPath: string;
  fileName: string;
  mtimeMs: number;
};

const pickSearchParam = (value: string | string[] | undefined) => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const formatBytes = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US');
};

const containsAny = (value: string, terms: string[]) => terms.some((term) => value.includes(term));

const matchesTemplateCandidate = (templateKey: TemplateKey, fileName: string) => {
  const name = fileName.toLowerCase();
  if (templateKey === 'sp_update') {
    return name.includes('sp') && containsAny(name, ['update', 'template']);
  }
  if (templateKey === 'sb_update') {
    return name.includes('sb') && containsAny(name, ['update', 'template']);
  }
  return name.includes('sp') && containsAny(name, ['create', 'new', 'template']);
};

const listXlsxFiles = async (root: string): Promise<LocalTemplateCandidate[]> => {
  const out: LocalTemplateCandidate[] = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.xlsx')) {
      continue;
    }
    const fullPath = path.join(root, entry.name);
    const stat = await fs.stat(fullPath);
    out.push({
      fullPath,
      fileName: entry.name,
      mtimeMs: stat.mtimeMs,
    });
  }
  return out;
};

const pickTemplateCandidate = (templateKey: TemplateKey, files: LocalTemplateCandidate[]) => {
  const matches = files
    .filter((file) => matchesTemplateCandidate(templateKey, file.fileName))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches[0] ?? null;
};

export default async function BulksheetTemplatesPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const notice = pickSearchParam(resolvedSearchParams.notice);
  const error = pickSearchParam(resolvedSearchParams.error);

  const templateRows = await Promise.all(TEMPLATE_ORDER.map((templateKey) => getTemplateStatus(templateKey)));
  const templateStatus = Object.fromEntries(
    templateRows.map((row) => [row.templateKey, row])
  ) as Record<TemplateKey, TemplateStatusRow>;
  const storageError = templateRows.find((row) => row.error)?.error ?? null;
  const spawnDisabled = !env.enableBulkgenSpawn;

  const importFromFolderAction = async (formData: FormData) => {
    'use server';

    try {
      if (!env.enableBulkgenSpawn) {
        throw new Error('ENABLE_BULKGEN_SPAWN=1 is required for local template import.');
      }

      const importFolder = String(formData.get('import_folder') ?? '').trim();
      if (!importFolder) {
        throw new Error('Local import folder is required.');
      }

      let folderStat;
      try {
        folderStat = await fs.stat(importFolder);
      } catch {
        throw new Error(`Template folder does not exist: ${importFolder}`);
      }
      if (!folderStat.isDirectory()) {
        throw new Error(`Template folder is not a directory: ${importFolder}`);
      }

      const files = await listXlsxFiles(importFolder);
      const uploaded: Array<{ label: string; storagePath: string }> = [];
      const missing: string[] = [];

      for (const templateKey of TEMPLATE_ORDER) {
        const candidate = pickTemplateCandidate(templateKey, files);
        if (!candidate) {
          missing.push(TEMPLATE_LABELS[templateKey]);
          continue;
        }

        const bytes = await fs.readFile(candidate.fullPath);
        const uploadResult = await uploadTemplate(templateKey, bytes);
        uploaded.push({
          label: TEMPLATE_LABELS[templateKey],
          storagePath: `${uploadResult.bucket}/${uploadResult.objectPath}`,
        });
      }

      const summary = [
        `Imported from ${importFolder}.`,
        uploaded.length
          ? `Uploaded: ${uploaded.map((item) => `${item.label} -> ${item.storagePath}`).join(', ')}.`
          : 'Uploaded: none.',
        missing.length ? `Not found: ${missing.join(', ')}.` : 'Not found: none.',
      ].join(' ');

      revalidatePath('/bulksheet-ops/templates');
      redirect(`/bulksheet-ops/templates?notice=${encodeURIComponent(summary)}`);
    } catch (importError) {
      const message =
        importError instanceof Error
          ? importError.message
          : 'Failed to import templates from local folder.';
      redirect(`/bulksheet-ops/templates?error=${encodeURIComponent(message)}`);
    }
  };

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {storageError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Storage warning: {storageError}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 text-sm text-slate-600 shadow-sm">
        Templates are resolved from Supabase Storage at generation time. Object paths are:
        <code className="ml-1">{'<accountId>/<marketplace>/<template>.xlsx'}</code>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 text-sm text-slate-600 shadow-sm">
        <div className="text-xs uppercase tracking-wider text-slate-400">Import from local folder</div>
        {spawnDisabled ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            ENABLE_BULKGEN_SPAWN=1 is required for local template import.
          </div>
        ) : null}
        <form action={importFromFolderAction} className="mt-4 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-400">Local import folder</label>
            <input
              name="import_folder"
              defaultValue={DEFAULT_IMPORT_TEMPLATE_FOLDER}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="/mnt/d/Dropbox/AmazonReports/2026-02-11"
              required
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={spawnDisabled}
          >
            Import templates from folder
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {TEMPLATE_ORDER.map((templateKey) => {
          const row = templateStatus[templateKey];
          const objectInfo = getTemplateObjectInfo(templateKey);
          const sourceText =
            row.source === 'storage'
              ? 'Stored in system'
              : row.source === 'local_fallback'
                ? 'Local fallback only'
                : 'Missing';

          return (
            <div
              key={templateKey}
              className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-400">Template</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{row.label}</div>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    row.source === 'storage'
                      ? 'bg-emerald-100 text-emerald-700'
                      : row.source === 'local_fallback'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {sourceText}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">Bucket:</span> {objectInfo.bucket}
                </div>
                <div>
                  <span className="text-slate-400">Object path:</span>{' '}
                  <span className="break-all">{objectInfo.objectPath}</span>
                </div>
                <div>
                  <span className="text-slate-400">Exists in storage:</span>{' '}
                  {row.storageExists ? 'Yes' : 'No'}
                </div>
                <div>
                  <span className="text-slate-400">Updated:</span> {formatDateTime(row.updatedAt)}
                </div>
                <div>
                  <span className="text-slate-400">Size:</span> {formatBytes(row.sizeBytes)}
                </div>
                <div>
                  <span className="text-slate-400">Fallback:</span>{' '}
                  {row.localFallbackPath ? row.localFallbackPath : '—'}
                </div>
              </div>

              {row.error ? <div className="mt-3 text-xs text-rose-600">{row.error}</div> : null}
              <TemplateUploadForm
                templateKey={templateKey}
                label={row.label}
                uploadTarget={`${objectInfo.bucket}/${objectInfo.objectPath}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
