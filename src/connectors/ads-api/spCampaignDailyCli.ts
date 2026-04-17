import fs from 'node:fs';

import {
  ADS_API_SP_CAMPAIGN_DAILY_NORMALIZED_ARTIFACT_PATH,
  ADS_API_SP_CAMPAIGN_DAILY_RAW_ARTIFACT_PATH,
  adsApiDownloadTransport,
  adsApiFetchTransport,
  AdsApiAuthError,
  AdsApiConfigError,
  AdsApiSpCampaignDailyError,
  buildAdsApiDateRange,
  loadAdsApiEnvForProfileSync,
  refreshAdsAccessToken,
  runSpCampaignDailyPull,
  type AdsApiSpCampaignDailyNormalizedArtifact,
} from './index';
import { loadLocalEnvFiles } from './loadLocalEnv';

type CliArgs = {
  startDate: string;
  endDate: string;
};

const USAGE =
  'Usage: npm run adsapi:pull-sp-campaign-daily -- --start-date YYYY-MM-DD --end-date YYYY-MM-DD';

const parseArgs = (argv: string[]): CliArgs => {
  let startDate: string | null = null;
  let endDate: string | null = null;

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
    }
  }

  if (!startDate || !endDate) {
    throw new AdsApiSpCampaignDailyError('invalid_date', USAGE);
  }

  return {
    startDate,
    endDate,
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
