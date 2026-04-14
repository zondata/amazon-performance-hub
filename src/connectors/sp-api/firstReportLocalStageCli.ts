import { loadLocalEnvFiles } from './loadLocalEnv';
import { runFirstSpApiLocalStageIngestion } from './firstReportLocalStage';
import { SpApiLocalStageError } from './types';

const parseCliArgs = (argv: string[]) => {
  let reportId: string | undefined;
  let handoffArtifactPath: string | undefined;

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

    if (arg === '--handoff-path') {
      handoffArtifactPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--handoff-path=')) {
      handoffArtifactPath = arg.slice('--handoff-path='.length);
      continue;
    }

    throw new SpApiLocalStageError('invalid_input', `Unknown CLI argument: ${arg}`);
  }

  if (!reportId?.trim() && !handoffArtifactPath?.trim()) {
    throw new SpApiLocalStageError(
      'invalid_input',
      'The local stage ingestion CLI requires --report-id <value> or --handoff-path <value>'
    );
  }

  return {
    reportId,
    handoffArtifactPath,
  };
};

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const options = parseCliArgs(process.argv.slice(2));
    const summary = await runFirstSpApiLocalStageIngestion(options);

    console.log('SP-API first report local staging ingestion succeeded.');
    console.log(`Endpoint: ${summary.endpoint}`);
    console.log(`Report ID: ${summary.reportId}`);
    console.log(`Report family: ${summary.reportFamily}`);
    console.log(`Report type: ${summary.reportType}`);
    console.log(`Staging version: ${summary.stagingVersion}`);
    console.log(`Handoff artifact: ${summary.handoffArtifactPath}`);
    console.log(`Staging artifact: ${summary.stagingArtifactPath}`);
    console.log(`Section count: ${summary.sectionCount}`);
    console.log(`Total row count: ${summary.totalRowCount}`);

    for (const section of summary.sections) {
      console.log(
        `Section ${section.sectionName}: headers=${section.headerCount}, rows=${section.rowCount}`
      );
    }
  } catch (error) {
    if (error instanceof SpApiLocalStageError) {
      console.error(`SP-API local stage error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`SP-API first report local staging ingestion failed: ${error.message}`);
    } else {
      console.error(
        'SP-API first report local staging ingestion failed due to an unknown error.'
      );
    }

    process.exitCode = 1;
  }
}

void main();
