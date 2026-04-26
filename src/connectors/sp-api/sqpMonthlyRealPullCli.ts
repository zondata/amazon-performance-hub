import { loadLocalEnvFiles } from './loadLocalEnv';
import { runFirstSpApiSqpRealPullAndIngest } from './firstSqpRealPull';
import {
  ensureSpApiSqpIngestCsvPath,
  parseValidatedSpApiSqpRawArtifact,
  readSpApiSqpRawArtifact,
  resolveSpApiSqpRawArtifactPath,
  summarizeSpApiSqpParseIngest,
} from './firstSqpParseIngest';
import { ingestSqpMonthlyRaw } from '../../ingest/ingestSqpMonthlyRaw';
import {
  SpApiAuthError,
  SpApiConfigError,
  SpApiRequestError,
  SpApiSqpIngestError,
  SpApiSqpPullError,
} from './types';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function parseIntegerFlag(rawValue: string, flagName: string) {
  const value = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(value)) {
    throw new SpApiSqpPullError('invalid_input', `${flagName} must be an integer`);
  }
  return value;
}

async function parseAndIngestMonthly(args: {
  reportId?: string;
  rawFilePath?: string;
  rawOutputRoot?: string;
  csvOutputRoot?: string;
  env?: NodeJS.ProcessEnv;
}) {
  const resolvedArtifact = await resolveSpApiSqpRawArtifactPath(args);
  const rawArtifact = await readSpApiSqpRawArtifact({
    inputFilePath: resolvedArtifact.inputFilePath,
  });
  const parsed = parseValidatedSpApiSqpRawArtifact({
    text: rawArtifact.text,
    filenameHint: rawArtifact.filenameHint,
  });

  if (parsed.periodType !== 'MONTH') {
    throw new SpApiSqpIngestError(
      'validation_failed',
      `SP-API monthly SQP parse+ingest requires MONTH content; received ${parsed.periodType}`
    );
  }

  const accountId = args.env?.APP_ACCOUNT_ID?.trim();
  const marketplace = args.env?.APP_MARKETPLACE?.trim();
  if (!accountId || !marketplace) {
    throw new SpApiSqpIngestError(
      'invalid_input',
      'Monthly SQP parse+ingest requires APP_ACCOUNT_ID and APP_MARKETPLACE in the local environment'
    );
  }

  const csvPath = await ensureSpApiSqpIngestCsvPath({
    rawFilePath: rawArtifact.inputFilePath,
    rawText: rawArtifact.text,
    reportId: resolvedArtifact.reportId,
    decompressed: rawArtifact.decompressed,
    outputRoot: args.csvOutputRoot,
  });
  const ingestResult = await ingestSqpMonthlyRaw(csvPath, accountId, marketplace);

  return summarizeSpApiSqpParseIngest({
    reportId: resolvedArtifact.reportId,
    inputFilePath: rawArtifact.inputFilePath,
    parsed,
    ingestResult,
  });
}

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const asin = getArg('--asin');
    const startDate = getArg('--start-date');
    const endDate = getArg('--end-date');
    const maxAttemptsRaw = getArg('--max-attempts');
    const pollIntervalRaw = getArg('--poll-interval-ms');

    if (!asin || !startDate || !endDate) {
      throw new SpApiSqpPullError(
        'invalid_input',
        'Monthly SQP real-pull CLI requires --asin <value> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>'
      );
    }

    const summary = await runFirstSpApiSqpRealPullAndIngest({
      asin,
      startDate,
      endDate,
      reportPeriod: 'MONTH',
      maxAttempts: maxAttemptsRaw ? parseIntegerFlag(maxAttemptsRaw, '--max-attempts') : undefined,
      pollIntervalMs: pollIntervalRaw ? parseIntegerFlag(pollIntervalRaw, '--poll-interval-ms') : undefined,
      env: process.env,
      parseIngestImpl: parseAndIngestMonthly,
    });

    console.log('SP-API monthly SQP real pull + ingest succeeded.');
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
      console.error(`SP-API monthly SQP real-pull error: ${error.message}`);
    } else if (error instanceof SpApiSqpIngestError) {
      console.error(`SP-API monthly SQP ingest error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`SP-API monthly SQP first real pull + ingest failed: ${error.message}`);
    } else {
      console.error('SP-API monthly SQP first real pull + ingest failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
