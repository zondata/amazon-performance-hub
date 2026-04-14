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
  runFirstSpApiSearchTermsParseIngest,
  SP_API_SEARCH_TERMS_RAW_OUTPUT_DIR,
} from './firstSearchTermsParseIngest';
import {
  SP_API_REPORT_PROCESSING_STATUSES,
  SpApiRequestError,
  SpApiSearchTermsPullError,
  type SpApiRegion,
  type SpApiReportCreateRequestBody,
  type SpApiReportProcessingStatus,
  type SpApiSearchTermsParseIngestSummary,
  type SpApiSearchTermsRealPullSummary,
  type SpApiTransport,
  type SpApiTransportRequest,
  type SpApiTransportResponse,
} from './types';

export const FIRST_SEARCH_TERMS_REPORT_TYPE =
  'GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT' as const;
export const FIRST_SEARCH_TERMS_REPORT_PERIOD = 'WEEK' as const;
export const DEFAULT_FIRST_SEARCH_TERMS_STATUS_MAX_ATTEMPTS = 120;
export const DEFAULT_FIRST_SEARCH_TERMS_STATUS_POLL_INTERVAL_MS = 5000;

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

type FirstSearchTermsReportStatusSummary = {
  reportId: string;
  reportType: typeof FIRST_SEARCH_TERMS_REPORT_TYPE | null;
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
  return SP_API_REPORT_PROCESSING_STATUSES.find((status) => status === value) ?? null;
};

const parsePositiveInteger = (value: number, fieldName: string) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new SpApiSearchTermsPullError(
      'invalid_input',
      `${fieldName} must be a positive integer`
    );
  }

  return value;
};

const parseNonNegativeInteger = (value: number, fieldName: string) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new SpApiSearchTermsPullError(
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
    throw new SpApiSearchTermsPullError(
      'invalid_input',
      `${fieldName} must use YYYY-MM-DD format`
    );
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new SpApiSearchTermsPullError(
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

const validateFirstSearchTermsWindow = (args: {
  startDate: string;
  endDate: string;
}) => {
  const startDate = parseIsoDate(args.startDate, '--start-date');
  const endDate = parseIsoDate(args.endDate, '--end-date');

  if (dayDiffUtc(startDate, endDate) !== 6) {
    throw new SpApiSearchTermsPullError(
      'validation_failed',
      'The bounded Search Terms real-pull path requires one 7-day WEEK window'
    );
  }

  if (dayOfWeekUtc(startDate) !== 0) {
    throw new SpApiSearchTermsPullError(
      'validation_failed',
      'The bounded Search Terms real-pull path requires --start-date to be a Sunday'
    );
  }

  if (dayOfWeekUtc(endDate) !== 6) {
    throw new SpApiSearchTermsPullError(
      'validation_failed',
      'The bounded Search Terms real-pull path requires --end-date to be a Saturday'
    );
  }

  return {
    startDate,
    endDate,
  };
};

export const buildFirstSearchTermsReportRequestBody = (args: {
  marketplaceId: string;
  startDate: string;
  endDate: string;
}): SpApiReportCreateRequestBody => {
  const marketplaceId = args.marketplaceId.trim();
  if (!marketplaceId) {
    throw new SpApiSearchTermsPullError(
      'invalid_input',
      'SP-API Search Terms report request requires a non-empty marketplace id'
    );
  }

  const validated = validateFirstSearchTermsWindow({
    startDate: args.startDate,
    endDate: args.endDate,
  });

  return {
    reportType: FIRST_SEARCH_TERMS_REPORT_TYPE,
    marketplaceIds: [marketplaceId],
    dataStartTime: validated.startDate,
    dataEndTime: validated.endDate,
    reportOptions: {
      reportPeriod: FIRST_SEARCH_TERMS_REPORT_PERIOD,
    },
  };
};

export const buildFirstSearchTermsReportRequest = (args: {
  region: SpApiRegion;
  accessToken: string;
  marketplaceId: string;
  startDate: string;
  endDate: string;
}): SpApiTransportRequest => {
  const accessToken = args.accessToken.trim();
  if (!accessToken) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API Search Terms report request requires a non-empty access token'
    );
  }

  return {
    url: `${resolveSpApiEndpoint(args.region)}${REPORTS_CREATE_REPORT_PATH}`,
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'user-agent': 'amazon-performance-hub/v2-spapi-search-terms-first-real-pull',
      'x-amz-access-token': accessToken,
    },
    body: JSON.stringify(
      buildFirstSearchTermsReportRequestBody({
        marketplaceId: args.marketplaceId,
        startDate: args.startDate,
        endDate: args.endDate,
      })
    ),
  };
};

