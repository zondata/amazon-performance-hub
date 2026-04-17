import fs from 'node:fs';
import path from 'node:path';

import * as XLSX from 'xlsx';

import { ingestSpTargetingRaw } from '../../ingest/ingestSpTargetingRaw';
import { mapUpload } from '../../mapping/db';
import { ADS_API_PERSISTED_NORMALIZATION_ARTIFACT_PATH } from './adsPersistence';
import {
  AdsApiTargetIngestGateError,
  type AdsApiDateRange,
  type AdsApiPersistedNormalizationArtifact,
  type AdsApiSpTargetDailyNormalizedRow,
  type AdsApiTargetIngestGateResult,
  type AdsApiTargetIngestGateSinkSummary,
} from './types';

export const ADS_API_SP_TARGET_INGEST_GATE_TEMP_XLSX_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-ingest-gate/sp-target-daily.ingest.xlsx'
);

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return null;
};

const requireString = (
  value: unknown,
  code:
    | 'artifact_missing'
    | 'artifact_invalid'
    | 'artifact_mismatch'
    | 'invalid_rows'
    | 'sink_failed',
  message: string,
  details?: unknown
): string => {
  const parsed = readString(value);
  if (!parsed) {
    fail(code, message, details);
  }
  return parsed as string;
};

const isDateRange = (value: unknown): value is AdsApiDateRange =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  readString((value as Record<string, unknown>).startDate) !== null &&
  readString((value as Record<string, unknown>).endDate) !== null;

const fail = (
  code:
    | 'artifact_missing'
    | 'artifact_invalid'
    | 'artifact_mismatch'
    | 'invalid_rows'
    | 'sink_failed',
  message: string,
  details?: unknown
): never => {
  throw new AdsApiTargetIngestGateError(code, message, { details });
};

