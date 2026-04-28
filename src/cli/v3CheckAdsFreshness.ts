import fs from 'node:fs';
import path from 'node:path';

import type { Pool } from 'pg';

import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import { createPostgresPool } from '../ingestion/postgresIngestionJobRepository';
import {
  ACTIVE_PENDING_REQUEST_STATUSES,
  DEFAULT_ADS_MAX_PENDING_AGE_HOURS,
  classifyPendingRequestAge,
  parseResumeAmazonArgs,
} from './v3ResumeAmazon';

type FreshnessArgs = {
  accountId: string;
  marketplace: string;
  maxPendingAgeHours: number;
};

type CoverageRow = {
  lastStatus: string;
  freshnessStatus: string;
  latestPeriodEnd: string | null;
  lastSuccessfulRunAt: string | null;
  notes: string | null;
};

type PendingSummaryRow = {
  reportId: string;
  status: string;
  startDate: string;
  endDate: string;
  updatedAt: string;
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

const parseArgs = (argv: string[]): FreshnessArgs => {
  const parsed = parseResumeAmazonArgs(argv);
  return {
    accountId: parsed.accountId,
    marketplace: parsed.marketplace,
    maxPendingAgeHours: parsed.maxPendingAgeHours,
  };
};

const readCoverageRow = async (
  pool: Pool,
  args: FreshnessArgs
): Promise<CoverageRow | null> => {
  const result = await pool.query(
    `
      select
        last_status::text as last_status,
        freshness_status::text as freshness_status,
        latest_period_end::text as latest_period_end,
        last_successful_run_at::text as last_successful_run_at,
        notes
      from public.data_coverage_status
      where account_id = $1
        and marketplace = $2
        and table_name = 'sp_campaign_hourly_fact_gold'
      limit 1
    `,
    [args.accountId, args.marketplace]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    lastStatus: String(row.last_status),
    freshnessStatus: String(row.freshness_status),
    latestPeriodEnd:
      typeof row.latest_period_end === 'string' ? row.latest_period_end : null,
    lastSuccessfulRunAt:
      typeof row.last_successful_run_at === 'string'
        ? row.last_successful_run_at
        : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
  };
};

const readPendingRows = async (
  pool: Pool,
  args: FreshnessArgs
): Promise<PendingSummaryRow[]> => {
  const result = await pool.query(
    `
      select
        report_id::text as report_id,
        status::text as status,
        start_date::text as start_date,
        end_date::text as end_date,
        updated_at::text as updated_at
      from public.ads_api_report_requests
      where account_id = $1
        and marketplace = $2
        and source_type = 'ads_api_sp_campaign_daily'
        and status = any($3::text[])
      order by updated_at desc
    `,
    [args.accountId, args.marketplace, [...ACTIVE_PENDING_REQUEST_STATUSES]]
  );

  return result.rows.map((row) => ({
    reportId: String(row.report_id),
    status: String(row.status),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    updatedAt: String(row.updated_at),
  }));
};

const writeReport = (args: {
  accountId: string;
  marketplace: string;
  coverage: CoverageRow | null;
  pendingRows: PendingSummaryRow[];
  activePendingRows: PendingSummaryRow[];
  maxPendingAgeHours: number;
  summary: string;
}): void => {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const lines = [
    '# V3 Ads Pending Resume Report',
    '',
    `- Account: ${args.accountId}`,
    `- Marketplace: ${args.marketplace}`,
    `- Max pending age hours: ${args.maxPendingAgeHours}`,
    `- Summary: ${args.summary}`,
    '',
    '## Coverage',
    '',
    args.coverage
      ? `- last_status: ${args.coverage.lastStatus}
- freshness_status: ${args.coverage.freshnessStatus}
- latest_period_end: ${args.coverage.latestPeriodEnd ?? 'n/a'}
- last_successful_run_at: ${args.coverage.lastSuccessfulRunAt ?? 'n/a'}
- notes: ${args.coverage.notes ?? 'n/a'}`
      : '- No `data_coverage_status` row found for `sp_campaign_hourly_fact_gold`.',
    '',
    '## Pending Requests',
    '',
  ];

  if (args.pendingRows.length === 0) {
    lines.push('No active pending Ads requests were found.');
  } else {
    lines.push('| Report ID | Status | Window | Active for auto-retry |');
    lines.push('| --- | --- | --- | --- |');
    for (const row of args.pendingRows) {
      const active = args.activePendingRows.some(
        (activeRow) => activeRow.reportId === row.reportId
      );
      lines.push(
        `| ${row.reportId} | ${row.status} | ${row.startDate} -> ${row.endDate} | ${active ? 'yes' : 'no'} |`
      );
    }
  }

  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
};

async function main(): Promise<void> {
  loadLocalEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  const pool = createPostgresPool(requireDatabaseUrl());

  try {
    const coverage = await readCoverageRow(pool, args);
    const pendingRows = await readPendingRows(pool, args);
    const nowIso = new Date().toISOString();
    const activePendingRows = pendingRows.filter(
      (row) =>
        classifyPendingRequestAge({
          updatedAt: row.updatedAt,
          nowIso,
          maxPendingAgeHours: args.maxPendingAgeHours,
        }) === 'active'
    );

    let summary = 'ads coverage missing';
    let exitCode = 1;
    if (coverage && coverage.lastStatus === 'success') {
      summary = 'ads coverage imported';
      exitCode = 0;
    } else if (activePendingRows.length > 0) {
      summary = 'ads coverage blocked by pending Amazon report, but auto-retry is active';
      exitCode = 0;
    } else if (coverage?.lastStatus === 'blocked') {
      summary = 'ads coverage blocked with no active pending report to recover automatically';
      exitCode = 1;
    }

    writeReport({
      accountId: args.accountId,
      marketplace: args.marketplace,
      coverage,
      pendingRows,
      activePendingRows,
      maxPendingAgeHours: args.maxPendingAgeHours,
      summary,
    });

    process.exitCode = exitCode;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    const message =
      error instanceof Error ? error.message : 'Unknown Ads freshness failure';
    console.error(`v3:check:ads-freshness failed: ${message}`);
    process.exitCode = 1;
  });
}
