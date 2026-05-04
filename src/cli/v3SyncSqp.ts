import fs from 'node:fs/promises';
import path from 'node:path';

import type { Pool } from 'pg';

import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import {
  createFirstSqpReport,
  downloadAndIngestFirstSqpReport,
  pollFirstSqpReportStatus,
  requireFirstSqpReportDocumentId,
  type FirstSqpReportStatusSummary,
  type SqpReportPeriod,
} from '../connectors/sp-api/firstSqpRealPull';
import {
  SpApiAuthError,
  SpApiConfigError,
  SpApiRequestError,
  SpApiSqpIngestError,
  SpApiSqpPullError,
  type SpApiReportProcessingStatus,
  type SpApiSqpRealPullSummary,
} from '../connectors/sp-api/types';
import { ingestSqpMonthlyRaw } from '../ingest/ingestSqpMonthlyRaw';
import { createPostgresPool } from '../ingestion/postgresIngestionJobRepository';
import {
  ensureSpApiSqpIngestCsvPath,
  parseValidatedSpApiSqpRawArtifact,
  readSpApiSqpRawArtifact,
  resolveSpApiSqpRawArtifactPath,
  summarizeSpApiSqpParseIngest,
} from '../connectors/sp-api/firstSqpParseIngest';

export type SqpSource = 'weekly' | 'monthly';
export type SqpSourceOption = SqpSource | 'all';
export type SqpMode = 'scheduled' | 'manual' | 'backfill';
export type SqpRequestStatus =
  | 'created'
  | 'requested'
  | 'polling'
  | 'pending_timeout'
  | 'completed'
  | 'imported'
  | 'unavailable'
  | 'failed'
  | 'stale_expired';

export type SqpWindow = {
  startDate: string;
  endDate: string;
};

export type SqpSyncOptions = {
  accountId: string;
  marketplace: string;
  source: SqpSourceOption;
  mode: SqpMode;
  from: string | null;
  to: string | null;
  monthlyBackfillStart: string;
  maxWindowsPerRun: number;
  maxAsinsPerRun: number;
  resumePending: boolean;
  resumePendingOnly: boolean;
  softUnavailableExit: boolean;
  dryRun: boolean;
  maxPollAttempts: number;
  pollIntervalMs: number;
  releaseTimezone: string;
};

export type SqpPendingRequest = {
  id: string;
  accountId: string;
  marketplace: string;
  asin: string;
  sourceType: string;
  reportPeriod: SqpReportPeriod;
  reportId: string;
  reportDocumentId: string | null;
  startDate: string;
  endDate: string;
  status: SqpRequestStatus;
  attemptCount: number;
};

type Queryable = {
  query: (
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: Record<string, unknown>[] }>;
};

type SqpCoverageStatus = 'delayed_expected' | 'fresh' | 'stale' | 'no_data';

type SqpReportRunner = {
  createReport: typeof createFirstSqpReport;
  pollReport: typeof pollFirstSqpReportStatus;
  downloadAndIngest: typeof downloadAndIngestFirstSqpReport;
};

export type SqpSyncDeps = {
  db: Queryable;
  now?: Date;
  reportRunner?: Partial<SqpReportRunner>;
  writeReport?: (markdown: string) => Promise<void>;
};

export type SqpSyncReport = {
  accountId: string;
  marketplace: string;
  source: SqpSourceOption;
  mode: SqpMode;
  selectedWindows: Record<SqpSource, SqpWindow[]>;
  selectedAsinCount: number;
  createdReportRequests: number;
  resumedReportRequests: number;
  importedWindows: string[];
  unavailableWindows: string[];
  pendingWindows: string[];
  failures: string[];
  notes: string[];
  nextAction: string;
  exitCode: number;
};

const ACTIVE_STATUSES: SqpRequestStatus[] = [
  'created',
  'requested',
  'polling',
  'pending_timeout',
  'completed',
];

const DELAY_NOTE =
  'Amazon has not published this SQP period yet; the next scheduled run will retry.';

