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
import {
  FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION,
  type FirstReportWarehouseAdapterDryRunArtifact,
} from './firstSalesTrafficWarehouseDryRun';

export const FIRST_REPORT_WAREHOUSE_INTERFACE_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-warehouse-interface'
);

export const FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION =
  'sp-api-first-report-warehouse-adapter-interface/v1';

type DryRunTargetOperation = {
  sectionName: string;
  targetTableName: string;
  sourceBatchPath: string;
  plannedOperation: 'prepare_local_dry_run_warehouse_adapter_batch';
  operationStatus: 'dry_run_only';
  keyColumns: string[];
  mappedColumnCount: number;
  sourceRowCount: number;
  writesAttempted: false;
  writesAttemptedCount: 0;
  writesSkippedReason: string;
  dryRunPreview: {
    sampleWarehouseRecordIds: string[];
    sampleCanonicalRecordIds: string[];
  };
};

type ValidatedDryRunArtifact = Omit<
  FirstReportWarehouseAdapterDryRunArtifact,
  'dryRunPayload'
> & {
  dryRunPayload: {
    mode: 'dry_run';
    writesAttempted: false;
    writesAttemptedCount: 0;
    targetOperations: DryRunTargetOperation[];
  };
};

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

export type FirstReportWarehouseAdapterInterfaceArtifact = {
  warehouseAdapterInterfaceVersion: typeof FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION;
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  lineage: {
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
  interfacePayload: {
    mode: 'interface_only';
    writesAttempted: false;
    implementationPresent: false;
    executionAllowed: false;
    targetInterfaces: TargetInterface[];
  };
};

export type FirstReportWarehouseAdapterInterfaceSummary = {
  endpoint: 'runFirstSalesTrafficWarehouseAdapterInterfaceDefinition';
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  warehouseDryRunArtifactPath: string;
  warehouseInterfaceArtifactPath: string;
  warehouseAdapterInterfaceVersion: string;
  sectionCount: number;
  totalRowCount: number;
  targetTableNames: string[];
  operationNames: string[];
  sections: FirstReportWarehouseMappingSectionSummary[];
};

export class FirstReportWarehouseInterfaceError extends Error {
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
    this.name = 'FirstReportWarehouseInterfaceError';
    this.code = code;
    this.details = details;
  }
}

const WAREHOUSE_DRY_RUN_ARTIFACT_NAME_RE =
  /^report-(?<reportId>.+)\.warehouse-dry-run\.json$/;

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
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `${fieldName} must be an array of strings`
    );
  }

  return value.map((entry, index) => {
    const parsed = asString(entry);
    if (!parsed) {
      throw new FirstReportWarehouseInterfaceError(
        'invalid_content',
        `${fieldName}[${index}] must be a non-empty string`
      );
    }

    return parsed;
  });
};

