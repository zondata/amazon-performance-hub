import fs from 'node:fs/promises';
import path from 'node:path';

import { refreshSpApiAccessToken } from './auth';
import {
  buildReportsGetReportDocumentPath,
  buildReportsGetReportPath,
  REPORTS_CREATE_REPORT_PATH,
  resolveSpApiEndpoint,
} from './endpoints';
import { loadSpApiEnv, type SpApiEnvSource } from './env';
import {
  runFirstSpApiSqpParseIngest,
  SP_API_SQP_RAW_OUTPUT_DIR,
} from './firstSqpParseIngest';
import {
  SP_API_REPORT_PROCESSING_STATUSES,
  SpApiRequestError,
  SpApiSqpPullError,
  type SpApiRegion,
  type SpApiReportCreateRequestBody,
  type SpApiReportProcessingStatus,
  type SpApiSqpParseIngestSummary,
  type SpApiSqpRealPullSummary,
  type SpApiTransport,
  type SpApiTransportRequest,
  type SpApiTransportResponse,
} from './types';

export const FIRST_SQP_REPORT_TYPE =
  'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT' as const;
export const FIRST_SQP_REPORT_PERIOD = 'WEEK' as const;
export const DEFAULT_FIRST_SQP_STATUS_MAX_ATTEMPTS = 120;
export const DEFAULT_FIRST_SQP_STATUS_POLL_INTERVAL_MS = 5000;

type SpApiDownloadTransportRequest = {
  url: string;
  method: 'GET';
  headers?: Record<string, string>;
};

type SpApiDownloadTransportResponse = {
  status: number;
  body: Buffer;
  headers: Record<string, string>;
};

type SpApiDownloadTransport = (
  request: SpApiDownloadTransportRequest
) => Promise<SpApiDownloadTransportResponse>;

type FirstSqpReportStatusSummary = {
  reportId: string;
  reportType: typeof FIRST_SQP_REPORT_TYPE | null;
  processingStatus: SpApiReportProcessingStatus;
  terminalReached: boolean;
  maxAttemptsReached: boolean;
  attemptCount: number;
  reportDocumentId: string | null;
};

const NON_TERMINAL_STATUSES: readonly SpApiReportProcessingStatus[] = [
  'IN_QUEUE',
  'IN_PROGRESS',
] as const;

const createJsonFetchTransport = (): SpApiTransport => {
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

const createDownloadFetchTransport = (): SpApiDownloadTransport => {
  return async (
    request: SpApiDownloadTransportRequest
  ): Promise<SpApiDownloadTransportResponse> => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
    });

    const body = Buffer.from(await response.arrayBuffer());
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      status: response.status,
      body,
      headers,
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
    SP_API_REPORT_PROCESSING_STATUSES.find((status) => status === value) ?? null
  );
};

const parsePositiveInteger = (value: number, fieldName: string) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new SpApiSqpPullError(
      'invalid_input',
      `${fieldName} must be a positive integer`
    );
  }

  return value;
};

const parseNonNegativeInteger = (value: number, fieldName: string) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new SpApiSqpPullError(
      'invalid_input',
      `${fieldName} must be a non-negative integer`
    );
  }

  return value;
};

const parseIsoDate = (value: string, fieldName: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new SpApiSqpPullError(
      'invalid_input',
      `${fieldName} must use YYYY-MM-DD format`
    );
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new SpApiSqpPullError(
      'invalid_input',
      `${fieldName} must be a valid UTC date`
    );
  }

  return trimmed;
};

const dayDiffUtc = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  return Math.round((end - start) / 86_400_000);
};

const dayOfWeekUtc = (value: string) =>
  new Date(`${value}T00:00:00.000Z`).getUTCDay();

const normalizeAsin = (value: string) => {
  const asin = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) {
    throw new SpApiSqpPullError(
      'invalid_input',
      'The bounded SQP real-pull path requires one ASIN in 10-character Amazon ASIN format'
    );
  }

  return asin;
};

