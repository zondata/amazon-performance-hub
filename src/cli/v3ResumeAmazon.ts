import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import type { Pool } from 'pg';

import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import { createPostgresPool } from '../ingestion/postgresIngestionJobRepository';

export const DEFAULT_ADS_MAX_PENDING_AGE_HOURS = 72;
export const DEFAULT_COMPLETED_GRACE_MINUTES = 30;
export const ADS_PENDING_IMPORT_TARGETS = {
  ads_api_sp_campaign_daily: {
    tableName: 'sp_campaign_hourly_fact_gold',
    importedNote:
      'Imported into sp_campaign_hourly_fact_gold by the V3 Ads sync batch.',
  },
  ads_api_sp_target_daily: {
    tableName: 'sp_targeting_daily_fact',
    importedNote:
      'Imported into sp_targeting_daily_fact by the V3 Ads sync batch.',
  },
  ads_api_sp_placement_daily: {
    tableName: 'sp_placement_daily_fact',
    importedNote:
      'Imported into sp_placement_daily_fact by the V3 Ads sync batch.',
  },
  ads_api_sp_advertised_product_daily: {
    tableName: 'sp_advertised_product_daily_fact',
    importedNote:
      'Imported into sp_advertised_product_daily_fact by the V3 Ads sync batch.',
  },
  ads_api_sp_search_term_daily: {
    tableName: 'sp_search_term_daily_fact',
    importedNote:
      'Imported into sp_search_term_daily_fact by the V3 Ads sync batch.',
  },
} as const;
type AdsPendingImportSourceType = keyof typeof ADS_PENDING_IMPORT_TARGETS;
export const ADS_PENDING_IMPORT_SOURCE_TYPES = Object.keys(
  ADS_PENDING_IMPORT_TARGETS
) as AdsPendingImportSourceType[];
export const ACTIVE_PENDING_REQUEST_STATUSES = [
  'created',
  'requested',
  'pending',
  'polling',
  'pending_timeout',
] as const;
export type PendingAgeState = 'active' | 'stale_expired';

type ResumeMode = 'manual' | 'scheduled';

type ResumeArgs = {
  accountId: string;
  marketplace: string;
  mode: ResumeMode;
  softPendingExit: boolean;
  maxPendingAgeHours: number;
};

type PendingRequestRow = {
  id: string;
  sourceType: string;
  reportId: string;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  retryAfterAt: string | null;
  lastPolledAt: string | null;
  attemptCount: number;
  notes: string | null;
};

export type CompletedPendingRequestRow = PendingRequestRow & {
  completedAt: string | null;
};

type ResumeQueueResult = {
  sourceType: string;
  reportId: string;
  startDate: string;
  endDate: string;
  previousStatus: string;
  currentStatus: string;
  completedAt: string | null;
  action: 'resumed' | 'stale_expired' | 'noop';
  commandExitCode: number;
  notes: string[];
};

const hasSupersedingRequest = (args: {
  sourceType: string;
  currentRowId: string;
  endDate: string;
  rows: Array<{
    id: string;
    sourceType: string;
    status: string;
    endDate: string;
  }>;
}): boolean =>
  args.rows.some((row) => {
    if (row.id === args.currentRowId) return false;
    if (row.sourceType !== args.sourceType) return false;
    if (
      row.status !== 'imported' &&
      row.status !== 'completed' &&
      !ACTIVE_PENDING_REQUEST_STATUSES.includes(row.status as (typeof ACTIVE_PENDING_REQUEST_STATUSES)[number])
    ) {
      return false;
    }
    return row.endDate > args.endDate;
  });

const REPORT_PATH = path.resolve(
  process.cwd(),
  'out/v3_ads_pending_resume_report.md'
);

const readTrimmed = (value: string | undefined | null): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const parseInteger = (raw: string | undefined, flag: string): number => {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
};

const readFlagValue = (argv: string[], index: number, flag: string): string => {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
};

