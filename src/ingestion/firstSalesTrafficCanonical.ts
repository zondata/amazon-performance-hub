import fs from 'node:fs/promises';
import path from 'node:path';

import {
  FIRST_REPORT_HANDOFF_SCHEMA_VERSION,
  FIRST_REPORT_LOCAL_STAGE_OUTPUT_DIR,
  FIRST_REPORT_LOCAL_STAGE_VERSION,
  FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
  type SpApiReportType,
} from '../connectors/sp-api';

export const FIRST_REPORT_CANONICAL_INGEST_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-canonical-ingest'
);

export const FIRST_REPORT_CANONICAL_INGEST_VERSION =
  'sp-api-first-report-canonical-ingest/v1';

type ParsedCellValue = string | number | boolean | null;

type LocalStageSectionSummary = {
  sectionName: string;
  headerCount: number;
  rowCount: number;
};

type LocalStageRecord = {
  recordIndex: number;
  values: Record<string, ParsedCellValue>;
};

type LocalStageSection = {
  sectionName: string;
  headers: string[];
  records: LocalStageRecord[];
};

type FirstReportLocalStageArtifact = {
  stagingVersion: string;
  stageTarget: 'local_json_stage';
  stageTargetDescription: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  reportId: string;
  lineage: {
    handoffArtifactPath: string;
    handoffSchemaVersion: string;
    parsedArtifactPath: string;
    rawArtifactPath: string;
  };
  sections: LocalStageSectionSummary[];
  totalRowCount: number;
  stagedPayload: {
    sections: LocalStageSection[];
  };
};

export type FirstReportCanonicalIngestSectionSummary = {
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

export type FirstReportCanonicalIngestArtifact = {
  canonicalIngestVersion: typeof FIRST_REPORT_CANONICAL_INGEST_VERSION;
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
  sections: FirstReportCanonicalIngestSectionSummary[];
  totalRowCount: number;
  canonicalPayload: {
    sections: CanonicalPayloadSection[];
  };
};

export type FirstReportCanonicalIngestSummary = {
  endpoint: 'runFirstSalesTrafficCanonicalIngestBoundary';
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  stagingArtifactPath: string;
  canonicalIngestArtifactPath: string;
  canonicalIngestVersion: string;
  sectionCount: number;
  totalRowCount: number;
  sections: FirstReportCanonicalIngestSectionSummary[];
};

export class FirstReportCanonicalIngestError extends Error {
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
    this.name = 'FirstReportCanonicalIngestError';
    this.code = code;
    this.details = details;
  }
}

const LOCAL_STAGE_ARTIFACT_NAME_RE =
  /^report-(?<reportId>.+)\.local-stage\.json$/;

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
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      `${fieldName} must be an array of strings`
    );
  }

  return value.map((entry, index) => {
    const parsed = asString(entry);
    if (!parsed) {
      throw new FirstReportCanonicalIngestError(
        'invalid_content',
        `${fieldName}[${index}] must be a non-empty string`
      );
    }

    return parsed;
  });
};

const asNonNegativeInteger = (value: unknown, fieldName: string) => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new FirstReportCanonicalIngestError(
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

  throw new FirstReportCanonicalIngestError(
    'invalid_content',
    `${fieldName} must contain only string, number, boolean, or null values`
  );
};

