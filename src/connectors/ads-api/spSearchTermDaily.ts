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
  AdsApiSpSearchTermDailyError,
  type AdsApiDateRange,
  type AdsApiDownloadTransport,
  type AdsApiProfileSyncEnvConfig,
  type AdsApiProfilesSyncArtifact,
  type AdsApiSpSearchTermDailyCreateRequest,
  type AdsApiSpSearchTermDailyNormalizedArtifact,
  type AdsApiSpSearchTermDailyNormalizedRow,
  type AdsApiSpSearchTermDailyRawArtifact,
  type AdsApiSpSearchTermDailyRawPayload,
  type AdsApiSpSearchTermDailyReportMetadata,
  type AdsApiTransport,
  type AdsApiTransportRequest,
  type AdsApiValidatedProfileSyncArtifact,
} from './types';

export { adsApiDownloadTransport, buildAdsApiDateRange };

export const ADS_API_SP_SEARCH_TERM_DAILY_RAW_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-sp-search-term-daily/raw/sp-search-term-daily.raw.json'
);

export const ADS_API_SP_SEARCH_TERM_DAILY_NORMALIZED_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-sp-search-term-daily/normalized/sp-search-term-daily.normalized.json'
);

export const ADS_API_SP_SEARCH_TERM_DAILY_DIAGNOSTIC_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-sp-search-term-daily/diagnostics/sp-search-term-daily.polling-diagnostic.json'
);

const REPORTING_REPORTS_PATH = '/reporting/reports';
const SP_SEARCH_TERM_REPORT_TYPE_ID = 'spSearchTerm';
const SP_SEARCH_TERM_REPORT_COLUMNS = [
  'date',
  'campaignId',
  'campaignName',
  'campaignStatus',
  'adGroupId',
  'adGroupName',
  'keywordId',
  'keyword',
  'targeting',
  'matchType',
  'keywordType',
  'adKeywordStatus',
  'searchTerm',
  'impressions',
  'clicks',
  'cost',
  'costPerClick',
  'clickThroughRate',
  'sales14d',
  'purchases14d',
  'unitsSoldClicks14d',
  'roasClicks14d',
  'acosClicks14d',
  'purchaseClickRate14d',
  'campaignBudgetCurrencyCode',
] as const;

export const MAX_SP_SEARCH_TERM_DAILY_WINDOW_DAYS = 31;
export const DEFAULT_SP_SEARCH_TERM_DAILY_MAX_ATTEMPTS = 180;
export const DEFAULT_SP_SEARCH_TERM_DAILY_POLL_INTERVAL_MS = 5000;
export const TERMINAL_SP_SEARCH_TERM_DAILY_SUCCESS_STATUSES = [
  'SUCCESS',
  'COMPLETED',
  'DONE',
] as const;
export const TERMINAL_SP_SEARCH_TERM_DAILY_FAILURE_STATUSES = [
  'FAILURE',
  'FAILED',
  'CANCELLED',
  'CANCELED',
] as const;
export const POLLABLE_SP_SEARCH_TERM_DAILY_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'PROCESSING',
  'QUEUED',
] as const;

type SpSearchTermDailyPendingRequestRecord = {
  reportId: string;
  status: string | null;
  statusDetails: string | null;
  attemptCount: number;
  diagnosticPath: string | null;
  lastResponseJson: Record<string, unknown>;
};

type SpSearchTermDailyPendingRequestState = {
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

export interface SpSearchTermDailyPendingRequestStore {
  findReusablePendingRequest(args: {
    accountId: string;
    marketplace: string;
    profileId: string;
    reportTypeId: string;
    sourceType: string;
    startDate: string;
    endDate: string;
  }): Promise<SpSearchTermDailyPendingRequestRecord | null>;
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
    state: SpSearchTermDailyPendingRequestState;
  }): Promise<void>;
}

const readHeader = (
  headers: Record<string, string | null> | undefined,
  name: string
): string | null => headers?.[name.toLowerCase()] ?? null;

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
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
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
) => new AdsApiSpSearchTermDailyError(code, message, options);

const isSuccessStatus = (status: string | null): boolean =>
  status != null &&
  (TERMINAL_SP_SEARCH_TERM_DAILY_SUCCESS_STATUSES as readonly string[]).includes(status);

const isFailureStatus = (status: string | null): boolean =>
  status != null &&
  (TERMINAL_SP_SEARCH_TERM_DAILY_FAILURE_STATUSES as readonly string[]).includes(status);

