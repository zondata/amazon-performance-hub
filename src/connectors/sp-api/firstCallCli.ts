import { fetchMarketplaceParticipations } from './firstCall';
import { loadLocalEnvFiles } from './loadLocalEnv';
import {
  SpApiAuthError,
  SpApiConfigError,
  SpApiRequestError,
} from './types';

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const summary = await fetchMarketplaceParticipations();

    console.log('SP-API first call succeeded.');
    console.log(`Endpoint: ${summary.endpoint}`);
    console.log(`Region: ${summary.region}`);
    console.log(
      `Marketplace IDs found: ${
        summary.marketplaceIds.length > 0
          ? summary.marketplaceIds.join(', ')
          : '(none)'
      }`,
    );
    console.log(`Participations returned: ${summary.participationCount}`);
  } catch (error) {
    if (error instanceof SpApiConfigError) {
      console.error(`SP-API config error: ${error.message}`);
    } else if (error instanceof SpApiAuthError) {
      console.error(`SP-API auth error: ${error.message}`);
    } else if (error instanceof SpApiRequestError) {
      console.error(`SP-API request error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`SP-API first call failed: ${error.message}`);
    } else {
      console.error('SP-API first call failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

void main();
