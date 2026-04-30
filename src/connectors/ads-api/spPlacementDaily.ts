import fs from 'node:fs';
import path from 'node:path';

import {
  ADS_API_PROFILE_SYNC_ARTIFACT_PATH,
  adsApiDownloadTransport,
  buildAdsApiDateRange,
  parseSpCampaignDailyDownloadedRows,
} from './spCampaignDaily';
import {
  buildSpTargetDailyHeaders,
  buildSpTargetDailyStatusRequest,
  parseSpTargetDailyReportMetadata,
} from './spTargetDaily';
import {
  AdsApiSpPlacementDailyError,
  type AdsApiDateRange,
  type AdsApiDownloadTransport,
  type AdsApiProfileSyncEnvConfig,
  type AdsApiProfilesSyncArtifact,
  type AdsApiSpPlacementDailyCreateRequest,
  type AdsApiSpPlacementDailyNormalizedArtifact,
  type AdsApiSpPlacementDailyNormalizedRow,
  type AdsApiSpPlacementDailyRawArtifact,
  type AdsApiSpPlacementDailyRawPayload,
  type AdsApiSpPlacementDailyReportMetadata,
  type AdsApiTransport,
  type AdsApiTransportRequest,
  type AdsApiValidatedProfileSyncArtifact,
} from './types';

export { adsApiDownloadTransport, buildAdsApiDateRange };

export const ADS_API_SP_PLACEMENT_DAILY_RAW_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-sp-placement-daily/raw/sp-placement-daily.raw.json'
);

export const ADS_API_SP_PLACEMENT_DAILY_NORMALIZED_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-sp-placement-daily/normalized/sp-placement-daily.normalized.json'
);

const REPORTING_REPORTS_PATH = '/reporting/reports';
const SP_PLACEMENT_REPORT_COLUMNS = [
  'campaignId',
  'campaignName',
  'campaignBiddingStrategy',
  'placementClassification',
  'campaignBudgetCurrencyCode',
  'date',
  'impressions',
  'clicks',
  'cost',
  'sales14d',
  'purchases14d',
  'unitsSoldClicks14d',
  'costPerClick',
  'clickThroughRate',
] as const;

export const MAX_SP_PLACEMENT_DAILY_WINDOW_DAYS = 31;
export const DEFAULT_SP_PLACEMENT_DAILY_MAX_ATTEMPTS = 180;
export const DEFAULT_SP_PLACEMENT_DAILY_POLL_INTERVAL_MS = 5000;
export const TERMINAL_SP_PLACEMENT_DAILY_SUCCESS_STATUSES = [
  'SUCCESS',
  'COMPLETED',
  'DONE',
] as const;
export const TERMINAL_SP_PLACEMENT_DAILY_FAILURE_STATUSES = [
  'FAILURE',
  'FAILED',
  'CANCELLED',
  'CANCELED',
] as const;
export const POLLABLE_SP_PLACEMENT_DAILY_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'PROCESSING',
  'QUEUED',
] as const;

type SpPlacementDailyPendingRequestRecord = {
  reportId: string;
  status: string | null;
  statusDetails: string | null;
  attemptCount: number;
  diagnosticPath: string | null;
  lastResponseJson: Record<string, unknown>;
};

type SpPlacementDailyPendingRequestState = {
  reportId: string;
  status:
    | 'completed'
    | 'created'
    | 'failed'
    | 'imported'
    | 'pending'
    | 'pending_timeout'
    | 'polling'
    | 'requested'
    | 'stale_expired';
  statusDetails: string | null;
  attemptCount: number;
  requestPayloadJson: Record<string, unknown>;
  lastResponseJson: Record<string, unknown>;
  diagnosticPath: string | null;
  notes: string | null;
  retryAfterAt: string | null;
  lastPolledAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
};

