import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { env } from '@/lib/env';
import { safeJoin } from './pathUtils';

export type BulkgenPaths = {
  outRoot?: string;
  pendingDir?: string;
  reconciledDir?: string;
  failedDir?: string;
};

export const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export { safeJoin };

export const getBulkgenPaths = (): BulkgenPaths => ({
  outRoot: env.bulkgenOutRoot,
  pendingDir: env.bulkgenPendingDir,
  reconciledDir: env.bulkgenReconciledDir,
  failedDir: env.bulkgenFailedDir,
});

export const ensureOutRoot = (outRoot?: string) => {
  if (!outRoot) {
    throw new Error('BULKGEN_OUT_ROOT is not configured');
  }
  const resolved = path.resolve(outRoot);
  ensureDir(resolved);
  return resolved;
};

export const ensureDirIfSet = (dir?: string) => {
  if (!dir) return undefined;
  const resolved = path.resolve(dir);
  ensureDir(resolved);
  return resolved;
};
