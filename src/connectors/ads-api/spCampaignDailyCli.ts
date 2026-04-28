import fs from 'node:fs';
import path from 'node:path';

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
} from './index';
import { loadLocalEnvFiles } from './loadLocalEnv';

type CliArgs = {
  startDate: string;
  endDate: string;
  diagnose: boolean;
  maxAttempts: number;
  pollIntervalMs: number;
};

const USAGE =
  'Usage: npm run adsapi:pull-sp-campaign-daily -- --start-date YYYY-MM-DD --end-date YYYY-MM-DD [--diagnose] [--max-attempts N] [--poll-interval-ms N]';

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
  };
};

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
  try {
    loadLocalEnvFiles();

    const cliArgs = parseArgs(process.argv.slice(2));
    const dateRange = buildAdsApiDateRange(cliArgs);
    const config = loadAdsApiEnvForProfileSync();
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
        error.code === 'report_timeout'
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
  }
}

if (require.main === module) {
  void main();
}
