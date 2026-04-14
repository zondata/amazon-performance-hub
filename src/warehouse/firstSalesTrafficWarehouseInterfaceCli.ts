import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import {
  FirstReportWarehouseInterfaceError,
  runFirstSalesTrafficWarehouseAdapterInterfaceDefinition,
} from './firstSalesTrafficWarehouseInterface';

type InterfaceCliArgs = {
  reportId?: string;
  warehouseDryRunArtifactPath?: string;
};

const parseArgs = (argv: string[]): InterfaceCliArgs => {
  const args: InterfaceCliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--report-id') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseInterfaceError(
          'invalid_input',
          '--report-id requires a non-empty value'
        );
      }

      args.reportId = value;
      index += 1;
      continue;
    }

    if (token === '--warehouse-dry-run-path') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseInterfaceError(
          'invalid_input',
          '--warehouse-dry-run-path requires a non-empty value'
        );
      }

      args.warehouseDryRunArtifactPath = value;
      index += 1;
      continue;
    }

    throw new FirstReportWarehouseInterfaceError(
      'invalid_input',
      `Unknown argument: ${token}`
    );
  }

  if (!args.reportId && !args.warehouseDryRunArtifactPath) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_input',
      'Provide either --report-id <value> or --warehouse-dry-run-path <value>'
    );
  }

  return args;
};

const main = async () => {
  loadLocalEnvFiles();

  const args = parseArgs(process.argv.slice(2));
  const summary = await runFirstSalesTrafficWarehouseAdapterInterfaceDefinition(
    args
  );

  console.log('SP-API warehouse adapter interface definition complete.');
  console.log(`Report ID: ${summary.reportId}`);
  console.log(`Warehouse dry-run artifact: ${summary.warehouseDryRunArtifactPath}`);
  console.log(`Warehouse interface artifact: ${summary.warehouseInterfaceArtifactPath}`);
  console.log(
    `Warehouse adapter interface version: ${summary.warehouseAdapterInterfaceVersion}`
  );
  console.log(`Section count: ${summary.sectionCount}`);
  console.log(`Total row count: ${summary.totalRowCount}`);
  console.log(`Target tables: ${summary.targetTableNames.join(', ')}`);
  console.log(`Interface operations: ${summary.operationNames.join(', ')}`);
  console.log('Sections:');
  summary.sections.forEach((section) => {
    console.log(
      `- ${section.sectionName}: ${section.rowCount} rows (${section.targetTableName})`
    );
  });
};

main().catch((error) => {
  if (error instanceof FirstReportWarehouseInterfaceError) {
    console.error(`[spapi:define-first-report-warehouse-interface] ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
