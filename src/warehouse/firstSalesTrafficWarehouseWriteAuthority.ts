import fs from 'node:fs/promises';
import path from 'node:path';

import {
  FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
  type SpApiReportType,
} from '../connectors/sp-api';
import { FIRST_REPORT_CANONICAL_INGEST_VERSION } from '../ingestion/firstSalesTrafficCanonical';
import { FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION } from '../ingestion/firstSalesTrafficWarehouseReady';
import {
  FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION,
  type FirstReportWarehouseMappingSectionSummary,
} from './firstSalesTrafficWarehouseMapping';
import { FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION } from './firstSalesTrafficWarehouseDryRun';
import { FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION } from './firstSalesTrafficWarehouseInterface';
import { FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION } from './firstSalesTrafficWarehouseNoop';
import { FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION } from './firstSalesTrafficWarehouseInvocation';
import {
  FIRST_REPORT_WAREHOUSE_ADAPTER_RESULT_CONTRACT_VERSION,
  type FirstReportWarehouseAdapterResultContractArtifact,
} from './firstSalesTrafficWarehouseResultContract';

export const FIRST_REPORT_WAREHOUSE_WRITE_AUTHORITY_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-warehouse-write-authority'
);

export const FIRST_REPORT_WAREHOUSE_WRITE_AUTHORITY_VERSION =
  'sp-api-first-report-warehouse-write-authority/v1';

type ResultState = {
  mode: 'result_contract_only';
  writesAttempted: false;
  transportCalled: false;
  executionAllowed: false;
  resultStatus: 'blocked_no_write';
  statusReason: 'no_real_write_allowed';
};

type TargetResult = {
  sectionName: string;
  targetTableName: string;
  operationName: string;
  keyColumns: string[];
  mappedColumnCount: number;
  expectedSuccessResult: {
    resultType: 'warehouse_adapter_result_contract_success';
    requiredFields: string[];
    writesAttempted: false;
    transportCalled: false;
    executionAllowed: false;
  };
  expectedBlockedResult: {
    resultType: 'warehouse_adapter_result_contract_blocked';
    requiredFields: string[];
    resultStatus: 'blocked_no_write';
    statusReason: 'no_real_write_allowed';
    writesAttempted: false;
    transportCalled: false;
    executionAllowed: false;
  };
  resultState: ResultState;
};

type ValidatedResultContractArtifact = Omit<
  FirstReportWarehouseAdapterResultContractArtifact,
  'resultContractPayload'
> & {
  resultContractPayload: {
    mode: 'result_contract_only';
    writesAttempted: false;
    transportCalled: false;
    targetResults: TargetResult[];
  };
};

type GateState = {
  mode: 'write_authority_gate_only';
  writesAttempted: false;
  transportCalled: false;
  executionAllowed: false;
  writeAuthorityDecision: 'denied';
  decisionReason: 'no_real_write_allowed';
  authoritySource: 'local_gate_only';
};

type TargetGateDecision = {
  sectionName: string;
  targetTableName: string;
  operationName: string;
  keyColumns: string[];
  mappedColumnCount: number;
  decision: 'denied';
  decisionReason: 'no_real_write_allowed';
  requiredAuthority: 'warehouse_write_authority';
  gateState: GateState;
};

export type FirstReportWarehouseWriteAuthorityArtifact = {
  warehouseWriteAuthorityVersion: typeof FIRST_REPORT_WAREHOUSE_WRITE_AUTHORITY_VERSION;
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  lineage: {
    warehouseResultContractArtifactPath: string;
    warehouseAdapterResultContractVersion: string;
    warehouseInvocationArtifactPath: string;
    warehouseAdapterInvocationVersion: string;
    warehouseNoopArtifactPath: string;
    warehouseAdapterNoopVersion: string;
    warehouseInterfaceArtifactPath: string;
    warehouseAdapterInterfaceVersion: string;
    warehouseDryRunArtifactPath: string;
    warehouseAdapterDryRunVersion: string;
    warehouseMappingArtifactPath: string;
    warehouseAdapterMappingVersion: string;
    warehouseReadyArtifactPath: string;
    warehouseReadyContractVersion: string;
    canonicalIngestArtifactPath: string;
    canonicalIngestVersion: string;
    stagingArtifactPath: string;
    stagingVersion: string;
    handoffArtifactPath: string;
    handoffSchemaVersion: string;
    parsedArtifactPath: string;
    rawArtifactPath: string;
  };
  sections: FirstReportWarehouseMappingSectionSummary[];
  totalRowCount: number;
  writeAuthorityPayload: {
    mode: 'write_authority_gate_only';
    writesAttempted: false;
    transportCalled: false;
    targetGateDecisions: TargetGateDecision[];
  };
};