export interface SpPlacementDailyPendingRequestStore {
  findReusablePendingRequest(args: {
    accountId: string;
    marketplace: string;
    profileId: string;
    reportTypeId: string;
    sourceType: string;
    startDate: string;
    endDate: string;
  }): Promise<SpPlacementDailyPendingRequestRecord | null>;
  upsertPendingRequest(args: {
    accountId: string;
    marketplace: string;
    profileId: string;
    adProduct: string;
    reportTypeId: string;
    sourceType: string;
    targetTable: string;
    startDate: string;
    endDate: string;
    state: SpPlacementDailyPendingRequestState;
  }): Promise<void>;
}

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readStringLike = (value: unknown): string | null => {
  const asString = readString(value);
  if (asString) return asString;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/[$,%\s,]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseProfileSyncArtifact = (
  value: unknown
): AdsApiProfilesSyncArtifact | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const schemaVersion = readString(candidate.schemaVersion);
  const generatedAt = readString(candidate.generatedAt);
  const appAccountId = readString(candidate.appAccountId);
  const appMarketplace = readString(candidate.appMarketplace);
  const adsApiBaseUrl = readString(candidate.adsApiBaseUrl);
  const configuredProfileId = readString(candidate.configuredProfileId);
  const profileCount = readNumber(candidate.profileCount);

  if (
    schemaVersion !== 'ads-api-profile-sync/v1' ||
    !generatedAt ||
    !appAccountId ||
    !appMarketplace ||
    !adsApiBaseUrl ||
    !configuredProfileId ||
    profileCount === null ||
    !candidate.selectedProfile ||
    !Array.isArray(candidate.profilesSummary)
  ) {
    return null;
  }

  return candidate as AdsApiProfilesSyncArtifact;
};

export const validateProfileSyncArtifactForSpPlacementDaily = (args: {
  config: AdsApiProfileSyncEnvConfig;
  artifactPath?: string;
}): AdsApiValidatedProfileSyncArtifact => {
  const artifactPath = args.artifactPath ?? ADS_API_PROFILE_SYNC_ARTIFACT_PATH;
  if (!fs.existsSync(artifactPath)) {
    throw new AdsApiSpPlacementDailyError(
      'profile_sync_artifact_missing',
      `Missing profile-sync artifact: ${artifactPath}`
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  } catch (error) {
    throw new AdsApiSpPlacementDailyError(
      'profile_sync_artifact_invalid',
      'Profile-sync artifact is not valid JSON.',
      { details: error }
    );
  }

  const artifact = parseProfileSyncArtifact(parsedJson);
  if (!artifact) {
    throw new AdsApiSpPlacementDailyError(
      'profile_sync_artifact_invalid',
      'Profile-sync artifact is missing required fields.'
    );
  }

  if (artifact.appAccountId !== args.config.appAccountId) {
    throw new AdsApiSpPlacementDailyError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact appAccountId does not match APP_ACCOUNT_ID.'
    );
  }
  if (artifact.appMarketplace !== args.config.appMarketplace) {
    throw new AdsApiSpPlacementDailyError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact appMarketplace does not match APP_MARKETPLACE.'
    );
  }
  if (artifact.adsApiBaseUrl !== args.config.apiBaseUrl) {
    throw new AdsApiSpPlacementDailyError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact adsApiBaseUrl does not match AMAZON_ADS_API_BASE_URL.'
    );
  }
  if (artifact.selectedProfile.profileId !== args.config.profileId) {
    throw new AdsApiSpPlacementDailyError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact selectedProfile.profileId does not match AMAZON_ADS_PROFILE_ID.'
    );
  }

  return artifact as AdsApiValidatedProfileSyncArtifact;
};