export const parseResumeAmazonArgs = (argv: string[]): ResumeArgs => {
  let accountId = readTrimmed(process.env.APP_ACCOUNT_ID) ?? '';
  let marketplace = readTrimmed(process.env.APP_MARKETPLACE)?.toUpperCase() ?? '';
  let mode: ResumeMode = 'scheduled';
  let softPendingExit = false;
  let maxPendingAgeHours =
    parseInteger(
      readTrimmed(process.env.ADS_API_MAX_PENDING_AGE_HOURS) ?? String(DEFAULT_ADS_MAX_PENDING_AGE_HOURS),
      'ADS_API_MAX_PENDING_AGE_HOURS'
    );

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--account-id') {
      accountId = readFlagValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--account-id=')) {
      accountId = arg.slice('--account-id='.length);
      continue;
    }
    if (arg === '--marketplace') {
      marketplace = readFlagValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--marketplace=')) {
      marketplace = arg.slice('--marketplace='.length);
      continue;
    }
    if (arg === '--mode') {
      mode = readFlagValue(argv, index, arg) as ResumeMode;
      index += 1;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      mode = arg.slice('--mode='.length) as ResumeMode;
      continue;
    }
    if (arg === '--max-pending-age-hours') {
      maxPendingAgeHours = parseInteger(
        readFlagValue(argv, index, arg),
        '--max-pending-age-hours'
      );
      index += 1;
      continue;
    }
    if (arg.startsWith('--max-pending-age-hours=')) {
      maxPendingAgeHours = parseInteger(
        arg.slice('--max-pending-age-hours='.length),
        '--max-pending-age-hours'
      );
      continue;
    }
    if (arg === '--soft-pending-exit') {
      softPendingExit = true;
      continue;
    }
    throw new Error(`Unknown CLI argument: ${arg}`);
  }

  if (!accountId) {
    throw new Error('--account-id is required');
  }
  if (!marketplace) {
    throw new Error('--marketplace is required');
  }
  if (!['manual', 'scheduled'].includes(mode)) {
    throw new Error(`Unsupported --mode value: ${mode}`);
  }

  return {
    accountId,
    marketplace,
    mode,
    softPendingExit,
    maxPendingAgeHours,
  };
};

export const classifyPendingRequestAge = (args: {
  updatedAt: string;
  nowIso: string;
  maxPendingAgeHours: number;
}): PendingAgeState => {
  const updatedAtMs = new Date(args.updatedAt).getTime();
  const nowMs = new Date(args.nowIso).getTime();
  if (!Number.isFinite(updatedAtMs) || !Number.isFinite(nowMs)) {
    return 'active';
  }
  return nowMs - updatedAtMs > args.maxPendingAgeHours * 60 * 60 * 1000
    ? 'stale_expired'
    : 'active';
};

export const classifyPendingRequestAgeByClock = (args: {
  createdAt: string | null;
  updatedAt: string | null;
  nowIso: string;
  maxPendingAgeHours: number;
}): PendingAgeState => {
  const createdAtMs = args.createdAt ? new Date(args.createdAt).getTime() : NaN;
  if (Number.isFinite(createdAtMs)) {
    const nowMs = new Date(args.nowIso).getTime();
    if (!Number.isFinite(nowMs)) {
      return 'active';
    }
    return nowMs - createdAtMs > args.maxPendingAgeHours * 60 * 60 * 1000
      ? 'stale_expired'
      : 'active';
  }

  return classifyPendingRequestAge({
    updatedAt: args.updatedAt ?? '',
    nowIso: args.nowIso,
    maxPendingAgeHours: args.maxPendingAgeHours,
  });
};

const requireDatabaseUrl = (): string => {
  const value = readTrimmed(process.env.DATABASE_URL);
  if (!value) {
    throw new Error('Missing DATABASE_URL in the local environment.');
  }
  return value;
};

const isCompletedPastGrace = (args: {
  currentStatus: string;
  completedAt: string | null;
  nowIso: string;
  completedGraceMinutes: number;
}): boolean => {
  if (args.currentStatus !== 'completed' || !args.completedAt) {
    return false;
  }
  const completedAtMs = new Date(args.completedAt).getTime();
  const nowMs = new Date(args.nowIso).getTime();
  if (!Number.isFinite(completedAtMs) || !Number.isFinite(nowMs)) {
    return false;
  }
  return nowMs - completedAtMs > args.completedGraceMinutes * 60 * 1000;
};