export type FirstReportWarehouseWriteAuthoritySummary = {
  endpoint: 'runFirstSalesTrafficWarehouseWriteAuthorityGate';
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  warehouseResultContractArtifactPath: string;
  warehouseWriteAuthorityArtifactPath: string;
  warehouseWriteAuthorityVersion: string;
  sectionCount: number;
  totalRowCount: number;
  targetTableNames: string[];
  operationNames: string[];
  gateStates: GateState[];
  decisions: Array<'denied'>;
  sections: FirstReportWarehouseMappingSectionSummary[];
};

export class FirstReportWarehouseWriteAuthorityError extends Error {
  readonly code:
    | 'artifact_not_found'
    | 'invalid_input'
    | 'invalid_content'
    | 'validation_failed'
    | 'write_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'artifact_not_found'
      | 'invalid_input'
      | 'invalid_content'
      | 'validation_failed'
      | 'write_failed',
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'FirstReportWarehouseWriteAuthorityError';
    this.code = code;
    this.details = details;
  }
}

const WAREHOUSE_RESULT_CONTRACT_ARTIFACT_NAME_RE =
  /^report-(?<reportId>.+)\.warehouse-result-contract\.json$/;

const asObject = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asStringArray = (value: unknown, fieldName: string) => {
  if (!Array.isArray(value)) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `${fieldName} must be an array of strings`
    );
  }

  return value.map((entry, index) => {
    const parsed = asString(entry);
    if (!parsed) {
      throw new FirstReportWarehouseWriteAuthorityError(
        'invalid_content',
        `${fieldName}[${index}] must be a non-empty string`
      );
    }
    return parsed;
  });
};

const asNonNegativeInteger = (value: unknown, fieldName: string) => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `${fieldName} must be a non-negative integer`
    );
  }
  return Number(value);
};

const parseSectionSummary = (
  value: unknown,
  index: number
): FirstReportWarehouseMappingSectionSummary => {
  const section = asObject(value);
  const sectionName = asString(section?.sectionName);
  const targetTableName = asString(section?.targetTableName);

  if (!sectionName) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `sections[${index}].sectionName must be a non-empty string`
    );
  }

  if (!targetTableName) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `sections[${index}].targetTableName must be a non-empty string`
    );
  }

  return {
    sectionName,
    headerCount: asNonNegativeInteger(section?.headerCount, `sections[${index}].headerCount`),
    rowCount: asNonNegativeInteger(section?.rowCount, `sections[${index}].rowCount`),
    targetTableName,
  };
};

const parseExpectedSuccessResult = (value: unknown, fieldName: string) => {
  const objectValue = asObject(value);
  if (!objectValue) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `${fieldName} must be an object`
    );
  }

  if (
    asString(objectValue.resultType) !==
    'warehouse_adapter_result_contract_success'
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `${fieldName}.resultType must be warehouse_adapter_result_contract_success`
    );
  }

  return {
    resultType: 'warehouse_adapter_result_contract_success' as const,
    requiredFields: asStringArray(objectValue.requiredFields, `${fieldName}.requiredFields`),
    writesAttempted: false as const,
    transportCalled: false as const,
    executionAllowed: false as const,
  };
};

const parseExpectedBlockedResult = (value: unknown, fieldName: string) => {
  const objectValue = asObject(value);
  if (!objectValue) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `${fieldName} must be an object`
    );
  }

  if (
    asString(objectValue.resultType) !==
      'warehouse_adapter_result_contract_blocked' ||
    asString(objectValue.resultStatus) !== 'blocked_no_write' ||
    asString(objectValue.statusReason) !== 'no_real_write_allowed' ||
    objectValue.writesAttempted !== false ||
    objectValue.transportCalled !== false ||
    objectValue.executionAllowed !== false
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `${fieldName} must preserve the blocked no-write result contract`
    );
  }

  return {
    resultType: 'warehouse_adapter_result_contract_blocked' as const,
    requiredFields: asStringArray(objectValue.requiredFields, `${fieldName}.requiredFields`),
    resultStatus: 'blocked_no_write' as const,
    statusReason: 'no_real_write_allowed' as const,
    writesAttempted: false as const,
    transportCalled: false as const,
    executionAllowed: false as const,
  };
};

