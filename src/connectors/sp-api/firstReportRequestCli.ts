import { loadLocalEnvFiles } from './loadLocalEnv';
import { createFirstSalesAndTrafficReportRequest } from './firstReportRequest';
import {
  SpApiAuthError,
  SpApiConfigError,
  SpApiRequestError,
} from './types';

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const summary = await createFirstSalesAndTrafficReportRequest();

    console.log('SP-API first report request succeeded.');
    console.log(`Endpoint: ${summary.endpoint}`);
    console.log(`Region: ${summary.region}`);
    console.log(`Marketplace ID: ${summary.marketplaceId}`);
    console.log(`Report type: ${summary.reportType}`);
    console.log(`Report ID: ${summary.reportId}`);
  } catch (error) {
    if (error instanceof SpApiConfigError) {
      console.error(`SP-API config error: ${error.message}`);
    } else if (error instanceof SpApiAuthError) {
      console.error(`SP-API auth error: ${error.message}`);
    } else if (error instanceof SpApiRequestError) {
      console.error(`SP-API request error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`SP-API first report request failed: ${error.message}`);
    } else {
      console.error(
        'SP-API first report request failed due to an unknown error.'
      );
    }

    process.exitCode = 1;
  }
}

void main();