export const buildSpPlacementDailyCreateRequestBody = (args: {
  dateRange: AdsApiDateRange;
}): AdsApiSpPlacementDailyCreateRequest => ({
  name: `sp-placement-daily-${args.dateRange.startDate}-${args.dateRange.endDate}`,
  startDate: args.dateRange.startDate,
  endDate: args.dateRange.endDate,
  configuration: {
    adProduct: 'SPONSORED_PRODUCTS',
    groupBy: ['campaign', 'campaignPlacement'],
    columns: [...SP_PLACEMENT_REPORT_COLUMNS],
    reportTypeId: 'spCampaigns',
    timeUnit: 'DAILY',
    format: 'GZIP_JSON',
  },
});

export const buildSpPlacementDailyCreateRequest = (args: {
  config: AdsApiProfileSyncEnvConfig;
  accessToken: string;
  dateRange: AdsApiDateRange;
}): AdsApiTransportRequest => ({
  url: `${args.config.apiBaseUrl}${REPORTING_REPORTS_PATH}`,
  method: 'POST',
  headers: buildSpTargetDailyHeaders({
    config: args.config,
    accessToken: args.accessToken,
    contentType: 'application/json',
  }),
  body: JSON.stringify(buildSpPlacementDailyCreateRequestBody({ dateRange: args.dateRange })),
});

const normalizeReportError = (
  code:
    | 'invalid_date'
    | 'profile_sync_artifact_missing'
    | 'profile_sync_artifact_invalid'
    | 'profile_sync_artifact_mismatch'
    | 'transport_error'
    | 'report_request_failed'
    | 'invalid_response'
    | 'report_timeout'
    | 'pending_timeout'
    | 'report_failed'
    | 'download_failed',
  message: string,
  options: { status?: number; details?: unknown } = {}
) => new AdsApiSpPlacementDailyError(code, message, options);

const isSuccessStatus = (status: string | null): boolean =>
  status != null &&
  (TERMINAL_SP_PLACEMENT_DAILY_SUCCESS_STATUSES as readonly string[]).includes(status);

const isFailureStatus = (status: string | null): boolean =>
  status != null &&
  (TERMINAL_SP_PLACEMENT_DAILY_FAILURE_STATUSES as readonly string[]).includes(status);

const toPendingRequestStatus = (
  status: string | null,
  fallback: SpPlacementDailyPendingRequestState['status']
): SpPlacementDailyPendingRequestState['status'] => {
  const normalized = status?.toUpperCase() ?? null;
  if (isSuccessStatus(normalized)) return 'completed';
  if (isFailureStatus(normalized)) return 'failed';
  if (
    normalized &&
    (POLLABLE_SP_PLACEMENT_DAILY_STATUSES as readonly string[]).includes(normalized)
  ) {
    return normalized === 'PENDING' ? 'pending' : 'polling';
  }
  return fallback;
};

const readHeader = (
  headers: Record<string, string | null> | undefined,
  name: string
): string | null => headers?.[name.toLowerCase()] ?? null;