const parseResultState = (value: unknown, fieldName: string): ResultState => {
  const objectValue = asObject(value);
  if (!objectValue) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `${fieldName} must be an object`
    );
  }

  if (
    asString(objectValue.mode) !== 'result_contract_only' ||
    objectValue.writesAttempted !== false ||
    objectValue.transportCalled !== false ||
    objectValue.executionAllowed !== false ||
    asString(objectValue.resultStatus) !== 'blocked_no_write' ||
    asString(objectValue.statusReason) !== 'no_real_write_allowed'
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `${fieldName} must preserve blocked no-write result flags`
    );
  }

  return {
    mode: 'result_contract_only',
    writesAttempted: false,
    transportCalled: false,
    executionAllowed: false,
    resultStatus: 'blocked_no_write',
    statusReason: 'no_real_write_allowed',
  };
};

const parseTargetResult = (value: unknown, index: number): TargetResult => {
  const objectValue = asObject(value);
  const sectionName = asString(objectValue?.sectionName);
  const targetTableName = asString(objectValue?.targetTableName);
  const operationName = asString(objectValue?.operationName);

  if (!sectionName) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `resultContractPayload.targetResults[${index}].sectionName must be a non-empty string`
    );
  }
  if (!targetTableName) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `resultContractPayload.targetResults[${index}].targetTableName must be a non-empty string`
    );
  }
  if (!operationName) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `resultContractPayload.targetResults[${index}].operationName must be a non-empty string`
    );
  }

  return {
    sectionName,
    targetTableName,
    operationName,
    keyColumns: asStringArray(
      objectValue?.keyColumns,
      `resultContractPayload.targetResults[${index}].keyColumns`
    ),
    mappedColumnCount: asNonNegativeInteger(
      objectValue?.mappedColumnCount,
      `resultContractPayload.targetResults[${index}].mappedColumnCount`
    ),
    expectedSuccessResult: parseExpectedSuccessResult(
      objectValue?.expectedSuccessResult,
      `resultContractPayload.targetResults[${index}].expectedSuccessResult`
    ),
    expectedBlockedResult: parseExpectedBlockedResult(
      objectValue?.expectedBlockedResult,
      `resultContractPayload.targetResults[${index}].expectedBlockedResult`
    ),
    resultState: parseResultState(
      objectValue?.resultState,
      `resultContractPayload.targetResults[${index}].resultState`
    ),
  };
};

const parseTargetResults = (value: unknown) => {
  if (!Array.isArray(value)) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      'resultContractPayload.targetResults must be an array'
    );
  }

  return value.map((entry, index) => parseTargetResult(entry, index));
};

export const buildFirstSalesTrafficWarehouseWriteAuthorityPath = (args: {
  reportId: string;
  outputRoot?: string;
}) =>
  path.resolve(
    args.outputRoot ?? FIRST_REPORT_WAREHOUSE_WRITE_AUTHORITY_OUTPUT_DIR,
    `report-${args.reportId}.warehouse-write-authority.json`
  );