const readJsonFile = (filePath: string): unknown => {
  if (!fs.existsSync(filePath)) {
    fail('artifact_missing', `Missing required persisted artifact: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail('artifact_invalid', `Persisted artifact is not valid JSON: ${filePath}`, error);
  }
};

const parsePersistedNormalizationArtifact = (
  value: unknown,
  filePath: string
): AdsApiPersistedNormalizationArtifact => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('artifact_invalid', `Persisted artifact is invalid: ${filePath}`);
  }

  const candidate = value as Record<string, unknown>;
  if (
    readString(candidate.schemaVersion) !== 'ads-api-sp-daily-persisted/v1' ||
    readString(candidate.appAccountId) === null ||
    readString(candidate.appMarketplace) === null ||
    readString(candidate.adsApiBaseUrl) === null ||
    readString(candidate.profileId) === null ||
    !isDateRange(candidate.requestedDateRange) ||
    readNumber(candidate.targetRowCount) === null ||
    !Array.isArray(candidate.targetRows)
  ) {
    fail('artifact_invalid', `Persisted artifact is missing required fields: ${filePath}`);
  }

  return value as AdsApiPersistedNormalizationArtifact;
};

const validateTargetRows = (
  artifact: AdsApiPersistedNormalizationArtifact,
  filePath: string
): AdsApiSpTargetDailyNormalizedRow[] => {
  if (artifact.targetRowCount < 1) {
    fail('invalid_rows', 'Persisted artifact must contain at least 1 target row.');
  }

  if (artifact.targetRows.length < 1) {
    fail('invalid_rows', 'Persisted artifact targetRows must be non-empty.');
  }

  if (artifact.targetRowCount !== artifact.targetRows.length) {
    fail(
      'artifact_invalid',
      `Persisted artifact targetRowCount does not match targetRows length: ${filePath}`
    );
  }

  const { appAccountId, appMarketplace, profileId, requestedDateRange } = artifact;

  for (const [index, row] of artifact.targetRows.entries()) {
    const rowNumber = index + 1;

    if (row.appAccountId !== appAccountId) {
      fail('artifact_mismatch', `Target row appAccountId mismatch at row ${rowNumber}.`);
    }

    if (row.appMarketplace !== appMarketplace) {
      fail('artifact_mismatch', `Target row appMarketplace mismatch at row ${rowNumber}.`);
    }

    if (row.profileId !== profileId) {
      fail('artifact_mismatch', `Target row profileId mismatch at row ${rowNumber}.`);
    }

    if (
      row.date < requestedDateRange.startDate ||
      row.date > requestedDateRange.endDate
    ) {
      fail(
        'invalid_rows',
        `Target row date is outside the persisted requestedDateRange at row ${rowNumber}.`
      );
    }

    requireString(
      row.campaignId,
      'invalid_rows',
      `Target row is missing campaignId at row ${rowNumber}.`,
      row
    );
    requireString(
      row.adGroupId,
      'invalid_rows',
      `Target row is missing adGroupId at row ${rowNumber}.`,
      row
    );
    requireString(
      row.targetId,
      'invalid_rows',
      `Target row is missing targetId at row ${rowNumber}.`,
      row
    );
    requireString(
      row.campaignName,
      'invalid_rows',
      `Target row is missing campaignName at row ${rowNumber}.`,
      row
    );
    requireString(
      row.adGroupName,
      'invalid_rows',
      `Target row is missing adGroupName at row ${rowNumber}.`,
      row
    );
    requireString(
      row.targetingExpression,
      'invalid_rows',
      `Target row is missing targetingExpression at row ${rowNumber}.`,
      row
    );
  }

  return [...artifact.targetRows].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }
    return left.targetId.localeCompare(right.targetId, 'en', { numeric: true });
  });
};

export const loadAdsTargetIngestGateArtifact = (args: {
  artifactPath?: string;
} = {}): {
  artifactPath: string;
  artifact: AdsApiPersistedNormalizationArtifact;
  targetRows: AdsApiSpTargetDailyNormalizedRow[];
} => {
  const artifactPath =
    args.artifactPath ?? ADS_API_PERSISTED_NORMALIZATION_ARTIFACT_PATH;
  const artifact = parsePersistedNormalizationArtifact(
    readJsonFile(artifactPath),
    artifactPath
  );

  return {
    artifactPath,
    artifact,
    targetRows: validateTargetRows(artifact, artifactPath),
  };
};

const buildGateExportedAt = (endDate: string, gateRunId: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(gateRunId)) {
    return `${endDate}T23:59:59.000Z`;
  }

  return `${endDate}${gateRunId.slice(10)}`;
};

const toWorksheetRows = (args: {
  targetRows: AdsApiSpTargetDailyNormalizedRow[];
  gateRunId: string;
}) =>
  args.targetRows.map((row) => ({
    Date: row.date,
    'Portfolio Name': '',
    'Campaign Name': row.campaignName,
    'Ad Group Name': row.adGroupName,
    Targeting: row.targetingExpression,
    'Match Type': row.matchType ?? '',
    Impressions: row.impressions,
    Clicks: row.clicks,
    Spend: row.cost,
    Sales: row.attributedSales14d,
    Orders: row.attributedConversions14d,
    Units: '',
    CPC: '',
    CTR: '',
    ACOS: '',
    ROAS: '',
    'Conversion Rate': '',
    'Top of Search Impression Share': '',
    'Gate Run Id': args.gateRunId,
  }));

export const buildTargetIngestGateWorkbook = (args: {
  targetRows: AdsApiSpTargetDailyNormalizedRow[];
  gateRunId: string;
}): XLSX.WorkBook => {
  const worksheet = XLSX.utils.json_to_sheet(
    toWorksheetRows({
      targetRows: args.targetRows,
      gateRunId: args.gateRunId,
    }),
    {
      header: [
        'Date',
        'Portfolio Name',
        'Campaign Name',
        'Ad Group Name',
        'Targeting',
        'Match Type',
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
        'Top of Search Impression Share',
        'Gate Run Id',
      ],
    }
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Targeting');
  return workbook;
};

export const writeTargetIngestGateWorkbook = (args: {
  targetRows: AdsApiSpTargetDailyNormalizedRow[];
  tempXlsxPath?: string;
  gateRunId?: string;
}) => {
  const gateRunId = args.gateRunId ?? new Date().toISOString();
  const tempXlsxPath =
    args.tempXlsxPath ?? ADS_API_SP_TARGET_INGEST_GATE_TEMP_XLSX_PATH;

  fs.mkdirSync(path.dirname(tempXlsxPath), { recursive: true });
  XLSX.writeFile(
    buildTargetIngestGateWorkbook({
      targetRows: args.targetRows,
      gateRunId,
    }),
    tempXlsxPath
  );

  return {
    gateRunId,
    tempXlsxPath,
  };
};

const buildSinkSummary = (args: {
  ingestResult: Awaited<ReturnType<typeof ingestSpTargetingRaw>>;
  mapResult: Awaited<ReturnType<typeof mapUpload>>;
  tempXlsxPath: string;
  uploadId: string;
}): AdsApiTargetIngestGateSinkSummary => ({
  ingestStatus: args.ingestResult.status,
  mapStatus: args.mapResult.status,
  uploadId: args.uploadId,
  rawRowCount: args.ingestResult.rowCount ?? null,
  factRows: args.mapResult.factRows,
  issueRows: args.mapResult.issueRows,
  coverageStart: args.ingestResult.coverageStart ?? null,
  coverageEnd: args.ingestResult.coverageEnd ?? null,
  tempXlsxPath: args.tempXlsxPath,
});

export const runAdsApiTargetIngestGate = async (args: {
  artifactPath?: string;
  tempXlsxPath?: string;
  gateRunId?: string;
} = {}): Promise<AdsApiTargetIngestGateResult> => {
  const { artifact, targetRows } = loadAdsTargetIngestGateArtifact({
    artifactPath: args.artifactPath,
  });
  const workbook = writeTargetIngestGateWorkbook({
    targetRows,
    tempXlsxPath: args.tempXlsxPath,
    gateRunId: args.gateRunId,
  });
  const exportedAt = buildGateExportedAt(
    artifact.requestedDateRange.endDate,
    workbook.gateRunId
  );

  try {
    const ingestResult = await ingestSpTargetingRaw(
      workbook.tempXlsxPath,
      artifact.appAccountId,
      exportedAt
    );
    const uploadId = requireString(
      ingestResult.uploadId,
      'sink_failed',
      'Target ingest sink did not return an uploadId for the gate run.',
      ingestResult
    );
    const mapResult = await mapUpload(uploadId, 'sp_targeting');

    if (mapResult.status !== 'ok') {
      fail(
        'sink_failed',
        `Target ingest mapping did not succeed: ${mapResult.status}`,
        mapResult
      );
    }

    if (mapResult.factRows < 1) {
      fail(
        'sink_failed',
        'Target ingest gate completed without writing any fact rows.',
        mapResult
      );
    }

    return {
      appAccountId: artifact.appAccountId,
      appMarketplace: artifact.appMarketplace,
      profileId: artifact.profileId,
      requestedDateRange: artifact.requestedDateRange,
      targetRowCount: targetRows.length,
      sinkResult: buildSinkSummary({
        ingestResult,
        mapResult,
        tempXlsxPath: workbook.tempXlsxPath,
        uploadId,
      }),
    };
  } catch (error) {
    if (error instanceof AdsApiTargetIngestGateError) {
      throw error;
    }

    fail(
      'sink_failed',
      error instanceof Error
        ? `Target ingest sink failed: ${error.message}`
        : 'Target ingest sink failed due to an unknown error.',
      error
    );
  }

  throw new Error('Unreachable target ingest gate state.');
};
