import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import {
  FirstReportWarehouseReadyError,
  runFirstSalesTrafficWarehouseReadyContractPromotion,
} from './firstSalesTrafficWarehouseReady';

const parseCliArgs = (argv: string[]) => {
  let reportId: string | undefined;
  let canonicalIngestArtifactPath: string | undefined;

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

    if (arg === '--canonical-path') {
      canonicalIngestArtifactPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--canonical-path=')) {
      canonicalIngestArtifactPath = arg.slice('--canonical-path='.length);
      continue;
    }

    throw new FirstReportWarehouseReadyError(
      'invalid_input',
      `Unknown CLI argument: ${arg}`
    );
  }

  if (!reportId?.trim() && !canonicalIngestArtifactPath?.trim()) {
    throw new FirstReportWarehouseReadyError(
      'invalid_input',
      'The warehouse-ready promotion CLI requires --report-id <value> or --canonical-path <value>'
    );
  }

  return {
    reportId,
    canonicalIngestArtifactPath,
  };
};

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const options = parseCliArgs(process.argv.slice(2));
    const summary = await runFirstSalesTrafficWarehouseReadyContractPromotion(
      options
    );

    console.log('SP-API first report warehouse-ready promotion succeeded.');
    console.log(`Endpoint: ${summary.endpoint}`);
    console.log(`Report ID: ${summary.reportId}`);
    console.log(`Report family: ${summary.reportFamily}`);
    console.log(`Report type: ${summary.reportType}`);
    console.log(
      `Warehouse-ready contract version: ${summary.warehouseReadyContractVersion}`
    );
    console.log(`Canonical ingest artifact: ${summary.canonicalIngestArtifactPath}`);
    console.log(`Warehouse-ready artifact: ${summary.warehouseReadyArtifactPath}`);
    console.log(`Section count: ${summary.sectionCount}`);
    console.log(`Total row count: ${summary.totalRowCount}`);

    for (const section of summary.sections) {
      console.log(
        `Section ${section.sectionName}: target=${section.targetTableName}, headers=${section.headerCount}, rows=${section.rowCount}`
      );
    }
  } catch (error) {
    if (error instanceof FirstReportWarehouseReadyError) {
      console.error(`SP-API warehouse-ready promotion error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`SP-API warehouse-ready promotion failed: ${error.message}`);
    } else {
      console.error(
        'SP-API warehouse-ready promotion failed due to an unknown error.'
      );
    }

    process.exitCode = 1;
  }
}

void main();
