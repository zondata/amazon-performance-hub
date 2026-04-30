import fs from 'node:fs';
import path from 'node:path';

import {
  ADS_API_SP_CAMPAIGN_DAILY_NORMALIZED_ARTIFACT_PATH,
  ADS_API_SP_CAMPAIGN_DAILY_RAW_ARTIFACT_PATH,
} from './spCampaignDaily';
import {
  ADS_API_SP_PLACEMENT_DAILY_NORMALIZED_ARTIFACT_PATH,
  ADS_API_SP_PLACEMENT_DAILY_RAW_ARTIFACT_PATH,
} from './spPlacementDaily';
import {
  ADS_API_SP_TARGET_DAILY_NORMALIZED_ARTIFACT_PATH,
  ADS_API_SP_TARGET_DAILY_RAW_ARTIFACT_PATH,
} from './spTargetDaily';
import {
  AdsApiPersistenceError,
  type AdsApiDateRange,
  type AdsApiPersistedLandingArtifact,
  type AdsApiPersistedNormalizationArtifact,
  type AdsApiPersistenceSources,
  type AdsApiSpCampaignDailyNormalizedArtifact,
  type AdsApiSpCampaignDailyNormalizedRow,
  type AdsApiSpCampaignDailyRawArtifact,
  type AdsApiSpDailySummaryRow,
  type AdsApiSpPlacementDailyNormalizedArtifact,
  type AdsApiSpPlacementDailyNormalizedRow,
  type AdsApiSpPlacementDailyRawArtifact,
  type AdsApiSpTargetDailyNormalizedArtifact,
  type AdsApiSpTargetDailyNormalizedRow,
  type AdsApiSpTargetDailyRawArtifact,
} from './types';

export const ADS_API_PERSISTED_LANDING_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-persisted/raw/ads-sp-daily.landed.json'
);

export const ADS_API_PERSISTED_NORMALIZATION_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-persisted/normalized/ads-sp-daily.persisted.json'
);

export const DEFAULT_ADS_PERSISTENCE_SOURCES: AdsApiPersistenceSources = {
  campaignRawArtifactPath: ADS_API_SP_CAMPAIGN_DAILY_RAW_ARTIFACT_PATH,
  campaignNormalizedArtifactPath: ADS_API_SP_CAMPAIGN_DAILY_NORMALIZED_ARTIFACT_PATH,
  targetRawArtifactPath: ADS_API_SP_TARGET_DAILY_RAW_ARTIFACT_PATH,
  targetNormalizedArtifactPath: ADS_API_SP_TARGET_DAILY_NORMALIZED_ARTIFACT_PATH,
  placementRawArtifactPath: ADS_API_SP_PLACEMENT_DAILY_RAW_ARTIFACT_PATH,
  placementNormalizedArtifactPath: ADS_API_SP_PLACEMENT_DAILY_NORMALIZED_ARTIFACT_PATH,
};

type SharedMetadata = {
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
};

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

const isDateRange = (value: unknown): value is AdsApiDateRange =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  readString((value as Record<string, unknown>).startDate) !== null &&
  readString((value as Record<string, unknown>).endDate) !== null;

const fail = (
  code: 'artifact_missing' | 'artifact_invalid' | 'artifact_mismatch' | 'invalid_rows',
  message: string,
  details?: unknown
): never => {
  throw new AdsApiPersistenceError(code, message, { details });
};

