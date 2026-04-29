import type { Pool } from 'pg';

import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import { createPostgresPool } from '../ingestion/postgresIngestionJobRepository';
import { parseResumeAmazonArgs } from './v3ResumeAmazon';

type RepairArgs = {
  accountId: string;
  marketplace: string;
};

type CoverageStats = {
  rowCount: number;
  oldestPeriodStart: string | null;
  latestPeriodEnd: string | null;
  latestCompletePeriodEnd: string | null;
};

type LatestRequestRow = {
  reportId: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  retryAfterAt: string | null;
  notes: string | null;
};

type CoverageLastStatus =
  | 'blocked'
  | 'failed'
  | 'no_data'
  | 'partial'
  | 'success'
  | 'unknown';

type CoverageFreshnessStatus =
  | 'blocked'
  | 'delayed_expected'
  | 'fresh'
  | 'no_data'
  | 'stale'
  | 'unknown';

type CoverageSpec = {
  sourceType: 'ads_api_sp_campaign_daily' | 'ads_api_sp_target_daily';
  sourceName: 'sp_campaign_hourly' | 'sp_targeting_daily';
  tableName: 'sp_campaign_hourly_fact_gold' | 'sp_targeting_daily_fact';
  granularity: 'hourly' | 'daily';
  periodStartExpr: string;
  periodEndExpr: string;
  expectedDelayHours: number;
  successNote: string;
  failedLabel: string;
};

type RepairedCoverageRow = {
  sourceType: string;
  tableName: string;
  lastStatus: CoverageLastStatus;
  freshnessStatus: CoverageFreshnessStatus;
  lastSuccessfulRunAt: string | null;
  latestPeriodEnd: string | null;
  notes: string | null;
};

const REPAIR_SPECS: CoverageSpec[] = [
  {
    sourceType: 'ads_api_sp_campaign_daily',
    sourceName: 'sp_campaign_hourly',
    tableName: 'sp_campaign_hourly_fact_gold',
    granularity: 'hourly',
    periodStartExpr:
      "(date::timestamp + coalesce(start_time, time '00:00'))::timestamptz",
    periodEndExpr:
      "(date::timestamp + coalesce(start_time, time '00:00') + interval '1 hour')::timestamptz",
    expectedDelayHours: 48,
    successNote:
      'SP Campaign Daily imported successfully for the latest available period.',
    failedLabel: 'SP Campaign Daily',
  },
  {
    sourceType: 'ads_api_sp_target_daily',
    sourceName: 'sp_targeting_daily',
    tableName: 'sp_targeting_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 48,
    successNote:
      'SP Targeting Daily imported successfully for the latest available period.',
    failedLabel: 'SP Targeting Daily',
  },
];

const ACTIVE_PENDING_STATUSES = new Set([
  'created',
  'requested',
  'pending',
  'polling',
  'pending_timeout',
]);

const requireDatabaseUrl = (): string => {
  const value = process.env.DATABASE_URL?.trim() ?? '';
  if (!value) {
    throw new Error('Missing DATABASE_URL in the local environment.');
  }
  return value;
};

export const parseRepairAdsCoverageArgs = (argv: string[]): RepairArgs => {
  const base = parseResumeAmazonArgs(argv);
  return {
    accountId: base.accountId,
    marketplace: base.marketplace,
  };
};

const deriveFreshnessStatus = (args: {
  latestPeriodEnd: string | null;
  expectedDelayHours: number;
  lastStatus: CoverageLastStatus;
}): CoverageFreshnessStatus => {
  if (args.lastStatus === 'blocked' || args.lastStatus === 'failed') {
    return 'blocked';
  }
  if (args.lastStatus === 'no_data' || !args.latestPeriodEnd) {
    return 'no_data';
  }

  const hoursLag =
    (Date.now() - new Date(args.latestPeriodEnd).getTime()) / (1000 * 60 * 60);
  if (hoursLag <= args.expectedDelayHours) return 'fresh';
  if (hoursLag <= args.expectedDelayHours * 2) return 'delayed_expected';
  return 'stale';
};

const queryCoverageStats = async (
  pool: Pool,
  args: { accountId: string; spec: CoverageSpec; cutoffIso: string }
): Promise<CoverageStats> => {
  const result = await pool.query(
    `
      select
        count(*)::bigint as row_count,
        min(${args.spec.periodStartExpr})::text as oldest_period_start,
        max(${args.spec.periodEndExpr})::text as latest_period_end,
        max(case when ${args.spec.periodEndExpr} <= $2::timestamptz then ${args.spec.periodEndExpr} end)::text
          as latest_complete_period_end
      from public.${args.spec.tableName}
      where account_id = $1
    `,
    [args.accountId, args.cutoffIso]
  );

  const row = result.rows[0] ?? {};
  return {
    rowCount: Number.parseInt(String(row.row_count ?? '0'), 10) || 0,
    oldestPeriodStart:
      typeof row.oldest_period_start === 'string' ? row.oldest_period_start : null,
    latestPeriodEnd:
      typeof row.latest_period_end === 'string' ? row.latest_period_end : null,
    latestCompletePeriodEnd:
      typeof row.latest_complete_period_end === 'string'
        ? row.latest_complete_period_end
        : null,
  };
};

