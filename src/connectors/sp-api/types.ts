export const SP_API_REGIONS = ['na', 'eu', 'fe'] as const;

export type SpApiRegion = (typeof SP_API_REGIONS)[number];

export type SpApiCredentials = {
  lwaClientId: string;
  lwaClientSecret: string;
  refreshToken: string;
};

export type SpApiEnvConfig = {
  region: SpApiRegion;
  marketplaceId: string;
  credentials: SpApiCredentials;
};

export type LwaTokenSuccessResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

export type SpApiTransportRequest = {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
};

export type SpApiTransportResponse = {
  status: number;
  json: unknown;
};

export type SpApiTransport = (
  request: SpApiTransportRequest
) => Promise<SpApiTransportResponse>;

export type SpApiMarketplaceParticipation = {
  marketplaceId: string | null;
  countryCode: string | null;
  name: string | null;
  isParticipating: boolean | null;
  hasSuspendedListings: boolean | null;
};

export type SpApiFirstCallSummary = {
  endpoint: 'getMarketplaceParticipations';
  region: SpApiRegion;
  marketplaceIds: string[];
  participationCount: number;
};

export type SpApiReportType = 'GET_SALES_AND_TRAFFIC_REPORT';

export const SP_API_REPORT_PROCESSING_STATUSES = [
  'IN_QUEUE',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
  'FATAL',
  'DONE_NO_DATA',
] as const;

export type SpApiReportProcessingStatus =
  (typeof SP_API_REPORT_PROCESSING_STATUSES)[number];

export type SpApiReportCreateRequestBody = {
  reportType: SpApiReportType;
  marketplaceIds: [string];
  dataStartTime: string;
  dataEndTime: string;
  reportOptions: {
    dateGranularity: 'DAY';
    asinGranularity: 'PARENT';
    skuGranularity: 'TOTAL';
  };
};

export type SpApiFirstReportRequestSummary = {
  endpoint: 'createReport';
  region: SpApiRegion;
  marketplaceId: string;
  reportType: SpApiReportType;
  reportId: string;
};

export type SpApiFirstReportStatusPollMode =
  | 'single-check'
  | 'poll-until-terminal';

export type SpApiFirstReportStatusSummary = {
  endpoint: 'getReport';
  region: SpApiRegion;
  marketplaceId: string;
  reportId: string;
  reportType: SpApiReportType | null;
  processingStatus: SpApiReportProcessingStatus;
  terminalReached: boolean;
  maxAttemptsReached: boolean;
  attemptCount: number;
  processingStartTime: string | null;
  processingEndTime: string | null;
  reportDocumentId: string | null;
};

export type SpApiFirstReportDocumentSummary = {
  endpoint: 'getReportDocument';
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
};

export type SpApiTokenRefreshResult =
  | {
      ok: true;
      accessToken: string;
      expiresIn: number;
      tokenType: string;
      scope: string | null;
      raw: LwaTokenSuccessResponse;
    }
  | {
      ok: false;
      error: SpApiAuthError;
    };

export class SpApiRequestError extends Error {
  readonly code: 'request_build_error' | 'api_response_error' | 'invalid_response';
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code: 'request_build_error' | 'api_response_error' | 'invalid_response',
    message: string,
    options?: {
      status?: number;
      details?: unknown;
    }
  ) {
    super(message);
    this.name = 'SpApiRequestError';
    this.code = code;
    this.status = options?.status;
    this.details = options?.details;
  }
}

export class SpApiConfigError extends Error {
  readonly code: 'missing_env' | 'invalid_region';
  readonly details?: unknown;

  constructor(
    code: 'missing_env' | 'invalid_region',
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'SpApiConfigError';
    this.code = code;
    this.details = details;
  }
}

export class SpApiAuthError extends Error {
  readonly code: 'transport_error' | 'token_exchange_failed' | 'invalid_response';
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code: 'transport_error' | 'token_exchange_failed' | 'invalid_response',
    message: string,
    options?: {
      status?: number;
      details?: unknown;
    }
  ) {
    super(message);
    this.name = 'SpApiAuthError';
    this.code = code;
    this.status = options?.status;
    this.details = options?.details;
  }
}
