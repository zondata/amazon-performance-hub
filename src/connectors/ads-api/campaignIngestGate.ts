import fs from 'node:fs';
import path from 'node:path';

import { ingestSpCampaignRaw } from '../../ingest/ingestSpCampaignRaw';
import { mapUpload } from '../../mapping/db';
import { ADS_API_PERSISTED_NORMALIZATION_ARTIFACT_PATH } from './adsPersistence';
import {
  AdsApiCampaignIngestGateError,
  type AdsApiCampaignIngestGateResult,
  type AdsApiCampaignIngestGateSinkSummary,
  type AdsApiDateRange,
  type AdsApiPersistedNormalizationArtifact,
  type AdsApiSpCampaignDailyNormalizedRow,
} from './types';

export const ADS_API_SP_CAMPAIGN_INGEST_GATE_TEMP_CSV_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-ingest-gate/sp-campaign-daily.ingest.csv'
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
  throw new AdsApiCampaignIngestGateError(code, message, { details });
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
    readNumber(candidate.campaignRowCount) === null ||
    !Array.isArray(candidate.campaignRows)
  ) {
    fail('artifact_invalid', `Persisted artifact is missing required fields: ${filePath}`);
  }

  return value as AdsApiPersistedNormalizationArtifact;
};

const validateCampaignRows = (
  artifact: AdsApiPersistedNormalizationArtifact,
  filePath: string
): AdsApiSpCampaignDailyNormalizedRow[] => {
  if (artifact.campaignRowCount < 1) {
    fail('invalid_rows', 'Persisted artifact must contain at least 1 campaign row.');
  }

  if (artifact.campaignRows.length < 1) {
    fail('invalid_rows', 'Persisted artifact campaignRows must be non-empty.');
  }

  if (artifact.campaignRowCount !== artifact.campaignRows.length) {
    fail(
      'artifact_invalid',
      `Persisted artifact campaignRowCount does not match campaignRows length: ${filePath}`
    );
  }

  const { appAccountId, appMarketplace, profileId, requestedDateRange } = artifact;
  for (const [index, row] of artifact.campaignRows.entries()) {
    const rowNumber = index + 1;

    if (row.appAccountId !== appAccountId) {
      fail(
        'artifact_mismatch',
        `Campaign row appAccountId mismatch at row ${rowNumber}.`
      );
    }

    if (row.appMarketplace !== appMarketplace) {
      fail(
        'artifact_mismatch',
        `Campaign row appMarketplace mismatch at row ${rowNumber}.`
      );
    }

    if (row.profileId !== profileId) {
      fail('artifact_mismatch', `Campaign row profileId mismatch at row ${rowNumber}.`);
    }

    if (
      row.date < requestedDateRange.startDate ||
      row.date > requestedDateRange.endDate
    ) {
      fail(
        'invalid_rows',
        `Campaign row date is outside the persisted requestedDateRange at row ${rowNumber}.`
      );
    }

    if (!readString(row.campaignId) || !readString(row.campaignName) || !readString(row.date)) {
      fail(
        'invalid_rows',
        `Campaign row is missing required identity fields at row ${rowNumber}.`
      );
    }
  }

  return [...artifact.campaignRows].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    return left.campaignId.localeCompare(right.campaignId, 'en', {
      numeric: true,
    });
  });
};

export const loadAdsCampaignIngestGateArtifact = (args: {
  artifactPath?: string;
} = {}): {
  artifactPath: string;
  artifact: AdsApiPersistedNormalizationArtifact;
  campaignRows: AdsApiSpCampaignDailyNormalizedRow[];
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
    campaignRows: validateCampaignRows(artifact, artifactPath),
  };
};

const escapeCsvField = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

const toCsvNumber = (value: number | null): string =>
  value === null ? '' : String(value);

const buildGateExportedAt = (endDate: string, gateRunId: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(gateRunId)) {
    return `${endDate}T23:59:59.000Z`;
  }

  return `${endDate}${gateRunId.slice(10)}`;
};