const toPendingRequestStatus = (
  status: string | null,
  fallback: SpSearchTermDailyPendingRequestState['status']
): SpSearchTermDailyPendingRequestState['status'] => {
  const normalized = status?.toUpperCase() ?? null;
  if (isSuccessStatus(normalized)) return 'completed';
  if (isFailureStatus(normalized)) return 'failed';
  if (
    normalized &&
    (POLLABLE_SP_SEARCH_TERM_DAILY_STATUSES as readonly string[]).includes(normalized)
  ) {
    return normalized === 'PENDING' ? 'pending' : 'polling';
  }
  return fallback;
};

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
    `Downloaded search term daily rows are missing required field ${fieldLabel}.`
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
    `Downloaded search term daily rows are missing required numeric field ${fieldLabel}.`
  );
};

export const validateProfileSyncArtifactForSpSearchTermDaily = (args: {
  config: AdsApiProfileSyncEnvConfig;
  artifactPath?: string;
}): AdsApiValidatedProfileSyncArtifact => {
  const artifactPath = args.artifactPath ?? ADS_API_PROFILE_SYNC_ARTIFACT_PATH;
  if (!fs.existsSync(artifactPath)) {
    throw normalizeReportError(
      'profile_sync_artifact_missing',
      `Missing profile-sync artifact: ${artifactPath}`
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  } catch (error) {
    throw normalizeReportError(
      'profile_sync_artifact_invalid',
      'Profile-sync artifact is not valid JSON.',
      { details: error }
    );
  }

  const artifact = parseProfileSyncArtifact(parsedJson);
  if (!artifact) {
    throw normalizeReportError(
      'profile_sync_artifact_invalid',
      'Profile-sync artifact is missing required fields.'
    );
  }

  if (artifact.appAccountId !== args.config.appAccountId) {
    throw normalizeReportError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact appAccountId does not match APP_ACCOUNT_ID.'
    );
  }
  if (artifact.appMarketplace !== args.config.appMarketplace) {
    throw normalizeReportError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact appMarketplace does not match APP_MARKETPLACE.'
    );
  }
  if (artifact.adsApiBaseUrl !== args.config.apiBaseUrl) {
    throw normalizeReportError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact adsApiBaseUrl does not match AMAZON_ADS_API_BASE_URL.'
    );
  }
  if (artifact.selectedProfile.profileId !== args.config.profileId) {
    throw normalizeReportError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact selectedProfile.profileId does not match AMAZON_ADS_PROFILE_ID.'
    );
  }

  return artifact as AdsApiValidatedProfileSyncArtifact;
};

export const buildSpSearchTermDailyCreateRequestBody = (args: {
  dateRange: AdsApiDateRange;
}): AdsApiSpSearchTermDailyCreateRequest => ({
  name: `sp-search-term-daily-${args.dateRange.startDate}-${args.dateRange.endDate}`,
  startDate: args.dateRange.startDate,
  endDate: args.dateRange.endDate,
  configuration: {
    adProduct: 'SPONSORED_PRODUCTS',
    groupBy: ['searchTerm'],
    columns: [...SP_SEARCH_TERM_REPORT_COLUMNS],
    reportTypeId: SP_SEARCH_TERM_REPORT_TYPE_ID,
    timeUnit: 'DAILY',
    format: 'GZIP_JSON',
  },
});

export const buildSpSearchTermDailyCreateRequest = (args: {
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
  body: JSON.stringify(
    buildSpSearchTermDailyCreateRequestBody({ dateRange: args.dateRange })
  ),
});

export const parseSpSearchTermDailyReportMetadata = (
  value: unknown
): AdsApiSpSearchTermDailyReportMetadata | null =>
  parseSpTargetDailyReportMetadata(value) as AdsApiSpSearchTermDailyReportMetadata | null;

