import { loadLocalEnvFiles } from './loadLocalEnv';
import { runFirstSpApiSqpRealPullAndIngest } from './firstSqpRealPull';
import {
  SpApiAuthError,
  SpApiConfigError,
  SpApiRequestError,
  SpApiSqpIngestError,
  SpApiSqpPullError,
} from './types';

export const parseFirstSqpRealPullCliArgs = (argv: string[]) => {
  let asin = '';
  let startDate = '';
  let endDate = '';
  let maxAttempts: number | undefined;
  let pollIntervalMs: number | undefined;

  const parseIntegerFlag = (rawValue: string, flagName: string) => {
    const value = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(value)) {
      throw new SpApiSqpPullError(
        'invalid_input',
        `${flagName} must be an integer`
      );
    }

    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--asin') {
      asin = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--asin=')) {
      asin = arg.slice('--asin='.length);
      continue;
    }

    if (arg === '--start-date') {
      startDate = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--start-date=')) {
      startDate = arg.slice('--start-date='.length);
      continue;
    }

    if (arg === '--end-date') {
      endDate = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--end-date=')) {
      endDate = arg.slice('--end-date='.length);
      continue;
    }

    if (arg === '--max-attempts') {
      const rawValue = argv[index + 1];
      if (rawValue == null) {
        throw new SpApiSqpPullError(
          'invalid_input',
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
        throw new SpApiSqpPullError(
          'invalid_input',
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

    throw new SpApiSqpPullError('invalid_input', `Unknown CLI argument: ${arg}`);
  }

  if (!asin.trim() || !startDate.trim() || !endDate.trim()) {
    throw new SpApiSqpPullError(
      'invalid_input',
      'The SQP real-pull CLI requires --asin <value> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>'
    );
  }

  return {
    asin,
    startDate,
    endDate,
    maxAttempts,
    pollIntervalMs,
  };
};

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const options = parseFirstSqpRealPullCliArgs(process.argv.slice(2));
    const summary = await runFirstSpApiSqpRealPullAndIngest(options);

    console.log('SP-API SQP first real pull + ingest succeeded.');
    console.log(`Endpoint: ${summary.endpoint}`);
    console.log(`Report ID: ${summary.reportId}`);
    console.log(`Report document ID: ${summary.reportDocumentId}`);
    console.log(`Raw artifact: ${summary.rawArtifactPath}`);
    console.log(`Scope type: ${summary.scopeType}`);
    console.log(`Scope value: ${summary.scopeValue}`);
    console.log(`Coverage window: ${summary.coverageStart} -> ${summary.coverageEnd}`);
    console.log(`Row count: ${summary.rowCount}`);
    console.log(`Warnings: ${summary.warningsCount}`);
    console.log(`Upload ID: ${summary.uploadId ?? 'n/a'}`);
  } catch (error) {
    if (error instanceof SpApiConfigError) {
      console.error(`SP-API config error: ${error.message}`);
    } else if (error instanceof SpApiAuthError) {
      console.error(`SP-API auth error: ${error.message}`);
    } else if (error instanceof SpApiRequestError) {
      console.error(`SP-API request error: ${error.message}`);
    } else if (error instanceof SpApiSqpPullError) {
      console.error(`SP-API SQP real-pull error: ${error.message}`);
    } else if (error instanceof SpApiSqpIngestError) {
      console.error(`SP-API SQP ingest error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`SP-API SQP first real pull + ingest failed: ${error.message}`);
    } else {
      console.error(
        'SP-API SQP first real pull + ingest failed due to an unknown error.'
      );
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
