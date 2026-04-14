import fs from 'node:fs/promises';
import path from 'node:path';

import {
  FIRST_REPORT_HANDOFF_OUTPUT_DIR,
  FIRST_REPORT_HANDOFF_SCHEMA_VERSION,
} from './firstReportHandoff';
import { FIRST_SALES_AND_TRAFFIC_REPORT_TYPE } from './firstReportRequest';
import {
  SpApiLocalStageError,
  type SpApiFirstReportLocalStageSectionSummary,
  type SpApiFirstReportLocalStageSummary,
  type SpApiReportType,
} from './types';

export const FIRST_REPORT_LOCAL_STAGE_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-staging'
);

export const FIRST_REPORT_LOCAL_STAGE_VERSION =
  'sp-api-first-report-local-stage/v1';

type ParsedCellValue = string | number | boolean | null;

type HandoffSectionSummary = {
  sectionName: string;
  headerCount: number;
  rowCount: number;
};

type HandoffPayloadSection = {
  sectionName: string;
  headers: string[];
  rows: Record<string, ParsedCellValue>[];
};

type FirstReportHandoffArtifact = {
  schemaVersion: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  reportId: string;
  generatedAt: string;
  sourceArtifacts: {
    parsedArtifactPath: string;
    rawArtifactPath: string;
  };
  sections: HandoffSectionSummary[];
  totalRowCount: number;
  payload: {
    sections: HandoffPayloadSection[];
  };
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
  stagingVersion: typeof FIRST_REPORT_LOCAL_STAGE_VERSION;
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
  sections: SpApiFirstReportLocalStageSectionSummary[];
  totalRowCount: number;
  stagedPayload: {
    sections: LocalStageSection[];
  };
};

const HANDOFF_ARTIFACT_NAME_RE = /^report-(?<reportId>.+)\.handoff\.json$/;

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
    throw new SpApiLocalStageError(
      'invalid_content',
      `${fieldName} must be an array of strings`
    );
  }

  return value.map((entry, index) => {
    const parsed = asString(entry);
    if (!parsed) {
      throw new SpApiLocalStageError(
        'invalid_content',
        `${fieldName}[${index}] must be a non-empty string`
      );
    }

    return parsed;
  });
};

const asNonNegativeInteger = (value: unknown, fieldName: string) => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new SpApiLocalStageError(
      'invalid_content',
      `${fieldName} must be a non-negative integer`
    );
  }

  return Number(value);
};

const validateCellValue = (value: unknown, fieldName: string): ParsedCellValue => {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value ?? null;
  }

  throw new SpApiLocalStageError(
    'invalid_content',
    `${fieldName} must contain only string, number, boolean, or null values`
  );
};

