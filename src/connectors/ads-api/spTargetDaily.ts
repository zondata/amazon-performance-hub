import fs from 'node:fs';
import path from 'node:path';

import {
  ADS_API_PROFILE_SYNC_ARTIFACT_PATH,
  adsApiDownloadTransport,
  buildAdsApiDateRange,
  parseSpCampaignDailyDownloadedRows,
} from './spCampaignDaily';
import {
  AdsApiSpTargetDailyError,
  type AdsApiDateRange,
  type AdsApiDownloadTransport,
  type AdsApiProfileSyncEnvConfig,
  type AdsApiProfilesSyncArtifact,
  type AdsApiSpTargetDailyCreateRequest,
  type AdsApiSpTargetDailyNormalizedArtifact,
  type AdsApiSpTargetDailyNormalizedRow,
  type AdsApiSpTargetDailyRawArtifact,
  type AdsApiSpTargetDailyRawPayload,
  type AdsApiSpTargetDailyReportMetadata,
  type AdsApiTransport,
  type AdsApiTransportRequest,
  type AdsApiValidatedProfileSyncArtifact,
} from './types';

export { adsApiDownloadTransport, buildAdsApiDateRange };

export const ADS_API_SP_TARGET_DAILY_RAW_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-sp-target-daily/raw/sp-target-daily.raw.json'
);

export const ADS_API_SP_TARGET_DAILY_NORMALIZED_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-sp-target-daily/normalized/sp-target-daily.normalized.json'
);

export const ADS_API_SP_TARGET_DAILY_DIAGNOSTIC_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-sp-target-daily/diagnostics/sp-target-daily.polling-diagnostic.json'
);

const REPORTING_REPORTS_PATH = '/reporting/reports';
const SP_TARGET_REPORT_COLUMNS = [
  'campaignId',
  'campaignName',
  'adGroupId',
  'adGroupName',
  'keywordId',
  'targeting',
  'keyword',
  'matchType',
  'keywordType',
  'adKeywordStatus',
  'date',
  'impressions',
  'clicks',
  'cost',
  'sales14d',
  'purchases14d',
  'campaignBudgetCurrencyCode',
] as const;

export const MAX_SP_TARGET_DAILY_WINDOW_DAYS = 31;
export const DEFAULT_SP_TARGET_DAILY_MAX_ATTEMPTS = 180;
export const DEFAULT_SP_TARGET_DAILY_POLL_INTERVAL_MS = 5000;
export const TERMINAL_SP_TARGET_DAILY_SUCCESS_STATUSES = [
  'SUCCESS',
  'COMPLETED',
  'DONE',
] as const;
export const TERMINAL_SP_TARGET_DAILY_FAILURE_STATUSES = [
  'FAILURE',
  'FAILED',
  'CANCELLED',
  'CANCELED',
] as const;
export const POLLABLE_SP_TARGET_DAILY_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'PROCESSING',
  'QUEUED',
] as const;

const DUPLICATE_REPORT_ID_PATTERN =
  /duplicate of\s*:\s*(?<reportId>[0-9a-fA-F-]{36})/i;

type SpTargetDailyPendingRequestRecord = {
  reportId: string;
  status: string | null;
  statusDetails: string | null;
  attemptCount: number;
  diagnosticPath: string | null;
  lastResponseJson: Record<string, unknown>;
};

