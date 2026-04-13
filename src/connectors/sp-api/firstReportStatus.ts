import { refreshSpApiAccessToken } from './auth';
import { buildReportsGetReportPath, resolveSpApiEndpoint } from './endpoints';
import { loadSpApiEnv, type SpApiEnvSource } from './env';
import { FIRST_SALES_AND_TRAFFIC_REPORT_TYPE } from './firstReportRequest';
import {
  SP_API_REPORT_PROCESSING_STATUSES,
  SpApiRequestError,
  type SpApiFirstReportStatusPollMode,
  type SpApiFirstReportStatusSummary,
  type SpApiRegion,
  type SpApiReportProcessingStatus,
  type SpApiReportType,
  type SpApiTransport,
  type SpApiTransportRequest,
  type SpApiTransportResponse,
} from './types';

export const DEFAULT_FIRST_REPORT_STATUS_MAX_ATTEMPTS = 12;
export const DEFAULT_FIRST_REPORT_STATUS_POLL_INTERVAL_MS = 5000;

const NON_TERMINAL_STATUSES: readonly SpApiReportProcessingStatus[] = [
  'IN_QUEUE',
  'IN_PROGRESS',
];

const createFetchTransport = (): SpApiTransport => {
  return async (request: SpApiTransportRequest): Promise<SpApiTransportResponse> => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    const text = await response.text();
    let json: unknown = null;
    if (text.trim().length > 0) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { message: text.slice(0, 500) };
      }
    }

    return {
      status: response.status,
      json,
    };
  };
};

const waitForMs = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const asObject = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asProcessingStatus = (value: unknown): SpApiReportProcessingStatus | null => {
  if (typeof value !== 'string') return null;

  return (
    SP_API_REPORT_PROCESSING_STATUSES.find((entry) => entry === value) ?? null
  );
};

const parsePositiveInteger = (value: number, fieldName: string) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new SpApiRequestError(
      'request_build_error',
      `${fieldName} must be a positive integer`
    );
  }

  return value;
};

const parseNonNegativeInteger = (value: number, fieldName: string) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new SpApiRequestError(
      'request_build_error',
      `${fieldName} must be a non-negative integer`
    );
  }

  return value;
};

const parseReportStatusResponse = (value: unknown) => {
  const candidate = asObject(value);
  const reportId = asString(candidate?.reportId);
  const processingStatus = asProcessingStatus(candidate?.processingStatus);
  const reportType = asString(candidate?.reportType);

  if (!reportId || !processingStatus) {
    return null;
  }

  if (reportType && reportType !== FIRST_SALES_AND_TRAFFIC_REPORT_TYPE) {
    return null;
  }

  return {
    reportId,
    reportType: (reportType as SpApiReportType | null) ?? null,
    processingStatus,
    processingStartTime: asString(candidate?.processingStartTime),
    processingEndTime: asString(candidate?.processingEndTime),
    reportDocumentId: asString(candidate?.reportDocumentId),
  };
};

export const isTerminalFirstSalesAndTrafficReportStatus = (
  status: SpApiReportProcessingStatus
) => !NON_TERMINAL_STATUSES.includes(status);

export const buildFirstSalesAndTrafficReportStatusRequest = (args: {
  region: SpApiRegion;
  accessToken: string;
  reportId: string;
}): SpApiTransportRequest => {
  const accessToken = args.accessToken.trim();
  if (!accessToken) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API report status request requires a non-empty access token'
    );
  }

  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API report status request requires a non-empty report id'
    );
  }

  return {
    url: `${resolveSpApiEndpoint(args.region)}${buildReportsGetReportPath(reportId)}`,
    method: 'GET',
    headers: {
      'user-agent': 'amazon-performance-hub/v2-spapi-first-report-status',
      'x-amz-access-token': accessToken,
    },
  };
};

