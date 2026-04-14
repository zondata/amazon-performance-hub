import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import {
  FirstReportWarehouseInvocationError,
  runFirstSalesTrafficWarehouseAdapterInvocation,
} from './firstSalesTrafficWarehouseInvocation';

type InvocationCliArgs = {
  reportId?: string;
  warehouseNoopArtifactPath?: string;
};

const parseArgs = (argv: string[]): InvocationCliArgs => {
  const args: InvocationCliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--report-id') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseInvocationError(
          'invalid_input',
          '--report-id requires a non-empty value'
        );
      }

      args.reportId = value;
      index += 1;
      continue;
    }

    if (token === '--warehouse-noop-path') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseInvocationError(
          'invalid_input',
          '--warehouse-noop-path requires a non-empty value'
        );
      }

      args.warehouseNoopArtifactPath = value;
      index += 1;
      continue;
    }

    throw new FirstReportWarehouseInvocationError(
      'invalid_input',
      `Unknown argument: ${token}`
    );
  }

  if (!args.reportId && !args.warehouseNoopArtifactPath) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_input',
      'Provide either --report-id <value> or --warehouse-noop-path <value>'
    );
  }

  return args;
};

const main = async () => {
  loadLocalEnvFiles();

  const args = parseArgs(process.argv.slice(2));
  const summary = await runFirstSalesTrafficWarehouseAdapterInvocation(args);

  console.log('SP-API warehouse adapter invocation boundary complete.');
  console.log(`Report ID: ${summary.reportId}`);
  console.log(`Warehouse noop artifact: ${summary.warehouseNoopArtifactPath}`);
  console.log(`Warehouse invocation artifact: ${summary.warehouseInvocationArtifactPath}`);
  console.log(
    `Warehouse adapter invocation version: ${summary.warehouseAdapterInvocationVersion}`
  );
  console.log(`Section count: ${summary.sectionCount}`);
  console.log(`Total row count: ${summary.totalRowCount}`);
  console.log(`Target tables: ${summary.targetTableNames.join(', ')}`);
  console.log(`Operation names: ${summary.operationNames.join(', ')}`);
  console.log('Invocation states:');
  summary.invocationStates.forEach((invocationState, index) => {
    console.log(
      `- ${summary.operationNames[index]}: mode=${invocationState.mode}, writesAttempted=${String(
        invocationState.writesAttempted
      )}, transportCalled=${String(
        invocationState.transportCalled
      )}, executionAllowed=${String(
        invocationState.executionAllowed
      )}, invocationResult=${invocationState.invocationResult}`
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
  if (error instanceof FirstReportWarehouseInvocationError) {
    console.error(`[spapi:invoke-first-report-warehouse-adapter] ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
