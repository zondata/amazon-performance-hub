import { loadLocalEnvFiles } from './loadLocalEnv';
import { parseFirstSalesAndTrafficReportContent } from './firstReportParser';
import { SpApiParseError } from './types';

const parseCliArgs = (argv: string[]) => {
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

    throw new SpApiParseError(
      'invalid_input',
      `Unknown CLI argument: ${arg}`
    );
  }

  if (!reportId?.trim() && !rawFilePath?.trim()) {
    throw new SpApiParseError(
      'invalid_input',
      'The report parser CLI requires --report-id <value> or --raw-path <value>'
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

    const options = parseCliArgs(process.argv.slice(2));
    const summary = await parseFirstSalesAndTrafficReportContent(options);

    console.log('SP-API first report parsing succeeded.');
    console.log(`Endpoint: ${summary.endpoint}`);
    console.log(`Report ID: ${summary.reportId}`);
    console.log(`Input file: ${summary.inputFilePath}`);
    console.log(`Detected format: ${summary.detectedFormat}`);
    console.log(`Decompressed: ${summary.decompressed ? 'yes' : 'no'}`);
    console.log(`Section count: ${summary.sectionCount}`);
    console.log(`Total row count: ${summary.totalRowCount}`);
    console.log(`Parsed artifact: ${summary.parsedArtifactPath}`);

    for (const section of summary.sections) {
      console.log(
        `Section ${section.sectionName}: headers=${section.headerCount}, rows=${section.rowCount}`
      );
    }
  } catch (error) {
    if (error instanceof SpApiParseError) {
      console.error(`SP-API parse error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`SP-API first report parsing failed: ${error.message}`);
    } else {
      console.error('SP-API first report parsing failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

void main();
