import fs from 'node:fs';
import path from 'node:path';

import type { Pool } from 'pg';

import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import { createPostgresPool } from '../ingestion/postgresIngestionJobRepository';
import {
  classifyPendingHealthRows,
  type PendingHealthClassifiedRow,
  type PendingHealthRow,
} from './v3CheckAdsPendingHealth';
import {
  DEFAULT_ADS_MAX_PENDING_AGE_HOURS,
  parseResumeAmazonArgs,
} from './v3ResumeAmazon';

const REPORT_PATH = path.resolve(
  process.cwd(),
  'out/v3_ads_loop_verification.md'
);

const IMPLEMENTED_LOOP_SOURCES = [
  {
    sourceType: 'ads_api_sp_campaign_daily',
    tableName: 'sp_campaign_hourly_fact_gold',
    label: 'SP campaign daily',
  },
  {
    sourceType: 'ads_api_sp_target_daily',
    tableName: 'sp_targeting_daily_fact',
    label: 'SP target daily',
  },
] as const;

const WARN_ONLY_NOT_IMPLEMENTED = [
  'SP placement daily',
  'SP STIS daily',
  'SP advertised product daily',
  'SB campaign daily',
  'SD campaign daily',
];

type VerifyAdsLoopArgs = {
  accountId: string;
  marketplace: string;
  lookbackHours: number;
  maxPendingAgeHours: number;
};

type CoverageStatusRow = {
  sourceType: string;
  tableName: string;
  lastStatus: string;
  freshnessStatus: string;
  latestPeriodEnd: string | null;
  lastSuccessfulRunAt: string | null;
  notes: string | null;
};

type PendingVerificationRow = PendingHealthRow & {
  profileIdHash: string | null;
  reportTypeId: string | null;
};

export type DuplicateActiveScopeIssue = {
  key: string;
  reportIds: string[];
  sourceType: string;
  startDate: string;
  endDate: string;
};

export type AdsLoopVerificationResult = {
  status: 'PASS' | 'WARN' | 'FAIL';
  summary: string;
  failures: string[];
  warnings: string[];
  unhealthyRows: PendingHealthClassifiedRow[];
  activeRows: PendingHealthClassifiedRow[];
  duplicateIssues: DuplicateActiveScopeIssue[];
  implementedCoverage: Array<{
    sourceType: string;
    tableName: string;
    coverageStatus: string;
    hasRecentImport: boolean;
    hasActiveRecovery: boolean;
    lastSuccessfulRunAt: string | null;
    latestPeriodEnd: string | null;
    notes: string | null;
  }>;
};

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

export const parseVerifyAdsLoopArgs = (argv: string[]): VerifyAdsLoopArgs => {
  const resumeArgv: string[] = [];
  let lookbackHours = 36;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--lookback-hours') {
      lookbackHours = parseInteger(argv[index + 1], '--lookback-hours');
      index += 1;
      continue;
    }
    if (arg.startsWith('--lookback-hours=')) {
      lookbackHours = parseInteger(
        arg.slice('--lookback-hours='.length),
        '--lookback-hours'
      );
      continue;
    }
    resumeArgv.push(arg);
  }

  const baseArgs = parseResumeAmazonArgs(resumeArgv);
  return {
    accountId: baseArgs.accountId,
    marketplace: baseArgs.marketplace,
    lookbackHours,
    maxPendingAgeHours:
      baseArgs.maxPendingAgeHours || DEFAULT_ADS_MAX_PENDING_AGE_HOURS,
  };
};