const parseCreateReportResponse = (value: unknown) => {
  const candidate = asObject(value);
  const reportId = asString(candidate?.reportId);
  return reportId ? { reportId } : null;
};

const parseSearchTermsReportStatusResponse = (value: unknown) => {
  const candidate = asObject(value);
  const reportId = asString(candidate?.reportId);
  const processingStatus = asProcessingStatus(candidate?.processingStatus);
  const reportType = asString(candidate?.reportType);

  if (!reportId || !processingStatus) {
    return null;
  }

  if (reportType && reportType !== FIRST_SEARCH_TERMS_REPORT_TYPE) {
    return null;
  }

  return {
    reportId,
    reportType: (reportType as typeof FIRST_SEARCH_TERMS_REPORT_TYPE | null) ?? null,
    processingStatus,
    reportDocumentId: asString(candidate?.reportDocumentId),
  };
};

const isTerminalStatus = (status: SpApiReportProcessingStatus) =>
  !NON_TERMINAL_STATUSES.includes(status);

export const buildFirstSearchTermsReportStatusRequest = (args: {
  region: SpApiRegion;
  accessToken: string;
  reportId: string;
}): SpApiTransportRequest => {
  const accessToken = args.accessToken.trim();
  const reportId = args.reportId.trim();

  if (!accessToken) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API Search Terms report status request requires a non-empty access token'
    );
  }

  if (!reportId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API Search Terms report status request requires a non-empty report id'
    );
  }

  return {
    url: `${resolveSpApiEndpoint(args.region)}${buildReportsGetReportPath(reportId)}`,
    method: 'GET',
    headers: {
      'user-agent': 'amazon-performance-hub/v2-spapi-search-terms-first-real-pull',
      'x-amz-access-token': accessToken,
    },
  };
};

export const pollFirstSearchTermsReportStatus = async (args: {
  reportId: string;
  maxAttempts?: number;
  pollIntervalMs?: number;
  envSource?: SpApiEnvSource;
  tokenTransport?: SpApiTransport;
  apiTransport?: SpApiTransport;
  wait?: (ms: number) => Promise<void>;
}): Promise<FirstSearchTermsReportStatusSummary> => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API Search Terms report status polling requires a non-empty report id'
    );
  }

  const maxAttempts = parsePositiveInteger(
    args.maxAttempts ?? DEFAULT_FIRST_SEARCH_TERMS_STATUS_MAX_ATTEMPTS,
    'maxAttempts'
  );
  const pollIntervalMs = parseNonNegativeInteger(
    args.pollIntervalMs ?? DEFAULT_FIRST_SEARCH_TERMS_STATUS_POLL_INTERVAL_MS,
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

  const request = buildFirstSearchTermsReportStatusRequest({
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
        'SP-API Search Terms report status request failed before receiving a response',
        { details: error }
      );
    }

    if (response.status < 200 || response.status >= 300) {
      throw new SpApiRequestError(
        'api_response_error',
        `SP-API Search Terms report status request failed with status ${response.status}`,
        { status: response.status, details: response.json }
      );
    }

    const parsed = parseSearchTermsReportStatusResponse(response.json);
    if (!parsed) {
      throw new SpApiRequestError(
        'invalid_response',
        'SP-API Search Terms report status request returned an invalid response payload',
        { status: response.status, details: response.json }
      );
    }

    const terminalReached = isTerminalStatus(parsed.processingStatus);
    const summary: FirstSearchTermsReportStatusSummary = {
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
    `SP-API Search Terms report ${reportId} did not reach a terminal state within ${maxAttempts} attempts`
  );
};

