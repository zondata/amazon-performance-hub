import {
  adsApiFetchTransport,
  AdsApiAuthError,
  AdsApiConfigError,
  loadAdsApiEnvForRefresh,
  refreshAdsAccessToken,
  type AdsApiTokenResult,
} from './index';
import { loadLocalEnvFiles } from './loadLocalEnv';

export const buildRefreshAccessTokenSuccessLines = (args: {
  result: Extract<AdsApiTokenResult, { ok: true }>;
  apiBaseUrl: string;
}): string[] => [
  'Amazon Ads refresh-token exchange succeeded.',
  `Token type: ${args.result.tokenType}`,
  `Expires in: ${args.result.expiresIn}`,
  `Refresh token returned in payload: ${
    args.result.refreshToken ? 'yes (redacted)' : 'no'
  }`,
  `Configured Ads API base URL: ${args.apiBaseUrl}`,
];

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const config = loadAdsApiEnvForRefresh();
    const result = await refreshAdsAccessToken({
      config,
      transport: adsApiFetchTransport,
    });

    if (!result.ok) {
      throw result.error;
    }

    for (const line of buildRefreshAccessTokenSuccessLines({
      result,
      apiBaseUrl: config.apiBaseUrl,
    })) {
      console.log(line);
    }
  } catch (error) {
    if (error instanceof AdsApiConfigError) {
      console.error(`Amazon Ads config error: ${error.message}`);
    } else if (error instanceof AdsApiAuthError) {
      console.error(`Amazon Ads auth error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Amazon Ads refresh-token exchange failed: ${error.message}`);
    } else {
      console.error(
        'Amazon Ads refresh-token exchange failed due to an unknown error.'
      );
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
