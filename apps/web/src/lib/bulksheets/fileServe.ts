import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { env } from '@/lib/env';
import { safeJoin } from './fsPaths';

const contentTypeFor = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
};

type AllowedRoot = {
  label: 'out' | 'reconciled' | 'failed';
  path: string;
};

const buildAllowedRoots = (): AllowedRoot[] => {
  const roots: AllowedRoot[] = [];
  if (env.bulkgenOutRoot) roots.push({ label: 'out', path: env.bulkgenOutRoot });
  if (env.bulkgenReconciledDir) {
    roots.push({ label: 'reconciled', path: env.bulkgenReconciledDir });
  }
  if (env.bulkgenFailedDir) {
    roots.push({ label: 'failed', path: env.bulkgenFailedDir });
  }
  return roots;
};

const sanitizeDownloadFilename = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const cleaned = value
    .replace(/[/\\]+/g, ' ')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_');
  if (!cleaned) return null;
  const bounded = cleaned.slice(0, 120).replace(/^[_\-.]+|[_\-.]+$/g, '');
  return bounded.length > 0 ? bounded : null;
};

export const resolveDownloadPath = (relativePath: string) => {
  const cleaned = relativePath.replace(/^\/+/, '');
  const roots = buildAllowedRoots();

  if (cleaned.startsWith('reconciled/')) {
    const root = roots.find((item) => item.label === 'reconciled');
    if (!root) throw new Error('Reconciled directory not configured');
    return safeJoin(root.path, cleaned.replace(/^reconciled\//, ''));
  }

  if (cleaned.startsWith('failed/')) {
    const root = roots.find((item) => item.label === 'failed');
    if (!root) throw new Error('Failed directory not configured');
    return safeJoin(root.path, cleaned.replace(/^failed\//, ''));
  }

  const outRoot = roots.find((item) => item.label === 'out');
  if (!outRoot) throw new Error('Output root not configured');
  return safeJoin(outRoot.path, cleaned);
};

export const buildFileResponse = (
  absolutePath: string,
  options?: { downloadFilename?: string | null }
) => {
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return null;
  }

  const stream = fs.createReadStream(absolutePath);
  const headers = new Headers();
  headers.set('Content-Type', contentTypeFor(absolutePath));
  const filename =
    sanitizeDownloadFilename(options?.downloadFilename) ?? path.basename(absolutePath);
  headers.set(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );

  return new Response(stream as unknown as BodyInit, { headers });
};