export const resolveFirstSalesTrafficWarehouseResultContractArtifactPath = async (
  args: {
    reportId?: string;
    warehouseResultContractArtifactPath?: string;
    warehouseResultContractOutputRoot?: string;
  }
) => {
  if (!args.reportId && !args.warehouseResultContractArtifactPath) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_input',
      'Provide either reportId or warehouseResultContractArtifactPath'
    );
  }

  if (args.warehouseResultContractArtifactPath) {
    const resolvedPath = path.resolve(args.warehouseResultContractArtifactPath);

    let stat;
    try {
      stat = await fs.stat(resolvedPath);
    } catch {
      throw new FirstReportWarehouseWriteAuthorityError(
        'artifact_not_found',
        `Warehouse result contract artifact not found: ${resolvedPath}`
      );
    }

    if (!stat.isFile()) {
      throw new FirstReportWarehouseWriteAuthorityError(
        'invalid_input',
        `Warehouse result contract artifact path is not a file: ${resolvedPath}`
      );
    }

    const match = path.basename(resolvedPath).match(
      WAREHOUSE_RESULT_CONTRACT_ARTIFACT_NAME_RE
    );
    const derivedReportId = match?.groups?.reportId;

    if (!derivedReportId && !args.reportId) {
      throw new FirstReportWarehouseWriteAuthorityError(
        'invalid_input',
        'Explicit warehouse result contract paths must use deterministic naming or provide --report-id'
      );
    }

    if (args.reportId && derivedReportId && args.reportId !== derivedReportId) {
      throw new FirstReportWarehouseWriteAuthorityError(
        'invalid_input',
        `Report id mismatch between --report-id (${args.reportId}) and warehouse result contract path (${derivedReportId})`
      );
    }

    return {
      reportId: args.reportId ?? derivedReportId!,
      warehouseResultContractArtifactPath: resolvedPath,
    };
  }

  const reportId = args.reportId!;
  const warehouseResultContractArtifactPath = path.resolve(
    args.warehouseResultContractOutputRoot ??
      path.resolve(process.cwd(), 'out', 'sp-api-warehouse-result-contract'),
    `report-${reportId}.warehouse-result-contract.json`
  );

  try {
    const stat = await fs.stat(warehouseResultContractArtifactPath);
    if (!stat.isFile()) {
      throw new Error('not file');
    }
  } catch {
    throw new FirstReportWarehouseWriteAuthorityError(
      'artifact_not_found',
      `Warehouse result contract artifact not found for report ${reportId}: ${warehouseResultContractArtifactPath}`
    );
  }

  return { reportId, warehouseResultContractArtifactPath };
};

