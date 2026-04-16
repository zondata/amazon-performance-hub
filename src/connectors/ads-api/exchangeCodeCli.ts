import {
  adsApiFetchTransport,
  AdsApiAuthError,
  AdsApiConfigError,
  exchangeAdsAuthorizationCode,
  loadAdsApiEnv,
} from './index';
import { loadLocalEnvFiles } from './loadLocalEnv';

function readOption(name: string): string | null {
  const args = process.argv.slice(2);
  const exactIndex = args.indexOf(name);

  if (exactIndex >= 0) {
    return args[exactIndex + 1] ?? null;
  }

  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function printUsage(): void {
  console.error(
    'Usage: npm run adsapi:exchange-code -- --code <fresh_code> --redirect-uri <uri> [--scope <scope>]'
  );
}

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const code = readOption('--code');
    const redirectUri = readOption('--redirect-uri');
    const scope = readOption('--scope');

    if (!code || !redirectUri) {
      printUsage();
      process.exitCode = 1;
      return;
    }

    const config = loadAdsApiEnv();
    const result = await exchangeAdsAuthorizationCode({
      config,
      input: {
        code,
        redirectUri,
        scope,
      },
      transport: adsApiFetchTransport,
    });

    if (!result.ok) {
      throw result.error;
    }

    console.log('Amazon Ads authorization-code exchange succeeded.');
    console.log(`Token type: ${result.tokenType}`);
    console.log(`Expires in: ${result.expiresIn}`);
    console.log(`Scope returned: ${result.scope ?? '(none)'}`);
    console.log('Access token returned: yes (redacted)');
    console.log(
      `Refresh token returned: ${result.refreshToken ? 'yes (redacted)' : 'no'}`
    );
    console.log(`Configured Ads API base URL: ${config.apiBaseUrl}`);
    console.log(
      'If you want to replace the local refresh token, update AMAZON_ADS_REFRESH_TOKEN in .env.local manually. This command does not edit .env.local.'
    );
  } catch (error) {
    if (error instanceof AdsApiConfigError) {
      console.error(`Amazon Ads config error: ${error.message}`);
    } else if (error instanceof AdsApiAuthError) {
      console.error(`Amazon Ads auth error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Amazon Ads authorization-code exchange failed: ${error.message}`);
    } else {
      console.error(
        'Amazon Ads authorization-code exchange failed due to an unknown error.'
      );
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
