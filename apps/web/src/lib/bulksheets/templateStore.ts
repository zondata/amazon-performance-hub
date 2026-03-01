import 'server-only';

import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const TEMPLATE_KEYS = ['sp_update', 'sb_update', 'sp_create'] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];
export type TemplateObjectInfo = {
  bucket: string;
  objectPath: string;
  accountId: string;
  marketplace: string;
  label: string;
};

type TemplateSource = 'storage' | 'local_fallback' | 'missing';

export type TemplateStatusRow = {
  templateKey: TemplateKey;
  label: string;
  bucket: string;
  objectPath: string;
  source: TemplateSource;
  exists: boolean;
  storageExists: boolean;
  updatedAt: string | null;
  sizeBytes: number | null;
  localFallbackPath: string | null;
  localFallbackExists: boolean;
  error: string | null;
};

export type TemplateStatusResult = {
  bucket: string;
  storageError: string | null;
  templates: Record<TemplateKey, TemplateStatusRow>;
};

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const TEMPLATE_CONFIG: Record<
  TemplateKey,
  {
    label: string;
    objectName: string;
    fallbackEnvKey: string;
    fallbackValue: string | undefined;
  }
> = {
  sp_update: {
    label: 'SP Update',
    objectName: 'sp-update.xlsx',
    fallbackEnvKey: 'BULKGEN_TEMPLATE_SP_UPDATE',
    fallbackValue: env.bulkgenTemplateSpUpdate,
  },
  sb_update: {
    label: 'SB Update',
    objectName: 'sb-update.xlsx',
    fallbackEnvKey: 'BULKGEN_TEMPLATE_SB_UPDATE',
    fallbackValue: env.bulkgenTemplateSbUpdate,
  },
  sp_create: {
    label: 'SP Create',
    objectName: 'sp-create.xlsx',
    fallbackEnvKey: 'BULKGEN_TEMPLATE_SP_CREATE',
    fallbackValue: env.bulkgenTemplateSpCreate,
  },
};

export const getTemplateObjectInfo = (templateKey: TemplateKey): TemplateObjectInfo => ({
  bucket: env.bulkgenTemplateBucket,
  objectPath: `${env.accountId}/${env.marketplace}/${TEMPLATE_CONFIG[templateKey].objectName}`,
  accountId: env.accountId,
  marketplace: env.marketplace,
  label: TEMPLATE_CONFIG[templateKey].label,
});

const templateCachePath = (templateKey: TemplateKey) =>
  path.join(os.tmpdir(), 'aph-templates', env.accountId, env.marketplace, `${templateKey}.xlsx`);

const localFallbackPath = (templateKey: TemplateKey) => {
  const configured = TEMPLATE_CONFIG[templateKey].fallbackValue;
  return configured && configured.trim() ? path.resolve(configured.trim()) : null;
};

const existsOnDisk = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage.trim();
  }
  return String(error);
};

const getErrorCode = (error: unknown) => {
  if (!error || typeof error !== 'object') return null;
  const maybeCode = (error as { error?: unknown }).error;
  if (typeof maybeCode === 'string' && maybeCode.trim()) return maybeCode.toLowerCase();
  return null;
};

const getErrorStatusCode = (error: unknown) => {
  if (!error || typeof error !== 'object') return null;
  const raw = (error as { statusCode?: unknown }).statusCode;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const isStorageUnavailableError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('bucket') ||
    message.includes('forbidden') ||
    message.includes('permission') ||
    message.includes('unauthorized') ||
    message.includes('access denied')
  );
};

const isNotFoundError = (error: unknown) => {
  if (!error) return false;
  const code = getErrorCode(error);
  if (code && (code.includes('nosuchkey') || code.includes('not_found'))) return true;

  const statusCode = getErrorStatusCode(error);
  if (statusCode === 404) return true;

  const message = getErrorMessage(error).toLowerCase();
  if (
    message.includes('forbidden') ||
    message.includes('permission') ||
    message.includes('unauthorized') ||
    message.includes('access denied')
  ) {
    return false;
  }
  if (message.includes('bucket') && (message.includes('not found') || message.includes('does not exist'))) {
    return false;
  }
  return (
    message.includes('object not found') ||
    message.includes('file not found') ||
    message.includes('no such key') ||
    message.includes('not found')
  );
};

const toSizeBytes = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const buildMissingTemplateError = (templateKey: TemplateKey) => {
  const info = getTemplateObjectInfo(templateKey);
  return `Template "${info.label}" is missing at ${info.bucket}/${info.objectPath}. Upload template at Bulksheet Ops → Templates or set BULKGEN_TEMPLATE_* env var for local fallback. (${TEMPLATE_CONFIG[templateKey].fallbackEnvKey})`;
};

