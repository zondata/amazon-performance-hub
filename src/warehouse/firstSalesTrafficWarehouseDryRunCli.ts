import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import {
  FirstReportWarehouseDryRunError,
  runFirstSalesTrafficWarehouseAdapterDryRun,
} from './firstSalesTrafficWarehouseDryRun';

type DryRunCliArgs = {
  reportId?: string;
  warehouseReadyArtifactPath?: string;
  warehouseMappingArtifactPath?: string;
};

const parseArgs = (argv: string[]): DryRunCliArgs => {
  const args: DryRunCliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--report-id') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseDryRunError(
          'invalid_input',
          '--report-id requires a non-empty value'
        );
      }

      args.reportId = value;
      index += 1;
      continue;
    }

    if (token === '--warehouse-ready-path') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseDryRunError(
          'invalid_input',
          '--warehouse-ready-path requires a non-empty value'
        );
      }

      args.warehouseReadyArtifactPath = value;
      index += 1;
      continue;
    }

    if (token === '--warehouse-mapping-path') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseDryRunError(
          'invalid_input',
          '--warehouse-mapping-path requires a non-empty value'
        );
      }

      args.warehouseMappingArtifactPath = value;
      index += 1;
      continue;
    }

    throw new FirstReportWarehouseDryRunError(
      'invalid_input',
      `Unknown argument: ${token}`
    );
  }

  if (args.reportId) {
    return args;
  }

  if (!args.warehouseReadyArtifactPath || !args.warehouseMappingArtifactPath) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_input',
      'Provide either --report-id <value> or both --warehouse-ready-path <value> and --warehouse-mapping-path <value>'
    );
  }

  return args;
};

const main = async () => {
  loadLocalEnvFiles();

  const args = parseArgs(process.argv.slice(2));
  const summary = await runFirstSalesTrafficWarehouseAdapterDryRun(args);

  console.log('SP-API warehouse adapter dry-run execution complete.');
  console.log(`Report ID: ${summary.reportId}`);
  console.log(`Warehouse-ready artifact: ${summary.warehouseReadyArtifactPath}`);
  console.log(`Warehouse-mapping artifact: ${summary.warehouseMappingArtifactPath}`);
  console.log(`Dry-run artifact: ${summary.warehouseDryRunArtifactPath}`);
  console.log(
    `Warehouse adapter dry-run version: ${summary.warehouseAdapterDryRunVersion}`
  );
  console.log(`Section count: ${summary.sectionCount}`);
  console.log(`Total row count: ${summary.totalRowCount}`);
  console.log(`Target tables: ${summary.targetTableNames.join(', ')}`);
  console.log('Sections:');
  summary.sections.forEach((section) => {
    console.log(
      `- ${section.sectionName}: ${section.rowCount} rows (${section.targetTableName})`
    );
  });
};

main().catch((error) => {
  if (error instanceof FirstReportWarehouseDryRunError) {
    console.error(`[spapi:dry-run-first-report-warehouse-adapter] ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
