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
  readFirstSalesTrafficWarehouseReadyArtifact,
  resolveFirstSalesTrafficWarehouseReadyArtifactPath,
  type FirstReportWarehouseAdapterMappingArtifact,
  type FirstReportWarehouseMappingSectionSummary,
} from './firstSalesTrafficWarehouseMapping';

export const FIRST_REPORT_WAREHOUSE_DRY_RUN_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-warehouse-dry-run'
);

export const FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION =
  'sp-api-first-report-warehouse-adapter-dry-run/v1';

type FirstReportWarehouseReadyArtifact = Awaited<
  ReturnType<typeof readFirstSalesTrafficWarehouseReadyArtifact>
>;

type ObservedValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'empty_observed'
  | 'mixed';

type ColumnMapping = {
  sourceField: string;
  targetColumn: string;
  sourceValuePath: string;
  observedValueType: ObservedValueType;
  nullable: boolean;
};

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

export type FirstReportWarehouseAdapterDryRunArtifact = {
  warehouseAdapterDryRunVersion: typeof FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION;
  dryRunTarget: 'local_json_warehouse_adapter_dry_run';
  dryRunTargetDescription: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  reportId: string;
  lineage: {
    warehouseReadyArtifactPath: string;
    warehouseReadyContractVersion: string;
    warehouseMappingArtifactPath: string;
    warehouseAdapterMappingVersion: string;
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
  dryRunPayload: {
    mode: 'dry_run';
    writesAttempted: false;
    writesAttemptedCount: 0;
    targetOperations: DryRunTargetOperation[];
  };
};

export type FirstReportWarehouseAdapterDryRunSummary = {
  endpoint: 'runFirstSalesTrafficWarehouseAdapterDryRun';
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  warehouseReadyArtifactPath: string;
  warehouseMappingArtifactPath: string;
  warehouseDryRunArtifactPath: string;
  warehouseAdapterDryRunVersion: string;
  sectionCount: number;
  totalRowCount: number;
  targetTableNames: string[];
  sections: FirstReportWarehouseMappingSectionSummary[];
};

export class FirstReportWarehouseDryRunError extends Error {
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
    this.name = 'FirstReportWarehouseDryRunError';
    this.code = code;
    this.details = details;
  }
}

const WAREHOUSE_MAPPING_ARTIFACT_NAME_RE =
  /^report-(?<reportId>.+)\.warehouse-mapping\.json$/;

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
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      `${fieldName} must be an array of strings`
    );
  }

  return value.map((entry, index) => {
    const parsed = asString(entry);
    if (!parsed) {
      throw new FirstReportWarehouseDryRunError(
        'invalid_content',
        `${fieldName}[${index}] must be a non-empty string`
      );
    }

    return parsed;
  });
};

const asNonNegativeInteger = (value: unknown, fieldName: string) => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new FirstReportWarehouseDryRunError(
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
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      `sections[${index}].sectionName must be a non-empty string`
    );
  }

  if (!targetTableName) {
    throw new FirstReportWarehouseDryRunError(
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

const parseObservedValueType = (
  value: unknown,
  fieldName: string
): ObservedValueType => {
  if (
    value === 'string' ||
    value === 'number' ||
    value === 'boolean' ||
    value === 'empty_observed' ||
    value === 'mixed'
  ) {
    return value;
  }

  throw new FirstReportWarehouseDryRunError(
    'invalid_content',
    `${fieldName} must be one of string, number, boolean, empty_observed, or mixed`
  );
};

const parseColumnMapping = (value: unknown, fieldName: string): ColumnMapping => {
  const mapping = asObject(value);
  const sourceField = asString(mapping?.sourceField);
  const targetColumn = asString(mapping?.targetColumn);
  const sourceValuePath = asString(mapping?.sourceValuePath);

  if (!sourceField || !targetColumn || !sourceValuePath) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      `${fieldName} must include sourceField, targetColumn, and sourceValuePath`
    );
  }

  if (typeof mapping?.nullable !== 'boolean') {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      `${fieldName}.nullable must be a boolean`
    );
  }

  return {
    sourceField,
    targetColumn,
    sourceValuePath,
    observedValueType: parseObservedValueType(
      mapping?.observedValueType,
      `${fieldName}.observedValueType`
    ),
    nullable: mapping.nullable,
  };
};

