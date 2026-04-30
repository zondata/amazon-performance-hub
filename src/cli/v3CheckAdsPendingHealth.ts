import fs from 'node:fs';
import path from 'node:path';

import type { Pool } from 'pg';

import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import { createPostgresPool } from '../ingestion/postgresIngestionJobRepository';
import {
  ACTIVE_PENDING_REQUEST_STATUSES,
  DEFAULT_ADS_MAX_PENDING_AGE_HOURS,
  parseResumeAmazonArgs,
  type PendingAgeState,
  reconcileCompletedPendingRequests,
} from './v3ResumeAmazon';

export const DEFAULT_COMPLETED_GRACE_MINUTES = 30;
export const PENDING_HEALTH_SOURCE_TYPES = [
  'ads_api_sp_campaign_daily',
  'ads_api_sp_target_daily',
  'ads_api_sp_placement_daily',
  'ads_api_sp_advertised_product_daily',
  'ads_api_sp_search_term_daily',
] as const;
export const UNHEALTHY_PENDING_REQUEST_STATUSES = [
  'failed',
  'stale_expired',
  'completed',
] as const;

type SourceType = (typeof PENDING_HEALTH_SOURCE_TYPES)[number];
type ActiveStatus = (typeof ACTIVE_PENDING_REQUEST_STATUSES)[number];

export type PendingHealthArgs = {
  accountId: string;
  marketplace: string;
  maxPendingAgeHours: number;
  completedGraceMinutes: number;
};

export type PendingHealthRow = {
  id: string;
  sourceType: string;
  reportId: string;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  retryAfterAt: string | null;
  notes: string | null;
};

export type PendingHealthClassifiedRow = PendingHealthRow & {
  ageState: PendingAgeState;
  ageBasis: 'created_at' | 'updated_at' | 'none';
  waitingForRetryAfter: boolean;
  isActive: boolean;
  isUnhealthy: boolean;
  unhealthyReason: string | null;
  nextAction: string;
};

export type PendingHealthSummary = {
  summary: string;
  exitCode: number;
  activeRows: PendingHealthClassifiedRow[];
  unhealthyRows: PendingHealthClassifiedRow[];
  groupedCounts: Array<{
    sourceType: string;
    status: string;
    count: number;
  }>;
  nextAction: string;
};

const REPORT_PATH = path.resolve(
  process.cwd(),
  'out/v3_ads_pending_resume_report.md'
);

const readTrimmed = (value: string | undefined | null): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const requireDatabaseUrl = (): string => {
  const value = readTrimmed(process.env.DATABASE_URL);
  if (!value) {
    throw new Error('Missing DATABASE_URL in the local environment.');
  }
  return value;
};

const parseInteger = (raw: string | undefined, flag: string): number => {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
};

export const parsePendingHealthArgs = (argv: string[]): PendingHealthArgs => {
  const resumeArgv: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--completed-grace-minutes') {
      index += 1;
      continue;
    }
    if (arg.startsWith('--completed-grace-minutes=')) {
      continue;
    }
    resumeArgv.push(arg);
  }

  const baseArgs = parseResumeAmazonArgs(resumeArgv);
  let completedGraceMinutes = DEFAULT_COMPLETED_GRACE_MINUTES;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--completed-grace-minutes') {
      completedGraceMinutes = parseInteger(
        argv[index + 1],
        '--completed-grace-minutes'
      );
      index += 1;
      continue;
    }
    if (arg.startsWith('--completed-grace-minutes=')) {
      completedGraceMinutes = parseInteger(
        arg.slice('--completed-grace-minutes='.length),
        '--completed-grace-minutes'
      );
    }
  }

  return {
    accountId: baseArgs.accountId,
    marketplace: baseArgs.marketplace,
    maxPendingAgeHours: baseArgs.maxPendingAgeHours,
    completedGraceMinutes,
  };
};

export const classifyPendingRequestAgeFromClock = (args: {
  createdAt: string | null;
  updatedAt: string | null;
  nowIso: string;
  maxPendingAgeHours: number;
}): {
  ageState: PendingAgeState;
  ageBasis: 'created_at' | 'updated_at' | 'none';
} => {
  const createdAtMs = args.createdAt ? new Date(args.createdAt).getTime() : NaN;
  if (Number.isFinite(createdAtMs)) {
    const nowMs = new Date(args.nowIso).getTime();
    if (!Number.isFinite(nowMs)) {
      return { ageState: 'active', ageBasis: 'created_at' };
    }
    return {
      ageState:
        nowMs - createdAtMs > args.maxPendingAgeHours * 60 * 60 * 1000
          ? 'stale_expired'
          : 'active',
      ageBasis: 'created_at',
    };
  }

  const updatedAtMs = args.updatedAt ? new Date(args.updatedAt).getTime() : NaN;
  if (Number.isFinite(updatedAtMs)) {
    const nowMs = new Date(args.nowIso).getTime();
    if (!Number.isFinite(nowMs)) {
      return { ageState: 'active', ageBasis: 'updated_at' };
    }
    return {
      ageState:
        nowMs - updatedAtMs > args.maxPendingAgeHours * 60 * 60 * 1000
          ? 'stale_expired'
          : 'active',
      ageBasis: 'updated_at',
    };
  }

  return {
    ageState: 'active',
    ageBasis: 'none',
  };
};

