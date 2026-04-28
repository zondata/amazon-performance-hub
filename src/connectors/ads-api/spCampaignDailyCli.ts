import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

import type { Pool } from 'pg';

import {
  ADS_API_SP_CAMPAIGN_DAILY_DIAGNOSTIC_ARTIFACT_PATH,
  ADS_API_SP_CAMPAIGN_DAILY_NORMALIZED_ARTIFACT_PATH,
  ADS_API_SP_CAMPAIGN_DAILY_RAW_ARTIFACT_PATH,
  adsApiDownloadTransport,
  adsApiFetchTransport,
  AdsApiAuthError,
  AdsApiConfigError,
  AdsApiSpCampaignDailyError,
  buildAdsApiDateRange,
  DEFAULT_SP_CAMPAIGN_DAILY_MAX_ATTEMPTS,
  DEFAULT_SP_CAMPAIGN_DAILY_POLL_INTERVAL_MS,
  loadAdsApiEnvForProfileSync,
  refreshAdsAccessToken,
  runSpCampaignDailyPull,
  type SpCampaignDailyPollingDiagnostic,
  type AdsApiSpCampaignDailyNormalizedArtifact,
  type SpCampaignDailyPendingRequestStore,
} from './index';
import { loadLocalEnvFiles } from './loadLocalEnv';
import { createPostgresPool } from '../../ingestion/postgresIngestionJobRepository';

type CliArgs = {
  startDate: string;
  endDate: string;
  diagnose: boolean;
  maxAttempts: number;
  pollIntervalMs: number;
  resumePending: boolean;
  resumePendingOnly: boolean;
};

const USAGE =
  'Usage: npm run adsapi:pull-sp-campaign-daily -- --start-date YYYY-MM-DD --end-date YYYY-MM-DD [--diagnose] [--resume-pending] [--resume-pending-only] [--max-attempts N] [--poll-interval-ms N]';

const readInteger = (value: string | undefined, label: string): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AdsApiSpCampaignDailyError('invalid_date', `${label} must be a positive integer.`);
  }
  return parsed;
};

const readEnvInteger = (name: string, fallback: number): number => {
  const raw = process.env[name]?.trim() ?? '';
  if (!raw) return fallback;
  return readInteger(raw, name);
};

const readDatabaseUrl = (): string | null => {
  const value = process.env.DATABASE_URL?.trim() ?? '';
  return value.length > 0 ? value : null;
};

const hashProfileId = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