type SpTargetDailyPendingRequestState = {
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

export interface SpTargetDailyPendingRequestStore {
  findReusablePendingRequest(args: {
    accountId: string;
    marketplace: string;
    profileId: string;
    reportTypeId: string;
    sourceType: string;
    startDate: string;
    endDate: string;
  }): Promise<SpTargetDailyPendingRequestRecord | null>;
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
    state: SpTargetDailyPendingRequestState;
  }): Promise<void>;
}

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const maskProfileId = (value: string): string =>
  value.length <= 4 ? '****' : `${'*'.repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;

const readHeader = (
  headers: Record<string, string | null> | undefined,
  name: string
): string | null => headers?.[name.toLowerCase()] ?? null;

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
    return value
      .replace(
        /((?:access|refresh|client|service[_-]?role|session|bearer|token|signature)[_-]?token?["'=:\s]+)([^\s'",]+)/gi,
        '$1[REDACTED]'
      )
      .replace(/(authorization:\s*bearer\s+)([^\s]+)/gi, '$1[REDACTED]')
      .replace(/([?&](?:token|signature|x-amz-signature|x-amz-credential|x-amz-security-token|x-amz-date|x-amz-expires)=)([^&]+)/gi, '$1[REDACTED]');
  }
  return value;
};

const isSpTargetSuccessStatus = (status: string | null): boolean =>
  status != null &&
  (TERMINAL_SP_TARGET_DAILY_SUCCESS_STATUSES as readonly string[]).includes(status);

const isSpTargetFailureStatus = (status: string | null): boolean =>
  status != null &&
  (TERMINAL_SP_TARGET_DAILY_FAILURE_STATUSES as readonly string[]).includes(status);

const toSpTargetPendingRequestStatus = (
  status: string | null,
  fallback: SpTargetDailyPendingRequestState['status']
): SpTargetDailyPendingRequestState['status'] => {
  const normalized = status?.toUpperCase() ?? null;
  if (isSpTargetSuccessStatus(normalized)) return 'completed';
  if (isSpTargetFailureStatus(normalized)) return 'failed';
  if (
    normalized &&
    (POLLABLE_SP_TARGET_DAILY_STATUSES as readonly string[]).includes(normalized)
  ) {
    return normalized === 'PENDING' ? 'pending' : 'polling';
  }
  return fallback;
};

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

export const validateProfileSyncArtifactForSpTargetDaily = (args: {
  config: AdsApiProfileSyncEnvConfig;
  artifactPath?: string;
}): AdsApiValidatedProfileSyncArtifact => {
  const artifactPath = args.artifactPath ?? ADS_API_PROFILE_SYNC_ARTIFACT_PATH;

  if (!fs.existsSync(artifactPath)) {
    throw new AdsApiSpTargetDailyError(
      'profile_sync_artifact_missing',
      `Missing profile-sync artifact: ${artifactPath}`
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  } catch (error) {
    throw new AdsApiSpTargetDailyError(
      'profile_sync_artifact_invalid',
      'Profile-sync artifact is not valid JSON.',
      { details: error }
    );
  }

  const artifact = parseProfileSyncArtifact(parsedJson);
  if (!artifact || !readString(artifact.schemaVersion)) {
    throw new AdsApiSpTargetDailyError(
      'profile_sync_artifact_invalid',
      'Profile-sync artifact is missing required fields.'
    );
  }

  if (artifact.configuredProfileId !== args.config.profileId) {
    throw new AdsApiSpTargetDailyError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact configuredProfileId does not match AMAZON_ADS_PROFILE_ID.'
    );
  }

  if (artifact.appAccountId !== args.config.appAccountId) {
    throw new AdsApiSpTargetDailyError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact appAccountId does not match APP_ACCOUNT_ID.'
    );
  }

  if (artifact.appMarketplace !== args.config.appMarketplace) {
    throw new AdsApiSpTargetDailyError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact appMarketplace does not match APP_MARKETPLACE.'
    );
  }

  const selectedProfileId = readString(artifact.selectedProfile?.profileId);
  if (!selectedProfileId) {
    throw new AdsApiSpTargetDailyError(
      'profile_sync_artifact_invalid',
      'Profile-sync artifact selectedProfile is missing.'
    );
  }

  if (selectedProfileId !== artifact.configuredProfileId) {
    throw new AdsApiSpTargetDailyError(
      'profile_sync_artifact_mismatch',
      'Profile-sync artifact selectedProfile.profileId does not match configuredProfileId.'
    );
  }

  return artifact as AdsApiValidatedProfileSyncArtifact;
};

export const buildSpTargetDailyHeaders = (args: {
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

export const buildSpTargetDailyCreateRequestBody = (args: {
  dateRange: AdsApiDateRange;
}): AdsApiSpTargetDailyCreateRequest => ({
  name: `sp-target-daily-${args.dateRange.startDate}-${args.dateRange.endDate}`,
  startDate: args.dateRange.startDate,
  endDate: args.dateRange.endDate,
  configuration: {
    adProduct: 'SPONSORED_PRODUCTS',
    groupBy: ['targeting'],
    columns: [...SP_TARGET_REPORT_COLUMNS],
    reportTypeId: 'spTargeting',
    timeUnit: 'DAILY',
    format: 'GZIP_JSON',
  },
});

export const buildSpTargetDailyCreateRequest = (args: {
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
    buildSpTargetDailyCreateRequestBody({
      dateRange: args.dateRange,
    })
  ),
});

export const buildSpTargetDailyStatusRequest = (args: {
  config: AdsApiProfileSyncEnvConfig;
  accessToken: string;
  reportId: string;
}): AdsApiTransportRequest => ({
  url: `${args.config.apiBaseUrl}${REPORTING_REPORTS_PATH}/${args.reportId}`,
  method: 'GET',
  headers: buildSpTargetDailyHeaders({
    config: args.config,
    accessToken: args.accessToken,
  }),
});

export const parseSpTargetDailyReportMetadata = (
  value: unknown
): AdsApiSpTargetDailyReportMetadata | null => {
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
    | 'transport_error'
    | 'report_request_failed'
    | 'invalid_response'
    | 'report_timeout'
    | 'pending_timeout'
    | 'report_failed'
    | 'download_failed',
  message: string,
  options: { status?: number; details?: unknown } = {}
) => new AdsApiSpTargetDailyError(code, message, options);

export const requestSpTargetDailyReport = async (args: {
  config: AdsApiProfileSyncEnvConfig;
  accessToken: string;
  dateRange: AdsApiDateRange;
  transport: AdsApiTransport;
  maxAttempts?: number;
  pollIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  pendingStore?: SpTargetDailyPendingRequestStore | null;
  resumePendingOnly?: boolean;
  diagnosticPath?: string | null;
}): Promise<AdsApiSpTargetDailyReportMetadata> => {
  const maxAttempts = args.maxAttempts ?? DEFAULT_SP_TARGET_DAILY_MAX_ATTEMPTS;
  const pollIntervalMs =
    args.pollIntervalMs ?? DEFAULT_SP_TARGET_DAILY_POLL_INTERVAL_MS;
  const sleep =
    args.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const requestPayload = buildSpTargetDailyCreateRequestBody({
    dateRange: args.dateRange,
  }) as Record<string, unknown>;
  const sourceType = 'ads_api_sp_target_daily';
  const targetTable = 'sp_targeting_daily_fact';
  const resolveRetryAfterAt = (value: string | null): string | null => {
    if (!value) return null;
    const seconds = Number.parseInt(value, 10);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return new Date(Date.now() + seconds * 1000).toISOString();
  };
  const persistPendingState = async (state: SpTargetDailyPendingRequestState): Promise<void> => {
    if (!args.pendingStore) return;
    await args.pendingStore.upsertPendingRequest({
      accountId: args.config.appAccountId,
      marketplace: args.config.appMarketplace,
      profileId: args.config.profileId,
      adProduct: 'SPONSORED_PRODUCTS',
      reportTypeId: 'spTargets',
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
      reportTypeId: 'spTargets',
      sourceType,
      startDate: args.dateRange.startDate,
      endDate: args.dateRange.endDate,
    })) ?? null;

  if (!reusablePending && args.resumePendingOnly) {
    throw normalizeReportError(
      'pending_timeout',
      `No reusable pending Ads SP target report was found for ${args.dateRange.startDate} -> ${args.dateRange.endDate}.`
    );
  }

  let createResponse;
  let createResponseHeaders: Record<string, string | null> | undefined;
  let createResponseJson: unknown = {};
  let latest = reusablePending
    ? ({
        reportId: reusablePending.reportId,
        status: reusablePending.status,
        statusDetails: reusablePending.statusDetails,
        location: null,
        fileSize: null,
      } satisfies AdsApiSpTargetDailyReportMetadata)
    : await (async (): Promise<AdsApiSpTargetDailyReportMetadata> => {
        try {
          createResponse = await args.transport(
            buildSpTargetDailyCreateRequest({
              config: args.config,
              accessToken: args.accessToken,
              dateRange: args.dateRange,
            })
          );
          createResponseJson = createResponse.json;
          createResponseHeaders = createResponse.headers;
        } catch (error) {
          throw normalizeReportError(
            'transport_error',
            'Amazon Ads target daily report request failed before a response was received',
            { details: error }
          );
        }

        const duplicateReportId =
          createResponse.status === 425
            ? extractDuplicateReportId(createResponse.json)
            : null;

        if (
          (createResponse.status < 200 || createResponse.status >= 300) &&
          !duplicateReportId
        ) {
          throw normalizeReportError(
            'report_request_failed',
            `Amazon Ads target daily report request failed with status ${createResponse.status}`,
            { status: createResponse.status, details: createResponse.json }
          );
        }

        const created =
          duplicateReportId != null
            ? ({
                reportId: duplicateReportId,
                status: 'PENDING',
                statusDetails: 'duplicate_report_request',
                location: null,
                fileSize: null,
              } satisfies AdsApiSpTargetDailyReportMetadata)
            : parseSpTargetDailyReportMetadata(createResponse.json);

        if (!created) {
          throw normalizeReportError(
            'invalid_response',
            'Amazon Ads target daily report request returned an invalid response payload',
            { status: createResponse.status, details: createResponse.json }
          );
        }

        await persistPendingState({
          reportId: created.reportId,
          status: toSpTargetPendingRequestStatus(created.status, 'requested'),
          statusDetails: created.statusDetails,
          attemptCount: 0,
          requestPayloadJson: requestPayload,
          lastResponseJson: sanitizeJsonValue(createResponse.json) as Record<string, unknown>,
          diagnosticPath: args.diagnosticPath ?? null,
          notes: duplicateReportId
            ? 'Amazon returned a duplicate-report id; reusing the existing target report.'
            : null,
          retryAfterAt: null,
          lastPolledAt: null,
          completedAt: null,
          failedAt: null,
        });

        return created;
      })();

  let lastResponseJson: unknown =
    reusablePending?.lastResponseJson ?? createResponseJson;
  let lastRetryAfter = readHeader(createResponseHeaders, 'retry-after');
  await persistPendingState({
    reportId: latest.reportId,
    status: toSpTargetPendingRequestStatus(
      latest.status,
      reusablePending ? 'pending' : 'requested'
    ),
    statusDetails: latest.statusDetails,
    attemptCount: reusablePending?.attemptCount ?? 0,
    requestPayloadJson: requestPayload,
    lastResponseJson: sanitizeJsonValue(lastResponseJson) as Record<string, unknown>,
    diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
    notes: reusablePending
      ? 'Reused an existing pending target report id before creating a new one.'
      : null,
    retryAfterAt: null,
    lastPolledAt: new Date().toISOString(),
    completedAt: null,
    failedAt: null,
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const status = latest.status?.toUpperCase() ?? null;
    if (isSpTargetSuccessStatus(status)) {
      await persistPendingState({
        reportId: latest.reportId,
        status: 'completed',
        statusDetails: latest.statusDetails,
        attemptCount: (reusablePending?.attemptCount ?? 0) + attempt - 1,
        requestPayloadJson: requestPayload,
        lastResponseJson: sanitizeJsonValue(lastResponseJson) as Record<string, unknown>,
        diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
        notes: 'Amazon Ads SP target report reached a terminal success status.',
        retryAfterAt: null,
        lastPolledAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        failedAt: null,
      });
      return latest;
    }

    if (latest.location && !status) {
      return latest;
    }

    if (isSpTargetFailureStatus(status)) {
      const failedAt = new Date().toISOString();
      await persistPendingState({
        reportId: latest.reportId,
        status: 'failed',
        statusDetails: latest.statusDetails,
        attemptCount: (reusablePending?.attemptCount ?? 0) + attempt - 1,
        requestPayloadJson: requestPayload,
        lastResponseJson: sanitizeJsonValue(lastResponseJson) as Record<string, unknown>,
        diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
        notes: `Amazon Ads SP target report reached terminal failure status ${latest.status}.`,
        retryAfterAt: null,
        lastPolledAt: failedAt,
        completedAt: null,
        failedAt,
      });
      throw normalizeReportError(
        'report_failed',
        `Amazon Ads target daily report ended with terminal status ${latest.status}`,
        { details: latest }
      );
    }

    let statusResponse;
    try {
      statusResponse = await args.transport(
        buildSpTargetDailyStatusRequest({
          config: args.config,
          accessToken: args.accessToken,
          reportId: latest.reportId,
        })
      );
    } catch (error) {
      throw normalizeReportError(
        'transport_error',
        'Amazon Ads target daily report status request failed before a response was received',
        { details: error }
      );
    }

    if (statusResponse.status < 200 || statusResponse.status >= 300) {
      throw normalizeReportError(
        'report_request_failed',
        `Amazon Ads target daily report status request failed with status ${statusResponse.status}`,
        { status: statusResponse.status, details: statusResponse.json }
      );
    }

    const parsedStatus = parseSpTargetDailyReportMetadata(statusResponse.json);
    if (!parsedStatus) {
      throw normalizeReportError(
        'invalid_response',
        'Amazon Ads target daily report status request returned an invalid response payload',
        { status: statusResponse.status, details: statusResponse.json }
      );
    }

    latest = parsedStatus;
    lastResponseJson = statusResponse.json;
    lastRetryAfter = readHeader(statusResponse.headers, 'retry-after');
    await persistPendingState({
      reportId: latest.reportId,
      status: toSpTargetPendingRequestStatus(latest.status?.toUpperCase() ?? null, 'polling'),
      statusDetails: latest.statusDetails,
      attemptCount: (reusablePending?.attemptCount ?? 0) + attempt,
      requestPayloadJson: requestPayload,
      lastResponseJson: sanitizeJsonValue(statusResponse.json) as Record<string, unknown>,
      diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
      notes: null,
      retryAfterAt: resolveRetryAfterAt(lastRetryAfter),
      lastPolledAt: new Date().toISOString(),
      completedAt: null,
      failedAt: null,
    });

    const nextStatus = latest.status?.toUpperCase() ?? null;
    if (isSpTargetSuccessStatus(nextStatus)) {
      await persistPendingState({
        reportId: latest.reportId,
        status: 'completed',
        statusDetails: latest.statusDetails,
        attemptCount: (reusablePending?.attemptCount ?? 0) + attempt,
        requestPayloadJson: requestPayload,
        lastResponseJson: sanitizeJsonValue(statusResponse.json) as Record<string, unknown>,
        diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
        notes: 'Amazon Ads SP target report reached a terminal success status.',
        retryAfterAt: null,
        lastPolledAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        failedAt: null,
      });
      return latest;
    }

    if (latest.location) {
      return latest;
    }

    if (isSpTargetFailureStatus(nextStatus)) {
      const failedAt = new Date().toISOString();
      await persistPendingState({
        reportId: latest.reportId,
        status: 'failed',
        statusDetails: latest.statusDetails,
        attemptCount: (reusablePending?.attemptCount ?? 0) + attempt,
        requestPayloadJson: requestPayload,
        lastResponseJson: sanitizeJsonValue(statusResponse.json) as Record<string, unknown>,
        diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
        notes: `Amazon Ads SP target report reached terminal failure status ${latest.status}.`,
        retryAfterAt: null,
        lastPolledAt: new Date().toISOString(),
        completedAt: null,
        failedAt,
      });
      throw normalizeReportError(
        'report_failed',
        `Amazon Ads target daily report ended with terminal status ${latest.status}`,
        { details: latest }
      );
    }

    if (attempt < maxAttempts) {
      await sleep(pollIntervalMs);
    }
  }

  await persistPendingState({
    reportId: latest.reportId,
    status: 'pending_timeout',
    statusDetails: latest.statusDetails,
    attemptCount: (reusablePending?.attemptCount ?? 0) + maxAttempts,
    requestPayloadJson: requestPayload,
    lastResponseJson: sanitizeJsonValue(lastResponseJson) as Record<string, unknown>,
    diagnosticPath: args.diagnosticPath ?? reusablePending?.diagnosticPath ?? null,
    notes:
      'Amazon Ads target daily report remained pending. Retry the saved report id instead of creating a duplicate request.',
    retryAfterAt: resolveRetryAfterAt(lastRetryAfter),
    lastPolledAt: new Date().toISOString(),
    completedAt: null,
    failedAt: null,
  });

  throw normalizeReportError(
    'pending_timeout',
    [
      `Amazon Ads target daily report remained pending after ${maxAttempts} attempts.`,
      `report_id=${latest.reportId}`,
      `date_range=${args.dateRange.startDate}->${args.dateRange.endDate}`,
      `profile_id=${maskProfileId(args.config.profileId)}`,
      `poll_interval_ms=${pollIntervalMs}`,
    ].join(' '),
    { details: latest }
  );
};

export const parseSpTargetDailyDownloadedRows = (args: {
  body: Buffer;
  headers?: Record<string, string | null>;
}): AdsApiSpTargetDailyRawPayload =>
  parseSpCampaignDailyDownloadedRows(args) as AdsApiSpTargetDailyRawPayload;

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
    `Downloaded target daily rows are missing required field ${fieldLabel}`
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
    `Downloaded target daily rows are missing required numeric field ${fieldLabel}`
  );
};

export const normalizeSpTargetDailyRows = (args: {
  rawRowsPayload: AdsApiSpTargetDailyRawPayload;
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
}): AdsApiSpTargetDailyNormalizedRow[] => {
  const normalized = args.rawRowsPayload.rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      appAccountId: args.appAccountId,
      appMarketplace: args.appMarketplace,
      profileId: args.profileId,
      campaignId: requireStringField(record, ['campaignId', 'campaign_id'], 'campaignId'),
      campaignName:
        readStringLike(record.campaignName) ??
        readStringLike(record.campaign_name) ??
        readStringLike(record.campaign) ??
        null,
      adGroupId: requireStringField(
        record,
        ['adGroupId', 'adGroup_id', 'adGroupID', 'ad_group_id'],
        'adGroupId'
      ),
      adGroupName:
        readStringLike(record.adGroupName) ??
        readStringLike(record.ad_group_name) ??
        readStringLike(record.adGroup) ??
        null,
      targetId: requireStringField(record, ['targetId', 'keywordId', 'target_id'], 'targetId'),
      targetingExpression:
        readStringLike(record.targetingExpression) ??
        readStringLike(record.targeting) ??
        readStringLike(record.keyword) ??
        readStringLike(record.keywordText) ??
        readStringLike(record.targetingText) ??
        readStringLike(record.expression) ??
        null,
      matchType:
        readString(record.matchType) ??
        readString(record.match_type) ??
        readString(record.keywordType) ??
        null,
      targetStatus: requireStringField(
        record,
        ['targetStatus', 'adKeywordStatus', 'keywordStatus', 'status', 'target_status'],
        'targetStatus'
      ),
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

    if (left.targetId !== right.targetId) {
      return left.targetId.localeCompare(right.targetId, 'en', {
        numeric: true,
      });
    }

    if (left.adGroupId !== right.adGroupId) {
      return left.adGroupId.localeCompare(right.adGroupId, 'en', {
        numeric: true,
      });
    }

    return left.campaignId.localeCompare(right.campaignId, 'en', {
      numeric: true,
    });
  });
};

export const buildSpTargetDailyRawArtifact = (args: {
  config: AdsApiProfileSyncEnvConfig;
  dateRange: AdsApiDateRange;
  metadata: AdsApiSpTargetDailyReportMetadata;
  rawRowsPayload: AdsApiSpTargetDailyRawPayload;
  generatedAt?: string;
}): AdsApiSpTargetDailyRawArtifact => ({
  schemaVersion: 'ads-api-sp-target-daily-raw/v1',
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

export const buildSpTargetDailyNormalizedArtifact = (args: {
  config: AdsApiProfileSyncEnvConfig;
  dateRange: AdsApiDateRange;
  normalizedTargetRows: AdsApiSpTargetDailyNormalizedRow[];
  generatedAt?: string;
}): AdsApiSpTargetDailyNormalizedArtifact => ({
  schemaVersion: 'ads-api-sp-target-daily-normalized/v1',
  generatedAt: args.generatedAt ?? new Date().toISOString(),
  appAccountId: args.config.appAccountId,
  appMarketplace: args.config.appMarketplace,
  adsApiBaseUrl: args.config.apiBaseUrl,
  profileId: args.config.profileId,
  requestedDateRange: args.dateRange,
  rowCount: args.normalizedTargetRows.length,
  normalizedTargetRows: args.normalizedTargetRows,
});

export const downloadSpTargetDailyReport = async (args: {
  metadata: AdsApiSpTargetDailyReportMetadata;
  downloadTransport: AdsApiDownloadTransport;
}): Promise<AdsApiSpTargetDailyRawPayload> => {
  if (!args.metadata.location) {
    throw normalizeReportError(
      'invalid_response',
      'Amazon Ads target daily report status did not include a download location'
    );
  }

  let response;
  try {
    response = await args.downloadTransport(args.metadata.location);
  } catch (error) {
    throw normalizeReportError(
      'transport_error',
      'Amazon Ads target daily report download failed before a response was received',
      { details: error }
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw normalizeReportError(
      'download_failed',
      `Amazon Ads target daily report download failed with status ${response.status}`,
      { status: response.status }
    );
  }

  try {
    return parseSpTargetDailyDownloadedRows({
      body: response.body,
      headers: response.headers,
    });
  } catch (error) {
    if (error instanceof AdsApiSpTargetDailyError) {
      throw error;
    }
    throw normalizeReportError(
      'invalid_response',
      'Amazon Ads target daily report download returned an invalid payload',
      { details: error }
    );
  }
};

export const writeSpTargetDailyArtifacts = (args: {
  rawArtifact: AdsApiSpTargetDailyRawArtifact;
  normalizedArtifact: AdsApiSpTargetDailyNormalizedArtifact;
  rawArtifactPath?: string;
  normalizedArtifactPath?: string;
}): { rawArtifactPath: string; normalizedArtifactPath: string } => {
  const rawArtifactPath =
    args.rawArtifactPath ?? ADS_API_SP_TARGET_DAILY_RAW_ARTIFACT_PATH;
  const normalizedArtifactPath =
    args.normalizedArtifactPath ??
    ADS_API_SP_TARGET_DAILY_NORMALIZED_ARTIFACT_PATH;

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

export const runSpTargetDailyPull = async (args: {
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
  pendingStore?: SpTargetDailyPendingRequestStore | null;
  resumePendingOnly?: boolean;
  diagnosticPath?: string | null;
}): Promise<{
  validatedArtifact: AdsApiValidatedProfileSyncArtifact;
  metadata: AdsApiSpTargetDailyReportMetadata;
  rawArtifact: AdsApiSpTargetDailyRawArtifact;
  normalizedArtifact: AdsApiSpTargetDailyNormalizedArtifact;
  rawArtifactPath: string;
  normalizedArtifactPath: string;
}> => {
  const validatedArtifact = validateProfileSyncArtifactForSpTargetDaily({
    config: args.config,
    artifactPath: args.artifactPath,
  });

  const metadata = await requestSpTargetDailyReport({
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

  const rawRowsPayload = await downloadSpTargetDailyReport({
    metadata,
    downloadTransport: args.downloadTransport,
  });

  const normalizedTargetRows = normalizeSpTargetDailyRows({
    rawRowsPayload,
    appAccountId: args.config.appAccountId,
    appMarketplace: args.config.appMarketplace,
    profileId: args.config.profileId,
  });

  const rawArtifact = buildSpTargetDailyRawArtifact({
    config: args.config,
    dateRange: args.dateRange,
    metadata,
    rawRowsPayload,
    generatedAt: args.generatedAt,
  });

  const normalizedArtifact = buildSpTargetDailyNormalizedArtifact({
    config: args.config,
    dateRange: args.dateRange,
    normalizedTargetRows,
    generatedAt: args.generatedAt,
  });

  const paths = writeSpTargetDailyArtifacts({
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