export const requestSpPlacementDailyReport = async (args: {
  config: AdsApiProfileSyncEnvConfig;
  accessToken: string;
  dateRange: AdsApiDateRange;
  transport: AdsApiTransport;
  maxAttempts?: number;
  pollIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  pendingStore?: SpPlacementDailyPendingRequestStore | null;
  resumePendingOnly?: boolean;
  diagnosticPath?: string | null;
}): Promise<AdsApiSpPlacementDailyReportMetadata> => {
  const maxAttempts = args.maxAttempts ?? DEFAULT_SP_PLACEMENT_DAILY_MAX_ATTEMPTS;
  const pollIntervalMs =
    args.pollIntervalMs ?? DEFAULT_SP_PLACEMENT_DAILY_POLL_INTERVAL_MS;
  const sleep =
    args.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const requestPayload = buildSpPlacementDailyCreateRequestBody({
    dateRange: args.dateRange,
  }) as Record<string, unknown>;
  const sourceType = 'ads_api_sp_placement_daily';
  const targetTable = 'sp_placement_daily_fact';

  const toPendingState = (
    metadata: AdsApiSpPlacementDailyReportMetadata,
    fallback: SpPlacementDailyPendingRequestState['status'],
    attemptCount: number,
    lastResponseJson: Record<string, unknown>,
    retryAfterAt: string | null
  ): SpPlacementDailyPendingRequestState => ({
    reportId: metadata.reportId,
    status: toPendingRequestStatus(metadata.status, fallback),
    statusDetails: metadata.statusDetails,
    attemptCount,
    requestPayloadJson: requestPayload,
    lastResponseJson,
    diagnosticPath: args.diagnosticPath ?? null,
    notes: null,
    retryAfterAt,
    lastPolledAt: new Date().toISOString(),
    completedAt: isSuccessStatus(metadata.status?.toUpperCase() ?? null)
      ? new Date().toISOString()
      : null,
    failedAt: isFailureStatus(metadata.status?.toUpperCase() ?? null)
      ? new Date().toISOString()
      : null,
  });

  const reusablePending =
    (await args.pendingStore?.findReusablePendingRequest({
      accountId: args.config.appAccountId,
      marketplace: args.config.appMarketplace,
      profileId: args.config.profileId,
      reportTypeId: 'spCampaigns',
      sourceType,
      startDate: args.dateRange.startDate,
      endDate: args.dateRange.endDate,
    })) ?? null;

  let metadata: AdsApiSpPlacementDailyReportMetadata;
  let attemptCount = 0;

  if (reusablePending) {
    metadata = {
      reportId: reusablePending.reportId,
      status: reusablePending.status,
      statusDetails: reusablePending.statusDetails,
      location: null,
      fileSize: null,
    };
    attemptCount = Math.max(reusablePending.attemptCount, 0);
  } else {
    if (args.resumePendingOnly) {
      throw normalizeReportError(
        'pending_timeout',
        `No reusable pending SP placement report was found for ${args.dateRange.startDate} -> ${args.dateRange.endDate}.`
      );
    }

    let createResponse;
    try {
      createResponse = await args.transport(
        buildSpPlacementDailyCreateRequest({
          config: args.config,
          accessToken: args.accessToken,
          dateRange: args.dateRange,
        })
      );
    } catch (error) {
      throw normalizeReportError(
        'transport_error',
        'Amazon Ads placement daily report request failed before a response was received.',
        { details: error }
      );
    }

    if (createResponse.status < 200 || createResponse.status >= 300) {
      throw normalizeReportError(
        'report_request_failed',
        `Amazon Ads placement daily report request failed with status ${createResponse.status}`,
        { status: createResponse.status, details: createResponse.json }
      );
    }

    try {
      metadata = parseSpTargetDailyReportMetadata(
        createResponse.json
      ) as AdsApiSpPlacementDailyReportMetadata;
    } catch (error) {
      throw normalizeReportError(
        'invalid_response',
        'Amazon Ads placement daily report request returned an invalid response payload',
        { details: error }
      );
    }

    attemptCount = 1;
    await args.pendingStore?.upsertPendingRequest({
      accountId: args.config.appAccountId,
      marketplace: args.config.appMarketplace,
      profileId: args.config.profileId,
      adProduct: 'SPONSORED_PRODUCTS',
      reportTypeId: 'spCampaigns',
      sourceType,
      targetTable,
      startDate: args.dateRange.startDate,
      endDate: args.dateRange.endDate,
      state: toPendingState(
        metadata,
        'requested',
        attemptCount,
        createResponse.json as Record<string, unknown>,
        null
      ),
    });
  }

  for (let index = 0; index < maxAttempts; index += 1) {
    if (isSuccessStatus(metadata.status?.toUpperCase() ?? null) && metadata.location) {
      await args.pendingStore?.upsertPendingRequest({
        accountId: args.config.appAccountId,
        marketplace: args.config.appMarketplace,
        profileId: args.config.profileId,
        adProduct: 'SPONSORED_PRODUCTS',
        reportTypeId: 'spCampaigns',
        sourceType,
        targetTable,
        startDate: args.dateRange.startDate,
        endDate: args.dateRange.endDate,
        state: toPendingState(metadata, 'completed', attemptCount, {}, null),
      });
      return metadata;
    }

    if (isFailureStatus(metadata.status?.toUpperCase() ?? null)) {
      await args.pendingStore?.upsertPendingRequest({
        accountId: args.config.appAccountId,
        marketplace: args.config.appMarketplace,
        profileId: args.config.profileId,
        adProduct: 'SPONSORED_PRODUCTS',
        reportTypeId: 'spCampaigns',
        sourceType,
        targetTable,
        startDate: args.dateRange.startDate,
        endDate: args.dateRange.endDate,
        state: toPendingState(metadata, 'failed', attemptCount, {}, null),
      });
      throw normalizeReportError(
        'report_failed',
        `Amazon Ads placement daily report failed with status ${metadata.status ?? '(unknown)'}.`,
        { details: metadata }
      );
    }

    if (index > 0 || reusablePending) {
      await sleep(pollIntervalMs);
    }

    let pollResponse;
    try {
      pollResponse = await args.transport(
        buildSpTargetDailyStatusRequest({
          config: args.config,
          accessToken: args.accessToken,
          reportId: metadata.reportId,
        })
      );
    } catch (error) {
      throw normalizeReportError(
        'transport_error',
        'Amazon Ads placement daily report status polling failed before a response was received.',
        { details: error }
      );
    }

    if (pollResponse.status < 200 || pollResponse.status >= 300) {
      throw normalizeReportError(
        'report_request_failed',
        `Amazon Ads placement daily report status polling failed with status ${pollResponse.status}`,
        { status: pollResponse.status, details: pollResponse.json }
      );
    }

    try {
      metadata = parseSpTargetDailyReportMetadata(
        pollResponse.json
      ) as AdsApiSpPlacementDailyReportMetadata;
    } catch (error) {
      throw normalizeReportError(
        'invalid_response',
        'Amazon Ads placement daily report status polling returned an invalid payload',
        { details: error }
      );
    }

    attemptCount += 1;
    const retryAfterHeader = readHeader(pollResponse.headers, 'retry-after');
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const retryAfterAt = Number.isFinite(retryAfterSeconds)
      ? new Date(Date.now() + retryAfterSeconds * 1000).toISOString()
      : null;

    await args.pendingStore?.upsertPendingRequest({
      accountId: args.config.appAccountId,
      marketplace: args.config.appMarketplace,
      profileId: args.config.profileId,
      adProduct: 'SPONSORED_PRODUCTS',
      reportTypeId: 'spCampaigns',
      sourceType,
      targetTable,
      startDate: args.dateRange.startDate,
      endDate: args.dateRange.endDate,
      state: toPendingState(
        metadata,
        metadata.location ? 'completed' : 'polling',
        attemptCount,
        pollResponse.json as Record<string, unknown>,
        retryAfterAt
      ),
    });
  }

  await args.pendingStore?.upsertPendingRequest({
    accountId: args.config.appAccountId,
    marketplace: args.config.appMarketplace,
    profileId: args.config.profileId,
    adProduct: 'SPONSORED_PRODUCTS',
    reportTypeId: 'spCampaigns',
    sourceType,
    targetTable,
    startDate: args.dateRange.startDate,
    endDate: args.dateRange.endDate,
    state: {
      reportId: metadata.reportId,
      status: 'pending_timeout',
      statusDetails: metadata.statusDetails,
      attemptCount,
      requestPayloadJson: requestPayload,
      lastResponseJson: {},
      diagnosticPath: args.diagnosticPath ?? null,
      notes: `Timed out after ${maxAttempts} attempts.`,
      retryAfterAt: null,
      lastPolledAt: new Date().toISOString(),
      completedAt: null,
      failedAt: null,
    },
  });

  throw normalizeReportError(
    'report_timeout',
    `Amazon Ads placement daily report remained pending after ${maxAttempts} attempts.`,
    { details: metadata }
  );
};

