import fs from 'node:fs/promises';
import path from 'node:path';

import { FIRST_SALES_AND_TRAFFIC_REPORT_TYPE, type SpApiReportType } from '../connectors/sp-api';
import {
  FIRST_REPORT_CANONICAL_INGEST_VERSION,
} from '../ingestion/firstSalesTrafficCanonical';
import {
  FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION,
} from '../ingestion/firstSalesTrafficWarehouseReady';

export const FIRST_REPORT_WAREHOUSE_MAPPING_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-warehouse-mapping'
);

export const FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION =
  'sp-api-first-report-warehouse-adapter-mapping/v1';

type ParsedCellValue = string | number | boolean | null;

type WarehouseReadySectionSummary = {
  sectionName: string;
  headerCount: number;
  rowCount: number;
  targetTableName: string;
};

type WarehouseReadyRow = {
  warehouseRecordId: string;
  canonicalRecordId: string;
  rowValues: Record<string, ParsedCellValue>;
};

type WarehouseReadyRecordBatch = {
  sectionName: string;
  targetTableName: string;
  keyColumns: string[];
  columnNames: string[];
  rows: WarehouseReadyRow[];
};

type FirstReportWarehouseReadyArtifact = {
  warehouseReadyContractVersion: string;
  contractTarget: 'local_json_warehouse_ready_contract';
  contractTargetDescription: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  reportId: string;
  lineage: {
    canonicalIngestArtifactPath: string;
    canonicalIngestVersion: string;
    stagingArtifactPath: string;
    stagingVersion: string;
    handoffArtifactPath: string;
    handoffSchemaVersion: string;
    parsedArtifactPath: string;
    rawArtifactPath: string;
  };
  sections: WarehouseReadySectionSummary[];
  totalRowCount: number;
  warehouseReadyPayload: {
    recordBatches: WarehouseReadyRecordBatch[];
  };
};

export type FirstReportWarehouseMappingSectionSummary = {
  sectionName: string;
  headerCount: number;
  rowCount: number;
  targetTableName: string;
};

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

type TargetMapping = {
  sectionName: string;
  targetTableName: string;
  sourceBatchPath: string;
  keyColumns: string[];
  columnMappings: ColumnMapping[];
  sourceRowCount: number;
};

export type FirstReportWarehouseAdapterMappingArtifact = {
  warehouseAdapterMappingVersion: typeof FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION;
  mappingTarget: 'local_json_warehouse_adapter_mapping';
  mappingTargetDescription: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  reportId: string;
  lineage: {
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
  mappingPayload: {
    targetMappings: TargetMapping[];
  };
};

export type FirstReportWarehouseAdapterMappingSummary = {
  endpoint: 'runFirstSalesTrafficWarehouseAdapterPreparation';
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  warehouseReadyArtifactPath: string;
  warehouseMappingArtifactPath: string;
  warehouseAdapterMappingVersion: string;
  sectionCount: number;
  totalRowCount: number;
  sections: FirstReportWarehouseMappingSectionSummary[];
};

export class FirstReportWarehouseMappingError extends Error {
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
    this.name = 'FirstReportWarehouseMappingError';
    this.code = code;
    this.details = details;
  }
}

const WAREHOUSE_READY_ARTIFACT_NAME_RE =
  /^report-(?<reportId>.+)\.warehouse-ready\.json$/;

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
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      `${fieldName} must be an array of strings`
    );
  }

  return value.map((entry, index) => {
    const parsed = asString(entry);
    if (!parsed) {
      throw new FirstReportWarehouseMappingError(
        'invalid_content',
        `${fieldName}[${index}] must be a non-empty string`
      );
    }

    return parsed;
  });
};

const asNonNegativeInteger = (value: unknown, fieldName: string) => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      `${fieldName} must be a non-negative integer`
    );
  }

  return Number(value);
};

const validateCellValue = (
  value: unknown,
  fieldName: string
): ParsedCellValue => {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value ?? null;
  }

  throw new FirstReportWarehouseMappingError(
    'invalid_content',
    `${fieldName} must contain only string, number, boolean, or null values`
  );
};

