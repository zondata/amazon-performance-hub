import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import {
  FirstReportWarehouseResultContractError,
  runFirstSalesTrafficWarehouseAdapterResultContract,
} from './firstSalesTrafficWarehouseResultContract';

type ResultContractCliArgs = {
  reportId?: string;
  warehouseInvocationArtifactPath?: string;
};

const parseArgs = (argv: string[]): ResultContractCliArgs => {
  const args: ResultContractCliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--report-id') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseResultContractError(
          'invalid_input',
          '--report-id requires a non-empty value'
        );
      }

      args.reportId = value;
      index += 1;
      continue;
    }

    if (token === '--warehouse-invocation-path') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseResultContractError(
          'invalid_input',
          '--warehouse-invocation-path requires a non-empty value'
        );
      }

      args.warehouseInvocationArtifactPath = value;
      index += 1;
      continue;
    }

    throw new FirstReportWarehouseResultContractError(
      'invalid_input',
      `Unknown argument: ${token}`
    );
  }

  if (!args.reportId && !args.warehouseInvocationArtifactPath) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_input',
      'Provide either --report-id <value> or --warehouse-invocation-path <value>'
    );
  }

  return args;
};

const main = async () => {
  loadLocalEnvFiles();

  const args = parseArgs(process.argv.slice(2));
  const summary = await runFirstSalesTrafficWarehouseAdapterResultContract(args);

  console.log('SP-API warehouse adapter result contract complete.');
  console.log(`Report ID: ${summary.reportId}`);
  console.log(`Warehouse invocation artifact: ${summary.warehouseInvocationArtifactPath}`);
  console.log(
    `Warehouse result contract artifact: ${summary.warehouseResultContractArtifactPath}`
  );
  console.log(
    `Warehouse adapter result contract version: ${summary.warehouseAdapterResultContractVersion}`
  );
  console.log(`Section count: ${summary.sectionCount}`);
  console.log(`Total row count: ${summary.totalRowCount}`);
  console.log(`Target tables: ${summary.targetTableNames.join(', ')}`);
  console.log(`Operation names: ${summary.operationNames.join(', ')}`);
  console.log('Result states:');
  summary.resultStates.forEach((resultState, index) => {
    console.log(
      `- ${summary.operationNames[index]}: mode=${resultState.mode}, writesAttempted=${String(
        resultState.writesAttempted
      )}, transportCalled=${String(
        resultState.transportCalled
      )}, executionAllowed=${String(
        resultState.executionAllowed
      )}, resultStatus=${resultState.resultStatus}`
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
  if (error instanceof FirstReportWarehouseResultContractError) {
    console.error(
      `[spapi:build-first-report-warehouse-result-contract] ${error.message}`
    );
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
