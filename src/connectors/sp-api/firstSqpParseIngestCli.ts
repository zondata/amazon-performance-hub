import { loadLocalEnvFiles } from './loadLocalEnv';
import { runFirstSpApiSqpParseIngest } from './firstSqpParseIngest';
import { SpApiSqpIngestError } from './types';

export const parseSpApiSqpParseIngestCliArgs = (argv: string[]) => {
  let reportId: string | undefined;
  let rawFilePath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--report-id') {
      reportId = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--report-id=')) {
      reportId = arg.slice('--report-id='.length);
      continue;
    }

    if (arg === '--raw-path') {
      rawFilePath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--raw-path=')) {
      rawFilePath = arg.slice('--raw-path='.length);
      continue;
    }

    throw new SpApiSqpIngestError(
      'invalid_input',
      `Unknown CLI argument: ${arg}`
    );
  }

  if (!reportId?.trim() && !rawFilePath?.trim()) {
    throw new SpApiSqpIngestError(
      'invalid_input',
      'The SQP parse+ingest CLI requires --report-id <value> or --raw-path <value>'
    );
  }

  return {
    reportId,
    rawFilePath,
  };
};

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const options = parseSpApiSqpParseIngestCliArgs(process.argv.slice(2));
    const summary = await runFirstSpApiSqpParseIngest(options);

    console.log('SP-API SQP parse+ingest succeeded.');
    console.log(`Endpoint: ${summary.endpoint}`);
    console.log(`Report ID: ${summary.reportId ?? 'n/a'}`);
    console.log(`Input file: ${summary.inputFilePath}`);
    console.log(`Scope type: ${summary.scopeType}`);
    console.log(`Scope value: ${summary.scopeValue}`);
    console.log(`Coverage window: ${summary.coverageStart} -> ${summary.coverageEnd}`);
    console.log(`Row count: ${summary.rowCount}`);
    console.log(`Upload ID: ${summary.uploadId ?? 'n/a'}`);
    console.log(`Warnings: ${summary.warningsCount}`);
  } catch (error) {
    if (error instanceof SpApiSqpIngestError) {
      console.error(`SP-API SQP parse+ingest error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`SP-API SQP parse+ingest failed: ${error.message}`);
    } else {
      console.error('SP-API SQP parse+ingest failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
