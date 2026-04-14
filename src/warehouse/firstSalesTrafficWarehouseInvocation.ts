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
import {
  FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION,
  type FirstReportWarehouseAdapterNoopArtifact,
} from './firstSalesTrafficWarehouseNoop';

export const FIRST_REPORT_WAREHOUSE_INVOCATION_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-warehouse-invocation'
);

export const FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION =
  'sp-api-first-report-warehouse-adapter-invocation/v1';

type NoopExecutionState = {
  mode: 'noop';
  writesAttempted: false;
  implementationPresent: true;
  executionAllowed: false;
  executionResult: 'skipped_noop';
  skipReason: 'no_real_write_allowed';
};

type NoopTargetHandler = {
  sectionName: string;
  targetTableName: string;
  operationName: string;
  keyColumns: string[];
  mappedColumnCount: number;
  requestStub: {
    acceptedArtifactType: 'warehouse_adapter_interface_artifact';
    acceptedArtifactVersion: string;
    requiredFields: string[];
    acceptedMode: 'interface_only';
    acceptedOperationName: string;
  };
  responseStub: {
    resultType: 'warehouse_adapter_noop_result';
    status: 'skipped_noop';
    requiredFields: string[];
    writesAttempted: false;
    executionAllowed: false;
  };
  executionState: NoopExecutionState;
};

type ValidatedNoopArtifact = Omit<
  FirstReportWarehouseAdapterNoopArtifact,
  'noopPayload'
> & {
  noopPayload: {
    mode: 'noop';
    writesAttempted: false;
    realTransportPresent: false;
    targetHandlers: NoopTargetHandler[];
  };
};

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

export type FirstReportWarehouseAdapterInvocationArtifact = {
  warehouseAdapterInvocationVersion: typeof FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION;
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  lineage: {
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
  invocationPayload: {
    mode: 'invocation_boundary_only';
    writesAttempted: false;
    transportCalled: false;
    targetInvocations: TargetInvocation[];
  };
};

export type FirstReportWarehouseAdapterInvocationSummary = {
  endpoint: 'runFirstSalesTrafficWarehouseAdapterInvocation';
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  warehouseNoopArtifactPath: string;
  warehouseInvocationArtifactPath: string;
  warehouseAdapterInvocationVersion: string;
  sectionCount: number;
  totalRowCount: number;
  targetTableNames: string[];
  operationNames: string[];
  invocationStates: InvocationState[];
  sections: FirstReportWarehouseMappingSectionSummary[];
};

export class FirstReportWarehouseInvocationError extends Error {
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
    this.name = 'FirstReportWarehouseInvocationError';
    this.code = code;
    this.details = details;
  }
}

const WAREHOUSE_NOOP_ARTIFACT_NAME_RE =
  /^report-(?<reportId>.+)\.warehouse-noop\.json$/;

const asObject = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asStringArray = (value: unknown, fieldName: string) => {
  if (!Array.isArray(value)) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `${fieldName} must be an array of strings`
    );
  }

  return value.map((entry, index) => {
    const parsed = asString(entry);
    if (!parsed) {
      throw new FirstReportWarehouseInvocationError(
        'invalid_content',
        `${fieldName}[${index}] must be a non-empty string`
      );
    }

    return parsed;
  });
};

