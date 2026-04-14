import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { createGunzip } from 'node:zlib';

import { normText } from '../../bulk/parseSponsoredProductsBulk';
import {
  ingestSearchTermsMarketWeeklyRaw,
  ingestSearchTermsMarketWeeklyRawStream,
  type SearchTermsMarketWeeklyIngestResult,
  type SearchTermsMarketWeeklyParseEvent,
  type SearchTermsMarketWeeklyParseMetadata,
  type SearchTermsMarketWeeklyParseResult,
  type SearchTermsMarketWeeklyRow,
} from '../../ingest/ingestSearchTermsMarketWeeklyRaw';
import { SpApiSearchTermsIngestError, type SpApiSearchTermsParseIngestSummary } from './types';

export const SP_API_SEARCH_TERMS_RAW_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-search-terms-artifacts'
);

const RAW_ARTIFACT_NAME_RE =
  /^report-(?<reportId>.+)\.search-terms\.raw(?:\.json(?:\.gz)?|\.gz)?$/;
const REPORT_SPECIFICATION_KEY = '"reportSpecification"';
const DATA_ROWS_KEY = '"dataByDepartmentAndSearchTerm"';
const DEFAULT_STREAM_ROW_BATCH_SIZE = 500;

type SearchTermsJsonRow = SearchTermsMarketWeeklyRow;

type CapturedJsonObjectState = {
  buffer: string;
  depth: number;
  inString: boolean;
  escape: boolean;
};

const deriveReportIdFromRawArtifactPath = (rawFilePath: string) => {
  const match = path.basename(rawFilePath).match(RAW_ARTIFACT_NAME_RE);
  const reportId = match?.groups?.reportId?.trim();
  return reportId && reportId.length > 0 ? reportId : null;
};

const asObject = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const dayDiffUtc = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  return Math.round((end - start) / 86_400_000);
};

const dayOfWeekUtc = (value: string) =>
  new Date(`${value}T00:00:00.000Z`).getUTCDay();

const validateWeeklyWindow = (weekStart: string, weekEnd: string) => {
  if (dayDiffUtc(weekStart, weekEnd) !== 6) {
    throw new SpApiSearchTermsIngestError(
      'validation_failed',
      'Search Terms parse+ingest requires one bounded 7-day WEEK window'
    );
  }

  if (dayOfWeekUtc(weekStart) !== 0) {
    throw new SpApiSearchTermsIngestError(
      'validation_failed',
      'Search Terms parse+ingest requires week_start to be a Sunday'
    );
  }

  if (dayOfWeekUtc(weekEnd) !== 6) {
    throw new SpApiSearchTermsIngestError(
      'validation_failed',
      'Search Terms parse+ingest requires week_end to be a Saturday'
    );
  }
};

const parseSearchTermsJsonRow = (value: unknown): SearchTermsJsonRow | null => {
  const row = asObject(value);
  const departmentName = asString(row?.departmentName);
  const searchTerm = asString(row?.searchTerm);
  const searchFrequencyRank = asNumber(row?.searchFrequencyRank);
  const clickedAsin = asString(row?.clickedAsin);
  const clickShareRank = asNumber(row?.clickShareRank);
  const clickShare = asNumber(row?.clickShare);
  const conversionShare = asNumber(row?.conversionShare);
  const conversionShareIsExplicitNull = row?.conversionShare === null;

  if (
    !departmentName ||
    !searchTerm ||
    !Number.isInteger(searchFrequencyRank) ||
    !clickedAsin ||
    !Number.isInteger(clickShareRank) ||
    clickShare == null ||
    (conversionShare == null && !conversionShareIsExplicitNull)
  ) {
    return null;
  }

  return {
    department_name_raw: departmentName,
    department_name_norm: normText(departmentName),
    search_term_raw: searchTerm,
    search_term_norm: normText(searchTerm),
    search_frequency_rank: searchFrequencyRank as number,
    clicked_asin: clickedAsin.trim().toUpperCase(),
    click_share_rank: clickShareRank as number,
    click_share: clickShare as number,
    conversion_share: conversionShareIsExplicitNull ? 0 : (conversionShare as number),
  };
};

