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
import {
  FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION,
  type FirstReportWarehouseAdapterInvocationArtifact,
} from './firstSalesTrafficWarehouseInvocation';

export const FIRST_REPORT_WAREHOUSE_RESULT_CONTRACT_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-warehouse-result-contract'
);

export const FIRST_REPORT_WAREHOUSE_ADAPTER_RESULT_CONTRACT_VERSION =
  'sp-api-first-report-warehouse-adapter-result-contract/v1';

type InvocationState = {
  mode: 'invocation_boundary_only';
  writesAttempted: false;
  transportCalled: false;
  executionAllowed: false;
  invocationResult: 'blocked_no_write';
  blockReason: 'no_real_write_allowed';
};

type TargetInvocation = {
  sectionName: string;
  targetTableName: string;
  operationName: string;
  keyColumns: string[];
  mappedColumnCount: number;
  requestEnvelope: {
    acceptedArtifactType: 'warehouse_adapter_noop_artifact';
    acceptedArtifactVersion: string;
    requiredFields: string[];
    acceptedMode: 'noop';
    acceptedOperationName: string;
  };
  responseEnvelope: {
    resultType: 'warehouse_adapter_invocation_result';
    status: 'blocked_no_write';
    requiredFields: string[];
    writesAttempted: false;
    transportCalled: false;
    executionAllowed: false;
  };
  invocationState: InvocationState;
};

type ValidatedInvocationArtifact = Omit<
  FirstReportWarehouseAdapterInvocationArtifact,
  'invocationPayload'
> & {
  invocationPayload: {
    mode: 'invocation_boundary_only';
    writesAttempted: false;
    transportCalled: false;
    targetInvocations: TargetInvocation[];
  };
};

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

export type FirstReportWarehouseAdapterResultContractArtifact = {
  warehouseAdapterResultContractVersion: typeof FIRST_REPORT_WAREHOUSE_ADAPTER_RESULT_CONTRACT_VERSION;
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  lineage: {
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
  resultContractPayload: {
    mode: 'result_contract_only';
    writesAttempted: false;
    transportCalled: false;
    targetResults: TargetResult[];
  };
};

export type FirstReportWarehouseAdapterResultContractSummary = {
  endpoint: 'runFirstSalesTrafficWarehouseAdapterResultContract';
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  warehouseInvocationArtifactPath: string;
  warehouseResultContractArtifactPath: string;
  warehouseAdapterResultContractVersion: string;
  sectionCount: number;
  totalRowCount: number;
  targetTableNames: string[];
  operationNames: string[];
  resultStates: ResultState[];
  sections: FirstReportWarehouseMappingSectionSummary[];
};

export class FirstReportWarehouseResultContractError extends Error {
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
    this.name = 'FirstReportWarehouseResultContractError';
    this.code = code;
    this.details = details;
  }
}

const WAREHOUSE_INVOCATION_ARTIFACT_NAME_RE =
  /^report-(?<reportId>.+)\.warehouse-invocation\.json$/;

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
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `${fieldName} must be an array of strings`
    );
  }

  return value.map((entry, index) => {
    const parsed = asString(entry);
    if (!parsed) {
      throw new FirstReportWarehouseResultContractError(
        'invalid_content',
        `${fieldName}[${index}] must be a non-empty string`
      );
    }

    return parsed;
  });
};

const asNonNegativeInteger = (value: unknown, fieldName: string) => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new FirstReportWarehouseResultContractError(
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
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `sections[${index}].sectionName must be a non-empty string`
    );
  }

  if (!targetTableName) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `sections[${index}].targetTableName must be a non-empty string`
    );
  }

  return {
    sectionName,
    headerCount: asNonNegativeInteger(
      section?.headerCount,
      `sections[${index}].headerCount`
    ),
    rowCount: asNonNegativeInteger(
      section?.rowCount,
      `sections[${index}].rowCount`
    ),
    targetTableName,
  };
};