const asNonNegativeInteger = (value: unknown, fieldName: string) => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new FirstReportWarehouseInvocationError(
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
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `sections[${index}].sectionName must be a non-empty string`
    );
  }

  if (!targetTableName) {
    throw new FirstReportWarehouseInvocationError(
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

const parseTargetHandler = (
  value: unknown,
  index: number
): NoopTargetHandler => {
  const targetHandler = asObject(value);
  const sectionName = asString(targetHandler?.sectionName);
  const targetTableName = asString(targetHandler?.targetTableName);
  const operationName = asString(targetHandler?.operationName);
  const requestStub = asObject(targetHandler?.requestStub);
  const responseStub = asObject(targetHandler?.responseStub);
  const executionState = asObject(targetHandler?.executionState);

  if (!sectionName || !targetTableName || !operationName) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `noopPayload.targetHandlers[${index}] must include sectionName, targetTableName, and operationName`
    );
  }

  if (!requestStub || !responseStub || !executionState) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `noopPayload.targetHandlers[${index}] must include requestStub, responseStub, and executionState`
    );
  }

  if (requestStub.acceptedArtifactType !== 'warehouse_adapter_interface_artifact') {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `noopPayload.targetHandlers[${index}].requestStub.acceptedArtifactType must be warehouse_adapter_interface_artifact`
    );
  }

  if (requestStub.acceptedMode !== 'interface_only') {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `noopPayload.targetHandlers[${index}].requestStub.acceptedMode must be interface_only`
    );
  }

  if (
    responseStub.resultType !== 'warehouse_adapter_noop_result' ||
    responseStub.status !== 'skipped_noop' ||
    responseStub.writesAttempted !== false ||
    responseStub.executionAllowed !== false
  ) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `noopPayload.targetHandlers[${index}].responseStub must match the V2-15 no-op contract`
    );
  }

  if (
    executionState.mode !== 'noop' ||
    executionState.writesAttempted !== false ||
    executionState.implementationPresent !== true ||
    executionState.executionAllowed !== false ||
    executionState.executionResult !== 'skipped_noop' ||
    executionState.skipReason !== 'no_real_write_allowed'
  ) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `noopPayload.targetHandlers[${index}].executionState must be noop with blocked writes`
    );
  }

  return {
    sectionName,
    targetTableName,
    operationName,
    keyColumns: asStringArray(
      targetHandler?.keyColumns,
      `noopPayload.targetHandlers[${index}].keyColumns`
    ),
    mappedColumnCount: asNonNegativeInteger(
      targetHandler?.mappedColumnCount,
      `noopPayload.targetHandlers[${index}].mappedColumnCount`
    ),
    requestStub: {
      acceptedArtifactType: 'warehouse_adapter_interface_artifact',
      acceptedArtifactVersion:
        asString(requestStub.acceptedArtifactVersion) ??
        (() => {
          throw new FirstReportWarehouseInvocationError(
            'invalid_content',
            `noopPayload.targetHandlers[${index}].requestStub.acceptedArtifactVersion must be a non-empty string`
          );
        })(),
      requiredFields: asStringArray(
        requestStub.requiredFields,
        `noopPayload.targetHandlers[${index}].requestStub.requiredFields`
      ),
      acceptedMode: 'interface_only',
      acceptedOperationName:
        asString(requestStub.acceptedOperationName) ??
        (() => {
          throw new FirstReportWarehouseInvocationError(
            'invalid_content',
            `noopPayload.targetHandlers[${index}].requestStub.acceptedOperationName must be a non-empty string`
          );
        })(),
    },
    responseStub: {
      resultType: 'warehouse_adapter_noop_result',
      status: 'skipped_noop',
      requiredFields: asStringArray(
        responseStub.requiredFields,
        `noopPayload.targetHandlers[${index}].responseStub.requiredFields`
      ),
      writesAttempted: false,
      executionAllowed: false,
    },
    executionState: {
      mode: 'noop',
      writesAttempted: false,
      implementationPresent: true,
      executionAllowed: false,
      executionResult: 'skipped_noop',
      skipReason: 'no_real_write_allowed',
    },
  };
};