const parseSearchTermsMetadataObject = (
  reportSpecificationText: string
): SearchTermsMarketWeeklyParseMetadata => {
  let parsedSpecification: unknown;
  try {
    parsedSpecification = JSON.parse(reportSpecificationText);
  } catch (error) {
    throw new SpApiSearchTermsIngestError(
      'invalid_content',
      'Search Terms raw artifact reportSpecification is not valid JSON',
      error
    );
  }

  const reportSpecification = asObject(parsedSpecification);
  const reportType = asString(reportSpecification?.reportType);
  const reportOptions = asObject(reportSpecification?.reportOptions);
  const reportPeriod = asString(reportOptions?.reportPeriod);
  const weekStart = asString(reportSpecification?.dataStartTime);
  const weekEnd = asString(reportSpecification?.dataEndTime);
  const marketplaceIds = Array.isArray(reportSpecification?.marketplaceIds)
    ? reportSpecification.marketplaceIds
    : null;
  const marketplaceId = asString(marketplaceIds?.[0]);

  if (reportType !== 'GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT') {
    throw new SpApiSearchTermsIngestError(
      'validation_failed',
      `Search Terms parse+ingest expected reportType GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT but received ${
        reportType ?? 'unknown'
      }`
    );
  }

  if (reportPeriod !== 'WEEK') {
    throw new SpApiSearchTermsIngestError(
      'validation_failed',
      `Search Terms parse+ingest supports one bounded WEEK report only; received reportPeriod=${
        reportPeriod ?? 'unknown'
      }`
    );
  }

  if (!weekStart || !weekEnd || !marketplaceId) {
    throw new SpApiSearchTermsIngestError(
      'invalid_content',
      'Search Terms raw artifact reportSpecification is missing required WEEK marketplace fields'
    );
  }

  validateWeeklyWindow(weekStart, weekEnd);

  return {
    marketplaceId,
    weekStart,
    weekEnd,
    coverageStart: weekStart,
    coverageEnd: weekEnd,
    warnings: [],
  };
};

const createJsonObjectState = (): CapturedJsonObjectState => ({
  buffer: '',
  depth: 0,
  inString: false,
  escape: false,
});

const appendCapturedJsonChar = (state: CapturedJsonObjectState, char: string) => {
  state.buffer += char;

  if (state.inString) {
    if (state.escape) {
      state.escape = false;
      return;
    }

    if (char === '\\') {
      state.escape = true;
      return;
    }

    if (char === '"') {
      state.inString = false;
    }
    return;
  }

  if (char === '"') {
    state.inString = true;
    return;
  }

  if (char === '{') {
    state.depth += 1;
    return;
  }

  if (char === '}') {
    state.depth -= 1;
  }
};

const advanceNeedle = (needle: string, currentIndex: number, char: string) => {
  const nextIndex =
    needle[currentIndex] === char ? currentIndex + 1 : needle[0] === char ? 1 : 0;

  return {
    nextIndex: nextIndex === needle.length ? 0 : nextIndex,
    matched: nextIndex === needle.length,
  };
};

const isWhitespaceOrComma = (char: string) =>
  char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === ',';

const inspectSearchTermsRawArtifact = async (inputFilePath: string) => {
  const handle = await fsPromises.open(inputFilePath, 'r');
  try {
    const header = Buffer.alloc(2);
    const { bytesRead } = await handle.read(header, 0, 2, 0);
    return {
      inputFilePath,
      decompressed: bytesRead === 2 && header[0] === 0x1f && header[1] === 0x8b,
      filenameHint: path.basename(inputFilePath).endsWith('.gz')
        ? path.basename(inputFilePath).slice(0, -3)
        : path.basename(inputFilePath),
    };
  } finally {
    await handle.close();
  }
};

const createSearchTermsTextStream = async (inputFilePath: string) => {
  const inspection = await inspectSearchTermsRawArtifact(inputFilePath);
  const fileStream = fs.createReadStream(inputFilePath);

  if (inspection.decompressed) {
    const gunzip = createGunzip();
    gunzip.setEncoding('utf8');
    fileStream.pipe(gunzip);
    return {
      stream: gunzip as AsyncIterable<string>,
      inspection,
    };
  }

  fileStream.setEncoding('utf8');
  return {
    stream: fileStream as AsyncIterable<string>,
    inspection,
  };
};

