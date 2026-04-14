import fs from 'node:fs/promises';
import path from 'node:path';

import { FIRST_REPORT_PARSED_OUTPUT_DIR } from './firstReportParser';
import { FIRST_SALES_AND_TRAFFIC_REPORT_TYPE } from './firstReportRequest';
import {
  SpApiHandoffError,
  type SpApiFirstReportHandoffSectionSummary,
  type SpApiFirstReportHandoffSummary,
  type SpApiReportType,
} from './types';

export const FIRST_REPORT_HANDOFF_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-report-handoffs'
);

export const FIRST_REPORT_HANDOFF_SCHEMA_VERSION =
  'sp-api-first-report-handoff/v1';

type ParsedCellValue = string | number | boolean | null;

type ParsedSectionArtifact = {
  sectionName: string;
  headers: string[];
  rowCount: number;
  rows: Record<string, ParsedCellValue>[];
};

type ParsedArtifact = {
  reportId: string;
  inputFilePath: string;
  detectedFormat: 'json';
  decompressed: boolean;
  reportType: SpApiReportType;
  sections: ParsedSectionArtifact[];
};

type FirstReportHandoffPayloadSection = {
  sectionName: string;
  headers: string[];
  rows: Record<string, ParsedCellValue>[];
};

type FirstReportHandoffArtifact = {
  schemaVersion: typeof FIRST_REPORT_HANDOFF_SCHEMA_VERSION;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  reportId: string;
  generatedAt: string;
  sourceArtifacts: {
    parsedArtifactPath: string;
    rawArtifactPath: string;
  };
  sections: SpApiFirstReportHandoffSectionSummary[];
  totalRowCount: number;
  payload: {
    sections: FirstReportHandoffPayloadSection[];
  };
};

const PARSED_ARTIFACT_NAME_RE = /^report-(?<reportId>.+)\.parsed\.json$/;

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
    throw new SpApiHandoffError(
      'invalid_content',
      `${fieldName} must be an array of strings`
    );
  }

  return value.map((entry, index) => {
    const parsed = asString(entry);
    if (!parsed) {
      throw new SpApiHandoffError(
        'invalid_content',
        `${fieldName}[${index}] must be a non-empty string`
      );
    }

    return parsed;
  });
};

const asBoolean = (value: unknown, fieldName: string) => {
  if (typeof value !== 'boolean') {
    throw new SpApiHandoffError(
      'invalid_content',
      `${fieldName} must be a boolean`
    );
  }

  return value;
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

  throw new SpApiHandoffError(
    'invalid_content',
    `${fieldName} must contain only string, number, boolean, or null values`
  );
};

const parseParsedSectionArtifact = (value: unknown, index: number): ParsedSectionArtifact => {
  const section = asObject(value);
  const sectionName = asString(section?.sectionName);

  if (!sectionName) {
    throw new SpApiHandoffError(
      'invalid_content',
      `sections[${index}].sectionName must be a non-empty string`
    );
  }

  const headers = asStringArray(section?.headers, `sections[${index}].headers`);
  const rowCount = section?.rowCount;

  if (!Number.isInteger(rowCount) || Number(rowCount) < 0) {
    throw new SpApiHandoffError(
      'invalid_content',
      `sections[${index}].rowCount must be a non-negative integer`
    );
  }

  if (!Array.isArray(section?.rows)) {
    throw new SpApiHandoffError(
      'invalid_content',
      `sections[${index}].rows must be an array`
    );
  }

  const rows = section.rows.map((entry, rowIndex) => {
    const row = asObject(entry);
    if (!row) {
      throw new SpApiHandoffError(
        'invalid_content',
        `sections[${index}].rows[${rowIndex}] must be an object`
      );
    }

    const normalizedRow: Record<string, ParsedCellValue> = {};
    const rowKeys = Object.keys(row);

    if (rowKeys.length !== headers.length) {
      throw new SpApiHandoffError(
        'invalid_content',
        `sections[${index}].rows[${rowIndex}] key count must match the header count`
      );
    }

    for (const header of headers) {
      if (!Object.prototype.hasOwnProperty.call(row, header)) {
        throw new SpApiHandoffError(
          'invalid_content',
          `sections[${index}].rows[${rowIndex}] is missing header ${header}`
        );
      }

      normalizedRow[header] = validateCellValue(
        row[header],
        `sections[${index}].rows[${rowIndex}].${header}`
      );
    }

    for (const key of rowKeys) {
      if (!headers.includes(key)) {
        throw new SpApiHandoffError(
          'invalid_content',
          `sections[${index}].rows[${rowIndex}] contains unexpected key ${key}`
        );
      }
    }

    return normalizedRow;
  });

  if (rowCount !== rows.length) {
    throw new SpApiHandoffError(
      'invalid_content',
      `sections[${index}].rowCount does not match rows.length`
    );
  }

  return {
    sectionName,
    headers,
    rowCount,
    rows,
  };
};