const readJsonFile = (filePath: string): unknown => {
  if (!fs.existsSync(filePath)) {
    fail('artifact_missing', `Missing required local artifact: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail('artifact_invalid', `Artifact is not valid JSON: ${filePath}`, error);
  }
};

const parseCampaignRawArtifact = (
  value: unknown,
  filePath: string
): AdsApiSpCampaignDailyRawArtifact => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('artifact_invalid', `Campaign raw artifact is invalid: ${filePath}`);
  }

  const candidate = value as Record<string, unknown>;
  if (
    readString(candidate.schemaVersion) !== 'ads-api-sp-campaign-daily-raw/v1' ||
    readString(candidate.appAccountId) === null ||
    readString(candidate.appMarketplace) === null ||
    readString(candidate.adsApiBaseUrl) === null ||
    readString(candidate.profileId) === null ||
    !isDateRange(candidate.requestedDateRange) ||
    !candidate.reportMetadata ||
    !candidate.rawRowsPayload ||
    typeof candidate.rawRowsPayload !== 'object' ||
    Array.isArray(candidate.rawRowsPayload) ||
    !Array.isArray((candidate.rawRowsPayload as Record<string, unknown>).rows)
  ) {
    fail('artifact_invalid', `Campaign raw artifact is missing required fields: ${filePath}`);
  }

  return value as AdsApiSpCampaignDailyRawArtifact;
};

const parseCampaignNormalizedArtifact = (
  value: unknown,
  filePath: string
): AdsApiSpCampaignDailyNormalizedArtifact => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('artifact_invalid', `Campaign normalized artifact is invalid: ${filePath}`);
  }

  const candidate = value as Record<string, unknown>;
  if (
    readString(candidate.schemaVersion) !==
      'ads-api-sp-campaign-daily-normalized/v1' ||
    readString(candidate.appAccountId) === null ||
    readString(candidate.appMarketplace) === null ||
    readString(candidate.adsApiBaseUrl) === null ||
    readString(candidate.profileId) === null ||
    !isDateRange(candidate.requestedDateRange) ||
    readNumber(candidate.rowCount) === null ||
    !Array.isArray(candidate.normalizedCampaignRows)
  ) {
    fail(
      'artifact_invalid',
      `Campaign normalized artifact is missing required fields: ${filePath}`
    );
  }

  return value as AdsApiSpCampaignDailyNormalizedArtifact;
};

const parseTargetRawArtifact = (
  value: unknown,
  filePath: string
): AdsApiSpTargetDailyRawArtifact => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('artifact_invalid', `Target raw artifact is invalid: ${filePath}`);
  }

  const candidate = value as Record<string, unknown>;
  if (
    readString(candidate.schemaVersion) !== 'ads-api-sp-target-daily-raw/v1' ||
    readString(candidate.appAccountId) === null ||
    readString(candidate.appMarketplace) === null ||
    readString(candidate.adsApiBaseUrl) === null ||
    readString(candidate.profileId) === null ||
    !isDateRange(candidate.requestedDateRange) ||
    !candidate.reportMetadata ||
    !candidate.rawRowsPayload ||
    typeof candidate.rawRowsPayload !== 'object' ||
    Array.isArray(candidate.rawRowsPayload) ||
    !Array.isArray((candidate.rawRowsPayload as Record<string, unknown>).rows)
  ) {
    fail('artifact_invalid', `Target raw artifact is missing required fields: ${filePath}`);
  }

  return value as AdsApiSpTargetDailyRawArtifact;
};

const parseTargetNormalizedArtifact = (
  value: unknown,
  filePath: string
): AdsApiSpTargetDailyNormalizedArtifact => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('artifact_invalid', `Target normalized artifact is invalid: ${filePath}`);
  }

  const candidate = value as Record<string, unknown>;
  if (
    readString(candidate.schemaVersion) !== 'ads-api-sp-target-daily-normalized/v1' ||
    readString(candidate.appAccountId) === null ||
    readString(candidate.appMarketplace) === null ||
    readString(candidate.adsApiBaseUrl) === null ||
    readString(candidate.profileId) === null ||
    !isDateRange(candidate.requestedDateRange) ||
    readNumber(candidate.rowCount) === null ||
    !Array.isArray(candidate.normalizedTargetRows)
  ) {
    fail(
      'artifact_invalid',
      `Target normalized artifact is missing required fields: ${filePath}`
    );
  }

  return value as AdsApiSpTargetDailyNormalizedArtifact;
};

const parsePlacementRawArtifact = (
  value: unknown,
  filePath: string
): AdsApiSpPlacementDailyRawArtifact => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('artifact_invalid', `Placement raw artifact is invalid: ${filePath}`);
  }

  const candidate = value as Record<string, unknown>;
  if (
    readString(candidate.schemaVersion) !== 'ads-api-sp-placement-daily-raw/v1' ||
    readString(candidate.appAccountId) === null ||
    readString(candidate.appMarketplace) === null ||
    readString(candidate.adsApiBaseUrl) === null ||
    readString(candidate.profileId) === null ||
    !isDateRange(candidate.requestedDateRange) ||
    !candidate.reportMetadata ||
    !candidate.rawRowsPayload ||
    typeof candidate.rawRowsPayload !== 'object' ||
    Array.isArray(candidate.rawRowsPayload) ||
    !Array.isArray((candidate.rawRowsPayload as Record<string, unknown>).rows)
  ) {
    fail('artifact_invalid', `Placement raw artifact is missing required fields: ${filePath}`);
  }

  return value as AdsApiSpPlacementDailyRawArtifact;
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

const sameDateRange = (left: AdsApiDateRange, right: AdsApiDateRange): boolean =>
  left.startDate === right.startDate && left.endDate === right.endDate;

const assertSharedMetadata = (
  label: string,
  expected: SharedMetadata,
  actual: SharedMetadata
): void => {
  if (actual.appAccountId !== expected.appAccountId) {
    fail(
      'artifact_mismatch',
      `${label} appAccountId does not match the other artifacts.`
    );
  }

  if (actual.appMarketplace !== expected.appMarketplace) {
    fail(
      'artifact_mismatch',
      `${label} appMarketplace does not match the other artifacts.`
    );
  }

  if (actual.adsApiBaseUrl !== expected.adsApiBaseUrl) {
    fail(
      'artifact_mismatch',
      `${label} adsApiBaseUrl does not match the other artifacts.`
    );
  }

  if (actual.profileId !== expected.profileId) {
    fail(
      'artifact_mismatch',
      `${label} profileId does not match the other artifacts.`
    );
  }

  if (!sameDateRange(actual.requestedDateRange, expected.requestedDateRange)) {
    fail(
      'artifact_mismatch',
      `${label} requestedDateRange does not match the other artifacts.`
    );
  }
};

const toSharedMetadata = (artifact: SharedMetadata): SharedMetadata => ({
  appAccountId: artifact.appAccountId,
  appMarketplace: artifact.appMarketplace,
  adsApiBaseUrl: artifact.adsApiBaseUrl,
  profileId: artifact.profileId,
  requestedDateRange: artifact.requestedDateRange,
});

const sortCampaignRows = (
  rows: AdsApiSpCampaignDailyNormalizedRow[]
): AdsApiSpCampaignDailyNormalizedRow[] =>
  [...rows].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    return left.campaignId.localeCompare(right.campaignId, 'en', {
      numeric: true,
    });
  });

const sortTargetRows = (
  rows: AdsApiSpTargetDailyNormalizedRow[]
): AdsApiSpTargetDailyNormalizedRow[] =>
  [...rows].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    return left.targetId.localeCompare(right.targetId, 'en', {
      numeric: true,
    });
  });

const sortPlacementRows = (
  rows: AdsApiSpPlacementDailyNormalizedRow[]
): AdsApiSpPlacementDailyNormalizedRow[] =>
  [...rows].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }
    if (left.campaignId !== right.campaignId) {
      return left.campaignId.localeCompare(right.campaignId, 'en', {
        numeric: true,
      });
    }
    return left.placementRaw.localeCompare(right.placementRaw, 'en');
  });

export const buildAdsPersistenceDailySummary = (args: {
  campaignRows: AdsApiSpCampaignDailyNormalizedRow[];
  targetRows: AdsApiSpTargetDailyNormalizedRow[];
  placementRows: AdsApiSpPlacementDailyNormalizedRow[];
}): AdsApiSpDailySummaryRow[] => {
  const summaryByDate = new Map<string, AdsApiSpDailySummaryRow>();

  const ensure = (date: string): AdsApiSpDailySummaryRow => {
    const existing = summaryByDate.get(date);
    if (existing) {
      return existing;
    }

    const created: AdsApiSpDailySummaryRow = {
      date,
      campaignRowCount: 0,
      targetRowCount: 0,
      placementRowCount: 0,
      campaignImpressions: 0,
      campaignClicks: 0,
      campaignCost: 0,
      campaignAttributedSales14d: 0,
      campaignAttributedConversions14d: 0,
      targetImpressions: 0,
      targetClicks: 0,
      targetCost: 0,
      targetAttributedSales14d: 0,
      targetAttributedConversions14d: 0,
      placementImpressions: 0,
      placementClicks: 0,
      placementCost: 0,
      placementAttributedSales14d: 0,
      placementAttributedConversions14d: 0,
    };
    summaryByDate.set(date, created);
    return created;
  };

  for (const row of args.campaignRows) {
    const summary = ensure(row.date);
    summary.campaignRowCount += 1;
    summary.campaignImpressions += row.impressions;
    summary.campaignClicks += row.clicks;
    summary.campaignCost += row.cost;
    summary.campaignAttributedSales14d += row.attributedSales14d;
    summary.campaignAttributedConversions14d += row.attributedConversions14d;
  }

  for (const row of args.targetRows) {
    const summary = ensure(row.date);
    summary.targetRowCount += 1;
    summary.targetImpressions += row.impressions;
    summary.targetClicks += row.clicks;
    summary.targetCost += row.cost;
    summary.targetAttributedSales14d += row.attributedSales14d;
    summary.targetAttributedConversions14d += row.attributedConversions14d;
  }

  for (const row of args.placementRows) {
    const summary = ensure(row.date);
    summary.placementRowCount += 1;
    summary.placementImpressions += row.impressions;
    summary.placementClicks += row.clicks;
    summary.placementCost += row.cost;
    summary.placementAttributedSales14d += row.attributedSales14d;
    summary.placementAttributedConversions14d += row.attributedConversions14d;
  }

  return [...summaryByDate.values()].sort((left, right) =>
    left.date.localeCompare(right.date)
  );
};

export const loadAdsPersistenceInputs = (args: {
  sources?: Partial<AdsApiPersistenceSources>;
} = {}) => {
  const sources: AdsApiPersistenceSources = {
    ...DEFAULT_ADS_PERSISTENCE_SOURCES,
    ...args.sources,
  };

  const campaignRaw = parseCampaignRawArtifact(
    readJsonFile(sources.campaignRawArtifactPath),
    sources.campaignRawArtifactPath
  );
  const campaignNormalized = parseCampaignNormalizedArtifact(
    readJsonFile(sources.campaignNormalizedArtifactPath),
    sources.campaignNormalizedArtifactPath
  );
  const targetRaw = parseTargetRawArtifact(
    readJsonFile(sources.targetRawArtifactPath),
    sources.targetRawArtifactPath
  );
  const targetNormalized = parseTargetNormalizedArtifact(
    readJsonFile(sources.targetNormalizedArtifactPath),
    sources.targetNormalizedArtifactPath
  );
  const placementRaw = parsePlacementRawArtifact(
    readJsonFile(sources.placementRawArtifactPath),
    sources.placementRawArtifactPath
  );
  const placementNormalized = parsePlacementNormalizedArtifact(
    readJsonFile(sources.placementNormalizedArtifactPath),
    sources.placementNormalizedArtifactPath
  );

  const expectedMetadata = toSharedMetadata(campaignRaw);
  assertSharedMetadata('Campaign normalized artifact', expectedMetadata, campaignNormalized);
  assertSharedMetadata('Target raw artifact', expectedMetadata, targetRaw);
  assertSharedMetadata('Target normalized artifact', expectedMetadata, targetNormalized);
  assertSharedMetadata('Placement raw artifact', expectedMetadata, placementRaw);
  assertSharedMetadata(
    'Placement normalized artifact',
    expectedMetadata,
    placementNormalized
  );

  if (campaignNormalized.rowCount < 1) {
    fail(
      'invalid_rows',
      'Campaign normalized artifact must contain at least 1 row.'
    );
  }

  if (targetNormalized.rowCount < 1) {
    fail(
      'invalid_rows',
      'Target normalized artifact must contain at least 1 row.'
    );
  }

  if (placementNormalized.rowCount < 1) {
    fail(
      'invalid_rows',
      'Placement normalized artifact must contain at least 1 row.'
    );
  }

  return {
    sources,
    sharedMetadata: expectedMetadata,
    campaignRaw,
    campaignNormalized,
    targetRaw,
    targetNormalized,
    placementRaw,
    placementNormalized,
  };
};

export const buildAdsPersistedLandingArtifact = (args: {
  generatedAt?: string;
  sources: AdsApiPersistenceSources;
  campaignRaw: AdsApiSpCampaignDailyRawArtifact;
  targetRaw: AdsApiSpTargetDailyRawArtifact;
  placementRaw: AdsApiSpPlacementDailyRawArtifact;
}): AdsApiPersistedLandingArtifact => ({
  schemaVersion: 'ads-api-sp-daily-landed/v1',
  generatedAt: args.generatedAt ?? new Date().toISOString(),
  appAccountId: args.campaignRaw.appAccountId,
  appMarketplace: args.campaignRaw.appMarketplace,
  adsApiBaseUrl: args.campaignRaw.adsApiBaseUrl,
  profileId: args.campaignRaw.profileId,
  requestedDateRange: args.campaignRaw.requestedDateRange,
  sources: args.sources,
  campaignRaw: args.campaignRaw,
  targetRaw: args.targetRaw,
  placementRaw: args.placementRaw,
});

export const buildAdsPersistedNormalizationArtifact = (args: {
  generatedAt?: string;
  campaignNormalized: AdsApiSpCampaignDailyNormalizedArtifact;
  targetNormalized: AdsApiSpTargetDailyNormalizedArtifact;
  placementNormalized: AdsApiSpPlacementDailyNormalizedArtifact;
}): AdsApiPersistedNormalizationArtifact => {
  const campaignRows = sortCampaignRows(
    args.campaignNormalized.normalizedCampaignRows
  );
  const targetRows = sortTargetRows(args.targetNormalized.normalizedTargetRows);
  const placementRows = sortPlacementRows(
    args.placementNormalized.normalizedPlacementRows
  );

  return {
    schemaVersion: 'ads-api-sp-daily-persisted/v1',
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    appAccountId: args.campaignNormalized.appAccountId,
    appMarketplace: args.campaignNormalized.appMarketplace,
    adsApiBaseUrl: args.campaignNormalized.adsApiBaseUrl,
    profileId: args.campaignNormalized.profileId,
    requestedDateRange: args.campaignNormalized.requestedDateRange,
    campaignRowCount: campaignRows.length,
    targetRowCount: targetRows.length,
    placementRowCount: placementRows.length,
    campaignRows,
    targetRows,
    placementRows,
    dailySummary: buildAdsPersistenceDailySummary({
      campaignRows,
      targetRows,
      placementRows,
    }),
  };
};

export const writeAdsPersistenceArtifacts = (args: {
  landedArtifact: AdsApiPersistedLandingArtifact;
  persistedArtifact: AdsApiPersistedNormalizationArtifact;
  landingArtifactPath?: string;
  normalizationArtifactPath?: string;
}) => {
  const landingArtifactPath =
    args.landingArtifactPath ?? ADS_API_PERSISTED_LANDING_ARTIFACT_PATH;
  const normalizationArtifactPath =
    args.normalizationArtifactPath ??
    ADS_API_PERSISTED_NORMALIZATION_ARTIFACT_PATH;

  fs.mkdirSync(path.dirname(landingArtifactPath), { recursive: true });
  fs.mkdirSync(path.dirname(normalizationArtifactPath), { recursive: true });

  fs.writeFileSync(
    landingArtifactPath,
    `${JSON.stringify(args.landedArtifact, null, 2)}\n`
  );
  fs.writeFileSync(
    normalizationArtifactPath,
    `${JSON.stringify(args.persistedArtifact, null, 2)}\n`
  );

  return {
    landingArtifactPath,
    normalizationArtifactPath,
  };
};

export const runAdsPersistence = (args: {
  sources?: Partial<AdsApiPersistenceSources>;
  landingArtifactPath?: string;
  normalizationArtifactPath?: string;
  generatedAt?: string;
}) => {
  const inputs = loadAdsPersistenceInputs({
    sources: args.sources,
  });

  const landedArtifact = buildAdsPersistedLandingArtifact({
    generatedAt: args.generatedAt,
    sources: inputs.sources,
    campaignRaw: inputs.campaignRaw,
    targetRaw: inputs.targetRaw,
    placementRaw: inputs.placementRaw,
  });

  const persistedArtifact = buildAdsPersistedNormalizationArtifact({
    generatedAt: args.generatedAt,
    campaignNormalized: inputs.campaignNormalized,
    targetNormalized: inputs.targetNormalized,
    placementNormalized: inputs.placementNormalized,
  });

  const paths = writeAdsPersistenceArtifacts({
    landedArtifact,
    persistedArtifact,
    landingArtifactPath: args.landingArtifactPath,
    normalizationArtifactPath: args.normalizationArtifactPath,
  });

  return {
    sharedMetadata: inputs.sharedMetadata,
    landedArtifact,
    persistedArtifact,
    landingArtifactPath: paths.landingArtifactPath,
    normalizationArtifactPath: paths.normalizationArtifactPath,
  };
};
