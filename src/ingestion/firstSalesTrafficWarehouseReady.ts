import fs from 'node:fs/promises';
import path from 'node:path';

import { FIRST_SALES_AND_TRAFFIC_REPORT_TYPE, type SpApiReportType } from '../connectors/sp-api';
import {
  FIRST_REPORT_CANONICAL_INGEST_OUTPUT_DIR,
  FIRST_REPORT_CANONICAL_INGEST_VERSION,
} from './firstSalesTrafficCanonical';

export const FIRST_REPORT_WAREHOUSE_READY_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-warehouse-ready'
);

export const FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION =
  'sp-api-first-report-warehouse-ready/v1';

type ParsedCellValue = string | number | boolean | null;

type CanonicalSectionSummary = {
  sectionName: string;
  headerCount: number;
  rowCount: number;
};

type CanonicalRecord = {
  canonicalRecordId: string;
  sourceRecordIndex: number;
  values: Record<string, ParsedCellValue>;
};

type CanonicalPayloadSection = {
  sectionName: string;
  fieldNames: string[];
  records: CanonicalRecord[];
};

type FirstReportCanonicalIngestArtifact = {
  canonicalIngestVersion: string;
  ingestTarget: 'local_json_canonical_ingest';
  ingestTargetDescription: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  reportId: string;
  lineage: {
    stagingArtifactPath: string;
    stagingVersion: string;
    handoffArtifactPath: string;
    handoffSchemaVersion: string;
    parsedArtifactPath: string;
    rawArtifactPath: string;
  };
  sections: CanonicalSectionSummary[];
  totalRowCount: number;
  canonicalPayload: {
    sections: CanonicalPayloadSection[];
  };
};

export type FirstReportWarehouseReadySectionSummary = {
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

export type FirstReportWarehouseReadyArtifact = {
  warehouseReadyContractVersion: typeof FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION;
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
  sections: FirstReportWarehouseReadySectionSummary[];
  totalRowCount: number;
  warehouseReadyPayload: {
    recordBatches: WarehouseReadyRecordBatch[];
  };
};

export type FirstReportWarehouseReadySummary = {
  endpoint: 'runFirstSalesTrafficWarehouseReadyContractPromotion';
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  canonicalIngestArtifactPath: string;
  warehouseReadyArtifactPath: string;
  warehouseReadyContractVersion: string;
  sectionCount: number;
  totalRowCount: number;
  sections: FirstReportWarehouseReadySectionSummary[];
};

export class FirstReportWarehouseReadyError extends Error {
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
    this.name = 'FirstReportWarehouseReadyError';
    this.code = code;
    this.details = details;
  }
}

const CANONICAL_ARTIFACT_NAME_RE =
  /^report-(?<reportId>.+)\.canonical-ingest\.json$/;

const WAREHOUSE_KEY_COLUMNS = [
  'report_id',
  'report_family',
  'report_type',
  'section_name',
  'canonical_record_id',
] as const;

const WAREHOUSE_METADATA_COLUMNS = [
  ...WAREHOUSE_KEY_COLUMNS,
  'source_record_index',
] as const;

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
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      `${fieldName} must be an array of strings`
    );
  }

  return value.map((entry, index) => {
    const parsed = asString(entry);
    if (!parsed) {
      throw new FirstReportWarehouseReadyError(
        'invalid_content',
        `${fieldName}[${index}] must be a non-empty string`
      );
    }

    return parsed;
  });
};

const asNonNegativeInteger = (value: unknown, fieldName: string) => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new FirstReportWarehouseReadyError(
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

  throw new FirstReportWarehouseReadyError(
    'invalid_content',
    `${fieldName} must contain only string, number, boolean, or null values`
  );
};

const toSnakeCase = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const buildTargetTableName = (sectionName: string) =>
  `spapi_${toSnakeCase(sectionName)}_report_rows`;

const parseCanonicalSectionSummary = (
  value: unknown,
  index: number
): CanonicalSectionSummary => {
  const section = asObject(value);
  const sectionName = asString(section?.sectionName);

  if (!sectionName) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      `sections[${index}].sectionName must be a non-empty string`
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
  };
};

