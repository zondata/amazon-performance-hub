import fs from 'node:fs/promises';
import path from 'node:path';

import { refreshSpApiAccessToken } from './auth';
import {
  buildReportsGetReportDocumentPath,
  resolveSpApiEndpoint,
} from './endpoints';
import { loadSpApiEnv, type SpApiEnvSource } from './env';
import { pollFirstSalesAndTrafficReportStatus } from './firstReportStatus';
import {
  SpApiRequestError,
  type SpApiFirstReportDocumentSummary,
  type SpApiFirstReportStatusSummary,
  type SpApiRegion,
  type SpApiReportProcessingStatus,
  type SpApiTransport,
  type SpApiTransportRequest,
  type SpApiTransportResponse,
} from './types';

export const FIRST_REPORT_DOCUMENT_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'out',
  'sp-api-report-documents'
);

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

const asObject = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

const buildArtifactFilename = (args: {
  reportId: string;
  compressionAlgorithm: string | null;
  contentType: string | null;
}) => {
  const base = `report-${args.reportId}.document`;

  if (args.compressionAlgorithm === 'GZIP') {
    return `${base}.raw.gz`;
  }

  if (args.contentType?.startsWith('text/')) {
    return `${base}.txt`;
  }

  return `${base}.raw`;
};

export const requireFirstSalesAndTrafficReportDocumentId = (
  summary: SpApiFirstReportStatusSummary
) => {
  if (!summary.terminalReached) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API report ${summary.reportId} is not in a terminal state; current status is ${summary.processingStatus}`
    );
  }

  const reportDocumentId = summary.reportDocumentId?.trim();
  if (!reportDocumentId) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API report ${summary.reportId} did not return a reportDocumentId for retrieval`
    );
  }

  return reportDocumentId;
};

export const buildFirstSalesAndTrafficReportDocumentMetadataRequest = (args: {
  region: SpApiRegion;
  accessToken: string;
  reportDocumentId: string;
}): SpApiTransportRequest => {
  const accessToken = args.accessToken.trim();
  if (!accessToken) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API report document metadata request requires a non-empty access token'
    );
  }

  const reportDocumentId = args.reportDocumentId.trim();
  if (!reportDocumentId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API report document metadata request requires a non-empty reportDocumentId'
    );
  }

  return {
    url: `${resolveSpApiEndpoint(args.region)}${buildReportsGetReportDocumentPath(
      reportDocumentId
    )}`,
    method: 'GET',
    headers: {
      'user-agent': 'amazon-performance-hub/v2-spapi-first-report-document',
      'x-amz-access-token': accessToken,
    },
  };
};

export const buildFirstSalesAndTrafficReportDocumentDownloadRequest = (args: {
  documentUrl: string;
}): SpApiDownloadTransportRequest => {
  const documentUrl = args.documentUrl.trim();
  if (!documentUrl) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API report document download requires a non-empty document URL'
    );
  }

  return {
    url: documentUrl,
    method: 'GET',
  };
};

export const buildFirstSalesAndTrafficReportArtifactPath = (args: {
  reportId: string;
  compressionAlgorithm: string | null;
  contentType: string | null;
  outputRoot?: string;
}) => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API report document artifact path requires a non-empty report id'
    );
  }

  const outputRoot = args.outputRoot ?? FIRST_REPORT_DOCUMENT_OUTPUT_DIR;
  return path.resolve(
    outputRoot,
    buildArtifactFilename({
      reportId,
      compressionAlgorithm: args.compressionAlgorithm,
      contentType: args.contentType,
    })
  );
};

export const writeFirstSalesAndTrafficReportArtifact = async (args: {
  reportId: string;
  compressionAlgorithm: string | null;
  contentType: string | null;
  bytes: Buffer;
  outputRoot?: string;
}) => {
  const outputFilePath = buildFirstSalesAndTrafficReportArtifactPath({
    reportId: args.reportId,
    compressionAlgorithm: args.compressionAlgorithm,
    contentType: args.contentType,
    outputRoot: args.outputRoot,
  });

  await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
  await fs.writeFile(outputFilePath, args.bytes);

  return {
    outputFilePath,
    storedByteCount: args.bytes.length,
  };
};