const readLatestRequest = async (
  pool: Pool,
  args: { accountId: string; marketplace: string; sourceType: string }
): Promise<LatestRequestRow | null> => {
  const result = await pool.query(
    `
      select
        report_id::text as report_id,
        status::text as status,
        created_at::text as created_at,
        updated_at::text as updated_at,
        completed_at::text as completed_at,
        retry_after_at::text as retry_after_at,
        notes
      from public.ads_api_report_requests
      where account_id = $1
        and marketplace = $2
        and source_type = $3
      order by completed_at desc nulls last, updated_at desc nulls last, created_at desc nulls last
      limit 1
    `,
    [args.accountId, args.marketplace, args.sourceType]
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    reportId: String(row.report_id),
    status: String(row.status),
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    retryAfterAt:
      typeof row.retry_after_at === 'string' ? row.retry_after_at : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
  };
};

const readLatestSyncRunId = async (
  pool: Pool,
  args: { accountId: string; marketplace: string }
): Promise<string | null> => {
  const result = await pool.query(
    `
      select sync_run_id::text as sync_run_id
      from public.api_sync_runs
      where account_id = $1
        and marketplace = $2
        and source_type = 'ads_api'
        and source_name = 'ads'
      order by requested_at desc nulls last
      limit 1
    `,
    [args.accountId, args.marketplace]
  );
  return typeof result.rows[0]?.sync_run_id === 'string'
    ? result.rows[0].sync_run_id
    : null;
};

export const deriveRepairedCoverageRow = (args: {
  spec: CoverageSpec;
  stats: CoverageStats;
  latestRequest: LatestRequestRow | null;
  lastSyncRunId: string | null;
  nowIso: string;
}): RepairedCoverageRow & { lastSyncRunId: string | null; rowCount: number; oldestPeriodStart: string | null; latestCompletePeriodEnd: string | null; warningCount: number; errorCount: number; missingRanges: string[] } => {
  const { spec, stats, latestRequest } = args;

  let lastStatus: CoverageLastStatus = 'unknown';
  let lastSuccessfulRunAt: string | null = null;
  let notes: string | null = null;
  let warningCount = 0;
  let errorCount = 0;

  if (latestRequest?.status === 'imported') {
    lastStatus = 'success';
    lastSuccessfulRunAt = latestRequest.completedAt ?? latestRequest.updatedAt;
    notes = spec.successNote;
  } else if (latestRequest?.status === 'failed' || latestRequest?.status === 'stale_expired') {
    lastStatus = 'failed';
    errorCount = 1;
    notes =
      latestRequest.notes?.trim() ||
      `${spec.failedLabel} failed and requires operator attention.`;
  } else if (latestRequest && ACTIVE_PENDING_STATUSES.has(latestRequest.status)) {
    lastStatus = stats.rowCount > 0 ? 'partial' : 'blocked';
    warningCount = 1;
    notes =
      stats.rowCount > 0
        ? `${spec.failedLabel} has usable historical data while a refresh request is still pending.`
        : `${spec.failedLabel} is waiting on an active pending Amazon Ads report request.`;
  } else if (stats.rowCount > 0) {
    lastStatus = 'success';
    lastSuccessfulRunAt = latestRequest?.completedAt ?? latestRequest?.updatedAt ?? latestRequest?.createdAt ?? null;
    notes =
      spec.sourceType === 'ads_api_sp_campaign_daily'
        ? 'SP Campaign Daily coverage was repaired from existing imported fact data.'
        : 'SP Targeting Daily coverage was repaired from existing imported fact data.';
  } else {
    lastStatus = 'no_data';
    notes = `${spec.failedLabel} does not yet have imported fact data.`;
  }

  const freshnessStatus = deriveFreshnessStatus({
    latestPeriodEnd: stats.latestPeriodEnd,
    expectedDelayHours: spec.expectedDelayHours,
    lastStatus,
  });

  return {
    sourceType: spec.sourceType,
    tableName: spec.tableName,
    lastStatus,
    freshnessStatus,
    lastSuccessfulRunAt,
    latestPeriodEnd: stats.latestPeriodEnd,
    notes,
    lastSyncRunId: args.lastSyncRunId,
    rowCount: stats.rowCount,
    oldestPeriodStart: stats.oldestPeriodStart,
    latestCompletePeriodEnd: stats.latestCompletePeriodEnd,
    warningCount,
    errorCount,
    missingRanges: [],
  };
};

