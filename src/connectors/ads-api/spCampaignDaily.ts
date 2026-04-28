import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import {
  AdsApiSpCampaignDailyError,
  type AdsApiDateRange,
  type AdsApiDownloadTransport,
  type AdsApiDownloadTransportResponse,
  type AdsApiProfileSyncEnvConfig,
  type AdsApiProfilesSyncArtifact,
  type AdsApiSpCampaignDailyCreateRequest,
  type AdsApiSpCampaignDailyNormalizedArtifact,
  type AdsApiSpCampaignDailyNormalizedRow,
  type AdsApiSpCampaignDailyRawArtifact,
  type AdsApiSpCampaignDailyRawPayload,
  type AdsApiSpCampaignDailyReportMetadata,
  type AdsApiTransport,
  type AdsApiTransportRequest,
  type AdsApiValidatedProfileSyncArtifact,
} from './types';

export const ADS_API_PROFILE_SYNC_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-profile-sync/ads-profiles.sync.json'
);

export const ADS_API_SP_CAMPAIGN_DAILY_RAW_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-sp-campaign-daily/raw/sp-campaign-daily.raw.json'
);

export const ADS_API_SP_CAMPAIGN_DAILY_NORMALIZED_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-sp-campaign-daily/normalized/sp-campaign-daily.normalized.json'
);

export const ADS_API_SP_CAMPAIGN_DAILY_DIAGNOSTIC_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-sp-campaign-daily/diagnostics/sp-campaign-daily.polling-diagnostic.json'
);

const REPORTING_REPORTS_PATH = '/reporting/reports';
const SP_CAMPAIGN_REPORT_TYPE_ID = 'spCampaigns';
const SP_CAMPAIGN_REPORT_COLUMNS = [
  'campaignId',
  'campaignName',
  'campaignStatus',
  'campaignBudgetType',
  'date',
  'impressions',
  'clicks',
  'cost',
  'sales14d',
  'purchases14d',
  'campaignBudgetCurrencyCode',
] as const;

