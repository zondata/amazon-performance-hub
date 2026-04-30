import fs from 'node:fs';
import path from 'node:path';

import { ingestSpSearchTermRaw } from '../../ingest/ingestSpSearchTermRaw';
import { mapUpload } from '../../mapping/db';
import { ADS_API_SP_SEARCH_TERM_DAILY_NORMALIZED_ARTIFACT_PATH } from './spSearchTermDaily';
import {
  AdsApiSearchTermIngestGateError,
  type AdsApiDateRange,
  type AdsApiSearchTermIngestGateResult,
  type AdsApiSearchTermIngestGateSinkSummary,
  type AdsApiSpSearchTermDailyNormalizedArtifact,
  type AdsApiSpSearchTermDailyNormalizedRow,
} from './types';

export const ADS_API_SP_SEARCH_TERM_INGEST_GATE_TEMP_CSV_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-ingest-gate/sp-search-term-daily.ingest.csv'
);

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const fail = (
  code: 'artifact_missing' | 'artifact_invalid' | 'artifact_mismatch' | 'invalid_rows' | 'sink_failed',
  message: string,
  details?: unknown
): never => {
  throw new AdsApiSearchTermIngestGateError(code, message, { details });
};

const requireString = (
  value: unknown,
  code: 'artifact_missing' | 'artifact_invalid' | 'artifact_mismatch' | 'invalid_rows' | 'sink_failed',
  message: string,
  details?: unknown
): string => {
  const parsed = readString(value);
  if (!parsed) fail(code, message, details);
  return parsed as string;
};

const isDateRange = (value: unknown): value is AdsApiDateRange =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  readString((value as Record<string, unknown>).startDate) !== null &&
  readString((value as Record<string, unknown>).endDate) !== null;