export const summarizeFirstSalesAndTrafficReportStatus = (args: {
  region: SpApiRegion;
  marketplaceId: string;
  reportId: string;
  reportType: SpApiReportType | null;
  processingStatus: SpApiReportProcessingStatus;
  attemptCount: number;
  maxAttempts: number;
  processingStartTime: string | null;
  processingEndTime: string | null;
  reportDocumentId: string | null;
}): SpApiFirstReportStatusSummary => {
  const terminalReached = isTerminalFirstSalesAndTrafficReportStatus(
    args.processingStatus
  );

  return {
    endpoint: 'getReport',
    region: args.region,
    marketplaceId: args.marketplaceId,
    reportId: args.reportId,
    reportType: args.reportType,
    processingStatus: args.processingStatus,
    terminalReached,
    maxAttemptsReached: !terminalReached && args.attemptCount >= args.maxAttempts,
    attemptCount: args.attemptCount,
    processingStartTime: args.processingStartTime,
    processingEndTime: args.processingEndTime,
    reportDocumentId: args.reportDocumentId,
  };
};

export const pollFirstSalesAndTrafficReportStatus = async (args: {
  reportId: string;
  mode?: SpApiFirstReportStatusPollMode;
  maxAttempts?: number;
  pollIntervalMs?: number;
  envSource?: SpApiEnvSource;
  tokenTransport?: SpApiTransport;
  apiTransport?: SpApiTransport;
  wait?: (ms: number) => Promise<void>;
}): Promise<SpApiFirstReportStatusSummary> => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API report status polling requires a non-empty report id'
    );
  }

  const mode = args.mode ?? 'poll-until-terminal';
  const maxAttempts =
    mode === 'single-check'
      ? 1
      : parsePositiveInteger(
          args.maxAttempts ?? DEFAULT_FIRST_REPORT_STATUS_MAX_ATTEMPTS,
          'maxAttempts'
        );
  const pollIntervalMs = parseNonNegativeInteger(
    args.pollIntervalMs ?? DEFAULT_FIRST_REPORT_STATUS_POLL_INTERVAL_MS,
    'pollIntervalMs'
  );

  const config = loadSpApiEnv(args.envSource);
  const tokenTransport = args.tokenTransport ?? createFetchTransport();
  const apiTransport = args.apiTransport ?? createFetchTransport();
  const wait = args.wait ?? waitForMs;

  const tokenResult = await refreshSpApiAccessToken({
    config,
    transport: tokenTransport,
  });

  if (!tokenResult.ok) {
    throw tokenResult.error;
  }

  const request = buildFirstSalesAndTrafficReportStatusRequest({
    region: config.region,
    accessToken: tokenResult.accessToken,
    reportId,
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: SpApiTransportResponse;
    try {
      response = await apiTransport(request);
    } catch (error) {
      throw new SpApiRequestError(
        'api_response_error',
        'SP-API report status request failed before receiving a response',
        { details: error }
      );
    }

    if (response.status < 200 || response.status >= 300) {
      throw new SpApiRequestError(
        'api_response_error',
        `SP-API report status request failed with status ${response.status}`,
        { status: response.status, details: response.json }
      );
    }

    const parsed = parseReportStatusResponse(response.json);
    if (!parsed) {
      throw new SpApiRequestError(
        'invalid_response',
        'SP-API report status request returned an invalid response payload',
        { status: response.status, details: response.json }
      );
    }

    const summary = summarizeFirstSalesAndTrafficReportStatus({
      region: config.region,
      marketplaceId: config.marketplaceId,
      reportId: parsed.reportId,
      reportType: parsed.reportType,
      processingStatus: parsed.processingStatus,
      attemptCount: attempt,
      maxAttempts,
      processingStartTime: parsed.processingStartTime,
      processingEndTime: parsed.processingEndTime,
      reportDocumentId: parsed.reportDocumentId,
    });

    if (
      summary.terminalReached ||
      summary.maxAttemptsReached ||
      mode === 'single-check'
    ) {
      return summary;
    }

    await wait(pollIntervalMs);
  }

  throw new SpApiRequestError(
    'invalid_response',
    'SP-API report status polling exhausted its bounded attempts without a summary'
  );
};

export const getFirstSalesAndTrafficReportStatusEndpointSummary = (args: {
  reportId: string;
  envSource?: SpApiEnvSource;
}) => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API report status summary requires a non-empty report id'
    );
  }

  const config = loadSpApiEnv(args.envSource);

  return {
    region: config.region,
    endpoint: resolveSpApiEndpoint(config.region),
    path: buildReportsGetReportPath(reportId),
    marketplaceId: config.marketplaceId,
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    reportId,
  };
};