const parseParsedArtifact = (value: unknown): ParsedArtifact => {
  const artifact = asObject(value);
  const reportId = asString(artifact?.reportId);
  const inputFilePath = asString(artifact?.inputFilePath);
  const detectedFormat = artifact?.detectedFormat;
  const reportType = asString(artifact?.reportType);

  if (!reportId) {
    throw new SpApiHandoffError(
      'invalid_content',
      'Parsed artifact reportId must be a non-empty string'
    );
  }

  if (!inputFilePath) {
    throw new SpApiHandoffError(
      'invalid_content',
      'Parsed artifact inputFilePath must be a non-empty string'
    );
  }

  if (detectedFormat !== 'json') {
    throw new SpApiHandoffError(
      'invalid_content',
      `Parsed artifact detectedFormat must be json, received ${String(
        detectedFormat
      )}`
    );
  }

  if (reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new SpApiHandoffError(
      'invalid_content',
      `Parsed artifact reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!Array.isArray(artifact?.sections)) {
    throw new SpApiHandoffError(
      'invalid_content',
      'Parsed artifact sections must be an array'
    );
  }

  const sections = artifact.sections.map((section, index) =>
    parseParsedSectionArtifact(section, index)
  );

  return {
    reportId,
    inputFilePath: path.resolve(inputFilePath),
    detectedFormat: 'json',
    decompressed: asBoolean(artifact.decompressed, 'decompressed'),
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    sections,
  };
};

const deriveReportIdFromParsedArtifactPath = (parsedArtifactPath: string) => {
  const match = path.basename(parsedArtifactPath).match(PARSED_ARTIFACT_NAME_RE);
  const reportId = match?.groups?.reportId?.trim();

  return reportId && reportId.length > 0 ? reportId : null;
};

export const resolveFirstSalesAndTrafficParsedArtifactPath = async (args: {
  reportId?: string;
  parsedArtifactPath?: string;
  parsedOutputRoot?: string;
}) => {
  const parsedArtifactPath = args.parsedArtifactPath?.trim();
  const explicitReportId = args.reportId?.trim();

  if (parsedArtifactPath) {
    const derivedReportId = deriveReportIdFromParsedArtifactPath(parsedArtifactPath);

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new SpApiHandoffError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match parsed artifact path ${path.basename(
          parsedArtifactPath
        )}`
      );
    }

    try {
      await fs.access(parsedArtifactPath);
    } catch (error) {
      throw new SpApiHandoffError(
        'artifact_not_found',
        `SP-API parsed artifact not found at ${parsedArtifactPath}`,
        error
      );
    }

    const reportId = explicitReportId ?? derivedReportId;
    if (!reportId) {
      throw new SpApiHandoffError(
        'invalid_input',
        'Parsed artifact path must follow the V2-07 deterministic naming or be paired with --report-id'
      );
    }

    return {
      reportId,
      parsedArtifactPath: path.resolve(parsedArtifactPath),
    };
  }

  if (!explicitReportId) {
    throw new SpApiHandoffError(
      'invalid_input',
      'Report handoff requires either --report-id <value> or --parsed-path <value>'
    );
  }

  const candidate = path.resolve(
    args.parsedOutputRoot ?? FIRST_REPORT_PARSED_OUTPUT_DIR,
    `report-${explicitReportId}.parsed.json`
  );

  try {
    await fs.access(candidate);
  } catch (error) {
    throw new SpApiHandoffError(
      'artifact_not_found',
      `SP-API parsed artifact not found for report ${explicitReportId} under ${
        args.parsedOutputRoot ?? FIRST_REPORT_PARSED_OUTPUT_DIR
      }`,
      error
    );
  }

  return {
    reportId: explicitReportId,
    parsedArtifactPath: candidate,
  };
};

