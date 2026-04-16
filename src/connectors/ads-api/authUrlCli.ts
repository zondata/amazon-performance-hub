import {
  AdsApiConfigError,
  buildAdsAuthorizationUrl,
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
    'Usage: npm run adsapi:print-auth-url -- --redirect-uri <uri> --scope <scope> [--state <state>]'
  );
}

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const redirectUri = readOption('--redirect-uri');
    const scope = readOption('--scope');
    const state = readOption('--state');

    if (!redirectUri || !scope) {
      printUsage();
      process.exitCode = 1;
      return;
    }

    const config = loadAdsApiEnv();
    const url = buildAdsAuthorizationUrl({
      clientId: config.credentials.clientId,
      redirectUri,
      scope,
      state,
    });

    console.log(url);
  } catch (error) {
    if (error instanceof AdsApiConfigError) {
      console.error(`Amazon Ads config error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Amazon Ads authorization URL generation failed: ${error.message}`);
    } else {
      console.error(
        'Amazon Ads authorization URL generation failed due to an unknown error.'
      );
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