const parseTargetMapping = (
  value: unknown,
  index: number
): FirstReportWarehouseAdapterMappingArtifact['mappingPayload']['targetMappings'][number] => {
  const targetMapping = asObject(value);
  const sectionName = asString(targetMapping?.sectionName);
  const targetTableName = asString(targetMapping?.targetTableName);
  const sourceBatchPath = asString(targetMapping?.sourceBatchPath);

  if (!sectionName || !targetTableName || !sourceBatchPath) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      `mappingPayload.targetMappings[${index}] must include sectionName, targetTableName, and sourceBatchPath`
    );
  }

  const keyColumns = asStringArray(
    targetMapping?.keyColumns,
    `mappingPayload.targetMappings[${index}].keyColumns`
  );

  if (!Array.isArray(targetMapping?.columnMappings)) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      `mappingPayload.targetMappings[${index}].columnMappings must be an array`
    );
  }

  const columnMappings = targetMapping.columnMappings.map((entry, mappingIndex) =>
    parseColumnMapping(
      entry,
      `mappingPayload.targetMappings[${index}].columnMappings[${mappingIndex}]`
    )
  );

  if (columnMappings.length === 0) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      `mappingPayload.targetMappings[${index}].columnMappings must not be empty`
    );
  }

  return {
    sectionName,
    targetTableName,
    sourceBatchPath,
    keyColumns,
    columnMappings,
    sourceRowCount: asNonNegativeInteger(
      targetMapping?.sourceRowCount,
      `mappingPayload.targetMappings[${index}].sourceRowCount`
    ),
  };
};

const parseFirstReportWarehouseAdapterMappingArtifact = (
  value: unknown
): FirstReportWarehouseAdapterMappingArtifact => {
  const artifact = asObject(value);
  const reportId = asString(artifact?.reportId);
  const reportType = asString(artifact?.reportType);
  const lineage = asObject(artifact?.lineage);
  const warehouseAdapterMappingVersion = asString(
    artifact?.warehouseAdapterMappingVersion
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
    warehouseAdapterMappingVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION
  ) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      `warehouseAdapterMappingVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION}`
    );
  }

  if (artifact?.mappingTarget !== 'local_json_warehouse_adapter_mapping') {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      'mappingTarget must be local_json_warehouse_adapter_mapping'
    );
  }

  if (!asString(artifact?.mappingTargetDescription)) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      'mappingTargetDescription must be a non-empty string'
    );
  }

  if (artifact?.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      'reportFamily must be sales_and_traffic'
    );
  }

  if (reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      `reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!reportId) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      'reportId must be a non-empty string'
    );
  }

  if (
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
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      'lineage must include warehouse-ready, canonical, staging, handoff, parsed, and raw artifact references'
    );
  }

  if (
    warehouseReadyContractVersion !== FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      `lineage.warehouseReadyContractVersion must be ${FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION}`
    );
  }

  if (canonicalIngestVersion !== FIRST_REPORT_CANONICAL_INGEST_VERSION) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      `lineage.canonicalIngestVersion must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (!Array.isArray(artifact?.sections)) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      'sections must be an array'
    );
  }

  const mappingPayload = asObject(artifact?.mappingPayload);
  if (!Array.isArray(mappingPayload?.targetMappings)) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      'mappingPayload.targetMappings must be an array'
    );
  }

  const sections = artifact.sections.map((section, index) =>
    parseSectionSummary(section, index)
  );
  const targetMappings = mappingPayload.targetMappings.map((entry, index) =>
    parseTargetMapping(entry, index)
  );
  const totalRowCount = asNonNegativeInteger(artifact?.totalRowCount, 'totalRowCount');

  if (sections.length !== targetMappings.length) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      'sections and mappingPayload.targetMappings must have the same length'
    );
  }

  const summedRows = sections.reduce((sum, section) => sum + section.rowCount, 0);
  if (summedRows !== totalRowCount) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      'totalRowCount must equal the sum of section row counts'
    );
  }

  sections.forEach((section, index) => {
    const targetMapping = targetMappings[index];

    if (section.sectionName !== targetMapping.sectionName) {
      throw new FirstReportWarehouseDryRunError(
        'invalid_content',
        `target mapping ${index} section name does not match section summary`
      );
    }

    if (section.targetTableName !== targetMapping.targetTableName) {
      throw new FirstReportWarehouseDryRunError(
        'invalid_content',
        `target mapping ${section.sectionName} target table name does not match section summary`
      );
    }

    if (section.rowCount !== targetMapping.sourceRowCount) {
      throw new FirstReportWarehouseDryRunError(
        'invalid_content',
        `target mapping ${section.sectionName} source row count does not match section summary`
      );
    }
  });

  return {
    warehouseAdapterMappingVersion:
      FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION,
    mappingTarget: 'local_json_warehouse_adapter_mapping',
    mappingTargetDescription: asString(artifact.mappingTargetDescription)!,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    reportId,
    lineage: {
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
    mappingPayload: {
      targetMappings,
    },
  };
};

