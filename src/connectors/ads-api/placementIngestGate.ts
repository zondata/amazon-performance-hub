import fs from 'node:fs';
import path from 'node:path';

import * as XLSX from 'xlsx';

import { ingestSpPlacementRaw } from '../../ingest/ingestSpPlacementRaw';
import { mapUpload } from '../../mapping/db';
import { ADS_API_PERSISTED_NORMALIZATION_ARTIFACT_PATH } from './adsPersistence';
import { ADS_API_SP_PLACEMENT_DAILY_NORMALIZED_ARTIFACT_PATH } from './spPlacementDaily';
import {
  AdsApiPlacementIngestGateError,
  type AdsApiDateRange,
  type AdsApiPersistedNormalizationArtifact,
  type AdsApiPlacementIngestGateResult,
  type AdsApiSpPlacementDailyNormalizedArtifact,
  type AdsApiSpPlacementDailyNormalizedRow,
} from './types';

export const ADS_API_SP_PLACEMENT_INGEST_GATE_TEMP_XLSX_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-ingest-gate/sp-placement-daily.ingest.xlsx'
);

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
};

const fail = (
  code: 'artifact_missing' | 'artifact_invalid' | 'artifact_mismatch' | 'invalid_rows' | 'sink_failed',
  message: string,
  details?: unknown
): never => {
  throw new AdsApiPlacementIngestGateError(code, message, { details });
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
    fail('artifact_missing', `Missing required placement artifact: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail('artifact_invalid', `Placement artifact is not valid JSON: ${filePath}`, error);
  }
};

const parsePlacementArtifact = (
  value: unknown,
  filePath: string
): AdsApiPersistedNormalizationArtifact => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('artifact_invalid', `Placement artifact is invalid: ${filePath}`);
  }
  const candidate = value as Record<string, unknown>;
  if (
    readString(candidate.schemaVersion) !== 'ads-api-sp-daily-persisted/v1' ||
    readString(candidate.appAccountId) === null ||
    readString(candidate.appMarketplace) === null ||
    readString(candidate.adsApiBaseUrl) === null ||
    readString(candidate.profileId) === null ||
    !isDateRange(candidate.requestedDateRange) ||
    readNumber(candidate.placementRowCount) === null ||
    !Array.isArray(candidate.placementRows)
  ) {
    fail('artifact_invalid', `Placement artifact is missing required fields: ${filePath}`);
  }
  return value as AdsApiPersistedNormalizationArtifact;
};

const parsePlacementNormalizedArtifact = (
  value: unknown,
  filePath: string
): AdsApiSpPlacementDailyNormalizedArtifact => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('artifact_invalid', `Placement normalized artifact is invalid: ${filePath}`);
  }
  const candidate = value as Record<string, unknown>;
  if (
    readString(candidate.schemaVersion) !== 'ads-api-sp-placement-daily-normalized/v1' ||
    readString(candidate.appAccountId) === null ||
    readString(candidate.appMarketplace) === null ||
    readString(candidate.adsApiBaseUrl) === null ||
    readString(candidate.profileId) === null ||
    !isDateRange(candidate.requestedDateRange) ||
    readNumber(candidate.rowCount) === null ||
    !Array.isArray(candidate.normalizedPlacementRows)
  ) {
    fail(
      'artifact_invalid',
      `Placement normalized artifact is missing required fields: ${filePath}`
    );
  }
  return value as AdsApiSpPlacementDailyNormalizedArtifact;
};

type PlacementArtifactEnvelope = {
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
};

const validatePlacementRows = (
  artifact: PlacementArtifactEnvelope,
  placementRowCount: number,
  placementRows: AdsApiSpPlacementDailyNormalizedRow[],
  filePath: string
): AdsApiSpPlacementDailyNormalizedRow[] => {
  if (placementRowCount < 1) {
    fail('invalid_rows', 'Placement artifact must contain at least 1 placement row.');
  }
  if (placementRows.length < 1) {
    fail('invalid_rows', 'Placement artifact placement rows must be non-empty.');
  }
  if (placementRowCount !== placementRows.length) {
    fail(
      'artifact_invalid',
      `Placement artifact placementRowCount does not match row length: ${filePath}`
    );
  }

  for (const [index, row] of placementRows.entries()) {
    const rowNumber = index + 1;
    if (row.appAccountId !== artifact.appAccountId) {
      fail('artifact_mismatch', `Placement row appAccountId mismatch at row ${rowNumber}.`);
    }
    if (row.appMarketplace !== artifact.appMarketplace) {
      fail('artifact_mismatch', `Placement row appMarketplace mismatch at row ${rowNumber}.`);
    }
    if (row.profileId !== artifact.profileId) {
      fail('artifact_mismatch', `Placement row profileId mismatch at row ${rowNumber}.`);
    }
    if (
      row.date < artifact.requestedDateRange.startDate ||
      row.date > artifact.requestedDateRange.endDate
    ) {
      fail(
        'invalid_rows',
        `Placement row date is outside the requestedDateRange at row ${rowNumber}.`
      );
    }
    requireString(row.campaignId, 'invalid_rows', `Placement row is missing campaignId at row ${rowNumber}.`, row);
    requireString(row.campaignName, 'invalid_rows', `Placement row is missing campaignName at row ${rowNumber}.`, row);
    requireString(row.placementRaw, 'invalid_rows', `Placement row is missing placementRaw at row ${rowNumber}.`, row);
  }

  return [...placementRows].sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    if (left.campaignId !== right.campaignId) {
      return left.campaignId.localeCompare(right.campaignId, 'en', { numeric: true });
    }
    return left.placementRaw.localeCompare(right.placementRaw, 'en');
  });
};

export const loadAdsPlacementIngestGateArtifact = (args: {
  artifactPath?: string;
} = {}): {
  artifactPath: string;
  artifact: PlacementArtifactEnvelope;
  placementRows: AdsApiSpPlacementDailyNormalizedRow[];
} => {
  const artifactPath =
    args.artifactPath ?? ADS_API_SP_PLACEMENT_DAILY_NORMALIZED_ARTIFACT_PATH;
  const value = readJsonFile(artifactPath);
  const schemaVersion =
    value && typeof value === 'object' && !Array.isArray(value)
      ? readString((value as Record<string, unknown>).schemaVersion)
      : null;

  if (schemaVersion === 'ads-api-sp-daily-persisted/v1') {
    const artifact = parsePlacementArtifact(value, artifactPath);
    return {
      artifactPath,
      artifact: {
        appAccountId: artifact.appAccountId,
        appMarketplace: artifact.appMarketplace,
        adsApiBaseUrl: artifact.adsApiBaseUrl,
        profileId: artifact.profileId,
        requestedDateRange: artifact.requestedDateRange,
      },
      placementRows: validatePlacementRows(
        artifact,
        artifact.placementRowCount,
        artifact.placementRows,
        artifactPath
      ),
    };
  }

  const artifact = parsePlacementNormalizedArtifact(value, artifactPath);
  return {
    artifactPath,
    artifact: {
      appAccountId: artifact.appAccountId,
      appMarketplace: artifact.appMarketplace,
      adsApiBaseUrl: artifact.adsApiBaseUrl,
      profileId: artifact.profileId,
      requestedDateRange: artifact.requestedDateRange,
    },
    placementRows: validatePlacementRows(
      artifact,
      artifact.rowCount,
      artifact.normalizedPlacementRows,
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

const safeDivide = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? numerator / denominator : null;

export const buildPlacementIngestGateWorkbook = (args: {
  placementRows: AdsApiSpPlacementDailyNormalizedRow[];
  gateRunId: string;
}): XLSX.WorkBook => {
  const rows = args.placementRows.map((row) => {
    const acos = safeDivide(row.cost, row.attributedSales14d);
    const roas = safeDivide(row.attributedSales14d, row.cost);
    return {
      Date: row.date,
      'Portfolio Name': '',
      'Campaign Name': row.campaignName,
      'Bidding Strategy': row.campaignBiddingStrategy ?? '',
      Placement: row.placementRaw,
      Impressions: row.impressions,
      Clicks: row.clicks,
      Spend: row.cost,
      Sales: row.attributedSales14d,
      Orders: row.attributedConversions14d,
      Units: row.attributedUnitsOrdered14d,
      CPC: row.costPerClick ?? '',
      CTR: row.clickThroughRate ?? '',
      ACOS: acos ?? '',
      ROAS: roas ?? '',
      'Gate Run Id': args.gateRunId,
    };
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return workbook;
};

export const writePlacementIngestGateWorkbook = (args: {
  tempXlsxPath: string;
  placementRows: AdsApiSpPlacementDailyNormalizedRow[];
  gateRunId: string;
}): void => {
  fs.mkdirSync(path.dirname(args.tempXlsxPath), { recursive: true });
  XLSX.writeFile(
    buildPlacementIngestGateWorkbook({
      placementRows: args.placementRows,
      gateRunId: args.gateRunId,
    }),
    args.tempXlsxPath
  );
};

export const runAdsApiPlacementIngestGate = async (args: {
  artifactPath?: string;
  tempXlsxPath?: string;
  gateRunId?: string;
} = {}): Promise<AdsApiPlacementIngestGateResult> => {
  const gateRunId: string = args.gateRunId ?? new Date().toISOString();
  const tempXlsxPath: string =
    args.tempXlsxPath ?? ADS_API_SP_PLACEMENT_INGEST_GATE_TEMP_XLSX_PATH;
  const { artifact, placementRows } = loadAdsPlacementIngestGateArtifact({
    artifactPath: args.artifactPath,
  });

  writePlacementIngestGateWorkbook({
    tempXlsxPath,
    placementRows,
    gateRunId,
  });

  try {
    const sinkResult = await ingestSpPlacementRaw(
      tempXlsxPath,
      artifact.appAccountId,
      buildGateExportedAt(artifact.requestedDateRange.endDate, gateRunId)
    );
    const uploadId =
      sinkResult.uploadId ??
      fail('sink_failed', 'Placement ingest sink returned no upload id.');

    const mapResult = await mapUpload(uploadId, 'sp_placement');
    return {
      appAccountId: artifact.appAccountId,
      appMarketplace: artifact.appMarketplace,
      profileId: artifact.profileId,
      requestedDateRange: artifact.requestedDateRange,
      placementRowCount: placementRows.length,
      sinkResult: {
        ingestStatus: sinkResult.status,
        mapStatus: mapResult.status,
        uploadId,
        rawRowCount: sinkResult.rowCount ?? null,
        factRows: mapResult.factRows,
        issueRows: mapResult.issueRows,
        coverageStart: sinkResult.coverageStart ?? null,
        coverageEnd: sinkResult.coverageEnd ?? null,
        tempXlsxPath,
      },
    };
  } catch (error) {
    throw new AdsApiPlacementIngestGateError(
      'sink_failed',
      `Placement ingest sink failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      { details: error }
    );
  }
};