export const listPendingRequests = async (
  pool: Pool,
  args: ResumeArgs
): Promise<PendingRequestRow[]> => {
  const result = await pool.query(
    `
      select
        distinct on (source_type, start_date, end_date)
        id::text as id,
        source_type::text as source_type,
        report_id::text as report_id,
        status::text as status,
        start_date::text as start_date,
        end_date::text as end_date,
        created_at::text as created_at,
        updated_at::text as updated_at,
        retry_after_at::text as retry_after_at,
        last_polled_at::text as last_polled_at,
        attempt_count,
        notes
      from public.ads_api_report_requests
      where account_id = $1
        and marketplace = $2
        and source_type = any($3::text[])
        and status = any($4::text[])
      order by source_type asc, start_date asc, end_date asc, updated_at desc
    `,
    [
      args.accountId,
      args.marketplace,
      ADS_PENDING_IMPORT_SOURCE_TYPES,
      [...ACTIVE_PENDING_REQUEST_STATUSES],
    ]
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    sourceType: String(row.source_type),
    reportId: String(row.report_id),
    status: String(row.status),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    retryAfterAt:
      typeof row.retry_after_at === 'string' ? row.retry_after_at : null,
    lastPolledAt:
      typeof row.last_polled_at === 'string' ? row.last_polled_at : null,
    attemptCount: Number.parseInt(String(row.attempt_count ?? 0), 10) || 0,
    notes: typeof row.notes === 'string' ? row.notes : null,
  }));
};

const isAdsPendingImportSourceType = (
  sourceType: string
): sourceType is AdsPendingImportSourceType =>
  sourceType in ADS_PENDING_IMPORT_TARGETS;