const isCompletedPastGrace = (args: {
  status: string;
  completedAt: string | null;
  nowIso: string;
  completedGraceMinutes: number;
}): boolean => {
  if (args.status !== 'completed' || !args.completedAt) return false;
  const completedAtMs = new Date(args.completedAt).getTime();
  const nowMs = new Date(args.nowIso).getTime();
  if (!Number.isFinite(completedAtMs) || !Number.isFinite(nowMs)) return false;
  return nowMs - completedAtMs > args.completedGraceMinutes * 60 * 1000;
};

export const classifyPendingHealthRows = (args: {
  rows: PendingHealthRow[];
  nowIso: string;
  maxPendingAgeHours: number;
  completedGraceMinutes: number;
}): PendingHealthSummary => {
  const classifiedRows = args.rows.map<PendingHealthClassifiedRow>((row) => {
    const age = classifyPendingRequestAgeFromClock({
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      nowIso: args.nowIso,
      maxPendingAgeHours: args.maxPendingAgeHours,
    });
    const retryAfterMs = row.retryAfterAt ? new Date(row.retryAfterAt).getTime() : NaN;
    const nowMs = new Date(args.nowIso).getTime();
    const waitingForRetryAfter =
      Number.isFinite(retryAfterMs) && Number.isFinite(nowMs) && retryAfterMs > nowMs;
    const isActive = ACTIVE_PENDING_REQUEST_STATUSES.includes(row.status as ActiveStatus);

    let unhealthyReason: string | null = null;
    if (row.status === 'failed') {
      unhealthyReason = 'Amazon returned a terminal failure for this saved report id.';
    } else if (row.status === 'stale_expired') {
      unhealthyReason = 'The pending request exceeded the configured SLA and can no longer remain in automatic recovery.';
    } else if (
      isCompletedPastGrace({
        status: row.status,
        completedAt: row.completedAt,
        nowIso: args.nowIso,
        completedGraceMinutes: args.completedGraceMinutes,
      })
    ) {
      unhealthyReason =
        'The report finished downloading but was not marked imported within the completed grace window.';
    }

    if (!unhealthyReason && isActive && age.ageState === 'stale_expired') {
      unhealthyReason =
        'The request is still active in Amazon, but it exceeded the configured pending SLA.';
    }

    let nextAction = 'No action required.';
    if (unhealthyReason) {
      nextAction = 'Investigate the saved pending request and repair the downstream import or replace the request.';
    } else if (waitingForRetryAfter) {
      nextAction = 'Waiting until retry_after_at before polling again.';
    } else if (isActive) {
      nextAction = 'Automatic retry remains active. The next scheduled workflow run will poll the same report id again.';
    }

    return {
      ...row,
      ageState: age.ageState,
      ageBasis: age.ageBasis,
      waitingForRetryAfter,
      isActive,
      isUnhealthy: unhealthyReason != null,
      unhealthyReason,
      nextAction,
    };
  });

  const groupedCountsMap = new Map<string, number>();
  for (const row of classifiedRows) {
    const key = `${row.sourceType}::${row.status}`;
    groupedCountsMap.set(key, (groupedCountsMap.get(key) ?? 0) + 1);
  }
  const groupedCounts = [...groupedCountsMap.entries()]
    .map(([key, count]) => {
      const [sourceType, status] = key.split('::');
      return { sourceType, status, count };
    })
    .sort((left, right) =>
      left.sourceType === right.sourceType
        ? left.status.localeCompare(right.status)
        : left.sourceType.localeCompare(right.sourceType)
    );

  const activeRows = classifiedRows.filter((row) => row.isActive);
  const unhealthyRows = classifiedRows.filter((row) => row.isUnhealthy);

  let summary = 'no active or unhealthy Ads pending requests';
  let nextAction = 'No operator action is required.';
  let exitCode = 0;

  if (unhealthyRows.length > 0) {
    summary = 'unhealthy Ads pending requests require attention';
    nextAction =
      'Inspect the unhealthy rows below. Automatic resume should continue only after the failed, stale, or completed-without-import requests are repaired.';
    exitCode = 1;
  } else if (activeRows.length > 0) {
    summary = 'Ads pending requests are active within SLA';
    nextAction =
      activeRows.some((row) => row.waitingForRetryAfter)
        ? 'Automatic resume is waiting for retry_after_at on one or more rows. No manual action is required.'
        : 'Automatic resume remains active. The next scheduled workflow run will continue polling the saved report ids.';
  }

  return {
    summary,
    exitCode,
    activeRows,
    unhealthyRows,
    groupedCounts,
    nextAction,
  };
};