const parseFirstSalesTrafficWarehouseNoopArtifact = (
  value: unknown
): ValidatedNoopArtifact => {
  const artifact = asObject(value);
  const reportId = asString(artifact?.reportId);
  const reportType = asString(artifact?.reportType);
  const lineage = asObject(artifact?.lineage);
  const noopPayload = asObject(artifact?.noopPayload);
  const warehouseAdapterNoopVersion = asString(artifact?.warehouseAdapterNoopVersion);

  const warehouseInterfaceArtifactPath = asString(lineage?.warehouseInterfaceArtifactPath);
  const warehouseAdapterInterfaceVersion = asString(
    lineage?.warehouseAdapterInterfaceVersion
  );
  const warehouseDryRunArtifactPath = asString(lineage?.warehouseDryRunArtifactPath);
  const warehouseAdapterDryRunVersion = asString(
    lineage?.warehouseAdapterDryRunVersion
  );
  const warehouseMappingArtifactPath = asString(lineage?.warehouseMappingArtifactPath);
  const warehouseAdapterMappingVersion = asString(
    lineage?.warehouseAdapterMappingVersion
  );
  const warehouseReadyArtifactPath = asString(lineage?.warehouseReadyArtifactPath);
  const warehouseReadyContractVersion = asString(
    lineage?.warehouseReadyContractVersion
  );
  const canonicalIngestArtifactPath = asString(lineage?.canonicalIngestArtifactPath);
  const canonicalIngestVersion = asString(lineage?.canonicalIngestVersion);
  const stagingArtifactPath = asString(lineage?.stagingArtifactPath);
  const stagingVersion = asString(lineage?.stagingVersion);
  const handoffArtifactPath = asString(lineage?.handoffArtifactPath);
  const handoffSchemaVersion = asString(lineage?.handoffSchemaVersion);
  const parsedArtifactPath = asString(lineage?.parsedArtifactPath);
  const rawArtifactPath = asString(lineage?.rawArtifactPath);

  if (warehouseAdapterNoopVersion !== FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `warehouseAdapterNoopVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION}`
    );
  }

  if (artifact?.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      'reportFamily must be sales_and_traffic'
    );
  }

  if (reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!reportId) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      'reportId must be a non-empty string'
    );
  }

  if (
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
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      'lineage must include interface, dry-run, mapping, warehouse-ready, canonical, staging, handoff, parsed, and raw artifact references'
    );
  }

  if (
    warehouseAdapterInterfaceVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION
  ) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `lineage.warehouseAdapterInterfaceVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION}`
    );
  }

  if (warehouseAdapterDryRunVersion !== FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `lineage.warehouseAdapterDryRunVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION}`
    );
  }

  if (
    warehouseAdapterMappingVersion !== FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION
  ) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `lineage.warehouseAdapterMappingVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION}`
    );
  }

  if (
    warehouseReadyContractVersion !== FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `lineage.warehouseReadyContractVersion must be ${FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION}`
    );
  }

  if (canonicalIngestVersion !== FIRST_REPORT_CANONICAL_INGEST_VERSION) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `lineage.canonicalIngestVersion must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (!Array.isArray(artifact?.sections)) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      'sections must be an array'
    );
  }

  if (!noopPayload || !Array.isArray(noopPayload.targetHandlers)) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      'noopPayload.targetHandlers must be an array'
    );
  }

  if (noopPayload.mode !== 'noop') {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      'noopPayload.mode must be noop'
    );
  }

  if (noopPayload.writesAttempted !== false) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      'noopPayload.writesAttempted must be false'
    );
  }

  if (noopPayload.realTransportPresent !== false) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      'noopPayload.realTransportPresent must be false'
    );
  }

  const sections = artifact.sections.map((section, index) =>
    parseSectionSummary(section, index)
  );
  const targetHandlers = noopPayload.targetHandlers.map((handler, index) =>
    parseTargetHandler(handler, index)
  );
  const totalRowCount = asNonNegativeInteger(artifact?.totalRowCount, 'totalRowCount');

  if (sections.length !== targetHandlers.length) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      'sections and noopPayload.targetHandlers must have the same length'
    );
  }

  const summedRows = sections.reduce((sum, section) => sum + section.rowCount, 0);
  if (summedRows !== totalRowCount) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      'totalRowCount must equal the sum of section row counts'
    );
  }

  sections.forEach((section, index) => {
    const targetHandler = targetHandlers[index];

    if (section.sectionName !== targetHandler.sectionName) {
      throw new FirstReportWarehouseInvocationError(
        'invalid_content',
        `target handler ${index} section name does not match section summary`
      );
    }

    if (section.targetTableName !== targetHandler.targetTableName) {
      throw new FirstReportWarehouseInvocationError(
        'invalid_content',
        `target handler ${section.sectionName} target table name does not match section summary`
      );
    }
  });

  return {
    warehouseAdapterNoopVersion: FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION,
    reportId,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    lineage: {
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
    },
    sections,
    totalRowCount,
    noopPayload: {
      mode: 'noop',
      writesAttempted: false,
      realTransportPresent: false,
      targetHandlers,
    },
  };
};

const deriveReportIdFromWarehouseNoopArtifactPath = (
  warehouseNoopArtifactPath: string
) => {
  const match = path.basename(warehouseNoopArtifactPath).match(
    WAREHOUSE_NOOP_ARTIFACT_NAME_RE
  );
  const reportId = match?.groups?.reportId?.trim();

  return reportId && reportId.length > 0 ? reportId : null;
};

export const resolveFirstSalesTrafficWarehouseNoopArtifactPath = async (args: {
  reportId?: string;
  warehouseNoopArtifactPath?: string;
  warehouseNoopOutputRoot?: string;
}) => {
  const warehouseNoopArtifactPath = args.warehouseNoopArtifactPath?.trim();
  const explicitReportId = args.reportId?.trim();

  if (warehouseNoopArtifactPath) {
    const derivedReportId = deriveReportIdFromWarehouseNoopArtifactPath(
      warehouseNoopArtifactPath
    );

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new FirstReportWarehouseInvocationError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match warehouse no-op artifact path ${path.basename(
          warehouseNoopArtifactPath
        )}`
      );
    }

    try {
      await fs.access(warehouseNoopArtifactPath);
    } catch (error) {
      throw new FirstReportWarehouseInvocationError(
        'artifact_not_found',
        `SP-API warehouse no-op artifact not found at ${warehouseNoopArtifactPath}`,
        error
      );
    }

    const reportId = explicitReportId ?? derivedReportId;
    if (!reportId) {
      throw new FirstReportWarehouseInvocationError(
        'invalid_input',
        'Warehouse no-op artifact path must follow the V2-15 deterministic naming or be paired with --report-id'
      );
    }

    return {
      reportId,
      warehouseNoopArtifactPath: path.resolve(warehouseNoopArtifactPath),
    };
  }

  if (!explicitReportId) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_input',
      'Warehouse invocation boundary requires either --report-id <value> or --warehouse-noop-path <value>'
    );
  }

  const candidate = path.resolve(
    args.warehouseNoopOutputRoot ??
      path.resolve(process.cwd(), 'out', 'sp-api-warehouse-noop'),
    `report-${explicitReportId}.warehouse-noop.json`
  );

  try {
    await fs.access(candidate);
  } catch (error) {
    throw new FirstReportWarehouseInvocationError(
      'artifact_not_found',
      `SP-API warehouse no-op artifact not found for report ${explicitReportId} under ${
        args.warehouseNoopOutputRoot ??
        path.resolve(process.cwd(), 'out', 'sp-api-warehouse-noop')
      }`,
      error
    );
  }

  return {
    reportId: explicitReportId,
    warehouseNoopArtifactPath: candidate,
  };
};