export const requestSpSearchTermDailyReport = async (args: {
  config: AdsApiProfileSyncEnvConfig;
  accessToken: string;
  dateRange: AdsApiDateRange;
  transport: AdsApiTransport;
  maxAttempts?: number;
  pollIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  pendingStore?: SpSearchTermDailyPendingRequestStore | null;
  resumePendingOnly?: boolean;
  diagnosticPath?: string | null;
}): Promise<AdsApiSpSearchTermDailyReportMetadata> => {
  const maxAttempts = args.maxAttempts ?? DEFAULT_SP_SEARCH_TERM_DAILY_MAX_ATTEMPTS;
  const pollIntervalMs =
    args.pollIntervalMs ?? DEFAULT_SP_SEARCH_TERM_DAILY_POLL_INTERVAL_MS;
  const sleep =
    args.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const requestPayload = buildSpSearchTermDailyCreateRequestBody({
    dateRange: args.dateRange,
  }) as Record<string, unknown>;
  const sourceType = 'ads_api_sp_search_term_daily';
  const targetTable = 'sp_search_term_daily_fact';

  const toPendingState = (
    metadata: AdsApiSpSearchTermDailyReportMetadata,
    fallback: SpSearchTermDailyPendingRequestState['status'],
    attemptCount: number,
    lastResponseJson: Record<string, unknown>,
    retryAfterAt: string | null
  ): SpSearchTermDailyPendingRequestState => ({
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
      reportTypeId: SP_SEARCH_TERM_REPORT_TYPE_ID,
      sourceType,
      startDate: args.dateRange.startDate,
      endDate: args.dateRange.endDate,
    })) ?? null;

  let metadata: AdsApiSpSearchTermDailyReportMetadata;
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
        `No reusable pending SP search term report was found for ${args.dateRange.startDate} -> ${args.dateRange.endDate}.`
      );
    }

    let createResponse;
    try {
      createResponse = await args.transport(
        buildSpSearchTermDailyCreateRequest({
          config: args.config,
          accessToken: args.accessToken,
          dateRange: args.dateRange,
        })
      );
    } catch (error) {
      throw normalizeReportError(
        'transport_error',
        'Amazon Ads search term daily report request failed before a response was received.',
        { details: error }
      );
    }

    if (createResponse.status < 200 || createResponse.status >= 300) {
      throw normalizeReportError(
        'report_request_failed',
        `Amazon Ads search term daily report request failed with status ${createResponse.status}`,
        { status: createResponse.status, details: createResponse.json }
      );
    }

    const parsedMetadata = parseSpSearchTermDailyReportMetadata(createResponse.json);
    if (!parsedMetadata) {
      throw normalizeReportError(
        'invalid_response',
        'Amazon Ads search term daily report request returned an invalid response payload',
        { details: createResponse.json }
      );
    }

    metadata = parsedMetadata;
    attemptCount = 1;
    await args.pendingStore?.upsertPendingRequest({
      accountId: args.config.appAccountId,
      marketplace: args.config.appMarketplace,
      profileId: args.config.profileId,
      adProduct: 'SPONSORED_PRODUCTS',
      reportTypeId: SP_SEARCH_TERM_REPORT_TYPE_ID,
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
        reportTypeId: SP_SEARCH_TERM_REPORT_TYPE_ID,
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
        reportTypeId: SP_SEARCH_TERM_REPORT_TYPE_ID,
        sourceType,
        targetTable,
        startDate: args.dateRange.startDate,
        endDate: args.dateRange.endDate,
        state: toPendingState(metadata, 'failed', attemptCount, {}, null),
      });
      throw normalizeReportError(
        'report_failed',
        `Amazon Ads search term daily report failed with status ${metadata.status ?? '(unknown)'}.`,
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
        'Amazon Ads search term daily report status polling failed before a response was received.',
        { details: error }
      );
    }

    if (pollResponse.status < 200 || pollResponse.status >= 300) {
      throw normalizeReportError(
        'report_request_failed',
        `Amazon Ads search term daily report status polling failed with status ${pollResponse.status}`,
        { status: pollResponse.status, details: pollResponse.json }
      );
    }

    const parsedMetadata = parseSpSearchTermDailyReportMetadata(pollResponse.json);
    if (!parsedMetadata) {
      throw normalizeReportError(
        'invalid_response',
        'Amazon Ads search term daily report status polling returned an invalid payload',
        { details: pollResponse.json }
      );
    }

    metadata = parsedMetadata;
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
      reportTypeId: SP_SEARCH_TERM_REPORT_TYPE_ID,
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
    reportTypeId: SP_SEARCH_TERM_REPORT_TYPE_ID,
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
    `Amazon Ads search term daily report remained pending after ${maxAttempts} attempts. report_id=${metadata.reportId} date_range=${args.dateRange.startDate}->${args.dateRange.endDate} profile_id=${args.config.profileId} poll_interval_ms=${pollIntervalMs}`,
    { details: metadata }
  );
};

export const parseSpSearchTermDailyDownloadedRows = (args: {
  body: Buffer;
  headers?: Record<string, string | null>;
}): AdsApiSpSearchTermDailyRawPayload =>
  parseSpCampaignDailyDownloadedRows(args) as AdsApiSpSearchTermDailyRawPayload;

