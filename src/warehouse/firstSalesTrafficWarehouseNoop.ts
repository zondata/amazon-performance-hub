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
import {
  FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION,
  type FirstReportWarehouseAdapterInterfaceArtifact,
} from './firstSalesTrafficWarehouseInterface';

export const FIRST_REPORT_WAREHOUSE_NOOP_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-warehouse-noop'
);

export const FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION =
  'sp-api-first-report-warehouse-adapter-noop/v1';

type InterfaceExecutionFlags = {
  mode: 'interface_only';
  writesAttempted: false;
  implementationPresent: false;
  executionAllowed: false;
};

type TargetInterface = {
  sectionName: string;
  targetTableName: string;
  operationName: string;
  keyColumns: string[];
  mappedColumnCount: number;
  requestContract: {
    artifactType: 'warehouse_adapter_dry_run_artifact';
    artifactVersion: string;
    requiredTopLevelFields: string[];
    requiredTargetOperationFields: string[];
    acceptedMode: 'dry_run';
    acceptedTargetTableName: string;
    acceptedSectionName: string;
    acceptedSourceBatchPath: string;
  };
  responseContract: {
    resultType: 'warehouse_adapter_interface_result';
    requiredFields: string[];
    successStatus: 'interface_only';
    writesAttempted: false;
    implementationPresent: false;
    executionAllowed: false;
  };
  executionFlags: InterfaceExecutionFlags;
};

type ValidatedInterfaceArtifact = Omit<
  FirstReportWarehouseAdapterInterfaceArtifact,
  'interfacePayload'
> & {
  interfacePayload: {
    mode: 'interface_only';
    writesAttempted: false;
    implementationPresent: false;
    executionAllowed: false;
    targetInterfaces: TargetInterface[];
  };
};

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

export type FirstReportWarehouseAdapterNoopArtifact = {
  warehouseAdapterNoopVersion: typeof FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION;
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  lineage: {
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
  noopPayload: {
    mode: 'noop';
    writesAttempted: false;
    realTransportPresent: false;
    targetHandlers: NoopTargetHandler[];
  };
};

export type FirstReportWarehouseAdapterNoopSummary = {
  endpoint: 'runFirstSalesTrafficWarehouseAdapterNoopImplementation';
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  warehouseInterfaceArtifactPath: string;
  warehouseNoopArtifactPath: string;
  warehouseAdapterNoopVersion: string;
  sectionCount: number;
  totalRowCount: number;
  targetTableNames: string[];
  operationNames: string[];
  executionStates: NoopExecutionState[];
  sections: FirstReportWarehouseMappingSectionSummary[];
};

export class FirstReportWarehouseNoopError extends Error {
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
    this.name = 'FirstReportWarehouseNoopError';
    this.code = code;
    this.details = details;
  }
}

const WAREHOUSE_INTERFACE_ARTIFACT_NAME_RE =
  /^report-(?<reportId>.+)\.warehouse-interface\.json$/;

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
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `${fieldName} must be an array of strings`
    );
  }

  return value.map((entry, index) => {
    const parsed = asString(entry);
    if (!parsed) {
      throw new FirstReportWarehouseNoopError(
        'invalid_content',
        `${fieldName}[${index}] must be a non-empty string`
      );
    }

    return parsed;
  });
};