const asNonNegativeInteger = (value: unknown, fieldName: string) => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new FirstReportWarehouseInterfaceError(
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
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `sections[${index}].sectionName must be a non-empty string`
    );
  }

  if (!targetTableName) {
    throw new FirstReportWarehouseInterfaceError(
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

const parseTargetOperation = (
  value: unknown,
  index: number
): DryRunTargetOperation => {
  const operation = asObject(value);
  const sectionName = asString(operation?.sectionName);
  const targetTableName = asString(operation?.targetTableName);
  const sourceBatchPath = asString(operation?.sourceBatchPath);
  const plannedOperation = operation?.plannedOperation;
  const operationStatus = operation?.operationStatus;
  const writesSkippedReason = asString(operation?.writesSkippedReason);
  const dryRunPreview = asObject(operation?.dryRunPreview);

  if (!sectionName || !targetTableName || !sourceBatchPath || !writesSkippedReason) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `dryRunPayload.targetOperations[${index}] must include sectionName, targetTableName, sourceBatchPath, and writesSkippedReason`
    );
  }

  if (plannedOperation !== 'prepare_local_dry_run_warehouse_adapter_batch') {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `dryRunPayload.targetOperations[${index}].plannedOperation must be prepare_local_dry_run_warehouse_adapter_batch`
    );
  }

  if (operationStatus !== 'dry_run_only') {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `dryRunPayload.targetOperations[${index}].operationStatus must be dry_run_only`
    );
  }

  if (operation?.writesAttempted !== false) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `dryRunPayload.targetOperations[${index}].writesAttempted must be false`
    );
  }

  if (operation?.writesAttemptedCount !== 0) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `dryRunPayload.targetOperations[${index}].writesAttemptedCount must be 0`
    );
  }

  if (!dryRunPreview) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `dryRunPayload.targetOperations[${index}].dryRunPreview must be an object`
    );
  }

  return {
    sectionName,
    targetTableName,
    sourceBatchPath,
    plannedOperation: 'prepare_local_dry_run_warehouse_adapter_batch',
    operationStatus: 'dry_run_only',
    keyColumns: asStringArray(
      operation?.keyColumns,
      `dryRunPayload.targetOperations[${index}].keyColumns`
    ),
    mappedColumnCount: asNonNegativeInteger(
      operation?.mappedColumnCount,
      `dryRunPayload.targetOperations[${index}].mappedColumnCount`
    ),
    sourceRowCount: asNonNegativeInteger(
      operation?.sourceRowCount,
      `dryRunPayload.targetOperations[${index}].sourceRowCount`
    ),
    writesAttempted: false,
    writesAttemptedCount: 0,
    writesSkippedReason,
    dryRunPreview: {
      sampleWarehouseRecordIds: asStringArray(
        dryRunPreview.sampleWarehouseRecordIds,
        `dryRunPayload.targetOperations[${index}].dryRunPreview.sampleWarehouseRecordIds`
      ),
      sampleCanonicalRecordIds: asStringArray(
        dryRunPreview.sampleCanonicalRecordIds,
        `dryRunPayload.targetOperations[${index}].dryRunPreview.sampleCanonicalRecordIds`
      ),
    },
  };
};