export const readFirstSalesTrafficWarehouseAdapterResultContractArtifact = async (
  args: { warehouseResultContractArtifactPath: string }
): Promise<ValidatedResultContractArtifact> => {
  let rawContent: string;
  try {
    rawContent = await fs.readFile(args.warehouseResultContractArtifactPath, 'utf8');
  } catch (error) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'artifact_not_found',
      `Unable to read warehouse result contract artifact: ${args.warehouseResultContractArtifactPath}`,
      error
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch (error) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `Warehouse result contract artifact is not valid JSON: ${args.warehouseResultContractArtifactPath}`,
      error
    );
  }

  const artifact = asObject(parsedJson);
  const reportId = asString(artifact?.reportId);
  const reportFamily = asString(artifact?.reportFamily);
  const reportType = asString(artifact?.reportType);

  if (
    asString(artifact?.warehouseAdapterResultContractVersion) !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_RESULT_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `warehouseAdapterResultContractVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_RESULT_CONTRACT_VERSION}`
    );
  }
  if (!reportId) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      'reportId must be a non-empty string'
    );
  }
  if (reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      'reportFamily must be sales_and_traffic'
    );
  }
  if (reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      `reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  const lineage = asObject(artifact?.lineage);
  if (!lineage) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      'lineage must be an object'
    );
  }

  const sectionsValue = artifact?.sections;
  if (!Array.isArray(sectionsValue)) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      'sections must be an array'
    );
  }
  const sections = sectionsValue.map((entry, index) => parseSectionSummary(entry, index));
  const totalRowCount = asNonNegativeInteger(artifact?.totalRowCount, 'totalRowCount');

  const resultContractPayload = asObject(artifact?.resultContractPayload);
  if (!resultContractPayload) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      'resultContractPayload must be an object'
    );
  }
  if (
    asString(resultContractPayload.mode) !== 'result_contract_only' ||
    resultContractPayload.writesAttempted !== false ||
    resultContractPayload.transportCalled !== false
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'invalid_content',
      'resultContractPayload must preserve result_contract_only blocked transport flags'
    );
  }

  const targetResults = parseTargetResults(resultContractPayload.targetResults);
  const computedTotalRowCount = sections.reduce(
    (sum, section) => sum + section.rowCount,
    0
  );
  if (computedTotalRowCount !== totalRowCount) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      `totalRowCount mismatch: expected ${computedTotalRowCount}, received ${totalRowCount}`
    );
  }
  if (sections.length !== targetResults.length) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      'sections count must match resultContractPayload.targetResults count'
    );
  }

  const sectionKeySet = new Set(
    sections.map((section) => `${section.sectionName}::${section.targetTableName}`)
  );
  for (const targetResult of targetResults) {
    const sectionKey = `${targetResult.sectionName}::${targetResult.targetTableName}`;
    if (!sectionKeySet.has(sectionKey)) {
      throw new FirstReportWarehouseWriteAuthorityError(
        'validation_failed',
        `resultContractPayload.targetResults contains unmatched section/target pair: ${sectionKey}`
      );
    }
  }

  return {
    warehouseAdapterResultContractVersion:
      FIRST_REPORT_WAREHOUSE_ADAPTER_RESULT_CONTRACT_VERSION,
    reportId,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    lineage: {
      warehouseInvocationArtifactPath:
        asString(lineage.warehouseInvocationArtifactPath) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.warehouseInvocationArtifactPath must be a non-empty string'
          );
        })(),
      warehouseAdapterInvocationVersion:
        asString(lineage.warehouseAdapterInvocationVersion) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.warehouseAdapterInvocationVersion must be a non-empty string'
          );
        })(),
      warehouseNoopArtifactPath:
        asString(lineage.warehouseNoopArtifactPath) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.warehouseNoopArtifactPath must be a non-empty string'
          );
        })(),
      warehouseAdapterNoopVersion:
        asString(lineage.warehouseAdapterNoopVersion) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.warehouseAdapterNoopVersion must be a non-empty string'
          );
        })(),
      warehouseInterfaceArtifactPath:
        asString(lineage.warehouseInterfaceArtifactPath) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.warehouseInterfaceArtifactPath must be a non-empty string'
          );
        })(),
      warehouseAdapterInterfaceVersion:
        asString(lineage.warehouseAdapterInterfaceVersion) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.warehouseAdapterInterfaceVersion must be a non-empty string'
          );
        })(),
      warehouseDryRunArtifactPath:
        asString(lineage.warehouseDryRunArtifactPath) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.warehouseDryRunArtifactPath must be a non-empty string'
          );
        })(),
      warehouseAdapterDryRunVersion:
        asString(lineage.warehouseAdapterDryRunVersion) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.warehouseAdapterDryRunVersion must be a non-empty string'
          );
        })(),
      warehouseMappingArtifactPath:
        asString(lineage.warehouseMappingArtifactPath) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.warehouseMappingArtifactPath must be a non-empty string'
          );
        })(),
      warehouseAdapterMappingVersion:
        asString(lineage.warehouseAdapterMappingVersion) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.warehouseAdapterMappingVersion must be a non-empty string'
          );
        })(),
      warehouseReadyArtifactPath:
        asString(lineage.warehouseReadyArtifactPath) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.warehouseReadyArtifactPath must be a non-empty string'
          );
        })(),
      warehouseReadyContractVersion:
        asString(lineage.warehouseReadyContractVersion) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.warehouseReadyContractVersion must be a non-empty string'
          );
        })(),
      canonicalIngestArtifactPath:
        asString(lineage.canonicalIngestArtifactPath) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.canonicalIngestArtifactPath must be a non-empty string'
          );
        })(),
      canonicalIngestVersion:
        asString(lineage.canonicalIngestVersion) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.canonicalIngestVersion must be a non-empty string'
          );
        })(),
      stagingArtifactPath:
        asString(lineage.stagingArtifactPath) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.stagingArtifactPath must be a non-empty string'
          );
        })(),
      stagingVersion:
        asString(lineage.stagingVersion) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.stagingVersion must be a non-empty string'
          );
        })(),
      handoffArtifactPath:
        asString(lineage.handoffArtifactPath) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.handoffArtifactPath must be a non-empty string'
          );
        })(),
      handoffSchemaVersion:
        asString(lineage.handoffSchemaVersion) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.handoffSchemaVersion must be a non-empty string'
          );
        })(),
      parsedArtifactPath:
        asString(lineage.parsedArtifactPath) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.parsedArtifactPath must be a non-empty string'
          );
        })(),
      rawArtifactPath:
        asString(lineage.rawArtifactPath) ??
        (() => {
          throw new FirstReportWarehouseWriteAuthorityError(
            'invalid_content',
            'lineage.rawArtifactPath must be a non-empty string'
          );
        })(),
    },
    sections,
    totalRowCount,
    resultContractPayload: {
      mode: 'result_contract_only',
      writesAttempted: false,
      transportCalled: false,
      targetResults,
    },
  };
};

export const buildFirstSalesTrafficWarehouseWriteAuthority = (args: {
  resultContractArtifact: ValidatedResultContractArtifact;
  warehouseResultContractArtifactPath: string;
}): FirstReportWarehouseWriteAuthorityArtifact => {
  const { resultContractArtifact, warehouseResultContractArtifactPath } = args;

  if (
    resultContractArtifact.warehouseAdapterResultContractVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_RESULT_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      `Expected warehouseAdapterResultContractVersion ${FIRST_REPORT_WAREHOUSE_ADAPTER_RESULT_CONTRACT_VERSION}`
    );
  }
  if (
    resultContractArtifact.lineage.warehouseAdapterInvocationVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      `Expected warehouseAdapterInvocationVersion ${FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION}`
    );
  }
  if (
    resultContractArtifact.lineage.warehouseAdapterNoopVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      `Expected warehouseAdapterNoopVersion ${FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION}`
    );
  }
  if (
    resultContractArtifact.lineage.warehouseAdapterInterfaceVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      `Expected warehouseAdapterInterfaceVersion ${FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION}`
    );
  }
  if (
    resultContractArtifact.lineage.warehouseAdapterDryRunVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      `Expected warehouseAdapterDryRunVersion ${FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION}`
    );
  }
  if (
    resultContractArtifact.lineage.warehouseAdapterMappingVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      `Expected warehouseAdapterMappingVersion ${FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION}`
    );
  }
  if (
    resultContractArtifact.lineage.warehouseReadyContractVersion !==
    FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      `Expected warehouseReadyContractVersion ${FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION}`
    );
  }
  if (
    resultContractArtifact.lineage.canonicalIngestVersion !==
    FIRST_REPORT_CANONICAL_INGEST_VERSION
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      `Expected canonicalIngestVersion ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  const targetGateDecisions = resultContractArtifact.resultContractPayload.targetResults.map(
    (targetResult) => ({
      sectionName: targetResult.sectionName,
      targetTableName: targetResult.targetTableName,
      operationName: targetResult.operationName,
      keyColumns: [...targetResult.keyColumns],
      mappedColumnCount: targetResult.mappedColumnCount,
      decision: 'denied' as const,
      decisionReason: 'no_real_write_allowed' as const,
      requiredAuthority: 'warehouse_write_authority' as const,
      gateState: {
        mode: 'write_authority_gate_only' as const,
        writesAttempted: false as const,
        transportCalled: false as const,
        executionAllowed: false as const,
        writeAuthorityDecision: 'denied' as const,
        decisionReason: 'no_real_write_allowed' as const,
        authoritySource: 'local_gate_only' as const,
      },
    })
  );

  return {
    warehouseWriteAuthorityVersion: FIRST_REPORT_WAREHOUSE_WRITE_AUTHORITY_VERSION,
    reportId: resultContractArtifact.reportId,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    lineage: {
      warehouseResultContractArtifactPath,
      warehouseAdapterResultContractVersion:
        resultContractArtifact.warehouseAdapterResultContractVersion,
      warehouseInvocationArtifactPath:
        resultContractArtifact.lineage.warehouseInvocationArtifactPath,
      warehouseAdapterInvocationVersion:
        resultContractArtifact.lineage.warehouseAdapterInvocationVersion,
      warehouseNoopArtifactPath:
        resultContractArtifact.lineage.warehouseNoopArtifactPath,
      warehouseAdapterNoopVersion:
        resultContractArtifact.lineage.warehouseAdapterNoopVersion,
      warehouseInterfaceArtifactPath:
        resultContractArtifact.lineage.warehouseInterfaceArtifactPath,
      warehouseAdapterInterfaceVersion:
        resultContractArtifact.lineage.warehouseAdapterInterfaceVersion,
      warehouseDryRunArtifactPath:
        resultContractArtifact.lineage.warehouseDryRunArtifactPath,
      warehouseAdapterDryRunVersion:
        resultContractArtifact.lineage.warehouseAdapterDryRunVersion,
      warehouseMappingArtifactPath:
        resultContractArtifact.lineage.warehouseMappingArtifactPath,
      warehouseAdapterMappingVersion:
        resultContractArtifact.lineage.warehouseAdapterMappingVersion,
      warehouseReadyArtifactPath:
        resultContractArtifact.lineage.warehouseReadyArtifactPath,
      warehouseReadyContractVersion:
        resultContractArtifact.lineage.warehouseReadyContractVersion,
      canonicalIngestArtifactPath:
        resultContractArtifact.lineage.canonicalIngestArtifactPath,
      canonicalIngestVersion: resultContractArtifact.lineage.canonicalIngestVersion,
      stagingArtifactPath: resultContractArtifact.lineage.stagingArtifactPath,
      stagingVersion: resultContractArtifact.lineage.stagingVersion,
      handoffArtifactPath: resultContractArtifact.lineage.handoffArtifactPath,
      handoffSchemaVersion: resultContractArtifact.lineage.handoffSchemaVersion,
      parsedArtifactPath: resultContractArtifact.lineage.parsedArtifactPath,
      rawArtifactPath: resultContractArtifact.lineage.rawArtifactPath,
    },
    sections: resultContractArtifact.sections.map((section) => ({ ...section })),
    totalRowCount: resultContractArtifact.totalRowCount,
    writeAuthorityPayload: {
      mode: 'write_authority_gate_only',
      writesAttempted: false,
      transportCalled: false,
      targetGateDecisions,
    },
  };
};

