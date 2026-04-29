import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

import { loadAdsApiEnvForProfileSync } from '../connectors/ads-api/env';
import { loadSpApiEnv } from '../connectors/sp-api/env';
import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import {
  DailyBatchGateError,
  runRealAdsDailyBatch,
  runRealRetailDailyBatchWithOptions,
  type DailyBatchGateRequest,
  type DailyBatchStepResult,
} from '../ingestion/dailyBatchGate';
import { createPostgresPool } from '../ingestion/postgresIngestionJobRepository';

type PullSource = 'ads' | 'sales' | 'settings' | 'sqp';
type PullMode = 'manual' | 'scheduled' | 'backfill' | 'gap-fill' | 'dry-run';
type PullPreset = 'ads' | 'recent' | 'sales' | 'sqp' | 'today';
type SourceResultStatus =
  | 'blocked'
  | 'failed'
  | 'no_data'
  | 'pending'
  | 'partial'
  | 'skipped'
  | 'success';
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
type SyncKind = 'backfill' | 'refresh' | 'repair' | 'validation';
type RunStatus = 'failed' | 'running' | 'skipped' | 'succeeded';
type V3DataStatus = 'failed' | 'final' | 'live' | 'manual_unknown' | 'preliminary';

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

interface CliOptions {
  accountId: string;
  marketplace: string;
  from: string;
  to: string;
  sources: PullSource[];
  mode: PullMode;
  dryRun: boolean;
  recentDays: number | null;
  finality: string | null;
  force: boolean;
  preset: PullPreset | null;
  diagnose: boolean;
  resumePending: boolean;
  softPendingExit: boolean;
}

interface SyncRunRecordInput {
  accountId: string;
  marketplace: string;
  sourceType: string;
  sourceName: string;
  tableName: string;
  syncKind: SyncKind;
  status: RunStatus;
  dataStatus: V3DataStatus;
  requestedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  sourceWindowStart?: string | null;
  sourceWindowEnd?: string | null;
  backfillStart?: string | null;
  backfillEnd?: string | null;
  rowsRead?: number | null;
  rowsWritten?: number | null;
  rowsFailed?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  requestJson?: JsonObject;
  resultJson?: JsonObject;
  rawJson?: JsonObject | null;
  lastRefreshedAt?: string;
}

interface CoverageSpec {
  source: PullSource;
  sourceType: string;
  sourceName: string;
  tableName: string;
  granularity: string;
  periodStartExpr: string;
  periodEndExpr: string;
  expectedDelayHours: number;
  filterSql?: string;
  hasMarketplace: boolean;
  tableStatusDefault: CoverageLastStatus;
}

interface CoverageStats {
  rowCount: number;
  oldestPeriodStart: string | null;
  latestPeriodEnd: string | null;
  latestCompletePeriodEnd: string | null;
}

interface SourceRunResult {
  source: PullSource;
  status: SourceResultStatus;
  sourceType: string;
  sourceName: string;
  syncRunId: string;
  rowsRead: number | null;
  rowsWritten: number | null;
  latestAvailableDate: string | null;
  missingRanges: string[];
  blockers: string[];
  warnings: string[];
  notes: string[];
  details: JsonObject;
}

type AdsCoverageSourceKey =
  | 'sp_campaign_hourly'
  | 'sp_targeting_daily';

type AdsCoverageDescriptor = {
  sourceName: AdsCoverageSourceKey;
  label: string;
  successStep: string;
  relevantSteps: string[];
};

const ADS_IMPLEMENTED_COVERAGE_TABLES = new Set([
  'sp_campaign_hourly',
  'sp_targeting_daily',
]);

const ADS_COVERAGE_DESCRIPTORS: Record<AdsCoverageSourceKey, AdsCoverageDescriptor> = {
  sp_campaign_hourly: {
    sourceName: 'sp_campaign_hourly',
    label: 'SP Campaign Daily',
    successStep: 'adsapi:ingest-sp-campaign-daily',
    relevantSteps: [
      'adsapi:pull-sp-campaign-daily',
      'adsapi:persist-sp-daily',
      'adsapi:ingest-sp-campaign-daily',
    ],
  },
  sp_targeting_daily: {
    sourceName: 'sp_targeting_daily',
    label: 'SP Targeting Daily',
    successStep: 'adsapi:ingest-sp-target-daily',
    relevantSteps: [
      'adsapi:pull-sp-target-daily',
      'adsapi:persist-sp-daily',
      'adsapi:ingest-sp-target-daily',
    ],
  },
};

const ADS_UNSUPPORTED_COVERAGE_MESSAGES: Record<string, string> = {
  sp_placement_daily:
    'SP placement daily automation is not implemented by the current Ads API pullers.',
  sp_stis_daily:
    'SP STIS automation is not implemented by the current Ads API pullers.',
  sp_advertised_product_daily:
    'SP advertised product automation is not implemented by the current Ads API pullers.',
  sb_campaign_daily:
    'SB Ads API puller is not exposed by the current repo scripts.',
  sb_campaign_placement_daily:
    'SB Ads API puller is not exposed by the current repo scripts.',
  sb_keyword_daily:
    'SB Ads API puller is not exposed by the current repo scripts.',
  sb_stis_daily:
    'SB Ads API puller is not exposed by the current repo scripts.',
  sb_attributed_purchases_daily:
    'SB Ads API puller is not exposed by the current repo scripts.',
  sd_campaign_daily:
    'SD Ads API puller is not exposed by the current repo scripts.',
  sd_advertised_product_daily:
    'SD Ads API puller is not exposed by the current repo scripts.',
  sd_targeting_daily:
    'SD Ads API puller is not exposed by the current repo scripts.',
  sd_matched_target_daily:
    'SD Ads API puller is not exposed by the current repo scripts.',
  sd_purchased_product_daily:
    'SD Ads API puller is not exposed by the current repo scripts.',
};