const parseTargetInvocation = (
  value: unknown,
  index: number
): TargetInvocation => {
  const targetInvocation = asObject(value);
  const sectionName = asString(targetInvocation?.sectionName);
  const targetTableName = asString(targetInvocation?.targetTableName);
  const operationName = asString(targetInvocation?.operationName);
  const requestEnvelope = asObject(targetInvocation?.requestEnvelope);
  const responseEnvelope = asObject(targetInvocation?.responseEnvelope);
  const invocationState = asObject(targetInvocation?.invocationState);

  if (!sectionName || !targetTableName || !operationName) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `invocationPayload.targetInvocations[${index}] must include sectionName, targetTableName, and operationName`
    );
  }

  if (!requestEnvelope || !responseEnvelope || !invocationState) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `invocationPayload.targetInvocations[${index}] must include requestEnvelope, responseEnvelope, and invocationState`
    );
  }

  if (requestEnvelope.acceptedArtifactType !== 'warehouse_adapter_noop_artifact') {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `invocationPayload.targetInvocations[${index}].requestEnvelope.acceptedArtifactType must be warehouse_adapter_noop_artifact`
    );
  }

  if (requestEnvelope.acceptedMode !== 'noop') {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `invocationPayload.targetInvocations[${index}].requestEnvelope.acceptedMode must be noop`
    );
  }

  if (
    responseEnvelope.resultType !== 'warehouse_adapter_invocation_result' ||
    responseEnvelope.status !== 'blocked_no_write' ||
    responseEnvelope.writesAttempted !== false ||
    responseEnvelope.transportCalled !== false ||
    responseEnvelope.executionAllowed !== false
  ) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `invocationPayload.targetInvocations[${index}].responseEnvelope must match the V2-16 invocation contract`
    );
  }

  if (
    invocationState.mode !== 'invocation_boundary_only' ||
    invocationState.writesAttempted !== false ||
    invocationState.transportCalled !== false ||
    invocationState.executionAllowed !== false ||
    invocationState.invocationResult !== 'blocked_no_write' ||
    invocationState.blockReason !== 'no_real_write_allowed'
  ) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `invocationPayload.targetInvocations[${index}].invocationState must be invocation_boundary_only with blocked writes`
    );
  }

  return {
    sectionName,
    targetTableName,
    operationName,
    keyColumns: asStringArray(
      targetInvocation?.keyColumns,
      `invocationPayload.targetInvocations[${index}].keyColumns`
    ),
    mappedColumnCount: asNonNegativeInteger(
      targetInvocation?.mappedColumnCount,
      `invocationPayload.targetInvocations[${index}].mappedColumnCount`
    ),
    requestEnvelope: {
      acceptedArtifactType: 'warehouse_adapter_noop_artifact',
      acceptedArtifactVersion:
        asString(requestEnvelope.acceptedArtifactVersion) ??
        (() => {
          throw new FirstReportWarehouseResultContractError(
            'invalid_content',
            `invocationPayload.targetInvocations[${index}].requestEnvelope.acceptedArtifactVersion must be a non-empty string`
          );
        })(),
      requiredFields: asStringArray(
        requestEnvelope.requiredFields,
        `invocationPayload.targetInvocations[${index}].requestEnvelope.requiredFields`
      ),
      acceptedMode: 'noop',
      acceptedOperationName:
        asString(requestEnvelope.acceptedOperationName) ??
        (() => {
          throw new FirstReportWarehouseResultContractError(
            'invalid_content',
            `invocationPayload.targetInvocations[${index}].requestEnvelope.acceptedOperationName must be a non-empty string`
          );
        })(),
    },
    responseEnvelope: {
      resultType: 'warehouse_adapter_invocation_result',
      status: 'blocked_no_write',
      requiredFields: asStringArray(
        responseEnvelope.requiredFields,
        `invocationPayload.targetInvocations[${index}].responseEnvelope.requiredFields`
      ),
      writesAttempted: false,
      transportCalled: false,
      executionAllowed: false,
    },
    invocationState: {
      mode: 'invocation_boundary_only',
      writesAttempted: false,
      transportCalled: false,
      executionAllowed: false,
      invocationResult: 'blocked_no_write',
      blockReason: 'no_real_write_allowed',
    },
  };
};