const parseFirstSalesTrafficWarehouseDryRunArtifact = (
  value: unknown
): ValidatedDryRunArtifact => {
  const artifact = asObject(value);
  const reportId = asString(artifact?.reportId);
  const reportType = asString(artifact?.reportType);
  const lineage = asObject(artifact?.lineage);
  const dryRunPayload = asObject(artifact?.dryRunPayload);
  const warehouseAdapterDryRunVersion = asString(
    artifact?.warehouseAdapterDryRunVersion
  );
  const warehouseDryRunTarget = artifact?.dryRunTarget;
  const warehouseDryRunTargetDescription = asString(
    artifact?.dryRunTargetDescription
  );

  const warehouseReadyArtifactPath = asString(lineage?.warehouseReadyArtifactPath);
  const warehouseReadyContractVersion = asString(
    lineage?.warehouseReadyContractVersion
  );
  const warehouseMappingArtifactPath = asString(
    lineage?.warehouseMappingArtifactPath
  );
  const warehouseAdapterMappingVersion = asString(
    lineage?.warehouseAdapterMappingVersion
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
    warehouseAdapterDryRunVersion !== FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION
  ) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `warehouseAdapterDryRunVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION}`
    );
  }

  if (warehouseDryRunTarget !== 'local_json_warehouse_adapter_dry_run') {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      'dryRunTarget must be local_json_warehouse_adapter_dry_run'
    );
  }

  if (!warehouseDryRunTargetDescription) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      'dryRunTargetDescription must be a non-empty string'
    );
  }

  if (artifact?.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      'reportFamily must be sales_and_traffic'
    );
  }

  if (reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!reportId) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      'reportId must be a non-empty string'
    );
  }

  if (
    !warehouseReadyArtifactPath ||
    !warehouseReadyContractVersion ||
    !warehouseMappingArtifactPath ||
    !warehouseAdapterMappingVersion ||
    !canonicalIngestArtifactPath ||
    !canonicalIngestVersion ||
    !stagingArtifactPath ||
    !stagingVersion ||
    !handoffArtifactPath ||
    !handoffSchemaVersion ||
    !parsedArtifactPath ||
    !rawArtifactPath
  ) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      'lineage must include dry-run, mapping, warehouse-ready, canonical, staging, handoff, parsed, and raw artifact references'
    );
  }

  if (
    warehouseReadyContractVersion !== FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `lineage.warehouseReadyContractVersion must be ${FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION}`
    );
  }

  if (
    warehouseAdapterMappingVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION
  ) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `lineage.warehouseAdapterMappingVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION}`
    );
  }

  if (canonicalIngestVersion !== FIRST_REPORT_CANONICAL_INGEST_VERSION) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `lineage.canonicalIngestVersion must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (!Array.isArray(artifact?.sections)) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      'sections must be an array'
    );
  }

  if (!dryRunPayload || !Array.isArray(dryRunPayload.targetOperations)) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      'dryRunPayload.targetOperations must be an array'
    );
  }

  if (dryRunPayload.mode !== 'dry_run') {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      'dryRunPayload.mode must be dry_run'
    );
  }

  if (dryRunPayload.writesAttempted !== false) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      'dryRunPayload.writesAttempted must be false'
    );
  }

  if (dryRunPayload.writesAttemptedCount !== 0) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      'dryRunPayload.writesAttemptedCount must be 0'
    );
  }

  const sections = artifact.sections.map((section, index) =>
    parseSectionSummary(section, index)
  );
  const targetOperations = dryRunPayload.targetOperations.map((operation, index) =>
    parseTargetOperation(operation, index)
  );
  const totalRowCount = asNonNegativeInteger(artifact?.totalRowCount, 'totalRowCount');

  if (sections.length !== targetOperations.length) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      'sections and dryRunPayload.targetOperations must have the same length'
    );
  }

  const summedRows = sections.reduce((sum, section) => sum + section.rowCount, 0);
  if (summedRows !== totalRowCount) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      'totalRowCount must equal the sum of section row counts'
    );
  }

  sections.forEach((section, index) => {
    const targetOperation = targetOperations[index];

    if (section.sectionName !== targetOperation.sectionName) {
      throw new FirstReportWarehouseInterfaceError(
        'invalid_content',
        `target operation ${index} section name does not match section summary`
      );
    }

    if (section.targetTableName !== targetOperation.targetTableName) {
      throw new FirstReportWarehouseInterfaceError(
        'invalid_content',
        `target operation ${section.sectionName} target table name does not match section summary`
      );
    }

    if (section.rowCount !== targetOperation.sourceRowCount) {
      throw new FirstReportWarehouseInterfaceError(
        'invalid_content',
        `target operation ${section.sectionName} source row count does not match section summary`
      );
    }
  });

  return {
    warehouseAdapterDryRunVersion:
      FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION,
    dryRunTarget: 'local_json_warehouse_adapter_dry_run',
    dryRunTargetDescription: warehouseDryRunTargetDescription,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    reportId,
    lineage: {
      warehouseReadyArtifactPath: path.resolve(warehouseReadyArtifactPath),
      warehouseReadyContractVersion,
      warehouseMappingArtifactPath: path.resolve(warehouseMappingArtifactPath),
      warehouseAdapterMappingVersion,
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
    dryRunPayload: {
      mode: 'dry_run',
      writesAttempted: false,
      writesAttemptedCount: 0,
      targetOperations,
    },
  };
};

const deriveReportIdFromWarehouseDryRunArtifactPath = (
  warehouseDryRunArtifactPath: string
) => {
  const match = path.basename(warehouseDryRunArtifactPath).match(
    WAREHOUSE_DRY_RUN_ARTIFACT_NAME_RE
  );
  const reportId = match?.groups?.reportId?.trim();

  return reportId && reportId.length > 0 ? reportId : null;
};

const buildOperationName = (targetTableName: string) =>
  `execute_${targetTableName}_warehouse_adapter_write`;

export const resolveFirstSalesTrafficWarehouseDryRunArtifactPath = async (args: {
  reportId?: string;
  warehouseDryRunArtifactPath?: string;
  warehouseDryRunOutputRoot?: string;
}) => {
  const warehouseDryRunArtifactPath = args.warehouseDryRunArtifactPath?.trim();
  const explicitReportId = args.reportId?.trim();

  if (warehouseDryRunArtifactPath) {
    const derivedReportId = deriveReportIdFromWarehouseDryRunArtifactPath(
      warehouseDryRunArtifactPath
    );

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new FirstReportWarehouseInterfaceError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match warehouse dry-run artifact path ${path.basename(
          warehouseDryRunArtifactPath
        )}`
      );
    }

    try {
      await fs.access(warehouseDryRunArtifactPath);
    } catch (error) {
      throw new FirstReportWarehouseInterfaceError(
        'artifact_not_found',
        `SP-API warehouse dry-run artifact not found at ${warehouseDryRunArtifactPath}`,
        error
      );
    }

    const reportId = explicitReportId ?? derivedReportId;
    if (!reportId) {
      throw new FirstReportWarehouseInterfaceError(
        'invalid_input',
        'Warehouse dry-run artifact path must follow the V2-13 deterministic naming or be paired with --report-id'
      );
    }

    return {
      reportId,
      warehouseDryRunArtifactPath: path.resolve(warehouseDryRunArtifactPath),
    };
  }

  if (!explicitReportId) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_input',
      'Warehouse interface definition requires either --report-id <value> or --warehouse-dry-run-path <value>'
    );
  }

  const candidate = path.resolve(
    args.warehouseDryRunOutputRoot ??
      path.resolve(process.cwd(), 'out', 'sp-api-warehouse-dry-run'),
    `report-${explicitReportId}.warehouse-dry-run.json`
  );

  try {
    await fs.access(candidate);
  } catch (error) {
    throw new FirstReportWarehouseInterfaceError(
      'artifact_not_found',
      `SP-API warehouse dry-run artifact not found for report ${explicitReportId} under ${
        args.warehouseDryRunOutputRoot ??
        path.resolve(process.cwd(), 'out', 'sp-api-warehouse-dry-run')
      }`,
      error
    );
  }

  return {
    reportId: explicitReportId,
    warehouseDryRunArtifactPath: candidate,
  };
};