export const normalizeSpSearchTermDailyRows = (args: {
  rawRowsPayload: AdsApiSpSearchTermDailyRawPayload;
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
}): AdsApiSpSearchTermDailyNormalizedRow[] => {
  const rows = args.rawRowsPayload.rows.map((rawRow) => {
    const row = rawRow as Record<string, unknown>;
    const targetingExpression =
      readStringLike(row.keyword) ??
      readStringLike(row.targeting) ??
      readStringLike(row.targetingExpression) ??
      readStringLike(row.keywordText) ??
      "*";
    return {
      appAccountId: args.appAccountId,
      appMarketplace: args.appMarketplace,
      profileId: args.profileId,
      date: requireStringField(row, ['date'], 'date'),
      campaignId: requireStringField(row, ['campaignId', 'campaign_id'], 'campaignId'),
      campaignName: requireStringField(
        row,
        ['campaignName', 'campaign_name'],
        'campaignName'
      ),
      campaignStatus:
        readStringLike(row.campaignStatus) ?? readStringLike(row.campaign_status) ?? null,
      adGroupId: requireStringField(row, ['adGroupId', 'ad_group_id'], 'adGroupId'),
      adGroupName: requireStringField(row, ['adGroupName', 'ad_group_name'], 'adGroupName'),
      targetId: readStringLike(row.keywordId) ?? readStringLike(row.targetId) ?? null,
      targetingExpression,
      matchType:
        readStringLike(row.matchType) ??
        readStringLike(row.match_type) ??
        readStringLike(row.keywordType) ??
        null,
      keywordType:
        readStringLike(row.keywordType) ?? readStringLike(row.keyword_type) ?? null,
      targetStatus:
        readStringLike(row.adKeywordStatus) ??
        readStringLike(row.targetStatus) ??
        readStringLike(row.status) ??
        null,
      searchTerm: requireStringField(row, ['searchTerm', 'search_term'], 'searchTerm'),
      impressions: requireNumberField(row, ['impressions'], 'impressions'),
      clicks: requireNumberField(row, ['clicks'], 'clicks'),
      cost: requireNumberField(row, ['cost', 'spend'], 'cost'),
      costPerClick: readNumber(row.costPerClick) ?? readNumber(row.cpc),
      clickThroughRate: readNumber(row.clickThroughRate) ?? readNumber(row.ctr),
      attributedSales14d: requireNumberField(row, ['sales14d', 'sales'], 'sales14d'),
      attributedConversions14d: requireNumberField(
        row,
        ['purchases14d', 'orders'],
        'purchases14d'
      ),
      attributedUnitsOrdered14d: requireNumberField(
        row,
        ['unitsSoldClicks14d', 'units'],
        'unitsSoldClicks14d'
      ),
      roasClicks14d: readNumber(row.roasClicks14d) ?? readNumber(row.roas),
      acosClicks14d: readNumber(row.acosClicks14d) ?? readNumber(row.acos),
      purchaseClickRate14d:
        readNumber(row.purchaseClickRate14d) ?? readNumber(row.conversionRate),
      currencyCode:
        readStringLike(row.campaignBudgetCurrencyCode) ??
        readStringLike(row.currencyCode) ??
        null,
    };
  });

  return rows.sort((left, right) => {
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

export const buildSpSearchTermDailyRawArtifact = (args: {
  config: AdsApiProfileSyncEnvConfig;
  dateRange: AdsApiDateRange;
  metadata: AdsApiSpSearchTermDailyReportMetadata;
  rawRowsPayload: AdsApiSpSearchTermDailyRawPayload;
  generatedAt?: string;
}): AdsApiSpSearchTermDailyRawArtifact => ({
  schemaVersion: 'ads-api-sp-search-term-daily-raw/v1',
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

export const buildSpSearchTermDailyNormalizedArtifact = (args: {
  config: AdsApiProfileSyncEnvConfig;
  dateRange: AdsApiDateRange;
  normalizedSearchTermRows: AdsApiSpSearchTermDailyNormalizedRow[];
  generatedAt?: string;
}): AdsApiSpSearchTermDailyNormalizedArtifact => ({
  schemaVersion: 'ads-api-sp-search-term-daily-normalized/v1',
  generatedAt: args.generatedAt ?? new Date().toISOString(),
  appAccountId: args.config.appAccountId,
  appMarketplace: args.config.appMarketplace,
  adsApiBaseUrl: args.config.apiBaseUrl,
  profileId: args.config.profileId,
  requestedDateRange: args.dateRange,
  rowCount: args.normalizedSearchTermRows.length,
  normalizedSearchTermRows: args.normalizedSearchTermRows,
});

export const downloadSpSearchTermDailyReport = async (args: {
  metadata: AdsApiSpSearchTermDailyReportMetadata;
  downloadTransport: AdsApiDownloadTransport;
}): Promise<AdsApiSpSearchTermDailyRawPayload> => {
  if (!args.metadata.location) {
    throw normalizeReportError(
      'download_failed',
      'Amazon Ads search term daily report does not include a download URL.'
    );
  }

  let response;
  try {
    response = await args.downloadTransport(args.metadata.location);
  } catch (error) {
    throw normalizeReportError(
      'download_failed',
      'Amazon Ads search term daily report download failed before a response was received.',
      { details: error }
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw normalizeReportError(
      'download_failed',
      `Amazon Ads search term daily report download failed with status ${response.status}`,
      { status: response.status }
    );
  }

  try {
    return parseSpSearchTermDailyDownloadedRows({
      body: response.body,
      headers: response.headers,
    });
  } catch (error) {
    if (error instanceof AdsApiSpSearchTermDailyError) throw error;
    throw normalizeReportError(
      'invalid_response',
      'Amazon Ads search term daily report download returned an invalid payload',
      { details: error }
    );
  }
};

export const writeSpSearchTermDailyArtifacts = (args: {
  rawArtifact: AdsApiSpSearchTermDailyRawArtifact;
  normalizedArtifact: AdsApiSpSearchTermDailyNormalizedArtifact;
  rawArtifactPath?: string;
  normalizedArtifactPath?: string;
}): { rawArtifactPath: string; normalizedArtifactPath: string } => {
  const rawArtifactPath =
    args.rawArtifactPath ?? ADS_API_SP_SEARCH_TERM_DAILY_RAW_ARTIFACT_PATH;
  const normalizedArtifactPath =
    args.normalizedArtifactPath ??
    ADS_API_SP_SEARCH_TERM_DAILY_NORMALIZED_ARTIFACT_PATH;

  fs.mkdirSync(path.dirname(rawArtifactPath), { recursive: true });
  fs.mkdirSync(path.dirname(normalizedArtifactPath), { recursive: true });
  fs.writeFileSync(rawArtifactPath, `${JSON.stringify(args.rawArtifact, null, 2)}\n`);
  fs.writeFileSync(
    normalizedArtifactPath,
    `${JSON.stringify(args.normalizedArtifact, null, 2)}\n`
  );

  return { rawArtifactPath, normalizedArtifactPath };
};

export const runSpSearchTermDailyPull = async (args: {
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
  pendingStore?: SpSearchTermDailyPendingRequestStore | null;
  resumePendingOnly?: boolean;
  diagnosticPath?: string | null;
}): Promise<{
  validatedArtifact: AdsApiValidatedProfileSyncArtifact;
  metadata: AdsApiSpSearchTermDailyReportMetadata;
  rawArtifact: AdsApiSpSearchTermDailyRawArtifact;
  normalizedArtifact: AdsApiSpSearchTermDailyNormalizedArtifact;
  rawArtifactPath: string;
  normalizedArtifactPath: string;
}> => {
  const validatedArtifact = validateProfileSyncArtifactForSpSearchTermDaily({
    config: args.config,
    artifactPath: args.artifactPath,
  });

  const metadata = await requestSpSearchTermDailyReport({
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

  const rawRowsPayload = await downloadSpSearchTermDailyReport({
    metadata,
    downloadTransport: args.downloadTransport,
  });

  const rawArtifact = buildSpSearchTermDailyRawArtifact({
    config: args.config,
    dateRange: args.dateRange,
    metadata,
    rawRowsPayload,
    generatedAt: args.generatedAt,
  });
  const normalizedArtifact = buildSpSearchTermDailyNormalizedArtifact({
    config: args.config,
    dateRange: args.dateRange,
    normalizedSearchTermRows: normalizeSpSearchTermDailyRows({
      rawRowsPayload,
      appAccountId: args.config.appAccountId,
      appMarketplace: args.config.appMarketplace,
      profileId: args.config.profileId,
    }),
    generatedAt: args.generatedAt,
  });
  const paths = writeSpSearchTermDailyArtifacts({
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
    rawArtifactPath: paths.rawArtifactPath,
    normalizedArtifactPath: paths.normalizedArtifactPath,
  };
};