export const listCompletedPendingRequests = async (
  pool: Pool,
  args: Pick<ResumeArgs, 'accountId' | 'marketplace'>
): Promise<CompletedPendingRequestRow[]> => {
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
        last_polled_at::text as last_polled_at,
        attempt_count,
        notes
      from public.ads_api_report_requests
      where account_id = $1
        and marketplace = $2
        and source_type = any($3::text[])
        and status = 'completed'
      order by source_type asc, start_date asc, end_date asc, updated_at desc
    `,
    [args.accountId, args.marketplace, ADS_PENDING_IMPORT_SOURCE_TYPES]
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    sourceType: String(row.source_type),
    reportId: String(row.report_id),
    status: String(row.status),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
    completedAt:
      typeof row.completed_at === 'string' ? row.completed_at : null,
    retryAfterAt:
      typeof row.retry_after_at === 'string' ? row.retry_after_at : null,
    lastPolledAt:
      typeof row.last_polled_at === 'string' ? row.last_polled_at : null,
    attemptCount: Number.parseInt(String(row.attempt_count ?? 0), 10) || 0,
    notes: typeof row.notes === 'string' ? row.notes : null,
  }));
};

const hasImportedCoverageForCompletedRequest = async (
  pool: Pool,
  args: {
    accountId: string;
    row: CompletedPendingRequestRow;
  }
): Promise<boolean> => {
  if (!isAdsPendingImportSourceType(args.row.sourceType)) {
    return false;
  }

  const tableName = ADS_PENDING_IMPORT_TARGETS[args.row.sourceType].tableName;
  const result = await pool.query(
    `
      select exists (
        select 1
        from public.${tableName}
        where account_id = $1
          and date >= $2::date
          and date <= $3::date
      ) as has_rows
    `,
    [args.accountId, args.row.startDate, args.row.endDate]
  );

  return result.rows[0]?.has_rows === true;
};

const markCompletedPendingRequestImported = async (
  pool: Pool,
  row: CompletedPendingRequestRow
): Promise<void> => {
  if (!isAdsPendingImportSourceType(row.sourceType)) {
    return;
  }

  await pool.query(
    `
      update public.ads_api_report_requests
      set
        status = 'imported',
        status_details = coalesce(status_details, 'imported'),
        notes = $2,
        completed_at = coalesce(completed_at, now()),
        last_polled_at = coalesce(last_polled_at, now())
      where id = $1::uuid
    `,
    [row.id, ADS_PENDING_IMPORT_TARGETS[row.sourceType].importedNote]
  );
};

export const reconcileCompletedPendingRequests = async (
  pool: Pool,
  args: Pick<ResumeArgs, 'accountId' | 'marketplace'>
): Promise<string[]> => {
  const rows = await listCompletedPendingRequests(pool, args);
  const reconciledReportIds: string[] = [];

  for (const row of rows) {
    if (!(await hasImportedCoverageForCompletedRequest(pool, {
      accountId: args.accountId,
      row,
    }))) {
      continue;
    }

    await markCompletedPendingRequestImported(pool, row);
    reconciledReportIds.push(row.reportId);
  }

  return reconciledReportIds;
};

export const shouldWaitForRetryAfter = (args: {
  retryAfterAt: string | null;
  nowIso: string;
}): boolean => {
  if (!args.retryAfterAt) return false;
  const retryAfterMs = new Date(args.retryAfterAt).getTime();
  const nowMs = new Date(args.nowIso).getTime();
  if (!Number.isFinite(retryAfterMs) || !Number.isFinite(nowMs)) {
    return false;
  }
  return retryAfterMs > nowMs;
};

const markPendingRequestStale = async (
  pool: Pool,
  row: PendingRequestRow,
  maxPendingAgeHours: number
): Promise<void> => {
  await pool.query(
    `
      update public.ads_api_report_requests
      set
        status = 'stale_expired',
        status_details = coalesce(status_details, 'pending_sla_exceeded'),
        failed_at = coalesce(failed_at, now()),
        notes = $2
      where id = $1::uuid
    `,
    [
      row.id,
      `Exceeded pending-report SLA of ${maxPendingAgeHours} hours. A future Ads sync may create a replacement request for this date window.`,
    ]
  );
};

const readCurrentRequestState = async (
  pool: Pool,
  row: PendingRequestRow
): Promise<{ status: string; completedAt: string | null }> => {
  const result = await pool.query(
    `
      select status::text as status, completed_at::text as completed_at
      from public.ads_api_report_requests
      where id = $1::uuid
      limit 1
    `,
    [row.id]
  );
  return {
    status:
      typeof result.rows[0]?.status === 'string' ? result.rows[0].status : row.status,
    completedAt:
      typeof result.rows[0]?.completed_at === 'string'
        ? result.rows[0].completed_at
        : null,
  };
};

const runResumeCommand = async (
  args: ResumeArgs,
  row: PendingRequestRow
): Promise<{ exitCode: number; stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const childArgs = [
      'run',
      'v3:pull:amazon',
      '--',
      '--account-id',
      args.accountId,
      '--marketplace',
      args.marketplace,
      '--from',
      row.startDate,
      '--to',
      row.endDate,
      '--sources',
      'ads',
      '--mode',
      args.mode,
      '--resume-pending',
      ...(args.softPendingExit ? ['--soft-pending-exit'] : []),
    ];
    const child = spawn('npm', childArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });

const writeReport = (args: {
  rows: ResumeQueueResult[];
  accountId: string;
  marketplace: string;
  maxPendingAgeHours: number;
}): void => {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const lines = [
    '# V3 Ads Pending Resume Report',
    '',
    `- Account: ${args.accountId}`,
    `- Marketplace: ${args.marketplace}`,
    `- Max pending age hours: ${args.maxPendingAgeHours}`,
    '',
  ];

  if (args.rows.length === 0) {
    lines.push('No active Ads pending requests were found.');
  } else {
    lines.push('| Source type | Report ID | Window | Previous status | Current status | Action | Notes |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const row of args.rows) {
      lines.push(
        `| ${row.sourceType} | ${row.reportId} | ${row.startDate} -> ${row.endDate} | ${row.previousStatus} | ${row.currentStatus} | ${row.action} | ${row.notes.join(' ; ') || 'none'} |`
      );
    }
  }

  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
};

async function main(): Promise<void> {
  loadLocalEnvFiles();
  const args = parseResumeAmazonArgs(process.argv.slice(2));
  const pool = createPostgresPool(requireDatabaseUrl());
  const nowIso = new Date().toISOString();
  const results: ResumeQueueResult[] = [];
  let hadHardFailure = false;

  try {
    await reconcileCompletedPendingRequests(pool, args);
    const pendingRows = await listPendingRequests(pool, args);
    for (const row of pendingRows) {
      const ageState = classifyPendingRequestAgeByClock({
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        nowIso,
        maxPendingAgeHours: args.maxPendingAgeHours,
      });

      if (ageState === 'stale_expired') {
        await markPendingRequestStale(pool, row, args.maxPendingAgeHours);
        results.push({
          sourceType: row.sourceType,
          reportId: row.reportId,
          startDate: row.startDate,
          endDate: row.endDate,
          previousStatus: row.status,
          currentStatus: 'stale_expired',
          completedAt: null,
          action: 'stale_expired',
          commandExitCode: 0,
          notes: ['Exceeded the pending-report SLA and can now be replaced by a future sync run.'],
        });
        continue;
      }

      if (shouldWaitForRetryAfter({ retryAfterAt: row.retryAfterAt, nowIso })) {
        results.push({
          sourceType: row.sourceType,
          reportId: row.reportId,
          startDate: row.startDate,
          endDate: row.endDate,
          previousStatus: row.status,
          currentStatus: row.status,
          completedAt: null,
          action: 'noop',
          commandExitCode: 0,
          notes: ['Waiting until retry_after_at before polling again.'],
        });
        continue;
      }

      const commandResult = await runResumeCommand(args, row);
      const currentState = await readCurrentRequestState(pool, row);
      const currentStatus = currentState.status;
      const notes: string[] = [];
      if (currentStatus === 'imported') {
        notes.push('Report completed and imported successfully.');
      } else if (currentStatus === 'pending_timeout') {
        notes.push('Amazon still has the report pending; the next scheduled retry will poll the same report id again.');
      } else if (currentStatus === 'failed') {
        notes.push('Amazon returned a terminal failure for the saved report id.');
      } else if (currentStatus === 'completed') {
        notes.push('Report download completed, but the downstream import did not mark the request as imported.');
      }
      if (
        commandResult.exitCode !== 0 &&
        !(
          args.softPendingExit &&
          (currentStatus === 'pending_timeout' ||
            currentStatus === 'pending' ||
            currentStatus === 'polling')
        ) &&
        currentStatus !== 'pending_timeout'
      ) {
        hadHardFailure = true;
        notes.push('Resume command exited non-zero.');
      }

      results.push({
        sourceType: row.sourceType,
        reportId: row.reportId,
        startDate: row.startDate,
        endDate: row.endDate,
        previousStatus: row.status,
        currentStatus,
        completedAt: currentState.completedAt,
        action: 'resumed',
        commandExitCode: commandResult.exitCode,
        notes,
      });
    }
  } finally {
    await pool.end();
  }

  writeReport({
    rows: results,
    accountId: args.accountId,
    marketplace: args.marketplace,
    maxPendingAgeHours: args.maxPendingAgeHours,
  });

  const unresolvedWithoutRecovery = results.some(
    (row) => {
      if (row.currentStatus === 'failed') {
        return true;
      }
      if (row.currentStatus === 'stale_expired') {
        return !hasSupersedingRequest({
          sourceType: row.sourceType,
          currentRowId: row.reportId,
          endDate: row.endDate,
          rows: results.map((result) => ({
            id: result.reportId,
            sourceType: result.sourceType,
            status: result.currentStatus,
            endDate: result.endDate,
          })),
        });
      }
      if (row.currentStatus !== 'completed') {
        return false;
      }
      return isCompletedPastGrace({
        currentStatus: row.currentStatus,
        completedAt: row.completedAt,
        nowIso,
        completedGraceMinutes: DEFAULT_COMPLETED_GRACE_MINUTES,
      });
    }
  );

  if (hadHardFailure || unresolvedWithoutRecovery) {
    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

if (require.main === module) {
  void main().catch((error) => {
    const message =
      error instanceof Error ? error.message : 'Unknown Ads pending resume failure';
    console.error(`v3:resume:amazon failed: ${message}`);
    process.exitCode = 1;
  });
}