export const resolveSpApiSearchTermsRawArtifactPath = async (args: {
  reportId?: string;
  rawFilePath?: string;
  rawOutputRoot?: string;
}) => {
  const explicitReportId = args.reportId?.trim();
  const rawFilePath = args.rawFilePath?.trim();

  if (rawFilePath) {
    const derivedReportId = deriveReportIdFromRawArtifactPath(rawFilePath);

    if (explicitReportId && derivedReportId && explicitReportId !== derivedReportId) {
      throw new SpApiSearchTermsIngestError(
        'invalid_input',
        `Provided report id ${explicitReportId} does not match Search Terms raw artifact path ${path.basename(
          rawFilePath
        )}`
      );
    }

    if (!explicitReportId && !derivedReportId) {
      throw new SpApiSearchTermsIngestError(
        'invalid_input',
        'Search Terms parse+ingest requires --report-id when --raw-path does not use the deterministic report-<id>.search-terms.raw.json(.gz) naming'
      );
    }

    try {
      await fsPromises.access(rawFilePath);
    } catch (error) {
      throw new SpApiSearchTermsIngestError(
        'artifact_not_found',
        `SP-API Search Terms raw artifact not found at ${rawFilePath}`,
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
    throw new SpApiSearchTermsIngestError(
      'invalid_input',
      'Search Terms parse+ingest requires either --report-id <value> or --raw-path <value>'
    );
  }

  const rawOutputRoot = args.rawOutputRoot ?? SP_API_SEARCH_TERMS_RAW_OUTPUT_DIR;
  const candidates = [
    path.resolve(rawOutputRoot, `report-${explicitReportId}.search-terms.raw.json.gz`),
    path.resolve(rawOutputRoot, `report-${explicitReportId}.search-terms.raw.json`),
    path.resolve(rawOutputRoot, `report-${explicitReportId}.search-terms.raw.gz`),
  ];

  for (const candidate of candidates) {
    try {
      await fsPromises.access(candidate);
      return {
        reportId: explicitReportId,
        inputFilePath: candidate,
      };
    } catch {
      continue;
    }
  }

  throw new SpApiSearchTermsIngestError(
    'artifact_not_found',
    `SP-API Search Terms raw artifact not found for report ${explicitReportId} under ${rawOutputRoot}`
  );
};

export const readSpApiSearchTermsRawArtifact = async (args: { inputFilePath: string }) => {
  const inspection = await inspectSearchTermsRawArtifact(path.resolve(args.inputFilePath));

  return {
    inputFilePath: inspection.inputFilePath,
    decompressed: inspection.decompressed,
    filenameHint: inspection.filenameHint,
  };
};

export const streamParseSpApiSearchTermsRawArtifact = async function* (args: {
  inputFilePath: string;
  rowBatchSize?: number;
}): AsyncGenerator<SearchTermsMarketWeeklyParseEvent> {
  const { stream } = await createSearchTermsTextStream(path.resolve(args.inputFilePath));
  const rowBatchSize = args.rowBatchSize ?? DEFAULT_STREAM_ROW_BATCH_SIZE;

  let reportSpecNeedleIndex = 0;
  let dataRowsNeedleIndex = 0;
  let seekingReportSpecification = true;
  let seekingReportSpecificationObject = false;
  let reportSpecificationCapture: CapturedJsonObjectState | null = null;
  let metadata: SearchTermsMarketWeeklyParseMetadata | null = null;
  let seekingDataRowsKey = false;
  let seekingDataRowsArray = false;
  let rowCapture: CapturedJsonObjectState | null = null;
  let rowBatch: SearchTermsMarketWeeklyRow[] = [];
  let dataArrayClosed = false;
  let emittedRowCount = 0;

  for await (const chunk of stream) {
    for (const char of chunk) {
      if (seekingReportSpecification) {
        const next = advanceNeedle(REPORT_SPECIFICATION_KEY, reportSpecNeedleIndex, char);
        reportSpecNeedleIndex = next.nextIndex;
        if (next.matched) {
          seekingReportSpecification = false;
          seekingReportSpecificationObject = true;
        }
        continue;
      }

      if (seekingReportSpecificationObject) {
        if (char === '{') {
          reportSpecificationCapture = createJsonObjectState();
          appendCapturedJsonChar(reportSpecificationCapture, char);
          seekingReportSpecificationObject = false;
        }
        continue;
      }

      if (reportSpecificationCapture) {
        appendCapturedJsonChar(reportSpecificationCapture, char);
        if (reportSpecificationCapture.depth === 0) {
          metadata = parseSearchTermsMetadataObject(reportSpecificationCapture.buffer);
          yield {
            type: 'metadata',
            metadata,
          };
          reportSpecificationCapture = null;
          seekingDataRowsKey = true;
        }
        continue;
      }

      if (seekingDataRowsKey) {
        const next = advanceNeedle(DATA_ROWS_KEY, dataRowsNeedleIndex, char);
        dataRowsNeedleIndex = next.nextIndex;
        if (next.matched) {
          seekingDataRowsKey = false;
          seekingDataRowsArray = true;
        }
        continue;
      }

      if (seekingDataRowsArray) {
        if (char === '[') {
          seekingDataRowsArray = false;
        }
        continue;
      }

      if (rowCapture) {
        appendCapturedJsonChar(rowCapture, char);
        if (rowCapture.depth === 0) {
          let parsedRowJson: unknown;
          try {
            parsedRowJson = JSON.parse(rowCapture.buffer);
          } catch (error) {
            throw new SpApiSearchTermsIngestError(
              'invalid_content',
              'Search Terms raw artifact contains an invalid dataByDepartmentAndSearchTerm row object',
              error
            );
          }

          const parsedRow = parseSearchTermsJsonRow(parsedRowJson);
          if (!parsedRow) {
            throw new SpApiSearchTermsIngestError(
              'invalid_content',
              'Search Terms raw artifact contains rows that do not match the expected official report shape'
            );
          }

          rowBatch.push(parsedRow);
          emittedRowCount += 1;
          rowCapture = null;

          if (rowBatch.length >= rowBatchSize) {
            yield {
              type: 'rows',
              rows: rowBatch,
            };
            rowBatch = [];
          }
        }
        continue;
      }

      if (char === ']') {
        dataArrayClosed = true;
        if (rowBatch.length > 0) {
          yield {
            type: 'rows',
            rows: rowBatch,
          };
          rowBatch = [];
        }
        continue;
      }

      if (isWhitespaceOrComma(char)) {
        continue;
      }

      if (char === '{') {
        rowCapture = createJsonObjectState();
        appendCapturedJsonChar(rowCapture, char);
      }
    }
  }

  if (!metadata) {
    throw new SpApiSearchTermsIngestError(
      'invalid_content',
      'Search Terms raw artifact is missing a valid reportSpecification object'
    );
  }

  if (!dataArrayClosed) {
    throw new SpApiSearchTermsIngestError(
      'invalid_content',
      'Search Terms raw artifact is missing a complete dataByDepartmentAndSearchTerm array'
    );
  }

  if (emittedRowCount === 0) {
    throw new SpApiSearchTermsIngestError(
      'validation_failed',
      'Search Terms raw artifact produced zero rows and cannot be ingested for the bounded gate path'
    );
  }
};

export const parseValidatedSpApiSearchTermsRawArtifact = async (args: {
  inputFilePath: string;
}) => {
  let metadata: SearchTermsMarketWeeklyParseMetadata | null = null;
  const rows: SearchTermsMarketWeeklyRow[] = [];

  for await (const event of streamParseSpApiSearchTermsRawArtifact({
    inputFilePath: args.inputFilePath,
  })) {
    if (event.type === 'metadata') {
      metadata = event.metadata;
      continue;
    }

    rows.push(...event.rows);
  }

  if (!metadata) {
    throw new SpApiSearchTermsIngestError(
      'invalid_content',
      'Search Terms raw artifact did not produce parse metadata'
    );
  }

  return {
    ...metadata,
    rows,
  } satisfies SearchTermsMarketWeeklyParseResult;
};

const resolveSearchTermsIngestContext = (env: NodeJS.ProcessEnv = process.env) => {
  const accountId = env.APP_ACCOUNT_ID?.trim();
  const marketplace = env.APP_MARKETPLACE?.trim();

  if (!accountId || !marketplace) {
    throw new SpApiSearchTermsIngestError(
      'invalid_input',
      'Search Terms parse+ingest requires APP_ACCOUNT_ID and APP_MARKETPLACE in the local environment'
    );
  }

  return {
    accountId,
    marketplace,
  };
};

type FirstSearchTermsParsedIngestImpl = (args: {
  rawFilePath: string;
  parsed: SearchTermsMarketWeeklyParseResult;
  accountId: string;
  marketplace: string;
}) => Promise<SearchTermsMarketWeeklyIngestResult>;

export const summarizeSpApiSearchTermsParseIngest = (args: {
  reportId?: string | null;
  inputFilePath: string;
  marketplace: string;
  metadata: SearchTermsMarketWeeklyParseMetadata;
  ingestResult: SearchTermsMarketWeeklyIngestResult;
}): SpApiSearchTermsParseIngestSummary => ({
  endpoint: 'spApiSearchTermsParseAndIngest',
  reportId: args.reportId ?? null,
  inputFilePath: path.resolve(args.inputFilePath),
  marketplace: args.marketplace,
  marketplaceId: args.metadata.marketplaceId,
  coverageStart: args.ingestResult.coverageStart ?? args.metadata.coverageStart,
  coverageEnd: args.ingestResult.coverageEnd ?? args.metadata.coverageEnd,
  rowCount: args.ingestResult.rowCount ?? 0,
  uploadId: args.ingestResult.uploadId ?? null,
  warningsCount: args.ingestResult.warningsCount ?? args.metadata.warnings.length,
});

export const runFirstSpApiSearchTermsParseIngest = async (args: {
  reportId?: string;
  rawFilePath?: string;
  rawOutputRoot?: string;
  env?: NodeJS.ProcessEnv;
  ingestImpl?: FirstSearchTermsParsedIngestImpl;
}) => {
  const resolved = await resolveSpApiSearchTermsRawArtifactPath({
    reportId: args.reportId,
    rawFilePath: args.rawFilePath,
    rawOutputRoot: args.rawOutputRoot,
  });

  const ingestContext = resolveSearchTermsIngestContext(args.env);

  let metadata: SearchTermsMarketWeeklyParseMetadata | null = null;
  let ingestResult: SearchTermsMarketWeeklyIngestResult;

  if (args.ingestImpl) {
    const parsed = await parseValidatedSpApiSearchTermsRawArtifact({
      inputFilePath: resolved.inputFilePath,
    });

    metadata = {
      marketplaceId: parsed.marketplaceId,
      weekStart: parsed.weekStart,
      weekEnd: parsed.weekEnd,
      coverageStart: parsed.coverageStart,
      coverageEnd: parsed.coverageEnd,
      warnings: parsed.warnings,
    };

    try {
      ingestResult = await args.ingestImpl({
        rawFilePath: resolved.inputFilePath,
        parsed,
        accountId: ingestContext.accountId,
        marketplace: ingestContext.marketplace,
      });
    } catch (error) {
      throw new SpApiSearchTermsIngestError(
        'ingest_failed',
        `Failed to ingest Search Terms rows from ${path.basename(resolved.inputFilePath)}: ${
          error instanceof Error ? error.message : 'unknown ingest failure'
        }`,
        error
      );
    }
  } else {
    const parsedEvents = streamParseSpApiSearchTermsRawArtifact({
      inputFilePath: resolved.inputFilePath,
    });

    async function* mirroredEvents(): AsyncGenerator<SearchTermsMarketWeeklyParseEvent> {
      for await (const event of parsedEvents) {
        if (event.type === 'metadata') {
          metadata = event.metadata;
        }
        yield event;
      }
    }

    try {
      ingestResult = await ingestSearchTermsMarketWeeklyRawStream({
        rawFilePath: resolved.inputFilePath,
        parsedEvents: mirroredEvents(),
        accountId: ingestContext.accountId,
        marketplace: ingestContext.marketplace,
      });
    } catch (error) {
      throw new SpApiSearchTermsIngestError(
        'ingest_failed',
        `Failed to ingest Search Terms rows from ${path.basename(resolved.inputFilePath)}: ${
          error instanceof Error ? error.message : 'unknown ingest failure'
        }`,
        error
      );
    }
  }

  if (!metadata) {
    throw new SpApiSearchTermsIngestError(
      'invalid_content',
      'Search Terms parse+ingest did not resolve parse metadata before summary generation'
    );
  }

  return summarizeSpApiSearchTermsParseIngest({
    reportId: resolved.reportId,
    inputFilePath: resolved.inputFilePath,
    marketplace: ingestContext.marketplace,
    metadata,
    ingestResult,
  });
};