const parseWarehouseReadySectionSummary = (
  value: unknown,
  index: number
): WarehouseReadySectionSummary => {
  const section = asObject(value);
  const sectionName = asString(section?.sectionName);
  const targetTableName = asString(section?.targetTableName);

  if (!sectionName) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      `sections[${index}].sectionName must be a non-empty string`
    );
  }

  if (!targetTableName) {
    throw new FirstReportWarehouseMappingError(
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

const parseWarehouseReadyRecordBatch = (
  value: unknown,
  index: number
): WarehouseReadyRecordBatch => {
  const batch = asObject(value);
  const sectionName = asString(batch?.sectionName);
  const targetTableName = asString(batch?.targetTableName);

  if (!sectionName) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      `warehouseReadyPayload.recordBatches[${index}].sectionName must be a non-empty string`
    );
  }

  if (!targetTableName) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      `warehouseReadyPayload.recordBatches[${index}].targetTableName must be a non-empty string`
    );
  }

  const keyColumns = asStringArray(
    batch?.keyColumns,
    `warehouseReadyPayload.recordBatches[${index}].keyColumns`
  );
  const columnNames = asStringArray(
    batch?.columnNames,
    `warehouseReadyPayload.recordBatches[${index}].columnNames`
  );

  keyColumns.forEach((columnName, keyIndex) => {
    if (!columnNames.includes(columnName)) {
      throw new FirstReportWarehouseMappingError(
        'invalid_content',
        `warehouseReadyPayload.recordBatches[${index}].keyColumns[${keyIndex}] must exist in columnNames`
      );
    }
  });

  if (!Array.isArray(batch?.rows)) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      `warehouseReadyPayload.recordBatches[${index}].rows must be an array`
    );
  }

  const rows = batch.rows.map((entry, rowIndex) => {
    const row = asObject(entry);
    const warehouseRecordId = asString(row?.warehouseRecordId);
    const canonicalRecordId = asString(row?.canonicalRecordId);
    const rowValues = asObject(row?.rowValues);

    if (!row || !warehouseRecordId || !canonicalRecordId || !rowValues) {
      throw new FirstReportWarehouseMappingError(
        'invalid_content',
        `warehouseReadyPayload.recordBatches[${index}].rows[${rowIndex}] must include warehouseRecordId, canonicalRecordId, and rowValues`
      );
    }

    const rowKeys = Object.keys(rowValues);
    if (rowKeys.length !== columnNames.length) {
      throw new FirstReportWarehouseMappingError(
        'invalid_content',
        `warehouseReadyPayload.recordBatches[${index}].rows[${rowIndex}] key count must match columnNames`
      );
    }

    const normalizedValues: Record<string, ParsedCellValue> = {};

    for (const columnName of columnNames) {
      if (!Object.prototype.hasOwnProperty.call(rowValues, columnName)) {
        throw new FirstReportWarehouseMappingError(
          'invalid_content',
          `warehouseReadyPayload.recordBatches[${index}].rows[${rowIndex}] is missing column ${columnName}`
        );
      }

      normalizedValues[columnName] = validateCellValue(
        rowValues[columnName],
        `warehouseReadyPayload.recordBatches[${index}].rows[${rowIndex}].rowValues.${columnName}`
      );
    }

    for (const key of rowKeys) {
      if (!columnNames.includes(key)) {
        throw new FirstReportWarehouseMappingError(
          'invalid_content',
          `warehouseReadyPayload.recordBatches[${index}].rows[${rowIndex}] contains unexpected key ${key}`
        );
      }
    }

    return {
      warehouseRecordId,
      canonicalRecordId,
      rowValues: normalizedValues,
    };
  });

  return {
    sectionName,
    targetTableName,
    keyColumns,
    columnNames,
    rows,
  };
};

