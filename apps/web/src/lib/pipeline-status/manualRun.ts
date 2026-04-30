import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ACTIVE_PENDING_STATUSES = [
  'created',
  'requested',
  'pending',
  'polling',
  'pending_timeout',
] as const;

const SOURCE_RUNNERS = {
  sp_api_sales_traffic_daily: {
    label: 'Sales & Traffic',
    buildArgs: (window: ManualRunWindow) => [
      'run',
      'v3:pull:amazon',
      '--',
      '--sources',
      'sales',
      '--from',
      window.from,
      '--to',
      window.to,
      '--mode',
      'manual',
    ],
  },
  ads_api_sp_campaign_daily: {
    label: 'SP campaign daily',
    buildArgs: (window: ManualRunWindow, resumePending: boolean) => [
      'run',
      'adsapi:pull-sp-campaign-daily',
      '--',
      '--start-date',
      window.from,
      '--end-date',
      window.to,
      ...(resumePending ? ['--resume-pending'] : []),
    ],
  },
  ads_api_sp_target_daily: {
    label: 'SP target daily',
    buildArgs: (window: ManualRunWindow, resumePending: boolean) => [
      'run',
      'adsapi:pull-sp-target-daily',
      '--',
      '--start-date',
      window.from,
      '--end-date',
      window.to,
      ...(resumePending ? ['--resume-pending'] : []),
    ],
  },
  ads_api_sp_placement_daily: {
    label: 'SP placement daily',
    buildArgs: (window: ManualRunWindow, resumePending: boolean) => [
      'run',
      'adsapi:pull-sp-placement-daily',
      '--',
      '--start-date',
      window.from,
      '--end-date',
      window.to,
      ...(resumePending ? ['--resume-pending'] : []),
    ],
  },
  ads_api_sp_advertised_product_daily: {
    label: 'SP advertised product daily',
    buildArgs: (window: ManualRunWindow, resumePending: boolean) => [
      'run',
      'adsapi:pull-sp-advertised-product-daily',
      '--',
      '--start-date',
      window.from,
      '--end-date',
      window.to,
      ...(resumePending ? ['--resume-pending'] : []),
    ],
  },
  ads_api_sp_search_term_daily: {
    label: 'SP search term daily',
    buildArgs: (window: ManualRunWindow, resumePending: boolean) => [
      'run',
      'adsapi:pull-sp-search-term-daily',
      '--',
      '--start-date',
      window.from,
      '--end-date',
      window.to,
      ...(resumePending ? ['--resume-pending'] : []),
    ],
  },
  sp_api_sqp_weekly: {
    label: 'SQP',
    buildArgs: (window: ManualRunWindow) => [
      'run',
      'v3:pull:amazon',
      '--',
      '--sources',
      'sqp',
      '--from',
      window.from,
      '--to',
      window.to,
      '--mode',
      'manual',
    ],
  },
} satisfies Record<
  string,
  {
    label: string;
    buildArgs: (window: ManualRunWindow, resumePending: boolean) => string[];
  }
>;

export type ManualRunSourceType = keyof typeof SOURCE_RUNNERS;

export type ManualRunWindow = {
  from: string;
  to: string;
};

export type ManualRunOutcome =
  | {
      status: 'success';
      sourceLabel: string;
      sourceType: ManualRunSourceType;
      window: ManualRunWindow;
      resumedPending: boolean;
      summary: string;
    }
  | {
      status: 'pending';
      sourceLabel: string;
      sourceType: ManualRunSourceType;
      window: ManualRunWindow;
      resumedPending: boolean;
      summary: string;
    };

type PendingWindowRow = {
  startDate: string;
  endDate: string;
};

const RECENT_WINDOW_DAYS = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    '/home/albert/code/amazon-performance-hub-v3',
  ];

  for (const candidate of candidates) {
    if (isRepoRoot(candidate)) return candidate;
  }

  return cwd;
};

const formatDateOnly = (value: Date) => value.toISOString().slice(0, 10);