const upsertCoverageStatus = async (
  pool: Pool,
  args: {
    accountId: string;
    marketplace: string;
    row: ReturnType<typeof deriveRepairedCoverageRow>;
    spec: CoverageSpec;
    finishedAt: string;
  }
): Promise<void> => {
  await pool.query(
    `
      insert into public.data_coverage_status (
        account_id,
        marketplace,
        source_type,
        table_name,
        granularity,
        oldest_period_start,
        latest_period_end,
        latest_complete_period_end,
        last_attempted_run_at,
        last_successful_run_at,
        last_sync_run_id,
        last_status,
        freshness_status,
        expected_delay_hours,
        row_count,
        missing_ranges,
        warning_count,
        error_count,
        notes
      )
      values (
        $1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::timestamptz,
        $9::timestamptz, $10::timestamptz, $11::uuid, $12, $13, $14, $15,
        $16::jsonb, $17, $18, $19
      )
      on conflict (account_id, marketplace, source_type, table_name, granularity)
      do update set
        oldest_period_start = excluded.oldest_period_start,
        latest_period_end = excluded.latest_period_end,
        latest_complete_period_end = excluded.latest_complete_period_end,
        last_attempted_run_at = excluded.last_attempted_run_at,
        last_successful_run_at = coalesce(excluded.last_successful_run_at, data_coverage_status.last_successful_run_at),
        last_sync_run_id = excluded.last_sync_run_id,
        last_status = excluded.last_status,
        freshness_status = excluded.freshness_status,
        expected_delay_hours = excluded.expected_delay_hours,
        row_count = excluded.row_count,
        missing_ranges = excluded.missing_ranges,
        warning_count = excluded.warning_count,
        error_count = excluded.error_count,
        notes = excluded.notes
    `,
    [
      args.accountId,
      args.marketplace,
      args.row.sourceType,
      args.row.tableName,
      args.spec.granularity,
      args.row.oldestPeriodStart,
      args.row.latestPeriodEnd,
      args.row.latestCompletePeriodEnd,
      args.finishedAt,
      args.row.lastSuccessfulRunAt,
      args.row.lastSyncRunId,
      args.row.lastStatus,
      args.row.freshnessStatus,
      args.spec.expectedDelayHours,
      args.row.rowCount,
      JSON.stringify(args.row.missingRanges),
      args.row.warningCount,
      args.row.errorCount,
      args.row.notes,
    ]
  );
};

export const repairAdsCoverageStatus = async (
  pool: Pool,
  args: RepairArgs
): Promise<RepairedCoverageRow[]> => {
  const cutoffIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const finishedAt = new Date().toISOString();
  const lastSyncRunId = await readLatestSyncRunId(pool, args);
  const repaired: RepairedCoverageRow[] = [];

  for (const spec of REPAIR_SPECS) {
    const [stats, latestRequest] = await Promise.all([
      queryCoverageStats(pool, {
        accountId: args.accountId,
        spec,
        cutoffIso,
      }),
      readLatestRequest(pool, {
        accountId: args.accountId,
        marketplace: args.marketplace,
        sourceType: spec.sourceType,
      }),
    ]);

    const row = deriveRepairedCoverageRow({
      spec,
      stats,
      latestRequest,
      lastSyncRunId,
      nowIso: finishedAt,
    });

    await upsertCoverageStatus(pool, {
      accountId: args.accountId,
      marketplace: args.marketplace,
      row,
      spec,
      finishedAt,
    });

    repaired.push(row);
  }

  return repaired;
};

async function main(): Promise<void> {
  loadLocalEnvFiles();
  const args = parseRepairAdsCoverageArgs(process.argv.slice(2));
  const pool = createPostgresPool(requireDatabaseUrl());
  try {
    const repaired = await repairAdsCoverageStatus(pool, args);
    for (const row of repaired) {
      console.log(
        [
          row.sourceType,
          row.tableName,
          `last_status=${row.lastStatus}`,
          `freshness_status=${row.freshnessStatus}`,
          `last_successful_run_at=${row.lastSuccessfulRunAt ?? 'null'}`,
          `latest_period_end=${row.latestPeriodEnd ?? 'null'}`,
        ].join(' | ')
      );
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown Ads coverage repair failure';
    console.error(`v3:repair:ads-coverage-status failed: ${message}`);
    process.exitCode = 1;
  });
}