export const readFirstSalesTrafficWarehouseAdapterDryRunArtifact = async (args: {
  warehouseDryRunArtifactPath: string;
}): Promise<ValidatedDryRunArtifact> => {
  const warehouseDryRunArtifactPath = path.resolve(args.warehouseDryRunArtifactPath);

  let text: string;
  try {
    text = await fs.readFile(warehouseDryRunArtifactPath, 'utf8');
  } catch (error) {
    throw new FirstReportWarehouseInterfaceError(
      'artifact_not_found',
      `Failed to read SP-API warehouse dry-run artifact at ${warehouseDryRunArtifactPath}`,
      error
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new FirstReportWarehouseInterfaceError(
      'invalid_content',
      `SP-API warehouse dry-run artifact at ${warehouseDryRunArtifactPath} is not valid JSON`,
      error
    );
  }

  return parseFirstSalesTrafficWarehouseDryRunArtifact(parsed);
};

export const buildFirstSalesTrafficWarehouseAdapterInterface = (args: {
  warehouseDryRunArtifact: ValidatedDryRunArtifact;
  warehouseDryRunArtifactPath: string;
}): FirstReportWarehouseAdapterInterfaceArtifact => {
  const interfaceArtifact: FirstReportWarehouseAdapterInterfaceArtifact = {
    warehouseAdapterInterfaceVersion:
      FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION,
    reportId: args.warehouseDryRunArtifact.reportId,
    reportFamily: args.warehouseDryRunArtifact.reportFamily,
    reportType: args.warehouseDryRunArtifact.reportType,
    lineage: {
      warehouseDryRunArtifactPath: path.resolve(args.warehouseDryRunArtifactPath),
      warehouseAdapterDryRunVersion:
        args.warehouseDryRunArtifact.warehouseAdapterDryRunVersion,
      warehouseMappingArtifactPath:
        args.warehouseDryRunArtifact.lineage.warehouseMappingArtifactPath,
      warehouseAdapterMappingVersion:
        args.warehouseDryRunArtifact.lineage.warehouseAdapterMappingVersion,
      warehouseReadyArtifactPath:
        args.warehouseDryRunArtifact.lineage.warehouseReadyArtifactPath,
      warehouseReadyContractVersion:
        args.warehouseDryRunArtifact.lineage.warehouseReadyContractVersion,
      canonicalIngestArtifactPath:
        args.warehouseDryRunArtifact.lineage.canonicalIngestArtifactPath,
      canonicalIngestVersion:
        args.warehouseDryRunArtifact.lineage.canonicalIngestVersion,
      stagingArtifactPath: args.warehouseDryRunArtifact.lineage.stagingArtifactPath,
      stagingVersion: args.warehouseDryRunArtifact.lineage.stagingVersion,
      handoffArtifactPath: args.warehouseDryRunArtifact.lineage.handoffArtifactPath,
      handoffSchemaVersion:
        args.warehouseDryRunArtifact.lineage.handoffSchemaVersion,
      parsedArtifactPath: args.warehouseDryRunArtifact.lineage.parsedArtifactPath,
      rawArtifactPath: args.warehouseDryRunArtifact.lineage.rawArtifactPath,
    },
    sections: args.warehouseDryRunArtifact.sections.map((section) => ({
      sectionName: section.sectionName,
      headerCount: section.headerCount,
      rowCount: section.rowCount,
      targetTableName: section.targetTableName,
    })),
    totalRowCount: args.warehouseDryRunArtifact.totalRowCount,
    interfacePayload: {
      mode: 'interface_only',
      writesAttempted: false,
      implementationPresent: false,
      executionAllowed: false,
      targetInterfaces: args.warehouseDryRunArtifact.dryRunPayload.targetOperations.map(
        (targetOperation) => ({
          sectionName: targetOperation.sectionName,
          targetTableName: targetOperation.targetTableName,
          operationName: buildOperationName(targetOperation.targetTableName),
          keyColumns: [...targetOperation.keyColumns],
          mappedColumnCount: targetOperation.mappedColumnCount,
          requestContract: {
            artifactType: 'warehouse_adapter_dry_run_artifact',
            artifactVersion:
              args.warehouseDryRunArtifact.warehouseAdapterDryRunVersion,
            requiredTopLevelFields: [
              'reportId',
              'reportFamily',
              'reportType',
              'lineage',
              'sections',
              'totalRowCount',
              'dryRunPayload',
            ],
            requiredTargetOperationFields: [
              'sectionName',
              'targetTableName',
              'sourceBatchPath',
              'plannedOperation',
              'operationStatus',
              'keyColumns',
              'mappedColumnCount',
              'sourceRowCount',
              'writesAttempted',
              'writesAttemptedCount',
              'writesSkippedReason',
              'dryRunPreview',
            ],
            acceptedMode: 'dry_run',
            acceptedTargetTableName: targetOperation.targetTableName,
            acceptedSectionName: targetOperation.sectionName,
            acceptedSourceBatchPath: targetOperation.sourceBatchPath,
          },
          responseContract: {
            resultType: 'warehouse_adapter_interface_result',
            requiredFields: [
              'status',
              'operationName',
              'targetTableName',
              'writesAttempted',
              'implementationPresent',
              'executionAllowed',
              'processedRowCount',
            ],
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
        })
      ),
    },
  };

  validateFirstSalesTrafficWarehouseAdapterInterface({
    warehouseDryRunArtifact: args.warehouseDryRunArtifact,
    interfaceArtifact,
  });

  return interfaceArtifact;
};

export const validateFirstSalesTrafficWarehouseAdapterInterface = (args: {
  warehouseDryRunArtifact: ValidatedDryRunArtifact;
  interfaceArtifact: FirstReportWarehouseAdapterInterfaceArtifact;
}) => {
  const interfaceArtifact = args.interfaceArtifact;

  if (
    interfaceArtifact.warehouseAdapterInterfaceVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION
  ) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      `warehouseAdapterInterfaceVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION}`
    );
  }

  if (interfaceArtifact.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      'reportFamily must be sales_and_traffic'
    );
  }

  if (interfaceArtifact.reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      `reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!interfaceArtifact.reportId.trim()) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      'reportId must be a non-empty string'
    );
  }

  if (
    interfaceArtifact.lineage.warehouseAdapterDryRunVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION
  ) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      `lineage.warehouseAdapterDryRunVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION}`
    );
  }

  if (
    interfaceArtifact.lineage.warehouseAdapterMappingVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION
  ) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      `lineage.warehouseAdapterMappingVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION}`
    );
  }

  if (
    interfaceArtifact.lineage.warehouseReadyContractVersion !==
    FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      `lineage.warehouseReadyContractVersion must be ${FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION}`
    );
  }

  if (
    interfaceArtifact.lineage.canonicalIngestVersion !==
    FIRST_REPORT_CANONICAL_INGEST_VERSION
  ) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      `lineage.canonicalIngestVersion must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (
    !interfaceArtifact.lineage.warehouseDryRunArtifactPath.trim() ||
    !interfaceArtifact.lineage.warehouseMappingArtifactPath.trim() ||
    !interfaceArtifact.lineage.warehouseReadyArtifactPath.trim() ||
    !interfaceArtifact.lineage.canonicalIngestArtifactPath.trim() ||
    !interfaceArtifact.lineage.stagingArtifactPath.trim() ||
    !interfaceArtifact.lineage.stagingVersion.trim() ||
    !interfaceArtifact.lineage.handoffArtifactPath.trim() ||
    !interfaceArtifact.lineage.handoffSchemaVersion.trim() ||
    !interfaceArtifact.lineage.parsedArtifactPath.trim() ||
    !interfaceArtifact.lineage.rawArtifactPath.trim()
  ) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      'lineage must include dry-run, mapping, warehouse-ready, canonical, staging, handoff, parsed, and raw artifact details'
    );
  }

  if (interfaceArtifact.sections.length !== args.warehouseDryRunArtifact.sections.length) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      'sections must match the warehouse dry-run artifact'
    );
  }

  if (
    interfaceArtifact.interfacePayload.targetInterfaces.length !==
    args.warehouseDryRunArtifact.dryRunPayload.targetOperations.length
  ) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      'interfacePayload.targetInterfaces count must match the warehouse dry-run target operations'
    );
  }

  const summedRows = interfaceArtifact.sections.reduce(
    (sum, section) => sum + section.rowCount,
    0
  );
  if (summedRows !== interfaceArtifact.totalRowCount) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      'totalRowCount must equal the sum of section row counts'
    );
  }

  if (interfaceArtifact.interfacePayload.mode !== 'interface_only') {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      'interfacePayload.mode must be interface_only'
    );
  }

  if (interfaceArtifact.interfacePayload.writesAttempted !== false) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      'interfacePayload.writesAttempted must be false'
    );
  }

  if (interfaceArtifact.interfacePayload.implementationPresent !== false) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      'interfacePayload.implementationPresent must be false'
    );
  }

  if (interfaceArtifact.interfacePayload.executionAllowed !== false) {
    throw new FirstReportWarehouseInterfaceError(
      'validation_failed',
      'interfacePayload.executionAllowed must be false'
    );
  }

  args.warehouseDryRunArtifact.sections.forEach((section, index) => {
    const dryRunTargetOperation =
      args.warehouseDryRunArtifact.dryRunPayload.targetOperations[index];
    const interfaceSection = interfaceArtifact.sections[index];
    const targetInterface = interfaceArtifact.interfacePayload.targetInterfaces[index];

    if (interfaceSection.sectionName !== section.sectionName) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `interface section ${index} name does not match warehouse dry-run`
      );
    }

    if (interfaceSection.rowCount !== section.rowCount) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `interface section ${section.sectionName} row count does not match warehouse dry-run`
      );
    }

    if (interfaceSection.targetTableName !== section.targetTableName) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `interface section ${section.sectionName} target table name does not match warehouse dry-run`
      );
    }

    if (targetInterface.sectionName !== section.sectionName) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${index} section name does not match warehouse dry-run`
      );
    }

    if (targetInterface.targetTableName !== section.targetTableName) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} target table name does not match warehouse dry-run`
      );
    }

    if (
      targetInterface.operationName !== buildOperationName(section.targetTableName)
    ) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} operationName must be deterministic from target table name`
      );
    }

    if (
      targetInterface.keyColumns.join('\n') !==
      dryRunTargetOperation.keyColumns.join('\n')
    ) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} keyColumns must match the dry-run target operation`
      );
    }

    if (
      targetInterface.mappedColumnCount !== dryRunTargetOperation.mappedColumnCount
    ) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} mappedColumnCount must match the dry-run target operation`
      );
    }

    if (
      targetInterface.requestContract.artifactType !==
      'warehouse_adapter_dry_run_artifact'
    ) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} requestContract.artifactType must be warehouse_adapter_dry_run_artifact`
      );
    }

    if (
      targetInterface.requestContract.artifactVersion !==
      FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION
    ) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} requestContract.artifactVersion must match the warehouse dry-run version`
      );
    }

    if (targetInterface.requestContract.acceptedMode !== 'dry_run') {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} requestContract.acceptedMode must be dry_run`
      );
    }

    if (
      targetInterface.requestContract.acceptedTargetTableName !==
      dryRunTargetOperation.targetTableName
    ) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} requestContract.acceptedTargetTableName must match the dry-run target table name`
      );
    }

    if (
      targetInterface.requestContract.acceptedSectionName !==
      dryRunTargetOperation.sectionName
    ) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} requestContract.acceptedSectionName must match the dry-run section name`
      );
    }

    if (
      targetInterface.requestContract.acceptedSourceBatchPath !==
      dryRunTargetOperation.sourceBatchPath
    ) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} requestContract.acceptedSourceBatchPath must match the dry-run sourceBatchPath`
      );
    }

    if (
      targetInterface.responseContract.resultType !==
      'warehouse_adapter_interface_result'
    ) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} responseContract.resultType must be warehouse_adapter_interface_result`
      );
    }

    if (targetInterface.responseContract.successStatus !== 'interface_only') {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} responseContract.successStatus must be interface_only`
      );
    }

    if (targetInterface.responseContract.writesAttempted !== false) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} responseContract.writesAttempted must be false`
      );
    }

    if (targetInterface.responseContract.implementationPresent !== false) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} responseContract.implementationPresent must be false`
      );
    }

    if (targetInterface.responseContract.executionAllowed !== false) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} responseContract.executionAllowed must be false`
      );
    }

    if (targetInterface.executionFlags.mode !== 'interface_only') {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} executionFlags.mode must be interface_only`
      );
    }

    if (targetInterface.executionFlags.writesAttempted !== false) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} executionFlags.writesAttempted must be false`
      );
    }

    if (targetInterface.executionFlags.implementationPresent !== false) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} executionFlags.implementationPresent must be false`
      );
    }

    if (targetInterface.executionFlags.executionAllowed !== false) {
      throw new FirstReportWarehouseInterfaceError(
        'validation_failed',
        `target interface ${section.sectionName} executionFlags.executionAllowed must be false`
      );
    }
  });
};

export const buildFirstSalesTrafficWarehouseAdapterInterfacePath = (args: {
  reportId: string;
  outputRoot?: string;
}) =>
  path.resolve(
    args.outputRoot ?? FIRST_REPORT_WAREHOUSE_INTERFACE_OUTPUT_DIR,
    `report-${args.reportId}.warehouse-interface.json`
  );

export const writeFirstSalesTrafficWarehouseAdapterInterface = async (args: {
  interfaceArtifact: FirstReportWarehouseAdapterInterfaceArtifact;
  outputRoot?: string;
}) => {
  const warehouseInterfaceArtifactPath =
    buildFirstSalesTrafficWarehouseAdapterInterfacePath({
      reportId: args.interfaceArtifact.reportId,
      outputRoot: args.outputRoot,
    });

  try {
    await fs.mkdir(path.dirname(warehouseInterfaceArtifactPath), {
      recursive: true,
    });
    await fs.writeFile(
      warehouseInterfaceArtifactPath,
      `${JSON.stringify(args.interfaceArtifact, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    throw new FirstReportWarehouseInterfaceError(
      'write_failed',
      `Failed to write SP-API warehouse interface artifact to ${warehouseInterfaceArtifactPath}`,
      error
    );
  }

  return warehouseInterfaceArtifactPath;
};