const parseFirstSalesTrafficWarehouseInvocationArtifact = (
  value: unknown
): ValidatedInvocationArtifact => {
  const artifact = asObject(value);
  const reportId = asString(artifact?.reportId);
  const reportType = asString(artifact?.reportType);
  const lineage = asObject(artifact?.lineage);
  const invocationPayload = asObject(artifact?.invocationPayload);
  const warehouseAdapterInvocationVersion = asString(
    artifact?.warehouseAdapterInvocationVersion
  );

  const warehouseInvocationArtifactPath = asString(
    lineage?.warehouseInvocationArtifactPath
  );
  const warehouseAdapterInvocationVersionUsed = asString(
    lineage?.warehouseAdapterInvocationVersion
  );
  const warehouseNoopArtifactPath = asString(lineage?.warehouseNoopArtifactPath);
  const warehouseAdapterNoopVersion = asString(
    lineage?.warehouseAdapterNoopVersion
  );
  const warehouseInterfaceArtifactPath = asString(
    lineage?.warehouseInterfaceArtifactPath
  );
  const warehouseAdapterInterfaceVersion = asString(
    lineage?.warehouseAdapterInterfaceVersion
  );
  const warehouseDryRunArtifactPath = asString(
    lineage?.warehouseDryRunArtifactPath
  );
  const warehouseAdapterDryRunVersion = asString(
    lineage?.warehouseAdapterDryRunVersion
  );
  const warehouseMappingArtifactPath = asString(
    lineage?.warehouseMappingArtifactPath
  );
  const warehouseAdapterMappingVersion = asString(
    lineage?.warehouseAdapterMappingVersion
  );
  const warehouseReadyArtifactPath = asString(
    lineage?.warehouseReadyArtifactPath
  );
  const warehouseReadyContractVersion = asString(
    lineage?.warehouseReadyContractVersion
  );
  const canonicalIngestArtifactPath = asString(
    lineage?.canonicalIngestArtifactPath
  );
  const canonicalIngestVersion = asString(lineage?.canonicalIngestVersion);
  const stagingArtifactPath = asString(lineage?.stagingArtifactPath);
  const stagingVersion = asString(lineage?.stagingVersion);
  const handoffArtifactPath = asString(lineage?.handoffArtifactPath);
  const handoffSchemaVersion = asString(lineage?.handoffSchemaVersion);
  const parsedArtifactPath = asString(lineage?.parsedArtifactPath);
  const rawArtifactPath = asString(lineage?.rawArtifactPath);

  if (
    warehouseAdapterInvocationVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION
  ) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `warehouseAdapterInvocationVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION}`
    );
  }

  if (artifact?.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      'reportFamily must be sales_and_traffic'
    );
  }

  if (reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!reportId) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      'reportId must be a non-empty string'
    );
  }

  if (
    !warehouseNoopArtifactPath ||
    !warehouseAdapterNoopVersion ||
    !warehouseInterfaceArtifactPath ||
    !warehouseAdapterInterfaceVersion ||
    !warehouseDryRunArtifactPath ||
    !warehouseAdapterDryRunVersion ||
    !warehouseMappingArtifactPath ||
    !warehouseAdapterMappingVersion ||
    !warehouseReadyArtifactPath ||
    !warehouseReadyContractVersion ||
    !canonicalIngestArtifactPath ||
    !canonicalIngestVersion ||
    !stagingArtifactPath ||
    !stagingVersion ||
    !handoffArtifactPath ||
    !handoffSchemaVersion ||
    !parsedArtifactPath ||
    !rawArtifactPath
  ) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      'lineage must include invocation, no-op, interface, dry-run, mapping, warehouse-ready, canonical, staging, handoff, parsed, and raw artifact references'
    );
  }

  if (
    warehouseInvocationArtifactPath &&
    path.resolve(warehouseInvocationArtifactPath) !== warehouseInvocationArtifactPath
  ) {
    // allow relative or absolute, normalize below
  }

  if (
    warehouseAdapterInvocationVersionUsed &&
    warehouseAdapterInvocationVersionUsed !==
      FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION
  ) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `lineage.warehouseAdapterInvocationVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION} when present`
    );
  }

  if (warehouseAdapterNoopVersion !== FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `lineage.warehouseAdapterNoopVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION}`
    );
  }

  if (
    warehouseAdapterInterfaceVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION
  ) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `lineage.warehouseAdapterInterfaceVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION}`
    );
  }

  if (
    warehouseAdapterDryRunVersion !== FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION
  ) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `lineage.warehouseAdapterDryRunVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION}`
    );
  }

  if (
    warehouseAdapterMappingVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION
  ) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `lineage.warehouseAdapterMappingVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION}`
    );
  }

  if (
    warehouseReadyContractVersion !== FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `lineage.warehouseReadyContractVersion must be ${FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION}`
    );
  }

  if (canonicalIngestVersion !== FIRST_REPORT_CANONICAL_INGEST_VERSION) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `lineage.canonicalIngestVersion must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (!Array.isArray(artifact?.sections)) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      'sections must be an array'
    );
  }

  if (!invocationPayload || !Array.isArray(invocationPayload.targetInvocations)) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      'invocationPayload.targetInvocations must be an array'
    );
  }

  if (invocationPayload.mode !== 'invocation_boundary_only') {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      'invocationPayload.mode must be invocation_boundary_only'
    );
  }

  if (invocationPayload.writesAttempted !== false) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      'invocationPayload.writesAttempted must be false'
    );
  }

  if (invocationPayload.transportCalled !== false) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      'invocationPayload.transportCalled must be false'
    );
  }

  const sections = artifact.sections.map((section, index) =>
    parseSectionSummary(section, index)
  );
  const targetInvocations = invocationPayload.targetInvocations.map(
    (targetInvocation, index) => parseTargetInvocation(targetInvocation, index)
  );
  const totalRowCount = asNonNegativeInteger(artifact?.totalRowCount, 'totalRowCount');

  if (sections.length !== targetInvocations.length) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      'sections and invocationPayload.targetInvocations must have the same length'
    );
  }

  const summedRows = sections.reduce((sum, section) => sum + section.rowCount, 0);
  if (summedRows !== totalRowCount) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      'totalRowCount must equal the sum of section row counts'
    );
  }

  sections.forEach((section, index) => {
    const targetInvocation = targetInvocations[index];

    if (section.sectionName !== targetInvocation.sectionName) {
      throw new FirstReportWarehouseResultContractError(
        'invalid_content',
        `target invocation ${index} section name does not match section summary`
      );
    }

    if (section.targetTableName !== targetInvocation.targetTableName) {
      throw new FirstReportWarehouseResultContractError(
        'invalid_content',
        `target invocation ${section.sectionName} target table name does not match section summary`
      );
    }
  });

  return {
    warehouseAdapterInvocationVersion:
      FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION,
    reportId,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    lineage: {
      ...(warehouseInvocationArtifactPath
        ? { warehouseInvocationArtifactPath: path.resolve(warehouseInvocationArtifactPath) }
        : {}),
      ...(warehouseAdapterInvocationVersionUsed
        ? { warehouseAdapterInvocationVersion: warehouseAdapterInvocationVersionUsed }
        : {}),
      warehouseNoopArtifactPath: path.resolve(warehouseNoopArtifactPath),
      warehouseAdapterNoopVersion,
      warehouseInterfaceArtifactPath: path.resolve(warehouseInterfaceArtifactPath),
      warehouseAdapterInterfaceVersion,
      warehouseDryRunArtifactPath: path.resolve(warehouseDryRunArtifactPath),
      warehouseAdapterDryRunVersion,
      warehouseMappingArtifactPath: path.resolve(warehouseMappingArtifactPath),
      warehouseAdapterMappingVersion,
      warehouseReadyArtifactPath: path.resolve(warehouseReadyArtifactPath),
      warehouseReadyContractVersion,
      canonicalIngestArtifactPath: path.resolve(canonicalIngestArtifactPath),
      canonicalIngestVersion,
      stagingArtifactPath: path.resolve(stagingArtifactPath),
      stagingVersion,
      handoffArtifactPath: path.resolve(handoffArtifactPath),
      handoffSchemaVersion,
      parsedArtifactPath: path.resolve(parsedArtifactPath),
      rawArtifactPath: path.resolve(rawArtifactPath),
    } as ValidatedInvocationArtifact['lineage'],
    sections,
    totalRowCount,
    invocationPayload: {
      mode: 'invocation_boundary_only',
      writesAttempted: false,
      transportCalled: false,
      targetInvocations,
    },
  };
};

const deriveReportIdFromWarehouseInvocationArtifactPath = (
  warehouseInvocationArtifactPath: string
) => {
  const match = path.basename(warehouseInvocationArtifactPath).match(
    WAREHOUSE_INVOCATION_ARTIFACT_NAME_RE
  );
  const reportId = match?.groups?.reportId?.trim();

  return reportId && reportId.length > 0 ? reportId : null;
};

export const resolveFirstSalesTrafficWarehouseInvocationArtifactPath = async (
  args: {
    reportId?: string;
    warehouseInvocationArtifactPath?: string;
    warehouseInvocationOutputRoot?: string;
  }
) => {
  const warehouseInvocationArtifactPath =
    args.warehouseInvocationArtifactPath?.trim();
  const explicitReportId = args.reportId?.trim();

  if (warehouseInvocationArtifactPath) {
    const derivedReportId = deriveReportIdFromWarehouseInvocationArtifactPath(
      warehouseInvocationArtifactPath
    );

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new FirstReportWarehouseResultContractError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match warehouse invocation artifact path ${path.basename(
          warehouseInvocationArtifactPath
        )}`
      );
    }

    try {
      await fs.access(warehouseInvocationArtifactPath);
    } catch (error) {
      throw new FirstReportWarehouseResultContractError(
        'artifact_not_found',
        `SP-API warehouse invocation artifact not found at ${warehouseInvocationArtifactPath}`,
        error
      );
    }

    const reportId = explicitReportId ?? derivedReportId;
    if (!reportId) {
      throw new FirstReportWarehouseResultContractError(
        'invalid_input',
        'Warehouse invocation artifact path must follow the V2-16 deterministic naming or be paired with --report-id'
      );
    }

    return {
      reportId,
      warehouseInvocationArtifactPath: path.resolve(warehouseInvocationArtifactPath),
    };
  }

  if (!explicitReportId) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_input',
      'Warehouse result contract boundary requires either --report-id <value> or --warehouse-invocation-path <value>'
    );
  }

  const candidate = path.resolve(
    args.warehouseInvocationOutputRoot ??
      path.resolve(process.cwd(), 'out', 'sp-api-warehouse-invocation'),
    `report-${explicitReportId}.warehouse-invocation.json`
  );

  try {
    await fs.access(candidate);
  } catch (error) {
    throw new FirstReportWarehouseResultContractError(
      'artifact_not_found',
      `SP-API warehouse invocation artifact not found for report ${explicitReportId} under ${
        args.warehouseInvocationOutputRoot ??
        path.resolve(process.cwd(), 'out', 'sp-api-warehouse-invocation')
      }`,
      error
    );
  }

  return {
    reportId: explicitReportId,
    warehouseInvocationArtifactPath: candidate,
  };
};