const readPendingRows = async (
  pool: Pool,
  args: VerifyAdsLoopArgs
): Promise<PendingVerificationRow[]> => {
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
        notes,
        profile_id_hash::text as profile_id_hash,
        report_type_id::text as report_type_id
      from public.ads_api_report_requests
      where account_id = $1
        and marketplace = $2
        and source_type = any($3::text[])
      order by created_at desc nulls last, updated_at desc nulls last
    `,
    [args.accountId, args.marketplace, IMPLEMENTED_LOOP_SOURCES.map((row) => row.sourceType)]
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
    profileIdHash:
      typeof row.profile_id_hash === 'string' ? row.profile_id_hash : null,
    reportTypeId:
      typeof row.report_type_id === 'string' ? row.report_type_id : null,
  }));
};

const readCoverageRows = async (
  pool: Pool,
  args: VerifyAdsLoopArgs
): Promise<CoverageStatusRow[]> => {
  const result = await pool.query(
    `
      select
        source_type::text as source_type,
        table_name::text as table_name,
        last_status::text as last_status,
        freshness_status::text as freshness_status,
        latest_period_end::text as latest_period_end,
        last_successful_run_at::text as last_successful_run_at,
        notes
      from public.data_coverage_status
      where account_id = $1
        and marketplace = $2
        and table_name = any($3::text[])
    `,
    [args.accountId, args.marketplace, IMPLEMENTED_LOOP_SOURCES.map((row) => row.tableName)]
  );

  return result.rows.map((row) => ({
    sourceType: String(row.source_type),
    tableName: String(row.table_name),
    lastStatus: String(row.last_status),
    freshnessStatus: String(row.freshness_status),
    latestPeriodEnd:
      typeof row.latest_period_end === 'string' ? row.latest_period_end : null,
    lastSuccessfulRunAt:
      typeof row.last_successful_run_at === 'string'
        ? row.last_successful_run_at
        : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
  }));
};

export const findDuplicateActiveScopes = (
  rows: PendingVerificationRow[]
): DuplicateActiveScopeIssue[] => {
  const activeStatuses = new Set([
    'created',
    'requested',
    'pending',
    'polling',
    'pending_timeout',
  ]);
  const buckets = new Map<string, PendingVerificationRow[]>();

  for (const row of rows) {
    if (!activeStatuses.has(row.status)) continue;
    const key = [
      row.sourceType,
      row.profileIdHash ?? 'null',
      row.reportTypeId ?? 'null',
      row.startDate,
      row.endDate,
    ].join('|');
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      buckets.set(key, [row]);
    }
  }

  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.length > 1)
    .map(([key, bucket]) => ({
      key,
      reportIds: bucket.map((row) => row.reportId),
      sourceType: bucket[0].sourceType,
      startDate: bucket[0].startDate,
      endDate: bucket[0].endDate,
    }));
};

const isRecentEnough = (
  value: string | null,
  nowIso: string,
  lookbackHours: number
): boolean => {
  if (!value) return false;
  const valueMs = new Date(value).getTime();
  const nowMs = new Date(nowIso).getTime();
  if (!Number.isFinite(valueMs) || !Number.isFinite(nowMs)) return false;
  return nowMs - valueMs <= lookbackHours * 60 * 60 * 1000;
};

export const evaluateAdsLoopVerification = (args: {
  nowIso: string;
  lookbackHours: number;
  maxPendingAgeHours: number;
  pendingRows: PendingVerificationRow[];
  coverageRows: CoverageStatusRow[];
}): AdsLoopVerificationResult => {
  const health = classifyPendingHealthRows({
    rows: args.pendingRows,
    nowIso: args.nowIso,
    maxPendingAgeHours: args.maxPendingAgeHours,
    completedGraceMinutes: 30,
  });
  const duplicateIssues = findDuplicateActiveScopes(args.pendingRows);
  const failures = [...health.unhealthyRows].map(
    (row) => `${row.sourceType} ${row.reportId}: ${row.unhealthyReason ?? row.status}`
  );
  for (const issue of duplicateIssues) {
    failures.push(
      `${issue.sourceType} has duplicate active report ids for ${issue.startDate} -> ${issue.endDate}: ${issue.reportIds.join(', ')}`
    );
  }

  const coverageByTable = new Map(
    args.coverageRows.map((row) => [row.tableName, row] as const)
  );
  const implementedCoverage = IMPLEMENTED_LOOP_SOURCES.map((source) => {
    const coverage = coverageByTable.get(source.tableName) ?? null;
    const hasActiveRecovery = health.activeRows.some(
      (row) => row.sourceType === source.sourceType
    );
    const hasRecentImport = isRecentEnough(
      coverage?.lastSuccessfulRunAt ?? null,
      args.nowIso,
      args.lookbackHours
    );
    const coverageStatus = coverage
      ? `${coverage.lastStatus}/${coverage.freshnessStatus}`
      : 'no_coverage_row';

    if (
      !hasActiveRecovery &&
      (!coverage ||
        coverage.lastStatus !== 'success' ||
        coverage.freshnessStatus === 'stale') &&
      !hasRecentImport
    ) {
      failures.push(
        `${source.label} coverage is not healthy and no active pending recovery exists.`
      );
    }

    return {
      sourceType: source.sourceType,
      tableName: source.tableName,
      coverageStatus,
      hasRecentImport,
      hasActiveRecovery,
      lastSuccessfulRunAt: coverage?.lastSuccessfulRunAt ?? null,
      latestPeriodEnd: coverage?.latestPeriodEnd ?? null,
      notes: coverage?.notes ?? null,
    };
  });

  const warnings = WARN_ONLY_NOT_IMPLEMENTED.map(
    (label) => `${label} is not implemented yet and is not part of the loop failure gate.`
  );

  const status: 'PASS' | 'WARN' | 'FAIL' =
    failures.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';
  const summary =
    status === 'FAIL'
      ? 'Implemented Ads report loop has unhealthy pending state or stale coverage.'
      : status === 'WARN'
        ? 'Implemented Ads report loop is healthy. Unsupported sources remain intentionally unimplemented.'
        : 'Implemented Ads report loop is healthy.';

  return {
    status,
    summary,
    failures,
    warnings,
    unhealthyRows: health.unhealthyRows,
    activeRows: health.activeRows,
    duplicateIssues,
    implementedCoverage,
  };
};

const writeVerificationReport = (args: {
  accountId: string;
  marketplace: string;
  lookbackHours: number;
  maxPendingAgeHours: number;
  result: AdsLoopVerificationResult;
}): void => {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  const lines = [
    '# V3 Ads Loop Verification',
    '',
    `- Account: ${args.accountId}`,
    `- Marketplace: ${args.marketplace}`,
    `- Lookback hours: ${args.lookbackHours}`,
    `- Max pending age hours: ${args.maxPendingAgeHours}`,
    `- Status: ${args.result.status}`,
    `- Summary: ${args.result.summary}`,
    '',
    '## Implemented Sources',
    '',
    '| Source type | Target table | Coverage | Recent import | Active pending recovery | Last successful import | Latest period end | Notes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...args.result.implementedCoverage.map(
      (row) =>
        `| ${row.sourceType} | ${row.tableName} | ${row.coverageStatus} | ${row.hasRecentImport ? 'yes' : 'no'} | ${row.hasActiveRecovery ? 'yes' : 'no'} | ${row.lastSuccessfulRunAt ?? '—'} | ${row.latestPeriodEnd ?? '—'} | ${row.notes ?? '—'} |`
    ),
    '',
    '## Active Pending Requests',
    '',
  ];

  if (args.result.activeRows.length === 0) {
    lines.push('No active pending recovery rows.');
  } else {
    lines.push('| Source type | Report ID | Status | Window | retry_after_at | Next action |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const row of args.result.activeRows) {
      lines.push(
        `| ${row.sourceType} | ${row.reportId} | ${row.status} | ${row.startDate} -> ${row.endDate} | ${row.retryAfterAt ?? '—'} | ${row.nextAction} |`
      );
    }
  }

  lines.push('', '## Failures', '');
  if (args.result.failures.length === 0) {
    lines.push('No failures.');
  } else {
    for (const failure of args.result.failures) {
      lines.push(`- ${failure}`);
    }
  }

  lines.push('', '## Warnings', '');
  if (args.result.warnings.length === 0) {
    lines.push('No warnings.');
  } else {
    for (const warning of args.result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
};

async function main(): Promise<void> {
  loadLocalEnvFiles();
  const args = parseVerifyAdsLoopArgs(process.argv.slice(2));
  const pool = createPostgresPool(requireDatabaseUrl());

  try {
    const [pendingRows, coverageRows] = await Promise.all([
      readPendingRows(pool, args),
      readCoverageRows(pool, args),
    ]);
    const result = evaluateAdsLoopVerification({
      nowIso: new Date().toISOString(),
      lookbackHours: args.lookbackHours,
      maxPendingAgeHours: args.maxPendingAgeHours,
      pendingRows,
      coverageRows,
    });

    writeVerificationReport({
      accountId: args.accountId,
      marketplace: args.marketplace,
      lookbackHours: args.lookbackHours,
      maxPendingAgeHours: args.maxPendingAgeHours,
      result,
    });

    process.exitCode = result.status === 'FAIL' ? 1 : 0;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    const message =
      error instanceof Error ? error.message : 'Unknown Ads loop verification failure';
    console.error(`v3:verify:ads-loop failed: ${message}`);
    process.exitCode = 1;
  });
}