const parseFirstReportWarehouseReadyArtifact = (
  value: unknown
): FirstReportWarehouseReadyArtifact => {
  const artifact = asObject(value);
  const reportId = asString(artifact?.reportId);
  const reportType = asString(artifact?.reportType);
  const lineage = asObject(artifact?.lineage);
  const warehouseReadyContractVersion = asString(
    artifact?.warehouseReadyContractVersion
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
    warehouseReadyContractVersion !== FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      `warehouseReadyContractVersion must be ${FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION}`
    );
  }

  if (artifact?.contractTarget !== 'local_json_warehouse_ready_contract') {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      'contractTarget must be local_json_warehouse_ready_contract'
    );
  }

  if (!asString(artifact?.contractTargetDescription)) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      'contractTargetDescription must be a non-empty string'
    );
  }

  if (artifact?.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      'reportFamily must be sales_and_traffic'
    );
  }

  if (reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      `reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!reportId) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      'reportId must be a non-empty string'
    );
  }

  if (
    !canonicalIngestArtifactPath ||
    !canonicalIngestVersion ||
    !stagingArtifactPath ||
    !stagingVersion ||
    !handoffArtifactPath ||
    !handoffSchemaVersion ||
    !parsedArtifactPath ||
    !rawArtifactPath
  ) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      'lineage must include warehouse-ready, canonical, staging, handoff, parsed, and raw artifact references'
    );
  }

  if (canonicalIngestVersion !== FIRST_REPORT_CANONICAL_INGEST_VERSION) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      `lineage.canonicalIngestVersion must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (!Array.isArray(artifact?.sections)) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      'sections must be an array'
    );
  }

  const warehouseReadyPayload = asObject(artifact?.warehouseReadyPayload);
  if (!Array.isArray(warehouseReadyPayload?.recordBatches)) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      'warehouseReadyPayload.recordBatches must be an array'
    );
  }

  const sections = artifact.sections.map((section, index) =>
    parseWarehouseReadySectionSummary(section, index)
  );
  const recordBatches = warehouseReadyPayload.recordBatches.map((batch, index) =>
    parseWarehouseReadyRecordBatch(batch, index)
  );
  const totalRowCount = asNonNegativeInteger(artifact?.totalRowCount, 'totalRowCount');

  if (sections.length !== recordBatches.length) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      'sections and warehouseReadyPayload.recordBatches must have the same length'
    );
  }

  const summedRows = sections.reduce((sum, section) => sum + section.rowCount, 0);
  if (summedRows !== totalRowCount) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      'totalRowCount must equal the sum of section row counts'
    );
  }

  sections.forEach((section, index) => {
    const batch = recordBatches[index];

    if (section.sectionName !== batch.sectionName) {
      throw new FirstReportWarehouseMappingError(
        'invalid_content',
        `record batch ${index} section name does not match section summary`
      );
    }

    if (section.targetTableName !== batch.targetTableName) {
      throw new FirstReportWarehouseMappingError(
        'invalid_content',
        `record batch ${section.sectionName} target table name does not match section summary`
      );
    }

    if (section.rowCount !== batch.rows.length) {
      throw new FirstReportWarehouseMappingError(
        'invalid_content',
        `record batch ${section.sectionName} row count does not match section summary`
      );
    }
  });

  return {
    warehouseReadyContractVersion:
      FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION,
    contractTarget: 'local_json_warehouse_ready_contract',
    contractTargetDescription: asString(artifact.contractTargetDescription)!,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    reportId,
    lineage: {
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
    warehouseReadyPayload: {
      recordBatches,
    },
  };
};

const deriveReportIdFromWarehouseReadyArtifactPath = (
  warehouseReadyArtifactPath: string
) => {
  const match = path.basename(warehouseReadyArtifactPath).match(
    WAREHOUSE_READY_ARTIFACT_NAME_RE
  );
  const reportId = match?.groups?.reportId?.trim();

  return reportId && reportId.length > 0 ? reportId : null;
};