export const MAX_SP_CAMPAIGN_DAILY_WINDOW_DAYS = 31;
export const DEFAULT_SP_CAMPAIGN_DAILY_MAX_ATTEMPTS = 240;
export const DEFAULT_SP_CAMPAIGN_DAILY_POLL_INTERVAL_MS = 5000;
export const TERMINAL_SP_CAMPAIGN_DAILY_SUCCESS_STATUSES = [
  'SUCCESS',
  'COMPLETED',
  'DONE',
] as const;
export const TERMINAL_SP_CAMPAIGN_DAILY_FAILURE_STATUSES = [
  'FAILURE',
  'FAILED',
  'CANCELLED',
  'CANCELED',
] as const;
export const POLLABLE_SP_CAMPAIGN_DAILY_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'PROCESSING',
  'QUEUED',
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DUPLICATE_REPORT_ID_PATTERN =
  /duplicate of\s*:\s*(?<reportId>[0-9a-fA-F-]{36})/i;

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const maskProfileId = (value: string): string =>
  value.length <= 4 ? '****' : `${'*'.repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;

const redactSensitiveText = (value: string): string =>
  value
    .replace(
      /((?:access|refresh|client|service[_-]?role|session|bearer|token|signature)[_-]?token?["'=:\s]+)([^\s'",]+)/gi,
      '$1[REDACTED]'
    )
    .replace(/(authorization:\s*bearer\s+)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/([?&](?:token|signature|x-amz-signature|x-amz-credential|x-amz-security-token|x-amz-date|x-amz-expires)=)([^&]+)/gi, '$1[REDACTED]');

const safeStringify = (value: unknown): string => {
  try {
    return redactSensitiveText(JSON.stringify(value));
  } catch {
    return redactSensitiveText(String(value));
  }
};

const sanitizeJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonValue(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sanitizeJsonValue(entry),
      ])
    );
  }
  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }
  return value;
};

const toTailLines = (value: string, count = 10): string[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-count);

const readHeader = (
  headers: Record<string, string | null> | undefined,
  name: string
): string | null => headers?.[name.toLowerCase()] ?? null;

const isSuccessStatus = (status: string | null): boolean =>
  status != null &&
  (TERMINAL_SP_CAMPAIGN_DAILY_SUCCESS_STATUSES as readonly string[]).includes(status);

const isFailureStatus = (status: string | null): boolean =>
  status != null &&
  (TERMINAL_SP_CAMPAIGN_DAILY_FAILURE_STATUSES as readonly string[]).includes(status);

const shouldLogPollAttempt = (attempt: number): boolean =>
  attempt === 0 || attempt === 1 || attempt % 15 === 0;

const buildPollSnapshot = (args: {
  attempt: number;
  metadata: AdsApiSpCampaignDailyReportMetadata;
  responseStatus?: number | null;
  retryAfter?: string | null;
}): SpCampaignDailyPollSnapshot => ({
  attempt: args.attempt,
  status: args.metadata.status?.toUpperCase() ?? null,
  statusDetails: args.metadata.statusDetails,
  hasLocation: !!args.metadata.location,
  responseStatus: args.responseStatus ?? null,
  retryAfter: args.retryAfter ?? null,
  receivedAt: new Date().toISOString(),
});

const toPendingRequestStatus = (
  status: string | null,
  fallback: SpCampaignDailyPendingRequestState['status']
): SpCampaignDailyPendingRequestState['status'] => {
  const normalized = status?.toUpperCase() ?? null;
  if (isSuccessStatus(normalized)) return 'completed';
  if (isFailureStatus(normalized)) return 'failed';
  if (
    normalized &&
    (POLLABLE_SP_CAMPAIGN_DAILY_STATUSES as readonly string[]).includes(normalized)
  ) {
    return normalized === 'PENDING' ? 'pending' : 'polling';
  }
  return fallback;
};

const buildPollingDiagnostic = (args: {
  config: AdsApiProfileSyncEnvConfig;
  dateRange: AdsApiDateRange;
  reportId: string;
  maxAttempts: number;
  pollIntervalMs: number;
  startedAtMs: number;
  latest: AdsApiSpCampaignDailyReportMetadata;
  lastResponseJson: unknown;
  lastRetryAfter: string | null;
  history: SpCampaignDailyPollSnapshot[];
}): SpCampaignDailyPollingDiagnostic => ({
  reportId: args.reportId,
  startDate: args.dateRange.startDate,
  endDate: args.dateRange.endDate,
  maskedProfileId: maskProfileId(args.config.profileId),
  pollMethod: 'GET',
  pollUrl: buildSpCampaignDailyStatusRequest({
    config: args.config,
    accessToken: '[REDACTED]',
    reportId: args.reportId,
  }).url,
  maxAttempts: args.maxAttempts,
  pollIntervalMs: args.pollIntervalMs,
  totalElapsedMs: Date.now() - args.startedAtMs,
  lastStatuses: args.history.slice(-10),
  latestStatus: args.latest.status?.toUpperCase() ?? null,
  latestStatusDetails: args.latest.statusDetails,
  retryAfter: args.lastRetryAfter,
  lastResponseBodyTail: toTailLines(safeStringify(args.lastResponseJson), 10),
  suggestedNextAction:
    'Rerun with --diagnose if needed, review the polling diagnostic artifact, and check Amazon Ads Status for reporting delays before retrying.',
});

type SpCampaignDailyPollSnapshot = {
  attempt: number;
  status: string | null;
  statusDetails: string | null;
  hasLocation: boolean;
  responseStatus: number | null;
  retryAfter: string | null;
  receivedAt: string;
};

export type SpCampaignDailyPollingDiagnostic = {
  reportId: string;
  startDate: string;
  endDate: string;
  maskedProfileId: string;
  pollMethod: 'GET';
  pollUrl: string;
  maxAttempts: number;
  pollIntervalMs: number;
  totalElapsedMs: number;
  lastStatuses: SpCampaignDailyPollSnapshot[];
  latestStatus: string | null;
  latestStatusDetails: string | null;
  retryAfter: string | null;
  lastResponseBodyTail: string[];
  suggestedNextAction: string;
};

type SpCampaignDailyPollUpdate = {
  kind: 'create' | 'poll' | 'timeout';
  reportId: string;
  snapshot: SpCampaignDailyPollSnapshot;
  diagnostic?: SpCampaignDailyPollingDiagnostic;
};

export type SpCampaignDailyPendingRequestRecord = {
  reportId: string;
  status: string | null;
  statusDetails: string | null;
  attemptCount: number;
  diagnosticPath: string | null;
  lastResponseJson: Record<string, unknown>;
};

type SpCampaignDailyPendingRequestState = {
  reportId: string;
  status: 'completed' | 'created' | 'failed' | 'pending' | 'pending_timeout' | 'polling';
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

export interface SpCampaignDailyPendingRequestStore {
  findReusablePendingRequest(args: {
    accountId: string;
    marketplace: string;
    profileId: string;
    reportTypeId: string;
    sourceType: string;
    startDate: string;
    endDate: string;
  }): Promise<SpCampaignDailyPendingRequestRecord | null>;
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
    state: SpCampaignDailyPendingRequestState;
  }): Promise<void>;
}

const readStringLike = (value: unknown): string | null => {
  const asString = readString(value);
  if (asString) {
    return asString;
  }

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
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.replace(/[$,%\s,]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseDateOnly = (value: string): Date | null => {
  if (!DATE_PATTERN.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10) === value ? parsed : null;
};

const daysBetweenInclusive = (startDate: Date, endDate: Date): number =>
  Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

export const buildAdsApiDateRange = (args: {
  startDate: string;
  endDate: string;
}): AdsApiDateRange => {
  const start = parseDateOnly(args.startDate);
  if (!start) {
    throw new AdsApiSpCampaignDailyError(
      'invalid_date',
      `Invalid start date: ${args.startDate}. Expected YYYY-MM-DD.`
    );
  }

  const end = parseDateOnly(args.endDate);
  if (!end) {
    throw new AdsApiSpCampaignDailyError(
      'invalid_date',
      `Invalid end date: ${args.endDate}. Expected YYYY-MM-DD.`
    );
  }

  if (end.getTime() < start.getTime()) {
    throw new AdsApiSpCampaignDailyError(
      'invalid_date',
      'End date must be on or after start date.'
    );
  }

  if (daysBetweenInclusive(start, end) > MAX_SP_CAMPAIGN_DAILY_WINDOW_DAYS) {
    throw new AdsApiSpCampaignDailyError(
      'invalid_date',
      `Date range must be ${MAX_SP_CAMPAIGN_DAILY_WINDOW_DAYS} days or fewer.`
    );
  }

  return {
    startDate: args.startDate,
    endDate: args.endDate,
  };
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
    !schemaVersion ||
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

export const validateProfileSyncArtifactForSpCampaignDaily = (args: {
  config: AdsApiProfileSyncEnvConfig;
  artifactPath?: string;
}): AdsApiValidatedProfileSyncArtifact => {
  const artifactPath = args.artifactPath ?? ADS_API_PROFILE_SYNC_ARTIFACT_PATH;

  if (!fs.existsSync(artifactPath)) {
    throw new AdsApiSpCampaignDailyError(
      'profile_sync_artifact_missing',
      `Missing profile-sync artifact: ${artifactPath}`
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  } catch (error) {
    throw new AdsApiSpCampaignDailyError(
      'profile_sync_artifact_invalid',
      'Profile-sync artifact is not valid JSON.',
      { details: error }
    );
  }

  const artifact = parseProfileSyncArtifact(parsedJson);
  if (!artifact || !readString(artifact.schemaVersion)) {
    throw new AdsApiSpCampaignDailyError(
      'profile_sync_artifact_invalid',
      'Profile-sync artifact is missing required fields.'
    );
  }

  if (artifact.configuredProfileId !== args.config.profileId) {
    throw new AdsApiSpCampaignDailyError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact configuredProfileId does not match AMAZON_ADS_PROFILE_ID.'
    );
  }

  if (artifact.appAccountId !== args.config.appAccountId) {
    throw new AdsApiSpCampaignDailyError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact appAccountId does not match APP_ACCOUNT_ID.'
    );
  }

  if (artifact.appMarketplace !== args.config.appMarketplace) {
    throw new AdsApiSpCampaignDailyError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact appMarketplace does not match APP_MARKETPLACE.'
    );
  }

  const selectedProfileId = readString(artifact.selectedProfile?.profileId);
  if (!selectedProfileId) {
    throw new AdsApiSpCampaignDailyError(
      'profile_sync_artifact_invalid',
      'Profile-sync artifact selectedProfile is missing.'
    );
  }

  if (selectedProfileId !== artifact.configuredProfileId) {
    throw new AdsApiSpCampaignDailyError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact selectedProfile.profileId does not match configuredProfileId.'
    );
  }

  return artifact as AdsApiValidatedProfileSyncArtifact;
};

export const buildSpCampaignDailyHeaders = (args: {
  config: AdsApiProfileSyncEnvConfig;
  accessToken: string;
  contentType?: 'application/json';
}): Record<string, string> => {
  const headers: Record<string, string> = {
    authorization: `Bearer ${args.accessToken}`,
    'Amazon-Advertising-API-ClientId': args.config.credentials.clientId,
    'Amazon-Advertising-API-Scope': args.config.profileId,
  };

  if (args.contentType) {
    headers['content-type'] = args.contentType;
  }

  return headers;
};

export const buildSpCampaignDailyCreateRequestBody = (args: {
  dateRange: AdsApiDateRange;
}): AdsApiSpCampaignDailyCreateRequest => ({
  name: `sp-campaign-daily-${args.dateRange.startDate}-${args.dateRange.endDate}`,
  startDate: args.dateRange.startDate,
  endDate: args.dateRange.endDate,
  configuration: {
    adProduct: 'SPONSORED_PRODUCTS',
    groupBy: ['campaign'],
    columns: [...SP_CAMPAIGN_REPORT_COLUMNS],
    reportTypeId: 'spCampaigns',
    timeUnit: 'DAILY',
    format: 'GZIP_JSON',
  },
});

export const buildSpCampaignDailyCreateRequest = (args: {
  config: AdsApiProfileSyncEnvConfig;
  accessToken: string;
  dateRange: AdsApiDateRange;
}): AdsApiTransportRequest => ({
  url: `${args.config.apiBaseUrl}${REPORTING_REPORTS_PATH}`,
  method: 'POST',
  headers: buildSpCampaignDailyHeaders({
    config: args.config,
    accessToken: args.accessToken,
    contentType: 'application/json',
  }),
  body: JSON.stringify(
    buildSpCampaignDailyCreateRequestBody({
      dateRange: args.dateRange,
    })
  ),
});

export const buildSpCampaignDailyStatusRequest = (args: {
  config: AdsApiProfileSyncEnvConfig;
  accessToken: string;
  reportId: string;
}): AdsApiTransportRequest => ({
  url: `${args.config.apiBaseUrl}${REPORTING_REPORTS_PATH}/${args.reportId}`,
  method: 'GET',
  headers: buildSpCampaignDailyHeaders({
    config: args.config,
    accessToken: args.accessToken,
  }),
});

export const parseSpCampaignDailyReportMetadata = (
  value: unknown
): AdsApiSpCampaignDailyReportMetadata | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const reportId = readString(candidate.reportId);
  if (!reportId) {
    return null;
  }

  return {
    reportId,
    status: readString(candidate.status),
    statusDetails: readString(candidate.statusDetails),
    location:
      readString(candidate.location) ??
      readString(candidate.url) ??
      readString(candidate.fileUrl),
    fileSize: readNumber(candidate.fileSize),
  };
};

const extractDuplicateReportId = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const detail = readString(candidate.detail) ?? readString(candidate.message);
  const match = detail?.match(DUPLICATE_REPORT_ID_PATTERN);

  return match?.groups?.reportId?.trim() || null;
};

const normalizeReportError = (
  code:
    | 'pending_report_not_found'
    | 'transport_error'
    | 'report_request_failed'
    | 'invalid_response'
    | 'report_timeout'
    | 'pending_timeout'
    | 'report_failed'
    | 'download_failed',
  message: string,
  options: { status?: number; details?: unknown } = {}
) => new AdsApiSpCampaignDailyError(code, message, options);

export const requestSpCampaignDailyReport = async (args: {
  config: AdsApiProfileSyncEnvConfig;
  accessToken: string;
  dateRange: AdsApiDateRange;
  transport: AdsApiTransport;
  maxAttempts?: number;
  pollIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onPollUpdate?: (update: SpCampaignDailyPollUpdate) => void;
  pendingStore?: SpCampaignDailyPendingRequestStore | null;
  resumePendingOnly?: boolean;
  diagnosticPath?: string | null;
}): Promise<AdsApiSpCampaignDailyReportMetadata> => {
  const maxAttempts = args.maxAttempts ?? DEFAULT_SP_CAMPAIGN_DAILY_MAX_ATTEMPTS;
  const pollIntervalMs =
    args.pollIntervalMs ?? DEFAULT_SP_CAMPAIGN_DAILY_POLL_INTERVAL_MS;
  const sleep = args.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const startedAtMs = Date.now();
  const requestPayload = buildSpCampaignDailyCreateRequestBody({
    dateRange: args.dateRange,
  }) as Record<string, unknown>;
  const sourceType = 'ads_api_sp_campaign_daily';
  const targetTable = 'sp_campaign_hourly_fact_gold';
  const resolveRetryAfterAt = (value: string | null): string | null => {
    if (!value) return null;
    const seconds = Number.parseInt(value, 10);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return new Date(Date.now() + seconds * 1000).toISOString();
  };
  const persistPendingState = async (state: SpCampaignDailyPendingRequestState): Promise<void> => {
    if (!args.pendingStore) return;
    await args.pendingStore.upsertPendingRequest({
      accountId: args.config.appAccountId,
      marketplace: args.config.appMarketplace,
      profileId: args.config.profileId,
      adProduct: 'SPONSORED_PRODUCTS',
      reportTypeId: SP_CAMPAIGN_REPORT_TYPE_ID,
      sourceType,
      targetTable,
      startDate: args.dateRange.startDate,
      endDate: args.dateRange.endDate,
      state,
    });
  };

  const reusablePending =
    (await args.pendingStore?.findReusablePendingRequest({
      accountId: args.config.appAccountId,
      marketplace: args.config.appMarketplace,
      profileId: args.config.profileId,
      reportTypeId: SP_CAMPAIGN_REPORT_TYPE_ID,
      sourceType,
      startDate: args.dateRange.startDate,
      endDate: args.dateRange.endDate,
    })) ?? null;

  let createResponseJson: unknown = {};
  let createResponseStatus: number | null = null;
  let createResponseHeaders: Record<string, string | null> | undefined;
  let createResponseResult: Awaited<ReturnType<AdsApiTransport>> | null = null;

  if (!reusablePending && args.resumePendingOnly) {
    throw normalizeReportError(
      'pending_report_not_found',
      `No reusable pending Ads SP campaign report was found for ${args.dateRange.startDate} -> ${args.dateRange.endDate}.`
    );
  }

  const created = reusablePending
    ? ({
        reportId: reusablePending.reportId,
        status: reusablePending.status,
        statusDetails: reusablePending.statusDetails,
        location: null,
        fileSize: null,
      } satisfies AdsApiSpCampaignDailyReportMetadata)
    : await (async (): Promise<AdsApiSpCampaignDailyReportMetadata> => {
        try {
          createResponseResult = await args.transport(
            buildSpCampaignDailyCreateRequest({
              config: args.config,
              accessToken: args.accessToken,
              dateRange: args.dateRange,
            })
          );
          createResponseJson = createResponseResult.json;
          createResponseStatus = createResponseResult.status;
          createResponseHeaders = createResponseResult.headers;
        } catch (error) {
          throw normalizeReportError(
            'transport_error',
            'Amazon Ads campaign daily report request failed before a response was received',
            { details: error }
          );
        }

        const duplicateReportId =
          createResponseResult.status === 425
            ? extractDuplicateReportId(createResponseResult.json)
            : null;

        if (
          (createResponseResult.status < 200 || createResponseResult.status >= 300) &&
          !duplicateReportId
        ) {
          throw normalizeReportError(
            'report_request_failed',
            `Amazon Ads campaign daily report request failed with status ${createResponseResult.status}`,
            { status: createResponseResult.status, details: createResponseResult.json }
          );
        }

        const parsed =
          duplicateReportId != null
            ? ({
                reportId: duplicateReportId,
                status: 'PENDING',
                statusDetails: 'duplicate_report_request',
                location: null,
                fileSize: null,
              } satisfies AdsApiSpCampaignDailyReportMetadata)
            : parseSpCampaignDailyReportMetadata(createResponseResult.json);

        if (!parsed) {
          throw normalizeReportError(
            'invalid_response',
            'Amazon Ads campaign daily report request returned an invalid response payload',
            { status: createResponseResult.status, details: createResponseResult.json }
          );
        }

        await persistPendingState({
          reportId: parsed.reportId,
          status: toPendingRequestStatus(parsed.status, 'created'),
          statusDetails: parsed.statusDetails,
          attemptCount: 0,
          requestPayloadJson: requestPayload,
          lastResponseJson: sanitizeJsonValue(
            (createResponseJson ?? {}) as Record<string, unknown>
          ) as Record<string, unknown>,
          diagnosticPath: args.diagnosticPath ?? null,
          notes: duplicateReportId
            ? 'Amazon returned a duplicate-report id; reusing the existing report.'
            : null,
          retryAfterAt: null,
          lastPolledAt: null,
          completedAt: null,
          failedAt: null,
        });

        return parsed;
      })();

  let latest = created;
  const statusHistory: SpCampaignDailyPollSnapshot[] = [];
  let lastResponseJson: unknown =
    reusablePending?.lastResponseJson ?? createResponseJson;
  let lastRetryAfter = readHeader(createResponseHeaders, 'retry-after');
  const createdSnapshot = buildPollSnapshot({
    attempt: 0,
    metadata: created,
    responseStatus: reusablePending ? 200 : createResponseStatus,
    retryAfter: lastRetryAfter,
  });
  statusHistory.push(createdSnapshot);
  args.onPollUpdate?.({
    kind: 'create',
    reportId: created.reportId,
    snapshot: createdSnapshot,
  });
  await persistPendingState({
    reportId: created.reportId,
    status: toPendingRequestStatus(created.status, reusablePending ? 'pending' : 'created'),
    statusDetails: created.statusDetails,
    attemptCount: reusablePending?.attemptCount ?? 0,
    requestPayloadJson: requestPayload,
    lastResponseJson: sanitizeJsonValue(lastResponseJson) as Record<string, unknown>,
    diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
    notes: reusablePending ? 'Reused an existing pending report id before creating a new one.' : null,
    retryAfterAt: null,
    lastPolledAt: createdSnapshot.receivedAt,
    completedAt: null,
    failedAt: null,
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const status = latest.status?.toUpperCase() ?? null;
    if (isSuccessStatus(status)) {
      const completedAt = new Date().toISOString();
      await persistPendingState({
        reportId: latest.reportId,
        status: 'completed',
        statusDetails: latest.statusDetails,
        attemptCount: (reusablePending?.attemptCount ?? 0) + attempt - 1,
        requestPayloadJson: requestPayload,
        lastResponseJson: sanitizeJsonValue(lastResponseJson) as Record<string, unknown>,
        diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
        notes: 'Amazon Ads SP campaign report reached a terminal success status.',
        retryAfterAt: null,
        lastPolledAt: new Date().toISOString(),
        completedAt,
        failedAt: null,
      });
      return latest;
    }

    if (latest.location && !status) {
      return latest;
    }

    if (isFailureStatus(status)) {
      const failedAt = new Date().toISOString();
      await persistPendingState({
        reportId: latest.reportId,
        status: 'failed',
        statusDetails: latest.statusDetails,
        attemptCount: (reusablePending?.attemptCount ?? 0) + attempt - 1,
        requestPayloadJson: requestPayload,
        lastResponseJson: sanitizeJsonValue(lastResponseJson) as Record<string, unknown>,
        diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
        notes: `Amazon Ads SP campaign report reached terminal failure status ${latest.status}.`,
        retryAfterAt: null,
        lastPolledAt: failedAt,
        completedAt: null,
        failedAt,
      });
      throw normalizeReportError(
        'report_failed',
        `Amazon Ads campaign daily report ended with terminal status ${latest.status}`,
        { details: latest }
      );
    }

    let statusResponse;
    try {
      statusResponse = await args.transport(
        buildSpCampaignDailyStatusRequest({
          config: args.config,
          accessToken: args.accessToken,
          reportId: created.reportId,
        })
      );
    } catch (error) {
      throw normalizeReportError(
        'transport_error',
        'Amazon Ads campaign daily report status request failed before a response was received',
        { details: error }
      );
    }

    if (statusResponse.status < 200 || statusResponse.status >= 300) {
      throw normalizeReportError(
        'report_request_failed',
        `Amazon Ads campaign daily report status request failed with status ${statusResponse.status}`,
        { status: statusResponse.status, details: statusResponse.json }
      );
    }

    const parsedStatus = parseSpCampaignDailyReportMetadata(statusResponse.json);
    if (!parsedStatus) {
      throw normalizeReportError(
        'invalid_response',
        'Amazon Ads campaign daily report status request returned an invalid response payload',
        { status: statusResponse.status, details: statusResponse.json }
      );
    }

    latest = parsedStatus;
    lastResponseJson = statusResponse.json;
    lastRetryAfter = readHeader(statusResponse.headers, 'retry-after');
    const snapshot = buildPollSnapshot({
      attempt,
      metadata: latest,
      responseStatus: statusResponse.status,
      retryAfter: lastRetryAfter,
    });
    statusHistory.push(snapshot);
    if (shouldLogPollAttempt(attempt)) {
      args.onPollUpdate?.({
        kind: 'poll',
        reportId: created.reportId,
        snapshot,
      });
    }
    const nextStatus = latest.status?.toUpperCase() ?? null;
    await persistPendingState({
      reportId: latest.reportId,
      status: toPendingRequestStatus(nextStatus, 'polling'),
      statusDetails: latest.statusDetails,
      attemptCount: (reusablePending?.attemptCount ?? 0) + attempt,
      requestPayloadJson: requestPayload,
      lastResponseJson: sanitizeJsonValue(statusResponse.json) as Record<string, unknown>,
      diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
      notes: null,
      retryAfterAt: resolveRetryAfterAt(lastRetryAfter),
      lastPolledAt: snapshot.receivedAt,
      completedAt: null,
      failedAt: null,
    });

    if (isSuccessStatus(nextStatus)) {
      const completedAt = new Date().toISOString();
      await persistPendingState({
        reportId: latest.reportId,
        status: 'completed',
        statusDetails: latest.statusDetails,
        attemptCount: (reusablePending?.attemptCount ?? 0) + attempt,
        requestPayloadJson: requestPayload,
        lastResponseJson: sanitizeJsonValue(statusResponse.json) as Record<string, unknown>,
        diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
        notes: 'Amazon Ads SP campaign report reached a terminal success status.',
        retryAfterAt: null,
        lastPolledAt: snapshot.receivedAt,
        completedAt,
        failedAt: null,
      });
      return latest;
    }

    if (latest.location) {
      return latest;
    }

    if (isFailureStatus(nextStatus)) {
      const failedAt = new Date().toISOString();
      await persistPendingState({
        reportId: latest.reportId,
        status: 'failed',
        statusDetails: latest.statusDetails,
        attemptCount: (reusablePending?.attemptCount ?? 0) + attempt,
        requestPayloadJson: requestPayload,
        lastResponseJson: sanitizeJsonValue(statusResponse.json) as Record<string, unknown>,
        diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
        notes: `Amazon Ads SP campaign report reached terminal failure status ${latest.status}.`,
        retryAfterAt: null,
        lastPolledAt: snapshot.receivedAt,
        completedAt: null,
        failedAt,
      });
      throw normalizeReportError(
        'report_failed',
        `Amazon Ads campaign daily report ended with terminal status ${latest.status}`,
        { details: latest }
      );
    }

    if (attempt < maxAttempts) {
      await sleep(pollIntervalMs);
    }
  }

  const diagnostic = buildPollingDiagnostic({
    config: args.config,
    dateRange: args.dateRange,
    reportId: created.reportId,
    maxAttempts,
    pollIntervalMs,
    startedAtMs,
    latest,
    lastResponseJson,
    lastRetryAfter,
    history: statusHistory,
  });
  args.onPollUpdate?.({
    kind: 'timeout',
    reportId: created.reportId,
    snapshot: statusHistory[statusHistory.length - 1] ?? createdSnapshot,
    diagnostic,
  });
  await persistPendingState({
    reportId: latest.reportId,
    status: 'pending_timeout',
    statusDetails: latest.statusDetails,
    attemptCount: (reusablePending?.attemptCount ?? 0) + maxAttempts,
    requestPayloadJson: requestPayload,
    lastResponseJson: sanitizeJsonValue(lastResponseJson) as Record<string, unknown>,
    diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
    notes: diagnostic.suggestedNextAction,
    retryAfterAt: resolveRetryAfterAt(lastRetryAfter),
    lastPolledAt: new Date().toISOString(),
    completedAt: null,
    failedAt: null,
  });

  throw normalizeReportError(
    'pending_timeout',
    [
      `Amazon Ads campaign daily report remained pending after ${maxAttempts} attempts.`,
      `report_id=${created.reportId}`,
      `date_range=${args.dateRange.startDate}->${args.dateRange.endDate}`,
      `profile_id=${maskProfileId(args.config.profileId)}`,
      `poll_interval_ms=${pollIntervalMs}`,
      `elapsed_ms=${diagnostic.totalElapsedMs}`,
      `last_statuses=${diagnostic.lastStatuses
        .map((entry) => entry.status ?? '(none)')
        .join(', ') || '(none)'}`,
      `next_action=${diagnostic.suggestedNextAction}`,
    ].join(' '),
    { details: diagnostic }
  );
};

export const adsApiDownloadTransport: AdsApiDownloadTransport = async (
  url: string
) => {
  const response = await fetch(url);
  const body = Buffer.from(await response.arrayBuffer());
  const headers: Record<string, string | null> = {};

  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return {
    status: response.status,
    body,
    headers,
  };
};

const decodeDownloadBody = (
  response: AdsApiDownloadTransportResponse
): string => {
  const contentEncoding = response.headers['content-encoding']?.toLowerCase() ?? null;
  const contentType = response.headers['content-type']?.toLowerCase() ?? null;
  const looksLikeGzip =
    contentEncoding === 'gzip' ||
    contentType?.includes('application/x-gzip') ||
    (response.body.length >= 2 &&
      response.body[0] === 0x1f &&
      response.body[1] === 0x8b);

  return looksLikeGzip
    ? gunzipSync(response.body).toString('utf8')
    : response.body.toString('utf8');
};

export const parseSpCampaignDailyRowsFromCsv = (
  csvText: string
): Array<Record<string, unknown>> => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];

    if (char === '"') {
      if (inQuotes && csvText[index + 1] === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csvText[index + 1] === '\n') {
        index += 1;
      }

      currentRow.push(currentField);
      if (currentRow.some((value) => value.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((value) => value.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  const headers = rows.shift()?.map((value) => value.trim()) ?? [];

  return rows.map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    return record;
  });
};

export const parseSpCampaignDailyDownloadedRows = (args: {
  body: Buffer;
  headers?: Record<string, string | null>;
}): AdsApiSpCampaignDailyRawPayload => {
  const content = decodeDownloadBody({
    status: 200,
    body: args.body,
    headers: args.headers ?? {},
  });

  try {
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) {
      return {
        format: 'json',
        rows: parsed as Array<Record<string, unknown>>,
      };
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as Record<string, unknown>).rows)
    ) {
      return {
        format: 'json',
        rows: (parsed as Record<string, unknown>).rows as Array<Record<string, unknown>>,
      };
    }
  } catch {
    // fall through to CSV parsing
  }

  return {
    format: 'csv',
    rows: parseSpCampaignDailyRowsFromCsv(content),
  };
};

const requireStringField = (
  row: Record<string, unknown>,
  keys: string[],
  fieldLabel: string
): string => {
  for (const key of keys) {
    const value = readStringLike(row[key]);
    if (value) {
      return value;
    }
  }

  throw normalizeReportError(
    'invalid_response',
    `Downloaded campaign daily rows are missing required field ${fieldLabel}`
  );
};

const requireNumberField = (
  row: Record<string, unknown>,
  keys: string[],
  fieldLabel: string
): number => {
  for (const key of keys) {
    const value = readNumber(row[key]);
    if (value !== null) {
      return value;
    }
  }

  throw normalizeReportError(
    'invalid_response',
    `Downloaded campaign daily rows are missing required numeric field ${fieldLabel}`
  );
};

export const normalizeSpCampaignDailyRows = (args: {
  rawRowsPayload: AdsApiSpCampaignDailyRawPayload;
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
}): AdsApiSpCampaignDailyNormalizedRow[] => {
  const normalized = args.rawRowsPayload.rows.map((row) => {
    const record = row as Record<string, unknown>;
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
      campaignStatus: requireStringField(
        record,
        ['campaignStatus', 'status', 'campaign_status'],
        'campaignStatus'
      ),
      campaignBudgetType:
        readString(record.campaignBudgetType) ??
        readString(record.campaign_budget_type) ??
        null,
      date: requireStringField(record, ['date'], 'date'),
      impressions: requireNumberField(record, ['impressions'], 'impressions'),
      clicks: requireNumberField(record, ['clicks'], 'clicks'),
      cost: requireNumberField(record, ['cost', 'spend'], 'cost'),
      attributedSales14d: requireNumberField(
        record,
        ['attributedSales14d', 'sales14d', 'sales_14d'],
        'attributedSales14d'
      ),
      attributedConversions14d: requireNumberField(
        record,
        ['attributedConversions14d', 'purchases14d', 'conversions14d'],
        'attributedConversions14d'
      ),
      currencyCode:
        readString(record.currencyCode) ??
        readString(record.campaignBudgetCurrencyCode) ??
        readString(record.currency) ??
        null,
    };
  });

  return normalized.sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    if (left.campaignId !== right.campaignId) {
      return left.campaignId.localeCompare(right.campaignId, 'en', {
        numeric: true,
      });
    }

    return left.campaignName.localeCompare(right.campaignName, 'en');
  });
};

export const buildSpCampaignDailyRawArtifact = (args: {
  config: AdsApiProfileSyncEnvConfig;
  dateRange: AdsApiDateRange;
  metadata: AdsApiSpCampaignDailyReportMetadata;
  rawRowsPayload: AdsApiSpCampaignDailyRawPayload;
  generatedAt?: string;
}): AdsApiSpCampaignDailyRawArtifact => ({
  schemaVersion: 'ads-api-sp-campaign-daily-raw/v1',
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

export const buildSpCampaignDailyNormalizedArtifact = (args: {
  config: AdsApiProfileSyncEnvConfig;
  dateRange: AdsApiDateRange;
  normalizedCampaignRows: AdsApiSpCampaignDailyNormalizedRow[];
  generatedAt?: string;
}): AdsApiSpCampaignDailyNormalizedArtifact => ({
  schemaVersion: 'ads-api-sp-campaign-daily-normalized/v1',
  generatedAt: args.generatedAt ?? new Date().toISOString(),
  appAccountId: args.config.appAccountId,
  appMarketplace: args.config.appMarketplace,
  adsApiBaseUrl: args.config.apiBaseUrl,
  profileId: args.config.profileId,
  requestedDateRange: args.dateRange,
  rowCount: args.normalizedCampaignRows.length,
  normalizedCampaignRows: args.normalizedCampaignRows,
});

export const downloadSpCampaignDailyReport = async (args: {
  metadata: AdsApiSpCampaignDailyReportMetadata;
  downloadTransport: AdsApiDownloadTransport;
}): Promise<AdsApiSpCampaignDailyRawPayload> => {
  if (!args.metadata.location) {
    throw normalizeReportError(
      'invalid_response',
      'Amazon Ads campaign daily report status did not include a download location'
    );
  }

  let response;
  try {
    response = await args.downloadTransport(args.metadata.location);
  } catch (error) {
    throw normalizeReportError(
      'transport_error',
      'Amazon Ads campaign daily report download failed before a response was received',
      { details: error }
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw normalizeReportError(
      'download_failed',
      `Amazon Ads campaign daily report download failed with status ${response.status}`,
      { status: response.status }
    );
  }

  try {
    return parseSpCampaignDailyDownloadedRows({
      body: response.body,
      headers: response.headers,
    });
  } catch (error) {
    if (error instanceof AdsApiSpCampaignDailyError) {
      throw error;
    }
    throw normalizeReportError(
      'invalid_response',
      'Amazon Ads campaign daily report download returned an invalid payload',
      { details: error }
    );
  }
};

export const writeSpCampaignDailyArtifacts = (args: {
  rawArtifact: AdsApiSpCampaignDailyRawArtifact;
  normalizedArtifact: AdsApiSpCampaignDailyNormalizedArtifact;
  rawArtifactPath?: string;
  normalizedArtifactPath?: string;
}): { rawArtifactPath: string; normalizedArtifactPath: string } => {
  const rawArtifactPath =
    args.rawArtifactPath ?? ADS_API_SP_CAMPAIGN_DAILY_RAW_ARTIFACT_PATH;
  const normalizedArtifactPath =
    args.normalizedArtifactPath ?? ADS_API_SP_CAMPAIGN_DAILY_NORMALIZED_ARTIFACT_PATH;

  fs.mkdirSync(path.dirname(rawArtifactPath), { recursive: true });
  fs.mkdirSync(path.dirname(normalizedArtifactPath), { recursive: true });

  fs.writeFileSync(rawArtifactPath, `${JSON.stringify(args.rawArtifact, null, 2)}\n`);
  fs.writeFileSync(
    normalizedArtifactPath,
    `${JSON.stringify(args.normalizedArtifact, null, 2)}\n`
  );

  return {
    rawArtifactPath,
    normalizedArtifactPath,
  };
};

export const runSpCampaignDailyPull = async (args: {
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
  onPollUpdate?: (update: SpCampaignDailyPollUpdate) => void;
  pendingStore?: SpCampaignDailyPendingRequestStore | null;
  resumePendingOnly?: boolean;
  diagnosticPath?: string | null;
}): Promise<{
  validatedArtifact: AdsApiValidatedProfileSyncArtifact;
  metadata: AdsApiSpCampaignDailyReportMetadata;
  rawArtifact: AdsApiSpCampaignDailyRawArtifact;
  normalizedArtifact: AdsApiSpCampaignDailyNormalizedArtifact;
  rawArtifactPath: string;
  normalizedArtifactPath: string;
}> => {
  const validatedArtifact = validateProfileSyncArtifactForSpCampaignDaily({
    config: args.config,
    artifactPath: args.artifactPath,
  });

  const metadata = await requestSpCampaignDailyReport({
    config: args.config,
    accessToken: args.accessToken,
    dateRange: args.dateRange,
    transport: args.transport,
    maxAttempts: args.maxAttempts,
    pollIntervalMs: args.pollIntervalMs,
    sleep: args.sleep,
    onPollUpdate: args.onPollUpdate,
    pendingStore: args.pendingStore,
    resumePendingOnly: args.resumePendingOnly,
    diagnosticPath: args.diagnosticPath,
  });

  const rawRowsPayload = await downloadSpCampaignDailyReport({
    metadata,
    downloadTransport: args.downloadTransport,
  });

  const normalizedCampaignRows = normalizeSpCampaignDailyRows({
    rawRowsPayload,
    appAccountId: args.config.appAccountId,
    appMarketplace: args.config.appMarketplace,
    profileId: args.config.profileId,
  });

  const rawArtifact = buildSpCampaignDailyRawArtifact({
    config: args.config,
    dateRange: args.dateRange,
    metadata,
    rawRowsPayload,
    generatedAt: args.generatedAt,
  });

  const normalizedArtifact = buildSpCampaignDailyNormalizedArtifact({
    config: args.config,
    dateRange: args.dateRange,
    normalizedCampaignRows,
    generatedAt: args.generatedAt,
  });

  const paths = writeSpCampaignDailyArtifacts({
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
