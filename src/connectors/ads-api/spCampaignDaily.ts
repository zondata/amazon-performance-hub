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
    | 'transport_error'
    | 'report_request_failed'
    | 'invalid_response'
    | 'report_timeout'
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
}): Promise<AdsApiSpCampaignDailyReportMetadata> => {
  const maxAttempts = args.maxAttempts ?? 180;
  const pollIntervalMs = args.pollIntervalMs ?? 5000;
  const sleep = args.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let createResponse;

  try {
    createResponse = await args.transport(
      buildSpCampaignDailyCreateRequest({
        config: args.config,
        accessToken: args.accessToken,
        dateRange: args.dateRange,
      })
    );
  } catch (error) {
    throw normalizeReportError(
      'transport_error',
      'Amazon Ads campaign daily report request failed before a response was received',
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
      `Amazon Ads campaign daily report request failed with status ${createResponse.status}`,
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
        } satisfies AdsApiSpCampaignDailyReportMetadata)
      : parseSpCampaignDailyReportMetadata(createResponse.json);

  if (!created) {
    throw normalizeReportError(
      'invalid_response',
      'Amazon Ads campaign daily report request returned an invalid response payload',
      { status: createResponse.status, details: createResponse.json }
    );
  }

  let latest = created;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const status = latest.status?.toUpperCase() ?? null;
    if (
      status &&
      (TERMINAL_SP_CAMPAIGN_DAILY_SUCCESS_STATUSES as readonly string[]).includes(status)
    ) {
      return latest;
    }

    if (latest.location && !status) {
      return latest;
    }

    if (
      status &&
      (TERMINAL_SP_CAMPAIGN_DAILY_FAILURE_STATUSES as readonly string[]).includes(status)
    ) {
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

    const nextStatus = latest.status?.toUpperCase() ?? null;
    if (
      nextStatus &&
      (TERMINAL_SP_CAMPAIGN_DAILY_SUCCESS_STATUSES as readonly string[]).includes(nextStatus)
    ) {
      return latest;
    }

    if (latest.location) {
      return latest;
    }

    if (
      nextStatus &&
      (TERMINAL_SP_CAMPAIGN_DAILY_FAILURE_STATUSES as readonly string[]).includes(nextStatus)
    ) {
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

  throw normalizeReportError(
    'report_timeout',
    `Amazon Ads campaign daily report did not reach a terminal status after ${maxAttempts} attempts`,
    { details: latest }
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