const inferObservedValueType = (
  rows: WarehouseReadyRow[],
  columnName: string
): ObservedValueType => {
  const primitiveTypes = new Set<string>();

  for (const row of rows) {
    const value = row.rowValues[columnName];
    if (value == null) {
      continue;
    }

    primitiveTypes.add(typeof value);
  }

  if (primitiveTypes.size === 0) {
    return 'empty_observed';
  }

  if (primitiveTypes.size === 1) {
    const [onlyType] = [...primitiveTypes];
    if (onlyType === 'string' || onlyType === 'number' || onlyType === 'boolean') {
      return onlyType;
    }
  }

  return 'mixed';
};

export const resolveFirstSalesTrafficWarehouseReadyArtifactPath = async (args: {
  reportId?: string;
  warehouseReadyArtifactPath?: string;
  warehouseReadyOutputRoot?: string;
}) => {
  const warehouseReadyArtifactPath = args.warehouseReadyArtifactPath?.trim();
  const explicitReportId = args.reportId?.trim();

  if (warehouseReadyArtifactPath) {
    const derivedReportId = deriveReportIdFromWarehouseReadyArtifactPath(
      warehouseReadyArtifactPath
    );

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new FirstReportWarehouseMappingError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match warehouse-ready artifact path ${path.basename(
          warehouseReadyArtifactPath
        )}`
      );
    }

    try {
      await fs.access(warehouseReadyArtifactPath);
    } catch (error) {
      throw new FirstReportWarehouseMappingError(
        'artifact_not_found',
        `SP-API warehouse-ready artifact not found at ${warehouseReadyArtifactPath}`,
        error
      );
    }

    const reportId = explicitReportId ?? derivedReportId;
    if (!reportId) {
      throw new FirstReportWarehouseMappingError(
        'invalid_input',
        'Warehouse-ready artifact path must follow the V2-11 deterministic naming or be paired with --report-id'
      );
    }

    return {
      reportId,
      warehouseReadyArtifactPath: path.resolve(warehouseReadyArtifactPath),
    };
  }

  if (!explicitReportId) {
    throw new FirstReportWarehouseMappingError(
      'invalid_input',
      'Warehouse adapter preparation requires either --report-id <value> or --warehouse-ready-path <value>'
    );
  }

  const candidate = path.resolve(
    args.warehouseReadyOutputRoot ?? path.resolve(process.cwd(), 'out', 'sp-api-warehouse-ready'),
    `report-${explicitReportId}.warehouse-ready.json`
  );

  try {
    await fs.access(candidate);
  } catch (error) {
    throw new FirstReportWarehouseMappingError(
      'artifact_not_found',
      `SP-API warehouse-ready artifact not found for report ${explicitReportId} under ${
        args.warehouseReadyOutputRoot ?? path.resolve(process.cwd(), 'out', 'sp-api-warehouse-ready')
      }`,
      error
    );
  }

  return {
    reportId: explicitReportId,
    warehouseReadyArtifactPath: candidate,
  };
};

export const readFirstSalesTrafficWarehouseReadyArtifact = async (args: {
  warehouseReadyArtifactPath: string;
}): Promise<FirstReportWarehouseReadyArtifact> => {
  const warehouseReadyArtifactPath = path.resolve(args.warehouseReadyArtifactPath);

  let text: string;
  try {
    text = await fs.readFile(warehouseReadyArtifactPath, 'utf8');
  } catch (error) {
    throw new FirstReportWarehouseMappingError(
      'artifact_not_found',
      `Failed to read SP-API warehouse-ready artifact at ${warehouseReadyArtifactPath}`,
      error
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new FirstReportWarehouseMappingError(
      'invalid_content',
      `SP-API warehouse-ready artifact at ${warehouseReadyArtifactPath} is not valid JSON`,
      error
    );
  }

  return parseFirstReportWarehouseReadyArtifact(parsed);
};

export const buildFirstSalesTrafficWarehouseAdapterMapping = (args: {
  warehouseReadyArtifact: FirstReportWarehouseReadyArtifact;
  warehouseReadyArtifactPath: string;
}): FirstReportWarehouseAdapterMappingArtifact => {
  const mappingArtifact: FirstReportWarehouseAdapterMappingArtifact = {
    warehouseAdapterMappingVersion: FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION,
    mappingTarget: 'local_json_warehouse_adapter_mapping',
    mappingTargetDescription:
      'Deterministic local warehouse adapter mapping definition for preparation proof only; not a warehouse write',
    reportFamily: args.warehouseReadyArtifact.reportFamily,
    reportType: args.warehouseReadyArtifact.reportType,
    reportId: args.warehouseReadyArtifact.reportId,
    lineage: {
      warehouseReadyArtifactPath: path.resolve(args.warehouseReadyArtifactPath),
      warehouseReadyContractVersion:
        args.warehouseReadyArtifact.warehouseReadyContractVersion,
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
    mappingPayload: {
      targetMappings: args.warehouseReadyArtifact.warehouseReadyPayload.recordBatches.map(
        (batch, index) => ({
          sectionName: batch.sectionName,
          targetTableName: batch.targetTableName,
          sourceBatchPath: `warehouseReadyPayload.recordBatches[${index}].rows`,
          keyColumns: [...batch.keyColumns],
          columnMappings: batch.columnNames.map((columnName) => ({
            sourceField: columnName,
            targetColumn: columnName,
            sourceValuePath: `rowValues["${columnName}"]`,
            observedValueType: inferObservedValueType(batch.rows, columnName),
            nullable: batch.rows.some((row) => row.rowValues[columnName] == null),
          })),
          sourceRowCount: batch.rows.length,
        })
      ),
    },
  };

  validateFirstSalesTrafficWarehouseAdapterMapping({
    warehouseReadyArtifact: args.warehouseReadyArtifact,
    mappingArtifact,
  });

  return mappingArtifact;
};

export const validateFirstSalesTrafficWarehouseAdapterMapping = (args: {
  warehouseReadyArtifact: FirstReportWarehouseReadyArtifact;
  mappingArtifact: FirstReportWarehouseAdapterMappingArtifact;
}) => {
  const mapping = args.mappingArtifact;

  if (
    mapping.warehouseAdapterMappingVersion !==
    FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION
  ) {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      `Warehouse adapter mapping version must be ${FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION}`
    );
  }

  if (mapping.mappingTarget !== 'local_json_warehouse_adapter_mapping') {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      'mappingTarget must be local_json_warehouse_adapter_mapping'
    );
  }

  if (!mapping.mappingTargetDescription.trim()) {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      'mappingTargetDescription must be a non-empty string'
    );
  }

  if (mapping.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      'reportFamily must be sales_and_traffic'
    );
  }

  if (mapping.reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      `reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!mapping.reportId.trim()) {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      'reportId must be a non-empty string'
    );
  }

  if (!mapping.lineage.warehouseReadyArtifactPath.trim()) {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      'lineage.warehouseReadyArtifactPath must be present'
    );
  }

  if (
    mapping.lineage.warehouseReadyContractVersion !==
    FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      `lineage.warehouseReadyContractVersion must be ${FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION}`
    );
  }

  if (
    mapping.lineage.canonicalIngestVersion !== FIRST_REPORT_CANONICAL_INGEST_VERSION
  ) {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      `lineage.canonicalIngestVersion must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (
    !mapping.lineage.canonicalIngestArtifactPath.trim() ||
    !mapping.lineage.stagingArtifactPath.trim() ||
    !mapping.lineage.stagingVersion.trim() ||
    !mapping.lineage.handoffArtifactPath.trim() ||
    !mapping.lineage.handoffSchemaVersion.trim() ||
    !mapping.lineage.parsedArtifactPath.trim() ||
    !mapping.lineage.rawArtifactPath.trim()
  ) {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      'lineage must include warehouse-ready, canonical, staging, handoff, parsed, and raw artifact details'
    );
  }

  if (mapping.sections.length !== args.warehouseReadyArtifact.sections.length) {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      'section summary count must match the warehouse-ready artifact'
    );
  }

  if (
    mapping.mappingPayload.targetMappings.length !==
    args.warehouseReadyArtifact.warehouseReadyPayload.recordBatches.length
  ) {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      'targetMappings count must match the warehouse-ready artifact'
    );
  }

  const summedRows = mapping.sections.reduce((sum, section) => sum + section.rowCount, 0);
  if (summedRows !== mapping.totalRowCount) {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      'totalRowCount must equal the sum of section row counts'
    );
  }

  args.warehouseReadyArtifact.sections.forEach((section, index) => {
    const mappingSection = mapping.sections[index];
    const recordBatch =
      args.warehouseReadyArtifact.warehouseReadyPayload.recordBatches[index];
    const targetMapping = mapping.mappingPayload.targetMappings[index];

    if (mappingSection.sectionName !== section.sectionName) {
      throw new FirstReportWarehouseMappingError(
        'validation_failed',
        `mapping section ${index} name does not match the warehouse-ready artifact`
      );
    }

    if (mappingSection.rowCount !== section.rowCount) {
      throw new FirstReportWarehouseMappingError(
        'validation_failed',
        `mapping section ${section.sectionName} row count does not match the warehouse-ready artifact`
      );
    }

    if (mappingSection.targetTableName !== section.targetTableName) {
      throw new FirstReportWarehouseMappingError(
        'validation_failed',
        `mapping section ${section.sectionName} target table name does not match the warehouse-ready artifact`
      );
    }

    if (targetMapping.sectionName !== section.sectionName) {
      throw new FirstReportWarehouseMappingError(
        'validation_failed',
        `target mapping ${index} section name does not match the warehouse-ready artifact`
      );
    }

    if (targetMapping.targetTableName !== section.targetTableName) {
      throw new FirstReportWarehouseMappingError(
        'validation_failed',
        `target mapping ${section.sectionName} target table name does not match the warehouse-ready artifact`
      );
    }

    if (targetMapping.sourceRowCount !== recordBatch.rows.length) {
      throw new FirstReportWarehouseMappingError(
        'validation_failed',
        `target mapping ${section.sectionName} source row count does not match the warehouse-ready artifact`
      );
    }

    if (
      targetMapping.keyColumns.length !== recordBatch.keyColumns.length ||
      targetMapping.keyColumns.some(
        (columnName, columnIndex) => columnName !== recordBatch.keyColumns[columnIndex]
      )
    ) {
      throw new FirstReportWarehouseMappingError(
        'validation_failed',
        `target mapping ${section.sectionName} key columns do not match the warehouse-ready artifact`
      );
    }

    if (targetMapping.columnMappings.length !== recordBatch.columnNames.length) {
      throw new FirstReportWarehouseMappingError(
        'validation_failed',
        `target mapping ${section.sectionName} column mapping count does not match the warehouse-ready artifact`
      );
    }

    targetMapping.columnMappings.forEach((columnMapping, columnIndex) => {
      const sourceColumn = recordBatch.columnNames[columnIndex];

      if (columnMapping.sourceField !== sourceColumn) {
        throw new FirstReportWarehouseMappingError(
          'validation_failed',
          `target mapping ${section.sectionName} source field at index ${columnIndex} does not match the warehouse-ready artifact`
        );
      }

      if (columnMapping.targetColumn !== sourceColumn) {
        throw new FirstReportWarehouseMappingError(
          'validation_failed',
          `target mapping ${section.sectionName} target column at index ${columnIndex} does not match the source field`
        );
      }

      if (
        columnMapping.sourceValuePath !== `rowValues["${sourceColumn}"]`
      ) {
        throw new FirstReportWarehouseMappingError(
          'validation_failed',
          `target mapping ${section.sectionName} source value path at index ${columnIndex} is invalid`
        );
      }
    });
  });
};

export const buildFirstSalesTrafficWarehouseAdapterMappingPath = (args: {
  reportId: string;
  outputRoot?: string;
}) => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new FirstReportWarehouseMappingError(
      'invalid_input',
      'Warehouse adapter mapping path requires a non-empty report id'
    );
  }

  return path.resolve(
    args.outputRoot ?? FIRST_REPORT_WAREHOUSE_MAPPING_OUTPUT_DIR,
    `report-${reportId}.warehouse-mapping.json`
  );
};

export const writeFirstSalesTrafficWarehouseAdapterMapping = async (args: {
  mappingArtifact: FirstReportWarehouseAdapterMappingArtifact;
  outputRoot?: string;
}) => {
  const warehouseMappingArtifactPath =
    buildFirstSalesTrafficWarehouseAdapterMappingPath({
      reportId: args.mappingArtifact.reportId,
      outputRoot: args.outputRoot,
    });

  try {
    await fs.mkdir(path.dirname(warehouseMappingArtifactPath), { recursive: true });
    await fs.writeFile(
      warehouseMappingArtifactPath,
      `${JSON.stringify(args.mappingArtifact, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    throw new FirstReportWarehouseMappingError(
      'write_failed',
      `Failed to write warehouse adapter mapping artifact at ${warehouseMappingArtifactPath}`,
      error
    );
  }

  return warehouseMappingArtifactPath;
};

export const summarizeFirstSalesTrafficWarehouseAdapterMapping = (args: {
  mappingArtifact: FirstReportWarehouseAdapterMappingArtifact;
  warehouseReadyArtifactPath: string;
  warehouseMappingArtifactPath: string;
}): FirstReportWarehouseAdapterMappingSummary => ({
  endpoint: 'runFirstSalesTrafficWarehouseAdapterPreparation',
  reportId: args.mappingArtifact.reportId,
  reportFamily: args.mappingArtifact.reportFamily,
  reportType: args.mappingArtifact.reportType,
  warehouseReadyArtifactPath: path.resolve(args.warehouseReadyArtifactPath),
  warehouseMappingArtifactPath: path.resolve(args.warehouseMappingArtifactPath),
  warehouseAdapterMappingVersion: args.mappingArtifact.warehouseAdapterMappingVersion,
  sectionCount: args.mappingArtifact.sections.length,
  totalRowCount: args.mappingArtifact.totalRowCount,
  sections: args.mappingArtifact.sections.map((section) => ({
    sectionName: section.sectionName,
    headerCount: section.headerCount,
    rowCount: section.rowCount,
    targetTableName: section.targetTableName,
  })),
});

export const runFirstSalesTrafficWarehouseAdapterPreparation = async (args: {
  reportId?: string;
  warehouseReadyArtifactPath?: string;
  warehouseReadyOutputRoot?: string;
  warehouseMappingOutputRoot?: string;
}): Promise<FirstReportWarehouseAdapterMappingSummary> => {
  const resolvedInput = await resolveFirstSalesTrafficWarehouseReadyArtifactPath({
    reportId: args.reportId,
    warehouseReadyArtifactPath: args.warehouseReadyArtifactPath,
    warehouseReadyOutputRoot: args.warehouseReadyOutputRoot,
  });
  const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
    warehouseReadyArtifactPath: resolvedInput.warehouseReadyArtifactPath,
  });

  if (warehouseReadyArtifact.reportId !== resolvedInput.reportId) {
    throw new FirstReportWarehouseMappingError(
      'validation_failed',
      `Warehouse-ready artifact report id ${warehouseReadyArtifact.reportId} does not match requested report id ${resolvedInput.reportId}`
    );
  }

  const mappingArtifact = buildFirstSalesTrafficWarehouseAdapterMapping({
    warehouseReadyArtifact,
    warehouseReadyArtifactPath: resolvedInput.warehouseReadyArtifactPath,
  });
  const warehouseMappingArtifactPath =
    await writeFirstSalesTrafficWarehouseAdapterMapping({
      mappingArtifact,
      outputRoot: args.warehouseMappingOutputRoot,
    });

  return summarizeFirstSalesTrafficWarehouseAdapterMapping({
    mappingArtifact,
    warehouseReadyArtifactPath: resolvedInput.warehouseReadyArtifactPath,
    warehouseMappingArtifactPath,
  });
};