const readStorageTemplateMeta = async (templateKey: TemplateKey) => {
  const info = getTemplateObjectInfo(templateKey);
  const { data, error } = await supabaseAdmin.storage.from(info.bucket).info(info.objectPath);
  if (error) {
    if (isNotFoundError(error)) {
      return {
        exists: false,
        updatedAt: null as string | null,
        sizeBytes: null as number | null,
        error: null as string | null,
        storageUnavailable: false,
      };
    }
    return {
      exists: false,
      updatedAt: null as string | null,
      sizeBytes: null as number | null,
      error: getErrorMessage(error),
      storageUnavailable: isStorageUnavailableError(error),
    };
  }

  return {
    exists: true,
    updatedAt:
      (typeof data.updatedAt === 'string' && data.updatedAt) ||
      (typeof data.createdAt === 'string' && data.createdAt) ||
      null,
    sizeBytes: toSizeBytes(data.metadata?.size),
    error: null as string | null,
    storageUnavailable: false,
  };
};

const buildTemplateStatusRow = async (templateKey: TemplateKey): Promise<TemplateStatusRow> => {
  const config = TEMPLATE_CONFIG[templateKey];
  const info = getTemplateObjectInfo(templateKey);
  const localPath = localFallbackPath(templateKey);
  const [storageMeta, localExists] = await Promise.all([
    readStorageTemplateMeta(templateKey),
    localPath ? existsOnDisk(localPath) : Promise.resolve(false),
  ]);

  const source: TemplateSource = storageMeta.exists
    ? 'storage'
    : localExists
      ? 'local_fallback'
      : 'missing';

  return {
    templateKey,
    label: config.label,
    bucket: info.bucket,
    objectPath: info.objectPath,
    source,
    exists: source !== 'missing',
    storageExists: storageMeta.exists,
    updatedAt: storageMeta.updatedAt,
    sizeBytes: storageMeta.sizeBytes,
    localFallbackPath: localPath,
    localFallbackExists: localExists,
    error: storageMeta.error,
  };
};

export async function getTemplateStatus(templateKey: TemplateKey): Promise<TemplateStatusRow>;
export async function getTemplateStatus(): Promise<TemplateStatusResult>;
export async function getTemplateStatus(templateKey?: TemplateKey) {
  if (templateKey) {
    return buildTemplateStatusRow(templateKey);
  }

  const rows = await Promise.all(TEMPLATE_KEYS.map((key) => buildTemplateStatusRow(key)));

  const templates = Object.fromEntries(rows.map((row) => [row.templateKey, row])) as Record<
    TemplateKey,
    TemplateStatusRow
  >;

  const storageErrorRow = rows.find((row) => row.error);
  return {
    bucket: env.bulkgenTemplateBucket,
    storageError: storageErrorRow ? storageErrorRow.error : null,
    templates,
  };
}

export const downloadTemplateToLocalPath = async (templateKey: TemplateKey): Promise<string> => {
  const resolveFallbackOrMissing = async () => {
    const fallbackPath = localFallbackPath(templateKey);
    if (fallbackPath && (await existsOnDisk(fallbackPath))) {
      return fallbackPath;
    }
    throw new Error(buildMissingTemplateError(templateKey));
  };

  const looksLikeUrlObjectError = (error: unknown) => {
    const message = getErrorMessage(error).trim();
    return message.startsWith('{"url":') || message.startsWith('{"URL":');
  };

  const info = getTemplateObjectInfo(templateKey);
  const { data, error } = await supabaseAdmin.storage.from(info.bucket).download(info.objectPath);

  if (error) {
    if (isNotFoundError(error)) {
      return resolveFallbackOrMissing();
    }

    // Some storage failures can surface as URL-only payloads.
    // Confirm existence before deciding between "missing template" and download failure.
    if (looksLikeUrlObjectError(error)) {
      const storageMeta = await readStorageTemplateMeta(templateKey);
      if (!storageMeta.exists && !storageMeta.error) {
        return resolveFallbackOrMissing();
      }
    }

    throw new Error(
      `Failed to download template "${info.label}" from storage bucket "${info.bucket}" at "${info.objectPath}": ${getErrorMessage(error)}`
    );
  }

  if (data) {
    const localPath = templateCachePath(templateKey);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    const buffer = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(localPath, buffer);
    return path.resolve(localPath);
  }

  const storageMeta = await readStorageTemplateMeta(templateKey);
  if (!storageMeta.exists && !storageMeta.error) {
    return resolveFallbackOrMissing();
  }

  throw new Error(
    `Failed to download template "${info.label}" from storage bucket "${info.bucket}" at "${info.objectPath}": empty download response.`
  );
};

export const uploadTemplate = async (
  templateKey: TemplateKey,
  input: File | Buffer | Uint8Array
) => {
  const info = getTemplateObjectInfo(templateKey);
  const content =
    input instanceof File
      ? Buffer.from(await input.arrayBuffer())
      : Buffer.isBuffer(input)
        ? input
        : Buffer.from(input);
  const { error } = await supabaseAdmin.storage.from(info.bucket).upload(
    info.objectPath,
    content,
    {
      upsert: true,
      contentType: XLSX_CONTENT_TYPE,
    }
  );

  if (error) {
    throw new Error(
      `Failed to upload template "${info.label}" to storage bucket "${info.bucket}" at "${info.objectPath}": ${getErrorMessage(error)}`
    );
  }

  return {
    bucket: info.bucket,
    objectPath: info.objectPath,
  };
};
