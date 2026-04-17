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

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
}): Promise<AdsApiSpTargetDailyReportMetadata> => {
  const maxAttempts = args.maxAttempts ?? 180;
  const pollIntervalMs = args.pollIntervalMs ?? 5000;
  const sleep =
    args.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let createResponse;

  try {
    createResponse = await args.transport(
      buildSpTargetDailyCreateRequest({
        config: args.config,
        accessToken: args.accessToken,
        dateRange: args.dateRange,
      })
    );
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

  let latest = created;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const status = latest.status?.toUpperCase() ?? null;
    if (
      status &&
      (TERMINAL_SP_TARGET_DAILY_SUCCESS_STATUSES as readonly string[]).includes(status)
    ) {
      return latest;
    }

    if (latest.location && !status) {
      return latest;
    }

    if (
      status &&
      (TERMINAL_SP_TARGET_DAILY_FAILURE_STATUSES as readonly string[]).includes(status)
    ) {
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
          reportId: created.reportId,
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

    const nextStatus = latest.status?.toUpperCase() ?? null;
    if (
      nextStatus &&
      (TERMINAL_SP_TARGET_DAILY_SUCCESS_STATUSES as readonly string[]).includes(nextStatus)
    ) {
      return latest;
    }

    if (latest.location) {
      return latest;
    }

    if (
      nextStatus &&
      (TERMINAL_SP_TARGET_DAILY_FAILURE_STATUSES as readonly string[]).includes(nextStatus)
    ) {
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

  throw normalizeReportError(
    'report_timeout',
    `Amazon Ads target daily report did not reach a terminal status after ${maxAttempts} attempts`,
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
