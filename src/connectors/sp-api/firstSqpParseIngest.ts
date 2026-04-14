import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { ingestSqpWeeklyRaw, type SqpWeeklyIngestResult } from '../../ingest/ingestSqpWeeklyRaw';
import { parseSqpReport, type SqpWeeklyParseResult } from '../../sqp/parseSqpReport';
import { SpApiSqpIngestError, type SpApiSqpParseIngestSummary } from './types';

export const SP_API_SQP_RAW_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-sqp-artifacts'
);

const RAW_ARTIFACT_NAME_RE =
  /^report-(?<reportId>.+)\.sqp\.raw(?:\.csv(?:\.gz)?|\.gz)?$/;

const isGzipBuffer = (value: Buffer) =>
  value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b;

const stripGzipSuffix = (filename: string) =>
  filename.endsWith('.gz') ? filename.slice(0, -3) : filename;

const deriveReportIdFromRawArtifactPath = (rawFilePath: string) => {
  const match = path.basename(rawFilePath).match(RAW_ARTIFACT_NAME_RE);
  const reportId = match?.groups?.reportId?.trim();

  return reportId && reportId.length > 0 ? reportId : null;
};

const buildExternalMaterializedCsvPath = (rawFilePath: string, outputRoot: string) => {
  const filePathHash = crypto
    .createHash('sha256')
    .update(path.resolve(rawFilePath))
    .digest('hex')
    .slice(0, 12);

  return path.resolve(outputRoot, `external-${filePathHash}.sqp.materialized.csv`);
};

export const buildSpApiSqpMaterializedCsvPath = (args: {
  reportId?: string | null;
  rawFilePath: string;
  outputRoot?: string;
}) => {
  const outputRoot = args.outputRoot ?? SP_API_SQP_RAW_OUTPUT_DIR;
  if (args.reportId?.trim()) {
    return path.resolve(outputRoot, `report-${args.reportId.trim()}.sqp.materialized.csv`);
  }

  return buildExternalMaterializedCsvPath(args.rawFilePath, outputRoot);
};

