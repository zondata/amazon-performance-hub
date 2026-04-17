import {
  adsApiDownloadTransport,
  adsApiFetchTransport,
  AdsApiAuthError,
  AdsApiConfigError,
  AdsApiSpTargetDailyError,
  buildAdsApiDateRange,
  loadAdsApiEnvForProfileSync,
  refreshAdsAccessToken,
  runSpTargetDailyPull,
  type AdsApiSpTargetDailyNormalizedArtifact,
} from './index';
import { loadLocalEnvFiles } from './loadLocalEnv';

type CliArgs = {
  startDate: string;
  endDate: string;
};

const USAGE =
  'Usage: npm run adsapi:pull-sp-target-daily -- --start-date YYYY-MM-DD --end-date YYYY-MM-DD';

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
    throw new AdsApiSpTargetDailyError('invalid_date', USAGE);
  }

  return {
    startDate,
    endDate,
  };
};

export const buildSpTargetDailySuccessLines = (args: {
  validatedProfileId: string;
  dateRange: { startDate: string; endDate: string };
  normalizedArtifact: AdsApiSpTargetDailyNormalizedArtifact;
  rawArtifactPath: string;
  normalizedArtifactPath: string;
}): string[] => [
  'Amazon Ads target daily pull succeeded.',
  `Validated profile id: ${args.validatedProfileId}`,
  `Date range: ${args.dateRange.startDate} -> ${args.dateRange.endDate}`,
  `Row count: ${args.normalizedArtifact.rowCount}`,
  `Raw artifact path: ${args.rawArtifactPath}`,
  `Normalized artifact path: ${args.normalizedArtifactPath}`,
];

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const cliArgs = parseArgs(process.argv.slice(2));
    const dateRange = buildAdsApiDateRange(cliArgs);
    const config = loadAdsApiEnvForProfileSync();
    const tokenResult = await refreshAdsAccessToken({
      config,
      transport: adsApiFetchTransport,
    });

    if (!tokenResult.ok) {
      throw tokenResult.error;
    }

    const result = await runSpTargetDailyPull({
      config,
      accessToken: tokenResult.accessToken,
      dateRange,
      transport: adsApiFetchTransport,
      downloadTransport: adsApiDownloadTransport,
    });

    for (const line of buildSpTargetDailySuccessLines({
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
    } else if (error instanceof AdsApiSpTargetDailyError) {
      console.error(`Amazon Ads target daily error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Amazon Ads target daily pull failed: ${error.message}`);
    } else {
      console.error(
        'Amazon Ads target daily pull failed due to an unknown error.'
      );
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
