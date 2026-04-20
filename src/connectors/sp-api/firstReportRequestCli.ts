import { loadLocalEnvFiles } from './loadLocalEnv';
import { createFirstSalesAndTrafficReportRequest } from './firstReportRequest';
import {
  SpApiAuthError,
  SpApiConfigError,
  SpApiRequestError,
} from './types';

type CliArgs = {
  startDate?: string;
  endDate?: string;
};

const readValue = (argv: string[], index: number, flag: string): string => {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new SpApiRequestError(
      'request_build_error',
      `Missing value for ${flag}`
    );
  }
  return value;
};

const parseCliArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--start-date') {
      args.startDate = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--start-date=')) {
      args.startDate = arg.slice('--start-date='.length);
      continue;
    }
    if (arg === '--end-date') {
      args.endDate = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--end-date=')) {
      args.endDate = arg.slice('--end-date='.length);
      continue;
    }

    throw new SpApiRequestError(
      'request_build_error',
      `Unknown CLI argument: ${arg}`
    );
  }

  return args;
};

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const args = parseCliArgs(process.argv.slice(2));
    const summary = await createFirstSalesAndTrafficReportRequest(args);

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