export const parseSpPlacementDailyDownloadedRows = (args: {
  body: Buffer;
  headers?: Record<string, string | null>;
}): AdsApiSpPlacementDailyRawPayload =>
  parseSpCampaignDailyDownloadedRows(args) as AdsApiSpPlacementDailyRawPayload;

const requireStringField = (
  row: Record<string, unknown>,
  keys: string[],
  fieldLabel: string
): string => {
  for (const key of keys) {
    const value = readStringLike(row[key]);
    if (value) return value;
  }
  throw normalizeReportError(
    'invalid_response',
    `Downloaded placement daily rows are missing required field ${fieldLabel}`
  );
};

const requireNumberField = (
  row: Record<string, unknown>,
  keys: string[],
  fieldLabel: string
): number => {
  for (const key of keys) {
    const value = readNumber(row[key]);
    if (value !== null) return value;
  }
  throw normalizeReportError(
    'invalid_response',
    `Downloaded placement daily rows are missing required numeric field ${fieldLabel}`
  );
};

const normalizePlacement = (
  value: string
): { placementRaw: string; placementCode: 'OA' | 'PP' | 'ROS' | 'TOS' | 'UNKNOWN' } => {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized.includes('TOP_OF_SEARCH')) {
    return { placementRaw: 'Top of search (first page)', placementCode: 'TOS' };
  }
  if (normalized.includes('PRODUCT_PAGE')) {
    return { placementRaw: 'Product pages', placementCode: 'PP' };
  }
  if (normalized.includes('REST_OF_SEARCH')) {
    return { placementRaw: 'Rest of search', placementCode: 'ROS' };
  }
  if (normalized.includes('OFF_AMAZON')) {
    return { placementRaw: 'Off-Amazon', placementCode: 'OA' };
  }
  return { placementRaw: value.trim(), placementCode: 'UNKNOWN' };
};