const parseCanonicalPayloadSection = (
  value: unknown,
  index: number
): CanonicalPayloadSection => {
  const section = asObject(value);
  const sectionName = asString(section?.sectionName);

  if (!sectionName) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      `canonicalPayload.sections[${index}].sectionName must be a non-empty string`
    );
  }

  const fieldNames = asStringArray(
    section?.fieldNames,
    `canonicalPayload.sections[${index}].fieldNames`
  );

  if (!Array.isArray(section?.records)) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      `canonicalPayload.sections[${index}].records must be an array`
    );
  }

  const records = section.records.map((entry, recordIndex) => {
    const record = asObject(entry);
    const canonicalRecordId = asString(record?.canonicalRecordId);

    if (!record || !canonicalRecordId) {
      throw new FirstReportWarehouseReadyError(
        'invalid_content',
        `canonicalPayload.sections[${index}].records[${recordIndex}] must include canonicalRecordId`
      );
    }

    const sourceRecordIndex = asNonNegativeInteger(
      record.sourceRecordIndex,
      `canonicalPayload.sections[${index}].records[${recordIndex}].sourceRecordIndex`
    );
    const values = asObject(record.values);

    if (!values) {
      throw new FirstReportWarehouseReadyError(
        'invalid_content',
        `canonicalPayload.sections[${index}].records[${recordIndex}].values must be an object`
      );
    }

    const valueKeys = Object.keys(values);
    if (valueKeys.length !== fieldNames.length) {
      throw new FirstReportWarehouseReadyError(
        'invalid_content',
        `canonicalPayload.sections[${index}].records[${recordIndex}] key count must match the field count`
      );
    }

    const normalizedValues: Record<string, ParsedCellValue> = {};

    for (const fieldName of fieldNames) {
      if (!Object.prototype.hasOwnProperty.call(values, fieldName)) {
        throw new FirstReportWarehouseReadyError(
          'invalid_content',
          `canonicalPayload.sections[${index}].records[${recordIndex}] is missing field ${fieldName}`
        );
      }

      normalizedValues[fieldName] = validateCellValue(
        values[fieldName],
        `canonicalPayload.sections[${index}].records[${recordIndex}].values.${fieldName}`
      );
    }

    for (const key of valueKeys) {
      if (!fieldNames.includes(key)) {
        throw new FirstReportWarehouseReadyError(
          'invalid_content',
          `canonicalPayload.sections[${index}].records[${recordIndex}] contains unexpected key ${key}`
        );
      }
    }

    return {
      canonicalRecordId,
      sourceRecordIndex,
      values: normalizedValues,
    };
  });

  return {
    sectionName,
    fieldNames,
    records,
  };
};