export const summarizeFirstSalesTrafficWarehouseAdapterInterface = (args: {
  warehouseDryRunArtifactPath: string;
  warehouseInterfaceArtifactPath: string;
  interfaceArtifact: FirstReportWarehouseAdapterInterfaceArtifact;
}): FirstReportWarehouseAdapterInterfaceSummary => ({
  endpoint: 'runFirstSalesTrafficWarehouseAdapterInterfaceDefinition',
  reportId: args.interfaceArtifact.reportId,
  reportFamily: args.interfaceArtifact.reportFamily,
  reportType: args.interfaceArtifact.reportType,
  warehouseDryRunArtifactPath: path.resolve(args.warehouseDryRunArtifactPath),
  warehouseInterfaceArtifactPath: path.resolve(args.warehouseInterfaceArtifactPath),
  warehouseAdapterInterfaceVersion:
    args.interfaceArtifact.warehouseAdapterInterfaceVersion,
  sectionCount: args.interfaceArtifact.sections.length,
  totalRowCount: args.interfaceArtifact.totalRowCount,
  targetTableNames: args.interfaceArtifact.interfacePayload.targetInterfaces.map(
    (targetInterface) => targetInterface.targetTableName
  ),
  operationNames: args.interfaceArtifact.interfacePayload.targetInterfaces.map(
    (targetInterface) => targetInterface.operationName
  ),
  sections: args.interfaceArtifact.sections.map((section) => ({
    sectionName: section.sectionName,
    headerCount: section.headerCount,
    rowCount: section.rowCount,
    targetTableName: section.targetTableName,
  })),
});

