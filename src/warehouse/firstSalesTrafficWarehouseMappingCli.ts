import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import {
  FirstReportWarehouseMappingError,
  runFirstSalesTrafficWarehouseAdapterPreparation,
} from './firstSalesTrafficWarehouseMapping';

const parseCliArgs = (argv: string[]) => {
  let reportId: string | undefined;
  let warehouseReadyArtifactPath: string | undefined;

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

    if (arg === '--warehouse-ready-path') {
      warehouseReadyArtifactPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--warehouse-ready-path=')) {
      warehouseReadyArtifactPath = arg.slice('--warehouse-ready-path='.length);
      continue;
    }

    throw new FirstReportWarehouseMappingError(
      'invalid_input',
      `Unknown CLI argument: ${arg}`
    );
  }

  if (!reportId?.trim() && !warehouseReadyArtifactPath?.trim()) {
    throw new FirstReportWarehouseMappingError(
      'invalid_input',
      'The warehouse adapter mapping CLI requires --report-id <value> or --warehouse-ready-path <value>'
    );
  }

  return {
    reportId,
    warehouseReadyArtifactPath,
  };
};

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const options = parseCliArgs(process.argv.slice(2));
    const summary = await runFirstSalesTrafficWarehouseAdapterPreparation(options);

    console.log('SP-API first report warehouse adapter preparation succeeded.');
    console.log(`Endpoint: ${summary.endpoint}`);
    console.log(`Report ID: ${summary.reportId}`);
    console.log(`Report family: ${summary.reportFamily}`);
    console.log(`Report type: ${summary.reportType}`);
    console.log(
      `Warehouse adapter mapping version: ${summary.warehouseAdapterMappingVersion}`
    );
    console.log(`Warehouse-ready artifact: ${summary.warehouseReadyArtifactPath}`);
    console.log(`Warehouse mapping artifact: ${summary.warehouseMappingArtifactPath}`);
    console.log(`Section count: ${summary.sectionCount}`);
    console.log(`Total row count: ${summary.totalRowCount}`);

    for (const section of summary.sections) {
      console.log(
        `Section ${section.sectionName}: target=${section.targetTableName}, headers=${section.headerCount}, rows=${section.rowCount}`
      );
    }
  } catch (error) {
    if (error instanceof FirstReportWarehouseMappingError) {
      console.error(`SP-API warehouse adapter mapping error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`SP-API warehouse adapter preparation failed: ${error.message}`);
    } else {
      console.error(
        'SP-API warehouse adapter preparation failed due to an unknown error.'
      );
    }

    process.exitCode = 1;
  }
}

void main();
