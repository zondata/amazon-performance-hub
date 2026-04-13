import { loadLocalEnvFiles } from './loadLocalEnv';
import { pollFirstSalesAndTrafficReportStatus } from './firstReportStatus';
import {
  SpApiAuthError,
  SpApiConfigError,
  SpApiRequestError,
} from './types';

type CliOptions = {
  reportId: string;
  mode: 'single-check' | 'poll-until-terminal';
  maxAttempts?: number;
  pollIntervalMs?: number;
};

const parseIntegerFlag = (rawValue: string, flagName: string) => {
  const value = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(value)) {
    throw new SpApiRequestError(
      'request_build_error',
      `${flagName} must be an integer`
    );
  }

  return value;
};

const parseCliArgs = (argv: string[]): CliOptions => {
  let reportId = '';
  let mode: CliOptions['mode'] = 'poll-until-terminal';
  let maxAttempts: number | undefined;
  let pollIntervalMs: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--single-check') {
      mode = 'single-check';
      continue;
    }

    if (arg === '--report-id') {
      reportId = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--report-id=')) {
      reportId = arg.slice('--report-id='.length);
      continue;
    }

    if (arg === '--max-attempts') {
      const rawValue = argv[index + 1];
      if (rawValue == null) {
        throw new SpApiRequestError(
          'request_build_error',
          '--max-attempts requires a value'
        );
      }

      maxAttempts = parseIntegerFlag(rawValue, '--max-attempts');
      index += 1;
      continue;
    }

    if (arg.startsWith('--max-attempts=')) {
      maxAttempts = parseIntegerFlag(
        arg.slice('--max-attempts='.length),
        '--max-attempts'
      );
      continue;
    }

    if (arg === '--poll-interval-ms') {
      const rawValue = argv[index + 1];
      if (rawValue == null) {
        throw new SpApiRequestError(
          'request_build_error',
          '--poll-interval-ms requires a value'
        );
      }

      pollIntervalMs = parseIntegerFlag(rawValue, '--poll-interval-ms');
      index += 1;
      continue;
    }

    if (arg.startsWith('--poll-interval-ms=')) {
      pollIntervalMs = parseIntegerFlag(
        arg.slice('--poll-interval-ms='.length),
        '--poll-interval-ms'
      );
      continue;
    }

    throw new SpApiRequestError(
      'request_build_error',
      `Unknown CLI argument: ${arg}`
    );
  }

  if (!reportId.trim()) {
    throw new SpApiRequestError(
      'request_build_error',
      'The report status CLI requires --report-id <value>'
    );
  }

  return {
    reportId,
    mode,
    maxAttempts,
    pollIntervalMs,
  };
};

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const options = parseCliArgs(process.argv.slice(2));
    const summary = await pollFirstSalesAndTrafficReportStatus(options);

    console.log('SP-API first report status check succeeded.');
    console.log(`Endpoint: ${summary.endpoint}`);
    console.log(`Region: ${summary.region}`);
    console.log(`Marketplace ID: ${summary.marketplaceId}`);
    console.log(`Report ID: ${summary.reportId}`);
    console.log(`Report type: ${summary.reportType ?? 'not returned'}`);
    console.log(`Processing status: ${summary.processingStatus}`);
    console.log(`Terminal reached: ${summary.terminalReached ? 'yes' : 'no'}`);
    console.log(
      `Max attempts reached: ${summary.maxAttemptsReached ? 'yes' : 'no'}`
    );
    console.log(`Attempt count: ${summary.attemptCount}`);

    if (summary.processingStartTime) {
      console.log(`Processing started: ${summary.processingStartTime}`);
    }

    if (summary.processingEndTime) {
      console.log(`Processing ended: ${summary.processingEndTime}`);
    }

    if (summary.reportDocumentId) {
      console.log(`Report document ID: ${summary.reportDocumentId}`);
    }
  } catch (error) {
    if (error instanceof SpApiConfigError) {
      console.error(`SP-API config error: ${error.message}`);
    } else if (error instanceof SpApiAuthError) {
      console.error(`SP-API auth error: ${error.message}`);
    } else if (error instanceof SpApiRequestError) {
      console.error(`SP-API request error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`SP-API first report status check failed: ${error.message}`);
    } else {
      console.error(
        'SP-API first report status check failed due to an unknown error.'
      );
    }

    process.exitCode = 1;
  }
}

void main();