const deriveReportIdFromWarehouseMappingArtifactPath = (
  warehouseMappingArtifactPath: string
) => {
  const match = path.basename(warehouseMappingArtifactPath).match(
    WAREHOUSE_MAPPING_ARTIFACT_NAME_RE
  );
  const reportId = match?.groups?.reportId?.trim();

  return reportId && reportId.length > 0 ? reportId : null;
};

export const resolveFirstSalesTrafficWarehouseMappingArtifactPath = async (
  args: {
    reportId?: string;
    warehouseMappingArtifactPath?: string;
    warehouseMappingOutputRoot?: string;
  }
) => {
  const warehouseMappingArtifactPath = args.warehouseMappingArtifactPath?.trim();
  const explicitReportId = args.reportId?.trim();

  if (warehouseMappingArtifactPath) {
    const derivedReportId = deriveReportIdFromWarehouseMappingArtifactPath(
      warehouseMappingArtifactPath
    );

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new FirstReportWarehouseDryRunError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match warehouse-mapping artifact path ${path.basename(
          warehouseMappingArtifactPath
        )}`
      );
    }

    try {
      await fs.access(warehouseMappingArtifactPath);
    } catch (error) {
      throw new FirstReportWarehouseDryRunError(
        'artifact_not_found',
        `SP-API warehouse-mapping artifact not found at ${warehouseMappingArtifactPath}`,
        error
      );
    }

    const reportId = explicitReportId ?? derivedReportId;
    if (!reportId) {
      throw new FirstReportWarehouseDryRunError(
        'invalid_input',
        'Warehouse-mapping artifact path must follow the V2-12 deterministic naming or be paired with --report-id'
      );
    }

    return {
      reportId,
      warehouseMappingArtifactPath: path.resolve(warehouseMappingArtifactPath),
    };
  }

  if (!explicitReportId) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_input',
      'Warehouse dry-run execution requires either --report-id <value> or --warehouse-mapping-path <value>'
    );
  }

  const candidate = path.resolve(
    args.warehouseMappingOutputRoot ??
      path.resolve(process.cwd(), 'out', 'sp-api-warehouse-mapping'),
    `report-${explicitReportId}.warehouse-mapping.json`
  );

  try {
    await fs.access(candidate);
  } catch (error) {
    throw new FirstReportWarehouseDryRunError(
      'artifact_not_found',
      `SP-API warehouse-mapping artifact not found for report ${explicitReportId} under ${
        args.warehouseMappingOutputRoot ??
        path.resolve(process.cwd(), 'out', 'sp-api-warehouse-mapping')
      }`,
      error
    );
  }

  return {
    reportId: explicitReportId,
    warehouseMappingArtifactPath: candidate,
  };
};

export const readFirstSalesTrafficWarehouseAdapterMappingArtifact = async (
  args: {
    warehouseMappingArtifactPath: string;
  }
): Promise<FirstReportWarehouseAdapterMappingArtifact> => {
  const warehouseMappingArtifactPath = path.resolve(args.warehouseMappingArtifactPath);

  let text: string;
  try {
    text = await fs.readFile(warehouseMappingArtifactPath, 'utf8');
  } catch (error) {
    throw new FirstReportWarehouseDryRunError(
      'artifact_not_found',
      `Failed to read SP-API warehouse-mapping artifact at ${warehouseMappingArtifactPath}`,
      error
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new FirstReportWarehouseDryRunError(
      'invalid_content',
      `SP-API warehouse-mapping artifact at ${warehouseMappingArtifactPath} is not valid JSON`,
      error
    );
  }

  return parseFirstReportWarehouseAdapterMappingArtifact(parsed);
};

export const buildFirstSalesTrafficWarehouseAdapterDryRun = (args: {
  warehouseReadyArtifact: FirstReportWarehouseReadyArtifact;
  warehouseReadyArtifactPath: string;
  warehouseMappingArtifact: FirstReportWarehouseAdapterMappingArtifact;
  warehouseMappingArtifactPath: string;
}): FirstReportWarehouseAdapterDryRunArtifact => {
  validateFirstSalesTrafficWarehouseAdapterDryRunInputs({
    warehouseReadyArtifact: args.warehouseReadyArtifact,
    warehouseMappingArtifact: args.warehouseMappingArtifact,
  });

  const dryRunArtifact: FirstReportWarehouseAdapterDryRunArtifact = {
    warehouseAdapterDryRunVersion: FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION,
    dryRunTarget: 'local_json_warehouse_adapter_dry_run',
    dryRunTargetDescription:
      'Deterministic local warehouse adapter dry-run execution artifact for proof only; no writes attempted',
    reportFamily: args.warehouseReadyArtifact.reportFamily,
    reportType: args.warehouseReadyArtifact.reportType,
    reportId: args.warehouseReadyArtifact.reportId,
    lineage: {
      warehouseReadyArtifactPath: path.resolve(args.warehouseReadyArtifactPath),
      warehouseReadyContractVersion:
        args.warehouseReadyArtifact.warehouseReadyContractVersion,
      warehouseMappingArtifactPath: path.resolve(args.warehouseMappingArtifactPath),
      warehouseAdapterMappingVersion:
        args.warehouseMappingArtifact.warehouseAdapterMappingVersion,
      canonicalIngestArtifactPath:
        args.warehouseReadyArtifact.lineage.canonicalIngestArtifactPath,
      canonicalIngestVersion:
        args.warehouseReadyArtifact.lineage.canonicalIngestVersion,
      stagingArtifactPath: args.warehouseReadyArtifact.lineage.stagingArtifactPath,
      stagingVersion: args.warehouseReadyArtifact.lineage.stagingVersion,
      handoffArtifactPath: args.warehouseReadyArtifact.lineage.handoffArtifactPath,
      handoffSchemaVersion:
        args.warehouseReadyArtifact.lineage.handoffSchemaVersion,
      parsedArtifactPath: args.warehouseReadyArtifact.lineage.parsedArtifactPath,
      rawArtifactPath: args.warehouseReadyArtifact.lineage.rawArtifactPath,
    },
    sections: args.warehouseReadyArtifact.sections.map((section) => ({
      sectionName: section.sectionName,
      headerCount: section.headerCount,
      rowCount: section.rowCount,
      targetTableName: section.targetTableName,
    })),
    totalRowCount: args.warehouseReadyArtifact.totalRowCount,
    dryRunPayload: {
      mode: 'dry_run',
      writesAttempted: false,
      writesAttemptedCount: 0,
      targetOperations:
        args.warehouseReadyArtifact.warehouseReadyPayload.recordBatches.map(
          (recordBatch, index) => {
            const targetMapping =
              args.warehouseMappingArtifact.mappingPayload.targetMappings[index];

            return {
              sectionName: recordBatch.sectionName,
              targetTableName: recordBatch.targetTableName,
              sourceBatchPath: targetMapping.sourceBatchPath,
              plannedOperation: 'prepare_local_dry_run_warehouse_adapter_batch',
              operationStatus: 'dry_run_only',
              keyColumns: [...targetMapping.keyColumns],
              mappedColumnCount: targetMapping.columnMappings.length,
              sourceRowCount: recordBatch.rows.length,
              writesAttempted: false,
              writesAttemptedCount: 0,
              writesSkippedReason:
                'Dry-run only: warehouse adapter execution is intentionally skipped and no writes were attempted',
              dryRunPreview: {
                sampleWarehouseRecordIds: recordBatch.rows
                  .slice(0, 3)
                  .map((row) => row.warehouseRecordId),
                sampleCanonicalRecordIds: recordBatch.rows
                  .slice(0, 3)
                  .map((row) => row.canonicalRecordId),
              },
            };
          }
        ),
    },
  };

  validateFirstSalesTrafficWarehouseAdapterDryRun({
    warehouseReadyArtifact: args.warehouseReadyArtifact,
    warehouseMappingArtifact: args.warehouseMappingArtifact,
    dryRunArtifact,
  });

  return dryRunArtifact;
};

export const validateFirstSalesTrafficWarehouseAdapterDryRunInputs = (args: {
  warehouseReadyArtifact: FirstReportWarehouseReadyArtifact;
  warehouseMappingArtifact: FirstReportWarehouseAdapterMappingArtifact;
}) => {
  const warehouseReadyArtifact = args.warehouseReadyArtifact;
  const warehouseMappingArtifact = args.warehouseMappingArtifact;

  if (warehouseReadyArtifact.reportId !== warehouseMappingArtifact.reportId) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'warehouse-ready and warehouse-mapping reportId values must match'
    );
  }

  if (
    warehouseReadyArtifact.reportFamily !== warehouseMappingArtifact.reportFamily
  ) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'warehouse-ready and warehouse-mapping reportFamily values must match'
    );
  }

  if (warehouseReadyArtifact.reportType !== warehouseMappingArtifact.reportType) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'warehouse-ready and warehouse-mapping reportType values must match'
    );
  }

  if (
    warehouseReadyArtifact.sections.length !== warehouseMappingArtifact.sections.length
  ) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'warehouse-ready sections and warehouse-mapping sections must have the same length'
    );
  }

  if (
    warehouseReadyArtifact.totalRowCount !== warehouseMappingArtifact.totalRowCount
  ) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'warehouse-ready and warehouse-mapping totalRowCount values must match'
    );
  }

  const warehouseReadyTargetTableNames =
    warehouseReadyArtifact.sections.map((section) => section.targetTableName);
  const warehouseMappingTargetTableNames =
    warehouseMappingArtifact.sections.map((section) => section.targetTableName);

  if (
    warehouseReadyTargetTableNames.join('\n') !==
    warehouseMappingTargetTableNames.join('\n')
  ) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'warehouse-ready and warehouse-mapping target table names must match'
    );
  }

  warehouseReadyArtifact.sections.forEach((section, index) => {
    const mappingSection = warehouseMappingArtifact.sections[index];
    const recordBatch =
      warehouseReadyArtifact.warehouseReadyPayload.recordBatches[index];
    const targetMapping =
      warehouseMappingArtifact.mappingPayload.targetMappings[index];

    if (mappingSection.sectionName !== section.sectionName) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `warehouse-mapping section ${index} name does not match warehouse-ready section ${section.sectionName}`
      );
    }

    if (mappingSection.rowCount !== section.rowCount) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `warehouse-mapping section ${section.sectionName} row count does not match warehouse-ready`
      );
    }

    if (mappingSection.targetTableName !== section.targetTableName) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `warehouse-mapping section ${section.sectionName} target table name does not match warehouse-ready`
      );
    }

    if (targetMapping.sectionName !== section.sectionName) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `warehouse-mapping target ${index} section name does not match warehouse-ready`
      );
    }

    if (targetMapping.targetTableName !== section.targetTableName) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `warehouse-mapping target ${section.sectionName} target table name does not match warehouse-ready`
      );
    }

    if (targetMapping.sourceRowCount !== recordBatch.rows.length) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `warehouse-mapping target ${section.sectionName} source row count does not match warehouse-ready rows`
      );
    }

    if (targetMapping.keyColumns.join('\n') !== recordBatch.keyColumns.join('\n')) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `warehouse-mapping target ${section.sectionName} key columns do not match warehouse-ready`
      );
    }

    targetMapping.keyColumns.forEach((keyColumn) => {
      if (!recordBatch.columnNames.includes(keyColumn)) {
        throw new FirstReportWarehouseDryRunError(
          'validation_failed',
          `warehouse-mapping target ${section.sectionName} key column ${keyColumn} does not exist in warehouse-ready columnNames`
        );
      }
    });

    targetMapping.columnMappings.forEach((columnMapping) => {
      if (!recordBatch.columnNames.includes(columnMapping.sourceField)) {
        throw new FirstReportWarehouseDryRunError(
          'validation_failed',
          `warehouse-mapping target ${section.sectionName} source field ${columnMapping.sourceField} does not exist in warehouse-ready columnNames`
        );
      }

      if (columnMapping.targetColumn !== columnMapping.sourceField) {
        throw new FirstReportWarehouseDryRunError(
          'validation_failed',
          `warehouse-mapping target ${section.sectionName} must preserve deterministic one-to-one sourceField and targetColumn names`
        );
      }
    });
  });
};

export const validateFirstSalesTrafficWarehouseAdapterDryRun = (args: {
  warehouseReadyArtifact: FirstReportWarehouseReadyArtifact;
  warehouseMappingArtifact: FirstReportWarehouseAdapterMappingArtifact;
  dryRunArtifact: FirstReportWarehouseAdapterDryRunArtifact;
}) => {
  validateFirstSalesTrafficWarehouseAdapterDryRunInputs({
    warehouseReadyArtifact: args.warehouseReadyArtifact,
    warehouseMappingArtifact: args.warehouseMappingArtifact,
  });

  const dryRunArtifact = args.dryRunArtifact;

  if (
    dryRunArtifact.warehouseAdapterDryRunVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION
  ) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      `warehouseAdapterDryRunVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION}`
    );
  }

  if (dryRunArtifact.dryRunTarget !== 'local_json_warehouse_adapter_dry_run') {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'dryRunTarget must be local_json_warehouse_adapter_dry_run'
    );
  }

  if (!dryRunArtifact.dryRunTargetDescription.trim()) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'dryRunTargetDescription must be a non-empty string'
    );
  }

  if (dryRunArtifact.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'reportFamily must be sales_and_traffic'
    );
  }

  if (dryRunArtifact.reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      `reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!dryRunArtifact.reportId.trim()) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'reportId must be a non-empty string'
    );
  }

  if (
    dryRunArtifact.lineage.warehouseReadyContractVersion !==
    FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      `lineage.warehouseReadyContractVersion must be ${FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION}`
    );
  }

  if (
    dryRunArtifact.lineage.warehouseAdapterMappingVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION
  ) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      `lineage.warehouseAdapterMappingVersion must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION}`
    );
  }

  if (
    dryRunArtifact.lineage.canonicalIngestVersion !==
    FIRST_REPORT_CANONICAL_INGEST_VERSION
  ) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      `lineage.canonicalIngestVersion must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (
    !dryRunArtifact.lineage.warehouseReadyArtifactPath.trim() ||
    !dryRunArtifact.lineage.warehouseMappingArtifactPath.trim() ||
    !dryRunArtifact.lineage.canonicalIngestArtifactPath.trim() ||
    !dryRunArtifact.lineage.stagingArtifactPath.trim() ||
    !dryRunArtifact.lineage.stagingVersion.trim() ||
    !dryRunArtifact.lineage.handoffArtifactPath.trim() ||
    !dryRunArtifact.lineage.handoffSchemaVersion.trim() ||
    !dryRunArtifact.lineage.parsedArtifactPath.trim() ||
    !dryRunArtifact.lineage.rawArtifactPath.trim()
  ) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'lineage must include warehouse-ready, warehouse-mapping, canonical, staging, handoff, parsed, and raw artifact details'
    );
  }

  if (dryRunArtifact.sections.length !== args.warehouseReadyArtifact.sections.length) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'sections must match the warehouse-ready artifact'
    );
  }

  if (
    dryRunArtifact.dryRunPayload.targetOperations.length !==
    args.warehouseMappingArtifact.mappingPayload.targetMappings.length
  ) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'dryRunPayload.targetOperations count must match the warehouse-mapping artifact'
    );
  }

  const summedRows = dryRunArtifact.sections.reduce(
    (sum, section) => sum + section.rowCount,
    0
  );
  if (summedRows !== dryRunArtifact.totalRowCount) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'totalRowCount must equal the sum of section row counts'
    );
  }

  if (dryRunArtifact.dryRunPayload.mode !== 'dry_run') {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'dryRunPayload.mode must be dry_run'
    );
  }

  if (dryRunArtifact.dryRunPayload.writesAttempted !== false) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'dryRunPayload.writesAttempted must be false'
    );
  }

  if (dryRunArtifact.dryRunPayload.writesAttemptedCount !== 0) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'dryRunPayload.writesAttemptedCount must be 0'
    );
  }

  args.warehouseReadyArtifact.sections.forEach((section, index) => {
    const dryRunSection = dryRunArtifact.sections[index];
    const recordBatch =
      args.warehouseReadyArtifact.warehouseReadyPayload.recordBatches[index];
    const targetMapping =
      args.warehouseMappingArtifact.mappingPayload.targetMappings[index];
    const targetOperation = dryRunArtifact.dryRunPayload.targetOperations[index];

    if (dryRunSection.sectionName !== section.sectionName) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run section ${index} name does not match warehouse-ready`
      );
    }

    if (dryRunSection.rowCount !== section.rowCount) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run section ${section.sectionName} row count does not match warehouse-ready`
      );
    }

    if (dryRunSection.targetTableName !== section.targetTableName) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run section ${section.sectionName} target table name does not match warehouse-ready`
      );
    }

    if (targetOperation.sectionName !== section.sectionName) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run target operation ${index} section name does not match warehouse-ready`
      );
    }

    if (targetOperation.targetTableName !== section.targetTableName) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run target operation ${section.sectionName} target table name does not match warehouse-ready`
      );
    }

    if (targetOperation.sourceBatchPath !== targetMapping.sourceBatchPath) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run target operation ${section.sectionName} sourceBatchPath does not match warehouse-mapping`
      );
    }

    if (targetOperation.keyColumns.join('\n') !== targetMapping.keyColumns.join('\n')) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run target operation ${section.sectionName} key columns do not match warehouse-mapping`
      );
    }

    if (targetOperation.mappedColumnCount !== targetMapping.columnMappings.length) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run target operation ${section.sectionName} mappedColumnCount does not match warehouse-mapping`
      );
    }

    if (targetOperation.sourceRowCount !== recordBatch.rows.length) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run target operation ${section.sectionName} sourceRowCount does not match warehouse-ready`
      );
    }

    if (targetOperation.writesAttempted !== false) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run target operation ${section.sectionName} writesAttempted must be false`
      );
    }

    if (targetOperation.writesAttemptedCount !== 0) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run target operation ${section.sectionName} writesAttemptedCount must be 0`
      );
    }

    if (!targetOperation.writesSkippedReason.trim()) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run target operation ${section.sectionName} writesSkippedReason must be a non-empty string`
      );
    }

    const expectedWarehouseRecordIds = recordBatch.rows
      .slice(0, 3)
      .map((row) => row.warehouseRecordId);
    const expectedCanonicalRecordIds = recordBatch.rows
      .slice(0, 3)
      .map((row) => row.canonicalRecordId);

    if (
      targetOperation.dryRunPreview.sampleWarehouseRecordIds.join('\n') !==
      expectedWarehouseRecordIds.join('\n')
    ) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run target operation ${section.sectionName} sampleWarehouseRecordIds do not match the bounded warehouse-ready preview`
      );
    }

    if (
      targetOperation.dryRunPreview.sampleCanonicalRecordIds.join('\n') !==
      expectedCanonicalRecordIds.join('\n')
    ) {
      throw new FirstReportWarehouseDryRunError(
        'validation_failed',
        `dry-run target operation ${section.sectionName} sampleCanonicalRecordIds do not match the bounded warehouse-ready preview`
      );
    }
  });
};