const asNonNegativeInteger = (value: unknown, fieldName: string) => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new FirstReportWarehouseNoopError(
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
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `sections[${index}].sectionName must be a non-empty string`
    );
  }

  if (!targetTableName) {
    throw new FirstReportWarehouseNoopError(
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

const parseTargetInterface = (
  value: unknown,
  index: number
): TargetInterface => {
  const targetInterface = asObject(value);
  const sectionName = asString(targetInterface?.sectionName);
  const targetTableName = asString(targetInterface?.targetTableName);
  const operationName = asString(targetInterface?.operationName);
  const requestContract = asObject(targetInterface?.requestContract);
  const responseContract = asObject(targetInterface?.responseContract);
  const executionFlags = asObject(targetInterface?.executionFlags);

  if (!sectionName || !targetTableName || !operationName) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `interfacePayload.targetInterfaces[${index}] must include sectionName, targetTableName, and operationName`
    );
  }

  if (!requestContract || !responseContract || !executionFlags) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `interfacePayload.targetInterfaces[${index}] must include requestContract, responseContract, and executionFlags`
    );
  }

  if (requestContract.artifactType !== 'warehouse_adapter_dry_run_artifact') {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `interfacePayload.targetInterfaces[${index}].requestContract.artifactType must be warehouse_adapter_dry_run_artifact`
    );
  }

  if (requestContract.acceptedMode !== 'dry_run') {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `interfacePayload.targetInterfaces[${index}].requestContract.acceptedMode must be dry_run`
    );
  }

  if (
    responseContract.resultType !== 'warehouse_adapter_interface_result' ||
    responseContract.successStatus !== 'interface_only' ||
    responseContract.writesAttempted !== false ||
    responseContract.implementationPresent !== false ||
    responseContract.executionAllowed !== false
  ) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `interfacePayload.targetInterfaces[${index}].responseContract must match the V2-14 no-write interface contract`
    );
  }

  if (
    executionFlags.mode !== 'interface_only' ||
    executionFlags.writesAttempted !== false ||
    executionFlags.implementationPresent !== false ||
    executionFlags.executionAllowed !== false
  ) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `interfacePayload.targetInterfaces[${index}].executionFlags must be interface_only with no writes and no implementation`
    );
  }

  return {
    sectionName,
    targetTableName,
    operationName,
    keyColumns: asStringArray(
      targetInterface?.keyColumns,
      `interfacePayload.targetInterfaces[${index}].keyColumns`
    ),
    mappedColumnCount: asNonNegativeInteger(
      targetInterface?.mappedColumnCount,
      `interfacePayload.targetInterfaces[${index}].mappedColumnCount`
    ),
    requestContract: {
      artifactType: 'warehouse_adapter_dry_run_artifact',
      artifactVersion:
        asString(requestContract.artifactVersion) ??
        (() => {
          throw new FirstReportWarehouseNoopError(
            'invalid_content',
            `interfacePayload.targetInterfaces[${index}].requestContract.artifactVersion must be a non-empty string`
          );
        })(),
      requiredTopLevelFields: asStringArray(
        requestContract.requiredTopLevelFields,
        `interfacePayload.targetInterfaces[${index}].requestContract.requiredTopLevelFields`
      ),
      requiredTargetOperationFields: asStringArray(
        requestContract.requiredTargetOperationFields,
        `interfacePayload.targetInterfaces[${index}].requestContract.requiredTargetOperationFields`
      ),
      acceptedMode: 'dry_run',
      acceptedTargetTableName:
        asString(requestContract.acceptedTargetTableName) ??
        (() => {
          throw new FirstReportWarehouseNoopError(
            'invalid_content',
            `interfacePayload.targetInterfaces[${index}].requestContract.acceptedTargetTableName must be a non-empty string`
          );
        })(),
      acceptedSectionName:
        asString(requestContract.acceptedSectionName) ??
        (() => {
          throw new FirstReportWarehouseNoopError(
            'invalid_content',
            `interfacePayload.targetInterfaces[${index}].requestContract.acceptedSectionName must be a non-empty string`
          );
        })(),
      acceptedSourceBatchPath:
        asString(requestContract.acceptedSourceBatchPath) ??
        (() => {
          throw new FirstReportWarehouseNoopError(
            'invalid_content',
            `interfacePayload.targetInterfaces[${index}].requestContract.acceptedSourceBatchPath must be a non-empty string`
          );
        })(),
    },
    responseContract: {
      resultType: 'warehouse_adapter_interface_result',
      requiredFields: asStringArray(
        responseContract.requiredFields,
        `interfacePayload.targetInterfaces[${index}].responseContract.requiredFields`
      ),
      successStatus: 'interface_only',
      writesAttempted: false,
      implementationPresent: false,
      executionAllowed: false,
    },
    executionFlags: {
      mode: 'interface_only',
      writesAttempted: false,
      implementationPresent: false,
      executionAllowed: false,
    },
  };
};

