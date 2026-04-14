import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import {
  FirstReportCanonicalIngestError,
  runFirstSalesTrafficCanonicalIngestBoundary,
} from './firstSalesTrafficCanonical';

const parseCliArgs = (argv: string[]) => {
  let reportId: string | undefined;
  let stagingArtifactPath: string | undefined;

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

    if (arg === '--staging-path') {
      stagingArtifactPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--staging-path=')) {
      stagingArtifactPath = arg.slice('--staging-path='.length);
      continue;
    }

    throw new FirstReportCanonicalIngestError(
      'invalid_input',
      `Unknown CLI argument: ${arg}`
    );
  }

  if (!reportId?.trim() && !stagingArtifactPath?.trim()) {
    throw new FirstReportCanonicalIngestError(
      'invalid_input',
      'The canonical ingest CLI requires --report-id <value> or --staging-path <value>'
    );
  }

  return {
    reportId,
    stagingArtifactPath,
  };
};

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const options = parseCliArgs(process.argv.slice(2));
    const summary = await runFirstSalesTrafficCanonicalIngestBoundary(options);

    console.log('SP-API first report canonical ingest boundary succeeded.');
    console.log(`Endpoint: ${summary.endpoint}`);
    console.log(`Report ID: ${summary.reportId}`);
    console.log(`Report family: ${summary.reportFamily}`);
    console.log(`Report type: ${summary.reportType}`);
    console.log(`Canonical ingest version: ${summary.canonicalIngestVersion}`);
    console.log(`Staging artifact: ${summary.stagingArtifactPath}`);
    console.log(`Canonical ingest artifact: ${summary.canonicalIngestArtifactPath}`);
    console.log(`Section count: ${summary.sectionCount}`);
    console.log(`Total row count: ${summary.totalRowCount}`);

    for (const section of summary.sections) {
      console.log(
        `Section ${section.sectionName}: headers=${section.headerCount}, rows=${section.rowCount}`
      );
    }
  } catch (error) {
    if (error instanceof FirstReportCanonicalIngestError) {
      console.error(`SP-API canonical ingest error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`SP-API canonical ingest boundary failed: ${error.message}`);
    } else {
      console.error('SP-API canonical ingest boundary failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

void main();