export const normalizeSpPlacementDailyRows = (args: {
  rawRowsPayload: AdsApiSpPlacementDailyRawPayload;
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
}): AdsApiSpPlacementDailyNormalizedRow[] => {
  const normalized = args.rawRowsPayload.rows.map((row) => {
    const record = row as Record<string, unknown>;
    const placementClassification = requireStringField(
      record,
      ['placementClassification', 'placement_classification'],
      'placementClassification'
    );
    const placement = normalizePlacement(placementClassification);
    return {
      appAccountId: args.appAccountId,
      appMarketplace: args.appMarketplace,
      profileId: args.profileId,
      campaignId: requireStringField(record, ['campaignId', 'campaign_id'], 'campaignId'),
      campaignName: requireStringField(
        record,
        ['campaignName', 'campaign_name', 'campaign'],
        'campaignName'
      ),
      campaignBiddingStrategy:
        readStringLike(record.campaignBiddingStrategy) ??
        readStringLike(record.campaign_bidding_strategy) ??
        null,
      placementClassification,
      placementRaw: placement.placementRaw,
      placementCode: placement.placementCode,
      date: requireStringField(record, ['date'], 'date'),
      impressions: requireNumberField(record, ['impressions'], 'impressions'),
      clicks: requireNumberField(record, ['clicks'], 'clicks'),
      cost: requireNumberField(record, ['cost', 'spend'], 'cost'),
      attributedSales14d: requireNumberField(record, ['sales14d', 'sales'], 'sales14d'),
      attributedConversions14d: requireNumberField(
        record,
        ['purchases14d', 'orders'],
        'purchases14d'
      ),
      attributedUnitsOrdered14d: requireNumberField(
        record,
        ['unitsSoldClicks14d', 'units'],
        'unitsSoldClicks14d'
      ),
      costPerClick: readNumber(record.costPerClick) ?? readNumber(record.cpc),
      clickThroughRate: readNumber(record.clickThroughRate) ?? readNumber(record.ctr),
      currencyCode:
        readStringLike(record.campaignBudgetCurrencyCode) ??
        readStringLike(record.currencyCode) ??
        null,
    };
  });

  return normalized.sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    if (left.campaignId !== right.campaignId) {
      return left.campaignId.localeCompare(right.campaignId, 'en', {
        numeric: true,
      });
    }
    return left.placementRaw.localeCompare(right.placementRaw, 'en');
  });
};