const parseFirstSalesTrafficWarehouseInterfaceArtifact = (
  value: unknown
): ValidatedInterfaceArtifact => {
  const artifact = asObject(value);
  const reportId = asString(artifact?.reportId);
  const reportType = asString(artifact?.reportType);
  const lineage = asObject(artifact?.lineage);
  const interfacePayload = asObject(artifact?.interfacePayload);
  const warehouseAdapterInterfaceVersion = asString(
    artifact?.warehouseAdapterInterfaceVersion
  );

  const warehouseInterfaceArtifactPath = asString(lineage?.warehouseInterfaceArtifactPath);
  const warehouseAdapterInterfaceVersionUsed = asString(
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

  if (
    warehouseAdapterInterfaceVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION
  ) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `warehouseAdapterInterfaceVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION}`
    );
  }

  if (artifact?.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      'reportFamily must be sales_and_traffic'
    );
  }

  if (reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!reportId) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      'reportId must be a non-empty string'
    );
  }

  if (
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
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      'lineage must include interface, dry-run, mapping, warehouse-ready, canonical, staging, handoff, parsed, and raw artifact references'
    );
  }

  if (
    warehouseAdapterInterfaceVersionUsed &&
    warehouseAdapterInterfaceVersionUsed !==
      FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION
  ) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `lineage.warehouseAdapterInterfaceVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION} when present`
    );
  }

  if (
    warehouseAdapterDryRunVersion !== FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION
  ) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `lineage.warehouseAdapterDryRunVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION}`
    );
  }

  if (
    warehouseAdapterMappingVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION
  ) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `lineage.warehouseAdapterMappingVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION}`
    );
  }

  if (
    warehouseReadyContractVersion !== FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `lineage.warehouseReadyContractVersion must be ${FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION}`
    );
  }

  if (canonicalIngestVersion !== FIRST_REPORT_CANONICAL_INGEST_VERSION) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `lineage.canonicalIngestVersion must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (!Array.isArray(artifact?.sections)) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      'sections must be an array'
    );
  }

  if (!interfacePayload || !Array.isArray(interfacePayload.targetInterfaces)) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      'interfacePayload.targetInterfaces must be an array'
    );
  }

  if (interfacePayload.mode !== 'interface_only') {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      'interfacePayload.mode must be interface_only'
    );
  }

  if (interfacePayload.writesAttempted !== false) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      'interfacePayload.writesAttempted must be false'
    );
  }

  if (interfacePayload.implementationPresent !== false) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      'interfacePayload.implementationPresent must be false'
    );
  }

  if (interfacePayload.executionAllowed !== false) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      'interfacePayload.executionAllowed must be false'
    );
  }

  const sections = artifact.sections.map((section, index) =>
    parseSectionSummary(section, index)
  );
  const targetInterfaces = interfacePayload.targetInterfaces.map((targetInterface, index) =>
    parseTargetInterface(targetInterface, index)
  );
  const totalRowCount = asNonNegativeInteger(artifact?.totalRowCount, 'totalRowCount');

  if (sections.length !== targetInterfaces.length) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      'sections and interfacePayload.targetInterfaces must have the same length'
    );
  }

  const summedRows = sections.reduce((sum, section) => sum + section.rowCount, 0);
  if (summedRows !== totalRowCount) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      'totalRowCount must equal the sum of section row counts'
    );
  }

  sections.forEach((section, index) => {
    const targetInterface = targetInterfaces[index];

    if (section.sectionName !== targetInterface.sectionName) {
      throw new FirstReportWarehouseNoopError(
        'invalid_content',
        `target interface ${index} section name does not match section summary`
      );
    }

    if (section.targetTableName !== targetInterface.targetTableName) {
      throw new FirstReportWarehouseNoopError(
        'invalid_content',
        `target interface ${section.sectionName} target table name does not match section summary`
      );
    }
  });

  return {
    warehouseAdapterInterfaceVersion:
      FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION,
    reportId,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    lineage: {
      ...(warehouseInterfaceArtifactPath
        ? { warehouseInterfaceArtifactPath: path.resolve(warehouseInterfaceArtifactPath) }
        : {}),
      ...(warehouseAdapterInterfaceVersionUsed
        ? { warehouseAdapterInterfaceVersion: warehouseAdapterInterfaceVersionUsed }
        : {}),
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
    } as ValidatedInterfaceArtifact['lineage'],
    sections,
    totalRowCount,
    interfacePayload: {
      mode: 'interface_only',
      writesAttempted: false,
      implementationPresent: false,
      executionAllowed: false,
      targetInterfaces,
    },
  };
};

const deriveReportIdFromWarehouseInterfaceArtifactPath = (
  warehouseInterfaceArtifactPath: string
) => {
  const match = path.basename(warehouseInterfaceArtifactPath).match(
    WAREHOUSE_INTERFACE_ARTIFACT_NAME_RE
  );
  const reportId = match?.groups?.reportId?.trim();

  return reportId && reportId.length > 0 ? reportId : null;
};

export const resolveFirstSalesTrafficWarehouseInterfaceArtifactPath = async (
  args: {
    reportId?: string;
    warehouseInterfaceArtifactPath?: string;
    warehouseInterfaceOutputRoot?: string;
  }
) => {
  const warehouseInterfaceArtifactPath =
    args.warehouseInterfaceArtifactPath?.trim();
  const explicitReportId = args.reportId?.trim();

  if (warehouseInterfaceArtifactPath) {
    const derivedReportId = deriveReportIdFromWarehouseInterfaceArtifactPath(
      warehouseInterfaceArtifactPath
    );

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new FirstReportWarehouseNoopError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match warehouse interface artifact path ${path.basename(
          warehouseInterfaceArtifactPath
        )}`
      );
    }

    try {
      await fs.access(warehouseInterfaceArtifactPath);
    } catch (error) {
      throw new FirstReportWarehouseNoopError(
        'artifact_not_found',
        `SP-API warehouse interface artifact not found at ${warehouseInterfaceArtifactPath}`,
        error
      );
    }

    const reportId = explicitReportId ?? derivedReportId;
    if (!reportId) {
      throw new FirstReportWarehouseNoopError(
        'invalid_input',
        'Warehouse interface artifact path must follow the V2-14 deterministic naming or be paired with --report-id'
      );
    }

    return {
      reportId,
      warehouseInterfaceArtifactPath: path.resolve(warehouseInterfaceArtifactPath),
    };
  }

  if (!explicitReportId) {
    throw new FirstReportWarehouseNoopError(
      'invalid_input',
      'Warehouse noop implementation requires either --report-id <value> or --warehouse-interface-path <value>'
    );
  }

  const candidate = path.resolve(
    args.warehouseInterfaceOutputRoot ??
      path.resolve(process.cwd(), 'out', 'sp-api-warehouse-interface'),
    `report-${explicitReportId}.warehouse-interface.json`
  );

  try {
    await fs.access(candidate);
  } catch (error) {
    throw new FirstReportWarehouseNoopError(
      'artifact_not_found',
      `SP-API warehouse interface artifact not found for report ${explicitReportId} under ${
        args.warehouseInterfaceOutputRoot ??
        path.resolve(process.cwd(), 'out', 'sp-api-warehouse-interface')
      }`,
      error
    );
  }

  return {
    reportId: explicitReportId,
    warehouseInterfaceArtifactPath: candidate,
  };
};