export const summarizeFirstSalesAndTrafficReportDocument = (args: {
  region: SpApiRegion;
  marketplaceId: string;
  reportId: string;
  processingStatus: SpApiReportProcessingStatus;
  reportDocumentId: string;
  compressionAlgorithm: string | null;
  contentType: string | null;
  outputFilePath: string;
  downloadedByteCount: number;
  storedByteCount: number;
}): SpApiFirstReportDocumentSummary => ({
  endpoint: 'getReportDocument',
  region: args.region,
  marketplaceId: args.marketplaceId,
  reportId: args.reportId,
  processingStatus: args.processingStatus,
  reportDocumentId: args.reportDocumentId,
  compressionAlgorithm: args.compressionAlgorithm,
  contentType: args.contentType,
  outputFilePath: args.outputFilePath,
  downloadedByteCount: args.downloadedByteCount,
  storedByteCount: args.storedByteCount,
});

export const fetchFirstSalesAndTrafficReportDocument = async (args: {
  reportId: string;
  envSource?: SpApiEnvSource;
  tokenTransport?: SpApiTransport;
  statusApiTransport?: SpApiTransport;
  metadataApiTransport?: SpApiTransport;
  downloadTransport?: SpApiDownloadTransport;
  outputRoot?: string;
}): Promise<SpApiFirstReportDocumentSummary> => {
  const reportId = args.reportId.trim();
  if (!reportId) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API report document retrieval requires a non-empty report id'
    );
  }

  const tokenTransport = args.tokenTransport ?? createJsonFetchTransport();
  const statusApiTransport = args.statusApiTransport ?? createJsonFetchTransport();
  const metadataApiTransport =
    args.metadataApiTransport ?? createJsonFetchTransport();
  const downloadTransport =
    args.downloadTransport ?? createDownloadFetchTransport();

  const statusSummary = await pollFirstSalesAndTrafficReportStatus({
    reportId,
    mode: 'single-check',
    envSource: args.envSource,
    tokenTransport,
    apiTransport: statusApiTransport,
  });
  const reportDocumentId =
    requireFirstSalesAndTrafficReportDocumentId(statusSummary);

  const config = loadSpApiEnv(args.envSource);
  const tokenResult = await refreshSpApiAccessToken({
    config,
    transport: tokenTransport,
  });

  if (!tokenResult.ok) {
    throw tokenResult.error;
  }

  const metadataRequest = buildFirstSalesAndTrafficReportDocumentMetadataRequest({
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
      'SP-API report document metadata request failed before receiving a response',
      { details: error }
    );
  }

  if (metadataResponse.status < 200 || metadataResponse.status >= 300) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API report document metadata request failed with status ${metadataResponse.status}`,
      { status: metadataResponse.status, details: metadataResponse.json }
    );
  }

  const metadata = parseReportDocumentMetadataResponse(metadataResponse.json);
  if (!metadata) {
    throw new SpApiRequestError(
      'invalid_response',
      'SP-API report document metadata response returned an invalid payload',
      { status: metadataResponse.status, details: metadataResponse.json }
    );
  }

  const downloadRequest = buildFirstSalesAndTrafficReportDocumentDownloadRequest({
    documentUrl: metadata.url,
  });

  let downloadResponse: SpApiDownloadTransportResponse;
  try {
    downloadResponse = await downloadTransport(downloadRequest);
  } catch (error) {
    throw new SpApiRequestError(
      'api_response_error',
      'SP-API report document download failed before receiving a response',
      { details: error }
    );
  }

  if (downloadResponse.status < 200 || downloadResponse.status >= 300) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API report document download failed with status ${downloadResponse.status}`,
      { status: downloadResponse.status }
    );
  }

  const contentType = normalizeContentType(
    downloadResponse.headers['content-type']
  );
  const artifact = await writeFirstSalesAndTrafficReportArtifact({
    reportId,
    compressionAlgorithm: metadata.compressionAlgorithm,
    contentType,
    bytes: downloadResponse.body,
    outputRoot: args.outputRoot,
  });

  return summarizeFirstSalesAndTrafficReportDocument({
    region: config.region,
    marketplaceId: config.marketplaceId,
    reportId,
    processingStatus: statusSummary.processingStatus,
    reportDocumentId: metadata.reportDocumentId,
    compressionAlgorithm: metadata.compressionAlgorithm,
    contentType,
    outputFilePath: artifact.outputFilePath,
    downloadedByteCount: downloadResponse.body.length,
    storedByteCount: artifact.storedByteCount,
  });
};