const parseHandoffSectionSummary = (
  value: unknown,
  index: number
): HandoffSectionSummary => {
  const section = asObject(value);
  const sectionName = asString(section?.sectionName);

  if (!sectionName) {
    throw new SpApiLocalStageError(
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
    rowCount: asNonNegativeInteger(section?.rowCount, `sections[${index}].rowCount`),
  };
};

const parseHandoffPayloadSection = (
  value: unknown,
  index: number
): HandoffPayloadSection => {
  const section = asObject(value);
  const sectionName = asString(section?.sectionName);

  if (!sectionName) {
    throw new SpApiLocalStageError(
      'invalid_content',
      `payload.sections[${index}].sectionName must be a non-empty string`
    );
  }

  const headers = asStringArray(
    section?.headers,
    `payload.sections[${index}].headers`
  );

  if (!Array.isArray(section?.rows)) {
    throw new SpApiLocalStageError(
      'invalid_content',
      `payload.sections[${index}].rows must be an array`
    );
  }

  const rows = section.rows.map((entry, rowIndex) => {
    const row = asObject(entry);
    if (!row) {
      throw new SpApiLocalStageError(
        'invalid_content',
        `payload.sections[${index}].rows[${rowIndex}] must be an object`
      );
    }

    const rowKeys = Object.keys(row);
    if (rowKeys.length !== headers.length) {
      throw new SpApiLocalStageError(
        'invalid_content',
        `payload.sections[${index}].rows[${rowIndex}] key count must match the header count`
      );
    }

    const normalizedRow: Record<string, ParsedCellValue> = {};

    for (const header of headers) {
      if (!Object.prototype.hasOwnProperty.call(row, header)) {
        throw new SpApiLocalStageError(
          'invalid_content',
          `payload.sections[${index}].rows[${rowIndex}] is missing header ${header}`
        );
      }

      normalizedRow[header] = validateCellValue(
        row[header],
        `payload.sections[${index}].rows[${rowIndex}].${header}`
      );
    }

    for (const key of rowKeys) {
      if (!headers.includes(key)) {
        throw new SpApiLocalStageError(
          'invalid_content',
          `payload.sections[${index}].rows[${rowIndex}] contains unexpected key ${key}`
        );
      }
    }

    return normalizedRow;
  });

  return {
    sectionName,
    headers,
    rows,
  };
};

const parseFirstReportHandoffArtifact = (value: unknown): FirstReportHandoffArtifact => {
  const artifact = asObject(value);
  const reportId = asString(artifact?.reportId);
  const generatedAt = asString(artifact?.generatedAt);
  const reportType = asString(artifact?.reportType);
  const sourceArtifacts = asObject(artifact?.sourceArtifacts);
  const parsedArtifactPath = asString(sourceArtifacts?.parsedArtifactPath);
  const rawArtifactPath = asString(sourceArtifacts?.rawArtifactPath);

  if (artifact?.schemaVersion !== FIRST_REPORT_HANDOFF_SCHEMA_VERSION) {
    throw new SpApiLocalStageError(
      'invalid_content',
      `Handoff schemaVersion must be ${FIRST_REPORT_HANDOFF_SCHEMA_VERSION}`
    );
  }

  if (artifact?.reportFamily !== 'sales_and_traffic') {
    throw new SpApiLocalStageError(
      'invalid_content',
      'Handoff reportFamily must be sales_and_traffic'
    );
  }

  if (reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new SpApiLocalStageError(
      'invalid_content',
      `Handoff reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!reportId) {
    throw new SpApiLocalStageError(
      'invalid_content',
      'Handoff reportId must be a non-empty string'
    );
  }

  if (!generatedAt) {
    throw new SpApiLocalStageError(
      'invalid_content',
      'Handoff generatedAt must be a non-empty string'
    );
  }

  if (!parsedArtifactPath || !rawArtifactPath) {
    throw new SpApiLocalStageError(
      'invalid_content',
      'Handoff sourceArtifacts must include parsedArtifactPath and rawArtifactPath'
    );
  }

  if (!Array.isArray(artifact?.sections)) {
    throw new SpApiLocalStageError(
      'invalid_content',
      'Handoff sections must be an array'
    );
  }

  const payload = asObject(artifact?.payload);
  if (!Array.isArray(payload?.sections)) {
    throw new SpApiLocalStageError(
      'invalid_content',
      'Handoff payload.sections must be an array'
    );
  }

  const sections = artifact.sections.map((section, index) =>
    parseHandoffSectionSummary(section, index)
  );
  const payloadSections = payload.sections.map((section, index) =>
    parseHandoffPayloadSection(section, index)
  );
  const totalRowCount = asNonNegativeInteger(artifact?.totalRowCount, 'totalRowCount');

  if (sections.length !== payloadSections.length) {
    throw new SpApiLocalStageError(
      'invalid_content',
      'Handoff sections and payload.sections must have the same length'
    );
  }

  const summedRows = sections.reduce((sum, section) => sum + section.rowCount, 0);
  if (summedRows !== totalRowCount) {
    throw new SpApiLocalStageError(
      'invalid_content',
      'Handoff totalRowCount must equal the sum of section row counts'
    );
  }

  sections.forEach((section, index) => {
    const payloadSection = payloadSections[index];
    if (section.sectionName !== payloadSection.sectionName) {
      throw new SpApiLocalStageError(
        'invalid_content',
        `Handoff payload section ${index} name does not match the section summary`
      );
    }

    if (section.headerCount !== payloadSection.headers.length) {
      throw new SpApiLocalStageError(
        'invalid_content',
        `Handoff section ${section.sectionName} header count does not match payload headers`
      );
    }

    if (section.rowCount !== payloadSection.rows.length) {
      throw new SpApiLocalStageError(
        'invalid_content',
        `Handoff section ${section.sectionName} row count does not match payload rows`
      );
    }
  });

  return {
    schemaVersion: FIRST_REPORT_HANDOFF_SCHEMA_VERSION,
    reportFamily: 'sales_and_traffic',
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    reportId,
    generatedAt,
    sourceArtifacts: {
      parsedArtifactPath: path.resolve(parsedArtifactPath),
      rawArtifactPath: path.resolve(rawArtifactPath),
    },
    sections,
    totalRowCount,
    payload: {
      sections: payloadSections,
    },
  };
};

const deriveReportIdFromHandoffArtifactPath = (handoffArtifactPath: string) => {
  const match = path.basename(handoffArtifactPath).match(HANDOFF_ARTIFACT_NAME_RE);
  const reportId = match?.groups?.reportId?.trim();

  return reportId && reportId.length > 0 ? reportId : null;
};

export const resolveFirstSalesAndTrafficHandoffArtifactPath = async (args: {
  reportId?: string;
  handoffArtifactPath?: string;
  handoffOutputRoot?: string;
}) => {
  const handoffArtifactPath = args.handoffArtifactPath?.trim();
  const explicitReportId = args.reportId?.trim();

  if (handoffArtifactPath) {
    const derivedReportId = deriveReportIdFromHandoffArtifactPath(handoffArtifactPath);

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new SpApiLocalStageError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match handoff artifact path ${path.basename(
          handoffArtifactPath
        )}`
      );
    }

    try {
      await fs.access(handoffArtifactPath);
    } catch (error) {
      throw new SpApiLocalStageError(
        'artifact_not_found',
        `SP-API handoff artifact not found at ${handoffArtifactPath}`,
        error
      );
    }

    const reportId = explicitReportId ?? derivedReportId;
    if (!reportId) {
      throw new SpApiLocalStageError(
        'invalid_input',
        'Handoff artifact path must follow the V2-08 deterministic naming or be paired with --report-id'
      );
    }

    return {
      reportId,
      handoffArtifactPath: path.resolve(handoffArtifactPath),
    };
  }

  if (!explicitReportId) {
    throw new SpApiLocalStageError(
      'invalid_input',
      'Local staging ingestion requires either --report-id <value> or --handoff-path <value>'
    );
  }

  const candidate = path.resolve(
    args.handoffOutputRoot ?? FIRST_REPORT_HANDOFF_OUTPUT_DIR,
    `report-${explicitReportId}.handoff.json`
  );

  try {
    await fs.access(candidate);
  } catch (error) {
    throw new SpApiLocalStageError(
      'artifact_not_found',
      `SP-API handoff artifact not found for report ${explicitReportId} under ${
        args.handoffOutputRoot ?? FIRST_REPORT_HANDOFF_OUTPUT_DIR
      }`,
      error
    );
  }

  return {
    reportId: explicitReportId,
    handoffArtifactPath: candidate,
  };
};