const parseStageSectionSummary = (
  value: unknown,
  index: number
): LocalStageSectionSummary => {
  const section = asObject(value);
  const sectionName = asString(section?.sectionName);

  if (!sectionName) {
    throw new FirstReportCanonicalIngestError(
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

const parseStagePayloadSection = (
  value: unknown,
  index: number
): LocalStageSection => {
  const section = asObject(value);
  const sectionName = asString(section?.sectionName);

  if (!sectionName) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      `stagedPayload.sections[${index}].sectionName must be a non-empty string`
    );
  }

  const headers = asStringArray(
    section?.headers,
    `stagedPayload.sections[${index}].headers`
  );

  if (!Array.isArray(section?.records)) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      `stagedPayload.sections[${index}].records must be an array`
    );
  }

  const records = section.records.map((entry, recordIndex) => {
    const record = asObject(entry);
    if (!record) {
      throw new FirstReportCanonicalIngestError(
        'invalid_content',
        `stagedPayload.sections[${index}].records[${recordIndex}] must be an object`
      );
    }

    const sourceRecordIndex = asNonNegativeInteger(
      record.recordIndex,
      `stagedPayload.sections[${index}].records[${recordIndex}].recordIndex`
    );
    const values = asObject(record.values);

    if (!values) {
      throw new FirstReportCanonicalIngestError(
        'invalid_content',
        `stagedPayload.sections[${index}].records[${recordIndex}].values must be an object`
      );
    }

    const valueKeys = Object.keys(values);
    if (valueKeys.length !== headers.length) {
      throw new FirstReportCanonicalIngestError(
        'invalid_content',
        `stagedPayload.sections[${index}].records[${recordIndex}] key count must match the header count`
      );
    }

    const normalizedValues: Record<string, ParsedCellValue> = {};

    for (const header of headers) {
      if (!Object.prototype.hasOwnProperty.call(values, header)) {
        throw new FirstReportCanonicalIngestError(
          'invalid_content',
          `stagedPayload.sections[${index}].records[${recordIndex}] is missing header ${header}`
        );
      }

      normalizedValues[header] = validateCellValue(
        values[header],
        `stagedPayload.sections[${index}].records[${recordIndex}].values.${header}`
      );
    }

    for (const key of valueKeys) {
      if (!headers.includes(key)) {
        throw new FirstReportCanonicalIngestError(
          'invalid_content',
          `stagedPayload.sections[${index}].records[${recordIndex}] contains unexpected key ${key}`
        );
      }
    }

    return {
      recordIndex: sourceRecordIndex,
      values: normalizedValues,
    };
  });

  return {
    sectionName,
    headers,
    records,
  };
};

