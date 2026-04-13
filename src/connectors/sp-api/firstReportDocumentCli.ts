import { loadLocalEnvFiles } from './loadLocalEnv';
import { fetchFirstSalesAndTrafficReportDocument } from './firstReportDocument';
import {
  SpApiAuthError,
  SpApiConfigError,
  SpApiRequestError,
} from './types';

const parseCliArgs = (argv: string[]) => {
  let reportId = '';

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

    throw new SpApiRequestError(
      'request_build_error',
      `Unknown CLI argument: ${arg}`
    );
  }

  if (!reportId.trim()) {
    throw new SpApiRequestError(
      'request_build_error',
      'The report document CLI requires --report-id <value>'
    );
  }

  return { reportId };
};

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const options = parseCliArgs(process.argv.slice(2));
    const summary = await fetchFirstSalesAndTrafficReportDocument(options);

    console.log('SP-API first report document retrieval succeeded.');
    console.log(`Endpoint: ${summary.endpoint}`);
    console.log(`Region: ${summary.region}`);
    console.log(`Marketplace ID: ${summary.marketplaceId}`);
    console.log(`Report ID: ${summary.reportId}`);
    console.log(`Processing status: ${summary.processingStatus}`);
    console.log(`Report document ID: ${summary.reportDocumentId}`);
    console.log(
      `Compression algorithm: ${summary.compressionAlgorithm ?? 'not returned'}`
    );
    console.log(`Content type: ${summary.contentType ?? 'not returned'}`);
    console.log(`Output file: ${summary.outputFilePath}`);
    console.log(`Downloaded bytes: ${summary.downloadedByteCount}`);
    console.log(`Stored bytes: ${summary.storedByteCount}`);
  } catch (error) {
    if (error instanceof SpApiConfigError) {
      console.error(`SP-API config error: ${error.message}`);
    } else if (error instanceof SpApiAuthError) {
      console.error(`SP-API auth error: ${error.message}`);
    } else if (error instanceof SpApiRequestError) {
      console.error(`SP-API request error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(
        `SP-API first report document retrieval failed: ${error.message}`
      );
    } else {
      console.error(
        'SP-API first report document retrieval failed due to an unknown error.'
      );
    }

    process.exitCode = 1;
  }
}

void main();