const validateFirstSqpAsinWindow = (args: {
  asin: string;
  startDate: string;
  endDate: string;
}) => {
  const asin = normalizeAsin(args.asin);
  const startDate = parseIsoDate(args.startDate, '--start-date');
  const endDate = parseIsoDate(args.endDate, '--end-date');

  if (dayDiffUtc(startDate, endDate) !== 6) {
    throw new SpApiSqpPullError(
      'validation_failed',
      'The bounded SQP real-pull path requires one 7-day WEEK window'
    );
  }

  if (dayOfWeekUtc(startDate) !== 0) {
    throw new SpApiSqpPullError(
      'validation_failed',
      'The bounded SQP real-pull path requires --start-date to be a Sunday'
    );
  }

  if (dayOfWeekUtc(endDate) !== 6) {
    throw new SpApiSqpPullError(
      'validation_failed',
      'The bounded SQP real-pull path requires --end-date to be a Saturday'
    );
  }

  return {
    asin,
    startDate,
    endDate,
  };
};

export const buildFirstSqpReportRequestBody = (args: {
  marketplaceId: string;
  asin: string;
  startDate: string;
  endDate: string;
}): SpApiReportCreateRequestBody => {
  const marketplaceId = args.marketplaceId.trim();
  if (!marketplaceId) {
    throw new SpApiSqpPullError(
      'invalid_input',
      'SP-API SQP report request requires a non-empty marketplace id'
    );
  }

  const validated = validateFirstSqpAsinWindow(args);

  return {
    reportType: FIRST_SQP_REPORT_TYPE,
    marketplaceIds: [marketplaceId],
    dataStartTime: validated.startDate,
    dataEndTime: validated.endDate,
    reportOptions: {
      reportPeriod: FIRST_SQP_REPORT_PERIOD,
      asin: validated.asin,
    },
  };
};

export const buildFirstSqpReportRequest = (args: {
  region: SpApiRegion;
  accessToken: string;
  marketplaceId: string;
  asin: string;
  startDate: string;
  endDate: string;
}): SpApiTransportRequest => {
  const accessToken = args.accessToken.trim();
  if (!accessToken) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API SQP report request requires a non-empty access token'
    );
  }

  return {
    url: `${resolveSpApiEndpoint(args.region)}${REPORTS_CREATE_REPORT_PATH}`,
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'user-agent': 'amazon-performance-hub/v2-spapi-sqp-first-real-pull',
      'x-amz-access-token': accessToken,
    },
    body: JSON.stringify(
      buildFirstSqpReportRequestBody({
        marketplaceId: args.marketplaceId,
        asin: args.asin,
        startDate: args.startDate,
        endDate: args.endDate,
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

const parseSqpReportStatusResponse = (value: unknown) => {
  const candidate = asObject(value);
  const reportId = asString(candidate?.reportId);
  const processingStatus = asProcessingStatus(candidate?.processingStatus);
  const reportType = asString(candidate?.reportType);

  if (!reportId || !processingStatus) {
    return null;
  }

  if (reportType && reportType !== FIRST_SQP_REPORT_TYPE) {
    return null;
  }

  return {
    reportId,
    reportType: (reportType as typeof FIRST_SQP_REPORT_TYPE | null) ?? null,
    processingStatus,
    reportDocumentId: asString(candidate?.reportDocumentId),
  };
};

const isTerminalStatus = (status: SpApiReportProcessingStatus) =>
  !NON_TERMINAL_STATUSES.includes(status);

export const buildFirstSqpReportStatusRequest = (args: {
  region: SpApiRegion;
  accessToken: string;
  reportId: string;
}): SpApiTransportRequest => {
  const accessToken = args.accessToken.trim();
  const reportId = args.reportId.trim();

  if (!accessToken) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API SQP report status request requires a non-empty access token'
    );
  }

  if (!reportId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API SQP report status request requires a non-empty report id'
    );
  }

  return {
    url: `${resolveSpApiEndpoint(args.region)}${buildReportsGetReportPath(reportId)}`,
    method: 'GET',
    headers: {
      'user-agent': 'amazon-performance-hub/v2-spapi-sqp-first-real-pull',
      'x-amz-access-token': accessToken,
    },
  };
};