const parseFirstReportCanonicalIngestArtifact = (
  value: unknown
): FirstReportCanonicalIngestArtifact => {
  const artifact = asObject(value);
  const reportId = asString(artifact?.reportId);
  const reportType = asString(artifact?.reportType);
  const lineage = asObject(artifact?.lineage);
  const canonicalVersion = asString(artifact?.canonicalIngestVersion);
  const stagingArtifactPath = asString(lineage?.stagingArtifactPath);
  const stagingVersion = asString(lineage?.stagingVersion);
  const handoffArtifactPath = asString(lineage?.handoffArtifactPath);
  const handoffSchemaVersion = asString(lineage?.handoffSchemaVersion);
  const parsedArtifactPath = asString(lineage?.parsedArtifactPath);
  const rawArtifactPath = asString(lineage?.rawArtifactPath);

  if (canonicalVersion !== FIRST_REPORT_CANONICAL_INGEST_VERSION) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      `canonicalIngestVersion must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (artifact?.ingestTarget !== 'local_json_canonical_ingest') {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      'Canonical ingestTarget must be local_json_canonical_ingest'
    );
  }

  if (!asString(artifact?.ingestTargetDescription)) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      'Canonical ingestTargetDescription must be a non-empty string'
    );
  }

  if (artifact?.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      'Canonical reportFamily must be sales_and_traffic'
    );
  }

  if (reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      `Canonical reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!reportId) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      'Canonical reportId must be a non-empty string'
    );
  }

  if (
    !stagingArtifactPath ||
    !stagingVersion ||
    !handoffArtifactPath ||
    !handoffSchemaVersion ||
    !parsedArtifactPath ||
    !rawArtifactPath
  ) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      'Canonical lineage must include stagingArtifactPath, stagingVersion, handoffArtifactPath, handoffSchemaVersion, parsedArtifactPath, and rawArtifactPath'
    );
  }

  if (!Array.isArray(artifact?.sections)) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      'Canonical sections must be an array'
    );
  }

  const canonicalPayload = asObject(artifact?.canonicalPayload);
  if (!Array.isArray(canonicalPayload?.sections)) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      'Canonical canonicalPayload.sections must be an array'
    );
  }

  const sections = artifact.sections.map((section, index) =>
    parseCanonicalSectionSummary(section, index)
  );
  const payloadSections = canonicalPayload.sections.map((section, index) =>
    parseCanonicalPayloadSection(section, index)
  );
  const totalRowCount = asNonNegativeInteger(artifact?.totalRowCount, 'totalRowCount');

  if (sections.length !== payloadSections.length) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      'Canonical sections and canonicalPayload.sections must have the same length'
    );
  }

  const summedRows = sections.reduce((sum, section) => sum + section.rowCount, 0);
  if (summedRows !== totalRowCount) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      'Canonical totalRowCount must equal the sum of section row counts'
    );
  }

  sections.forEach((section, index) => {
    const payloadSection = payloadSections[index];

    if (section.sectionName !== payloadSection.sectionName) {
      throw new FirstReportWarehouseReadyError(
        'invalid_content',
        `Canonical payload section ${index} name does not match the section summary`
      );
    }

    if (section.headerCount !== payloadSection.fieldNames.length) {
      throw new FirstReportWarehouseReadyError(
        'invalid_content',
        `Canonical section ${section.sectionName} header count does not match payload fields`
      );
    }

    if (section.rowCount !== payloadSection.records.length) {
      throw new FirstReportWarehouseReadyError(
        'invalid_content',
        `Canonical section ${section.sectionName} row count does not match payload records`
      );
    }
  });

  return {
    canonicalIngestVersion: FIRST_REPORT_CANONICAL_INGEST_VERSION,
    ingestTarget: 'local_json_canonical_ingest',
    ingestTargetDescription: asString(artifact.ingestTargetDescription)!,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    reportId,
    lineage: {
      stagingArtifactPath: path.resolve(stagingArtifactPath),
      stagingVersion,
      handoffArtifactPath: path.resolve(handoffArtifactPath),
      handoffSchemaVersion,
      parsedArtifactPath: path.resolve(parsedArtifactPath),
      rawArtifactPath: path.resolve(rawArtifactPath),
    },
    sections,
    totalRowCount,
    canonicalPayload: {
      sections: payloadSections,
    },
  };
};

const deriveReportIdFromCanonicalArtifactPath = (canonicalArtifactPath: string) => {
  const match = path.basename(canonicalArtifactPath).match(CANONICAL_ARTIFACT_NAME_RE);
  const reportId = match?.groups?.reportId?.trim();

  return reportId && reportId.length > 0 ? reportId : null;
};