interface CommandResult {
  command: string;
  args: string[];
  exitCode: number;
  status: 'failed' | 'success' | 'timed_out';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  stdout: string;
  stderr: string;
  stdoutTail: string[];
  stderrTail: string[];
  errorMessage: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCES: PullSource[] = ['ads', 'sales', 'sqp', 'settings'];
const COVERAGE_SPECS: CoverageSpec[] = [
  {
    source: 'sales',
    sourceType: 'sp_api',
    sourceName: 'sales_traffic',
    tableName: 'amazon_sales_traffic_timeseries',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 48,
    hasMarketplace: true,
    tableStatusDefault: 'success',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sp_campaign_hourly',
    tableName: 'sp_campaign_hourly_fact_gold',
    granularity: 'hourly',
    periodStartExpr: '(date::timestamp + coalesce(start_time, time \'00:00\'))::timestamptz',
    periodEndExpr:
      '(date::timestamp + coalesce(start_time, time \'00:00\') + interval \'1 hour\')::timestamptz',
    expectedDelayHours: 48,
    hasMarketplace: false,
    tableStatusDefault: 'success',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sp_targeting_daily',
    tableName: 'sp_targeting_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 48,
    hasMarketplace: false,
    tableStatusDefault: 'success',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sp_placement_daily',
    tableName: 'sp_placement_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 48,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sp_stis_daily',
    tableName: 'sp_stis_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 72,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sp_advertised_product_daily',
    tableName: 'sp_advertised_product_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 72,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sb_campaign_daily',
    tableName: 'sb_campaign_daily_fact_gold',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 72,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sb_campaign_placement_daily',
    tableName: 'sb_campaign_placement_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 72,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sb_keyword_daily',
    tableName: 'sb_keyword_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 72,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sb_stis_daily',
    tableName: 'sb_stis_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 96,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sb_attributed_purchases_daily',
    tableName: 'sb_attributed_purchases_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 96,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sd_campaign_daily',
    tableName: 'sd_campaign_daily_fact_gold',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 96,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sd_advertised_product_daily',
    tableName: 'sd_advertised_product_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 96,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sd_targeting_daily',
    tableName: 'sd_targeting_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 96,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sd_matched_target_daily',
    tableName: 'sd_matched_target_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 96,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'ads',
    sourceType: 'ads_api',
    sourceName: 'sd_purchased_product_daily',
    tableName: 'sd_purchased_product_daily_fact',
    granularity: 'daily',
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 96,
    hasMarketplace: false,
    tableStatusDefault: 'blocked',
  },
  {
    source: 'sqp',
    sourceType: 'sp_api',
    sourceName: 'sqp_weekly',
    tableName: 'sqp_weekly_raw',
    granularity: 'weekly',
    periodStartExpr: 'week_start::timestamptz',
    periodEndExpr: 'week_end::timestamptz',
    expectedDelayHours: 168,
    filterSql: "scope_type = 'asin'",
    hasMarketplace: true,
    tableStatusDefault: 'success',
  },
  {
    source: 'sqp',
    sourceType: 'sp_api',
    sourceName: 'sqp_monthly',
    tableName: 'sqp_monthly_raw',
    granularity: 'monthly',
    periodStartExpr: 'period_start::timestamptz',
    periodEndExpr: 'period_end::timestamptz',
    expectedDelayHours: 720,
    filterSql: "scope_type = 'asin'",
    hasMarketplace: true,
    tableStatusDefault: 'success',
  },
  {
    source: 'settings',
    sourceType: 'bulk_snapshot',
    sourceName: 'ads_settings_sp',
    tableName: 'ads_settings_snapshot_runs',
    granularity: 'snapshot_daily',
    periodStartExpr: 'snapshot_date::timestamptz',
    periodEndExpr: 'snapshot_date::timestamptz',
    expectedDelayHours: 168,
    filterSql: "channel = 'sp' and status = 'succeeded'",
    hasMarketplace: true,
    tableStatusDefault: 'success',
  },
  {
    source: 'settings',
    sourceType: 'bulk_snapshot',
    sourceName: 'ads_settings_sb',
    tableName: 'ads_settings_snapshot_runs',
    granularity: 'snapshot_daily_sb',
    periodStartExpr: 'snapshot_date::timestamptz',
    periodEndExpr: 'snapshot_date::timestamptz',
    expectedDelayHours: 168,
    filterSql: "channel = 'sb' and status = 'succeeded'",
    hasMarketplace: true,
    tableStatusDefault: 'success',
  },
  {
    source: 'settings',
    sourceType: 'bulk_snapshot',
    sourceName: 'ads_settings_sd',
    tableName: 'ads_settings_snapshot_runs',
    granularity: 'snapshot_daily_sd',
    periodStartExpr: 'snapshot_date::timestamptz',
    periodEndExpr: 'snapshot_date::timestamptz',
    expectedDelayHours: 168,
    filterSql: "channel = 'sd' and status = 'succeeded'",
    hasMarketplace: true,
    tableStatusDefault: 'success',
  },
];

const SQP_REQUIRED_ASIN_QUERY = `
  select asin
  from public.products
  where account_id = $1
    and marketplace = $2
  order by asin asc
`;

const readTrimmed = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const parseDateOnly = (value: string): Date => {
  if (!DATE_RE.test(value)) {
    throw new Error(`Expected YYYY-MM-DD date, received: ${value}`);
  }
  return new Date(`${value}T00:00:00.000Z`);
};

const formatDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

const addDays = (value: string, days: number): string => {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
};

const todayDateOnly = (): string => formatDateOnly(new Date());

const startOfWeekSunday = (value: string): string => {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return formatDateOnly(date);
};

const endOfWeekSaturday = (value: string): string =>
  addDays(startOfWeekSunday(value), 6);

const startOfMonth = (value: string): string => {
  const date = parseDateOnly(value);
  date.setUTCDate(1);
  return formatDateOnly(date);
};

const endOfMonth = (value: string): string => {
  const date = parseDateOnly(startOfMonth(value));
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return formatDateOnly(date);
};

const monthStartFromOffset = (today: string, offsetMonths: number): string => {
  const date = parseDateOnly(startOfMonth(today));
  date.setUTCMonth(date.getUTCMonth() + offsetMonths);
  return formatDateOnly(date);
};

const weekRangeLabel = (startDate: string, endDate: string): string =>
  `${startDate} -> ${endDate}`;

const tailLines = (value: string, count = 8): string[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-count);

const parseLineValue = (text: string, label: string): string | null => {
  const match = text.match(new RegExp(`^${label}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim() ?? null;
};

const parseNumberLine = (text: string, label: string): number | null => {
  const raw = parseLineValue(text, label);
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
};

const isDailyBatchStepResult = (value: unknown): value is DailyBatchStepResult => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.status === 'string' &&
    candidate.summary != null &&
    typeof candidate.summary === 'object' &&
    !Array.isArray(candidate.summary)
  );
};

const readDailyBatchSteps = (details: JsonObject): DailyBatchStepResult[] => {
  const raw = details.steps;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((value): value is DailyBatchStepResult => isDailyBatchStepResult(value));
};

const stepLabel = (name: string): string => {
  switch (name) {
    case 'adsapi:pull-sp-campaign-daily':
      return 'SP Campaign Daily pull';
    case 'adsapi:pull-sp-target-daily':
      return 'SP Targeting Daily pull';
    case 'adsapi:persist-sp-daily':
      return 'SP daily normalization/persist';
    case 'adsapi:ingest-sp-campaign-daily':
      return 'SP Campaign Daily ingest';
    case 'adsapi:ingest-sp-target-daily':
      return 'SP Targeting Daily ingest';
    default:
      return name;
  }
};

const stepSummaryValue = (step: DailyBatchStepResult, key: string): string | null => {
  const raw = step.summary[key];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  return null;
};

const isDuplicateTargetingFailure = (step: DailyBatchStepResult): boolean => {
  const haystack = [
    stepSummaryValue(step, 'message'),
    stepSummaryValue(step, 'code'),
    ...(
      Array.isArray(step.summary.stderr_tail)
        ? step.summary.stderr_tail.filter((value): value is string => typeof value === 'string')
        : []
    ),
    ...(
      Array.isArray(step.summary.stdout_tail)
        ? step.summary.stdout_tail.filter((value): value is string => typeof value === 'string')
        : []
    ),
  ]
    .filter(Boolean)
    .join('\n');
  return /duplicate key|duplicate targeting rows|sp_targeting_daily_raw_uq/i.test(haystack);
};

export const deriveAdsImplementedCoverageResult = (
  sourceResult: SourceRunResult,
  spec: CoverageSpec
): SourceRunResult | null => {
  const descriptor = ADS_COVERAGE_DESCRIPTORS[spec.sourceName as AdsCoverageSourceKey];
  if (!descriptor) {
    return null;
  }

  const steps = readDailyBatchSteps(sourceResult.details);
  if (steps.length === 0) {
    return {
      ...sourceResult,
      warnings: sourceResult.warnings.filter(
        (warning) => !Object.values(ADS_UNSUPPORTED_COVERAGE_MESSAGES).includes(warning)
      ),
    };
  }
  const firstFailedStep = steps.find((step) => step.status === 'failed') ?? null;
  const successStep = steps.find(
    (step) => step.name === descriptor.successStep && step.status === 'success'
  ) ?? null;
  const relevantFailedStep = steps.find(
    (step) =>
      descriptor.relevantSteps.includes(step.name) && step.status === 'failed'
  ) ?? null;

  const successIndex = successStep
    ? steps.findIndex((step) => step === successStep)
    : -1;
  const firstFailedIndex = firstFailedStep
    ? steps.findIndex((step) => step === firstFailedStep)
    : -1;

  if (successStep) {
    const warnings: string[] = [];
    if (firstFailedStep && firstFailedIndex > successIndex) {
      warnings.push(
        `${descriptor.label} ingested successfully, but the overall Ads API batch later failed at ${stepLabel(firstFailedStep.name)}.`
      );
    }

    return {
      ...sourceResult,
      status: 'success',
      blockers: [],
      warnings,
      notes: [
        `${descriptor.label} ingested successfully for the latest available period.`,
      ],
    };
  }

  if (relevantFailedStep) {
    const blockers = [
      descriptor.sourceName === 'sp_targeting_daily' && isDuplicateTargetingFailure(relevantFailedStep)
        ? 'SP Targeting Daily failed because duplicate targeting rows were detected during ingest.'
        : `${descriptor.label} failed during ${stepLabel(relevantFailedStep.name)}.`,
    ];
    const notes =
      descriptor.sourceName === 'sp_targeting_daily'
        ? [
            'Campaign data already loaded remains usable. Fix the targeting ingest dedupe behavior, then rerun the Ads API refresh.',
          ]
        : ['Review the failed ingest step and rerun the Ads API refresh.'];

    return {
      ...sourceResult,
      status: 'failed',
      blockers,
      warnings: [],
      notes,
    };
  }

  if (firstFailedStep) {
    return {
      ...sourceResult,
      status: 'blocked',
      blockers: [
        `${descriptor.label} did not complete because the Ads API batch stopped at ${stepLabel(firstFailedStep.name)}.`,
      ],
      warnings: [],
      notes: ['Resolve the earlier Ads batch failure, then rerun the Ads API refresh.'],
    };
  }

  return {
    ...sourceResult,
    status:
      sourceResult.status === 'pending' || sourceResult.status === 'blocked'
        ? sourceResult.status
        : 'blocked',
    blockers: [...sourceResult.blockers],
    warnings: [],
    notes: [...sourceResult.notes],
  };
};

const redactSensitiveText = (value: string): string =>
  value
    .replace(
      /((?:access|refresh|client|service[_-]?role)[_-]?token["'=:\s]+)([^\s'",]+)/gi,
      '$1[REDACTED]'
    )
    .replace(/(authorization:\s*bearer\s+)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/("?(?:secret|password)"?\s*[:=]\s*")([^"]+)(")/gi, '$1[REDACTED]$3');

const normalizeSources = (raw: string | null): PullSource[] => {
  if (!raw || raw === 'all') {
    return [...SOURCES];
  }

  const parsed = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (parsed.includes('all')) {
    return [...SOURCES];
  }

  const invalid = parsed.filter(
    (entry): entry is string => !SOURCES.includes(entry as PullSource)
  );
  if (invalid.length > 0) {
    throw new Error(`Unsupported --sources value(s): ${invalid.join(', ')}`);
  }

  return Array.from(new Set(parsed as PullSource[]));
};

const parseInteger = (raw: string | null, flag: string): number | null => {
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer`);
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

const deriveModeFromPreset = (preset: PullPreset | null, dryRun: boolean): PullMode => {
  if (dryRun) return 'dry-run';
  if (preset === 'recent') return 'scheduled';
  return 'manual';
};

const normalizeDateWindow = (args: {
  from: string | null;
  to: string | null;
  recentDays: number | null;
  preset: PullPreset | null;
}): { from: string; to: string } => {
  if (args.from && args.to) {
    if (!DATE_RE.test(args.from) || !DATE_RE.test(args.to)) {
      throw new Error('--from and --to must use YYYY-MM-DD');
    }
    if (args.from > args.to) {
      throw new Error('--from must be on or before --to');
    }
    return { from: args.from, to: args.to };
  }

  const today = todayDateOnly();
  if (args.preset === 'today') {
    return { from: today, to: today };
  }

  const recentDays = args.recentDays ?? (args.preset === 'recent' ? 30 : null);
  if (recentDays != null) {
    const to = today;
    const from = addDays(to, -(Math.max(recentDays, 1) - 1));
    return { from, to };
  }

  throw new Error('Provide --from and --to, or use --recent-days, or use a preset.');
};

export function parseV3PullAmazonArgs(argv: string[]): CliOptions {
  let accountId = readTrimmed(process.env.APP_ACCOUNT_ID) ?? '';
  let marketplace = readTrimmed(process.env.APP_MARKETPLACE)?.toUpperCase() ?? '';
  let from: string | null = null;
  let to: string | null = null;
  let sourcesRaw: string | null = null;
  let mode: PullMode | null = null;
  let dryRun = false;
  let recentDays: number | null = null;
  let finality: string | null = null;
  let force = false;
  let preset: PullPreset | null = null;
  let diagnose = false;
  let resumePending = false;
  let softPendingExit = false;

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
    if (arg === '--from') {
      from = readFlagValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--from=')) {
      from = arg.slice('--from='.length);
      continue;
    }
    if (arg === '--to') {
      to = readFlagValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--to=')) {
      to = arg.slice('--to='.length);
      continue;
    }
    if (arg === '--sources') {
      sourcesRaw = readFlagValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--sources=')) {
      sourcesRaw = arg.slice('--sources='.length);
      continue;
    }
    if (arg === '--mode') {
      mode = readFlagValue(argv, index, arg) as PullMode;
      index += 1;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      mode = arg.slice('--mode='.length) as PullMode;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--recent-days') {
      recentDays = parseInteger(readFlagValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--recent-days=')) {
      recentDays = parseInteger(arg.slice('--recent-days='.length), '--recent-days');
      continue;
    }
    if (arg === '--finality') {
      finality = readFlagValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--finality=')) {
      finality = arg.slice('--finality='.length);
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--diagnose') {
      diagnose = true;
      continue;
    }
    if (arg === '--resume-pending') {
      resumePending = true;
      continue;
    }
    if (arg === '--soft-pending-exit') {
      softPendingExit = true;
      continue;
    }
    if (arg === '--preset') {
      preset = readFlagValue(argv, index, arg) as PullPreset;
      index += 1;
      continue;
    }
    if (arg.startsWith('--preset=')) {
      preset = arg.slice('--preset='.length) as PullPreset;
      continue;
    }

    throw new Error(`Unknown CLI argument: ${arg}`);
  }

  if (preset && !['today', 'recent', 'ads', 'sales', 'sqp'].includes(preset)) {
    throw new Error(`Unsupported preset: ${preset}`);
  }

  const normalizedPreset = preset;
  if (normalizedPreset === 'ads' && !sourcesRaw) sourcesRaw = 'ads';
  if (normalizedPreset === 'sales' && !sourcesRaw) sourcesRaw = 'sales';
  if (normalizedPreset === 'sqp' && !sourcesRaw) sourcesRaw = 'sqp';
  if ((normalizedPreset === 'today' || normalizedPreset === 'recent') && !sourcesRaw) {
    sourcesRaw = 'all';
  }

  const normalizedWindow = normalizeDateWindow({
    from,
    to,
    recentDays,
    preset: normalizedPreset,
  });

  if (!readTrimmed(accountId)) {
    throw new Error('--account-id is required');
  }
  if (!readTrimmed(marketplace)) {
    throw new Error('--marketplace is required');
  }

  const normalizedMode = mode ?? deriveModeFromPreset(normalizedPreset, dryRun);
  if (!['manual', 'scheduled', 'backfill', 'gap-fill', 'dry-run'].includes(normalizedMode)) {
    throw new Error(`Unsupported --mode value: ${normalizedMode}`);
  }

  return {
    accountId: accountId.trim(),
    marketplace: marketplace.trim().toUpperCase(),
    from: normalizedWindow.from,
    to: normalizedWindow.to,
    sources: normalizeSources(sourcesRaw),
    mode: dryRun ? 'dry-run' : normalizedMode,
    dryRun,
    recentDays,
    finality: readTrimmed(finality),
    force,
    preset: normalizedPreset,
    diagnose,
    resumePending,
    softPendingExit,
  };
}

const mapModeToSyncKind = (mode: PullMode): SyncKind => {
  if (mode === 'backfill') return 'backfill';
  if (mode === 'gap-fill') return 'repair';
  if (mode === 'dry-run') return 'validation';
  return 'refresh';
};

const buildRequestedWindowTimestamps = (options: CliOptions): {
  start: string;
  end: string;
} => ({
  start: `${options.from}T00:00:00.000Z`,
  end: `${options.to}T23:59:59.999Z`,
});

const runCommand = async (
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const startedAt = new Date().toISOString();
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let finished = false;
    const timeoutMs = 30 * 60 * 1000;
    const streamOutput = optionsShouldStream();
    const timer = setTimeout(() => {
      if (finished) return;
      child.kill('SIGTERM');
    }, timeoutMs);

    const appendChunk = (
      streamName: 'stderr' | 'stdout',
      chunk: string
    ): void => {
      const safeChunk = redactSensitiveText(chunk);
      if (streamName === 'stdout') {
        stdout += safeChunk;
        if (streamOutput) process.stdout.write(safeChunk);
      } else {
        stderr += safeChunk;
        if (streamOutput) process.stderr.write(safeChunk);
      }
    };

    child.stdout.on('data', (chunk) => {
      appendChunk('stdout', String(chunk));
    });
    child.stderr.on('data', (chunk) => {
      appendChunk('stderr', String(chunk));
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      finished = true;
      clearTimeout(timer);
      const finishedAt = new Date().toISOString();
      const durationMs =
        new Date(finishedAt).getTime() - new Date(startedAt).getTime();
      const timedOut = signal === 'SIGTERM' && code === null;
      const result: CommandResult = {
        command,
        args,
        exitCode: code ?? 1,
        status: timedOut ? 'timed_out' : code === 0 ? 'success' : 'failed',
        startedAt,
        finishedAt,
        durationMs,
        stdout,
        stderr,
        stdoutTail: tailLines(stdout, 200),
        stderrTail: tailLines(stderr, 200),
        errorMessage:
          timedOut
            ? `${[command, ...args].join(' ')} timed out after ${timeoutMs}ms`
            : code === 0
            ? null
            : `${[command, ...args].join(' ')} exited with code ${code}`,
      };
      if (code === 0 && !timedOut) {
        resolve(result);
        return;
      }
      reject(
        new Error(
          [
            result.errorMessage ?? 'Command failed.',
            `stdout tail: ${result.stdoutTail.join(' || ') || 'none'}`,
            `stderr tail: ${result.stderrTail.join(' || ') || 'none'}`,
            `duration_ms: ${result.durationMs}`,
          ].join('\n')
        )
      );
    });
  });

const optionsShouldStream = (): boolean => process.env.GITHUB_ACTIONS === 'true';

const runNpmScript = async (
  scriptName: string,
  scriptArgs: string[],
  env: NodeJS.ProcessEnv
): Promise<CommandResult> => runCommand('npm', ['run', scriptName, '--', ...scriptArgs], env);

const buildProcessEnv = (options: CliOptions): NodeJS.ProcessEnv => ({
  ...process.env,
  APP_ACCOUNT_ID: options.accountId,
  APP_MARKETPLACE: options.marketplace,
  V3_PULL_AMAZON_DIAGNOSE: options.diagnose ? '1' : '0',
  V3_PULL_AMAZON_RESUME_PENDING: options.resumePending ? '1' : '0',
  V3_PULL_AMAZON_SOFT_PENDING_EXIT: options.softPendingExit ? '1' : '0',
});

const requireDatabaseUrl = (): string => {
  const value = readTrimmed(process.env.DATABASE_URL);
  if (!value) {
    throw new Error('Missing DATABASE_URL in the local environment.');
  }
  return value;
};

const ensureSupabaseEnv = (): void => {
  if (!readTrimmed(process.env.SUPABASE_URL)) {
    throw new Error('Missing SUPABASE_URL in the local environment.');
  }
  if (!readTrimmed(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in the local environment.');
  }
};

const buildEnvCheckBySource = (options: CliOptions): Record<PullSource, string[]> => {
  const shared = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  return {
    sales: [...shared, 'SP_API_LWA_CLIENT_ID', 'SP_API_LWA_CLIENT_SECRET', 'SP_API_REFRESH_TOKEN', 'SP_API_REGION', 'SP_API_MARKETPLACE_ID'],
    sqp: [...shared, 'SP_API_LWA_CLIENT_ID', 'SP_API_LWA_CLIENT_SECRET', 'SP_API_REFRESH_TOKEN', 'SP_API_REGION', 'SP_API_MARKETPLACE_ID'],
    ads: [
      ...shared,
      'AMAZON_ADS_CLIENT_ID',
      'AMAZON_ADS_CLIENT_SECRET',
      'AMAZON_ADS_REFRESH_TOKEN',
      'AMAZON_ADS_API_BASE_URL',
      'AMAZON_ADS_PROFILE_ID',
    ],
    settings: shared,
  };
};

const collectMissingEnv = (names: string[]): string[] =>
  names.filter((name) => !readTrimmed(process.env[name]));

const countStepRows = (steps: DailyBatchStepResult[]): number =>
  steps.reduce((sum, step) => {
    const rowCount = step.summary.row_count;
    if (typeof rowCount === 'number' && Number.isFinite(rowCount)) {
      return sum + rowCount;
    }
    return sum;
  }, 0);

export const extractImportedAdsSourceTypesFromSteps = (
  steps: DailyBatchStepResult[]
): string[] => {
  const imported = new Set<string>();
  for (const step of steps) {
    if (step.status !== 'success') continue;
    if (step.name === 'adsapi:ingest-sp-campaign-daily') {
      imported.add('ads_api_sp_campaign_daily');
    }
    if (step.name === 'adsapi:ingest-sp-target-daily') {
      imported.add('ads_api_sp_target_daily');
    }
  }
  return [...imported];
};

const markAdsPendingRequestsImportedForSourceTypes = async (
  pool: Pool,
  options: CliOptions,
  sourceTypes: string[]
): Promise<string[]> => {
  if (sourceTypes.length === 0) {
    return [];
  }

  const result = await pool.query(
    `
      update public.ads_api_report_requests request
      set
        status = 'imported',
        status_details = coalesce(request.status_details, 'imported'),
        notes = case
          when request.source_type = 'ads_api_sp_campaign_daily'
            then 'Imported into sp_campaign_hourly_fact_gold by the V3 Ads sync batch.'
          when request.source_type = 'ads_api_sp_target_daily'
            then 'Imported into sp_targeting_daily_fact by the V3 Ads sync batch.'
          else request.notes
        end,
        completed_at = coalesce(request.completed_at, now()),
        last_polled_at = coalesce(request.last_polled_at, now())
      where request.account_id = $1
        and request.marketplace = $2
        and request.start_date = $3::date
        and request.end_date = $4::date
        and request.source_type = any($5::text[])
        and request.status in (
          'created',
          'requested',
          'pending',
          'polling',
          'pending_timeout',
          'completed'
        )
      returning request.report_id::text as report_id
    `,
    [options.accountId, options.marketplace, options.from, options.to, sourceTypes]
  );
  return result.rows
    .map((row) => (typeof row.report_id === 'string' ? row.report_id : null))
    .filter((value): value is string => value != null);
};

const markAdsPendingRequestsImported = async (
  pool: Pool,
  options: CliOptions
): Promise<string[]> => {
  return markAdsPendingRequestsImportedForSourceTypes(
    pool,
    options,
    ['ads_api_sp_campaign_daily', 'ads_api_sp_target_daily']
  );
};

const queryCoverageStats = async (
  pool: Pool,
  spec: CoverageSpec,
  args: {
    accountId: string;
    marketplace: string;
    cutoffIso: string;
  }
): Promise<CoverageStats> => {
  const whereParts = ['account_id = $1'];
  const params: Array<string> = [args.accountId, args.cutoffIso];

  if (spec.hasMarketplace) {
    whereParts.push('marketplace = $3');
    params.push(args.marketplace);
  }
  if (spec.filterSql) {
    whereParts.push(spec.filterSql);
  }

  const sql = `
    select
      count(*)::bigint as row_count,
      min(${spec.periodStartExpr})::text as oldest_period_start,
      max(${spec.periodEndExpr})::text as latest_period_end,
      max(case when ${spec.periodEndExpr} <= $2::timestamptz then ${spec.periodEndExpr} end)::text
        as latest_complete_period_end
    from public.${spec.tableName}
    where ${whereParts.join(' and ')}
  `;

  const result = await pool.query(sql, params);
  const row = result.rows[0] ?? {};
  return {
    rowCount: Number.parseInt(String(row.row_count ?? '0'), 10) || 0,
    oldestPeriodStart: typeof row.oldest_period_start === 'string' ? row.oldest_period_start : null,
    latestPeriodEnd: typeof row.latest_period_end === 'string' ? row.latest_period_end : null,
    latestCompletePeriodEnd:
      typeof row.latest_complete_period_end === 'string'
        ? row.latest_complete_period_end
        : null,
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
  if (hoursLag <= args.expectedDelayHours) {
    return 'fresh';
  }
  if (hoursLag <= args.expectedDelayHours * 2) {
    return 'delayed_expected';
  }
  return 'stale';
};

const toCoverageLastStatus = (
  sourceStatus: SourceResultStatus,
  defaultStatus: CoverageLastStatus,
  rowCount: number
): CoverageLastStatus => {
  if (sourceStatus === 'success') return 'success';
  if (sourceStatus === 'partial') return defaultStatus === 'success' ? 'partial' : defaultStatus;
  if (sourceStatus === 'pending') return 'blocked';
  if (sourceStatus === 'blocked') return rowCount > 0 ? 'blocked' : 'blocked';
  if (sourceStatus === 'no_data') return 'no_data';
  if (sourceStatus === 'skipped') return rowCount > 0 ? 'success' : 'unknown';
  return 'failed';
};

const buildMissingRanges = (args: {
  requestedFrom: string;
  requestedTo: string;
  latestDate: string | null;
  sourceStatus: SourceResultStatus;
  blockers: string[];
}): string[] => {
  if (
    args.sourceStatus === 'blocked' ||
    args.sourceStatus === 'failed' ||
    args.sourceStatus === 'pending'
  ) {
    return [`${args.requestedFrom} -> ${args.requestedTo}`];
  }
  if (!args.latestDate) {
    return [];
  }
  const latest = args.latestDate.slice(0, 10);
  if (latest < args.requestedTo) {
    return [`${addDays(latest, 1)} -> ${args.requestedTo}`];
  }
  return args.blockers.length > 0 ? [] : [];
};

const replaceReportDataStatus = async (pool: Pool, args: {
  accountId: string;
  marketplace: string;
  tableName: string;
  sourceType: string;
  sourceName: string;
  scopeKey: string;
  periodStart: string | null;
  periodEnd: string | null;
  dataStatus: V3DataStatus;
  isFinal: boolean;
  finalAfterAt: string | null;
  finalizedAt: string | null;
  lastSyncRunId: string | null;
  lastRefreshedAt: string;
  rowCount: number | null;
  coverageJson: JsonObject;
  warnings: string[];
}): Promise<void> => {
  await pool.query(
    `
      delete from public.report_data_status
      where account_id = $1
        and marketplace = $2
        and table_name = $3
        and source_type = $4
        and source_name = $5
        and scope_key = $6
        and (
          (period_start is null and $7::date is null)
          or period_start = $7::date
        )
        and (
          (period_end is null and $8::date is null)
          or period_end = $8::date
        )
    `,
    [
      args.accountId,
      args.marketplace,
      args.tableName,
      args.sourceType,
      args.sourceName,
      args.scopeKey,
      args.periodStart,
      args.periodEnd,
    ]
  );

  await pool.query(
    `
      insert into public.report_data_status (
        account_id,
        marketplace,
        table_name,
        source_type,
        source_name,
        scope_key,
        period_start,
        period_end,
        data_status,
        is_final,
        final_after_at,
        finalized_at,
        last_sync_run_id,
        last_refreshed_at,
        row_count,
        coverage_json,
        warnings
      )
      values (
        $1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10,
        $11::timestamptz, $12::timestamptz, $13::uuid, $14::timestamptz,
        $15, $16::jsonb, $17::jsonb
      )
    `,
    [
      args.accountId,
      args.marketplace,
      args.tableName,
      args.sourceType,
      args.sourceName,
      args.scopeKey,
      args.periodStart,
      args.periodEnd,
      args.dataStatus,
      args.isFinal,
      args.finalAfterAt,
      args.finalizedAt,
      args.lastSyncRunId,
      args.lastRefreshedAt,
      args.rowCount,
      JSON.stringify(args.coverageJson),
      JSON.stringify(args.warnings),
    ]
  );
};

const upsertCoverageStatus = async (pool: Pool, args: {
  accountId: string;
  marketplace: string;
  sourceType: string;
  tableName: string;
  granularity: string;
  oldestPeriodStart: string | null;
  latestPeriodEnd: string | null;
  latestCompletePeriodEnd: string | null;
  lastAttemptedRunAt: string;
  lastSuccessfulRunAt: string | null;
  lastSyncRunId: string | null;
  lastStatus: CoverageLastStatus;
  freshnessStatus: CoverageFreshnessStatus;
  expectedDelayHours: number;
  rowCount: number;
  missingRanges: string[];
  warningCount: number;
  errorCount: number;
  notes: string | null;
}): Promise<void> => {
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
        last_successful_run_at = coalesce(
          excluded.last_successful_run_at,
          data_coverage_status.last_successful_run_at
        ),
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
      args.sourceType,
      args.tableName,
      args.granularity,
      args.oldestPeriodStart,
      args.latestPeriodEnd,
      args.latestCompletePeriodEnd,
      args.lastAttemptedRunAt,
      args.lastSuccessfulRunAt,
      args.lastSyncRunId,
      args.lastStatus,
      args.freshnessStatus,
      args.expectedDelayHours,
      args.rowCount,
      JSON.stringify(args.missingRanges),
      args.warningCount,
      args.errorCount,
      args.notes,
    ]
  );
};

const insertSyncRun = async (pool: Pool, input: SyncRunRecordInput): Promise<string> => {
  const result = await pool.query(
    `
      insert into public.api_sync_runs (
        sync_run_id,
        account_id,
        marketplace,
        source_type,
        source_name,
        table_name,
        sync_kind,
        status,
        data_status,
        requested_at,
        started_at,
        finished_at,
        source_window_start,
        source_window_end,
        backfill_start,
        backfill_end,
        rows_read,
        rows_written,
        rows_failed,
        error_code,
        error_message,
        request_json,
        result_json,
        raw_json,
        last_refreshed_at
      )
      values (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11::timestamptz,
        $12::timestamptz, $13::timestamptz, $14::timestamptz, $15::date, $16::date,
        $17, $18, $19, $20, $21, $22::jsonb, $23::jsonb, $24::jsonb, $25::timestamptz
      )
      returning sync_run_id::text
    `,
    [
      randomUUID(),
      input.accountId,
      input.marketplace,
      input.sourceType,
      input.sourceName,
      input.tableName,
      input.syncKind,
      input.status,
      input.dataStatus,
      input.requestedAt,
      input.startedAt ?? null,
      input.finishedAt ?? null,
      input.sourceWindowStart ?? null,
      input.sourceWindowEnd ?? null,
      input.backfillStart ?? null,
      input.backfillEnd ?? null,
      input.rowsRead ?? null,
      input.rowsWritten ?? null,
      input.rowsFailed ?? null,
      input.errorCode ?? null,
      input.errorMessage ?? null,
      JSON.stringify(input.requestJson ?? {}),
      JSON.stringify(input.resultJson ?? {}),
      input.rawJson ? JSON.stringify(input.rawJson) : null,
      input.lastRefreshedAt ?? input.requestedAt,
    ]
  );
  return String(result.rows[0].sync_run_id);
};

const updateSyncRun = async (
  pool: Pool,
  syncRunId: string,
  patch: Partial<SyncRunRecordInput>
): Promise<void> => {
  await pool.query(
    `
      update public.api_sync_runs
      set
        status = coalesce($2, status),
        data_status = coalesce($3, data_status),
        started_at = coalesce($4::timestamptz, started_at),
        finished_at = coalesce($5::timestamptz, finished_at),
        rows_read = coalesce($6, rows_read),
        rows_written = coalesce($7, rows_written),
        rows_failed = coalesce($8, rows_failed),
        error_code = $9,
        error_message = $10,
        result_json = coalesce($11::jsonb, result_json),
        raw_json = coalesce($12::jsonb, raw_json),
        last_refreshed_at = coalesce($13::timestamptz, last_refreshed_at)
      where sync_run_id = $1::uuid
    `,
    [
      syncRunId,
      patch.status ?? null,
      patch.dataStatus ?? null,
      patch.startedAt ?? null,
      patch.finishedAt ?? null,
      patch.rowsRead ?? null,
      patch.rowsWritten ?? null,
      patch.rowsFailed ?? null,
      patch.errorCode ?? null,
      patch.errorMessage ?? null,
      patch.resultJson ? JSON.stringify(patch.resultJson) : null,
      patch.rawJson ? JSON.stringify(patch.rawJson) : null,
      patch.lastRefreshedAt ?? null,
    ]
  );
};

const recordQualityCheck = async (pool: Pool, args: {
  syncRunId: string | null;
  accountId: string;
  marketplace: string;
  tableName: string;
  checkName: string;
  checkCategory: string;
  status: 'passed' | 'failed' | 'warning';
  severity: 'error' | 'info' | 'warn';
  periodStart?: string | null;
  periodEnd?: string | null;
  rowsChecked?: number | null;
  failingRows?: number | null;
  expectedJson?: JsonObject;
  actualJson?: JsonObject;
  detailsJson?: JsonObject;
  message?: string | null;
}): Promise<void> => {
  await pool.query(
    `
      select public.record_data_quality_check(
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::date, $10::date, $11, $12,
        null, $13::jsonb, $14::jsonb, $15::jsonb, $16
      )
    `,
    [
      args.syncRunId,
      args.accountId,
      args.marketplace,
      args.tableName,
      args.checkName,
      args.checkCategory,
      args.status,
      args.severity,
      args.periodStart ?? null,
      args.periodEnd ?? null,
      args.rowsChecked ?? null,
      args.failingRows ?? null,
      JSON.stringify(args.expectedJson ?? {}),
      JSON.stringify(args.actualJson ?? {}),
      JSON.stringify(args.detailsJson ?? {}),
      args.message ?? null,
    ]
  );
};

const deriveDataStatus = (args: {
  sourceStatus: SourceResultStatus;
  latestDate: string | null;
  finality: string | null;
}): V3DataStatus => {
  if (args.sourceStatus === 'failed') return 'failed';
  if (args.sourceStatus === 'pending') return 'manual_unknown';
  if (args.sourceStatus === 'blocked') return args.latestDate ? 'manual_unknown' : 'failed';
  if (args.finality === 'final') return 'final';
  if (!args.latestDate) return 'manual_unknown';
  const lagHours = (Date.now() - new Date(args.latestDate).getTime()) / (1000 * 60 * 60);
  return lagHours <= 48 ? 'preliminary' : 'live';
};

const discoverSqpAsins = async (pool: Pool, options: CliOptions): Promise<string[]> => {
  const result = await pool.query(SQP_REQUIRED_ASIN_QUERY, [options.accountId, options.marketplace]);
  return result.rows
    .map((row) => readTrimmed(String(row.asin ?? '')))
    .filter((asin): asin is string => Boolean(asin));
};

const runSalesSource = async (options: CliOptions): Promise<{
  status: SourceResultStatus;
  rowsRead: number | null;
  rowsWritten: number | null;
  latestAvailableDate: string | null;
  missingRanges: string[];
  blockers: string[];
  warnings: string[];
  notes: string[];
  details: JsonObject;
}> => {
  const request: DailyBatchGateRequest = {
    accountId: options.accountId,
    marketplace: options.marketplace,
    startDate: options.from,
    endDate: options.to,
  };

  if (options.dryRun) {
    return {
      status: 'skipped',
      rowsRead: 0,
      rowsWritten: 0,
      latestAvailableDate: options.to,
      missingRanges: [],
      blockers: [],
      warnings: ['dry-run: sales pull skipped before contacting Amazon'],
      notes: [],
      details: {
        mode: options.mode,
        requested_window: weekRangeLabel(options.from, options.to),
      },
    };
  }

  const result = await runRealRetailDailyBatchWithOptions(request, {});
  const steps = result.steps as JsonValue;
  return {
    status: 'success',
    rowsRead: countStepRows(result.steps),
    rowsWritten: result.rowCount,
    latestAvailableDate: options.to,
    missingRanges: [],
    blockers: [],
    warnings: [],
    notes: [],
    details: {
      row_count: result.rowCount,
      steps,
      metadata: result.metadata,
    },
  };
};

const runAdsSource = async (pool: Pool, options: CliOptions): Promise<{
  status: SourceResultStatus;
  rowsRead: number | null;
  rowsWritten: number | null;
  latestAvailableDate: string | null;
  missingRanges: string[];
  blockers: string[];
  warnings: string[];
  notes: string[];
  details: JsonObject;
}> => {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  if (options.dryRun) {
    blockers.push('dry-run: SP Ads pull skipped before contacting Amazon');
  }

  const unsupportedTables = [
    'SP placement daily automation is not implemented by the current Ads API pullers.',
    'SP STIS automation is not implemented by the current Ads API pullers.',
    'SP advertised product automation is not implemented by the current Ads API pullers.',
    'SB Ads API puller is not exposed by the current repo scripts.',
    'SD Ads API puller is not exposed by the current repo scripts.',
  ];
  warnings.push(...unsupportedTables);

  if (options.dryRun) {
    return {
      status: 'partial',
      rowsRead: 0,
      rowsWritten: 0,
      latestAvailableDate: options.to,
      missingRanges: [],
      blockers,
      warnings,
      notes,
      details: {
        mode: options.mode,
      },
    };
  }

  const request: DailyBatchGateRequest = {
    accountId: options.accountId,
    marketplace: options.marketplace,
    startDate: options.from,
    endDate: options.to,
    resumePending: options.resumePending,
  };
  let result;
  try {
    result = await runRealAdsDailyBatch(request, {
      diagnose: options.diagnose,
      timeoutMs: 30 * 60 * 1000,
    });
  } catch (error) {
    if (error instanceof DailyBatchGateError) {
      const importedSourceTypes = extractImportedAdsSourceTypesFromSteps(
        error.steps ?? []
      );
      await markAdsPendingRequestsImportedForSourceTypes(
        pool,
        options,
        importedSourceTypes
      );
    }
    const pendingFailure = classifyAdsPendingFailure(error, options);
    if (pendingFailure) {
      return {
        ...pendingFailure,
        warnings: [...warnings, ...pendingFailure.warnings],
      };
    }
    throw error;
  }
  const steps = result.steps as JsonValue;
  const importedReportIds = await markAdsPendingRequestsImportedForSourceTypes(
    pool,
    options,
    extractImportedAdsSourceTypesFromSteps(result.steps)
  );
  if (importedReportIds.length > 0) {
    notes.push(`imported report_ids=${importedReportIds.join(',')}`);
  }

  return {
    status: warnings.length > 0 ? 'partial' : 'success',
    rowsRead: countStepRows(result.steps),
    rowsWritten: typeof result.rowCount === 'number' ? result.rowCount : countStepRows(result.steps),
    latestAvailableDate: options.to,
    missingRanges: [],
    blockers,
    warnings,
    notes,
    details: {
      row_count: result.rowCount,
      steps,
      metadata: result.metadata,
    },
  };
};

export const classifyAdsPendingFailure = (
  error: unknown,
  options: CliOptions
): {
  status: SourceResultStatus;
  rowsRead: number | null;
  rowsWritten: number | null;
  latestAvailableDate: string | null;
  missingRanges: string[];
  blockers: string[];
  warnings: string[];
  notes: string[];
  details: JsonObject;
} | null => {
  if (!(error instanceof Error)) return null;
  const details =
    typeof (error as { metadata?: unknown }).metadata === 'object' &&
    (error as { metadata?: unknown }).metadata !== null
      ? ((error as { metadata?: Record<string, unknown> }).metadata ?? {})
      : {};
  const stderrTail = Array.isArray(details.stderr_tail)
    ? details.stderr_tail.filter((value): value is string => typeof value === 'string')
    : [];
  const stdoutTail = Array.isArray(details.stdout_tail)
    ? details.stdout_tail.filter((value): value is string => typeof value === 'string')
    : [];
  const combinedText = [error.message, ...stderrTail, ...stdoutTail].join('\n');
  if (!combinedText.includes('pending_timeout') && !combinedText.includes('remained pending')) {
    return null;
  }

  const reportId =
    combinedText.match(/report_id=([0-9a-fA-F-]{8,})/)?.[1] ?? null;
  const diagnosticPath =
    combinedText.match(/Diagnostic artifact path:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const nextAction =
    options.mode === 'scheduled' || options.softPendingExit
      ? 'Amazon still has the Ads report pending. Let the next scheduled run poll the saved report id, or rerun manually with --resume-pending.'
      : 'Rerun the same request with --resume-pending to continue polling the saved report id instead of creating a duplicate report.';

  return {
    status: options.mode === 'scheduled' || options.softPendingExit ? 'pending' : 'blocked',
    rowsRead: 0,
    rowsWritten: 0,
    latestAvailableDate: null,
    missingRanges: [`${options.from} -> ${options.to}`],
    blockers: [
      reportId
        ? `Amazon Ads SP campaign report is still pending in Amazon. report_id=${reportId}`
        : 'Amazon Ads SP campaign report is still pending in Amazon.',
    ],
    warnings: [],
    notes: [
      nextAction,
      ...(diagnosticPath ? [`diagnostic artifact: ${diagnosticPath}`] : []),
      ...(stderrTail.length > 0 ? [`stderr tail: ${stderrTail.slice(-3).join(' | ')}`] : []),
    ],
    details: {
      error_code: 'pending_timeout',
      error_message: error.message,
      error_metadata: details as JsonValue,
      report_id: reportId,
      diagnostic_path: diagnosticPath,
      pending_scope: {
        account_id: options.accountId,
        marketplace: options.marketplace,
        from: options.from,
        to: options.to,
      },
    },
  };
};

const runSqpPullScript = async (args: {
  scriptName: 'spapi:sqp-first-real-pull-ingest' | 'spapi:sqp-monthly-first-real-pull-ingest';
  asin: string;
  startDate: string;
  endDate: string;
  options: CliOptions;
}): Promise<{ rowCount: number; coverageWindow: string | null; uploadId: string | null; stdoutTail: string[] }> => {
  const env = buildProcessEnv(args.options);
  const commandArgs = [
    '--asin',
    args.asin,
    '--start-date',
    args.startDate,
    '--end-date',
    args.endDate,
  ];
  const result = await runNpmScript(args.scriptName, commandArgs, env);
  return {
    rowCount: parseNumberLine(result.stdout, 'Row count') ?? 0,
    coverageWindow: parseLineValue(result.stdout, 'Coverage window'),
    uploadId: parseLineValue(result.stdout, 'Upload ID'),
    stdoutTail: tailLines(result.stdout),
  };
};

const buildSqpWindows = (options: CliOptions): {
  weeklyStart: string;
  weeklyEnd: string;
  monthlyStart: string;
  monthlyEnd: string;
} => {
  if (options.preset === 'recent') {
    const weeklyEnd = endOfWeekSaturday(addDays(todayDateOnly(), -7));
    const weeklyStart = addDays(startOfWeekSunday(weeklyEnd), -21);
    const lastCompleteMonth = endOfMonth(addDays(startOfMonth(todayDateOnly()), -1));
    const monthlyStart = monthStartFromOffset(lastCompleteMonth, -1);
    const monthlyEnd = lastCompleteMonth;
    return { weeklyStart, weeklyEnd, monthlyStart, monthlyEnd };
  }

  if (options.preset === 'today') {
    const weeklyEnd = endOfWeekSaturday(addDays(todayDateOnly(), -7));
    const weeklyStart = startOfWeekSunday(weeklyEnd);
    const lastCompleteMonth = endOfMonth(addDays(startOfMonth(todayDateOnly()), -1));
    const monthlyStart = startOfMonth(lastCompleteMonth);
    const monthlyEnd = lastCompleteMonth;
    return { weeklyStart, weeklyEnd, monthlyStart, monthlyEnd };
  }

  return {
    weeklyStart: startOfWeekSunday(options.from),
    weeklyEnd: endOfWeekSaturday(options.to),
    monthlyStart: startOfMonth(options.from),
    monthlyEnd: endOfMonth(options.to),
  };
};

const runSqpSource = async (pool: Pool, options: CliOptions): Promise<{
  status: SourceResultStatus;
  rowsRead: number | null;
  rowsWritten: number | null;
  latestAvailableDate: string | null;
  missingRanges: string[];
  blockers: string[];
  warnings: string[];
  notes: string[];
  details: JsonObject;
}> => {
  const asins = await discoverSqpAsins(pool, options);
  if (asins.length === 0) {
    return {
      status: 'blocked',
      rowsRead: 0,
      rowsWritten: 0,
      latestAvailableDate: null,
      missingRanges: [`${options.from} -> ${options.to}`],
      blockers: ['No ASINs were found in public.products for SQP automation.'],
      warnings: [],
      notes: [],
      details: {},
    };
  }

  const windows = buildSqpWindows(options);
  if (options.dryRun) {
    return {
      status: 'skipped',
      rowsRead: asins.length,
      rowsWritten: 0,
      latestAvailableDate: windows.weeklyEnd,
      missingRanges: [],
      blockers: [],
      warnings: ['dry-run: SQP weekly/monthly pulls skipped before contacting Amazon'],
      notes: [`ASIN count discovered: ${asins.length}`],
      details: {
        asins: asins.slice(0, 20),
        weekly_window: weekRangeLabel(windows.weeklyStart, windows.weeklyEnd),
        monthly_window: weekRangeLabel(windows.monthlyStart, windows.monthlyEnd),
      },
    };
  }

  let totalRows = 0;
  const weeklyRuns: JsonObject[] = [];
  const monthlyRuns: JsonObject[] = [];
  for (const asin of asins) {
    const weekly = await runSqpPullScript({
      scriptName: 'spapi:sqp-first-real-pull-ingest',
      asin,
      startDate: windows.weeklyStart,
      endDate: windows.weeklyEnd,
      options,
    });
    totalRows += weekly.rowCount;
    weeklyRuns.push({
      asin,
      coverage_window: weekly.coverageWindow,
      upload_id: weekly.uploadId,
      row_count: weekly.rowCount,
      stdout_tail: weekly.stdoutTail,
    });

    const monthly = await runSqpPullScript({
      scriptName: 'spapi:sqp-monthly-first-real-pull-ingest',
      asin,
      startDate: windows.monthlyStart,
      endDate: windows.monthlyEnd,
      options,
    });
    totalRows += monthly.rowCount;
    monthlyRuns.push({
      asin,
      coverage_window: monthly.coverageWindow,
      upload_id: monthly.uploadId,
      row_count: monthly.rowCount,
      stdout_tail: monthly.stdoutTail,
    });
  }

  return {
    status: 'success',
    rowsRead: asins.length * 2,
    rowsWritten: totalRows,
    latestAvailableDate: windows.weeklyEnd,
    missingRanges: [],
    blockers: [],
    warnings: [],
    notes: [`ASIN count processed: ${asins.length}`],
    details: {
      weekly_window: weekRangeLabel(windows.weeklyStart, windows.weeklyEnd),
      monthly_window: weekRangeLabel(windows.monthlyStart, windows.monthlyEnd),
      weekly_runs: weeklyRuns,
      monthly_runs: monthlyRuns,
    },
  };
};

const runSettingsSource = async (pool: Pool, options: CliOptions): Promise<{
  status: SourceResultStatus;
  rowsRead: number | null;
  rowsWritten: number | null;
  latestAvailableDate: string | null;
  missingRanges: string[];
  blockers: string[];
  warnings: string[];
  notes: string[];
  details: JsonObject;
}> => {
  const channels = ['sp', 'sb', 'sd'] as const;
  const details: JsonObject = {};
  let successes = 0;
  let latestAvailableDate: string | null = null;
  const blockers: string[] = [];

  if (options.dryRun) {
    return {
      status: 'skipped',
      rowsRead: 0,
      rowsWritten: 0,
      latestAvailableDate: null,
      missingRanges: [],
      blockers: [],
      warnings: ['dry-run: settings snapshot capture skipped'],
      notes: [],
      details: {},
    };
  }

  for (const channel of channels) {
    try {
      const result = await pool.query(
        `select public.v3_capture_ads_settings_snapshot($1, $2, $3, null) as payload`,
        [options.accountId, options.marketplace, channel]
      );
      const payload = result.rows[0]?.payload as Record<string, unknown> | undefined;
      const snapshotDate = readTrimmed(String(payload?.snapshot_date ?? ''));
      if (snapshotDate) {
        latestAvailableDate = snapshotDate;
      }
      details[channel] = (payload ?? {}) as JsonValue;
      successes += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : `Settings snapshot failed for ${channel}`;
      blockers.push(`${channel.toUpperCase()}: ${message}`);
    }
  }

  const status: SourceResultStatus =
    successes === channels.length
      ? 'success'
      : successes > 0
      ? 'partial'
      : 'blocked';

  return {
    status,
    rowsRead: successes,
    rowsWritten: successes,
    latestAvailableDate,
    missingRanges: status === 'blocked' ? [`${options.from} -> ${options.to}`] : [],
    blockers,
    warnings: [],
    notes: [],
    details,
  };
};

const executeSource = async (pool: Pool, options: CliOptions, source: PullSource): Promise<Omit<SourceRunResult, 'source' | 'sourceType' | 'sourceName' | 'syncRunId'>> => {
  if (source === 'sales') {
    return runSalesSource(options);
  }
  if (source === 'ads') {
    return runAdsSource(pool, options);
  }
  if (source === 'sqp') {
    return runSqpSource(pool, options);
  }
  return runSettingsSource(pool, options);
};

const describeCommandFailure = (details: Record<string, unknown>): string => {
  const command =
    typeof details.command === 'string' ? details.command : 'unknown command';
  const exitCode =
    typeof details.exit_code === 'number' || typeof details.exit_code === 'string'
      ? String(details.exit_code)
      : 'unknown';
  const durationMs =
    typeof details.duration_ms === 'number' || typeof details.duration_ms === 'string'
      ? String(details.duration_ms)
      : 'unknown';
  return `${command} failed (exit=${exitCode}, duration_ms=${durationMs})`;
};

const toFailureDetails = (error: unknown): {
  blockers: string[];
  warnings: string[];
  notes: string[];
  details: JsonObject;
} => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    const maybeError = error as {
      code?: unknown;
      message: string;
      metadata?: unknown;
      steps?: unknown;
    };
    const metadata =
      typeof maybeError.metadata === 'object' && maybeError.metadata !== null
        ? (maybeError.metadata as Record<string, unknown>)
        : null;
    const stderrTail = Array.isArray(metadata?.stderr_tail)
      ? metadata.stderr_tail
          .filter((value): value is string => typeof value === 'string')
          .slice(-5)
      : [];
    const stdoutTail = Array.isArray(metadata?.stdout_tail)
      ? metadata.stdout_tail
          .filter((value): value is string => typeof value === 'string')
          .slice(-5)
      : [];

    const blockers = [maybeError.message];
    if (metadata?.command) {
      blockers.push(describeCommandFailure(metadata));
    }

    const notes: string[] = [];
    if (stderrTail.length > 0) {
      notes.push(`stderr tail: ${stderrTail.join(' | ')}`);
    }
    if (stdoutTail.length > 0) {
      notes.push(`stdout tail: ${stdoutTail.join(' | ')}`);
    }

    return {
      blockers,
      warnings: [],
      notes,
      details: {
        error_code:
          typeof maybeError.code === 'string' ? maybeError.code : 'source_failed',
        error_message: maybeError.message,
        error_metadata: (metadata ?? {}) as JsonValue,
        error_steps:
          Array.isArray(maybeError.steps) || typeof maybeError.steps === 'object'
            ? ((maybeError.steps ?? []) as JsonValue)
            : [],
      },
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown source failure';
  return {
    blockers: [message],
    warnings: [],
    notes: [],
    details: {
      error_code: 'source_failed',
      error_message: message,
    },
  };
};

const coverageNotes = (sourceResult: SourceRunResult, spec: CoverageSpec): string | null => {
  const operatorNotes = sourceResult.notes.filter(
    (note) => !/^stderr tail:|^stdout tail:/i.test(note)
  );
  const parts = [...sourceResult.blockers, ...sourceResult.warnings, ...operatorNotes];
  if (parts.length === 0) return null;
  return `[${spec.sourceName}] ${parts.join(' | ')}`;
};

export const deriveCoverageSourceResult = (
  sourceResult: SourceRunResult,
  spec: CoverageSpec
): SourceRunResult => {
  if (sourceResult.source !== 'ads') {
    return sourceResult;
  }

  if (ADS_IMPLEMENTED_COVERAGE_TABLES.has(spec.sourceName)) {
    const implementedResult = deriveAdsImplementedCoverageResult(sourceResult, spec);
    if (implementedResult) {
      return implementedResult;
    }
  }

  const unsupportedMessage = ADS_UNSUPPORTED_COVERAGE_MESSAGES[spec.sourceName];
  if (!unsupportedMessage) {
    return sourceResult;
  }

  return {
    ...sourceResult,
    status: 'blocked',
    blockers: [unsupportedMessage],
    warnings: [],
    notes: [],
    latestAvailableDate: null,
    missingRanges: sourceResult.missingRanges,
    details: {
      unsupported: true,
      source_name: spec.sourceName,
      reason: unsupportedMessage,
    },
  };
};

const refreshCoverageForSource = async (
  pool: Pool,
  options: CliOptions,
  sourceResult: SourceRunResult,
  finishedAt: string
): Promise<void> => {
  const requestedWindow = buildRequestedWindowTimestamps(options);
  const cutoffIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const specs = COVERAGE_SPECS.filter((spec) => spec.source === sourceResult.source);

  for (const spec of specs) {
    const effectiveSourceResult = deriveCoverageSourceResult(sourceResult, spec);
    const stats = await queryCoverageStats(pool, spec, {
      accountId: options.accountId,
      marketplace: options.marketplace,
      cutoffIso,
    });
    const tableStatus = toCoverageLastStatus(
      effectiveSourceResult.status,
      spec.tableStatusDefault,
      stats.rowCount
    );
    const latestDate = stats.latestPeriodEnd ? stats.latestPeriodEnd.slice(0, 10) : null;
    const missingRanges = buildMissingRanges({
      requestedFrom: options.from,
      requestedTo: options.to,
      latestDate,
      sourceStatus:
        spec.tableStatusDefault === 'blocked' && effectiveSourceResult.status === 'success'
          ? 'blocked'
          : effectiveSourceResult.status,
      blockers: effectiveSourceResult.blockers,
    });
    const freshnessStatus = deriveFreshnessStatus({
      latestPeriodEnd: stats.latestPeriodEnd,
      expectedDelayHours: spec.expectedDelayHours,
      lastStatus: tableStatus,
    });
    const notes = coverageNotes(effectiveSourceResult, spec);
    const tableDataStatus = deriveDataStatus({
      sourceStatus:
        spec.tableStatusDefault === 'blocked' && effectiveSourceResult.status === 'success'
          ? 'blocked'
          : effectiveSourceResult.status,
      latestDate,
      finality: options.finality,
    });

    await upsertCoverageStatus(pool, {
      accountId: options.accountId,
      marketplace: options.marketplace,
      sourceType: spec.sourceType,
      tableName: spec.tableName,
      granularity: spec.granularity,
      oldestPeriodStart: stats.oldestPeriodStart,
      latestPeriodEnd: stats.latestPeriodEnd,
      latestCompletePeriodEnd: stats.latestCompletePeriodEnd,
      lastAttemptedRunAt: finishedAt,
      lastSuccessfulRunAt:
        tableStatus === 'success' || tableStatus === 'partial'
          ? finishedAt
          : null,
        lastSyncRunId: effectiveSourceResult.syncRunId,
      lastStatus: tableStatus,
      freshnessStatus,
      expectedDelayHours: spec.expectedDelayHours,
      rowCount: stats.rowCount,
      missingRanges,
      warningCount: effectiveSourceResult.warnings.length,
      errorCount:
        effectiveSourceResult.blockers.length +
        (effectiveSourceResult.status === 'failed' ? 1 : 0),
      notes,
    });

    await replaceReportDataStatus(pool, {
      accountId: options.accountId,
      marketplace: options.marketplace,
      tableName: spec.tableName,
      sourceType: spec.sourceType,
      sourceName: spec.sourceName,
      scopeKey: spec.granularity,
      periodStart: stats.oldestPeriodStart ? stats.oldestPeriodStart.slice(0, 10) : null,
      periodEnd: stats.latestPeriodEnd ? stats.latestPeriodEnd.slice(0, 10) : null,
      dataStatus: tableDataStatus,
      isFinal: tableDataStatus === 'final',
      finalAfterAt: null,
      finalizedAt: tableDataStatus === 'final' ? finishedAt : null,
      lastSyncRunId: effectiveSourceResult.syncRunId,
      lastRefreshedAt: finishedAt,
      rowCount: stats.rowCount,
      coverageJson: {
        oldest_period_start: stats.oldestPeriodStart,
        latest_period_end: stats.latestPeriodEnd,
        latest_complete_period_end: stats.latestCompletePeriodEnd,
        missing_ranges: missingRanges,
        source_status: tableStatus,
      },
      warnings: [...effectiveSourceResult.warnings, ...effectiveSourceResult.blockers],
    });

    await recordQualityCheck(pool, {
      syncRunId: effectiveSourceResult.syncRunId,
      accountId: options.accountId,
      marketplace: options.marketplace,
      tableName: spec.tableName,
      checkName: 'phase9_coverage_refresh',
      checkCategory: 'coverage',
      status:
        freshnessStatus === 'stale' || tableStatus === 'failed'
          ? 'warning'
          : 'passed',
      severity:
        freshnessStatus === 'stale' || tableStatus === 'failed' ? 'warn' : 'info',
      periodStart: stats.oldestPeriodStart ? stats.oldestPeriodStart.slice(0, 10) : null,
      periodEnd: stats.latestPeriodEnd ? stats.latestPeriodEnd.slice(0, 10) : null,
      rowsChecked: stats.rowCount,
      failingRows: missingRanges.length,
      expectedJson: {
        expected_delay_hours: spec.expectedDelayHours,
      },
      actualJson: {
        last_status: tableStatus,
        freshness_status: freshnessStatus,
      },
      detailsJson: {
        missing_ranges: missingRanges,
        notes,
      },
      message: notes,
    });
  }
};

const printSummary = (results: SourceRunResult[]): void => {
  console.log('V3 Amazon data pull summary');
  for (const result of results) {
    console.log(
      [
        `source=${result.source}`,
        `status=${result.status}`,
        `rows=${result.rowsWritten ?? 'n/a'}`,
        `latest=${result.latestAvailableDate ?? 'n/a'}`,
        `missing=${result.missingRanges.length > 0 ? result.missingRanges.join('; ') : 'none'}`,
        `blockers=${result.blockers.length > 0 ? result.blockers.join(' | ') : 'none'}`,
        `notes=${result.notes.length > 0 ? result.notes.join(' | ') : 'none'}`,
      ].join(' | ')
    );
  }
};

async function main(): Promise<void> {
  loadLocalEnvFiles();

  const options = parseV3PullAmazonArgs(process.argv.slice(2));
  ensureSupabaseEnv();
  const sourceEnvMap = buildEnvCheckBySource(options);
  const databaseUrl = requireDatabaseUrl();
  const pool = createPostgresPool(databaseUrl);
  const requestedAt = new Date().toISOString();
  const requestedWindow = buildRequestedWindowTimestamps(options);
  const parentSyncRunId = await insertSyncRun(pool, {
    accountId: options.accountId,
    marketplace: options.marketplace,
    sourceType: 'automation',
    sourceName: 'v3_pull_amazon',
    tableName: 'amazon_data_sync',
    syncKind: mapModeToSyncKind(options.mode),
    status: 'running',
    dataStatus: options.dryRun ? 'manual_unknown' : 'preliminary',
    requestedAt,
    startedAt: requestedAt,
    sourceWindowStart: requestedWindow.start,
    sourceWindowEnd: requestedWindow.end,
    backfillStart: options.mode === 'backfill' ? options.from : null,
    backfillEnd: options.mode === 'backfill' ? options.to : null,
      requestJson: {
        mode: options.mode,
        dry_run: options.dryRun,
        diagnose: options.diagnose,
        resume_pending: options.resumePending,
        soft_pending_exit: options.softPendingExit,
        from: options.from,
        to: options.to,
        sources: options.sources,
      preset: options.preset,
      recent_days: options.recentDays,
      finality: options.finality,
      force: options.force,
    },
    resultJson: {},
  });

  const results: SourceRunResult[] = [];

  try {
    for (const source of options.sources) {
      const childRunId = await insertSyncRun(pool, {
        accountId: options.accountId,
        marketplace: options.marketplace,
        sourceType: source === 'settings' ? 'bulk_snapshot' : source === 'ads' ? 'ads_api' : 'sp_api',
        sourceName: source,
        tableName: source === 'ads' ? 'ads_tables' : source,
        syncKind: mapModeToSyncKind(options.mode),
        status: 'running',
        dataStatus: options.dryRun ? 'manual_unknown' : 'preliminary',
        requestedAt,
        startedAt: new Date().toISOString(),
        sourceWindowStart: requestedWindow.start,
        sourceWindowEnd: requestedWindow.end,
        backfillStart: options.mode === 'backfill' ? options.from : null,
        backfillEnd: options.mode === 'backfill' ? options.to : null,
        requestJson: {
          parent_sync_run_id: parentSyncRunId,
          mode: options.mode,
          source,
          resume_pending: options.resumePending,
          soft_pending_exit: options.softPendingExit,
          source_required_env: sourceEnvMap[source],
        },
        resultJson: {},
      });

      const missingEnv = collectMissingEnv(sourceEnvMap[source]);
      let result: SourceRunResult;

      try {
        if (missingEnv.length > 0) {
          const finishedAt = new Date().toISOString();
          result = {
            source,
            sourceType:
              source === 'settings' ? 'bulk_snapshot' : source === 'ads' ? 'ads_api' : 'sp_api',
            sourceName: source,
            syncRunId: childRunId,
            status: 'blocked',
            rowsRead: 0,
            rowsWritten: 0,
            latestAvailableDate: null,
            missingRanges: [`${options.from} -> ${options.to}`],
            blockers: [`Missing required environment variables: ${missingEnv.join(', ')}`],
            warnings: [],
            notes: [],
            details: {},
          };
          await updateSyncRun(pool, childRunId, {
            status: 'failed',
            dataStatus: 'failed',
            finishedAt,
            rowsRead: 0,
            rowsWritten: 0,
            rowsFailed: 0,
            errorCode: 'missing_env',
            errorMessage: result.blockers[0],
            resultJson: {
              parent_sync_run_id: parentSyncRunId,
              source,
              status: result.status,
              blockers: result.blockers,
            },
            lastRefreshedAt: finishedAt,
          });
          await refreshCoverageForSource(pool, options, result, finishedAt);
          results.push(result);
          continue;
        }

        if (source === 'ads') {
          loadAdsApiEnvForProfileSync(buildProcessEnv(options));
        } else if (source === 'sales' || source === 'sqp') {
          loadSpApiEnv(buildProcessEnv(options));
        }

        const executed = await executeSource(pool, options, source);
        const finishedAt = new Date().toISOString();
        result = {
          source,
          sourceType:
            source === 'settings' ? 'bulk_snapshot' : source === 'ads' ? 'ads_api' : 'sp_api',
          sourceName: source,
          syncRunId: childRunId,
          ...executed,
        };
        const dataStatus = deriveDataStatus({
          sourceStatus: result.status,
          latestDate: result.latestAvailableDate,
          finality: options.finality,
        });
        await updateSyncRun(pool, childRunId, {
          status:
            result.status === 'failed' ||
            result.status === 'blocked' ||
            result.status === 'pending'
              ? 'failed'
              : result.status === 'skipped'
              ? 'skipped'
              : 'succeeded',
          dataStatus,
          finishedAt,
          rowsRead: result.rowsRead,
          rowsWritten: result.rowsWritten,
          rowsFailed: 0,
          errorCode:
            result.status === 'failed' ||
            result.status === 'blocked' ||
            result.status === 'pending'
              ? typeof result.details.error_code === 'string'
                ? result.details.error_code
                : 'source_blocked'
              : null,
          errorMessage:
            result.status === 'failed' ||
            result.status === 'blocked' ||
            result.status === 'pending'
              ? result.blockers.join(' | ')
              : null,
          resultJson: {
            parent_sync_run_id: parentSyncRunId,
            source,
            status: result.status,
            latest_available_date: result.latestAvailableDate,
            missing_ranges: result.missingRanges,
            blockers: result.blockers,
            warnings: result.warnings,
            notes: result.notes,
            details: result.details,
          },
          rawJson: {
            source_details: result.details,
          },
          lastRefreshedAt: finishedAt,
        });
        await refreshCoverageForSource(pool, options, result, finishedAt);
        results.push(result);
        continue;
      } catch (error) {
      const finishedAt = new Date().toISOString();
      const failure = toFailureDetails(error);
      const result: SourceRunResult = {
        source,
        sourceType:
          source === 'settings' ? 'bulk_snapshot' : source === 'ads' ? 'ads_api' : 'sp_api',
        sourceName: source,
        syncRunId: childRunId,
        status: 'failed',
        rowsRead: 0,
        rowsWritten: 0,
        latestAvailableDate: null,
        missingRanges: [`${options.from} -> ${options.to}`],
        blockers: failure.blockers,
        warnings: failure.warnings,
        notes: failure.notes,
        details: failure.details,
      };
      await updateSyncRun(pool, childRunId, {
        status: 'failed',
        dataStatus: 'failed',
        finishedAt,
        rowsRead: 0,
        rowsWritten: 0,
        rowsFailed: 0,
        errorCode:
          typeof failure.details.error_code === 'string'
            ? failure.details.error_code
            : 'source_failed',
        errorMessage: result.blockers.join(' | '),
        resultJson: {
          parent_sync_run_id: parentSyncRunId,
          source,
          status: result.status,
          latest_available_date: result.latestAvailableDate,
          missing_ranges: result.missingRanges,
          blockers: result.blockers,
          warnings: result.warnings,
          notes: result.notes,
          details: result.details,
        },
        rawJson: {
          source_details: result.details,
        },
        lastRefreshedAt: finishedAt,
      });
      await refreshCoverageForSource(pool, options, result, finishedAt);
      results.push(result);
      }
    }

    const toleratedStatuses: SourceResultStatus[] =
      options.mode === 'scheduled' || options.softPendingExit
        ? ['success', 'partial', 'skipped', 'pending']
        : ['success', 'partial', 'skipped'];
    const successCount = results.filter((result) =>
      toleratedStatuses.includes(result.status)
    ).length;
    const anySuccess = results.some((result) =>
      toleratedStatuses.includes(result.status)
    );
    const parentDataStatus =
      results.length > 0 &&
      results.every((result) => result.status === 'pending' || result.status === 'blocked')
        ? 'manual_unknown'
        : anySuccess
        ? 'live'
        : 'failed';
    const finishedAt = new Date().toISOString();

    await updateSyncRun(pool, parentSyncRunId, {
      status: anySuccess ? 'succeeded' : 'failed',
      dataStatus: parentDataStatus,
      finishedAt,
      rowsRead: results.reduce((sum, result) => sum + (result.rowsRead ?? 0), 0),
      rowsWritten: results.reduce((sum, result) => sum + (result.rowsWritten ?? 0), 0),
      rowsFailed: results.length - successCount,
      errorCode: anySuccess ? null : 'all_sources_failed',
      errorMessage: anySuccess ? null : 'All selected sources failed, were blocked, or remained pending.',
      resultJson: {
        source_results: results.map((result) => ({
          source: result.source,
          status: result.status,
          latest_available_date: result.latestAvailableDate,
          missing_ranges: result.missingRanges,
          blockers: result.blockers,
          warnings: result.warnings,
        })),
      },
      lastRefreshedAt: finishedAt,
    });

    printSummary(results);

    if (!anySuccess) {
      process.exitCode = 1;
    } else if (
      results.some((result) => ['blocked', 'failed', 'pending'].includes(result.status))
    ) {
      process.exitCode = 0;
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown Phase 9 sync failure';
    console.error(`v3:pull:amazon failed: ${message}`);
    process.exitCode = 1;
  });
}