export const pollFirstSqpReportStatus = async (args: {
  reportId: string;
  maxAttempts?: number;
  pollIntervalMs?: number;
  envSource?: SpApiEnvSource;
  tokenTransport?: SpApiTransport;
  apiTransport?: SpApiTransport;
  wait?: (ms: number) => Promise<void>;
}): Promise<FirstSqpReportStatusSummary> => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API SQP report status polling requires a non-empty report id'
    );
  }

  const maxAttempts = parsePositiveInteger(
    args.maxAttempts ?? DEFAULT_FIRST_SQP_STATUS_MAX_ATTEMPTS,
    'maxAttempts'
  );
  const pollIntervalMs = parseNonNegativeInteger(
    args.pollIntervalMs ?? DEFAULT_FIRST_SQP_STATUS_POLL_INTERVAL_MS,
    'pollIntervalMs'
  );

  const config = loadSpApiEnv(args.envSource);
  const tokenTransport = args.tokenTransport ?? createJsonFetchTransport();
  const apiTransport = args.apiTransport ?? createJsonFetchTransport();
  const wait = args.wait ?? waitForMs;

  const tokenResult = await refreshSpApiAccessToken({
    config,
    transport: tokenTransport,
  });

  if (!tokenResult.ok) {
    throw tokenResult.error;
  }

  const request = buildFirstSqpReportStatusRequest({
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
        'SP-API SQP report status request failed before receiving a response',
        { details: error }
      );
    }

    if (response.status < 200 || response.status >= 300) {
      throw new SpApiRequestError(
        'api_response_error',
        `SP-API SQP report status request failed with status ${response.status}`,
        { status: response.status, details: response.json }
      );
    }

    const parsed = parseSqpReportStatusResponse(response.json);
    if (!parsed) {
      throw new SpApiRequestError(
        'invalid_response',
        'SP-API SQP report status request returned an invalid response payload',
        { status: response.status, details: response.json }
      );
    }

    const terminalReached = isTerminalStatus(parsed.processingStatus);
    const summary: FirstSqpReportStatusSummary = {
      reportId: parsed.reportId,
      reportType: parsed.reportType,
      processingStatus: parsed.processingStatus,
      terminalReached,
      maxAttemptsReached: !terminalReached && attempt >= maxAttempts,
      attemptCount: attempt,
      reportDocumentId: parsed.reportDocumentId,
    };

    if (terminalReached || attempt >= maxAttempts) {
      return summary;
    }

    await wait(pollIntervalMs);
  }

  throw new SpApiRequestError(
    'api_response_error',
    `SP-API SQP report ${reportId} did not reach a terminal state within ${maxAttempts} attempts`
  );
};