export const runFirstSalesTrafficWarehouseAdapterInterfaceDefinition = async (
  args: {
    reportId?: string;
    warehouseDryRunArtifactPath?: string;
    warehouseDryRunOutputRoot?: string;
    warehouseInterfaceOutputRoot?: string;
  }
): Promise<FirstReportWarehouseAdapterInterfaceSummary> => {
  const resolved = await resolveFirstSalesTrafficWarehouseDryRunArtifactPath({
    reportId: args.reportId,
    warehouseDryRunArtifactPath: args.warehouseDryRunArtifactPath,
    warehouseDryRunOutputRoot: args.warehouseDryRunOutputRoot,
  });
  const warehouseDryRunArtifact =
    await readFirstSalesTrafficWarehouseAdapterDryRunArtifact({
      warehouseDryRunArtifactPath: resolved.warehouseDryRunArtifactPath,
    });
  const interfaceArtifact = buildFirstSalesTrafficWarehouseAdapterInterface({
    warehouseDryRunArtifact,
    warehouseDryRunArtifactPath: resolved.warehouseDryRunArtifactPath,
  });
  const warehouseInterfaceArtifactPath =
    await writeFirstSalesTrafficWarehouseAdapterInterface({
      interfaceArtifact,
      outputRoot: args.warehouseInterfaceOutputRoot,
    });

  return summarizeFirstSalesTrafficWarehouseAdapterInterface({
    warehouseDryRunArtifactPath: resolved.warehouseDryRunArtifactPath,
    warehouseInterfaceArtifactPath,
    interfaceArtifact,
  });
};