const readJsonFile = (filePath: string): unknown => {
  if (!fs.existsSync(filePath)) {
    fail('artifact_missing', `Missing required search term artifact: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail('artifact_invalid', `Search term artifact is not valid JSON: ${filePath}`, error);
  }
};

const parseSearchTermNormalizedArtifact = (
  value: unknown,
  filePath: string
): AdsApiSpSearchTermDailyNormalizedArtifact => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('artifact_invalid', `Search term normalized artifact is invalid: ${filePath}`);
  }
  const candidate = value as Record<string, unknown>;
  if (
    readString(candidate.schemaVersion) !== 'ads-api-sp-search-term-daily-normalized/v1' ||
    readString(candidate.appAccountId) === null ||
    readString(candidate.appMarketplace) === null ||
    readString(candidate.adsApiBaseUrl) === null ||
    readString(candidate.profileId) === null ||
    !isDateRange(candidate.requestedDateRange) ||
    readNumber(candidate.rowCount) === null ||
    !Array.isArray(candidate.normalizedSearchTermRows)
  ) {
    fail(
      'artifact_invalid',
      `Search term normalized artifact is missing required fields: ${filePath}`
    );
  }
  return value as AdsApiSpSearchTermDailyNormalizedArtifact;
};

type SearchTermArtifactEnvelope = {
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
};

const validateSearchTermRows = (
  artifact: SearchTermArtifactEnvelope,
  rowCount: number,
  rows: AdsApiSpSearchTermDailyNormalizedRow[],
  filePath: string
): AdsApiSpSearchTermDailyNormalizedRow[] => {
  if (rowCount < 1) {
    fail('invalid_rows', 'Search term artifact must contain at least 1 row.');
  }
  if (rows.length < 1) {
    fail('invalid_rows', 'Search term artifact rows must be non-empty.');
  }
  if (rowCount !== rows.length) {
    fail(
      'artifact_invalid',
      `Search term artifact rowCount does not match row length: ${filePath}`
    );
  }

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 1;
    if (row.appAccountId !== artifact.appAccountId) {
      fail('artifact_mismatch', `Search term row appAccountId mismatch at row ${rowNumber}.`);
    }
    if (row.appMarketplace !== artifact.appMarketplace) {
      fail('artifact_mismatch', `Search term row appMarketplace mismatch at row ${rowNumber}.`);
    }
    if (row.profileId !== artifact.profileId) {
      fail('artifact_mismatch', `Search term row profileId mismatch at row ${rowNumber}.`);
    }
    if (
      row.date < artifact.requestedDateRange.startDate ||
      row.date > artifact.requestedDateRange.endDate
    ) {
      fail(
        'invalid_rows',
        `Search term row date is outside the requestedDateRange at row ${rowNumber}.`
      );
    }
    requireString(row.campaignId, 'invalid_rows', `Search term row is missing campaignId at row ${rowNumber}.`, row);
    requireString(row.campaignName, 'invalid_rows', `Search term row is missing campaignName at row ${rowNumber}.`, row);
    requireString(row.adGroupId, 'invalid_rows', `Search term row is missing adGroupId at row ${rowNumber}.`, row);
    requireString(row.adGroupName, 'invalid_rows', `Search term row is missing adGroupName at row ${rowNumber}.`, row);
    requireString(row.targetingExpression, 'invalid_rows', `Search term row is missing targetingExpression at row ${rowNumber}.`, row);
    requireString(row.searchTerm, 'invalid_rows', `Search term row is missing searchTerm at row ${rowNumber}.`, row);
  }

  return [...rows].sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    if (left.campaignId !== right.campaignId) {
      return left.campaignId.localeCompare(right.campaignId, 'en', { numeric: true });
    }
    if (left.adGroupId !== right.adGroupId) {
      return left.adGroupId.localeCompare(right.adGroupId, 'en', { numeric: true });
    }
    if ((left.targetId ?? '') !== (right.targetId ?? '')) {
      return (left.targetId ?? '').localeCompare(right.targetId ?? '', 'en', {
        numeric: true,
      });
    }
    if (left.searchTerm !== right.searchTerm) {
      return left.searchTerm.localeCompare(right.searchTerm, 'en');
    }
    return left.targetingExpression.localeCompare(right.targetingExpression, 'en');
  });
};

export const loadAdsSearchTermIngestGateArtifact = (args: {
  artifactPath?: string;
} = {}): {
  artifactPath: string;
  artifact: SearchTermArtifactEnvelope;
  searchTermRows: AdsApiSpSearchTermDailyNormalizedRow[];
} => {
  const artifactPath =
    args.artifactPath ?? ADS_API_SP_SEARCH_TERM_DAILY_NORMALIZED_ARTIFACT_PATH;
  const artifact = parseSearchTermNormalizedArtifact(readJsonFile(artifactPath), artifactPath);
  return {
    artifactPath,
    artifact: {
      appAccountId: artifact.appAccountId,
      appMarketplace: artifact.appMarketplace,
      adsApiBaseUrl: artifact.adsApiBaseUrl,
      profileId: artifact.profileId,
      requestedDateRange: artifact.requestedDateRange,
    },
    searchTermRows: validateSearchTermRows(
      artifact,
      artifact.rowCount,
      artifact.normalizedSearchTermRows,
      artifactPath
    ),
  };
};

const buildGateExportedAt = (endDate: string, gateRunId: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(gateRunId)) {
    return `${endDate}T23:59:59.000Z`;
  }
  return `${endDate}${gateRunId.slice(10)}`;
};

const escapeCsvCell = (value: string | number | null): string => {
  if (value === null) return '';
  const stringValue = String(value);
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const buildSearchTermIngestGateCsv = (args: {
  searchTermRows: AdsApiSpSearchTermDailyNormalizedRow[];
  gateRunId: string;
}): string => {
  const headers = [
    'Date',
    'Portfolio Name',
    'Campaign Name',
    'Ad Group Name',
    'Targeting',
    'Match Type',
    'Keyword Type',
    'Target Status',
    'Search Term',
    'Impressions',
    'Clicks',
    'Spend',
    'Sales',
    'Orders',
    'Units',
    'CPC',
    'CTR',
    'ACOS',
    'ROAS',
    'Conversion Rate',
    'Gate Run Id',
  ];
  const rows = args.searchTermRows.map((row) => [
    row.date,
    '',
    row.campaignName,
    row.adGroupName,
    row.targetingExpression,
    row.matchType ?? '',
    row.keywordType ?? '',
    row.targetStatus ?? '',
    row.searchTerm,
    row.impressions,
    row.clicks,
    row.cost,
    row.attributedSales14d,
    row.attributedConversions14d,
    row.attributedUnitsOrdered14d,
    row.costPerClick,
    row.clickThroughRate,
    row.acosClicks14d,
    row.roasClicks14d,
    row.purchaseClickRate14d,
    args.gateRunId,
  ]);
  return [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvCell(value as string | number | null)).join(','))
    .join('\n');
};

export const writeSearchTermIngestGateCsv = (args: {
  searchTermRows: AdsApiSpSearchTermDailyNormalizedRow[];
  tempCsvPath?: string;
  gateRunId?: string;
}) => {
  const gateRunId = args.gateRunId ?? new Date().toISOString();
  const tempCsvPath = args.tempCsvPath ?? ADS_API_SP_SEARCH_TERM_INGEST_GATE_TEMP_CSV_PATH;
  fs.mkdirSync(path.dirname(tempCsvPath), { recursive: true });
  fs.writeFileSync(
    tempCsvPath,
    `${buildSearchTermIngestGateCsv({
      searchTermRows: args.searchTermRows,
      gateRunId,
    })}\n`
  );
  return {
    gateRunId,
    tempCsvPath,
  };
};

const buildSinkSummary = (args: {
  ingestResult: Awaited<ReturnType<typeof ingestSpSearchTermRaw>>;
  mapResult: Awaited<ReturnType<typeof mapUpload>>;
  tempCsvPath: string;
  uploadId: string;
}): AdsApiSearchTermIngestGateSinkSummary => ({
  ingestStatus: args.ingestResult.status,
  mapStatus: args.mapResult.status,
  uploadId: args.uploadId,
  rawRowCount: args.ingestResult.rowCount ?? null,
  factRows: args.mapResult.factRows,
  issueRows: args.mapResult.issueRows,
  coverageStart: args.ingestResult.coverageStart ?? null,
  coverageEnd: args.ingestResult.coverageEnd ?? null,
  tempCsvPath: args.tempCsvPath,
});

export const runAdsApiSearchTermIngestGate = async (args: {
  artifactPath?: string;
  tempCsvPath?: string;
  gateRunId?: string;
} = {}): Promise<AdsApiSearchTermIngestGateResult> => {
  const { artifact, searchTermRows } = loadAdsSearchTermIngestGateArtifact({
    artifactPath: args.artifactPath,
  });
  const csv = writeSearchTermIngestGateCsv({
    searchTermRows,
    tempCsvPath: args.tempCsvPath,
    gateRunId: args.gateRunId,
  });
  const exportedAt = buildGateExportedAt(artifact.requestedDateRange.endDate, csv.gateRunId);

  try {
    const ingestResult = await ingestSpSearchTermRaw(
      csv.tempCsvPath,
      artifact.appAccountId,
      exportedAt
    );
    const uploadId =
      ingestResult.uploadId ??
      fail('sink_failed', 'Search term ingest sink returned no upload id.');
    const mapResult = await mapUpload(uploadId, 'sp_search_term');
    return {
      appAccountId: artifact.appAccountId,
      appMarketplace: artifact.appMarketplace,
      profileId: artifact.profileId,
      requestedDateRange: artifact.requestedDateRange,
      searchTermRowCount: searchTermRows.length,
      sinkResult: buildSinkSummary({
        ingestResult,
        mapResult,
        tempCsvPath: csv.tempCsvPath,
        uploadId,
      }),
    };
  } catch (error) {
    if (error instanceof AdsApiSearchTermIngestGateError) {
      throw error;
    }
    throw new AdsApiSearchTermIngestGateError(
      'sink_failed',
      `Search term ingest sink failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      { details: error }
    );
  }
};
