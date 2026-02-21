'use server';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

import { env } from '@/lib/env';
import { ensureOutRoot, safeJoin } from '@/lib/bulksheets/fsPaths';

export type GeneratorResult = {
  run_id: string;
  out_dir: string;
  upload_strict_path?: string | null;
  review_path: string;
  manifest_path?: string | null;
  log_created?: number;
  log_skipped?: number;
  warnings?: string[];
  spawn_cwd?: string;
};

export type GeneratorPayload<TAction> = {
  templatePath: string;
  outRoot?: string | null;
  notes?: string | null;
  runId?: string | null;
  productId?: string | null;
  exportedAt?: string | null;
  experimentId?: string | null;
  logEnabled?: boolean | null;
  actions: TAction[];
};

const ensureTemplate = (templatePath: string) => {
  if (!templatePath) throw new Error('Template path is required');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  return templatePath;
};

const sanitizeRunId = (value: string) => value.replace(/[\\/]/g, '-');

const buildOutDir = (outRoot: string, runId: string) => {
  const safeRunId = sanitizeRunId(runId);
  return safeJoin(outRoot, safeRunId);
};

const writeTempJson = (data: unknown) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bulkgen-'));
  const filePath = path.join(tmpDir, 'changes.json');
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  return filePath;
};

const isRepoRoot = (dir: string) =>
  fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'apps', 'web'));

const resolveRepoRoot = () => {
  const envRoot = process.env.BULKGEN_REPO_ROOT;
  if (envRoot && isRepoRoot(envRoot)) return envRoot;

  const cwd = process.cwd();
  const candidates = [
    cwd,
    path.resolve(cwd, '..'),
    path.resolve(cwd, '..', '..'),
    path.resolve(cwd, '..', '..', '..'),
    path.resolve(cwd, 'amazon-performance-hub'),
    path.resolve(cwd, '..', 'amazon-performance-hub'),
    '/home/albert/code/amazon-performance-hub',
  ];

  for (const candidate of candidates) {
    if (isRepoRoot(candidate)) return candidate;
  }

  return '/home/albert/code/amazon-performance-hub';
};

const runCommand = async (args: string[]) => {
  if (!env.enableBulkgenSpawn) {
    throw new Error('ENABLE_BULKGEN_SPAWN=1 is required to run generators from the UI.');
  }

  return new Promise<{ stdout: string; stderr: string; cwd: string }>((resolve, reject) => {
    const cwd = resolveRepoRoot();
    const child = spawn('npm', args, {
      cwd,
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
        reject(new Error(stderr || stdout || 'Bulkgen command failed.'));
        return;
      }
      resolve({ stdout, stderr, cwd });
    });
  });
};

const parseLogCounts = (stdout: string) => {
  const lines = stdout.split('\n').map((line) => line.trim());
  const logLine = lines.find((line) => line.includes('log_changes_created'));
  if (!logLine) return undefined;
  try {
    const parsed = JSON.parse(logLine);
    return {
      created: Number(parsed.log_changes_created ?? 0),
      skipped: Number(parsed.log_changes_skipped ?? 0),
    };
  } catch {
    const createdMatch = logLine.match(/log_changes_created\s*[:=]\s*(\d+)/);
    const skippedMatch = logLine.match(/log_changes_skipped\s*[:=]\s*(\d+)/);
    if (createdMatch) {
      return {
        created: Number(createdMatch[1]),
        skipped: skippedMatch ? Number(skippedMatch[1]) : 0,
      };
    }
    return undefined;
  }
};

export const runSpUpdateGenerator = async (
  payload: GeneratorPayload<Record<string, unknown>>
): Promise<GeneratorResult> => {
  const outRoot = ensureOutRoot(payload.outRoot ?? env.bulkgenOutRoot);
  const templatePath = ensureTemplate(payload.templatePath);
  const runId = sanitizeRunId(payload.runId ?? `ui-sp-update-${Date.now()}`);
  const outDir = buildOutDir(outRoot, runId);
  const exportedAt = payload.exportedAt ?? new Date().toISOString();

  const changes = {
    exported_at: exportedAt,
    product_id: payload.productId ?? undefined,
    notes: payload.notes ?? undefined,
    actions: payload.actions,
  };

  const filePath = writeTempJson(changes);

  const args = [
    'run',
    'bulkgen:sp:update',
    '--',
    '--account-id',
    env.accountId,
    '--marketplace',
    env.marketplace,
    '--template',
    templatePath,
    '--out-dir',
    outDir,
    '--file',
    filePath,
    '--run-id',
    runId,
  ];

  if (payload.logEnabled) args.push('--log');
  if (payload.experimentId) args.push('--experiment-id', payload.experimentId);

  const { stdout, cwd } = await runCommand(args);
  const logCounts = parseLogCounts(stdout);

  return {
    run_id: runId,
    out_dir: outDir,
    upload_strict_path: path.relative(outRoot, path.join(outDir, 'upload_strict.xlsx')),
    review_path: path.relative(outRoot, path.join(outDir, 'review.xlsx')),
    log_created: logCounts?.created,
    log_skipped: logCounts?.skipped,
    spawn_cwd: cwd,
  };
};