export const readFirstSalesTrafficWarehouseAdapterNoopArtifact = async (args: {
  warehouseNoopArtifactPath: string;
}) => {
  let fileContents: string;

  try {
    fileContents = await fs.readFile(args.warehouseNoopArtifactPath, 'utf8');
  } catch (error) {
    throw new FirstReportWarehouseInvocationError(
      'artifact_not_found',
      `Unable to read SP-API warehouse no-op artifact at ${args.warehouseNoopArtifactPath}`,
      error
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(fileContents) as unknown;
  } catch (error) {
    throw new FirstReportWarehouseInvocationError(
      'invalid_content',
      `SP-API warehouse no-op artifact at ${args.warehouseNoopArtifactPath} is not valid JSON`,
      error
    );
  }

  return parseFirstSalesTrafficWarehouseNoopArtifact(parsed);
};

export const buildFirstSalesTrafficWarehouseAdapterInvocation = (args: {
  noopArtifact: ValidatedNoopArtifact;
  warehouseNoopArtifactPath: string;
}): FirstReportWarehouseAdapterInvocationArtifact => {
  const { noopArtifact, warehouseNoopArtifactPath } = args;

  const targetInvocations: TargetInvocation[] =
    noopArtifact.noopPayload.targetHandlers.map((targetHandler) => ({
      sectionName: targetHandler.sectionName,
      targetTableName: targetHandler.targetTableName,
      operationName: targetHandler.operationName,
      keyColumns: [...targetHandler.keyColumns],
      mappedColumnCount: targetHandler.mappedColumnCount,
      requestEnvelope: {
        acceptedArtifactType: 'warehouse_adapter_noop_artifact',
        acceptedArtifactVersion: noopArtifact.warehouseAdapterNoopVersion,
        requiredFields: [
          'reportId',
          'reportFamily',
          'reportType',
          'lineage',
          'sections',
          'totalRowCount',
          'noopPayload',
        ],
        acceptedMode: 'noop',
        acceptedOperationName: targetHandler.operationName,
      },
      responseEnvelope: {
        resultType: 'warehouse_adapter_invocation_result',
        status: 'blocked_no_write',
        requiredFields: [
          'status',
          'operationName',
          'targetTableName',
          'writesAttempted',
          'transportCalled',
          'executionAllowed',
          'invocationResult',
          'blockReason',
        ],
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
    }));

  return {
    warehouseAdapterInvocationVersion:
      FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION,
    reportId: noopArtifact.reportId,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    lineage: {
      warehouseNoopArtifactPath: path.resolve(warehouseNoopArtifactPath),
      warehouseAdapterNoopVersion: noopArtifact.warehouseAdapterNoopVersion,
      warehouseInterfaceArtifactPath:
        noopArtifact.lineage.warehouseInterfaceArtifactPath,
      warehouseAdapterInterfaceVersion:
        noopArtifact.lineage.warehouseAdapterInterfaceVersion,
      warehouseDryRunArtifactPath: noopArtifact.lineage.warehouseDryRunArtifactPath,
      warehouseAdapterDryRunVersion:
        noopArtifact.lineage.warehouseAdapterDryRunVersion,
      warehouseMappingArtifactPath:
        noopArtifact.lineage.warehouseMappingArtifactPath,
      warehouseAdapterMappingVersion:
        noopArtifact.lineage.warehouseAdapterMappingVersion,
      warehouseReadyArtifactPath: noopArtifact.lineage.warehouseReadyArtifactPath,
      warehouseReadyContractVersion:
        noopArtifact.lineage.warehouseReadyContractVersion,
      canonicalIngestArtifactPath:
        noopArtifact.lineage.canonicalIngestArtifactPath,
      canonicalIngestVersion: noopArtifact.lineage.canonicalIngestVersion,
      stagingArtifactPath: noopArtifact.lineage.stagingArtifactPath,
      stagingVersion: noopArtifact.lineage.stagingVersion,
      handoffArtifactPath: noopArtifact.lineage.handoffArtifactPath,
      handoffSchemaVersion: noopArtifact.lineage.handoffSchemaVersion,
      parsedArtifactPath: noopArtifact.lineage.parsedArtifactPath,
      rawArtifactPath: noopArtifact.lineage.rawArtifactPath,
    },
    sections: noopArtifact.sections.map((section) => ({ ...section })),
    totalRowCount: noopArtifact.totalRowCount,
    invocationPayload: {
      mode: 'invocation_boundary_only',
      writesAttempted: false,
      transportCalled: false,
      targetInvocations,
    },
  };
};

export const validateFirstSalesTrafficWarehouseAdapterInvocation = (args: {
  invocationArtifact: FirstReportWarehouseAdapterInvocationArtifact;
}) => {
  const artifact = args.invocationArtifact;

  if (
    artifact.warehouseAdapterInvocationVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION
  ) {
    throw new FirstReportWarehouseInvocationError(
      'validation_failed',
      `warehouseAdapterInvocationVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION}`
    );
  }

  if (
    !artifact.reportId ||
    artifact.reportFamily !== 'sales_and_traffic' ||
    artifact.reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE
  ) {
    throw new FirstReportWarehouseInvocationError(
      'validation_failed',
      'Invocation artifact must preserve report id, family, and type'
    );
  }

  if (!artifact.lineage || !artifact.sections || !artifact.invocationPayload) {
    throw new FirstReportWarehouseInvocationError(
      'validation_failed',
      'Invocation artifact must include lineage, sections, and invocationPayload'
    );
  }

  const requiredLineageFields: Array<
    keyof FirstReportWarehouseAdapterInvocationArtifact['lineage']
  > = [
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
      throw new FirstReportWarehouseInvocationError(
        'validation_failed',
        `Invocation artifact lineage must include ${field}`
      );
    }
  }

  if (!Array.isArray(artifact.sections) || artifact.sections.length === 0) {
    throw new FirstReportWarehouseInvocationError(
      'validation_failed',
      'Invocation artifact sections must be a non-empty array'
    );
  }

  if (
    artifact.totalRowCount !==
    artifact.sections.reduce((sum, section) => sum + section.rowCount, 0)
  ) {
    throw new FirstReportWarehouseInvocationError(
      'validation_failed',
      'Invocation artifact totalRowCount must equal the sum of section row counts'
    );
  }

  if (
    artifact.invocationPayload.mode !== 'invocation_boundary_only' ||
    artifact.invocationPayload.writesAttempted !== false ||
    artifact.invocationPayload.transportCalled !== false
  ) {
    throw new FirstReportWarehouseInvocationError(
      'validation_failed',
      'Invocation payload must be invocation_boundary_only with no writes and no transport call'
    );
  }

  if (
    !Array.isArray(artifact.invocationPayload.targetInvocations) ||
    artifact.invocationPayload.targetInvocations.length !== artifact.sections.length
  ) {
    throw new FirstReportWarehouseInvocationError(
      'validation_failed',
      'Invocation payload targetInvocations must match the section count'
    );
  }

  artifact.invocationPayload.targetInvocations.forEach((targetInvocation, index) => {
    const section = artifact.sections[index];

    if (
      targetInvocation.sectionName !== section.sectionName ||
      targetInvocation.targetTableName !== section.targetTableName
    ) {
      throw new FirstReportWarehouseInvocationError(
        'validation_failed',
        `Invocation target ${index} must align with the matching section summary`
      );
    }

    if (
      targetInvocation.invocationState.mode !== 'invocation_boundary_only' ||
      targetInvocation.invocationState.writesAttempted !== false ||
      targetInvocation.invocationState.transportCalled !== false ||
      targetInvocation.invocationState.executionAllowed !== false ||
      targetInvocation.invocationState.invocationResult !== 'blocked_no_write' ||
      targetInvocation.invocationState.blockReason !== 'no_real_write_allowed'
    ) {
      throw new FirstReportWarehouseInvocationError(
        'validation_failed',
        `Invocation target ${targetInvocation.sectionName} must preserve the blocked no-write invocation flags`
      );
    }
  });

  return artifact;
};

export const buildFirstSalesTrafficWarehouseAdapterInvocationPath = (args: {
  reportId: string;
  outputRoot?: string;
}) =>
  path.resolve(
    args.outputRoot ?? FIRST_REPORT_WAREHOUSE_INVOCATION_OUTPUT_DIR,
    `report-${args.reportId}.warehouse-invocation.json`
  );

export const writeFirstSalesTrafficWarehouseAdapterInvocation = async (args: {
  invocationArtifact: FirstReportWarehouseAdapterInvocationArtifact;
  outputRoot?: string;
}) => {
  validateFirstSalesTrafficWarehouseAdapterInvocation({
    invocationArtifact: args.invocationArtifact,
  });

  const warehouseInvocationArtifactPath =
    buildFirstSalesTrafficWarehouseAdapterInvocationPath({
      reportId: args.invocationArtifact.reportId,
      outputRoot: args.outputRoot,
    });

  try {
    await fs.mkdir(path.dirname(warehouseInvocationArtifactPath), { recursive: true });
    await fs.writeFile(
      warehouseInvocationArtifactPath,
      `${JSON.stringify(args.invocationArtifact, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    throw new FirstReportWarehouseInvocationError(
      'write_failed',
      `Unable to write SP-API warehouse invocation artifact to ${warehouseInvocationArtifactPath}`,
      error
    );
  }

  return warehouseInvocationArtifactPath;
};

export const summarizeFirstSalesTrafficWarehouseAdapterInvocation = (args: {
  invocationArtifact: FirstReportWarehouseAdapterInvocationArtifact;
  warehouseNoopArtifactPath: string;
  warehouseInvocationArtifactPath: string;
}): FirstReportWarehouseAdapterInvocationSummary => ({
  endpoint: 'runFirstSalesTrafficWarehouseAdapterInvocation',
  reportId: args.invocationArtifact.reportId,
  reportFamily: args.invocationArtifact.reportFamily,
  reportType: args.invocationArtifact.reportType,
  warehouseNoopArtifactPath: path.resolve(args.warehouseNoopArtifactPath),
  warehouseInvocationArtifactPath: path.resolve(args.warehouseInvocationArtifactPath),
  warehouseAdapterInvocationVersion:
    args.invocationArtifact.warehouseAdapterInvocationVersion,
  sectionCount: args.invocationArtifact.sections.length,
  totalRowCount: args.invocationArtifact.totalRowCount,
  targetTableNames: args.invocationArtifact.sections.map(
    (section) => section.targetTableName
  ),
  operationNames: args.invocationArtifact.invocationPayload.targetInvocations.map(
    (targetInvocation) => targetInvocation.operationName
  ),
  invocationStates: args.invocationArtifact.invocationPayload.targetInvocations.map(
    (targetInvocation) => targetInvocation.invocationState
  ),
  sections: args.invocationArtifact.sections.map((section) => ({ ...section })),
});

export const runFirstSalesTrafficWarehouseAdapterInvocation = async (args: {
  reportId?: string;
  warehouseNoopArtifactPath?: string;
  warehouseNoopOutputRoot?: string;
  warehouseInvocationOutputRoot?: string;
}) => {
  const resolved = await resolveFirstSalesTrafficWarehouseNoopArtifactPath({
    reportId: args.reportId,
    warehouseNoopArtifactPath: args.warehouseNoopArtifactPath,
    warehouseNoopOutputRoot: args.warehouseNoopOutputRoot,
  });

  const noopArtifact = await readFirstSalesTrafficWarehouseAdapterNoopArtifact({
    warehouseNoopArtifactPath: resolved.warehouseNoopArtifactPath,
  });

  const invocationArtifact = buildFirstSalesTrafficWarehouseAdapterInvocation({
    noopArtifact,
    warehouseNoopArtifactPath: resolved.warehouseNoopArtifactPath,
  });

  const warehouseInvocationArtifactPath =
    await writeFirstSalesTrafficWarehouseAdapterInvocation({
      invocationArtifact,
      outputRoot: args.warehouseInvocationOutputRoot,
    });

  return summarizeFirstSalesTrafficWarehouseAdapterInvocation({
    invocationArtifact,
    warehouseNoopArtifactPath: resolved.warehouseNoopArtifactPath,
    warehouseInvocationArtifactPath,
  });
};
