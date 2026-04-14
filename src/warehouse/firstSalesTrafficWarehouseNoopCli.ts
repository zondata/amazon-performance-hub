import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import {
  FirstReportWarehouseNoopError,
  runFirstSalesTrafficWarehouseAdapterNoopImplementation,
} from './firstSalesTrafficWarehouseNoop';

type NoopCliArgs = {
  reportId?: string;
  warehouseInterfaceArtifactPath?: string;
};

const parseArgs = (argv: string[]): NoopCliArgs => {
  const args: NoopCliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--report-id') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseNoopError(
          'invalid_input',
          '--report-id requires a non-empty value'
        );
      }

      args.reportId = value;
      index += 1;
      continue;
    }

    if (token === '--warehouse-interface-path') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseNoopError(
          'invalid_input',
          '--warehouse-interface-path requires a non-empty value'
        );
      }

      args.warehouseInterfaceArtifactPath = value;
      index += 1;
      continue;
    }

    throw new FirstReportWarehouseNoopError(
      'invalid_input',
      `Unknown argument: ${token}`
    );
  }

  if (!args.reportId && !args.warehouseInterfaceArtifactPath) {
    throw new FirstReportWarehouseNoopError(
      'invalid_input',
      'Provide either --report-id <value> or --warehouse-interface-path <value>'
    );
  }

  return args;
};

const main = async () => {
  loadLocalEnvFiles();

  const args = parseArgs(process.argv.slice(2));
  const summary = await runFirstSalesTrafficWarehouseAdapterNoopImplementation(
    args
  );

  console.log('SP-API warehouse adapter noop implementation complete.');
  console.log(`Report ID: ${summary.reportId}`);
  console.log(`Warehouse interface artifact: ${summary.warehouseInterfaceArtifactPath}`);
  console.log(`Warehouse noop artifact: ${summary.warehouseNoopArtifactPath}`);
  console.log(`Warehouse adapter noop version: ${summary.warehouseAdapterNoopVersion}`);
  console.log(`Section count: ${summary.sectionCount}`);
  console.log(`Total row count: ${summary.totalRowCount}`);
  console.log(`Target tables: ${summary.targetTableNames.join(', ')}`);
  console.log(`Operation names: ${summary.operationNames.join(', ')}`);
  console.log('Execution states:');
  summary.executionStates.forEach((executionState, index) => {
    console.log(
      `- ${summary.operationNames[index]}: mode=${executionState.mode}, writesAttempted=${String(
        executionState.writesAttempted
      )}, implementationPresent=${String(
        executionState.implementationPresent
      )}, executionAllowed=${String(
        executionState.executionAllowed
      )}, executionResult=${executionState.executionResult}`
    );
  });
  console.log('Sections:');
  summary.sections.forEach((section) => {
    console.log(
      `- ${section.sectionName}: ${section.rowCount} rows (${section.targetTableName})`
    );
  });
};

main().catch((error) => {
  if (error instanceof FirstReportWarehouseNoopError) {
    console.error(`[spapi:build-first-report-warehouse-noop] ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