export const buildSpPlacementDailyRawArtifact = (args: {
  config: AdsApiProfileSyncEnvConfig;
  dateRange: AdsApiDateRange;
  metadata: AdsApiSpPlacementDailyReportMetadata;
  rawRowsPayload: AdsApiSpPlacementDailyRawPayload;
  generatedAt?: string;
}): AdsApiSpPlacementDailyRawArtifact => ({
  schemaVersion: 'ads-api-sp-placement-daily-raw/v1',
  generatedAt: args.generatedAt ?? new Date().toISOString(),
  appAccountId: args.config.appAccountId,
  appMarketplace: args.config.appMarketplace,
  adsApiBaseUrl: args.config.apiBaseUrl,
  profileId: args.config.profileId,
  requestedDateRange: args.dateRange,
  reportMetadata: {
    reportId: args.metadata.reportId,
    status: args.metadata.status,
    statusDetails: args.metadata.statusDetails,
    fileSize: args.metadata.fileSize,
    downloadUrlPresent: !!args.metadata.location,
  },
  rawRowsPayload: args.rawRowsPayload,
});

export const buildSpPlacementDailyNormalizedArtifact = (args: {
  config: AdsApiProfileSyncEnvConfig;
  dateRange: AdsApiDateRange;
  normalizedPlacementRows: AdsApiSpPlacementDailyNormalizedRow[];
  generatedAt?: string;
}): AdsApiSpPlacementDailyNormalizedArtifact => ({
  schemaVersion: 'ads-api-sp-placement-daily-normalized/v1',
  generatedAt: args.generatedAt ?? new Date().toISOString(),
  appAccountId: args.config.appAccountId,
  appMarketplace: args.config.appMarketplace,
  adsApiBaseUrl: args.config.apiBaseUrl,
  profileId: args.config.profileId,
  requestedDateRange: args.dateRange,
  rowCount: args.normalizedPlacementRows.length,
  normalizedPlacementRows: args.normalizedPlacementRows,
});