export const buildCampaignIngestGateCsv = (args: {
  campaignRows: AdsApiSpCampaignDailyNormalizedRow[];
  gateRunId: string;
}): string => {
  const lines = [
    [
      'Date',
      'End Date',
      'Start Time',
      'Campaign Name',
      'Impressions',
      'Clicks',
      'Spend',
      'Sales',
      'Orders',
      'Units',
      'Gate Run Id',
    ].join(','),
  ];

  for (const row of args.campaignRows) {
    lines.push(
      [
        row.date,
        row.date,
        '',
        escapeCsvField(row.campaignName),
        toCsvNumber(row.impressions),
        toCsvNumber(row.clicks),
        toCsvNumber(row.cost),
        toCsvNumber(row.attributedSales14d),
        toCsvNumber(row.attributedConversions14d),
        '',
        escapeCsvField(args.gateRunId),
      ].join(',')
    );
  }

  return `${lines.join('\n')}\n`;
};

export const writeCampaignIngestGateCsv = (args: {
  campaignRows: AdsApiSpCampaignDailyNormalizedRow[];
  tempCsvPath?: string;
  gateRunId?: string;
}) => {
  const gateRunId = args.gateRunId ?? new Date().toISOString();
  const tempCsvPath =
    args.tempCsvPath ?? ADS_API_SP_CAMPAIGN_INGEST_GATE_TEMP_CSV_PATH;

  fs.mkdirSync(path.dirname(tempCsvPath), { recursive: true });
  fs.writeFileSync(
    tempCsvPath,
    buildCampaignIngestGateCsv({
      campaignRows: args.campaignRows,
      gateRunId,
    }),
    'utf8'
  );

  return {
    gateRunId,
    tempCsvPath,
  };
};

const buildSinkSummary = (args: {
  ingestResult: Awaited<ReturnType<typeof ingestSpCampaignRaw>>;
  mapResult: Awaited<ReturnType<typeof mapUpload>>;
  tempCsvPath: string;
  uploadId: string;
}): AdsApiCampaignIngestGateSinkSummary => ({
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

export const runAdsApiCampaignIngestGate = async (args: {
  artifactPath?: string;
  tempCsvPath?: string;
  gateRunId?: string;
} = {}): Promise<AdsApiCampaignIngestGateResult> => {
  const { artifact, campaignRows } = loadAdsCampaignIngestGateArtifact({
    artifactPath: args.artifactPath,
  });
  const csv = writeCampaignIngestGateCsv({
    campaignRows,
    tempCsvPath: args.tempCsvPath,
    gateRunId: args.gateRunId,
  });
  const exportedAt = buildGateExportedAt(
    artifact.requestedDateRange.endDate,
    csv.gateRunId
  );

  try {
    const ingestResult = await ingestSpCampaignRaw(
      csv.tempCsvPath,
      artifact.appAccountId,
      exportedAt
    );

    const uploadId = requireString(
      ingestResult.uploadId,
      'sink_failed',
      'Campaign ingest sink did not return an uploadId for the gate run.',
      ingestResult
    );

    const mapResult = await mapUpload(uploadId, 'sp_campaign');
    if (mapResult.status !== 'ok') {
      fail(
        'sink_failed',
        `Campaign ingest mapping did not succeed: ${mapResult.status}`,
        mapResult
      );
    }

    if (mapResult.factRows < 1) {
      fail(
        'sink_failed',
        'Campaign ingest gate completed without writing any fact rows.',
        mapResult
      );
    }

    return {
      appAccountId: artifact.appAccountId,
      appMarketplace: artifact.appMarketplace,
      profileId: artifact.profileId,
      requestedDateRange: artifact.requestedDateRange,
      campaignRowCount: campaignRows.length,
      sinkResult: buildSinkSummary({
        ingestResult,
        mapResult,
        tempCsvPath: csv.tempCsvPath,
        uploadId,
      }),
    };
  } catch (error) {
    if (error instanceof AdsApiCampaignIngestGateError) {
      throw error;
    }

    fail(
      'sink_failed',
      error instanceof Error
        ? `Campaign ingest sink failed: ${error.message}`
        : 'Campaign ingest sink failed due to an unknown error.',
      error
    );
  }

  throw new Error('Unreachable campaign ingest gate state.');
};
