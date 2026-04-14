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

export type SpApiReportType =
  | 'GET_SALES_AND_TRAFFIC_REPORT'
  | 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT'
  | 'GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT';

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

export type SpApiReportCreateRequestBody =
  | {
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT';
      marketplaceIds: [string];
      dataStartTime: string;
      dataEndTime: string;
      reportOptions: {
        dateGranularity: 'DAY';
        asinGranularity: 'PARENT';
        skuGranularity: 'TOTAL';
      };
    }
  | {
      reportType: 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT';
      marketplaceIds: [string];
      dataStartTime: string;
      dataEndTime: string;
      reportOptions: {
        reportPeriod: 'WEEK';
        asin: string;
      };
    }
  | {
      reportType: 'GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT';
      marketplaceIds: [string];
      dataStartTime: string;
      dataEndTime: string;
      reportOptions: {
        reportPeriod: 'WEEK';
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

export type SpApiFirstReportParsedSectionSummary = {
  sectionName: string;
  headerCount: number;
  rowCount: number;
};

export type SpApiFirstReportParseSummary = {
  endpoint: 'parseFirstReportContent';
  reportId: string;
  inputFilePath: string;
  detectedFormat: 'json';
  decompressed: boolean;
  sectionCount: number;
  totalRowCount: number;
  parsedArtifactPath: string;
  sections: SpApiFirstReportParsedSectionSummary[];
};

export type SpApiFirstReportHandoffSectionSummary = {
  sectionName: string;
  headerCount: number;
  rowCount: number;
};

export type SpApiFirstReportHandoffSummary = {
  endpoint: 'buildFirstReportHandoff';
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  parsedArtifactPath: string;
  handoffArtifactPath: string;
  schemaVersion: string;
  sectionCount: number;
  totalRowCount: number;
  sections: SpApiFirstReportHandoffSectionSummary[];
};

export type SpApiFirstReportLocalStageSectionSummary = {
  sectionName: string;
  headerCount: number;
  rowCount: number;
};

export type SpApiFirstReportLocalStageSummary = {
  endpoint: 'ingestFirstReportLocalStage';
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: SpApiReportType;
  handoffArtifactPath: string;
  stagingArtifactPath: string;
  stagingVersion: string;
  sectionCount: number;
  totalRowCount: number;
  sections: SpApiFirstReportLocalStageSectionSummary[];
};

export type SpApiSqpParseIngestSummary = {
  endpoint: 'spApiSqpParseAndIngest';
  reportId: string | null;
  inputFilePath: string;
  scopeType: 'asin';
  scopeValue: string;
  coverageStart: string;
  coverageEnd: string;
  rowCount: number;
  uploadId: string | null;
  warningsCount: number;
};

export type SpApiSqpRealPullSummary = {
  endpoint: 'spApiSqpFirstRealPullAndIngest';
  reportId: string;
  reportDocumentId: string;
  rawArtifactPath: string;
  scopeType: 'asin';
  scopeValue: string;
  coverageStart: string;
  coverageEnd: string;
  rowCount: number;
  uploadId: string | null;
  warningsCount: number;
};

export type SpApiSearchTermsParseIngestSummary = {
  endpoint: 'spApiSearchTermsParseAndIngest';
  reportId: string | null;
  inputFilePath: string;
  marketplace: string;
  marketplaceId: string;
  coverageStart: string;
  coverageEnd: string;
  rowCount: number;
  uploadId: string | null;
  warningsCount: number;
};

export type SpApiSearchTermsRealPullSummary = {
  endpoint: 'spApiSearchTermsFirstRealPullAndIngest';
  reportId: string;
  reportDocumentId: string;
  rawArtifactPath: string;
  marketplace: string;
  marketplaceId: string;
  coverageStart: string;
  coverageEnd: string;
  rowCount: number;
  uploadId: string | null;
  warningsCount: number;
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

export class SpApiParseError extends Error {
  readonly code:
    | 'artifact_not_found'
    | 'invalid_input'
    | 'unsupported_format'
    | 'invalid_content'
    | 'write_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'artifact_not_found'
      | 'invalid_input'
      | 'unsupported_format'
      | 'invalid_content'
      | 'write_failed',
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'SpApiParseError';
    this.code = code;
    this.details = details;
  }
}

export class SpApiHandoffError extends Error {
  readonly code:
    | 'artifact_not_found'
    | 'invalid_input'
    | 'invalid_content'
    | 'validation_failed'
    | 'write_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'artifact_not_found'
      | 'invalid_input'
      | 'invalid_content'
      | 'validation_failed'
      | 'write_failed',
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'SpApiHandoffError';
    this.code = code;
    this.details = details;
  }
}

export class SpApiLocalStageError extends Error {
  readonly code:
    | 'artifact_not_found'
    | 'invalid_input'
    | 'invalid_content'
    | 'validation_failed'
    | 'write_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'artifact_not_found'
      | 'invalid_input'
      | 'invalid_content'
      | 'validation_failed'
      | 'write_failed',
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'SpApiLocalStageError';
    this.code = code;
    this.details = details;
  }
}

export class SpApiSqpIngestError extends Error {
  readonly code:
    | 'artifact_not_found'
    | 'invalid_input'
    | 'invalid_content'
    | 'validation_failed'
    | 'write_failed'
    | 'ingest_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'artifact_not_found'
      | 'invalid_input'
      | 'invalid_content'
      | 'validation_failed'
      | 'write_failed'
      | 'ingest_failed',
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'SpApiSqpIngestError';
    this.code = code;
    this.details = details;
  }
}

export class SpApiSqpPullError extends Error {
  readonly code:
    | 'invalid_input'
    | 'validation_failed'
    | 'artifact_not_found'
    | 'write_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'invalid_input'
      | 'validation_failed'
      | 'artifact_not_found'
      | 'write_failed',
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'SpApiSqpPullError';
    this.code = code;
    this.details = details;
  }
}

export class SpApiSearchTermsIngestError extends Error {
  readonly code:
    | 'artifact_not_found'
    | 'invalid_input'
    | 'invalid_content'
    | 'validation_failed'
    | 'write_failed'
    | 'ingest_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'artifact_not_found'
      | 'invalid_input'
      | 'invalid_content'
      | 'validation_failed'
      | 'write_failed'
      | 'ingest_failed',
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'SpApiSearchTermsIngestError';
    this.code = code;
    this.details = details;
  }
}

export class SpApiSearchTermsPullError extends Error {
  readonly code:
    | 'invalid_input'
    | 'validation_failed'
    | 'artifact_not_found'
    | 'write_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'invalid_input'
      | 'validation_failed'
      | 'artifact_not_found'
      | 'write_failed',
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'SpApiSearchTermsPullError';
    this.code = code;
    this.details = details;
  }
}