export const validateFirstSalesTrafficWarehouseWriteAuthority = (args: {
  writeAuthorityArtifact: FirstReportWarehouseWriteAuthorityArtifact;
}) => {
  const artifact = args.writeAuthorityArtifact;

  if (!artifact.warehouseWriteAuthorityVersion) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      'warehouseWriteAuthorityVersion is required'
    );
  }
  if (!artifact.reportId || !artifact.reportFamily || !artifact.reportType) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      'reportId, reportFamily, and reportType are required'
    );
  }
  if (!artifact.lineage) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      'lineage is required'
    );
  }
  if (!Array.isArray(artifact.sections) || artifact.sections.length === 0) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      'sections must be a non-empty array'
    );
  }
  if (!artifact.writeAuthorityPayload) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      'writeAuthorityPayload is required'
    );
  }
  if (
    artifact.writeAuthorityPayload.mode !== 'write_authority_gate_only' ||
    artifact.writeAuthorityPayload.writesAttempted !== false ||
    artifact.writeAuthorityPayload.transportCalled !== false
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      'writeAuthorityPayload must preserve write_authority_gate_only blocked transport flags'
    );
  }
  if (
    artifact.writeAuthorityPayload.targetGateDecisions.length !== artifact.sections.length
  ) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      'sections count must match writeAuthorityPayload.targetGateDecisions count'
    );
  }

  const computedTotalRowCount = artifact.sections.reduce(
    (sum, section) => sum + section.rowCount,
    0
  );
  if (computedTotalRowCount !== artifact.totalRowCount) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      `totalRowCount mismatch: expected ${computedTotalRowCount}, received ${artifact.totalRowCount}`
    );
  }

  const sectionKeySet = new Set(
    artifact.sections.map((section) => `${section.sectionName}::${section.targetTableName}`)
  );
  for (const targetGateDecision of artifact.writeAuthorityPayload.targetGateDecisions) {
    const sectionKey = `${targetGateDecision.sectionName}::${targetGateDecision.targetTableName}`;
    if (!sectionKeySet.has(sectionKey)) {
      throw new FirstReportWarehouseWriteAuthorityError(
        'validation_failed',
        `writeAuthorityPayload.targetGateDecisions contains unmatched section/target pair: ${sectionKey}`
      );
    }
    if (
      targetGateDecision.gateState.mode !== 'write_authority_gate_only' ||
      targetGateDecision.gateState.writesAttempted !== false ||
      targetGateDecision.gateState.transportCalled !== false ||
      targetGateDecision.gateState.executionAllowed !== false ||
      targetGateDecision.gateState.writeAuthorityDecision !== 'denied' ||
      targetGateDecision.gateState.decisionReason !== 'no_real_write_allowed' ||
      targetGateDecision.gateState.authoritySource !== 'local_gate_only'
    ) {
      throw new FirstReportWarehouseWriteAuthorityError(
        'validation_failed',
        'writeAuthorityPayload.targetGateDecisions must preserve denied no-write gate flags'
      );
    }
  }
};

