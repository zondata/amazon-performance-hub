import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import {
  FIRST_REPORT_DOCUMENT_OUTPUT_DIR,
} from './firstReportDocument';
import { FIRST_SALES_AND_TRAFFIC_REPORT_TYPE } from './firstReportRequest';
import {
  SpApiParseError,
  type SpApiFirstReportParsedSectionSummary,
  type SpApiFirstReportParseSummary,
  type SpApiReportType,
} from './types';

export const FIRST_REPORT_PARSED_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-parsed-reports'
);

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

const RAW_ARTIFACT_NAME_RE =
  /^report-(?<reportId>.+)\.document\.(?:raw(?:\.gz)?|txt)$/;

const asObject = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isGzipBuffer = (value: Buffer) =>
  value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b;

const collectHeader = (headers: string[], headerSet: Set<string>, key: string) => {
  if (!headerSet.has(key)) {
    headerSet.add(key);
    headers.push(key);
  }
};

const flattenRowObject = (
  value: Record<string, unknown>,
  prefix = ''
): Record<string, ParsedCellValue> => {
  const flattened: Record<string, ParsedCellValue> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (
      entryValue == null ||
      typeof entryValue === 'string' ||
      typeof entryValue === 'number' ||
      typeof entryValue === 'boolean'
    ) {
      flattened[nextKey] = entryValue ?? null;
      continue;
    }

    if (Array.isArray(entryValue)) {
      throw new SpApiParseError(
        'invalid_content',
        `Unsupported nested array encountered while flattening ${nextKey}`
      );
    }

    if (typeof entryValue === 'object') {
      Object.assign(
        flattened,
        flattenRowObject(entryValue as Record<string, unknown>, nextKey)
      );
      continue;
    }

    throw new SpApiParseError(
      'invalid_content',
      `Unsupported value type encountered while flattening ${nextKey}`
    );
  }

  return flattened;
};

const parseJsonSection = (
  sectionName: string,
  value: unknown
): ParsedSectionArtifact => {
  if (!Array.isArray(value)) {
    throw new SpApiParseError(
      'invalid_content',
      `Expected ${sectionName} to be an array`
    );
  }

  const flattenedRows = value.map((entry, index) => {
    const row = asObject(entry);
    if (!row) {
      throw new SpApiParseError(
        'invalid_content',
        `Expected ${sectionName}[${index}] to be an object row`
      );
    }

    return flattenRowObject(row);
  });

  const headers: string[] = [];
  const headerSet = new Set<string>();

  for (const row of flattenedRows) {
    for (const key of Object.keys(row)) {
      collectHeader(headers, headerSet, key);
    }
  }

  const rows = flattenedRows.map((row) =>
    Object.fromEntries(headers.map((header) => [header, row[header] ?? null]))
  );

  return {
    sectionName,
    headers,
    rowCount: rows.length,
    rows,
  };
};

const deriveReportIdFromRawArtifactPath = (rawFilePath: string) => {
  const match = path.basename(rawFilePath).match(RAW_ARTIFACT_NAME_RE);
  const reportId = match?.groups?.reportId?.trim();

  return reportId && reportId.length > 0 ? reportId : null;
};