const requireFirstSearchTermsReportDocumentId = (
  summary: FirstSearchTermsReportStatusSummary
) => {
  if (!summary.terminalReached || summary.maxAttemptsReached) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API Search Terms report ${summary.reportId} did not reach a terminal state within ${summary.attemptCount} attempts`
    );
  }

  if (summary.processingStatus !== 'DONE') {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API Search Terms report ${summary.reportId} ended in status ${summary.processingStatus} and cannot be ingested`
    );
  }

  const reportDocumentId = summary.reportDocumentId?.trim();
  if (!reportDocumentId) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API Search Terms report ${summary.reportId} did not return a reportDocumentId for retrieval`
    );
  }

  return reportDocumentId;
};

const buildFirstSearchTermsReportDocumentMetadataRequest = (args: {
  region: SpApiRegion;
  accessToken: string;
  reportDocumentId: string;
}): SpApiTransportRequest => {
  const accessToken = args.accessToken.trim();
  const reportDocumentId = args.reportDocumentId.trim();

  if (!accessToken) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API Search Terms report document metadata request requires a non-empty access token'
    );
  }

  if (!reportDocumentId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API Search Terms report document metadata request requires a non-empty reportDocumentId'
    );
  }

  return {
    url: `${resolveSpApiEndpoint(args.region)}${buildReportsGetReportDocumentPath(
      reportDocumentId
    )}`,
    method: 'GET',
    headers: {
      'user-agent': 'amazon-performance-hub/v2-spapi-search-terms-first-real-pull',
      'x-amz-access-token': accessToken,
    },
  };
};

const buildFirstSearchTermsDocumentDownloadRequest = (documentUrl: string): SpApiDownloadTransportRequest => {
  const url = documentUrl.trim();
  if (!url) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API Search Terms report document download requires a non-empty document URL'
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

const buildFirstSearchTermsRawArtifactPath = (args: {
  reportId: string;
  compressionAlgorithm: string | null;
  contentType: string | null;
  outputRoot?: string;
}) => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new SpApiSearchTermsPullError(
      'invalid_input',
      'SP-API Search Terms raw artifact path requires a non-empty report id'
    );
  }

  const outputRoot = args.outputRoot ?? SP_API_SEARCH_TERMS_RAW_OUTPUT_DIR;
  const normalizedContentType = args.contentType?.toLowerCase() ?? null;
  const extension =
    normalizedContentType?.includes('json') ||
    normalizedContentType?.includes('application/octet-stream')
      ? '.json'
      : '.json';
  const gzipSuffix = args.compressionAlgorithm === 'GZIP' ? '.gz' : '';

  return path.resolve(
    outputRoot,
    `report-${reportId}.search-terms.raw${extension}${gzipSuffix}`
  );
};

const writeFirstSearchTermsRawArtifact = async (args: {
  reportId: string;
  compressionAlgorithm: string | null;
  contentType: string | null;
  bytes: Buffer;
  outputRoot?: string;
}) => {
  const outputFilePath = buildFirstSearchTermsRawArtifactPath(args);

  try {
    await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
    await fs.writeFile(outputFilePath, args.bytes);
  } catch (error) {
    throw new SpApiSearchTermsPullError(
      'write_failed',
      `Failed to write SP-API Search Terms raw artifact at ${outputFilePath}`,
      error
    );
  }

  return {
    outputFilePath,
    storedByteCount: args.bytes.length,
  };
};

type FirstSearchTermsParseIngestImpl = (args: {
  reportId?: string;
  rawFilePath?: string;
  rawOutputRoot?: string;
  env?: NodeJS.ProcessEnv;
}) => Promise<SpApiSearchTermsParseIngestSummary>;

export const summarizeFirstSearchTermsRealPull = (args: {
  reportId: string;
  reportDocumentId: string;
  rawArtifactPath: string;
  parseSummary: SpApiSearchTermsParseIngestSummary;
}): SpApiSearchTermsRealPullSummary => ({
  endpoint: 'spApiSearchTermsFirstRealPullAndIngest',
  reportId: args.reportId,
  reportDocumentId: args.reportDocumentId,
  rawArtifactPath: path.resolve(args.rawArtifactPath),
  marketplace: args.parseSummary.marketplace,
  marketplaceId: args.parseSummary.marketplaceId,
  coverageStart: args.parseSummary.coverageStart,
  coverageEnd: args.parseSummary.coverageEnd,
  rowCount: args.parseSummary.rowCount,
  uploadId: args.parseSummary.uploadId,
  warningsCount: args.parseSummary.warningsCount,
});

export const runFirstSpApiSearchTermsRealPullAndIngest = async (args: {
  marketplaceId?: string;
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
  env?: NodeJS.ProcessEnv;
  parseIngestImpl?: FirstSearchTermsParseIngestImpl;
}): Promise<SpApiSearchTermsRealPullSummary> => {
  const validatedWindow = validateFirstSearchTermsWindow({
    startDate: args.startDate,
    endDate: args.endDate,
  });

  const config = loadSpApiEnv(args.envSource);
  const marketplaceId = args.marketplaceId?.trim() || config.marketplaceId;
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

  const createRequest = buildFirstSearchTermsReportRequest({
    region: config.region,
    accessToken: tokenResult.accessToken,
    marketplaceId,
    startDate: validatedWindow.startDate,
    endDate: validatedWindow.endDate,
  });

  let createResponse: SpApiTransportResponse;
  try {
    createResponse = await requestApiTransport(createRequest);
  } catch (error) {
    throw new SpApiRequestError(
      'api_response_error',
      'SP-API Search Terms report request failed before receiving a response',
      { details: error }
    );
  }

  if (createResponse.status < 200 || createResponse.status >= 300) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API Search Terms report request failed with status ${createResponse.status}`,
      { status: createResponse.status, details: createResponse.json }
    );
  }

  const createdReport = parseCreateReportResponse(createResponse.json);
  if (!createdReport) {
    throw new SpApiRequestError(
      'invalid_response',
      'SP-API Search Terms report request returned an invalid response payload',
      { status: createResponse.status, details: createResponse.json }
    );
  }

  const statusSummary = await pollFirstSearchTermsReportStatus({
    reportId: createdReport.reportId,
    maxAttempts: args.maxAttempts,
    pollIntervalMs: args.pollIntervalMs,
    envSource: args.envSource,
    tokenTransport,
    apiTransport: statusApiTransport,
    wait: args.wait,
  });

  const reportDocumentId = requireFirstSearchTermsReportDocumentId(statusSummary);

  const metadataRequest = buildFirstSearchTermsReportDocumentMetadataRequest({
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
      'SP-API Search Terms report document metadata request failed before receiving a response',
      { details: error }
    );
  }

  if (metadataResponse.status < 200 || metadataResponse.status >= 300) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API Search Terms report document metadata request failed with status ${metadataResponse.status}`,
      { status: metadataResponse.status, details: metadataResponse.json }
    );
  }

  const metadata = parseReportDocumentMetadataResponse(metadataResponse.json);
  if (!metadata) {
    throw new SpApiRequestError(
      'invalid_response',
      'SP-API Search Terms report document metadata returned an invalid payload',
      { status: metadataResponse.status, details: metadataResponse.json }
    );
  }

  const downloadRequest = buildFirstSearchTermsDocumentDownloadRequest(metadata.url);

  let downloadResponse: SpApiDownloadTransportResponse;
  try {
    downloadResponse = await downloadTransport(downloadRequest);
  } catch (error) {
    throw new SpApiRequestError(
      'api_response_error',
      'SP-API Search Terms report document download failed before receiving a response',
      { details: error }
    );
  }

  if (downloadResponse.status < 200 || downloadResponse.status >= 300) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API Search Terms report document download failed with status ${downloadResponse.status}`,
      { status: downloadResponse.status }
    );
  }

  const contentType = normalizeContentType(downloadResponse.headers['content-type']);
  const artifact = await writeFirstSearchTermsRawArtifact({
    reportId: createdReport.reportId,
    compressionAlgorithm: metadata.compressionAlgorithm,
    contentType,
    bytes: downloadResponse.body,
    outputRoot: args.outputRoot,
  });

  const parseIngestImpl = args.parseIngestImpl ?? runFirstSpApiSearchTermsParseIngest;
  const parseSummary = await parseIngestImpl({
    reportId: createdReport.reportId,
    rawFilePath: artifact.outputFilePath,
    rawOutputRoot: args.outputRoot,
    env: args.env,
  });

  return summarizeFirstSearchTermsRealPull({
    reportId: createdReport.reportId,
    reportDocumentId,
    rawArtifactPath: artifact.outputFilePath,
    parseSummary,
  });
};
