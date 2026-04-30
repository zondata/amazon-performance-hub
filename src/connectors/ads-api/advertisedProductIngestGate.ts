import fs from 'node:fs';
import path from 'node:path';

import * as XLSX from 'xlsx';

import { getSupabaseClient } from '../../db/supabaseClient';
import { ingestSpAdvertisedProductRaw } from '../../ingest/ingestSpAdvertisedProductRaw';
import { ADS_API_SP_ADVERTISED_PRODUCT_DAILY_NORMALIZED_ARTIFACT_PATH } from './spAdvertisedProductDaily';
import {
  AdsApiAdvertisedProductIngestGateError,
  type AdsApiAdvertisedProductIngestGateResult,
  type AdsApiDateRange,
  type AdsApiSpAdvertisedProductDailyNormalizedArtifact,
  type AdsApiSpAdvertisedProductDailyNormalizedRow,
} from './types';

export const ADS_API_SP_ADVERTISED_PRODUCT_INGEST_GATE_TEMP_XLSX_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-ingest-gate/sp-advertised-product-daily.ingest.xlsx'
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
  throw new AdsApiAdvertisedProductIngestGateError(code, message, { details });
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
    fail('artifact_missing', `Missing required advertised product artifact: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(
      'artifact_invalid',
      `Advertised product artifact is not valid JSON: ${filePath}`,
      error
    );
  }
};

const parseAdvertisedProductNormalizedArtifact = (
  value: unknown,
  filePath: string
): AdsApiSpAdvertisedProductDailyNormalizedArtifact => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('artifact_invalid', `Advertised product normalized artifact is invalid: ${filePath}`);
  }
  const candidate = value as Record<string, unknown>;
  if (
    readString(candidate.schemaVersion) !==
      'ads-api-sp-advertised-product-daily-normalized/v1' ||
    readString(candidate.appAccountId) === null ||
    readString(candidate.appMarketplace) === null ||
    readString(candidate.adsApiBaseUrl) === null ||
    readString(candidate.profileId) === null ||
    !isDateRange(candidate.requestedDateRange) ||
    readNumber(candidate.rowCount) === null ||
    !Array.isArray(candidate.normalizedAdvertisedProductRows)
  ) {
    fail(
      'artifact_invalid',
      `Advertised product normalized artifact is missing required fields: ${filePath}`
    );
  }
  return value as AdsApiSpAdvertisedProductDailyNormalizedArtifact;
};

type AdvertisedProductArtifactEnvelope = {
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
};

const validateAdvertisedProductRows = (
  artifact: AdvertisedProductArtifactEnvelope,
  rowCount: number,
  rows: AdsApiSpAdvertisedProductDailyNormalizedRow[],
  filePath: string
): AdsApiSpAdvertisedProductDailyNormalizedRow[] => {
  if (rowCount < 1) {
    fail('invalid_rows', 'Advertised product artifact must contain at least 1 row.');
  }
  if (rows.length < 1) {
    fail('invalid_rows', 'Advertised product artifact rows must be non-empty.');
  }
  if (rowCount !== rows.length) {
    fail(
      'artifact_invalid',
      `Advertised product artifact rowCount does not match row length: ${filePath}`
    );
  }

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 1;
    if (row.appAccountId !== artifact.appAccountId) {
      fail(
        'artifact_mismatch',
        `Advertised product row appAccountId mismatch at row ${rowNumber}.`
      );
    }
    if (row.appMarketplace !== artifact.appMarketplace) {
      fail(
        'artifact_mismatch',
        `Advertised product row appMarketplace mismatch at row ${rowNumber}.`
      );
    }
    if (row.profileId !== artifact.profileId) {
      fail(
        'artifact_mismatch',
        `Advertised product row profileId mismatch at row ${rowNumber}.`
      );
    }
    if (
      row.date < artifact.requestedDateRange.startDate ||
      row.date > artifact.requestedDateRange.endDate
    ) {
      fail(
        'invalid_rows',
        `Advertised product row date is outside the requestedDateRange at row ${rowNumber}.`
      );
    }
    requireString(
      row.campaignId,
      'invalid_rows',
      `Advertised product row is missing campaignId at row ${rowNumber}.`,
      row
    );
    requireString(
      row.campaignName,
      'invalid_rows',
      `Advertised product row is missing campaignName at row ${rowNumber}.`,
      row
    );
    requireString(
      row.advertisedAsin,
      'invalid_rows',
      `Advertised product row is missing advertisedAsin at row ${rowNumber}.`,
      row
    );
  }

  return [...rows].sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    if (left.campaignId !== right.campaignId) {
      return left.campaignId.localeCompare(right.campaignId, 'en', {
        numeric: true,
      });
    }
    if ((left.adGroupId ?? '') !== (right.adGroupId ?? '')) {
      return (left.adGroupId ?? '').localeCompare(right.adGroupId ?? '', 'en', {
        numeric: true,
      });
    }
    if (left.advertisedAsin !== right.advertisedAsin) {
      return left.advertisedAsin.localeCompare(right.advertisedAsin, 'en');
    }
    return (left.advertisedSku ?? '').localeCompare(right.advertisedSku ?? '', 'en');
  });
};

export const loadAdsAdvertisedProductIngestGateArtifact = (args: {
  artifactPath?: string;
} = {}): {
  artifactPath: string;
  artifact: AdvertisedProductArtifactEnvelope;
  advertisedProductRows: AdsApiSpAdvertisedProductDailyNormalizedRow[];
} => {
  const artifactPath =
    args.artifactPath ?? ADS_API_SP_ADVERTISED_PRODUCT_DAILY_NORMALIZED_ARTIFACT_PATH;
  const artifact = parseAdvertisedProductNormalizedArtifact(
    readJsonFile(artifactPath),
    artifactPath
  );
  return {
    artifactPath,
    artifact: {
      appAccountId: artifact.appAccountId,
      appMarketplace: artifact.appMarketplace,
      adsApiBaseUrl: artifact.adsApiBaseUrl,
      profileId: artifact.profileId,
      requestedDateRange: artifact.requestedDateRange,
    },
    advertisedProductRows: validateAdvertisedProductRows(
      artifact,
      artifact.rowCount,
      artifact.normalizedAdvertisedProductRows,
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

export const buildAdvertisedProductIngestGateWorkbook = (args: {
  advertisedProductRows: AdsApiSpAdvertisedProductDailyNormalizedRow[];
  gateRunId: string;
}): XLSX.WorkBook => {
  const rows = args.advertisedProductRows.map((row) => ({
    Date: row.date,
    'Campaign ID': row.campaignId,
    'Ad Group ID': row.adGroupId ?? '',
    'Campaign Name': row.campaignName,
    'Ad Group Name': row.adGroupName ?? '',
    'Advertised ASIN': row.advertisedAsin,
    'Advertised SKU': row.advertisedSku ?? '',
    Impressions: row.impressions,
    Clicks: row.clicks,
    Spend: row.cost,
    Sales: row.attributedSales14d,
    Orders: row.attributedConversions14d,
    Units: row.attributedUnitsOrdered14d,
    'Gate Run Id': args.gateRunId,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return workbook;
};

export const writeAdvertisedProductIngestGateWorkbook = (args: {
  tempXlsxPath: string;
  advertisedProductRows: AdsApiSpAdvertisedProductDailyNormalizedRow[];
  gateRunId: string;
}): void => {
  fs.mkdirSync(path.dirname(args.tempXlsxPath), { recursive: true });
  XLSX.writeFile(
    buildAdvertisedProductIngestGateWorkbook({
      advertisedProductRows: args.advertisedProductRows,
      gateRunId: args.gateRunId,
    }),
    args.tempXlsxPath
  );
};

const readFactRowCount = async (args: {
  accountId: string;
  exportedAt: string;
}): Promise<number> => {
  const client = getSupabaseClient();
  const { count, error } = await client
    .from('sp_advertised_product_daily_fact')
    .select('account_id', { count: 'exact', head: true })
    .eq('account_id', args.accountId)
    .eq('exported_at', args.exportedAt);

  if (error) {
    fail(
      'sink_failed',
      `Failed counting advertised product fact rows: ${error.message}`,
      error
    );
  }

  return count ?? 0;
};

export const runAdsApiAdvertisedProductIngestGate = async (args: {
  artifactPath?: string;
  tempXlsxPath?: string;
  gateRunId?: string;
} = {}): Promise<AdsApiAdvertisedProductIngestGateResult> => {
  const gateRunId = args.gateRunId ?? new Date().toISOString();
  const tempXlsxPath =
    args.tempXlsxPath ?? ADS_API_SP_ADVERTISED_PRODUCT_INGEST_GATE_TEMP_XLSX_PATH;
  const { artifact, advertisedProductRows } = loadAdsAdvertisedProductIngestGateArtifact({
    artifactPath: args.artifactPath,
  });

  writeAdvertisedProductIngestGateWorkbook({
    tempXlsxPath,
    advertisedProductRows,
    gateRunId,
  });

  const exportedAt = buildGateExportedAt(artifact.requestedDateRange.endDate, gateRunId);

  try {
    const ingestResult = await ingestSpAdvertisedProductRaw(
      tempXlsxPath,
      artifact.appAccountId,
      exportedAt
    );
    const uploadId =
      ingestResult.uploadId ??
      fail('sink_failed', 'Advertised product ingest sink returned no upload id.');
    const factRows =
      ingestResult.status === 'already ingested'
        ? await readFactRowCount({
            accountId: artifact.appAccountId,
            exportedAt,
          })
        : ingestResult.rowCount ?? 0;

    return {
      appAccountId: artifact.appAccountId,
      appMarketplace: artifact.appMarketplace,
      profileId: artifact.profileId,
      requestedDateRange: artifact.requestedDateRange,
      advertisedProductRowCount: advertisedProductRows.length,
      sinkResult: {
        ingestStatus: ingestResult.status,
        mapStatus: 'not_required',
        uploadId,
        rowCount: ingestResult.rowCount ?? null,
        factRows,
        issueRows: 0,
        coverageStart: ingestResult.coverageStart ?? null,
        coverageEnd: ingestResult.coverageEnd ?? null,
        tempXlsxPath,
      },
    };
  } catch (error) {
    if (error instanceof AdsApiAdvertisedProductIngestGateError) {
      throw error;
    }
    throw new AdsApiAdvertisedProductIngestGateError(
      'sink_failed',
      `Advertised product ingest sink failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      { details: error }
    );
  }
};