export const resolveFirstSalesAndTrafficRawArtifactPath = async (args: {
  reportId?: string;
  rawFilePath?: string;
  rawOutputRoot?: string;
}) => {
  const rawFilePath = args.rawFilePath?.trim();
  const explicitReportId = args.reportId?.trim();

  if (rawFilePath) {
    const derivedReportId = deriveReportIdFromRawArtifactPath(rawFilePath);

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new SpApiParseError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match raw artifact path ${path.basename(
          rawFilePath
        )}`
      );
    }

    try {
      await fs.access(rawFilePath);
    } catch (error) {
      throw new SpApiParseError(
        'artifact_not_found',
        `SP-API raw artifact not found at ${rawFilePath}`,
        error
      );
    }

    const reportId = explicitReportId ?? derivedReportId;
    if (!reportId) {
      throw new SpApiParseError(
        'invalid_input',
        'Raw artifact path must follow the V2-06 deterministic naming or be paired with --report-id'
      );
    }

    return {
      reportId,
      inputFilePath: path.resolve(rawFilePath),
    };
  }

  if (!explicitReportId) {
    throw new SpApiParseError(
      'invalid_input',
      'Report parsing requires either --report-id <value> or --raw-path <value>'
    );
  }

  const rawOutputRoot = args.rawOutputRoot ?? FIRST_REPORT_DOCUMENT_OUTPUT_DIR;
  const candidates = [
    path.resolve(rawOutputRoot, `report-${explicitReportId}.document.raw.gz`),
    path.resolve(rawOutputRoot, `report-${explicitReportId}.document.raw`),
    path.resolve(rawOutputRoot, `report-${explicitReportId}.document.txt`),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return {
        reportId: explicitReportId,
        inputFilePath: candidate,
      };
    } catch {
      continue;
    }
  }

  throw new SpApiParseError(
    'artifact_not_found',
    `SP-API raw artifact not found for report ${explicitReportId} under ${rawOutputRoot}`
  );
};

export const readFirstSalesAndTrafficRawArtifact = async (args: {
  inputFilePath: string;
}) => {
  const inputFilePath = path.resolve(args.inputFilePath);

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(inputFilePath);
  } catch (error) {
    throw new SpApiParseError(
      'artifact_not_found',
      `Failed to read SP-API raw artifact at ${inputFilePath}`,
      error
    );
  }

  const decompressed = isGzipBuffer(bytes) || inputFilePath.endsWith('.gz');
  const contentBytes = decompressed ? gunzipSync(bytes) : bytes;
  const text = contentBytes.toString('utf8');

  if (!text.trim()) {
    throw new SpApiParseError(
      'invalid_content',
      `SP-API raw artifact at ${inputFilePath} is empty after reading`
    );
  }

  return {
    inputFilePath,
    decompressed,
    text,
  };
};

const parseFirstSalesAndTrafficJsonArtifact = (args: {
  reportId: string;
  inputFilePath: string;
  decompressed: boolean;
  text: string;
}): ParsedArtifact => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(args.text);
  } catch (error) {
    throw new SpApiParseError(
      'invalid_content',
      `SP-API raw artifact at ${args.inputFilePath} is not valid JSON`,
      error
    );
  }

  const root = asObject(parsed);
  const reportSpecification = asObject(root?.reportSpecification);
  const reportType = asString(reportSpecification?.reportType);

  if (reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    throw new SpApiParseError(
      'invalid_content',
      `Expected reportSpecification.reportType to be ${FIRST_SALES_AND_TRAFFIC_REPORT_TYPE}, received ${reportType ?? 'missing'}`
    );
  }

  const sections = Object.entries(root ?? {})
    .filter(([, value]) => Array.isArray(value))
    .map(([sectionName, value]) => parseJsonSection(sectionName, value));

  if (sections.length === 0) {
    throw new SpApiParseError(
      'invalid_content',
      'Expected at least one top-level array section in the Sales and Traffic report artifact'
    );
  }

  return {
    reportId: args.reportId,
    inputFilePath: args.inputFilePath,
    detectedFormat: 'json',
    decompressed: args.decompressed,
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    sections,
  };
};

export const buildFirstSalesAndTrafficParsedArtifactPath = (args: {
  reportId: string;
  outputRoot?: string;
}) => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new SpApiParseError(
      'invalid_input',
      'Parsed artifact path requires a non-empty report id'
    );
  }

  return path.resolve(
    args.outputRoot ?? FIRST_REPORT_PARSED_OUTPUT_DIR,
    `report-${reportId}.parsed.json`
  );
};

export const writeFirstSalesAndTrafficParsedArtifact = async (args: {
  artifact: ParsedArtifact;
  outputRoot?: string;
}) => {
  const parsedArtifactPath = buildFirstSalesAndTrafficParsedArtifactPath({
    reportId: args.artifact.reportId,
    outputRoot: args.outputRoot,
  });

  try {
    await fs.mkdir(path.dirname(parsedArtifactPath), { recursive: true });
    await fs.writeFile(
      parsedArtifactPath,
      `${JSON.stringify(args.artifact, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    throw new SpApiParseError(
      'write_failed',
      `Failed to write parsed artifact at ${parsedArtifactPath}`,
      error
    );
  }

  return parsedArtifactPath;
};

export const summarizeFirstSalesAndTrafficParsedArtifact = (args: {
  artifact: ParsedArtifact;
  parsedArtifactPath: string;
}): SpApiFirstReportParseSummary => {
  const sections: SpApiFirstReportParsedSectionSummary[] = args.artifact.sections.map(
    (section) => ({
      sectionName: section.sectionName,
      headerCount: section.headers.length,
      rowCount: section.rowCount,
    })
  );

  return {
    endpoint: 'parseFirstReportContent',
    reportId: args.artifact.reportId,
    inputFilePath: args.artifact.inputFilePath,
    detectedFormat: args.artifact.detectedFormat,
    decompressed: args.artifact.decompressed,
    sectionCount: sections.length,
    totalRowCount: sections.reduce((sum, section) => sum + section.rowCount, 0),
    parsedArtifactPath: args.parsedArtifactPath,
    sections,
  };
};

export const parseFirstSalesAndTrafficReportContent = async (args: {
  reportId?: string;
  rawFilePath?: string;
  rawOutputRoot?: string;
  parsedOutputRoot?: string;
}): Promise<SpApiFirstReportParseSummary> => {
  const resolvedInput = await resolveFirstSalesAndTrafficRawArtifactPath({
    reportId: args.reportId,
    rawFilePath: args.rawFilePath,
    rawOutputRoot: args.rawOutputRoot,
  });
  const rawArtifact = await readFirstSalesAndTrafficRawArtifact({
    inputFilePath: resolvedInput.inputFilePath,
  });

  const artifact = parseFirstSalesAndTrafficJsonArtifact({
    reportId: resolvedInput.reportId,
    inputFilePath: rawArtifact.inputFilePath,
    decompressed: rawArtifact.decompressed,
    text: rawArtifact.text,
  });
  const parsedArtifactPath = await writeFirstSalesAndTrafficParsedArtifact({
    artifact,
    outputRoot: args.parsedOutputRoot,
  });

  return summarizeFirstSalesAndTrafficParsedArtifact({
    artifact,
    parsedArtifactPath,
  });
};