export const readFirstSalesAndTrafficParsedArtifact = async (args: {
  parsedArtifactPath: string;
}): Promise<ParsedArtifact> => {
  const parsedArtifactPath = path.resolve(args.parsedArtifactPath);

  let text: string;
  try {
    text = await fs.readFile(parsedArtifactPath, 'utf8');
  } catch (error) {
    throw new SpApiHandoffError(
      'artifact_not_found',
      `Failed to read SP-API parsed artifact at ${parsedArtifactPath}`,
      error
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new SpApiHandoffError(
      'invalid_content',
      `SP-API parsed artifact at ${parsedArtifactPath} is not valid JSON`,
      error
    );
  }

  return parseParsedArtifact(parsed);
};

const buildSectionSummaries = (
  sections: ParsedSectionArtifact[]
): SpApiFirstReportHandoffSectionSummary[] =>
  sections.map((section) => ({
    sectionName: section.sectionName,
    headerCount: section.headers.length,
    rowCount: section.rowCount,
  }));

export const validateFirstSalesAndTrafficReportHandoff = (args: {
  parsedArtifact: ParsedArtifact;
  handoffArtifact: FirstReportHandoffArtifact;
}) => {
  const handoff = args.handoffArtifact;

  if (handoff.schemaVersion !== FIRST_REPORT_HANDOFF_SCHEMA_VERSION) {
    throw new SpApiHandoffError(
      'validation_failed',
      `Handoff schemaVersion must be ${FIRST_REPORT_HANDOFF_SCHEMA_VERSION}`
    );
  }

  if (handoff.reportFamily !== 'sales_and_traffic') {
    throw new SpApiHandoffError(
      'validation_failed',
      'Handoff reportFamily must be sales_and_traffic'
    );
  }

  if (handoff.reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new SpApiHandoffError(
      'validation_failed',
      `Handoff reportType must be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}`
    );
  }

  if (!handoff.reportId.trim()) {
    throw new SpApiHandoffError(
      'validation_failed',
      'Handoff reportId must be a non-empty string'
    );
  }

  if (!handoff.generatedAt.trim()) {
    throw new SpApiHandoffError(
      'validation_failed',
      'Handoff generatedAt must be a non-empty string'
    );
  }

  if (!handoff.sourceArtifacts.parsedArtifactPath.trim()) {
    throw new SpApiHandoffError(
      'validation_failed',
      'Handoff sourceArtifacts.parsedArtifactPath must be present'
    );
  }

  if (!handoff.sourceArtifacts.rawArtifactPath.trim()) {
    throw new SpApiHandoffError(
      'validation_failed',
      'Handoff sourceArtifacts.rawArtifactPath must be present'
    );
  }

  if (!Array.isArray(handoff.sections) || !Array.isArray(handoff.payload.sections)) {
    throw new SpApiHandoffError(
      'validation_failed',
      'Handoff sections and payload.sections must both be arrays'
    );
  }

  if (handoff.sections.length !== args.parsedArtifact.sections.length) {
    throw new SpApiHandoffError(
      'validation_failed',
      'Handoff section summary count must match the parsed artifact'
    );
  }

  if (handoff.payload.sections.length !== args.parsedArtifact.sections.length) {
    throw new SpApiHandoffError(
      'validation_failed',
      'Handoff payload section count must match the parsed artifact'
    );
  }

  const totalRowCount = handoff.sections.reduce(
    (sum, section) => sum + section.rowCount,
    0
  );
  if (handoff.totalRowCount !== totalRowCount) {
    throw new SpApiHandoffError(
      'validation_failed',
      'Handoff totalRowCount must equal the sum of section row counts'
    );
  }

  args.parsedArtifact.sections.forEach((section, index) => {
    const handoffSection = handoff.sections[index];
    const payloadSection = handoff.payload.sections[index];

    if (handoffSection.sectionName !== section.sectionName) {
      throw new SpApiHandoffError(
        'validation_failed',
        `Handoff section ${index} name does not match the parsed artifact`
      );
    }

    if (handoffSection.rowCount !== section.rowCount) {
      throw new SpApiHandoffError(
        'validation_failed',
        `Handoff section ${section.sectionName} row count does not match the parsed artifact`
      );
    }

    if (handoffSection.headerCount !== section.headers.length) {
      throw new SpApiHandoffError(
        'validation_failed',
        `Handoff section ${section.sectionName} header count does not match the parsed artifact`
      );
    }

    if (payloadSection.sectionName !== section.sectionName) {
      throw new SpApiHandoffError(
        'validation_failed',
        `Handoff payload section ${index} name does not match the parsed artifact`
      );
    }

    if (payloadSection.headers.length !== section.headers.length) {
      throw new SpApiHandoffError(
        'validation_failed',
        `Handoff payload section ${section.sectionName} header count does not match the parsed artifact`
      );
    }

    if (payloadSection.rows.length !== section.rowCount) {
      throw new SpApiHandoffError(
        'validation_failed',
        `Handoff payload section ${section.sectionName} row count does not match the parsed artifact`
      );
    }
  });
};

export const buildFirstSalesAndTrafficReportHandoff = (args: {
  parsedArtifact: ParsedArtifact;
  parsedArtifactPath: string;
  generatedAt?: string;
}): FirstReportHandoffArtifact => {
  const sections = buildSectionSummaries(args.parsedArtifact.sections);
  const totalRowCount = sections.reduce((sum, section) => sum + section.rowCount, 0);

  const handoffArtifact: FirstReportHandoffArtifact = {
    schemaVersion: FIRST_REPORT_HANDOFF_SCHEMA_VERSION,
    reportFamily: 'sales_and_traffic',
    reportType: args.parsedArtifact.reportType,
    reportId: args.parsedArtifact.reportId,
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    sourceArtifacts: {
      parsedArtifactPath: path.resolve(args.parsedArtifactPath),
      rawArtifactPath: args.parsedArtifact.inputFilePath,
    },
    sections,
    totalRowCount,
    payload: {
      sections: args.parsedArtifact.sections.map((section) => ({
        sectionName: section.sectionName,
        headers: [...section.headers],
        rows: section.rows.map((row) => ({ ...row })),
      })),
    },
  };

  validateFirstSalesAndTrafficReportHandoff({
    parsedArtifact: args.parsedArtifact,
    handoffArtifact,
  });

  return handoffArtifact;
};

export const buildFirstSalesAndTrafficReportHandoffPath = (args: {
  reportId: string;
  outputRoot?: string;
}) => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new SpApiHandoffError(
      'invalid_input',
      'Handoff artifact path requires a non-empty report id'
    );
  }

  return path.resolve(
    args.outputRoot ?? FIRST_REPORT_HANDOFF_OUTPUT_DIR,
    `report-${reportId}.handoff.json`
  );
};