const addDays = (dateOnly: string, offsetDays: number) => {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return formatDateOnly(date);
};

const trimSingleLine = (value: string) => value.replace(/\s+/g, ' ').trim();

export const supportsPipelineManualRun = (sourceType: string): sourceType is ManualRunSourceType =>
  sourceType in SOURCE_RUNNERS;

export const deriveRecentManualRunWindow = (today = new Date()): ManualRunWindow => {
  const to = formatDateOnly(today);
  const from = addDays(to, -(RECENT_WINDOW_DAYS - 1));
  return { from, to };
};

export const summarizeManualRunOutput = (stdout: string, stderr: string): string => {
  const lines = `${stdout}\n${stderr}`
    .split('\n')
    .map((line) => trimSingleLine(line))
    .filter(Boolean);

  const preferred =
    lines.find((line) => /success|imported|downloaded|saved|completed/i.test(line)) ??
    lines.find((line) => /pending_timeout|remained pending|retry_after_at/i.test(line)) ??
    lines.at(-1) ??
    'Manual run finished.';

  return preferred.length > 220 ? `${preferred.slice(0, 219)}…` : preferred;
};

export const classifyManualRunFailure = (stdout: string, stderr: string): 'pending' | 'error' => {
  const combined = `${stdout}\n${stderr}`;
  return /pending_timeout|remained pending|retry_after_at|still active in Amazon/i.test(combined)
    ? 'pending'
    : 'error';
};

const readPendingWindow = async (
  sourceType: ManualRunSourceType
): Promise<PendingWindowRow | null> => {
  const [{ env }, { supabaseAdmin }] = await Promise.all([
    import('@/lib/env'),
    import('@/lib/supabaseAdmin'),
  ]);
  const result = await supabaseAdmin
    .from('ads_api_report_requests')
    .select('start_date,end_date')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('source_type', sourceType)
    .in('status', [...ACTIVE_PENDING_STATUSES])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw new Error(`Failed to load pending request for ${sourceType}: ${result.error.message}`);
  }

  if (!result.data) {
    return null;
  }

  const startDate =
    typeof result.data.start_date === 'string' && DATE_RE.test(result.data.start_date)
      ? result.data.start_date
      : null;
  const endDate =
    typeof result.data.end_date === 'string' && DATE_RE.test(result.data.end_date)
      ? result.data.end_date
      : null;

  if (!startDate || !endDate) {
    return null;
  }

  return { startDate, endDate };
};

const runCommand = async (args: string[]) => {
  const { env } = await import('@/lib/env');
  if (!env.enableBulkgenSpawn) {
    throw new Error(
      'ENABLE_BULKGEN_SPAWN=1 is required to run pipeline source groups from the web UI.'
    );
  }

  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
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

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
};

export const runPipelineManualSource = async (
  sourceType: ManualRunSourceType
): Promise<ManualRunOutcome> => {
  const runner = SOURCE_RUNNERS[sourceType];
  const pendingWindow =
    sourceType.startsWith('ads_api_') ? await readPendingWindow(sourceType) : null;
  const resumedPending = pendingWindow != null;
  const window = pendingWindow
    ? { from: pendingWindow.startDate, to: pendingWindow.endDate }
    : deriveRecentManualRunWindow();
  const args = runner.buildArgs(window, resumedPending);
  const result = await runCommand(args);
  const summary = summarizeManualRunOutput(result.stdout, result.stderr);

  if (result.code === 0) {
    return {
      status: 'success',
      sourceLabel: runner.label,
      sourceType,
      window,
      resumedPending,
      summary,
    };
  }

  if (classifyManualRunFailure(result.stdout, result.stderr) === 'pending') {
    return {
      status: 'pending',
      sourceLabel: runner.label,
      sourceType,
      window,
      resumedPending,
      summary:
        resumedPending
          ? `Amazon still has the saved report pending. ${summary}`
          : `Amazon accepted the request but it is still pending. ${summary}`,
    };
  }

  throw new Error(summary);
};