const requireFirstSqpReportDocumentId = (summary: FirstSqpReportStatusSummary) => {
  if (!summary.terminalReached || summary.maxAttemptsReached) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API SQP report ${summary.reportId} did not reach a terminal state within ${summary.attemptCount} attempts`
    );
  }

  if (summary.processingStatus !== 'DONE') {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API SQP report ${summary.reportId} ended in status ${summary.processingStatus} and cannot be ingested`
    );
  }

  const reportDocumentId = summary.reportDocumentId?.trim();
  if (!reportDocumentId) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API SQP report ${summary.reportId} did not return a reportDocumentId for retrieval`
    );
  }

  return reportDocumentId;
};

const buildFirstSqpReportDocumentMetadataRequest = (args: {
  region: SpApiRegion;
  accessToken: string;
  reportDocumentId: string;
}): SpApiTransportRequest => {
  const accessToken = args.accessToken.trim();
  const reportDocumentId = args.reportDocumentId.trim();

  if (!accessToken) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API SQP report document metadata request requires a non-empty access token'
    );
  }

  if (!reportDocumentId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API SQP report document metadata request requires a non-empty reportDocumentId'
    );
  }

  return {
    url: `${resolveSpApiEndpoint(args.region)}${buildReportsGetReportDocumentPath(
      reportDocumentId
    )}`,
    method: 'GET',
    headers: {
      'user-agent': 'amazon-performance-hub/v2-spapi-sqp-first-real-pull',
      'x-amz-access-token': accessToken,
    },
  };
};

const buildFirstSqpDocumentDownloadRequest = (documentUrl: string): SpApiDownloadTransportRequest => {
  const url = documentUrl.trim();
  if (!url) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API SQP report document download requires a non-empty document URL'
    );
  }

  return {
    url,
    method: 'GET',
  };
};

const parseReportDocumentMetadataResponse = (value: unknown) => {
  const candidate = asObject(value);
  const reportDocumentId = asString(candidate?.reportDocumentId);
  const url = asString(candidate?.url);

  if (!reportDocumentId || !url) {
    return null;
  }

  return {
    reportDocumentId,
    url,
    compressionAlgorithm: asString(candidate?.compressionAlgorithm),
  };
};

const normalizeContentType = (value: string | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildFirstSqpRawArtifactPath = (args: {
  reportId: string;
  compressionAlgorithm: string | null;
  contentType: string | null;
  outputRoot?: string;
}) => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new SpApiSqpPullError(
      'invalid_input',
      'SP-API SQP raw artifact path requires a non-empty report id'
    );
  }

  const outputRoot = args.outputRoot ?? SP_API_SQP_RAW_OUTPUT_DIR;
  const normalizedContentType = args.contentType?.toLowerCase() ?? null;
  const extension =
    normalizedContentType?.includes('csv') || normalizedContentType?.includes('text/csv')
      ? '.csv'
      : '.json';
  const gzipSuffix = args.compressionAlgorithm === 'GZIP' ? '.gz' : '';

  return path.resolve(outputRoot, `report-${reportId}.sqp.raw${extension}${gzipSuffix}`);
};

const writeFirstSqpRawArtifact = async (args: {
  reportId: string;
  compressionAlgorithm: string | null;
  contentType: string | null;
  bytes: Buffer;
  outputRoot?: string;
}) => {
  const outputFilePath = buildFirstSqpRawArtifactPath(args);

  try {
    await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
    await fs.writeFile(outputFilePath, args.bytes);
  } catch (error) {
    throw new SpApiSqpPullError(
      'write_failed',
      `Failed to write SP-API SQP raw artifact at ${outputFilePath}`,
      error
    );
  }

  return {
    outputFilePath,
    storedByteCount: args.bytes.length,
  };
};

type FirstSqpParseIngestImpl = (args: {
  reportId?: string;
  rawFilePath?: string;
  rawOutputRoot?: string;
  csvOutputRoot?: string;
  env?: NodeJS.ProcessEnv;
}) => Promise<SpApiSqpParseIngestSummary>;

export const summarizeFirstSqpRealPull = (args: {
  reportId: string;
  reportDocumentId: string;
  rawArtifactPath: string;
  parseSummary: SpApiSqpParseIngestSummary;
}): SpApiSqpRealPullSummary => ({
  endpoint: 'spApiSqpFirstRealPullAndIngest',
  reportId: args.reportId,
  reportDocumentId: args.reportDocumentId,
  rawArtifactPath: path.resolve(args.rawArtifactPath),
  scopeType: args.parseSummary.scopeType,
  scopeValue: args.parseSummary.scopeValue,
  coverageStart: args.parseSummary.coverageStart,
  coverageEnd: args.parseSummary.coverageEnd,
  rowCount: args.parseSummary.rowCount,
  uploadId: args.parseSummary.uploadId,
  warningsCount: args.parseSummary.warningsCount,
});

export const runFirstSpApiSqpRealPullAndIngest = async (args: {
  asin: string;
  startDate: string;
  endDate: string;
  maxAttempts?: number;
  pollIntervalMs?: number;
  envSource?: SpApiEnvSource;
  tokenTransport?: SpApiTransport;
  requestApiTransport?: SpApiTransport;
  statusApiTransport?: SpApiTransport;
  metadataApiTransport?: SpApiTransport;
  downloadTransport?: SpApiDownloadTransport;
  wait?: (ms: number) => Promise<void>;
  outputRoot?: string;
  csvOutputRoot?: string;
  env?: NodeJS.ProcessEnv;
  parseIngestImpl?: FirstSqpParseIngestImpl;
}): Promise<SpApiSqpRealPullSummary> => {
  const validatedWindow = validateFirstSqpAsinWindow({
    asin: args.asin,
    startDate: args.startDate,
    endDate: args.endDate,
  });

  const config = loadSpApiEnv(args.envSource);
  const tokenTransport = args.tokenTransport ?? createJsonFetchTransport();
  const requestApiTransport = args.requestApiTransport ?? createJsonFetchTransport();
  const statusApiTransport = args.statusApiTransport ?? createJsonFetchTransport();
  const metadataApiTransport =
    args.metadataApiTransport ?? createJsonFetchTransport();
  const downloadTransport =
    args.downloadTransport ?? createDownloadFetchTransport();

  const tokenResult = await refreshSpApiAccessToken({
    config,
    transport: tokenTransport,
  });

  if (!tokenResult.ok) {
    throw tokenResult.error;
  }

  const createRequest = buildFirstSqpReportRequest({
    region: config.region,
    accessToken: tokenResult.accessToken,
    marketplaceId: config.marketplaceId,
    asin: validatedWindow.asin,
    startDate: validatedWindow.startDate,
    endDate: validatedWindow.endDate,
  });

  let createResponse: SpApiTransportResponse;
  try {
    createResponse = await requestApiTransport(createRequest);
  } catch (error) {
    throw new SpApiRequestError(
      'api_response_error',
      'SP-API SQP report request failed before receiving a response',
      { details: error }
    );
  }

  if (createResponse.status < 200 || createResponse.status >= 300) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API SQP report request failed with status ${createResponse.status}`,
      { status: createResponse.status, details: createResponse.json }
    );
  }

  const createdReport = parseCreateReportResponse(createResponse.json);
  if (!createdReport) {
    throw new SpApiRequestError(
      'invalid_response',
      'SP-API SQP report request returned an invalid response payload',
      { status: createResponse.status, details: createResponse.json }
    );
  }

  const statusSummary = await pollFirstSqpReportStatus({
    reportId: createdReport.reportId,
    maxAttempts: args.maxAttempts,
    pollIntervalMs: args.pollIntervalMs,
    envSource: args.envSource,
    tokenTransport,
    apiTransport: statusApiTransport,
    wait: args.wait,
  });

  const reportDocumentId = requireFirstSqpReportDocumentId(statusSummary);

  const metadataRequest = buildFirstSqpReportDocumentMetadataRequest({
    region: config.region,
    accessToken: tokenResult.accessToken,
    reportDocumentId,
  });

  let metadataResponse: SpApiTransportResponse;
  try {
    metadataResponse = await metadataApiTransport(metadataRequest);
  } catch (error) {
    throw new SpApiRequestError(
      'api_response_error',
      'SP-API SQP report document metadata request failed before receiving a response',
      { details: error }
    );
  }

  if (metadataResponse.status < 200 || metadataResponse.status >= 300) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API SQP report document metadata request failed with status ${metadataResponse.status}`,
      { status: metadataResponse.status, details: metadataResponse.json }
    );
  }

  const metadata = parseReportDocumentMetadataResponse(metadataResponse.json);
  if (!metadata) {
    throw new SpApiRequestError(
      'invalid_response',
      'SP-API SQP report document metadata returned an invalid payload',
      { status: metadataResponse.status, details: metadataResponse.json }
    );
  }

  const downloadRequest = buildFirstSqpDocumentDownloadRequest(metadata.url);

  let downloadResponse: SpApiDownloadTransportResponse;
  try {
    downloadResponse = await downloadTransport(downloadRequest);
  } catch (error) {
    throw new SpApiRequestError(
      'api_response_error',
      'SP-API SQP report document download failed before receiving a response',
      { details: error }
    );
  }

  if (downloadResponse.status < 200 || downloadResponse.status >= 300) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API SQP report document download failed with status ${downloadResponse.status}`,
      { status: downloadResponse.status }
    );
  }

  const contentType = normalizeContentType(downloadResponse.headers['content-type']);
  const artifact = await writeFirstSqpRawArtifact({
    reportId: createdReport.reportId,
    compressionAlgorithm: metadata.compressionAlgorithm,
    contentType,
    bytes: downloadResponse.body,
    outputRoot: args.outputRoot,
  });

  const parseIngestImpl = args.parseIngestImpl ?? runFirstSpApiSqpParseIngest;
  const parseSummary = await parseIngestImpl({
    reportId: createdReport.reportId,
    rawFilePath: artifact.outputFilePath,
    rawOutputRoot: args.outputRoot,
    csvOutputRoot: args.csvOutputRoot,
    env: args.env,
  });

  return summarizeFirstSqpRealPull({
    reportId: createdReport.reportId,
    reportDocumentId,
    rawArtifactPath: artifact.outputFilePath,
    parseSummary,
  });
};