export const writeFirstSalesAndTrafficReportHandoff = async (args: {
  handoffArtifact: FirstReportHandoffArtifact;
  outputRoot?: string;
}) => {
  const handoffArtifactPath = buildFirstSalesAndTrafficReportHandoffPath({
    reportId: args.handoffArtifact.reportId,
    outputRoot: args.outputRoot,
  });

  try {
    await fs.mkdir(path.dirname(handoffArtifactPath), { recursive: true });
    await fs.writeFile(
      handoffArtifactPath,
      `${JSON.stringify(args.handoffArtifact, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    throw new SpApiHandoffError(
      'write_failed',
      `Failed to write handoff artifact at ${handoffArtifactPath}`,
      error
    );
  }

  return handoffArtifactPath;
};

export const summarizeFirstSalesAndTrafficReportHandoff = (args: {
  handoffArtifact: FirstReportHandoffArtifact;
  parsedArtifactPath: string;
  handoffArtifactPath: string;
}): SpApiFirstReportHandoffSummary => ({
  endpoint: 'buildFirstReportHandoff',
  reportId: args.handoffArtifact.reportId,
  reportFamily: args.handoffArtifact.reportFamily,
  reportType: args.handoffArtifact.reportType,
  parsedArtifactPath: path.resolve(args.parsedArtifactPath),
  handoffArtifactPath: path.resolve(args.handoffArtifactPath),
  schemaVersion: args.handoffArtifact.schemaVersion,
  sectionCount: args.handoffArtifact.sections.length,
  totalRowCount: args.handoffArtifact.totalRowCount,
  sections: args.handoffArtifact.sections.map((section) => ({
    sectionName: section.sectionName,
    headerCount: section.headerCount,
    rowCount: section.rowCount,
  })),
});

export const runFirstSpApiReportHandoff = async (args: {
  reportId?: string;
  parsedArtifactPath?: string;
  parsedOutputRoot?: string;
  handoffOutputRoot?: string;
  generatedAt?: string;
}): Promise<SpApiFirstReportHandoffSummary> => {
  const resolvedInput = await resolveFirstSalesAndTrafficParsedArtifactPath({
    reportId: args.reportId,
    parsedArtifactPath: args.parsedArtifactPath,
    parsedOutputRoot: args.parsedOutputRoot,
  });
  const parsedArtifact = await readFirstSalesAndTrafficParsedArtifact({
    parsedArtifactPath: resolvedInput.parsedArtifactPath,
  });

  if (parsedArtifact.reportId !== resolvedInput.reportId) {
    throw new SpApiHandoffError(
      'validation_failed',
      `Parsed artifact report id ${parsedArtifact.reportId} does not match requested report id ${resolvedInput.reportId}`
    );
  }

  const handoffArtifact = buildFirstSalesAndTrafficReportHandoff({
    parsedArtifact,
    parsedArtifactPath: resolvedInput.parsedArtifactPath,
    generatedAt: args.generatedAt,
  });
  const handoffArtifactPath = await writeFirstSalesAndTrafficReportHandoff({
    handoffArtifact,
    outputRoot: args.handoffOutputRoot,
  });

  return summarizeFirstSalesAndTrafficReportHandoff({
    handoffArtifact,
    parsedArtifactPath: resolvedInput.parsedArtifactPath,
    handoffArtifactPath,
  });
};