export const downloadSpPlacementDailyReport = async (args: {
  metadata: AdsApiSpPlacementDailyReportMetadata;
  downloadTransport: AdsApiDownloadTransport;
}): Promise<AdsApiSpPlacementDailyRawPayload> => {
  if (!args.metadata.location) {
    throw normalizeReportError(
      'download_failed',
      'Amazon Ads placement daily report does not include a download URL.'
    );
  }

  let response;
  try {
    response = await args.downloadTransport(args.metadata.location);
  } catch (error) {
    throw normalizeReportError(
      'download_failed',
      'Amazon Ads placement daily report download failed before a response was received.',
      { details: error }
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw normalizeReportError(
      'download_failed',
      `Amazon Ads placement daily report download failed with status ${response.status}`,
      { status: response.status }
    );
  }

  try {
    return parseSpPlacementDailyDownloadedRows({
      body: response.body,
      headers: response.headers,
    });
  } catch (error) {
    if (error instanceof AdsApiSpPlacementDailyError) throw error;
    throw normalizeReportError(
      'invalid_response',
      'Amazon Ads placement daily report download returned an invalid payload',
      { details: error }
    );
  }
};

export const writeSpPlacementDailyArtifacts = (args: {
  rawArtifact: AdsApiSpPlacementDailyRawArtifact;
  normalizedArtifact: AdsApiSpPlacementDailyNormalizedArtifact;
  rawArtifactPath?: string;
  normalizedArtifactPath?: string;
}): { rawArtifactPath: string; normalizedArtifactPath: string } => {
  const rawArtifactPath =
    args.rawArtifactPath ?? ADS_API_SP_PLACEMENT_DAILY_RAW_ARTIFACT_PATH;
  const normalizedArtifactPath =
    args.normalizedArtifactPath ??
    ADS_API_SP_PLACEMENT_DAILY_NORMALIZED_ARTIFACT_PATH;

  fs.mkdirSync(path.dirname(rawArtifactPath), { recursive: true });
  fs.mkdirSync(path.dirname(normalizedArtifactPath), { recursive: true });
  fs.writeFileSync(rawArtifactPath, `${JSON.stringify(args.rawArtifact, null, 2)}\n`);
  fs.writeFileSync(
    normalizedArtifactPath,
    `${JSON.stringify(args.normalizedArtifact, null, 2)}\n`
  );

  return { rawArtifactPath, normalizedArtifactPath };
};

export const runSpPlacementDailyPull = async (args: {
  config: AdsApiProfileSyncEnvConfig;
  accessToken: string;
  dateRange: AdsApiDateRange;
  transport: AdsApiTransport;
  downloadTransport: AdsApiDownloadTransport;
  artifactPath?: string;
  rawArtifactPath?: string;
  normalizedArtifactPath?: string;
  maxAttempts?: number;
  pollIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  generatedAt?: string;
  pendingStore?: SpPlacementDailyPendingRequestStore | null;
  resumePendingOnly?: boolean;
  diagnosticPath?: string | null;
}): Promise<{
  validatedArtifact: AdsApiValidatedProfileSyncArtifact;
  metadata: AdsApiSpPlacementDailyReportMetadata;
  rawArtifact: AdsApiSpPlacementDailyRawArtifact;
  normalizedArtifact: AdsApiSpPlacementDailyNormalizedArtifact;
  rawArtifactPath: string;
  normalizedArtifactPath: string;
}> => {
  const validatedArtifact = validateProfileSyncArtifactForSpPlacementDaily({
    config: args.config,
    artifactPath: args.artifactPath,
  });

  const metadata = await requestSpPlacementDailyReport({
    config: args.config,
    accessToken: args.accessToken,
    dateRange: args.dateRange,
    transport: args.transport,
    maxAttempts: args.maxAttempts,
    pollIntervalMs: args.pollIntervalMs,
    sleep: args.sleep,
    pendingStore: args.pendingStore,
    resumePendingOnly: args.resumePendingOnly,
    diagnosticPath: args.diagnosticPath,
  });

  const rawRowsPayload = await downloadSpPlacementDailyReport({
    metadata,
    downloadTransport: args.downloadTransport,
  });

  const rawArtifact = buildSpPlacementDailyRawArtifact({
    config: args.config,
    dateRange: args.dateRange,
    metadata,
    rawRowsPayload,
    generatedAt: args.generatedAt,
  });
  const normalizedArtifact = buildSpPlacementDailyNormalizedArtifact({
    config: args.config,
    dateRange: args.dateRange,
    normalizedPlacementRows: normalizeSpPlacementDailyRows({
      rawRowsPayload,
      appAccountId: args.config.appAccountId,
      appMarketplace: args.config.appMarketplace,
      profileId: args.config.profileId,
    }),
    generatedAt: args.generatedAt,
  });

  const written = writeSpPlacementDailyArtifacts({
    rawArtifact,
    normalizedArtifact,
    rawArtifactPath: args.rawArtifactPath,
    normalizedArtifactPath: args.normalizedArtifactPath,
  });

  return {
    validatedArtifact,
    metadata,
    rawArtifact,
    normalizedArtifact,
    rawArtifactPath: written.rawArtifactPath,
    normalizedArtifactPath: written.normalizedArtifactPath,
  };
};