const parseFirstReportLocalStageArtifact = (
  value: unknown
): FirstReportLocalStageArtifact => {
  const artifact = asObject(value);
  const reportId = asString(artifact?.reportId);
  const reportType = asString(artifact?.reportType);
  const lineage = asObject(artifact?.lineage);
  const handoffArtifactPath = asString(lineage?.handoffArtifactPath);
  const handoffSchemaVersion = asString(lineage?.handoffSchemaVersion);
  const parsedArtifactPath = asString(lineage?.parsedArtifactPath);
  const rawArtifactPath = asString(lineage?.rawArtifactPath);

  if (artifact?.stagingVersion !== FIRST_REPORT_LOCAL_STAGE_VERSION) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      `Staging version must be ${FIRST_REPORT_LOCAL_STAGE_VERSION}`
    );
  }

  if (artifact?.stageTarget !== 'local_json_stage') {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      'Staging stageTarget must be local_json_stage'
    );
  }

  if (!asString(artifact?.stageTargetDescription)) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      'Staging stageTargetDescription must be a non-empty string'
    );
  }

  if (artifact?.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      'Staging reportFamily must be sales_and_traffic'
    );
  }

  if (reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      `Staging reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!reportId) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      'Staging reportId must be a non-empty string'
    );
  }

  if (
    !handoffArtifactPath ||
    !handoffSchemaVersion ||
    !parsedArtifactPath ||
    !rawArtifactPath
  ) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      'Staging lineage must include handoffArtifactPath, handoffSchemaVersion, parsedArtifactPath, and rawArtifactPath'
    );
  }

  if (handoffSchemaVersion !== FIRST_REPORT_HANDOFF_SCHEMA_VERSION) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      `Staging lineage.handoffSchemaVersion must be ${FIRST_REPORT_HANDOFF_SCHEMA_VERSION}`
    );
  }

  if (!Array.isArray(artifact?.sections)) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      'Staging sections must be an array'
    );
  }

  const stagedPayload = asObject(artifact?.stagedPayload);
  if (!Array.isArray(stagedPayload?.sections)) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      'Staging stagedPayload.sections must be an array'
    );
  }

  const sections = artifact.sections.map((section, index) =>
    parseStageSectionSummary(section, index)
  );
  const payloadSections = stagedPayload.sections.map((section, index) =>
    parseStagePayloadSection(section, index)
  );
  const totalRowCount = asNonNegativeInteger(artifact?.totalRowCount, 'totalRowCount');

  if (sections.length !== payloadSections.length) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      'Staging sections and stagedPayload.sections must have the same length'
    );
  }

  const summedRows = sections.reduce((sum, section) => sum + section.rowCount, 0);
  if (summedRows !== totalRowCount) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      'Staging totalRowCount must equal the sum of section row counts'
    );
  }

  sections.forEach((section, index) => {
    const payloadSection = payloadSections[index];

    if (section.sectionName !== payloadSection.sectionName) {
      throw new FirstReportCanonicalIngestError(
        'invalid_content',
        `Staging payload section ${index} name does not match the section summary`
      );
    }

    if (section.headerCount !== payloadSection.headers.length) {
      throw new FirstReportCanonicalIngestError(
        'invalid_content',
        `Staging section ${section.sectionName} header count does not match payload headers`
      );
    }

    if (section.rowCount !== payloadSection.records.length) {
      throw new FirstReportCanonicalIngestError(
        'invalid_content',
        `Staging section ${section.sectionName} row count does not match payload records`
      );
    }
  });

  return {
    stagingVersion: FIRST_REPORT_LOCAL_STAGE_VERSION,
    stageTarget: 'local_json_stage',
    stageTargetDescription: asString(artifact.stageTargetDescription)!,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    reportId,
    lineage: {
      handoffArtifactPath: path.resolve(handoffArtifactPath),
      handoffSchemaVersion,
      parsedArtifactPath: path.resolve(parsedArtifactPath),
      rawArtifactPath: path.resolve(rawArtifactPath),
    },
    sections,
    totalRowCount,
    stagedPayload: {
      sections: payloadSections,
    },
  };
};

const buildCanonicalRecordId = (args: {
  reportId: string;
  sectionName: string;
  sourceRecordIndex: number;
}) => `${args.reportId}:${args.sectionName}:${args.sourceRecordIndex}`;

const deriveReportIdFromStageArtifactPath = (stagingArtifactPath: string) => {
  const match = path.basename(stagingArtifactPath).match(LOCAL_STAGE_ARTIFACT_NAME_RE);
  const reportId = match?.groups?.reportId?.trim();

  return reportId && reportId.length > 0 ? reportId : null;
};

export const resolveFirstSalesTrafficStageArtifactPath = async (args: {
  reportId?: string;
  stagingArtifactPath?: string;
  stagingOutputRoot?: string;
}) => {
  const stagingArtifactPath = args.stagingArtifactPath?.trim();
  const explicitReportId = args.reportId?.trim();

  if (stagingArtifactPath) {
    const derivedReportId = deriveReportIdFromStageArtifactPath(stagingArtifactPath);

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new FirstReportCanonicalIngestError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match staging artifact path ${path.basename(
          stagingArtifactPath
        )}`
      );
    }

    try {
      await fs.access(stagingArtifactPath);
    } catch (error) {
      throw new FirstReportCanonicalIngestError(
        'artifact_not_found',
        `SP-API staging artifact not found at ${stagingArtifactPath}`,
        error
      );
    }

    const reportId = explicitReportId ?? derivedReportId;
    if (!reportId) {
      throw new FirstReportCanonicalIngestError(
        'invalid_input',
        'Staging artifact path must follow the V2-09 deterministic naming or be paired with --report-id'
      );
    }

    return {
      reportId,
      stagingArtifactPath: path.resolve(stagingArtifactPath),
    };
  }

  if (!explicitReportId) {
    throw new FirstReportCanonicalIngestError(
      'invalid_input',
      'Canonical ingest requires either --report-id <value> or --staging-path <value>'
    );
  }

  const candidate = path.resolve(
    args.stagingOutputRoot ?? FIRST_REPORT_LOCAL_STAGE_OUTPUT_DIR,
    `report-${explicitReportId}.local-stage.json`
  );

  try {
    await fs.access(candidate);
  } catch (error) {
    throw new FirstReportCanonicalIngestError(
      'artifact_not_found',
      `SP-API staging artifact not found for report ${explicitReportId} under ${
        args.stagingOutputRoot ?? FIRST_REPORT_LOCAL_STAGE_OUTPUT_DIR
      }`,
      error
    );
  }

  return {
    reportId: explicitReportId,
    stagingArtifactPath: candidate,
  };
};

