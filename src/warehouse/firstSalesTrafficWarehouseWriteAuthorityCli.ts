import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import {
  FirstReportWarehouseWriteAuthorityError,
  runFirstSalesTrafficWarehouseWriteAuthorityGate,
} from './firstSalesTrafficWarehouseWriteAuthority';

type WriteAuthorityCliArgs = {
  reportId?: string;
  warehouseResultContractArtifactPath?: string;
};

const parseArgs = (argv: string[]): WriteAuthorityCliArgs => {
  const args: WriteAuthorityCliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--report-id') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseWriteAuthorityError(
          'invalid_input',
          '--report-id requires a non-empty value'
        );
      }
      args.reportId = value;
      index += 1;
      continue;
    }

    if (token === '--warehouse-result-contract-path') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new FirstReportWarehouseWriteAuthorityError(
          'invalid_input',
          '--warehouse-result-contract-path requires a non-empty value'
        );
      }
      args.warehouseResultContractArtifactPath = value;
      index += 1;
      continue;
    }

    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_input',
      `Unknown argument: ${token}`
    );
  }

  if (!args.reportId && !args.warehouseResultContractArtifactPath) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_input',
      'Provide either --report-id <value> or --warehouse-result-contract-path <value>'
    );
  }

  return args;
};

const main = async () => {
  loadLocalEnvFiles();

  const args = parseArgs(process.argv.slice(2));
  const summary = await runFirstSalesTrafficWarehouseWriteAuthorityGate(args);

  console.log('SP-API warehouse write-authority gate complete.');
  console.log(`Report ID: ${summary.reportId}`);
  console.log(`Warehouse result contract artifact: ${summary.warehouseResultContractArtifactPath}`);
  console.log(`Warehouse write-authority artifact: ${summary.warehouseWriteAuthorityArtifactPath}`);
  console.log(`Warehouse write-authority version: ${summary.warehouseWriteAuthorityVersion}`);
  console.log(`Section count: ${summary.sectionCount}`);
  console.log(`Total row count: ${summary.totalRowCount}`);
  console.log(`Target tables: ${summary.targetTableNames.join(', ')}`);
  console.log(`Operation names: ${summary.operationNames.join(', ')}`);
  console.log('Gate states:');
  summary.gateStates.forEach((gateState, index) => {
    console.log(
      `- ${summary.operationNames[index]}: mode=${gateState.mode}, writesAttempted=${String(
        gateState.writesAttempted
      )}, transportCalled=${String(gateState.transportCalled)}, executionAllowed=${String(
        gateState.executionAllowed
      )}, writeAuthorityDecision=${gateState.writeAuthorityDecision}`
    );
  });
  console.log(`Decisions: ${summary.decisions.join(', ')}`);
  console.log('Sections:');
  summary.sections.forEach((section) => {
    console.log(
      `- ${section.sectionName}: ${section.rowCount} rows (${section.targetTableName})`
    );
  });
};

main().catch((error) => {
  if (error instanceof FirstReportWarehouseWriteAuthorityError) {
    console.error(
      `[spapi:gate-first-report-warehouse-write-authority] ${error.message}`
    );
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