const maskProfileId = (value: string): string =>
  value.length <= 4 ? '****' : `${'*'.repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;

const formatPollingUpdateLine = (args: {
  phase: 'create' | 'poll' | 'timeout';
  attempt: number;
  reportId: string;
  status: string | null;
  statusDetails: string | null;
  responseStatus: number | null;
  retryAfter: string | null;
  hasLocation: boolean;
}): string =>
  [
    `Ads campaign report ${args.phase}`,
    `attempt=${args.attempt}`,
    `report_id=${args.reportId}`,
    `status=${args.status ?? '(none)'}`,
    `status_details=${args.statusDetails ?? '(none)'}`,
    `response_status=${args.responseStatus ?? 'n/a'}`,
    `retry_after=${args.retryAfter ?? 'none'}`,
    `download_ready=${args.hasLocation ? 'yes' : 'no'}`,
  ].join(' | ');

const writeCampaignDiagnosticArtifact = (
  diagnostic: SpCampaignDailyPollingDiagnostic
): string => {
  fs.mkdirSync(path.dirname(ADS_API_SP_CAMPAIGN_DAILY_DIAGNOSTIC_ARTIFACT_PATH), {
    recursive: true,
  });
  fs.writeFileSync(
    ADS_API_SP_CAMPAIGN_DAILY_DIAGNOSTIC_ARTIFACT_PATH,
    `${JSON.stringify(diagnostic, null, 2)}\n`,
    'utf8'
  );
  return ADS_API_SP_CAMPAIGN_DAILY_DIAGNOSTIC_ARTIFACT_PATH;
};

const parseArgs = (argv: string[]): CliArgs => {
  let startDate: string | null = null;
  let endDate: string | null = null;
  let diagnose = false;
  let resumePending = false;
  let resumePendingOnly = false;
  let maxAttempts = readEnvInteger(
    'ADS_API_REPORT_MAX_ATTEMPTS',
    DEFAULT_SP_CAMPAIGN_DAILY_MAX_ATTEMPTS
  );
  let pollIntervalMs = readEnvInteger(
    'ADS_API_REPORT_POLL_INTERVAL_MS',
    DEFAULT_SP_CAMPAIGN_DAILY_POLL_INTERVAL_MS
  );

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--start-date') {
      startDate = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--end-date') {
      endDate = argv[index + 1] ?? null;
      index += 1;
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
    if (arg === '--resume-pending-only') {
      resumePending = true;
      resumePendingOnly = true;
      continue;
    }
    if (arg === '--max-attempts') {
      maxAttempts = readInteger(argv[index + 1], '--max-attempts');
      index += 1;
      continue;
    }
    if (arg === '--poll-interval-ms') {
      pollIntervalMs = readInteger(argv[index + 1], '--poll-interval-ms');
      index += 1;
    }
  }

  if (!startDate || !endDate) {
    throw new AdsApiSpCampaignDailyError('invalid_date', USAGE);
  }

  return {
    startDate,
    endDate,
    diagnose,
    maxAttempts,
    pollIntervalMs,
    resumePending,
    resumePendingOnly,
  };
};

const createPendingRequestStore = (
  pool: Pool
): SpCampaignDailyPendingRequestStore => ({
  async findReusablePendingRequest(args) {
    const result = await pool.query(
      `
        select
          report_id,
          status,
          status_details,
          attempt_count,
          diagnostic_path,
          last_response_json
        from public.ads_api_report_requests
        where account_id = $1
          and marketplace = $2
          and profile_id_hash = $3
          and report_type_id = $4
          and source_type = $5
          and start_date = $6::date
          and end_date = $7::date
          and status in ('created', 'requested', 'pending', 'polling', 'pending_timeout')
        order by updated_at desc
        limit 1
      `,
      [
        args.accountId,
        args.marketplace,
        hashProfileId(args.profileId),
        args.reportTypeId,
        args.sourceType,
        args.startDate,
        args.endDate,
      ]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      reportId: String(row.report_id),
      status: typeof row.status === 'string' ? row.status : null,
      statusDetails: typeof row.status_details === 'string' ? row.status_details : null,
      attemptCount: Number.parseInt(String(row.attempt_count ?? 0), 10) || 0,
      diagnosticPath:
        typeof row.diagnostic_path === 'string' ? row.diagnostic_path : null,
      lastResponseJson:
        row.last_response_json && typeof row.last_response_json === 'object'
          ? (row.last_response_json as Record<string, unknown>)
          : {},
    };
  },
  async upsertPendingRequest(args) {
    await pool.query(
      `
        insert into public.ads_api_report_requests (
          account_id,
          marketplace,
          profile_id_hash,
          profile_id_masked,
          ad_product,
          report_type_id,
          source_type,
          target_table,
          start_date,
          end_date,
          report_id,
          status,
          status_details,
          request_payload_json,
          last_response_json,
          diagnostic_path,
          last_polled_at,
          completed_at,
          failed_at,
          retry_after_at,
          attempt_count,
          notes
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9::date, $10::date, $11, $12, $13,
          $14::jsonb, $15::jsonb, $16, $17::timestamptz,
          $18::timestamptz, $19::timestamptz, $20::timestamptz, $21, $22
        )
        on conflict (account_id, marketplace, profile_id_hash, report_type_id, start_date, end_date, source_type)
        do update set
          profile_id_masked = excluded.profile_id_masked,
          ad_product = excluded.ad_product,
          target_table = excluded.target_table,
          report_id = excluded.report_id,
          status = excluded.status,
          status_details = excluded.status_details,
          request_payload_json = excluded.request_payload_json,
          last_response_json = excluded.last_response_json,
          diagnostic_path = excluded.diagnostic_path,
          last_polled_at = excluded.last_polled_at,
          completed_at = excluded.completed_at,
          failed_at = excluded.failed_at,
          retry_after_at = excluded.retry_after_at,
          attempt_count = excluded.attempt_count,
          notes = excluded.notes
      `,
      [
        args.accountId,
        args.marketplace,
        hashProfileId(args.profileId),
        maskProfileId(args.profileId),
        args.adProduct,
        args.reportTypeId,
        args.sourceType,
        args.targetTable,
        args.startDate,
        args.endDate,
        args.state.reportId,
        args.state.status,
        args.state.statusDetails,
        JSON.stringify(args.state.requestPayloadJson),
        JSON.stringify(args.state.lastResponseJson),
        args.state.diagnosticPath,
        args.state.lastPolledAt,
        args.state.completedAt,
        args.state.failedAt,
        args.state.retryAfterAt,
        args.state.attemptCount,
        args.state.notes,
      ]
    );
  },
});

export const buildSpCampaignDailySuccessLines = (args: {
  validatedProfileId: string;
  dateRange: { startDate: string; endDate: string };
  normalizedArtifact: AdsApiSpCampaignDailyNormalizedArtifact;
  rawArtifactPath: string;
  normalizedArtifactPath: string;
}): string[] => [
  'Amazon Ads campaign daily pull succeeded.',
  `Validated profile id: ${args.validatedProfileId}`,
  `Date range: ${args.dateRange.startDate} -> ${args.dateRange.endDate}`,
  `Row count: ${args.normalizedArtifact.rowCount}`,
  `Raw artifact path: ${args.rawArtifactPath}`,
  `Normalized artifact path: ${args.normalizedArtifactPath}`,
];

const loadExistingCampaignArtifact = (args: {
  config: ReturnType<typeof loadAdsApiEnvForProfileSync>;
  dateRange: { startDate: string; endDate: string };
}): {
  normalizedArtifact: AdsApiSpCampaignDailyNormalizedArtifact;
  rawArtifactPath: string;
  normalizedArtifactPath: string;
} | null => {
  if (
    !fs.existsSync(ADS_API_SP_CAMPAIGN_DAILY_RAW_ARTIFACT_PATH) ||
    !fs.existsSync(ADS_API_SP_CAMPAIGN_DAILY_NORMALIZED_ARTIFACT_PATH)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(ADS_API_SP_CAMPAIGN_DAILY_NORMALIZED_ARTIFACT_PATH, 'utf8')
    ) as Partial<AdsApiSpCampaignDailyNormalizedArtifact>;

    if (
      parsed.schemaVersion !== 'ads-api-sp-campaign-daily-normalized/v1' ||
      parsed.appAccountId !== args.config.appAccountId ||
      parsed.appMarketplace !== args.config.appMarketplace ||
      parsed.profileId !== args.config.profileId ||
      parsed.requestedDateRange?.startDate !== args.dateRange.startDate ||
      parsed.requestedDateRange?.endDate !== args.dateRange.endDate ||
      typeof parsed.rowCount !== 'number' ||
      !Array.isArray(parsed.normalizedCampaignRows)
    ) {
      return null;
    }

    return {
      normalizedArtifact: parsed as AdsApiSpCampaignDailyNormalizedArtifact,
      rawArtifactPath: ADS_API_SP_CAMPAIGN_DAILY_RAW_ARTIFACT_PATH,
      normalizedArtifactPath: ADS_API_SP_CAMPAIGN_DAILY_NORMALIZED_ARTIFACT_PATH,
    };
  } catch {
    return null;
  }
};

async function main(): Promise<void> {
  let pool: Pool | null = null;
  try {
    loadLocalEnvFiles();

    const cliArgs = parseArgs(process.argv.slice(2));
    const dateRange = buildAdsApiDateRange(cliArgs);
    const config = loadAdsApiEnvForProfileSync();
    const databaseUrl = readDatabaseUrl();
    if (databaseUrl) {
      pool = createPostgresPool(databaseUrl);
    } else if (cliArgs.resumePendingOnly) {
      throw new AdsApiSpCampaignDailyError(
        'pending_report_not_found',
        'DATABASE_URL is required to resume a pending Ads SP campaign report.'
      );
    }
    const pendingStore = pool ? createPendingRequestStore(pool) : null;
    const existingArtifact = loadExistingCampaignArtifact({
      config,
      dateRange,
    });

    if (existingArtifact) {
      for (const line of buildSpCampaignDailySuccessLines({
        validatedProfileId: config.profileId,
        dateRange,
        normalizedArtifact: existingArtifact.normalizedArtifact,
        rawArtifactPath: existingArtifact.rawArtifactPath,
        normalizedArtifactPath: existingArtifact.normalizedArtifactPath,
      })) {
        console.log(line);
      }
      return;
    }

    const tokenResult = await refreshAdsAccessToken({
      config,
      transport: adsApiFetchTransport,
    });

    if (!tokenResult.ok) {
      throw tokenResult.error;
    }

    let result;
    try {
      result = await runSpCampaignDailyPull({
        config,
        accessToken: tokenResult.accessToken,
        dateRange,
        transport: adsApiFetchTransport,
        downloadTransport: adsApiDownloadTransport,
        maxAttempts: cliArgs.maxAttempts,
        pollIntervalMs: cliArgs.pollIntervalMs,
        pendingStore,
        resumePendingOnly: cliArgs.resumePendingOnly,
        diagnosticPath: ADS_API_SP_CAMPAIGN_DAILY_DIAGNOSTIC_ARTIFACT_PATH,
        onPollUpdate:
          cliArgs.diagnose || process.env.GITHUB_ACTIONS === 'true'
            ? (update) => {
                console.log(
                  formatPollingUpdateLine({
                    phase: update.kind,
                    attempt: update.snapshot.attempt,
                    reportId: update.reportId,
                    status: update.snapshot.status,
                    statusDetails: update.snapshot.statusDetails,
                    responseStatus: update.snapshot.responseStatus,
                    retryAfter: update.snapshot.retryAfter,
                    hasLocation: update.snapshot.hasLocation,
                  })
                );
              }
            : undefined,
      });
    } catch (error) {
      if (
        error instanceof AdsApiSpCampaignDailyError &&
        (error.code === 'report_timeout' || error.code === 'pending_timeout')
      ) {
        const timedOutArtifact = loadExistingCampaignArtifact({
          config,
          dateRange,
        });

        if (timedOutArtifact) {
          for (const line of buildSpCampaignDailySuccessLines({
            validatedProfileId: config.profileId,
            dateRange,
            normalizedArtifact: timedOutArtifact.normalizedArtifact,
            rawArtifactPath: timedOutArtifact.rawArtifactPath,
            normalizedArtifactPath: timedOutArtifact.normalizedArtifactPath,
          })) {
            console.log(line);
          }
          return;
        }
      }

      throw error;
    }

    for (const line of buildSpCampaignDailySuccessLines({
      validatedProfileId: result.validatedArtifact.configuredProfileId,
      dateRange,
      normalizedArtifact: result.normalizedArtifact,
      rawArtifactPath: result.rawArtifactPath,
      normalizedArtifactPath: result.normalizedArtifactPath,
    })) {
      console.log(line);
    }
  } catch (error) {
    if (error instanceof AdsApiConfigError) {
      console.error(`Amazon Ads config error: ${error.message}`);
    } else if (error instanceof AdsApiAuthError) {
      console.error(`Amazon Ads auth error: ${error.message}`);
    } else if (error instanceof AdsApiSpCampaignDailyError) {
      console.error(`Amazon Ads campaign daily error code: ${error.code}`);
      if (
        error.details &&
        typeof error.details === 'object' &&
        'reportId' in error.details &&
        'maskedProfileId' in error.details
      ) {
        const diagnosticPath = writeCampaignDiagnosticArtifact(
          error.details as SpCampaignDailyPollingDiagnostic
        );
        console.error(`Diagnostic artifact path: ${diagnosticPath}`);
        console.error(
          `Diagnostic profile id: ${
            (error.details as SpCampaignDailyPollingDiagnostic).maskedProfileId
          }`
        );
      }
      console.error(`Amazon Ads campaign daily error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Amazon Ads campaign daily pull failed: ${error.message}`);
    } else {
      console.error(
        'Amazon Ads campaign daily pull failed due to an unknown error.'
      );
    }

    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}

if (require.main === module) {
  void main();
}