export const readFirstSalesTrafficStageArtifact = async (args: {
  stagingArtifactPath: string;
}): Promise<FirstReportLocalStageArtifact> => {
  const stagingArtifactPath = path.resolve(args.stagingArtifactPath);

  let text: string;
  try {
    text = await fs.readFile(stagingArtifactPath, 'utf8');
  } catch (error) {
    throw new FirstReportCanonicalIngestError(
      'artifact_not_found',
      `Failed to read SP-API staging artifact at ${stagingArtifactPath}`,
      error
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new FirstReportCanonicalIngestError(
      'invalid_content',
      `SP-API staging artifact at ${stagingArtifactPath} is not valid JSON`,
      error
    );
  }

  return parseFirstReportLocalStageArtifact(parsed);
};

export const buildFirstSalesTrafficCanonicalIngestArtifact = (args: {
  stagingArtifact: FirstReportLocalStageArtifact;
  stagingArtifactPath: string;
}): FirstReportCanonicalIngestArtifact => {
  const canonicalArtifact: FirstReportCanonicalIngestArtifact = {
    canonicalIngestVersion: FIRST_REPORT_CANONICAL_INGEST_VERSION,
    ingestTarget: 'local_json_canonical_ingest',
    ingestTargetDescription:
      'Deterministic local canonical ingest artifact for explicit ingestion-boundary proof only; not a warehouse target',
    reportFamily: args.stagingArtifact.reportFamily,
    reportType: args.stagingArtifact.reportType,
    reportId: args.stagingArtifact.reportId,
    lineage: {
      stagingArtifactPath: path.resolve(args.stagingArtifactPath),
      stagingVersion: args.stagingArtifact.stagingVersion,
      handoffArtifactPath: args.stagingArtifact.lineage.handoffArtifactPath,
      handoffSchemaVersion: args.stagingArtifact.lineage.handoffSchemaVersion,
      parsedArtifactPath: args.stagingArtifact.lineage.parsedArtifactPath,
      rawArtifactPath: args.stagingArtifact.lineage.rawArtifactPath,
    },
    sections: args.stagingArtifact.sections.map((section) => ({
      sectionName: section.sectionName,
      headerCount: section.headerCount,
      rowCount: section.rowCount,
    })),
    totalRowCount: args.stagingArtifact.totalRowCount,
    canonicalPayload: {
      sections: args.stagingArtifact.stagedPayload.sections.map((section) => ({
        sectionName: section.sectionName,
        fieldNames: [...section.headers],
        records: section.records.map((record) => {
          const orderedValues = section.headers.reduce<Record<string, ParsedCellValue>>(
            (accumulator, header) => {
              accumulator[header] = record.values[header] ?? null;
              return accumulator;
            },
            {}
          );

          return {
            canonicalRecordId: buildCanonicalRecordId({
              reportId: args.stagingArtifact.reportId,
              sectionName: section.sectionName,
              sourceRecordIndex: record.recordIndex,
            }),
            sourceRecordIndex: record.recordIndex,
            values: orderedValues,
          };
        }),
      })),
    },
  };

  validateFirstSalesTrafficCanonicalIngestArtifact({
    stagingArtifact: args.stagingArtifact,
    canonicalArtifact,
  });

  return canonicalArtifact;
};

export const validateFirstSalesTrafficCanonicalIngestArtifact = (args: {
  stagingArtifact: FirstReportLocalStageArtifact;
  canonicalArtifact: FirstReportCanonicalIngestArtifact;
}) => {
  const canonical = args.canonicalArtifact;

  if (canonical.canonicalIngestVersion !== FIRST_REPORT_CANONICAL_INGEST_VERSION) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      `Canonical ingest version must be ${FIRST_REPORT_CANONICAL_INGEST_VERSION}`
    );
  }

  if (canonical.ingestTarget !== 'local_json_canonical_ingest') {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      'Canonical ingest target must be local_json_canonical_ingest'
    );
  }

  if (!canonical.ingestTargetDescription.trim()) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      'Canonical ingest target description must be a non-empty string'
    );
  }

  if (canonical.reportFamily !== 'sales_and_traffic') {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      'Canonical reportFamily must be sales_and_traffic'
    );
  }

  if (canonical.reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      `Canonical reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!canonical.reportId.trim()) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      'Canonical reportId must be a non-empty string'
    );
  }

  if (!canonical.lineage.stagingArtifactPath.trim()) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      'Canonical lineage.stagingArtifactPath must be present'
    );
  }

  if (canonical.lineage.stagingVersion !== FIRST_REPORT_LOCAL_STAGE_VERSION) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      `Canonical lineage.stagingVersion must be ${FIRST_REPORT_LOCAL_STAGE_VERSION}`
    );
  }

  if (!canonical.lineage.handoffArtifactPath.trim()) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      'Canonical lineage.handoffArtifactPath must be present'
    );
  }

  if (canonical.lineage.handoffSchemaVersion !== FIRST_REPORT_HANDOFF_SCHEMA_VERSION) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      `Canonical lineage.handoffSchemaVersion must be ${FIRST_REPORT_HANDOFF_SCHEMA_VERSION}`
    );
  }

  if (
    !canonical.lineage.parsedArtifactPath.trim() ||
    !canonical.lineage.rawArtifactPath.trim()
  ) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      'Canonical lineage must include parsedArtifactPath and rawArtifactPath'
    );
  }

  if (canonical.sections.length !== args.stagingArtifact.sections.length) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      'Canonical section summary count must match the staging artifact'
    );
  }

  if (
    canonical.canonicalPayload.sections.length !==
    args.stagingArtifact.stagedPayload.sections.length
  ) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      'Canonical payload section count must match the staging artifact'
    );
  }

  const summedRows = canonical.sections.reduce(
    (sum, section) => sum + section.rowCount,
    0
  );
  if (summedRows !== canonical.totalRowCount) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      'Canonical totalRowCount must equal the sum of section row counts'
    );
  }

  args.stagingArtifact.sections.forEach((section, index) => {
    const canonicalSection = canonical.sections[index];
    const stagingPayloadSection = args.stagingArtifact.stagedPayload.sections[index];
    const canonicalPayloadSection = canonical.canonicalPayload.sections[index];

    if (canonicalSection.sectionName !== section.sectionName) {
      throw new FirstReportCanonicalIngestError(
        'validation_failed',
        `Canonical section ${index} name does not match the staging artifact`
      );
    }

    if (canonicalSection.headerCount !== section.headerCount) {
      throw new FirstReportCanonicalIngestError(
        'validation_failed',
        `Canonical section ${section.sectionName} header count does not match the staging artifact`
      );
    }

    if (canonicalSection.rowCount !== section.rowCount) {
      throw new FirstReportCanonicalIngestError(
        'validation_failed',
        `Canonical section ${section.sectionName} row count does not match the staging artifact`
      );
    }

    if (canonicalPayloadSection.sectionName !== section.sectionName) {
      throw new FirstReportCanonicalIngestError(
        'validation_failed',
        `Canonical payload section ${index} name does not match the staging artifact`
      );
    }

    if (canonicalPayloadSection.fieldNames.length !== stagingPayloadSection.headers.length) {
      throw new FirstReportCanonicalIngestError(
        'validation_failed',
        `Canonical payload section ${section.sectionName} field count does not match the staging artifact`
      );
    }

    if (
      canonicalPayloadSection.fieldNames.some(
        (fieldName, fieldIndex) => fieldName !== stagingPayloadSection.headers[fieldIndex]
      )
    ) {
      throw new FirstReportCanonicalIngestError(
        'validation_failed',
        `Canonical payload section ${section.sectionName} field ordering does not match the staging artifact`
      );
    }

    if (canonicalPayloadSection.records.length !== stagingPayloadSection.records.length) {
      throw new FirstReportCanonicalIngestError(
        'validation_failed',
        `Canonical payload section ${section.sectionName} record count does not match the staging artifact`
      );
    }

    canonicalPayloadSection.records.forEach((record, recordIndex) => {
      const stagedRecord = stagingPayloadSection.records[recordIndex];
      const expectedCanonicalRecordId = buildCanonicalRecordId({
        reportId: canonical.reportId,
        sectionName: section.sectionName,
        sourceRecordIndex: stagedRecord.recordIndex,
      });

      if (record.canonicalRecordId !== expectedCanonicalRecordId) {
        throw new FirstReportCanonicalIngestError(
          'validation_failed',
          `Canonical record id mismatch in section ${section.sectionName} at index ${recordIndex}`
        );
      }

      if (record.sourceRecordIndex !== stagedRecord.recordIndex) {
        throw new FirstReportCanonicalIngestError(
          'validation_failed',
          `Canonical sourceRecordIndex mismatch in section ${section.sectionName} at index ${recordIndex}`
        );
      }

      const recordKeys = Object.keys(record.values);
      if (recordKeys.length !== canonicalPayloadSection.fieldNames.length) {
        throw new FirstReportCanonicalIngestError(
          'validation_failed',
          `Canonical record field count mismatch in section ${section.sectionName} at index ${recordIndex}`
        );
      }

      canonicalPayloadSection.fieldNames.forEach((fieldName) => {
        if (!Object.prototype.hasOwnProperty.call(record.values, fieldName)) {
          throw new FirstReportCanonicalIngestError(
            'validation_failed',
            `Canonical record in section ${section.sectionName} at index ${recordIndex} is missing field ${fieldName}`
          );
        }
      });
    });
  });
};

export const buildFirstSalesTrafficCanonicalIngestArtifactPath = (args: {
  reportId: string;
  outputRoot?: string;
}) => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new FirstReportCanonicalIngestError(
      'invalid_input',
      'Canonical ingest artifact path requires a non-empty report id'
    );
  }

  return path.resolve(
    args.outputRoot ?? FIRST_REPORT_CANONICAL_INGEST_OUTPUT_DIR,
    `report-${reportId}.canonical-ingest.json`
  );
};

export const writeFirstSalesTrafficCanonicalIngestArtifact = async (args: {
  canonicalArtifact: FirstReportCanonicalIngestArtifact;
  outputRoot?: string;
}) => {
  const canonicalIngestArtifactPath = buildFirstSalesTrafficCanonicalIngestArtifactPath(
    {
      reportId: args.canonicalArtifact.reportId,
      outputRoot: args.outputRoot,
    }
  );

  try {
    await fs.mkdir(path.dirname(canonicalIngestArtifactPath), { recursive: true });
    await fs.writeFile(
      canonicalIngestArtifactPath,
      `${JSON.stringify(args.canonicalArtifact, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    throw new FirstReportCanonicalIngestError(
      'write_failed',
      `Failed to write canonical ingest artifact at ${canonicalIngestArtifactPath}`,
      error
    );
  }

  return canonicalIngestArtifactPath;
};

export const summarizeFirstSalesTrafficCanonicalIngestArtifact = (args: {
  canonicalArtifact: FirstReportCanonicalIngestArtifact;
  stagingArtifactPath: string;
  canonicalIngestArtifactPath: string;
}): FirstReportCanonicalIngestSummary => ({
  endpoint: 'runFirstSalesTrafficCanonicalIngestBoundary',
  reportId: args.canonicalArtifact.reportId,
  reportFamily: args.canonicalArtifact.reportFamily,
  reportType: args.canonicalArtifact.reportType,
  stagingArtifactPath: path.resolve(args.stagingArtifactPath),
  canonicalIngestArtifactPath: path.resolve(args.canonicalIngestArtifactPath),
  canonicalIngestVersion: args.canonicalArtifact.canonicalIngestVersion,
  sectionCount: args.canonicalArtifact.sections.length,
  totalRowCount: args.canonicalArtifact.totalRowCount,
  sections: args.canonicalArtifact.sections.map((section) => ({
    sectionName: section.sectionName,
    headerCount: section.headerCount,
    rowCount: section.rowCount,
  })),
});

export const runFirstSalesTrafficCanonicalIngestBoundary = async (args: {
  reportId?: string;
  stagingArtifactPath?: string;
  stagingOutputRoot?: string;
  canonicalOutputRoot?: string;
}): Promise<FirstReportCanonicalIngestSummary> => {
  const resolvedInput = await resolveFirstSalesTrafficStageArtifactPath({
    reportId: args.reportId,
    stagingArtifactPath: args.stagingArtifactPath,
    stagingOutputRoot: args.stagingOutputRoot,
  });
  const stagingArtifact = await readFirstSalesTrafficStageArtifact({
    stagingArtifactPath: resolvedInput.stagingArtifactPath,
  });

  if (stagingArtifact.reportId !== resolvedInput.reportId) {
    throw new FirstReportCanonicalIngestError(
      'validation_failed',
      `Staging artifact report id ${stagingArtifact.reportId} does not match requested report id ${resolvedInput.reportId}`
    );
  }

  const canonicalArtifact = buildFirstSalesTrafficCanonicalIngestArtifact({
    stagingArtifact,
    stagingArtifactPath: resolvedInput.stagingArtifactPath,
  });
  const canonicalIngestArtifactPath =
    await writeFirstSalesTrafficCanonicalIngestArtifact({
      canonicalArtifact,
      outputRoot: args.canonicalOutputRoot,
    });

  return summarizeFirstSalesTrafficCanonicalIngestArtifact({
    canonicalArtifact,
    stagingArtifactPath: resolvedInput.stagingArtifactPath,
    canonicalIngestArtifactPath,
  });
};