const SOURCE_META: Record<SqpSource, {
  sourceType: string;
  tableName: string;
  granularity: string;
  reportPeriod: SqpReportPeriod;
}> = {
  weekly: {
    sourceType: 'sp_api_sqp_weekly',
    tableName: 'sqp_weekly_raw',
    granularity: 'weekly',
    reportPeriod: 'WEEK',
  },
  monthly: {
    sourceType: 'sp_api_sqp_monthly',
    tableName: 'sqp_monthly_raw',
    granularity: 'monthly',
    reportPeriod: 'MONTH',
  },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_ASIN_RE = /^[A-Z0-9]{10}$/;

const parseDateOnly = (value: string, fieldName: string): string => {
  const trimmed = value.trim();
  if (!DATE_RE.test(trimmed)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format`);
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new Error(`${fieldName} must be a valid UTC date`);
  }
  return trimmed;
};

export const dateOnly = (value: Date): string => value.toISOString().slice(0, 10);

export const addDays = (value: string, days: number): string => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
};

const compareDate = (left: string, right: string): number => left.localeCompare(right);

const minDate = (left: string, right: string): string =>
  compareDate(left, right) <= 0 ? left : right;

const maxDate = (left: string, right: string): string =>
  compareDate(left, right) >= 0 ? left : right;

const dayOfWeekUtc = (value: string): number =>
  new Date(`${value}T00:00:00.000Z`).getUTCDay();

export const startOfWeekSunday = (value: string): string =>
  addDays(value, -dayOfWeekUtc(value));

export const endOfWeekSaturday = (value: string): string =>
  addDays(startOfWeekSunday(value), 6);

export const startOfMonth = (value: string): string => `${value.slice(0, 8)}01`;

export const endOfMonth = (value: string): string => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return dateOnly(new Date(Date.UTC(year, month, 0)));
};

const addMonths = (value: string, months: number): string => {
  const year = Number(value.slice(0, 4));
  const monthIndex = Number(value.slice(5, 7)) - 1 + months;
  return dateOnly(new Date(Date.UTC(year, monthIndex, 1)));
};

const localDateInTimezone = (now: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error(`Could not resolve local date for timezone ${timeZone}`);
  }
  return `${year}-${month}-${day}`;
};

export const latestEligibleWeeklyWindow = (
  now: Date,
  releaseTimezone = 'America/Los_Angeles'
): SqpWindow | null => {
  const localDate = localDateInTimezone(now, releaseTimezone);
  const dow = dayOfWeekUtc(localDate);
  const daysSinceEligibleSaturday = dow >= 1 ? dow + 1 : 8;
  const endDate = addDays(localDate, -daysSinceEligibleSaturday);
  return {
    startDate: addDays(endDate, -6),
    endDate,
  };
};

export const latestEligibleMonthlyWindow = (
  now: Date,
  releaseTimezone = 'America/Los_Angeles'
): SqpWindow | null => {
  const localDate = localDateInTimezone(now, releaseTimezone);
  const previousMonthStart = addMonths(startOfMonth(localDate), -1);
  return {
    startDate: previousMonthStart,
    endDate: endOfMonth(previousMonthStart),
  };
};

const isOldEnoughForHardNoData = (
  source: SqpSource,
  window: SqpWindow,
  now: Date,
  releaseTimezone: string
): boolean => {
  const localDate = localDateInTimezone(now, releaseTimezone);
  const releaseDate =
    source === 'weekly'
      ? addDays(window.endDate, 2)
      : addMonths(startOfMonth(window.startDate), 1);
  const graceDays = source === 'weekly' ? 7 : 14;
  return compareDate(localDate, addDays(releaseDate, graceDays)) > 0;
};

export const buildWeeklyCatchupWindows = (args: {
  latestExistingWeekEnd: string | null;
  from: string | null;
  to: string | null;
  now: Date;
  releaseTimezone: string;
  maxWindows: number;
}): { windows: SqpWindow[]; note: string | null } => {
  const latestEligible = latestEligibleWeeklyWindow(args.now, args.releaseTimezone);
  if (!latestEligible) return { windows: [], note: null };
  const cappedTo = args.to
    ? minDate(endOfWeekSaturday(parseDateOnly(args.to, '--to')), latestEligible.endDate)
    : latestEligible.endDate;
  let start: string;
  if (args.from) {
    start = startOfWeekSunday(parseDateOnly(args.from, '--from'));
  } else if (args.latestExistingWeekEnd) {
    start = addDays(args.latestExistingWeekEnd, 1);
  } else {
    return {
      windows: [],
      note: 'Weekly SQP has no existing data. Provide --from for initial weekly backfill.',
    };
  }
  if (compareDate(start, cappedTo) > 0) return { windows: [], note: null };
  const windows: SqpWindow[] = [];
  for (let cursor = start; compareDate(cursor, cappedTo) <= 0; cursor = addDays(cursor, 7)) {
    windows.push({ startDate: cursor, endDate: addDays(cursor, 6) });
    if (windows.length >= args.maxWindows) break;
  }
  return { windows, note: null };
};

export const buildMonthlyCatchupWindows = (args: {
  latestExistingPeriodEnd: string | null;
  from: string | null;
  to: string | null;
  monthlyBackfillStart: string;
  now: Date;
  releaseTimezone: string;
  maxWindows: number;
}): SqpWindow[] => {
  const latestEligible = latestEligibleMonthlyWindow(args.now, args.releaseTimezone);
  if (!latestEligible) return [];
  const cappedTo = args.to
    ? minDate(endOfMonth(parseDateOnly(args.to, '--to')), latestEligible.endDate)
    : latestEligible.endDate;
  const start = args.from
    ? startOfMonth(parseDateOnly(args.from, '--from'))
    : args.latestExistingPeriodEnd
      ? addMonths(startOfMonth(args.latestExistingPeriodEnd), 1)
      : startOfMonth(parseDateOnly(args.monthlyBackfillStart, '--monthly-backfill-start'));
  if (compareDate(start, cappedTo) > 0) return [];
  const windows: SqpWindow[] = [];
  for (let cursor = start; compareDate(cursor, cappedTo) <= 0; cursor = addMonths(cursor, 1)) {
    windows.push({ startDate: cursor, endDate: endOfMonth(cursor) });
    if (windows.length >= args.maxWindows) break;
  }
  return windows;
};

const normalizeRequestRow = (row: Record<string, unknown>): SqpPendingRequest => ({
  id: String(row.id),
  accountId: String(row.account_id),
  marketplace: String(row.marketplace),
  asin: String(row.asin),
  sourceType: String(row.source_type),
  reportPeriod: String(row.report_period) as SqpReportPeriod,
  reportId: String(row.report_id),
  reportDocumentId: typeof row.report_document_id === 'string' ? row.report_document_id : null,
  startDate: String(row.start_date).slice(0, 10),
  endDate: String(row.end_date).slice(0, 10),
  status: String(row.status) as SqpRequestStatus,
  attemptCount: Number(row.attempt_count ?? 0),
});

export const selectSqpAsins = async (
  db: Queryable,
  accountId: string,
  marketplace: string,
  maxAsins: number
): Promise<string[]> => {
  const result = await db.query(
    `
      select asin
      from public.products
      where account_id = $1
        and marketplace = $2
      order by asin asc
    `,
    [accountId, marketplace]
  );
  return result.rows
    .map((row) => String(row.asin ?? '').trim().toUpperCase())
    .filter((asin) => VALID_ASIN_RE.test(asin))
    .slice(0, maxAsins);
};

const getLatestExistingEnd = async (
  db: Queryable,
  source: SqpSource,
  accountId: string,
  marketplace: string
): Promise<string | null> => {
  const column = source === 'weekly' ? 'week_end' : 'period_end';
  const table = source === 'weekly' ? 'sqp_weekly_raw' : 'sqp_monthly_raw';
  const result = await db.query(
    `
      select max(${column})::text as latest_end
      from public.${table}
      where account_id = $1
        and marketplace = $2
        and scope_type = 'asin'
    `,
    [accountId, marketplace]
  );
  const value = result.rows[0]?.latest_end;
  return typeof value === 'string' && value.trim() ? value.slice(0, 10) : null;
};

export const findActiveSqpReportRequest = async (args: {
  db: Queryable;
  accountId: string;
  marketplace: string;
  asin: string;
  sourceType: string;
  startDate: string;
  endDate: string;
}): Promise<SqpPendingRequest | null> => {
  const result = await args.db.query(
    `
      select *
      from public.sp_api_sqp_report_requests
      where account_id = $1
        and marketplace = $2
        and asin = $3
        and source_type = $4
        and start_date = $5::date
        and end_date = $6::date
        and status = any($7::text[])
      order by updated_at desc
      limit 1
    `,
    [
      args.accountId,
      args.marketplace,
      args.asin,
      args.sourceType,
      args.startDate,
      args.endDate,
      ACTIVE_STATUSES,
    ]
  );
  return result.rows[0] ? normalizeRequestRow(result.rows[0]) : null;
};

const insertSqpReportRequest = async (args: {
  db: Queryable;
  accountId: string;
  marketplace: string;
  asin: string;
  sourceType: string;
  reportPeriod: SqpReportPeriod;
  reportId: string;
  startDate: string;
  endDate: string;
  rawJson: Record<string, unknown>;
}): Promise<SqpPendingRequest> => {
  const result = await args.db.query(
    `
      insert into public.sp_api_sqp_report_requests (
        account_id,
        marketplace,
        asin,
        source_type,
        report_period,
        report_id,
        start_date,
        end_date,
        status,
        requested_at,
        raw_json
      )
      values ($1, $2, $3, $4, $5, $6, $7::date, $8::date, 'requested', now(), $9::jsonb)
      returning *
    `,
    [
      args.accountId,
      args.marketplace,
      args.asin,
      args.sourceType,
      args.reportPeriod,
      args.reportId,
      args.startDate,
      args.endDate,
      JSON.stringify(args.rawJson),
    ]
  );
  return normalizeRequestRow(result.rows[0]);
};

const listPendingRequests = async (args: {
  db: Queryable;
  accountId: string;
  marketplace: string;
  sourceTypes: string[];
}): Promise<SqpPendingRequest[]> => {
  const result = await args.db.query(
    `
      select *
      from public.sp_api_sqp_report_requests
      where account_id = $1
        and marketplace = $2
        and source_type = any($3::text[])
        and status in ('created', 'requested', 'polling', 'pending_timeout', 'completed')
      order by updated_at asc, asin asc
    `,
    [args.accountId, args.marketplace, args.sourceTypes]
  );
  return result.rows.map((row) => normalizeRequestRow(row));
};

const updateRequestStatus = async (args: {
  db: Queryable;
  id: string;
  status: SqpRequestStatus;
  reportDocumentId?: string | null;
  statusDetails?: string | null;
  notes?: string | null;
  rawJson?: Record<string, unknown> | null;
}): Promise<void> => {
  await args.db.query(
    `
      update public.sp_api_sqp_report_requests
      set status = $2,
        report_document_id = coalesce($3, report_document_id),
        status_details = $4,
        notes = $5,
        raw_json = coalesce($6::jsonb, raw_json),
        attempt_count = attempt_count + 1,
        last_polled_at = case when $2 in ('polling', 'pending_timeout', 'completed', 'imported', 'failed') then now() else last_polled_at end,
        completed_at = case when $2 in ('completed', 'imported') then now() else completed_at end,
        imported_at = case when $2 = 'imported' then now() else imported_at end,
        failed_at = case when $2 in ('failed', 'unavailable') then now() else failed_at end,
        retry_after_at = case when $2 in ('pending_timeout', 'unavailable') then now() + interval '1 hour' else retry_after_at end
      where id = $1
    `,
    [
      args.id,
      args.status,
      args.reportDocumentId ?? null,
      args.statusDetails ?? null,
      args.notes ?? null,
      args.rawJson ? JSON.stringify(args.rawJson) : null,
    ]
  );
};

const requestScopeKey = (args: {
  sourceType: string;
  asin: string;
  startDate: string;
  endDate: string;
}): string => `${args.sourceType}:${args.asin}:${args.startDate}:${args.endDate}`;

export const isExpectedSqpUnavailableError = (error: unknown): boolean => {
  if (error instanceof SpApiAuthError || error instanceof SpApiConfigError) {
    return false;
  }
  const details = error as { details?: unknown; status?: number };
  const text = [
    error instanceof Error ? error.message : String(error),
    details?.status == null ? '' : String(details.status),
    details?.details == null ? '' : JSON.stringify(details.details),
  ].join('\n');
  return /not published|not available|unavailable|no data|DONE_NO_DATA|does not exist|invalid.*date.*range/i.test(text);
};

const parseAndIngestMonthly = async (args: {
  reportId?: string;
  rawFilePath?: string;
  rawOutputRoot?: string;
  csvOutputRoot?: string;
  env?: NodeJS.ProcessEnv;
}) => {
  const resolvedArtifact = await resolveSpApiSqpRawArtifactPath(args);
  const rawArtifact = await readSpApiSqpRawArtifact({
    inputFilePath: resolvedArtifact.inputFilePath,
  });
  const parsed = parseValidatedSpApiSqpRawArtifact({
    text: rawArtifact.text,
    filenameHint: rawArtifact.filenameHint,
  });
  if (parsed.periodType !== 'MONTH') {
    throw new SpApiSqpIngestError(
      'validation_failed',
      `SP-API monthly SQP parse+ingest requires MONTH content; received ${parsed.periodType}`
    );
  }
  const accountId = args.env?.APP_ACCOUNT_ID?.trim();
  const marketplace = args.env?.APP_MARKETPLACE?.trim();
  if (!accountId || !marketplace) {
    throw new SpApiSqpIngestError(
      'invalid_input',
      'Monthly SQP parse+ingest requires APP_ACCOUNT_ID and APP_MARKETPLACE in the local environment'
    );
  }
  const csvPath = await ensureSpApiSqpIngestCsvPath({
    rawFilePath: rawArtifact.inputFilePath,
    rawText: rawArtifact.text,
    reportId: resolvedArtifact.reportId,
    decompressed: rawArtifact.decompressed,
    outputRoot: args.csvOutputRoot,
  });
  const ingestResult = await ingestSqpMonthlyRaw(csvPath, accountId, marketplace);
  return summarizeSpApiSqpParseIngest({
    reportId: resolvedArtifact.reportId,
    inputFilePath: rawArtifact.inputFilePath,
    parsed,
    ingestResult,
  });
};

const queryCoverageStats = async (args: {
  db: Queryable;
  source: SqpSource;
  accountId: string;
  marketplace: string;
}): Promise<{ oldest: string | null; latest: string | null; count: number }> => {
  const table = SOURCE_META[args.source].tableName;
  const startColumn = args.source === 'weekly' ? 'week_start' : 'period_start';
  const endColumn = args.source === 'weekly' ? 'week_end' : 'period_end';
  const result = await args.db.query(
    `
      select
        min(${startColumn})::text as oldest,
        max(${endColumn})::text as latest,
        count(*)::int as row_count
      from public.${table}
      where account_id = $1
        and marketplace = $2
        and scope_type = 'asin'
    `,
    [args.accountId, args.marketplace]
  );
  return {
    oldest: typeof result.rows[0]?.oldest === 'string' ? result.rows[0].oldest.slice(0, 10) : null,
    latest: typeof result.rows[0]?.latest === 'string' ? result.rows[0].latest.slice(0, 10) : null,
    count: Number(result.rows[0]?.row_count ?? 0),
  };
};

const upsertCoverage = async (args: {
  db: Queryable;
  accountId: string;
  marketplace: string;
  source: SqpSource;
  lastStatus: 'success' | 'no_data' | 'failed';
  freshnessStatus: SqpCoverageStatus;
  note: string | null;
}): Promise<void> => {
  const meta = SOURCE_META[args.source];
  const stats = await queryCoverageStats(args);
  await args.db.query(
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
        $1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $7::timestamptz,
        now(), case when $8 = 'success' then now() else null end, $8, $9, $10, $11,
        '[]'::jsonb, case when $9 = 'delayed_expected' then 1 else 0 end,
        case when $8 = 'failed' then 1 else 0 end, $12
      )
      on conflict (account_id, marketplace, source_type, table_name, granularity)
      do update set
        oldest_period_start = excluded.oldest_period_start,
        latest_period_end = excluded.latest_period_end,
        latest_complete_period_end = excluded.latest_complete_period_end,
        last_attempted_run_at = excluded.last_attempted_run_at,
        last_successful_run_at = coalesce(excluded.last_successful_run_at, data_coverage_status.last_successful_run_at),
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
      meta.sourceType,
      meta.tableName,
      meta.granularity,
      stats.oldest,
      stats.latest,
      args.lastStatus,
      args.freshnessStatus,
      args.source === 'weekly' ? 168 : 720,
      stats.count,
      args.note,
    ]
  );
};

const handleUnavailable = async (args: {
  db: Queryable;
  report: SqpSyncReport;
  request: SqpPendingRequest | null;
  source: SqpSource;
  asin: string;
  window: SqpWindow;
  soft: boolean;
}): Promise<void> => {
  if (args.request) {
    await updateRequestStatus({
      db: args.db,
      id: args.request.id,
      status: 'unavailable',
      statusDetails: DELAY_NOTE,
      notes: DELAY_NOTE,
    });
  }
  await upsertCoverage({
    db: args.db,
    accountId: args.report.accountId,
    marketplace: args.report.marketplace,
    source: args.source,
    lastStatus: 'no_data',
    freshnessStatus: 'delayed_expected',
    note: DELAY_NOTE,
  });
  args.report.unavailableWindows.push(
    `${args.source}:${args.asin}:${args.window.startDate}->${args.window.endDate}`
  );
  args.report.notes.push(DELAY_NOTE);
  if (!args.soft) args.report.exitCode = 1;
};

const resumeRequest = async (args: {
  request: SqpPendingRequest;
  source: SqpSource;
  options: SqpSyncOptions;
  db: Queryable;
  report: SqpSyncReport;
  runner: SqpReportRunner;
  now: Date;
}): Promise<void> => {
  args.report.resumedReportRequests += 1;
  let statusSummary: FirstSqpReportStatusSummary;
  try {
    statusSummary = await args.runner.pollReport({
      reportId: args.request.reportId,
      maxAttempts: args.options.maxPollAttempts,
      pollIntervalMs: args.options.pollIntervalMs,
    });
  } catch (error) {
    if (isExpectedSqpUnavailableError(error)) {
      await handleUnavailable({
        db: args.db,
        report: args.report,
        request: args.request,
        source: args.source,
        asin: args.request.asin,
        window: { startDate: args.request.startDate, endDate: args.request.endDate },
        soft: args.options.softUnavailableExit,
      });
      return;
    }
    await updateRequestStatus({
      db: args.db,
      id: args.request.id,
      status: 'failed',
      statusDetails: error instanceof Error ? error.message : String(error),
    });
    args.report.failures.push(error instanceof Error ? error.message : String(error));
    args.report.exitCode = 1;
    return;
  }

  if (statusSummary.maxAttemptsReached || ['IN_QUEUE', 'IN_PROGRESS'].includes(statusSummary.processingStatus)) {
    const note = `Amazon SQP report ${args.request.reportId} is still ${statusSummary.processingStatus}; the next scheduled run will retry the saved report id.`;
    await updateRequestStatus({
      db: args.db,
      id: args.request.id,
      status: 'pending_timeout',
      statusDetails: note,
      notes: note,
      rawJson: statusSummary as unknown as Record<string, unknown>,
    });
    await upsertCoverage({
      db: args.db,
      accountId: args.options.accountId,
      marketplace: args.options.marketplace,
      source: args.source,
      lastStatus: 'no_data',
      freshnessStatus: 'delayed_expected',
      note,
    });
    args.report.pendingWindows.push(
      `${args.source}:${args.request.asin}:${args.request.startDate}->${args.request.endDate}`
    );
    return;
  }

  if (statusSummary.processingStatus === 'DONE_NO_DATA') {
    await handleUnavailable({
      db: args.db,
      report: args.report,
      request: args.request,
      source: args.source,
      asin: args.request.asin,
      window: { startDate: args.request.startDate, endDate: args.request.endDate },
      soft: args.options.softUnavailableExit,
    });
    return;
  }

  if (statusSummary.processingStatus !== 'DONE') {
    const status = statusSummary.processingStatus as SpApiReportProcessingStatus;
    await updateRequestStatus({
      db: args.db,
      id: args.request.id,
      status: 'failed',
      statusDetails: `SP-API SQP report ended in terminal status ${status}`,
      rawJson: statusSummary as unknown as Record<string, unknown>,
    });
    args.report.failures.push(`SP-API SQP report ${args.request.reportId} ended in ${status}`);
    args.report.exitCode = 1;
    return;
  }

  await updateRequestStatus({
    db: args.db,
    id: args.request.id,
    status: 'completed',
    reportDocumentId: statusSummary.reportDocumentId,
    rawJson: statusSummary as unknown as Record<string, unknown>,
  });

  try {
    const summary = await args.runner.downloadAndIngest({
      reportId: args.request.reportId,
      reportDocumentId: requireFirstSqpReportDocumentId(statusSummary),
      env: {
        ...process.env,
        APP_ACCOUNT_ID: args.options.accountId,
        APP_MARKETPLACE: args.options.marketplace,
      },
      parseIngestImpl: args.source === 'monthly' ? parseAndIngestMonthly : undefined,
    });
    await updateRequestStatus({
      db: args.db,
      id: args.request.id,
      status: 'imported',
      reportDocumentId: summary.reportDocumentId,
      statusDetails: `Imported ${summary.rowCount} rows.`,
    });
    await upsertCoverage({
      db: args.db,
      accountId: args.options.accountId,
      marketplace: args.options.marketplace,
      source: args.source,
      lastStatus: 'success',
      freshnessStatus: 'fresh',
      note: null,
    });
    args.report.importedWindows.push(
      `${args.source}:${args.request.asin}:${args.request.startDate}->${args.request.endDate}`
    );
  } catch (error) {
    const softNoData =
      isExpectedSqpUnavailableError(error) ||
      (!isOldEnoughForHardNoData(
        args.source,
        { startDate: args.request.startDate, endDate: args.request.endDate },
        args.now,
        args.options.releaseTimezone
      ) &&
        error instanceof Error &&
        /zero SQP rows|no data/i.test(error.message));
    if (softNoData) {
      await handleUnavailable({
        db: args.db,
        report: args.report,
        request: args.request,
        source: args.source,
        asin: args.request.asin,
        window: { startDate: args.request.startDate, endDate: args.request.endDate },
        soft: args.options.softUnavailableExit,
      });
      return;
    }
    await updateRequestStatus({
      db: args.db,
      id: args.request.id,
      status: 'failed',
      statusDetails: error instanceof Error ? error.message : String(error),
    });
    args.report.failures.push(error instanceof Error ? error.message : String(error));
    args.report.exitCode = 1;
  }
};

const createAndMaybeResume = async (args: {
  source: SqpSource;
  window: SqpWindow;
  asin: string;
  options: SqpSyncOptions;
  db: Queryable;
  report: SqpSyncReport;
  runner: SqpReportRunner;
  now: Date;
}): Promise<void> => {
  const meta = SOURCE_META[args.source];
  const existing = await findActiveSqpReportRequest({
    db: args.db,
    accountId: args.options.accountId,
    marketplace: args.options.marketplace,
    asin: args.asin,
    sourceType: meta.sourceType,
    startDate: args.window.startDate,
    endDate: args.window.endDate,
  });
  if (existing) {
    if (args.options.resumePending) {
      await resumeRequest({ ...args, request: existing });
    } else {
      args.report.pendingWindows.push(
        `${args.source}:${args.asin}:${args.window.startDate}->${args.window.endDate}`
      );
    }
    return;
  }
  if (args.options.dryRun) {
    args.report.notes.push(
      `dry-run: would request ${args.source} ${args.asin} ${args.window.startDate}->${args.window.endDate}`
    );
    return;
  }

  let created: { reportId: string };
  try {
    created = await args.runner.createReport({
      asin: args.asin,
      startDate: args.window.startDate,
      endDate: args.window.endDate,
      reportPeriod: meta.reportPeriod,
    });
  } catch (error) {
    if (isExpectedSqpUnavailableError(error)) {
      await handleUnavailable({
        db: args.db,
        report: args.report,
        request: null,
        source: args.source,
        asin: args.asin,
        window: args.window,
        soft: args.options.softUnavailableExit,
      });
      return;
    }
    args.report.failures.push(error instanceof Error ? error.message : String(error));
    args.report.exitCode = 1;
    return;
  }

  const request = await insertSqpReportRequest({
    db: args.db,
    accountId: args.options.accountId,
    marketplace: args.options.marketplace,
    asin: args.asin,
    sourceType: meta.sourceType,
    reportPeriod: meta.reportPeriod,
    reportId: created.reportId,
    startDate: args.window.startDate,
    endDate: args.window.endDate,
    rawJson: { report_id: created.reportId },
  });
  args.report.createdReportRequests += 1;
  await resumeRequest({ ...args, request });
};

const writeMarkdownReport = async (markdown: string): Promise<void> => {
  const outputPath = path.resolve(process.cwd(), 'out', 'v3_sqp_sync_report.md');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, markdown, 'utf8');
};

export const renderSqpSyncReport = (report: SqpSyncReport): string => {
  const windowLines = (source: SqpSource) =>
    report.selectedWindows[source].map((window) => `- ${window.startDate} -> ${window.endDate}`).join('\n') || '- none';
  return [
    '# V3 SQP Sync Report',
    '',
    `- account_id: ${report.accountId}`,
    `- marketplace: ${report.marketplace}`,
    `- source: ${report.source}`,
    `- mode: ${report.mode}`,
    `- selected ASIN count: ${report.selectedAsinCount}`,
    '',
    '## Selected windows',
    '',
    '### Weekly',
    windowLines('weekly'),
    '',
    '### Monthly',
    windowLines('monthly'),
    '',
    '## Results',
    '',
    `- created report requests: ${report.createdReportRequests}`,
    `- resumed report requests: ${report.resumedReportRequests}`,
    `- imported windows: ${report.importedWindows.length}`,
    `- unavailable windows: ${report.unavailableWindows.length}`,
    `- pending windows: ${report.pendingWindows.length}`,
    `- failures: ${report.failures.length}`,
    '',
    '## Details',
    '',
    `- imported: ${report.importedWindows.join(', ') || 'none'}`,
    `- unavailable: ${report.unavailableWindows.join(', ') || 'none'}`,
    `- pending: ${report.pendingWindows.join(', ') || 'none'}`,
    `- failures: ${report.failures.join(' | ') || 'none'}`,
    `- notes: ${report.notes.join(' | ') || 'none'}`,
    '',
    '## Next action',
    '',
    report.nextAction,
    '',
  ].join('\n');
};

export const runV3SqpSync = async (
  options: SqpSyncOptions,
  deps: SqpSyncDeps
): Promise<SqpSyncReport> => {
  const now = deps.now ?? new Date();
  const sources: SqpSource[] =
    options.source === 'all' ? ['weekly', 'monthly'] : [options.source];
  const selectedWindows: Record<SqpSource, SqpWindow[]> = { weekly: [], monthly: [] };
  const report: SqpSyncReport = {
    accountId: options.accountId,
    marketplace: options.marketplace,
    source: options.source,
    mode: options.mode,
    selectedWindows,
    selectedAsinCount: 0,
    createdReportRequests: 0,
    resumedReportRequests: 0,
    importedWindows: [],
    unavailableWindows: [],
    pendingWindows: [],
    failures: [],
    notes: [],
    nextAction: 'No action required.',
    exitCode: 0,
  };

  const runner: SqpReportRunner = {
    createReport: deps.reportRunner?.createReport ?? createFirstSqpReport,
    pollReport: deps.reportRunner?.pollReport ?? pollFirstSqpReportStatus,
    downloadAndIngest:
      deps.reportRunner?.downloadAndIngest ?? downloadAndIngestFirstSqpReport,
  };

  const asins = options.resumePendingOnly
    ? []
    : await selectSqpAsins(deps.db, options.accountId, options.marketplace, options.maxAsinsPerRun);
  report.selectedAsinCount = asins.length;
  const resumedScopeKeys = new Set<string>();

  if (options.resumePending || options.resumePendingOnly) {
    const pending = await listPendingRequests({
      db: deps.db,
      accountId: options.accountId,
      marketplace: options.marketplace,
      sourceTypes: sources.map((source) => SOURCE_META[source].sourceType),
    });
    for (const request of pending) {
      const source = request.sourceType === SOURCE_META.weekly.sourceType ? 'weekly' : 'monthly';
      resumedScopeKeys.add(
        requestScopeKey({
          sourceType: request.sourceType,
          asin: request.asin,
          startDate: request.startDate,
          endDate: request.endDate,
        })
      );
      await resumeRequest({
        request,
        source,
        options,
        db: deps.db,
        report,
        runner,
        now,
      });
    }
  }

  if (!options.resumePendingOnly) {
    for (const source of sources) {
      const latestExistingEnd = await getLatestExistingEnd(
        deps.db,
        source,
        options.accountId,
        options.marketplace
      );
      if (source === 'weekly') {
        const built = buildWeeklyCatchupWindows({
          latestExistingWeekEnd: latestExistingEnd,
          from: options.from,
          to: options.to,
          now,
          releaseTimezone: options.releaseTimezone,
          maxWindows: options.maxWindowsPerRun,
        });
        selectedWindows.weekly = built.windows;
        if (built.note) report.notes.push(built.note);
      } else {
        selectedWindows.monthly = buildMonthlyCatchupWindows({
          latestExistingPeriodEnd: latestExistingEnd,
          from: options.from,
          to: options.to,
          monthlyBackfillStart: options.monthlyBackfillStart,
          now,
          releaseTimezone: options.releaseTimezone,
          maxWindows: options.maxWindowsPerRun,
        });
      }

      for (const window of selectedWindows[source]) {
        for (const asin of asins) {
          const scopeKey = requestScopeKey({
            sourceType: SOURCE_META[source].sourceType,
            asin,
            startDate: window.startDate,
            endDate: window.endDate,
          });
          if (resumedScopeKeys.has(scopeKey)) {
            continue;
          }
          await createAndMaybeResume({
            source,
            window,
            asin,
            options,
            db: deps.db,
            report,
            runner,
            now,
          });
        }
      }
    }
  }

  if (report.failures.length > 0) {
    report.nextAction = 'Review failures, fix hard errors, then rerun the same command.';
  } else if (report.pendingWindows.length > 0) {
    report.nextAction = 'Let the pending resume workflow poll the saved report ids.';
  } else if (report.unavailableWindows.length > 0) {
    report.nextAction = DELAY_NOTE;
  }

  const markdown = renderSqpSyncReport(report);
  await (deps.writeReport ?? writeMarkdownReport)(markdown);
  return report;
};

const parsePositiveInt = (value: string, flag: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
};

const getValue = (argv: string[], index: number, flag: string): string => {
  const value = argv[index + 1];
  if (value == null || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
};

export const parseV3SqpSyncArgs = (
  argv: string[],
  env: NodeJS.ProcessEnv = process.env
): SqpSyncOptions => {
  const invoked = path.basename(process.argv[1] ?? '');
  const isResumeScript = invoked.includes('v3SyncSqp') && argv.includes('--resume-pending-only');
  const options: SqpSyncOptions = {
    accountId: env.APP_ACCOUNT_ID?.trim() ?? '',
    marketplace: env.APP_MARKETPLACE?.trim() ?? '',
    source: 'all',
    mode: 'manual',
    from: null,
    to: null,
    monthlyBackfillStart: '2024-01-01',
    maxWindowsPerRun: env.GITHUB_ACTIONS ? 1 : 2,
    maxAsinsPerRun: 5,
    resumePending: false,
    resumePendingOnly: isResumeScript,
    softUnavailableExit: false,
    dryRun: false,
    maxPollAttempts: 6,
    pollIntervalMs: 5000,
    releaseTimezone: env.SQP_RELEASE_TIMEZONE?.trim() || 'America/Los_Angeles',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const read = () => getValue(argv, index, arg);
    if (arg === '--account-id') {
      options.accountId = read();
      index += 1;
    } else if (arg === '--marketplace') {
      options.marketplace = read();
      index += 1;
    } else if (arg === '--source') {
      const value = read();
      if (!['weekly', 'monthly', 'all'].includes(value)) throw new Error('--source must be weekly, monthly, or all');
      options.source = value as SqpSourceOption;
      index += 1;
    } else if (arg === '--mode') {
      const value = read();
      if (!['scheduled', 'manual', 'backfill'].includes(value)) throw new Error('--mode must be scheduled, manual, or backfill');
      options.mode = value as SqpMode;
      options.maxWindowsPerRun = value === 'scheduled' ? 1 : options.maxWindowsPerRun;
      index += 1;
    } else if (arg === '--from' || arg === '--from-date') {
      options.from = parseDateOnly(read(), arg);
      index += 1;
    } else if (arg === '--to' || arg === '--to-date') {
      options.to = parseDateOnly(read(), arg);
      index += 1;
    } else if (arg === '--monthly-backfill-start') {
      options.monthlyBackfillStart = parseDateOnly(read(), arg);
      index += 1;
    } else if (arg === '--max-windows-per-run') {
      options.maxWindowsPerRun = parsePositiveInt(read(), arg);
      index += 1;
    } else if (arg === '--max-asins-per-run') {
      options.maxAsinsPerRun = parsePositiveInt(read(), arg);
      index += 1;
    } else if (arg === '--resume-pending') {
      options.resumePending = true;
    } else if (arg === '--resume-pending-only') {
      options.resumePending = true;
      options.resumePendingOnly = true;
    } else if (arg === '--soft-unavailable-exit') {
      options.softUnavailableExit = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--max-poll-attempts') {
      options.maxPollAttempts = parsePositiveInt(read(), arg);
      index += 1;
    } else if (arg === '--poll-interval-ms') {
      options.pollIntervalMs = Number.parseInt(read(), 10);
      if (!Number.isInteger(options.pollIntervalMs) || options.pollIntervalMs < 0) {
        throw new Error('--poll-interval-ms must be a non-negative integer');
      }
      index += 1;
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }

  if (!options.accountId || !options.marketplace) {
    throw new Error('V3 SQP sync requires --account-id/--marketplace or APP_ACCOUNT_ID/APP_MARKETPLACE');
  }
  return options;
};

async function main(): Promise<void> {
  let pool: Pool | null = null;
  try {
    loadLocalEnvFiles();
    const options = parseV3SqpSyncArgs(process.argv.slice(2));
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('V3 SQP sync requires DATABASE_URL');
    }
    pool = createPostgresPool(databaseUrl);
    const report = await runV3SqpSync(options, { db: pool });
    console.log(renderSqpSyncReport(report));
    process.exitCode = report.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`V3 SQP sync failed: ${message}`);
    if (
      error instanceof SpApiConfigError ||
      error instanceof SpApiAuthError ||
      error instanceof SpApiRequestError ||
      error instanceof SpApiSqpPullError ||
      error instanceof SpApiSqpIngestError
    ) {
      console.error(`error_code=${error.code}`);
    }
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}

if (require.main === module) {
  void main();
}