export const writeFirstSalesTrafficWarehouseWriteAuthority = async (args: {
  writeAuthorityArtifact: FirstReportWarehouseWriteAuthorityArtifact;
  outputRoot?: string;
}) => {
  validateFirstSalesTrafficWarehouseWriteAuthority({
    writeAuthorityArtifact: args.writeAuthorityArtifact,
  });

  const artifactPath = buildFirstSalesTrafficWarehouseWriteAuthorityPath({
    reportId: args.writeAuthorityArtifact.reportId,
    outputRoot: args.outputRoot,
  });

  try {
    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(
      artifactPath,
      JSON.stringify(args.writeAuthorityArtifact, null, 2),
      'utf8'
    );
  } catch (error) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'write_failed',
      `Unable to write warehouse write-authority artifact: ${artifactPath}`,
      error
    );
  }

  return artifactPath;
};

export const summarizeFirstSalesTrafficWarehouseWriteAuthority = (args: {
  writeAuthorityArtifact: FirstReportWarehouseWriteAuthorityArtifact;
  warehouseResultContractArtifactPath: string;
  warehouseWriteAuthorityArtifactPath: string;
}): FirstReportWarehouseWriteAuthoritySummary => ({
  endpoint: 'runFirstSalesTrafficWarehouseWriteAuthorityGate',
  reportId: args.writeAuthorityArtifact.reportId,
  reportFamily: args.writeAuthorityArtifact.reportFamily,
  reportType: args.writeAuthorityArtifact.reportType,
  warehouseResultContractArtifactPath: args.warehouseResultContractArtifactPath,
  warehouseWriteAuthorityArtifactPath: args.warehouseWriteAuthorityArtifactPath,
  warehouseWriteAuthorityVersion: args.writeAuthorityArtifact.warehouseWriteAuthorityVersion,
  sectionCount: args.writeAuthorityArtifact.sections.length,
  totalRowCount: args.writeAuthorityArtifact.totalRowCount,
  targetTableNames: args.writeAuthorityArtifact.sections.map(
    (section) => section.targetTableName
  ),
  operationNames: args.writeAuthorityArtifact.writeAuthorityPayload.targetGateDecisions.map(
    (targetGateDecision) => targetGateDecision.operationName
  ),
  gateStates: args.writeAuthorityArtifact.writeAuthorityPayload.targetGateDecisions.map(
    (targetGateDecision) => targetGateDecision.gateState
  ),
  decisions: args.writeAuthorityArtifact.writeAuthorityPayload.targetGateDecisions.map(
    (targetGateDecision) => targetGateDecision.decision
  ),
  sections: args.writeAuthorityArtifact.sections,
});