export const resolveFirstSalesTrafficCanonicalArtifactPath = async (args: {
  reportId?: string;
  canonicalIngestArtifactPath?: string;
  canonicalOutputRoot?: string;
}) => {
  const canonicalIngestArtifactPath = args.canonicalIngestArtifactPath?.trim();
  const explicitReportId = args.reportId?.trim();

  if (canonicalIngestArtifactPath) {
    const derivedReportId = deriveReportIdFromCanonicalArtifactPath(
      canonicalIngestArtifactPath
    );

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new FirstReportWarehouseReadyError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match canonical ingest artifact path ${path.basename(
          canonicalIngestArtifactPath
        )}`
      );
    }

    try {
      await fs.access(canonicalIngestArtifactPath);
    } catch (error) {
      throw new FirstReportWarehouseReadyError(
        'artifact_not_found',
        `SP-API canonical ingest artifact not found at ${canonicalIngestArtifactPath}`,
        error
      );
    }

    const reportId = explicitReportId ?? derivedReportId;
    if (!reportId) {
      throw new FirstReportWarehouseReadyError(
        'invalid_input',
        'Canonical ingest artifact path must follow the V2-10 deterministic naming or be paired with --report-id'
      );
    }

    return {
      reportId,
      canonicalIngestArtifactPath: path.resolve(canonicalIngestArtifactPath),
    };
  }

  if (!explicitReportId) {
    throw new FirstReportWarehouseReadyError(
      'invalid_input',
      'Warehouse-ready promotion requires either --report-id <value> or --canonical-path <value>'
    );
  }

  const candidate = path.resolve(
    args.canonicalOutputRoot ?? FIRST_REPORT_CANONICAL_INGEST_OUTPUT_DIR,
    `report-${explicitReportId}.canonical-ingest.json`
  );

  try {
    await fs.access(candidate);
  } catch (error) {
    throw new FirstReportWarehouseReadyError(
      'artifact_not_found',
      `SP-API canonical ingest artifact not found for report ${explicitReportId} under ${
        args.canonicalOutputRoot ?? FIRST_REPORT_CANONICAL_INGEST_OUTPUT_DIR
      }`,
      error
    );
  }

  return {
    reportId: explicitReportId,
    canonicalIngestArtifactPath: candidate,
  };
};

export const readFirstSalesTrafficCanonicalArtifact = async (args: {
  canonicalIngestArtifactPath: string;
}): Promise<FirstReportCanonicalIngestArtifact> => {
  const canonicalIngestArtifactPath = path.resolve(args.canonicalIngestArtifactPath);

  let text: string;
  try {
    text = await fs.readFile(canonicalIngestArtifactPath, 'utf8');
  } catch (error) {
    throw new FirstReportWarehouseReadyError(
      'artifact_not_found',
      `Failed to read SP-API canonical ingest artifact at ${canonicalIngestArtifactPath}`,
      error
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new FirstReportWarehouseReadyError(
      'invalid_content',
      `SP-API canonical ingest artifact at ${canonicalIngestArtifactPath} is not valid JSON`,
      error
    );
  }

  return parseFirstReportCanonicalIngestArtifact(parsed);
};

export const buildFirstSalesTrafficWarehouseReadyArtifact = (args: {
  canonicalArtifact: FirstReportCanonicalIngestArtifact;
  canonicalIngestArtifactPath: string;
}): FirstReportWarehouseReadyArtifact => {
  const warehouseReadyArtifact: FirstReportWarehouseReadyArtifact = {
    warehouseReadyContractVersion: FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION,
    contractTarget: 'local_json_warehouse_ready_contract',
    contractTargetDescription:
      'Deterministic local warehouse-ready contract artifact for promotion proof only; not a warehouse write',
    reportFamily: args.canonicalArtifact.reportFamily,
    reportType: args.canonicalArtifact.reportType,
    reportId: args.canonicalArtifact.reportId,
    lineage: {
      canonicalIngestArtifactPath: path.resolve(args.canonicalIngestArtifactPath),
      canonicalIngestVersion: args.canonicalArtifact.canonicalIngestVersion,
      stagingArtifactPath: args.canonicalArtifact.lineage.stagingArtifactPath,
      stagingVersion: args.canonicalArtifact.lineage.stagingVersion,
      handoffArtifactPath: args.canonicalArtifact.lineage.handoffArtifactPath,
      handoffSchemaVersion: args.canonicalArtifact.lineage.handoffSchemaVersion,
      parsedArtifactPath: args.canonicalArtifact.lineage.parsedArtifactPath,
      rawArtifactPath: args.canonicalArtifact.lineage.rawArtifactPath,
    },
    sections: args.canonicalArtifact.sections.map((section) => ({
      sectionName: section.sectionName,
      headerCount: section.headerCount,
      rowCount: section.rowCount,
      targetTableName: buildTargetTableName(section.sectionName),
    })),
    totalRowCount: args.canonicalArtifact.totalRowCount,
    warehouseReadyPayload: {
      recordBatches: args.canonicalArtifact.canonicalPayload.sections.map((section) => {
        const targetTableName = buildTargetTableName(section.sectionName);
        const columnNames = [...WAREHOUSE_METADATA_COLUMNS, ...section.fieldNames];

        return {
          sectionName: section.sectionName,
          targetTableName,
          keyColumns: [...WAREHOUSE_KEY_COLUMNS],
          columnNames,
          rows: section.records.map((record) => {
            const rowValues = columnNames.reduce<Record<string, ParsedCellValue>>(
              (accumulator, columnName) => {
                switch (columnName) {
                  case 'report_id':
                    accumulator[columnName] = args.canonicalArtifact.reportId;
                    break;
                  case 'report_family':
                    accumulator[columnName] = args.canonicalArtifact.reportFamily;
                    break;
                  case 'report_type':
                    accumulator[columnName] = args.canonicalArtifact.reportType;
                    break;
                  case 'section_name':
                    accumulator[columnName] = section.sectionName;
                    break;
                  case 'canonical_record_id':
                    accumulator[columnName] = record.canonicalRecordId;
                    break;
                  case 'source_record_index':
                    accumulator[columnName] = record.sourceRecordIndex;
                    break;
                  default:
                    accumulator[columnName] = record.values[columnName] ?? null;
                    break;
                }

                return accumulator;
              },
              {}
            );

            return {
              warehouseRecordId: record.canonicalRecordId,
              canonicalRecordId: record.canonicalRecordId,
              rowValues,
            };
          }),
        };
      }),
    },
  };

  validateFirstSalesTrafficWarehouseReadyArtifact({
    canonicalArtifact: args.canonicalArtifact,
    warehouseReadyArtifact,
  });

  return warehouseReadyArtifact;
};

export const validateFirstSalesTrafficWarehouseReadyArtifact = (args: {
  canonicalArtifact: FirstReportCanonicalIngestArtifact;
  warehouseReadyArtifact: FirstReportWarehouseReadyArtifact;
}) => {
  const contract = args.warehouseReadyArtifact;

  if (
    contract.warehouseReadyContractVersion !==
    FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION
  ) {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      `Warehouse-ready contract version must be ${FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION}`
    );
  }

  if (contract.contractTarget !== 'local_json_warehouse_ready_contract') {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      'Warehouse-ready contract target must be local_json_warehouse_ready_contract'
    );
  }

  if (!contract.contractTargetDescription.trim()) {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      'Warehouse-ready contract target description must be a non-empty string'
    );
  }

  if (contract.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      'Warehouse-ready reportFamily must be sales_and_traffic'
    );
  }

  if (contract.reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      `Warehouse-ready reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!contract.reportId.trim()) {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      'Warehouse-ready reportId must be a non-empty string'
    );
  }

  if (!contract.lineage.canonicalIngestArtifactPath.trim()) {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      'Warehouse-ready lineage.canonicalIngestArtifactPath must be present'
    );
  }

  if (
    contract.lineage.canonicalIngestVersion !== FIRST_REPORT_CANONICAL_INGEST_VERSION
  ) {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      `Warehouse-ready lineage.canonicalIngestVersion must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (
    !contract.lineage.stagingArtifactPath.trim() ||
    !contract.lineage.stagingVersion.trim() ||
    !contract.lineage.handoffArtifactPath.trim() ||
    !contract.lineage.handoffSchemaVersion.trim() ||
    !contract.lineage.parsedArtifactPath.trim() ||
    !contract.lineage.rawArtifactPath.trim()
  ) {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      'Warehouse-ready lineage must include canonical, staging, handoff, parsed, and raw artifact details'
    );
  }

  if (contract.sections.length !== args.canonicalArtifact.sections.length) {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      'Warehouse-ready section summary count must match the canonical ingest artifact'
    );
  }

  if (
    contract.warehouseReadyPayload.recordBatches.length !==
    args.canonicalArtifact.canonicalPayload.sections.length
  ) {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      'Warehouse-ready record batch count must match the canonical ingest artifact'
    );
  }

  const summedRows = contract.sections.reduce((sum, section) => sum + section.rowCount, 0);
  if (summedRows !== contract.totalRowCount) {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      'Warehouse-ready totalRowCount must equal the sum of section row counts'
    );
  }

  args.canonicalArtifact.sections.forEach((section, index) => {
    const contractSection = contract.sections[index];
    const canonicalPayloadSection = args.canonicalArtifact.canonicalPayload.sections[index];
    const recordBatch = contract.warehouseReadyPayload.recordBatches[index];
    const expectedTargetTableName = buildTargetTableName(section.sectionName);
    const expectedColumnNames = [...WAREHOUSE_METADATA_COLUMNS, ...canonicalPayloadSection.fieldNames];

    if (contractSection.sectionName !== section.sectionName) {
      throw new FirstReportWarehouseReadyError(
        'validation_failed',
        `Warehouse-ready section ${index} name does not match the canonical ingest artifact`
      );
    }

    if (contractSection.headerCount !== section.headerCount) {
      throw new FirstReportWarehouseReadyError(
        'validation_failed',
        `Warehouse-ready section ${section.sectionName} header count does not match the canonical ingest artifact`
      );
    }

    if (contractSection.rowCount !== section.rowCount) {
      throw new FirstReportWarehouseReadyError(
        'validation_failed',
        `Warehouse-ready section ${section.sectionName} row count does not match the canonical ingest artifact`
      );
    }

    if (contractSection.targetTableName !== expectedTargetTableName) {
      throw new FirstReportWarehouseReadyError(
        'validation_failed',
        `Warehouse-ready section ${section.sectionName} target table name is invalid`
      );
    }

    if (recordBatch.sectionName !== section.sectionName) {
      throw new FirstReportWarehouseReadyError(
        'validation_failed',
        `Warehouse-ready record batch ${index} section name does not match the canonical ingest artifact`
      );
    }

    if (recordBatch.targetTableName !== expectedTargetTableName) {
      throw new FirstReportWarehouseReadyError(
        'validation_failed',
        `Warehouse-ready record batch ${section.sectionName} target table name is invalid`
      );
    }

    if (
      recordBatch.keyColumns.length !== WAREHOUSE_KEY_COLUMNS.length ||
      recordBatch.keyColumns.some(
        (columnName, columnIndex) => columnName !== WAREHOUSE_KEY_COLUMNS[columnIndex]
      )
    ) {
      throw new FirstReportWarehouseReadyError(
        'validation_failed',
        `Warehouse-ready record batch ${section.sectionName} key columns are invalid`
      );
    }

    if (
      recordBatch.columnNames.length !== expectedColumnNames.length ||
      recordBatch.columnNames.some(
        (columnName, columnIndex) => columnName !== expectedColumnNames[columnIndex]
      )
    ) {
      throw new FirstReportWarehouseReadyError(
        'validation_failed',
        `Warehouse-ready record batch ${section.sectionName} column names are invalid`
      );
    }

    if (recordBatch.rows.length !== canonicalPayloadSection.records.length) {
      throw new FirstReportWarehouseReadyError(
        'validation_failed',
        `Warehouse-ready record batch ${section.sectionName} row count does not match the canonical ingest artifact`
      );
    }

    recordBatch.rows.forEach((row, rowIndex) => {
      const canonicalRecord = canonicalPayloadSection.records[rowIndex];
      const rowKeys = Object.keys(row.rowValues);

      if (row.warehouseRecordId !== canonicalRecord.canonicalRecordId) {
        throw new FirstReportWarehouseReadyError(
          'validation_failed',
          `Warehouse-ready row id mismatch in section ${section.sectionName} at index ${rowIndex}`
        );
      }

      if (row.canonicalRecordId !== canonicalRecord.canonicalRecordId) {
        throw new FirstReportWarehouseReadyError(
          'validation_failed',
          `Warehouse-ready canonical record id mismatch in section ${section.sectionName} at index ${rowIndex}`
        );
      }

      if (
        rowKeys.length !== recordBatch.columnNames.length ||
        recordBatch.columnNames.some((columnName) => !Object.prototype.hasOwnProperty.call(row.rowValues, columnName))
      ) {
        throw new FirstReportWarehouseReadyError(
          'validation_failed',
          `Warehouse-ready row shape mismatch in section ${section.sectionName} at index ${rowIndex}`
        );
      }
    });
  });
};

export const buildFirstSalesTrafficWarehouseReadyArtifactPath = (args: {
  reportId: string;
  outputRoot?: string;
}) => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new FirstReportWarehouseReadyError(
      'invalid_input',
      'Warehouse-ready artifact path requires a non-empty report id'
    );
  }

  return path.resolve(
    args.outputRoot ?? FIRST_REPORT_WAREHOUSE_READY_OUTPUT_DIR,
    `report-${reportId}.warehouse-ready.json`
  );
};

export const writeFirstSalesTrafficWarehouseReadyArtifact = async (args: {
  warehouseReadyArtifact: FirstReportWarehouseReadyArtifact;
  outputRoot?: string;
}) => {
  const warehouseReadyArtifactPath = buildFirstSalesTrafficWarehouseReadyArtifactPath({
    reportId: args.warehouseReadyArtifact.reportId,
    outputRoot: args.outputRoot,
  });

  try {
    await fs.mkdir(path.dirname(warehouseReadyArtifactPath), { recursive: true });
    await fs.writeFile(
      warehouseReadyArtifactPath,
      `${JSON.stringify(args.warehouseReadyArtifact, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    throw new FirstReportWarehouseReadyError(
      'write_failed',
      `Failed to write warehouse-ready artifact at ${warehouseReadyArtifactPath}`,
      error
    );
  }

  return warehouseReadyArtifactPath;
};

export const summarizeFirstSalesTrafficWarehouseReadyArtifact = (args: {
  warehouseReadyArtifact: FirstReportWarehouseReadyArtifact;
  canonicalIngestArtifactPath: string;
  warehouseReadyArtifactPath: string;
}): FirstReportWarehouseReadySummary => ({
  endpoint: 'runFirstSalesTrafficWarehouseReadyContractPromotion',
  reportId: args.warehouseReadyArtifact.reportId,
  reportFamily: args.warehouseReadyArtifact.reportFamily,
  reportType: args.warehouseReadyArtifact.reportType,
  canonicalIngestArtifactPath: path.resolve(args.canonicalIngestArtifactPath),
  warehouseReadyArtifactPath: path.resolve(args.warehouseReadyArtifactPath),
  warehouseReadyContractVersion:
    args.warehouseReadyArtifact.warehouseReadyContractVersion,
  sectionCount: args.warehouseReadyArtifact.sections.length,
  totalRowCount: args.warehouseReadyArtifact.totalRowCount,
  sections: args.warehouseReadyArtifact.sections.map((section) => ({
    sectionName: section.sectionName,
    headerCount: section.headerCount,
    rowCount: section.rowCount,
    targetTableName: section.targetTableName,
  })),
});

export const runFirstSalesTrafficWarehouseReadyContractPromotion = async (args: {
  reportId?: string;
  canonicalIngestArtifactPath?: string;
  canonicalOutputRoot?: string;
  warehouseReadyOutputRoot?: string;
}): Promise<FirstReportWarehouseReadySummary> => {
  const resolvedInput = await resolveFirstSalesTrafficCanonicalArtifactPath({
    reportId: args.reportId,
    canonicalIngestArtifactPath: args.canonicalIngestArtifactPath,
    canonicalOutputRoot: args.canonicalOutputRoot,
  });
  const canonicalArtifact = await readFirstSalesTrafficCanonicalArtifact({
    canonicalIngestArtifactPath: resolvedInput.canonicalIngestArtifactPath,
  });

  if (canonicalArtifact.reportId !== resolvedInput.reportId) {
    throw new FirstReportWarehouseReadyError(
      'validation_failed',
      `Canonical ingest artifact report id ${canonicalArtifact.reportId} does not match requested report id ${resolvedInput.reportId}`
    );
  }

  const warehouseReadyArtifact = buildFirstSalesTrafficWarehouseReadyArtifact({
    canonicalArtifact,
    canonicalIngestArtifactPath: resolvedInput.canonicalIngestArtifactPath,
  });
  const warehouseReadyArtifactPath =
    await writeFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifact,
      outputRoot: args.warehouseReadyOutputRoot,
    });

  return summarizeFirstSalesTrafficWarehouseReadyArtifact({
    warehouseReadyArtifact,
    canonicalIngestArtifactPath: resolvedInput.canonicalIngestArtifactPath,
    warehouseReadyArtifactPath,
  });
};