export const buildFirstSalesTrafficWarehouseAdapterDryRunPath = (args: {
  reportId: string;
  outputRoot?: string;
}) =>
  path.resolve(
    args.outputRoot ?? FIRST_REPORT_WAREHOUSE_DRY_RUN_OUTPUT_DIR,
    `report-${args.reportId}.warehouse-dry-run.json`
  );

export const writeFirstSalesTrafficWarehouseAdapterDryRun = async (args: {
  dryRunArtifact: FirstReportWarehouseAdapterDryRunArtifact;
  outputRoot?: string;
}) => {
  const dryRunArtifactPath = buildFirstSalesTrafficWarehouseAdapterDryRunPath({
    reportId: args.dryRunArtifact.reportId,
    outputRoot: args.outputRoot,
  });

  try {
    await fs.mkdir(path.dirname(dryRunArtifactPath), { recursive: true });
    await fs.writeFile(
      dryRunArtifactPath,
      `${JSON.stringify(args.dryRunArtifact, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    throw new FirstReportWarehouseDryRunError(
      'write_failed',
      `Failed to write SP-API warehouse dry-run artifact to ${dryRunArtifactPath}`,
      error
    );
  }

  return dryRunArtifactPath;
};

export const summarizeFirstSalesTrafficWarehouseAdapterDryRun = (args: {
  warehouseReadyArtifactPath: string;
  warehouseMappingArtifactPath: string;
  warehouseDryRunArtifactPath: string;
  dryRunArtifact: FirstReportWarehouseAdapterDryRunArtifact;
}): FirstReportWarehouseAdapterDryRunSummary => ({
  endpoint: 'runFirstSalesTrafficWarehouseAdapterDryRun',
  reportId: args.dryRunArtifact.reportId,
  reportFamily: args.dryRunArtifact.reportFamily,
  reportType: args.dryRunArtifact.reportType,
  warehouseReadyArtifactPath: path.resolve(args.warehouseReadyArtifactPath),
  warehouseMappingArtifactPath: path.resolve(args.warehouseMappingArtifactPath),
  warehouseDryRunArtifactPath: path.resolve(args.warehouseDryRunArtifactPath),
  warehouseAdapterDryRunVersion:
    args.dryRunArtifact.warehouseAdapterDryRunVersion,
  sectionCount: args.dryRunArtifact.sections.length,
  totalRowCount: args.dryRunArtifact.totalRowCount,
  targetTableNames: args.dryRunArtifact.dryRunPayload.targetOperations.map(
    (operation) => operation.targetTableName
  ),
  sections: args.dryRunArtifact.sections.map((section) => ({
    sectionName: section.sectionName,
    headerCount: section.headerCount,
    rowCount: section.rowCount,
    targetTableName: section.targetTableName,
  })),
});

export const runFirstSalesTrafficWarehouseAdapterDryRun = async (args: {
  reportId?: string;
  warehouseReadyArtifactPath?: string;
  warehouseMappingArtifactPath?: string;
  warehouseReadyOutputRoot?: string;
  warehouseMappingOutputRoot?: string;
  warehouseDryRunOutputRoot?: string;
}): Promise<FirstReportWarehouseAdapterDryRunSummary> => {
  const [resolvedWarehouseReady, resolvedWarehouseMapping] = await Promise.all([
    resolveFirstSalesTrafficWarehouseReadyArtifactPath({
      reportId: args.reportId,
      warehouseReadyArtifactPath: args.warehouseReadyArtifactPath,
      warehouseReadyOutputRoot: args.warehouseReadyOutputRoot,
    }).catch((error) => {
      if (error instanceof Error && error.name === 'FirstReportWarehouseMappingError') {
        throw new FirstReportWarehouseDryRunError(
          'artifact_not_found',
          error.message,
          error
        );
      }

      throw error;
    }),
    resolveFirstSalesTrafficWarehouseMappingArtifactPath({
      reportId: args.reportId,
      warehouseMappingArtifactPath: args.warehouseMappingArtifactPath,
      warehouseMappingOutputRoot: args.warehouseMappingOutputRoot,
    }),
  ]);

  if (resolvedWarehouseReady.reportId !== resolvedWarehouseMapping.reportId) {
    throw new FirstReportWarehouseDryRunError(
      'validation_failed',
      'Resolved warehouse-ready and warehouse-mapping report ids must match'
    );
  }

  const [warehouseReadyArtifact, warehouseMappingArtifact] = await Promise.all([
    readFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifactPath: resolvedWarehouseReady.warehouseReadyArtifactPath,
    }).catch((error) => {
      if (error instanceof Error && error.name === 'FirstReportWarehouseMappingError') {
        throw new FirstReportWarehouseDryRunError(
          'invalid_content',
          error.message,
          error
        );
      }

      throw error;
    }),
    readFirstSalesTrafficWarehouseAdapterMappingArtifact({
      warehouseMappingArtifactPath:
        resolvedWarehouseMapping.warehouseMappingArtifactPath,
    }),
  ]);

  const dryRunArtifact = buildFirstSalesTrafficWarehouseAdapterDryRun({
    warehouseReadyArtifact,
    warehouseReadyArtifactPath: resolvedWarehouseReady.warehouseReadyArtifactPath,
    warehouseMappingArtifact,
    warehouseMappingArtifactPath:
      resolvedWarehouseMapping.warehouseMappingArtifactPath,
  });
  const warehouseDryRunArtifactPath =
    await writeFirstSalesTrafficWarehouseAdapterDryRun({
      dryRunArtifact,
      outputRoot: args.warehouseDryRunOutputRoot,
    });

  return summarizeFirstSalesTrafficWarehouseAdapterDryRun({
    warehouseReadyArtifactPath: resolvedWarehouseReady.warehouseReadyArtifactPath,
    warehouseMappingArtifactPath:
      resolvedWarehouseMapping.warehouseMappingArtifactPath,
    warehouseDryRunArtifactPath,
    dryRunArtifact,
  });
};