export const runFirstSalesTrafficWarehouseWriteAuthorityGate = async (args: {
  reportId?: string;
  warehouseResultContractArtifactPath?: string;
  warehouseResultContractOutputRoot?: string;
  warehouseWriteAuthorityOutputRoot?: string;
}) => {
  const { reportId, warehouseResultContractArtifactPath } =
    await resolveFirstSalesTrafficWarehouseResultContractArtifactPath(args);
  const resultContractArtifact =
    await readFirstSalesTrafficWarehouseAdapterResultContractArtifact({
      warehouseResultContractArtifactPath,
    });

  if (resultContractArtifact.reportId !== reportId) {
    throw new FirstReportWarehouseWriteAuthorityError(
      'validation_failed',
      `Resolved report id ${reportId} does not match artifact report id ${resultContractArtifact.reportId}`
    );
  }

  const writeAuthorityArtifact = buildFirstSalesTrafficWarehouseWriteAuthority({
    resultContractArtifact,
    warehouseResultContractArtifactPath,
  });
  const warehouseWriteAuthorityArtifactPath =
    await writeFirstSalesTrafficWarehouseWriteAuthority({
      writeAuthorityArtifact,
      outputRoot: args.warehouseWriteAuthorityOutputRoot,
    });

  return summarizeFirstSalesTrafficWarehouseWriteAuthority({
    writeAuthorityArtifact,
    warehouseResultContractArtifactPath,
    warehouseWriteAuthorityArtifactPath,
  });
};