export const readFirstSalesTrafficWarehouseAdapterInterfaceArtifact = async (
  args: {
    warehouseInterfaceArtifactPath: string;
  }
): Promise<ValidatedInterfaceArtifact> => {
  const warehouseInterfaceArtifactPath = path.resolve(
    args.warehouseInterfaceArtifactPath
  );

  let text: string;
  try {
    text = await fs.readFile(warehouseInterfaceArtifactPath, 'utf8');
  } catch (error) {
    throw new FirstReportWarehouseNoopError(
      'artifact_not_found',
      `Failed to read SP-API warehouse interface artifact at ${warehouseInterfaceArtifactPath}`,
      error
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new FirstReportWarehouseNoopError(
      'invalid_content',
      `SP-API warehouse interface artifact at ${warehouseInterfaceArtifactPath} is not valid JSON`,
      error
    );
  }

  return parseFirstSalesTrafficWarehouseInterfaceArtifact(parsed);
};

export const buildFirstSalesTrafficWarehouseAdapterNoop = (args: {
  interfaceArtifact: ValidatedInterfaceArtifact;
  warehouseInterfaceArtifactPath: string;
}): FirstReportWarehouseAdapterNoopArtifact => {
  const noopArtifact: FirstReportWarehouseAdapterNoopArtifact = {
    warehouseAdapterNoopVersion: FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION,
    reportId: args.interfaceArtifact.reportId,
    reportFamily: args.interfaceArtifact.reportFamily,
    reportType: args.interfaceArtifact.reportType,
    lineage: {
      warehouseInterfaceArtifactPath: path.resolve(args.warehouseInterfaceArtifactPath),
      warehouseAdapterInterfaceVersion:
        args.interfaceArtifact.warehouseAdapterInterfaceVersion,
      warehouseDryRunArtifactPath:
        args.interfaceArtifact.lineage.warehouseDryRunArtifactPath,
      warehouseAdapterDryRunVersion:
        args.interfaceArtifact.lineage.warehouseAdapterDryRunVersion,
      warehouseMappingArtifactPath:
        args.interfaceArtifact.lineage.warehouseMappingArtifactPath,
      warehouseAdapterMappingVersion:
        args.interfaceArtifact.lineage.warehouseAdapterMappingVersion,
      warehouseReadyArtifactPath:
        args.interfaceArtifact.lineage.warehouseReadyArtifactPath,
      warehouseReadyContractVersion:
        args.interfaceArtifact.lineage.warehouseReadyContractVersion,
      canonicalIngestArtifactPath:
        args.interfaceArtifact.lineage.canonicalIngestArtifactPath,
      canonicalIngestVersion:
        args.interfaceArtifact.lineage.canonicalIngestVersion,
      stagingArtifactPath: args.interfaceArtifact.lineage.stagingArtifactPath,
      stagingVersion: args.interfaceArtifact.lineage.stagingVersion,
      handoffArtifactPath: args.interfaceArtifact.lineage.handoffArtifactPath,
      handoffSchemaVersion: args.interfaceArtifact.lineage.handoffSchemaVersion,
      parsedArtifactPath: args.interfaceArtifact.lineage.parsedArtifactPath,
      rawArtifactPath: args.interfaceArtifact.lineage.rawArtifactPath,
    },
    sections: args.interfaceArtifact.sections.map((section) => ({
      sectionName: section.sectionName,
      headerCount: section.headerCount,
      rowCount: section.rowCount,
      targetTableName: section.targetTableName,
    })),
    totalRowCount: args.interfaceArtifact.totalRowCount,
    noopPayload: {
      mode: 'noop',
      writesAttempted: false,
      realTransportPresent: false,
      targetHandlers: args.interfaceArtifact.interfacePayload.targetInterfaces.map(
        (targetInterface) => ({
          sectionName: targetInterface.sectionName,
          targetTableName: targetInterface.targetTableName,
          operationName: targetInterface.operationName,
          keyColumns: [...targetInterface.keyColumns],
          mappedColumnCount: targetInterface.mappedColumnCount,
          requestStub: {
            acceptedArtifactType: 'warehouse_adapter_interface_artifact',
            acceptedArtifactVersion:
              args.interfaceArtifact.warehouseAdapterInterfaceVersion,
            requiredFields: [
              'reportId',
              'reportFamily',
              'reportType',
              'lineage',
              'sections',
              'totalRowCount',
              'interfacePayload',
            ],
            acceptedMode: 'interface_only',
            acceptedOperationName: targetInterface.operationName,
          },
          responseStub: {
            resultType: 'warehouse_adapter_noop_result',
            status: 'skipped_noop',
            requiredFields: [
              'status',
              'operationName',
              'targetTableName',
              'writesAttempted',
              'executionAllowed',
              'executionResult',
              'skipReason',
            ],
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
        })
      ),
    },
  };

  validateFirstSalesTrafficWarehouseAdapterNoop({
    interfaceArtifact: args.interfaceArtifact,
    noopArtifact,
  });

  return noopArtifact;
};

export const validateFirstSalesTrafficWarehouseAdapterNoop = (args: {
  interfaceArtifact: ValidatedInterfaceArtifact;
  noopArtifact: FirstReportWarehouseAdapterNoopArtifact;
}) => {
  const noopArtifact = args.noopArtifact;

  if (
    noopArtifact.warehouseAdapterNoopVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION
  ) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      `warehouseAdapterNoopVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION}`
    );
  }

  if (noopArtifact.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      'reportFamily must be sales_and_traffic'
    );
  }

  if (noopArtifact.reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      `reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!noopArtifact.reportId.trim()) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      'reportId must be a non-empty string'
    );
  }

  if (
    noopArtifact.lineage.warehouseAdapterInterfaceVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION
  ) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      `lineage.warehouseAdapterInterfaceVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION}`
    );
  }

  if (
    noopArtifact.lineage.warehouseAdapterDryRunVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION
  ) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      `lineage.warehouseAdapterDryRunVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION}`
    );
  }

  if (
    noopArtifact.lineage.warehouseAdapterMappingVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION
  ) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      `lineage.warehouseAdapterMappingVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION}`
    );
  }

  if (
    noopArtifact.lineage.warehouseReadyContractVersion !==
    FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      `lineage.warehouseReadyContractVersion must be ${FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION}`
    );
  }

  if (
    noopArtifact.lineage.canonicalIngestVersion !==
    FIRST_REPORT_CANONICAL_INGEST_VERSION
  ) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      `lineage.canonicalIngestVersion must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (
    !noopArtifact.lineage.warehouseInterfaceArtifactPath.trim() ||
    !noopArtifact.lineage.warehouseDryRunArtifactPath.trim() ||
    !noopArtifact.lineage.warehouseMappingArtifactPath.trim() ||
    !noopArtifact.lineage.warehouseReadyArtifactPath.trim() ||
    !noopArtifact.lineage.canonicalIngestArtifactPath.trim() ||
    !noopArtifact.lineage.stagingArtifactPath.trim() ||
    !noopArtifact.lineage.stagingVersion.trim() ||
    !noopArtifact.lineage.handoffArtifactPath.trim() ||
    !noopArtifact.lineage.handoffSchemaVersion.trim() ||
    !noopArtifact.lineage.parsedArtifactPath.trim() ||
    !noopArtifact.lineage.rawArtifactPath.trim()
  ) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      'lineage must include interface, dry-run, mapping, warehouse-ready, canonical, staging, handoff, parsed, and raw artifact details'
    );
  }

  if (noopArtifact.sections.length !== args.interfaceArtifact.sections.length) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      'sections must match the warehouse interface artifact'
    );
  }

  if (
    noopArtifact.noopPayload.targetHandlers.length !==
    args.interfaceArtifact.interfacePayload.targetInterfaces.length
  ) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      'noopPayload.targetHandlers count must match the warehouse interface target interfaces'
    );
  }

  const summedRows = noopArtifact.sections.reduce(
    (sum, section) => sum + section.rowCount,
    0
  );
  if (summedRows !== noopArtifact.totalRowCount) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      'totalRowCount must equal the sum of section row counts'
    );
  }

  if (noopArtifact.noopPayload.mode !== 'noop') {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      'noopPayload.mode must be noop'
    );
  }

  if (noopArtifact.noopPayload.writesAttempted !== false) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      'noopPayload.writesAttempted must be false'
    );
  }

  if (noopArtifact.noopPayload.realTransportPresent !== false) {
    throw new FirstReportWarehouseNoopError(
      'validation_failed',
      'noopPayload.realTransportPresent must be false'
    );
  }

  args.interfaceArtifact.sections.forEach((section, index) => {
    const targetInterface =
      args.interfaceArtifact.interfacePayload.targetInterfaces[index];
    const targetHandler = noopArtifact.noopPayload.targetHandlers[index];

    if (targetHandler.sectionName !== section.sectionName) {
      throw new FirstReportWarehouseNoopError(
        'validation_failed',
        `noop target handler ${index} section name does not match warehouse interface`
      );
    }

    if (targetHandler.targetTableName !== section.targetTableName) {
      throw new FirstReportWarehouseNoopError(
        'validation_failed',
        `noop target handler ${section.sectionName} target table name does not match warehouse interface`
      );
    }

    if (targetHandler.operationName !== targetInterface.operationName) {
      throw new FirstReportWarehouseNoopError(
        'validation_failed',
        `noop target handler ${section.sectionName} operationName must match the warehouse interface`
      );
    }

    if (
      targetHandler.keyColumns.join('\n') !== targetInterface.keyColumns.join('\n')
    ) {
      throw new FirstReportWarehouseNoopError(
        'validation_failed',
        `noop target handler ${section.sectionName} keyColumns must match the warehouse interface`
      );
    }

    if (
      targetHandler.mappedColumnCount !== targetInterface.mappedColumnCount
    ) {
      throw new FirstReportWarehouseNoopError(
        'validation_failed',
        `noop target handler ${section.sectionName} mappedColumnCount must match the warehouse interface`
      );
    }

    if (
      targetHandler.requestStub.acceptedArtifactType !==
      'warehouse_adapter_interface_artifact'
    ) {
      throw new FirstReportWarehouseNoopError(
        'validation_failed',
        `noop target handler ${section.sectionName} requestStub.acceptedArtifactType must be warehouse_adapter_interface_artifact`
      );
    }

    if (
      targetHandler.requestStub.acceptedArtifactVersion !==
      FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION
    ) {
      throw new FirstReportWarehouseNoopError(
        'validation_failed',
        `noop target handler ${section.sectionName} requestStub.acceptedArtifactVersion must match the warehouse interface version`
      );
    }

    if (targetHandler.requestStub.acceptedMode !== 'interface_only') {
      throw new FirstReportWarehouseNoopError(
        'validation_failed',
        `noop target handler ${section.sectionName} requestStub.acceptedMode must be interface_only`
      );
    }

    if (
      targetHandler.requestStub.acceptedOperationName !==
      targetInterface.operationName
    ) {
      throw new FirstReportWarehouseNoopError(
        'validation_failed',
        `noop target handler ${section.sectionName} requestStub.acceptedOperationName must match the warehouse interface operationName`
      );
    }

    if (
      targetHandler.responseStub.resultType !== 'warehouse_adapter_noop_result' ||
      targetHandler.responseStub.status !== 'skipped_noop' ||
      targetHandler.responseStub.writesAttempted !== false ||
      targetHandler.responseStub.executionAllowed !== false
    ) {
      throw new FirstReportWarehouseNoopError(
        'validation_failed',
        `noop target handler ${section.sectionName} responseStub must match the no-op result contract`
      );
    }

    if (
      targetHandler.executionState.mode !== 'noop' ||
      targetHandler.executionState.writesAttempted !== false ||
      targetHandler.executionState.implementationPresent !== true ||
      targetHandler.executionState.executionAllowed !== false ||
      targetHandler.executionState.executionResult !== 'skipped_noop' ||
      targetHandler.executionState.skipReason !== 'no_real_write_allowed'
    ) {
      throw new FirstReportWarehouseNoopError(
        'validation_failed',
        `noop target handler ${section.sectionName} executionState must match the bounded no-op contract`
      );
    }
  });
};

