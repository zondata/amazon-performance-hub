import { loadSpApiEnv, type SpApiEnvSource } from './env';
import { refreshSpApiAccessToken } from './auth';
import { REPORTS_CREATE_REPORT_PATH, resolveSpApiEndpoint } from './endpoints';
import {
  SpApiRequestError,
  type SpApiFirstReportRequestSummary,
  type SpApiRegion,
  type SpApiReportCreateRequestBody,
  type SpApiReportType,
  type SpApiTransport,
  type SpApiTransportRequest,
  type SpApiTransportResponse,
} from './types';

export const FIRST_SALES_AND_TRAFFIC_REPORT_TYPE: SpApiReportType =
  'GET_SALES_AND_TRAFFIC_REPORT';

export const FIRST_SALES_AND_TRAFFIC_REPORT_OPTIONS = {
  dateGranularity: 'DAY',
  asinGranularity: 'PARENT',
  skuGranularity: 'TOTAL',
} as const;

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

const asObject = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const startOfUtcDay = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

export const buildFirstSalesAndTrafficReportWindow = (now: Date = new Date()) => {
  const currentDayStart = startOfUtcDay(now);
  const previousDayEnd = new Date(currentDayStart.getTime() - 1000);
  const previousDayStart = startOfUtcDay(previousDayEnd);

  return {
    dataStartTime: previousDayStart.toISOString(),
    dataEndTime: previousDayEnd.toISOString(),
  };
};

export const buildFirstSalesAndTrafficReportRequestBody = (args: {
  marketplaceId: string;
  now?: Date;
}): SpApiReportCreateRequestBody => {
  const marketplaceId = args.marketplaceId.trim();
  if (!marketplaceId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API report request requires a non-empty marketplace id'
    );
  }

  const window = buildFirstSalesAndTrafficReportWindow(args.now);

  return {
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    marketplaceIds: [marketplaceId],
    dataStartTime: window.dataStartTime,
    dataEndTime: window.dataEndTime,
    reportOptions: { ...FIRST_SALES_AND_TRAFFIC_REPORT_OPTIONS },
  };
};

export const buildFirstSalesAndTrafficReportRequest = (args: {
  region: SpApiRegion;
  accessToken: string;
  marketplaceId: string;
  now?: Date;
}): SpApiTransportRequest => {
  const accessToken = args.accessToken.trim();
  if (!accessToken) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API report request requires a non-empty access token'
    );
  }

  return {
    url: `${resolveSpApiEndpoint(args.region)}${REPORTS_CREATE_REPORT_PATH}`,
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'user-agent': 'amazon-performance-hub/v2-spapi-first-report-request',
      'x-amz-access-token': accessToken,
    },
    body: JSON.stringify(
      buildFirstSalesAndTrafficReportRequestBody({
        marketplaceId: args.marketplaceId,
        now: args.now,
      })
    ),
  };
};

const parseCreateReportResponse = (value: unknown) => {
  const candidate = asObject(value);
  const reportId = asString(candidate?.reportId);

  if (!reportId) {
    return null;
  }

  return { reportId };
};

export const summarizeFirstSalesAndTrafficReportRequest = (args: {
  region: SpApiRegion;
  marketplaceId: string;
  reportId: string;
}): SpApiFirstReportRequestSummary => ({
  endpoint: 'createReport',
  region: args.region,
  marketplaceId: args.marketplaceId,
  reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
  reportId: args.reportId,
});

export const createFirstSalesAndTrafficReportRequest = async (args?: {
  envSource?: SpApiEnvSource;
  tokenTransport?: SpApiTransport;
  apiTransport?: SpApiTransport;
  now?: Date;
}): Promise<SpApiFirstReportRequestSummary> => {
  const config = loadSpApiEnv(args?.envSource);
  const tokenTransport = args?.tokenTransport ?? createFetchTransport();
  const apiTransport = args?.apiTransport ?? createFetchTransport();

  const tokenResult = await refreshSpApiAccessToken({
    config,
    transport: tokenTransport,
  });

  if (!tokenResult.ok) {
    throw tokenResult.error;
  }

  const request = buildFirstSalesAndTrafficReportRequest({
    region: config.region,
    accessToken: tokenResult.accessToken,
    marketplaceId: config.marketplaceId,
    now: args?.now,
  });

  let response: SpApiTransportResponse;
  try {
    response = await apiTransport(request);
  } catch (error) {
    throw new SpApiRequestError(
      'api_response_error',
      'SP-API first report request failed before receiving a response',
      { details: error }
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API first report request failed with status ${response.status}`,
      { status: response.status, details: response.json }
    );
  }

  const parsed = parseCreateReportResponse(response.json);
  if (!parsed) {
    throw new SpApiRequestError(
      'invalid_response',
      'SP-API first report request returned an invalid response payload',
      { status: response.status, details: response.json }
    );
  }

  return summarizeFirstSalesAndTrafficReportRequest({
    region: config.region,
    marketplaceId: config.marketplaceId,
    reportId: parsed.reportId,
  });
};

export const getFirstSalesAndTrafficReportEndpointSummary = (
  envSource?: SpApiEnvSource
) => {
  const config = loadSpApiEnv(envSource);

  return {
    region: config.region,
    endpoint: resolveSpApiEndpoint(config.region),
    path: REPORTS_CREATE_REPORT_PATH,
    marketplaceId: config.marketplaceId,
    reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
  };
};
