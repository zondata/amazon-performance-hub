import { loadLocalEnvFiles } from './loadLocalEnv';
import { runFirstSpApiReportHandoff } from './firstReportHandoff';
import { SpApiHandoffError } from './types';

const parseCliArgs = (argv: string[]) => {
  let reportId: string | undefined;
  let parsedArtifactPath: string | undefined;

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

    if (arg === '--parsed-path') {
      parsedArtifactPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--parsed-path=')) {
      parsedArtifactPath = arg.slice('--parsed-path='.length);
      continue;
    }

    throw new SpApiHandoffError('invalid_input', `Unknown CLI argument: ${arg}`);
  }

  if (!reportId?.trim() && !parsedArtifactPath?.trim()) {
    throw new SpApiHandoffError(
      'invalid_input',
      'The report handoff CLI requires --report-id <value> or --parsed-path <value>'
    );
  }

  return {
    reportId,
    parsedArtifactPath,
  };
};

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const options = parseCliArgs(process.argv.slice(2));
    const summary = await runFirstSpApiReportHandoff(options);

    console.log('SP-API first report handoff build succeeded.');
    console.log(`Endpoint: ${summary.endpoint}`);
    console.log(`Report ID: ${summary.reportId}`);
    console.log(`Report family: ${summary.reportFamily}`);
    console.log(`Report type: ${summary.reportType}`);
    console.log(`Schema version: ${summary.schemaVersion}`);
    console.log(`Parsed artifact: ${summary.parsedArtifactPath}`);
    console.log(`Handoff artifact: ${summary.handoffArtifactPath}`);
    console.log(`Section count: ${summary.sectionCount}`);
    console.log(`Total row count: ${summary.totalRowCount}`);

    for (const section of summary.sections) {
      console.log(
        `Section ${section.sectionName}: headers=${section.headerCount}, rows=${section.rowCount}`
      );
    }
  } catch (error) {
    if (error instanceof SpApiHandoffError) {
      console.error(`SP-API handoff error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`SP-API first report handoff failed: ${error.message}`);
    } else {
      console.error('SP-API first report handoff failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

void main();