export const runSbUpdateGenerator = async (
  payload: GeneratorPayload<Record<string, unknown>>
): Promise<GeneratorResult> => {
  const outRoot = ensureOutRoot(payload.outRoot ?? env.bulkgenOutRoot);
  const templatePath = ensureTemplate(payload.templatePath);
  const runId = sanitizeRunId(payload.runId ?? `ui-sb-update-${Date.now()}`);
  const outDir = buildOutDir(outRoot, runId);
  const exportedAt = payload.exportedAt ?? new Date().toISOString();

  const changes = {
    exported_at: exportedAt,
    product_id: payload.productId ?? undefined,
    notes: payload.notes ?? undefined,
    actions: payload.actions,
  };

  const filePath = writeTempJson(changes);

  const args = [
    'run',
    'bulkgen:sb:update',
    '--',
    '--account-id',
    env.accountId,
    '--marketplace',
    env.marketplace,
    '--template',
    templatePath,
    '--out-dir',
    outDir,
    '--file',
    filePath,
    '--run-id',
    runId,
  ];

  if (payload.logEnabled) args.push('--log');
  if (payload.experimentId) args.push('--experiment-id', payload.experimentId);

  const { stdout, cwd } = await runCommand(args);
  const logCounts = parseLogCounts(stdout);

  return {
    run_id: runId,
    out_dir: outDir,
    upload_strict_path: path.relative(outRoot, path.join(outDir, 'upload_strict.xlsx')),
    review_path: path.relative(outRoot, path.join(outDir, 'review.xlsx')),
    log_created: logCounts?.created,
    log_skipped: logCounts?.skipped,
    spawn_cwd: cwd,
  };
};

export const runSpCreateGenerator = async (
  payload: GeneratorPayload<Record<string, unknown>> & { portfolioId?: string | null }
): Promise<GeneratorResult> => {
  const outRoot = ensureOutRoot(payload.outRoot ?? env.bulkgenOutRoot);
  const templatePath = ensureTemplate(payload.templatePath);
  const runId = sanitizeRunId(payload.runId ?? `ui-sp-create-${Date.now()}`);
  const outDir = buildOutDir(outRoot, runId);
  const exportedAt = payload.exportedAt ?? new Date().toISOString();

  const changes = {
    exported_at: exportedAt,
    run_id: runId,
    notes: payload.notes ?? undefined,
    actions: payload.actions,
  };

  const filePath = writeTempJson(changes);

  const args = [
    'run',
    'bulkgen:sp:create',
    '--',
    '--account-id',
    env.accountId,
    '--marketplace',
    env.marketplace,
    '--template',
    templatePath,
    '--out-dir',
    outDir,
    '--file',
    filePath,
    '--confirm-create',
    '--run-id',
    runId,
  ];

  if (payload.portfolioId) args.push('--portfolio-id', payload.portfolioId);
  if (payload.logEnabled) args.push('--log');
  if (payload.experimentId) args.push('--experiment-id', payload.experimentId);

  const { stdout, cwd } = await runCommand(args);
  const logCounts = parseLogCounts(stdout);

  return {
    run_id: runId,
    out_dir: outDir,
    upload_strict_path: path.relative(outRoot, path.join(outDir, 'upload_strict.xlsx')),
    review_path: path.relative(outRoot, path.join(outDir, 'review.xlsx')),
    manifest_path: path.relative(outRoot, path.join(outDir, 'creation_manifest.json')),
    log_created: logCounts?.created,
    log_skipped: logCounts?.skipped,
    spawn_cwd: cwd,
  };
};