export const buildFirstSalesTrafficWarehouseAdapterNoopPath = (args: {
  reportId: string;
  outputRoot?: string;
}) =>
  path.resolve(
    args.outputRoot ?? FIRST_REPORT_WAREHOUSE_NOOP_OUTPUT_DIR,
    `report-${args.reportId}.warehouse-noop.json`
  );

export const writeFirstSalesTrafficWarehouseAdapterNoop = async (args: {
  noopArtifact: FirstReportWarehouseAdapterNoopArtifact;
  outputRoot?: string;
}) => {
  const warehouseNoopArtifactPath = buildFirstSalesTrafficWarehouseAdapterNoopPath({
    reportId: args.noopArtifact.reportId,
    outputRoot: args.outputRoot,
  });

  try {
    await fs.mkdir(path.dirname(warehouseNoopArtifactPath), { recursive: true });
    await fs.writeFile(
      warehouseNoopArtifactPath,
      `${JSON.stringify(args.noopArtifact, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    throw new FirstReportWarehouseNoopError(
      'write_failed',
      `Failed to write SP-API warehouse noop artifact to ${warehouseNoopArtifactPath}`,
      error
    );
  }

  return warehouseNoopArtifactPath;
};

export const summarizeFirstSalesTrafficWarehouseAdapterNoop = (args: {
  warehouseInterfaceArtifactPath: string;
  warehouseNoopArtifactPath: string;
  noopArtifact: FirstReportWarehouseAdapterNoopArtifact;
}): FirstReportWarehouseAdapterNoopSummary => ({
  endpoint: 'runFirstSalesTrafficWarehouseAdapterNoopImplementation',
  reportId: args.noopArtifact.reportId,
  reportFamily: args.noopArtifact.reportFamily,
  reportType: args.noopArtifact.reportType,
  warehouseInterfaceArtifactPath: path.resolve(args.warehouseInterfaceArtifactPath),
  warehouseNoopArtifactPath: path.resolve(args.warehouseNoopArtifactPath),
  warehouseAdapterNoopVersion: args.noopArtifact.warehouseAdapterNoopVersion,
  sectionCount: args.noopArtifact.sections.length,
  totalRowCount: args.noopArtifact.totalRowCount,
  targetTableNames: args.noopArtifact.noopPayload.targetHandlers.map(
    (handler) => handler.targetTableName
  ),
  operationNames: args.noopArtifact.noopPayload.targetHandlers.map(
    (handler) => handler.operationName
  ),
  executionStates: args.noopArtifact.noopPayload.targetHandlers.map(
    (handler) => handler.executionState
  ),
  sections: args.noopArtifact.sections.map((section) => ({
    sectionName: section.sectionName,
    headerCount: section.headerCount,
    rowCount: section.rowCount,
    targetTableName: section.targetTableName,
  })),
});

export const runFirstSalesTrafficWarehouseAdapterNoopImplementation = async (
  args: {
    reportId?: string;
    warehouseInterfaceArtifactPath?: string;
    warehouseInterfaceOutputRoot?: string;
    warehouseNoopOutputRoot?: string;
  }
): Promise<FirstReportWarehouseAdapterNoopSummary> => {
  const resolved = await resolveFirstSalesTrafficWarehouseInterfaceArtifactPath({
    reportId: args.reportId,
    warehouseInterfaceArtifactPath: args.warehouseInterfaceArtifactPath,
    warehouseInterfaceOutputRoot: args.warehouseInterfaceOutputRoot,
  });
  const interfaceArtifact =
    await readFirstSalesTrafficWarehouseAdapterInterfaceArtifact({
      warehouseInterfaceArtifactPath: resolved.warehouseInterfaceArtifactPath,
    });
  const noopArtifact = buildFirstSalesTrafficWarehouseAdapterNoop({
    interfaceArtifact,
    warehouseInterfaceArtifactPath: resolved.warehouseInterfaceArtifactPath,
  });
  const warehouseNoopArtifactPath = await writeFirstSalesTrafficWarehouseAdapterNoop({
    noopArtifact,
    outputRoot: args.warehouseNoopOutputRoot,
  });

  return summarizeFirstSalesTrafficWarehouseAdapterNoop({
    warehouseInterfaceArtifactPath: resolved.warehouseInterfaceArtifactPath,
    warehouseNoopArtifactPath,
    noopArtifact,
  });
};