export const resolveSpApiSqpRawArtifactPath = async (args: {
  reportId?: string;
  rawFilePath?: string;
  rawOutputRoot?: string;
}) => {
  const explicitReportId = args.reportId?.trim();
  const rawFilePath = args.rawFilePath?.trim();

  if (rawFilePath) {
    const derivedReportId = deriveReportIdFromRawArtifactPath(rawFilePath);

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new SpApiSqpIngestError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match SQP raw artifact path ${path.basename(
          rawFilePath
        )}`
      );
    }

    try {
      await fs.access(rawFilePath);
    } catch (error) {
      throw new SpApiSqpIngestError(
        'artifact_not_found',
        `SP-API SQP raw artifact not found at ${rawFilePath}`,
        error
      );
    }

    const reportId = explicitReportId ?? derivedReportId;
    return {
      reportId: reportId ?? null,
      inputFilePath: path.resolve(rawFilePath),
    };
  }

  if (!explicitReportId) {
    throw new SpApiSqpIngestError(
      'invalid_input',
      'SQP parse+ingest requires either --report-id <value> or --raw-path <value>'
    );
  }

  const rawOutputRoot = args.rawOutputRoot ?? SP_API_SQP_RAW_OUTPUT_DIR;
  const candidates = [
    path.resolve(rawOutputRoot, `report-${explicitReportId}.sqp.raw.csv.gz`),
    path.resolve(rawOutputRoot, `report-${explicitReportId}.sqp.raw.gz`),
    path.resolve(rawOutputRoot, `report-${explicitReportId}.sqp.raw.csv`),
    path.resolve(rawOutputRoot, `report-${explicitReportId}.sqp.raw`),
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

  throw new SpApiSqpIngestError(
    'artifact_not_found',
    `SP-API SQP raw artifact not found for report ${explicitReportId} under ${rawOutputRoot}`
  );
};

export const readSpApiSqpRawArtifact = async (args: { inputFilePath: string }) => {
  const inputFilePath = path.resolve(args.inputFilePath);

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(inputFilePath);
  } catch (error) {
    throw new SpApiSqpIngestError(
      'artifact_not_found',
      `Failed to read SP-API SQP raw artifact at ${inputFilePath}`,
      error
    );
  }

  const decompressed = isGzipBuffer(bytes) || inputFilePath.endsWith('.gz');
  const contentBytes = decompressed ? gunzipSync(bytes) : bytes;
  const text = contentBytes.toString('utf8');

  if (!text.trim()) {
    throw new SpApiSqpIngestError(
      'invalid_content',
      `SP-API SQP raw artifact at ${inputFilePath} is empty after reading`
    );
  }

  return {
    inputFilePath,
    text,
    decompressed,
    filenameHint: stripGzipSuffix(path.basename(inputFilePath)),
  };
};

export const parseValidatedSpApiSqpRawArtifact = (args: {
  text: string;
  filenameHint: string;
}): SqpWeeklyParseResult & { scopeType: 'asin' } => {
  let parsed: SqpWeeklyParseResult;

  try {
    parsed = parseSqpReport(args.text, args.filenameHint);
  } catch (error) {
    throw new SpApiSqpIngestError(
      'invalid_content',
      `SP-API SQP raw artifact could not be parsed as Search Query Performance content: ${
        error instanceof Error ? error.message : 'unknown parser failure'
      }`,
      error
    );
  }

  if (parsed.scopeType !== 'asin') {
    throw new SpApiSqpIngestError(
      'validation_failed',
      `SP-API SQP parse+ingest supports one ASIN-window path only; received scope_type=${parsed.scopeType}`
    );
  }

  if (!parsed.scopeValue || parsed.scopeValue === 'unknown') {
    throw new SpApiSqpIngestError(
      'validation_failed',
      'SP-API SQP raw artifact did not resolve a stable ASIN scope value'
    );
  }

  if (parsed.rows.length === 0) {
    throw new SpApiSqpIngestError(
      'validation_failed',
      'SP-API SQP raw artifact produced zero SQP rows and cannot be ingested'
    );
  }

  return parsed as SqpWeeklyParseResult & { scopeType: 'asin' };
};

const resolveSqpIngestContext = (env: NodeJS.ProcessEnv = process.env) => {
  const accountId = env.APP_ACCOUNT_ID?.trim();
  const marketplace = env.APP_MARKETPLACE?.trim();

  if (!accountId || !marketplace) {
    throw new SpApiSqpIngestError(
      'invalid_input',
      'SQP parse+ingest requires APP_ACCOUNT_ID and APP_MARKETPLACE in the local environment'
    );
  }

  return {
    accountId,
    marketplace,
  };
};

export const ensureSpApiSqpIngestCsvPath = async (args: {
  rawFilePath: string;
  rawText: string;
  reportId?: string | null;
  decompressed: boolean;
  outputRoot?: string;
}) => {
  const resolvedRawPath = path.resolve(args.rawFilePath);
  const lowerName = resolvedRawPath.toLowerCase();
  const alreadyCsv = !args.decompressed && lowerName.endsWith('.csv');

  if (alreadyCsv) {
    return resolvedRawPath;
  }

  const outputFilePath = buildSpApiSqpMaterializedCsvPath({
    reportId: args.reportId,
    rawFilePath: resolvedRawPath,
    outputRoot: args.outputRoot,
  });

  try {
    await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
    await fs.writeFile(outputFilePath, args.rawText, 'utf8');
  } catch (error) {
    throw new SpApiSqpIngestError(
      'write_failed',
      `Failed to materialize SQP CSV artifact at ${outputFilePath}`,
      error
    );
  }

  return outputFilePath;
};

export const summarizeSpApiSqpParseIngest = (args: {
  reportId?: string | null;
  inputFilePath: string;
  parsed: SqpWeeklyParseResult & { scopeType: 'asin' };
  ingestResult: SqpWeeklyIngestResult;
}): SpApiSqpParseIngestSummary => ({
  endpoint: 'spApiSqpParseAndIngest',
  reportId: args.reportId ?? null,
  inputFilePath: path.resolve(args.inputFilePath),
  scopeType: args.parsed.scopeType,
  scopeValue: args.parsed.scopeValue,
  coverageStart: args.parsed.coverageStart,
  coverageEnd: args.parsed.coverageEnd,
  rowCount: args.parsed.rows.length,
  uploadId: args.ingestResult.status === 'ok' ? args.ingestResult.uploadId ?? null : null,
  warningsCount: args.parsed.warnings.length,
});

export const runFirstSpApiSqpParseIngest = async (args: {
  reportId?: string;
  rawFilePath?: string;
  rawOutputRoot?: string;
  csvOutputRoot?: string;
  env?: NodeJS.ProcessEnv;
  ingestImpl?: (
    csvPath: string,
    accountId: string,
    marketplace: string,
    exportedAtOverride?: string
  ) => Promise<SqpWeeklyIngestResult>;
}) => {
  const resolvedArtifact = await resolveSpApiSqpRawArtifactPath(args);
  const rawArtifact = await readSpApiSqpRawArtifact({
    inputFilePath: resolvedArtifact.inputFilePath,
  });
  const parsed = parseValidatedSpApiSqpRawArtifact({
    text: rawArtifact.text,
    filenameHint: rawArtifact.filenameHint,
  });
  const csvPath = await ensureSpApiSqpIngestCsvPath({
    rawFilePath: rawArtifact.inputFilePath,
    rawText: rawArtifact.text,
    reportId: resolvedArtifact.reportId,
    decompressed: rawArtifact.decompressed,
    outputRoot: args.csvOutputRoot,
  });
  const { accountId, marketplace } = resolveSqpIngestContext(args.env);
  const ingestImpl = args.ingestImpl ?? ingestSqpWeeklyRaw;

  let ingestResult: SqpWeeklyIngestResult;
  try {
    ingestResult = await ingestImpl(csvPath, accountId, marketplace);
  } catch (error) {
    throw new SpApiSqpIngestError(
      'ingest_failed',
      `SP-API SQP ingest failed: ${error instanceof Error ? error.message : 'unknown ingest failure'}`,
      error
    );
  }

  return summarizeSpApiSqpParseIngest({
    reportId: resolvedArtifact.reportId,
    inputFilePath: rawArtifact.inputFilePath,
    parsed,
    ingestResult,
  });
};
