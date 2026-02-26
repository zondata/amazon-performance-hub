'use server';

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { env } from '@/lib/env';
import { detectImportSourceTypeFromFilename } from '@/lib/imports/sourceTypeDetection';
import {
  sanitizeIgnoredSourceTypes,
  type ImportSourceType,
} from '@/lib/imports/sourceTypes';
import { saveImportsHealthSettings } from '@/lib/imports/preferences';

const SUMMARY_PREFIX = 'IMPORT_BATCH_SUMMARY ';

export type ImportBatchCliItemResult = {
  original_filename: string;
  source_type: ImportSourceType | 'unknown';
  exported_at_iso?: string;
  run_at_iso?: string;
  ingest: {
    status: 'ok' | 'already ingested' | 'error';
    upload_id?: string;
    row_count?: number;
    error?: string;
  };
  map: {
    status: 'ok' | 'missing_snapshot' | 'skipped' | 'error';
    fact_rows?: number;
    issue_rows?: number;
    error?: string;
  };
};

export type ImportBatchCliSummary = {
  items: ImportBatchCliItemResult[];
};

export type IgnoredReport = {
  original_filename: string;
  source_type: ImportSourceType | 'unknown';
};

export type ImportBatchActionState = {
  ok: boolean;
  error?: string | null;
  summary?: ImportBatchCliSummary;
  ignored_reports?: IgnoredReport[];
  ignored_source_types?: ImportSourceType[];
};

const isRepoRoot = (dir: string) =>
  fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'src'));

const resolveRepoRoot = () => {
  const envRoot = process.env.BULKGEN_REPO_ROOT;
  if (envRoot && isRepoRoot(envRoot)) return envRoot;

  const cwd = process.cwd();
  const candidates = [
    cwd,
    path.resolve(cwd, '..'),
    path.resolve(cwd, '..', '..'),
    path.resolve(cwd, '..', '..', '..'),
    '/home/albert/code/amazon-performance-hub',
  ];
  for (const candidate of candidates) {
    if (isRepoRoot(candidate)) return candidate;
  }
  return cwd;
};

const sanitizeFileSegment = (value: string) =>
  value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 160) || 'upload';

const parseIgnoredSourceTypes = (formData: FormData): ImportSourceType[] => {
  const raw = String(formData.get('ignored_source_types_json') ?? '');
  if (!raw) return sanitizeIgnoredSourceTypes(null);
  try {
    const parsed = JSON.parse(raw);
    return sanitizeIgnoredSourceTypes(parsed);
  } catch {
    return sanitizeIgnoredSourceTypes(null);
  }
};

const runCommand = async (args: string[]) => {
  if (!env.enableBulkgenSpawn) {
    throw new Error('ENABLE_BULKGEN_SPAWN=1 is required to run batch imports from the web UI.');
  }

  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn('npm', args, {
      cwd: resolveRepoRoot(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || 'Batch import command failed.'));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
};

const parseSummaryFromStdout = (stdout: string): ImportBatchCliSummary => {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const summaryLine = [...lines].reverse().find((line) => line.startsWith(SUMMARY_PREFIX));
  if (!summaryLine) {
    throw new Error('Batch import summary was not found in command output.');
  }

  const jsonText = summaryLine.slice(SUMMARY_PREFIX.length).trim();
  const parsed = JSON.parse(jsonText) as ImportBatchCliSummary;
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error('Batch import summary payload is invalid.');
  }
  return parsed;
};

const asErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const runImportBatch = async (formData: FormData): Promise<ImportBatchActionState> => {
  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return { ok: false, error: 'Select at least one CSV/XLSX file.', summary: { items: [] } };
  }

  const ignoredSourceTypes = parseIgnoredSourceTypes(formData);
  const ignoredSet = new Set(ignoredSourceTypes);

  let tempDir: string | null = null;
  try {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aph-import-'));
    const ignoredReports: IgnoredReport[] = [];
    const manifestItems: Array<{
      path: string;
      original_filename: string;
      asin_override?: string;
    }> = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const originalFilename = file.name || `upload-${index + 1}`;
      const detected = detectImportSourceTypeFromFilename(originalFilename) ?? 'unknown';

      if (detected !== 'unknown' && ignoredSet.has(detected)) {
        ignoredReports.push({
          original_filename: originalFilename,
          source_type: detected,
        });
        continue;
      }

      const stagedPath = path.join(
        tempDir,
        `${String(index).padStart(3, '0')}-${sanitizeFileSegment(originalFilename)}`
      );
      const buffer = Buffer.from(await file.arrayBuffer());
      await fsp.writeFile(stagedPath, buffer);

      const asinOverrideRaw = String(formData.get(`asin_override_${index}`) ?? '').trim().toUpperCase();
      manifestItems.push({
        path: stagedPath,
        original_filename: originalFilename,
        asin_override: asinOverrideRaw || undefined,
      });
    }

    if (manifestItems.length === 0) {
      return {
        ok: true,
        error: null,
        summary: { items: [] },
        ignored_reports: ignoredReports,
        ignored_source_types: ignoredSourceTypes,
      };
    }

    const manifestPath = path.join(tempDir, 'manifest.json');
    await fsp.writeFile(
      manifestPath,
      JSON.stringify(
        {
          account_id: env.accountId,
          marketplace: env.marketplace,
          items: manifestItems,
        },
        null,
        2
      ),
      'utf8'
    );

    const { stdout } = await runCommand([
      'run',
      'pipeline:import:manifest',
      '--',
      '--manifest',
      manifestPath,
      '--account-id',
      env.accountId,
      '--marketplace',
      env.marketplace,
    ]);
    const summary = parseSummaryFromStdout(stdout);

    return {
      ok: true,
      error: null,
      summary,
      ignored_reports: ignoredReports,
      ignored_source_types: ignoredSourceTypes,
    };
  } catch (error) {
    return {
      ok: false,
      error: asErrorMessage(error),
      summary: { items: [] },
      ignored_reports: [],
      ignored_source_types: ignoredSourceTypes,
    };
  } finally {
    if (tempDir) {
      await fsp.rm(tempDir, { recursive: true, force: true });
    }
  }
};

export const runImportBatchAction = async (
  _prevState: ImportBatchActionState,
  formData: FormData
): Promise<ImportBatchActionState> => runImportBatch(formData);

export const saveIgnoredSourceTypesAction = async (
  sourceTypes: string[]
): Promise<{ ok: boolean; ignored_source_types: ImportSourceType[]; error?: string }> => {
  try {
    const ignoredSourceTypes = sanitizeIgnoredSourceTypes(sourceTypes);
    const settings = await saveImportsHealthSettings({
      accountId: env.accountId,
      marketplace: env.marketplace,
      ignoredSourceTypes,
    });
    return { ok: true, ignored_source_types: settings.ignored_source_types };
  } catch (error) {
    return {
      ok: false,
      ignored_source_types: sanitizeIgnoredSourceTypes(sourceTypes),
      error: asErrorMessage(error),
    };
  }
};