export const readFirstSalesAndTrafficHandoffArtifact = async (args: {
  handoffArtifactPath: string;
}): Promise<FirstReportHandoffArtifact> => {
  const handoffArtifactPath = path.resolve(args.handoffArtifactPath);

  let text: string;
  try {
    text = await fs.readFile(handoffArtifactPath, 'utf8');
  } catch (error) {
    throw new SpApiLocalStageError(
      'artifact_not_found',
      `Failed to read SP-API handoff artifact at ${handoffArtifactPath}`,
      error
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new SpApiLocalStageError(
      'invalid_content',
      `SP-API handoff artifact at ${handoffArtifactPath} is not valid JSON`,
      error
    );
  }

  return parseFirstReportHandoffArtifact(parsed);
};

export const buildFirstSalesAndTrafficLocalStageArtifact = (args: {
  handoffArtifact: FirstReportHandoffArtifact;
  handoffArtifactPath: string;
}): FirstReportLocalStageArtifact => {
  const sections: SpApiFirstReportLocalStageSectionSummary[] =
    args.handoffArtifact.sections.map((section) => ({
      sectionName: section.sectionName,
      headerCount: section.headerCount,
      rowCount: section.rowCount,
    }));

  const stagingArtifact: FirstReportLocalStageArtifact = {
    stagingVersion: FIRST_REPORT_LOCAL_STAGE_VERSION,
    stageTarget: 'local_json_stage',
    stageTargetDescription:
      'Deterministic local JSON staging artifact for bounded ingestion proof only; not a warehouse target',
    reportFamily: args.handoffArtifact.reportFamily,
    reportType: args.handoffArtifact.reportType,
    reportId: args.handoffArtifact.reportId,
    lineage: {
      handoffArtifactPath: path.resolve(args.handoffArtifactPath),
      handoffSchemaVersion: args.handoffArtifact.schemaVersion,
      parsedArtifactPath: args.handoffArtifact.sourceArtifacts.parsedArtifactPath,
      rawArtifactPath: args.handoffArtifact.sourceArtifacts.rawArtifactPath,
    },
    sections,
    totalRowCount: args.handoffArtifact.totalRowCount,
    stagedPayload: {
      sections: args.handoffArtifact.payload.sections.map((section) => ({
        sectionName: section.sectionName,
        headers: [...section.headers],
        records: section.rows.map((row, recordIndex) => ({
          recordIndex,
          values: { ...row },
        })),
      })),
    },
  };

  validateFirstSalesAndTrafficLocalStageArtifact({
    handoffArtifact: args.handoffArtifact,
    stagingArtifact,
  });

  return stagingArtifact;
};

export const validateFirstSalesAndTrafficLocalStageArtifact = (args: {
  handoffArtifact: FirstReportHandoffArtifact;
  stagingArtifact: FirstReportLocalStageArtifact;
}) => {
  const staging = args.stagingArtifact;

  if (staging.stagingVersion !== FIRST_REPORT_LOCAL_STAGE_VERSION) {
    throw new SpApiLocalStageError(
      'validation_failed',
      `Staging version must be ${FIRST_REPORT_LOCAL_STAGE_VERSION}`
    );
  }

  if (staging.stageTarget !== 'local_json_stage') {
    throw new SpApiLocalStageError(
      'validation_failed',
      'Staging target must be local_json_stage'
    );
  }

  if (!staging.stageTargetDescription.trim()) {
    throw new SpApiLocalStageError(
      'validation_failed',
      'Staging target description must be a non-empty string'
    );
  }

  if (staging.reportFamily !== 'sales_and_traffic') {
    throw new SpApiLocalStageError(
      'validation_failed',
      'Staging reportFamily must be sales_and_traffic'
    );
  }

  if (staging.reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new SpApiLocalStageError(
      'validation_failed',
      `Staging reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!staging.reportId.trim()) {
    throw new SpApiLocalStageError(
      'validation_failed',
      'Staging reportId must be a non-empty string'
    );
  }

  if (!staging.lineage.handoffArtifactPath.trim()) {
    throw new SpApiLocalStageError(
      'validation_failed',
      'Staging lineage.handoffArtifactPath must be present'
    );
  }

  if (staging.lineage.handoffSchemaVersion !== FIRST_REPORT_HANDOFF_SCHEMA_VERSION) {
    throw new SpApiLocalStageError(
      'validation_failed',
      `Staging lineage.handoffSchemaVersion must be ${FIRST_REPORT_HANDOFF_SCHEMA_VERSION}`
    );
  }

  if (!staging.lineage.parsedArtifactPath.trim() || !staging.lineage.rawArtifactPath.trim()) {
    throw new SpApiLocalStageError(
      'validation_failed',
      'Staging lineage must include parsedArtifactPath and rawArtifactPath'
    );
  }

  if (staging.sections.length !== args.handoffArtifact.sections.length) {
    throw new SpApiLocalStageError(
      'validation_failed',
      'Staging section summary count must match the handoff artifact'
    );
  }

  if (staging.stagedPayload.sections.length !== args.handoffArtifact.payload.sections.length) {
    throw new SpApiLocalStageError(
      'validation_failed',
      'Staging payload section count must match the handoff artifact'
    );
  }

  const summedRows = staging.sections.reduce((sum, section) => sum + section.rowCount, 0);
  if (summedRows !== staging.totalRowCount) {
    throw new SpApiLocalStageError(
      'validation_failed',
      'Staging totalRowCount must equal the sum of section row counts'
    );
  }

  args.handoffArtifact.sections.forEach((section, index) => {
    const stagingSection = staging.sections[index];
    const handoffPayloadSection = args.handoffArtifact.payload.sections[index];
    const stagedPayloadSection = staging.stagedPayload.sections[index];

    if (stagingSection.sectionName !== section.sectionName) {
      throw new SpApiLocalStageError(
        'validation_failed',
        `Staging section ${index} name does not match the handoff artifact`
      );
    }

    if (stagingSection.headerCount !== section.headerCount) {
      throw new SpApiLocalStageError(
        'validation_failed',
        `Staging section ${section.sectionName} header count does not match the handoff artifact`
      );
    }

    if (stagingSection.rowCount !== section.rowCount) {
      throw new SpApiLocalStageError(
        'validation_failed',
        `Staging section ${section.sectionName} row count does not match the handoff artifact`
      );
    }

    if (stagedPayloadSection.sectionName !== section.sectionName) {
      throw new SpApiLocalStageError(
        'validation_failed',
        `Staged payload section ${index} name does not match the handoff artifact`
      );
    }

    if (stagedPayloadSection.headers.length !== handoffPayloadSection.headers.length) {
      throw new SpApiLocalStageError(
        'validation_failed',
        `Staged payload section ${section.sectionName} header count does not match the handoff artifact`
      );
    }

    if (stagedPayloadSection.records.length !== handoffPayloadSection.rows.length) {
      throw new SpApiLocalStageError(
        'validation_failed',
        `Staged payload section ${section.sectionName} row count does not match the handoff artifact`
      );
    }
  });
};

export const buildFirstSalesAndTrafficLocalStageArtifactPath = (args: {
  reportId: string;
  outputRoot?: string;
}) => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new SpApiLocalStageError(
      'invalid_input',
      'Local staging artifact path requires a non-empty report id'
    );
  }

  return path.resolve(
    args.outputRoot ?? FIRST_REPORT_LOCAL_STAGE_OUTPUT_DIR,
    `report-${reportId}.local-stage.json`
  );
};

export const writeFirstSalesAndTrafficLocalStageArtifact = async (args: {
  stagingArtifact: FirstReportLocalStageArtifact;
  outputRoot?: string;
}) => {
  const stagingArtifactPath = buildFirstSalesAndTrafficLocalStageArtifactPath({
    reportId: args.stagingArtifact.reportId,
    outputRoot: args.outputRoot,
  });

  try {
    await fs.mkdir(path.dirname(stagingArtifactPath), { recursive: true });
    await fs.writeFile(
      stagingArtifactPath,
      `${JSON.stringify(args.stagingArtifact, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    throw new SpApiLocalStageError(
      'write_failed',
      `Failed to write local staging artifact at ${stagingArtifactPath}`,
      error
    );
  }

  return stagingArtifactPath;
};

export const summarizeFirstSalesAndTrafficLocalStageArtifact = (args: {
  stagingArtifact: FirstReportLocalStageArtifact;
  handoffArtifactPath: string;
  stagingArtifactPath: string;
}): SpApiFirstReportLocalStageSummary => ({
  endpoint: 'ingestFirstReportLocalStage',
  reportId: args.stagingArtifact.reportId,
  reportFamily: args.stagingArtifact.reportFamily,
  reportType: args.stagingArtifact.reportType,
  handoffArtifactPath: path.resolve(args.handoffArtifactPath),
  stagingArtifactPath: path.resolve(args.stagingArtifactPath),
  stagingVersion: args.stagingArtifact.stagingVersion,
  sectionCount: args.stagingArtifact.sections.length,
  totalRowCount: args.stagingArtifact.totalRowCount,
  sections: args.stagingArtifact.sections.map((section) => ({
    sectionName: section.sectionName,
    headerCount: section.headerCount,
    rowCount: section.rowCount,
  })),
});

export const runFirstSpApiLocalStageIngestion = async (args: {
  reportId?: string;
  handoffArtifactPath?: string;
  handoffOutputRoot?: string;
  stagingOutputRoot?: string;
}): Promise<SpApiFirstReportLocalStageSummary> => {
  const resolvedInput = await resolveFirstSalesAndTrafficHandoffArtifactPath({
    reportId: args.reportId,
    handoffArtifactPath: args.handoffArtifactPath,
    handoffOutputRoot: args.handoffOutputRoot,
  });
  const handoffArtifact = await readFirstSalesAndTrafficHandoffArtifact({
    handoffArtifactPath: resolvedInput.handoffArtifactPath,
  });

  if (handoffArtifact.reportId !== resolvedInput.reportId) {
    throw new SpApiLocalStageError(
      'validation_failed',
      `Handoff artifact report id ${handoffArtifact.reportId} does not match requested report id ${resolvedInput.reportId}`
    );
  }

  const stagingArtifact = buildFirstSalesAndTrafficLocalStageArtifact({
    handoffArtifact,
    handoffArtifactPath: resolvedInput.handoffArtifactPath,
  });
  const stagingArtifactPath = await writeFirstSalesAndTrafficLocalStageArtifact({
    stagingArtifact,
    outputRoot: args.stagingOutputRoot,
  });

  return summarizeFirstSalesAndTrafficLocalStageArtifact({
    stagingArtifact,
    handoffArtifactPath: resolvedInput.handoffArtifactPath,
    stagingArtifactPath,
  });
};