const readPendingRows = async (
  pool: Pool,
  args: PendingHealthArgs
): Promise<PendingHealthRow[]> => {
  const result = await pool.query(
    `
      select
        id::text as id,
        source_type::text as source_type,
        report_id::text as report_id,
        status::text as status,
        start_date::text as start_date,
        end_date::text as end_date,
        created_at::text as created_at,
        updated_at::text as updated_at,
        completed_at::text as completed_at,
        retry_after_at::text as retry_after_at,
        notes
      from public.ads_api_report_requests
      where account_id = $1
        and marketplace = $2
        and source_type = any($3::text[])
      order by source_type asc, start_date asc, end_date asc, created_at asc, updated_at asc
    `,
    [args.accountId, args.marketplace, [...PENDING_HEALTH_SOURCE_TYPES]]
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    sourceType: String(row.source_type),
    reportId: String(row.report_id),
    status: String(row.status),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    retryAfterAt:
      typeof row.retry_after_at === 'string' ? row.retry_after_at : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
  }));
};

const writeReport = (args: {
  cliArgs: PendingHealthArgs;
  summary: PendingHealthSummary;
}): void => {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const lines = [
    '# V3 Ads Pending Resume Report',
    '',
    `- account_id: ${args.cliArgs.accountId}`,
    `- marketplace: ${args.cliArgs.marketplace}`,
    `- max pending age hours: ${args.cliArgs.maxPendingAgeHours}`,
    `- completed grace minutes: ${args.cliArgs.completedGraceMinutes}`,
    `- summary: ${args.summary.summary}`,
    '',
    '## Counts By Source Type And Status',
    '',
  ];

  if (args.summary.groupedCounts.length === 0) {
    lines.push('No Ads pending request rows were found for the configured scope.');
  } else {
    lines.push('| Source type | Status | Count |');
    lines.push('| --- | --- | --- |');
    for (const row of args.summary.groupedCounts) {
      lines.push(`| ${row.sourceType} | ${row.status} | ${row.count} |`);
    }
  }

  lines.push('', '## Active Pending Requests', '');
  if (args.summary.activeRows.length === 0) {
    lines.push('No active pending requests were found.');
  } else {
    lines.push('| Source type | Report ID | Status | Window | SLA clock | Retry after | Next action |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const row of args.summary.activeRows) {
      lines.push(
        `| ${row.sourceType} | ${row.reportId} | ${row.status} | ${row.startDate} -> ${row.endDate} | ${row.ageBasis} (${row.ageState}) | ${row.retryAfterAt ?? 'n/a'} | ${row.nextAction} |`
      );
    }
  }

  lines.push('', '## Terminal Or Unhealthy Requests', '');
  if (args.summary.unhealthyRows.length === 0) {
    lines.push('No terminal or unhealthy pending requests were found.');
  } else {
    lines.push('| Source type | Report ID | Status | Window | Reason | Notes |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const row of args.summary.unhealthyRows) {
      lines.push(
        `| ${row.sourceType} | ${row.reportId} | ${row.status} | ${row.startDate} -> ${row.endDate} | ${row.unhealthyReason ?? 'n/a'} | ${row.notes ?? 'n/a'} |`
      );
    }
  }

  lines.push('', '## Next Action', '', args.summary.nextAction, '');

  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
};

async function main(): Promise<void> {
  loadLocalEnvFiles();
  const cliArgs = parsePendingHealthArgs(process.argv.slice(2));
  const pool = createPostgresPool(requireDatabaseUrl());

  try {
    await reconcileCompletedPendingRequests(pool, cliArgs);
    const rows = await readPendingRows(pool, cliArgs);
    const summary = classifyPendingHealthRows({
      rows,
      nowIso: new Date().toISOString(),
      maxPendingAgeHours: cliArgs.maxPendingAgeHours,
      completedGraceMinutes: cliArgs.completedGraceMinutes,
    });
    writeReport({
      cliArgs,
      summary,
    });
    process.exitCode = summary.exitCode;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    const message =
      error instanceof Error ? error.message : 'Unknown Ads pending health failure';
    console.error(`v3:check:ads-pending-health failed: ${message}`);
    process.exitCode = 1;
  });
}