export const readFirstSalesTrafficWarehouseAdapterInvocationArtifact = async (
  args: {
    warehouseInvocationArtifactPath: string;
  }
) => {
  let fileContents: string;

  try {
    fileContents = await fs.readFile(args.warehouseInvocationArtifactPath, 'utf8');
  } catch (error) {
    throw new FirstReportWarehouseResultContractError(
      'artifact_not_found',
      `Unable to read SP-API warehouse invocation artifact at ${args.warehouseInvocationArtifactPath}`,
      error
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(fileContents) as unknown;
  } catch (error) {
    throw new FirstReportWarehouseResultContractError(
      'invalid_content',
      `SP-API warehouse invocation artifact at ${args.warehouseInvocationArtifactPath} is not valid JSON`,
      error
    );
  }

  return parseFirstSalesTrafficWarehouseInvocationArtifact(parsed);
};

export const buildFirstSalesTrafficWarehouseAdapterResultContract = (args: {
  invocationArtifact: ValidatedInvocationArtifact;
  warehouseInvocationArtifactPath: string;
}): FirstReportWarehouseAdapterResultContractArtifact => {
  const { invocationArtifact, warehouseInvocationArtifactPath } = args;

  const targetResults: TargetResult[] =
    invocationArtifact.invocationPayload.targetInvocations.map(
      (targetInvocation) => ({
        sectionName: targetInvocation.sectionName,
        targetTableName: targetInvocation.targetTableName,
        operationName: targetInvocation.operationName,
        keyColumns: [...targetInvocation.keyColumns],
        mappedColumnCount: targetInvocation.mappedColumnCount,
        expectedSuccessResult: {
          resultType: 'warehouse_adapter_result_contract_success',
          requiredFields: [
            'status',
            'operationName',
            'targetTableName',
            'processedRowCount',
            'writesAttempted',
            'transportCalled',
            'executionAllowed',
          ],
          writesAttempted: false,
          transportCalled: false,
          executionAllowed: false,
        },
        expectedBlockedResult: {
          resultType: 'warehouse_adapter_result_contract_blocked',
          requiredFields: [
            'status',
            'operationName',
            'targetTableName',
            'writesAttempted',
            'transportCalled',
            'executionAllowed',
            'resultStatus',
            'statusReason',
          ],
          resultStatus: 'blocked_no_write',
          statusReason: 'no_real_write_allowed',
          writesAttempted: false,
          transportCalled: false,
          executionAllowed: false,
        },
        resultState: {
          mode: 'result_contract_only',
          writesAttempted: false,
          transportCalled: false,
          executionAllowed: false,
          resultStatus: 'blocked_no_write',
          statusReason: 'no_real_write_allowed',
        },
      })
    );

  return {
    warehouseAdapterResultContractVersion:
      FIRST_REPORT_WAREHOUSE_ADAPTER_RESULT_CONTRACT_VERSION,
    reportId: invocationArtifact.reportId,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    lineage: {
      warehouseInvocationArtifactPath: path.resolve(warehouseInvocationArtifactPath),
      warehouseAdapterInvocationVersion:
        invocationArtifact.warehouseAdapterInvocationVersion,
      warehouseNoopArtifactPath: invocationArtifact.lineage.warehouseNoopArtifactPath,
      warehouseAdapterNoopVersion:
        invocationArtifact.lineage.warehouseAdapterNoopVersion,
      warehouseInterfaceArtifactPath:
        invocationArtifact.lineage.warehouseInterfaceArtifactPath,
      warehouseAdapterInterfaceVersion:
        invocationArtifact.lineage.warehouseAdapterInterfaceVersion,
      warehouseDryRunArtifactPath:
        invocationArtifact.lineage.warehouseDryRunArtifactPath,
      warehouseAdapterDryRunVersion:
        invocationArtifact.lineage.warehouseAdapterDryRunVersion,
      warehouseMappingArtifactPath:
        invocationArtifact.lineage.warehouseMappingArtifactPath,
      warehouseAdapterMappingVersion:
        invocationArtifact.lineage.warehouseAdapterMappingVersion,
      warehouseReadyArtifactPath:
        invocationArtifact.lineage.warehouseReadyArtifactPath,
      warehouseReadyContractVersion:
        invocationArtifact.lineage.warehouseReadyContractVersion,
      canonicalIngestArtifactPath:
        invocationArtifact.lineage.canonicalIngestArtifactPath,
      canonicalIngestVersion: invocationArtifact.lineage.canonicalIngestVersion,
      stagingArtifactPath: invocationArtifact.lineage.stagingArtifactPath,
      stagingVersion: invocationArtifact.lineage.stagingVersion,
      handoffArtifactPath: invocationArtifact.lineage.handoffArtifactPath,
      handoffSchemaVersion: invocationArtifact.lineage.handoffSchemaVersion,
      parsedArtifactPath: invocationArtifact.lineage.parsedArtifactPath,
      rawArtifactPath: invocationArtifact.lineage.rawArtifactPath,
    },
    sections: invocationArtifact.sections.map((section) => ({ ...section })),
    totalRowCount: invocationArtifact.totalRowCount,
    resultContractPayload: {
      mode: 'result_contract_only',
      writesAttempted: false,
      transportCalled: false,
      targetResults,
    },
  };
};

export const validateFirstSalesTrafficWarehouseAdapterResultContract = (args: {
  resultContractArtifact: FirstReportWarehouseAdapterResultContractArtifact;
}) => {
  const artifact = args.resultContractArtifact;

  if (
    artifact.warehouseAdapterResultContractVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_RESULT_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseResultContractError(
      'validation_failed',
      `warehouseAdapterResultContractVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_RESULT_CONTRACT_VERSION}`
    );
  }

  if (
    !artifact.reportId ||
    artifact.reportFamily !== 'sales_and_traffic' ||
    artifact.reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE
  ) {
    throw new FirstReportWarehouseResultContractError(
      'validation_failed',
      'Result contract artifact must preserve report id, family, and type'
    );
  }

  if (!artifact.lineage || !artifact.sections || !artifact.resultContractPayload) {
    throw new FirstReportWarehouseResultContractError(
      'validation_failed',
      'Result contract artifact must include lineage, sections, and resultContractPayload'
    );
  }

  const requiredLineageFields: Array<
    keyof FirstReportWarehouseAdapterResultContractArtifact['lineage']
  > = [
    'warehouseInvocationArtifactPath',
    'warehouseAdapterInvocationVersion',
    'warehouseNoopArtifactPath',
    'warehouseAdapterNoopVersion',
    'warehouseInterfaceArtifactPath',
    'warehouseAdapterInterfaceVersion',
    'warehouseDryRunArtifactPath',
    'warehouseAdapterDryRunVersion',
    'warehouseMappingArtifactPath',
    'warehouseAdapterMappingVersion',
    'warehouseReadyArtifactPath',
    'warehouseReadyContractVersion',
    'canonicalIngestArtifactPath',
    'canonicalIngestVersion',
    'stagingArtifactPath',
    'stagingVersion',
    'handoffArtifactPath',
    'handoffSchemaVersion',
    'parsedArtifactPath',
    'rawArtifactPath',
  ];

  for (const field of requiredLineageFields) {
    if (!artifact.lineage[field]) {
      throw new FirstReportWarehouseResultContractError(
        'validation_failed',
        `Result contract artifact lineage must include ${field}`
      );
    }
  }

  if (!Array.isArray(artifact.sections) || artifact.sections.length === 0) {
    throw new FirstReportWarehouseResultContractError(
      'validation_failed',
      'Result contract artifact sections must be a non-empty array'
    );
  }

  if (
    artifact.totalRowCount !==
    artifact.sections.reduce((sum, section) => sum + section.rowCount, 0)
  ) {
    throw new FirstReportWarehouseResultContractError(
      'validation_failed',
      'Result contract artifact totalRowCount must equal the sum of section row counts'
    );
  }

  if (
    artifact.resultContractPayload.mode !== 'result_contract_only' ||
    artifact.resultContractPayload.writesAttempted !== false ||
    artifact.resultContractPayload.transportCalled !== false
  ) {
    throw new FirstReportWarehouseResultContractError(
      'validation_failed',
      'Result contract payload must be result_contract_only with no writes and no transport call'
    );
  }

  if (
    !Array.isArray(artifact.resultContractPayload.targetResults) ||
    artifact.resultContractPayload.targetResults.length !== artifact.sections.length
  ) {
    throw new FirstReportWarehouseResultContractError(
      'validation_failed',
      'Result contract payload targetResults must match the section count'
    );
  }

  artifact.resultContractPayload.targetResults.forEach((targetResult, index) => {
    const section = artifact.sections[index];

    if (
      targetResult.sectionName !== section.sectionName ||
      targetResult.targetTableName !== section.targetTableName
    ) {
      throw new FirstReportWarehouseResultContractError(
        'validation_failed',
        `Result target ${index} must align with the matching section summary`
      );
    }

    if (
      targetResult.resultState.mode !== 'result_contract_only' ||
      targetResult.resultState.writesAttempted !== false ||
      targetResult.resultState.transportCalled !== false ||
      targetResult.resultState.executionAllowed !== false ||
      targetResult.resultState.resultStatus !== 'blocked_no_write' ||
      targetResult.resultState.statusReason !== 'no_real_write_allowed'
    ) {
      throw new FirstReportWarehouseResultContractError(
        'validation_failed',
        `Result target ${targetResult.sectionName} must preserve the blocked no-write result flags`
      );
    }
  });

  return artifact;
};

export const buildFirstSalesTrafficWarehouseAdapterResultContractPath = (args: {
  reportId: string;
  outputRoot?: string;
}) =>
  path.resolve(
    args.outputRoot ?? FIRST_REPORT_WAREHOUSE_RESULT_CONTRACT_OUTPUT_DIR,
    `report-${args.reportId}.warehouse-result-contract.json`
  );

export const writeFirstSalesTrafficWarehouseAdapterResultContract = async (args: {
  resultContractArtifact: FirstReportWarehouseAdapterResultContractArtifact;
  outputRoot?: string;
}) => {
  validateFirstSalesTrafficWarehouseAdapterResultContract({
    resultContractArtifact: args.resultContractArtifact,
  });

  const warehouseResultContractArtifactPath =
    buildFirstSalesTrafficWarehouseAdapterResultContractPath({
      reportId: args.resultContractArtifact.reportId,
      outputRoot: args.outputRoot,
    });

  try {
    await fs.mkdir(path.dirname(warehouseResultContractArtifactPath), {
      recursive: true,
    });
    await fs.writeFile(
      warehouseResultContractArtifactPath,
      `${JSON.stringify(args.resultContractArtifact, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    throw new FirstReportWarehouseResultContractError(
      'write_failed',
      `Unable to write SP-API warehouse result contract artifact to ${warehouseResultContractArtifactPath}`,
      error
    );
  }

  return warehouseResultContractArtifactPath;
};

export const summarizeFirstSalesTrafficWarehouseAdapterResultContract = (args: {
  resultContractArtifact: FirstReportWarehouseAdapterResultContractArtifact;
  warehouseInvocationArtifactPath: string;
  warehouseResultContractArtifactPath: string;
}): FirstReportWarehouseAdapterResultContractSummary => ({
  endpoint: 'runFirstSalesTrafficWarehouseAdapterResultContract',
  reportId: args.resultContractArtifact.reportId,
  reportFamily: args.resultContractArtifact.reportFamily,
  reportType: args.resultContractArtifact.reportType,
  warehouseInvocationArtifactPath: path.resolve(args.warehouseInvocationArtifactPath),
  warehouseResultContractArtifactPath: path.resolve(
    args.warehouseResultContractArtifactPath
  ),
  warehouseAdapterResultContractVersion:
    args.resultContractArtifact.warehouseAdapterResultContractVersion,
  sectionCount: args.resultContractArtifact.sections.length,
  totalRowCount: args.resultContractArtifact.totalRowCount,
  targetTableNames: args.resultContractArtifact.sections.map(
    (section) => section.targetTableName
  ),
  operationNames: args.resultContractArtifact.resultContractPayload.targetResults.map(
    (targetResult) => targetResult.operationName
  ),
  resultStates: args.resultContractArtifact.resultContractPayload.targetResults.map(
    (targetResult) => targetResult.resultState
  ),
  sections: args.resultContractArtifact.sections.map((section) => ({ ...section })),
});

export const runFirstSalesTrafficWarehouseAdapterResultContract = async (args: {
  reportId?: string;
  warehouseInvocationArtifactPath?: string;
  warehouseInvocationOutputRoot?: string;
  warehouseResultContractOutputRoot?: string;
}) => {
  const resolved = await resolveFirstSalesTrafficWarehouseInvocationArtifactPath({
    reportId: args.reportId,
    warehouseInvocationArtifactPath: args.warehouseInvocationArtifactPath,
    warehouseInvocationOutputRoot: args.warehouseInvocationOutputRoot,
  });

  const invocationArtifact =
    await readFirstSalesTrafficWarehouseAdapterInvocationArtifact({
      warehouseInvocationArtifactPath: resolved.warehouseInvocationArtifactPath,
    });

  const resultContractArtifact = buildFirstSalesTrafficWarehouseAdapterResultContract(
    {
      invocationArtifact,
      warehouseInvocationArtifactPath: resolved.warehouseInvocationArtifactPath,
    }
  );

  const warehouseResultContractArtifactPath =
    await writeFirstSalesTrafficWarehouseAdapterResultContract({
      resultContractArtifact,
      outputRoot: args.warehouseResultContractOutputRoot,
    });

  return summarizeFirstSalesTrafficWarehouseAdapterResultContract({
    resultContractArtifact,
    warehouseInvocationArtifactPath: resolved.warehouseInvocationArtifactPath,
    warehouseResultContractArtifactPath,
  });
};
