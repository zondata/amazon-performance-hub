export type AdsApiCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string | null;
};

export type AdsApiEnvConfig = {
  apiBaseUrl: string;
  credentials: AdsApiCredentials;
  profileId: string | null;
};

export type AdsApiProfileSyncEnvConfig = AdsApiEnvConfig & {
  profileId: string;
  appAccountId: string;
  appMarketplace: string;
};

export type AdsApiAuthorizationUrlInput = {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string | null;
};

export type AdsApiAuthorizationCodeExchangeInput = {
  code: string;
  redirectUri: string;
  scope?: string | null;
};

export type AdsApiTokenResponsePayload = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

export type AdsApiTransportRequest = {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
};

export type AdsApiTransportResponse = {
  status: number;
  json: unknown;
  headers?: Record<string, string | null>;
};

export type AdsApiTransport = (
  request: AdsApiTransportRequest
) => Promise<AdsApiTransportResponse>;

export type AdsApiDownloadTransportResponse = {
  status: number;
  body: Buffer;
  headers: Record<string, string | null>;
};

export type AdsApiDownloadTransport = (
  url: string
) => Promise<AdsApiDownloadTransportResponse>;

export type AdsApiTokenResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string | null;
      expiresIn: number;
      tokenType: string;
      scope: string | null;
      raw: AdsApiTokenResponsePayload;
    }
  | {
      ok: false;
      error: AdsApiAuthError;
    };

export class AdsApiConfigError extends Error {
  readonly code: 'missing_env' | 'invalid_env';
  readonly details?: unknown;

  constructor(
    code: 'missing_env' | 'invalid_env',
    message: string,
    options: { details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AdsApiConfigError';
    this.code = code;
    this.details = options.details;
  }
}

export class AdsApiAuthError extends Error {
  readonly code:
    | 'transport_error'
    | 'token_exchange_failed'
    | 'invalid_response';
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code:
      | 'transport_error'
      | 'token_exchange_failed'
      | 'invalid_response',
    message: string,
    options: { status?: number; details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AdsApiAuthError';
    this.code = code;
    this.status = options.status;
    this.details = options.details;
  }
}

export type AdsApiProfileAccountInfo = {
  id: string | null;
  type: string | null;
  name: string | null;
  validPaymentMethod: boolean | null;
};

export type AdsApiProfile = {
  profileId: string;
  countryCode: string | null;
  currencyCode: string | null;
  timezone: string | null;
  accountInfo: AdsApiProfileAccountInfo | null;
};

export type AdsApiProfilesSummaryEntry = {
  profileId: string;
  countryCode: string | null;
  currencyCode: string | null;
  timezone: string | null;
  accountInfo: AdsApiProfileAccountInfo | null;
};

export type AdsApiProfilesSyncArtifact = {
  schemaVersion: 'ads-api-profile-sync/v1';
  generatedAt: string;
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  configuredProfileId: string;
  selectedProfile: AdsApiProfile;
  profileCount: number;
  profilesSummary: AdsApiProfilesSummaryEntry[];
};

export type AdsApiProfilesResult =
  | {
      ok: true;
      profiles: AdsApiProfile[];
    }
  | {
      ok: false;
      error: AdsApiProfilesError;
    };

export class AdsApiProfilesError extends Error {
  readonly code:
    | 'transport_error'
    | 'profiles_fetch_failed'
    | 'invalid_response'
    | 'configured_profile_missing';
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code:
      | 'transport_error'
      | 'profiles_fetch_failed'
      | 'invalid_response'
      | 'configured_profile_missing',
    message: string,
    options: { status?: number; details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AdsApiProfilesError';
    this.code = code;
    this.status = options.status;
    this.details = options.details;
  }
}

export type AdsApiDateRange = {
  startDate: string;
  endDate: string;
};

export type AdsApiValidatedProfileSyncArtifact = AdsApiProfilesSyncArtifact & {
  selectedProfile: AdsApiProfile;
};

export type AdsApiSpCampaignDailyCreateRequest = {
  name: string;
  startDate: string;
  endDate: string;
  configuration: {
    adProduct: 'SPONSORED_PRODUCTS';
    groupBy: ['campaign'];
    columns: string[];
    reportTypeId: 'spCampaigns';
    timeUnit: 'DAILY';
    format: 'GZIP_JSON';
  };
};

export type AdsApiSpCampaignDailyReportMetadata = {
  reportId: string;
  status: string | null;
  statusDetails: string | null;
  location: string | null;
  fileSize: number | null;
};

export type AdsApiSpCampaignDailyRawPayload = {
  format: 'json' | 'csv';
  rows: Array<Record<string, unknown>>;
};

export type AdsApiSpCampaignDailyRawArtifact = {
  schemaVersion: 'ads-api-sp-campaign-daily-raw/v1';
  generatedAt: string;
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  reportMetadata: Omit<AdsApiSpCampaignDailyReportMetadata, 'location'> & {
    downloadUrlPresent: boolean;
  };
  rawRowsPayload: AdsApiSpCampaignDailyRawPayload;
};

export type AdsApiSpCampaignDailyNormalizedRow = {
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  campaignBudgetType: string | null;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  attributedSales14d: number;
  attributedConversions14d: number;
  currencyCode: string | null;
};

export type AdsApiSpCampaignDailyNormalizedArtifact = {
  schemaVersion: 'ads-api-sp-campaign-daily-normalized/v1';
  generatedAt: string;
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  rowCount: number;
  normalizedCampaignRows: AdsApiSpCampaignDailyNormalizedRow[];
};

export class AdsApiSpCampaignDailyError extends Error {
  readonly code:
    | 'invalid_date'
    | 'profile_sync_artifact_missing'
    | 'profile_sync_artifact_invalid'
    | 'profile_sync_artifact_mismatch'
    | 'pending_report_not_found'
    | 'transport_error'
    | 'report_request_failed'
    | 'invalid_response'
    | 'report_timeout'
    | 'pending_timeout'
    | 'report_failed'
    | 'download_failed';
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code:
      | 'invalid_date'
      | 'profile_sync_artifact_missing'
      | 'profile_sync_artifact_invalid'
      | 'profile_sync_artifact_mismatch'
      | 'pending_report_not_found'
      | 'transport_error'
      | 'report_request_failed'
      | 'invalid_response'
      | 'report_timeout'
      | 'pending_timeout'
      | 'report_failed'
      | 'download_failed',
    message: string,
    options: { status?: number; details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AdsApiSpCampaignDailyError';
    this.code = code;
    this.status = options.status;
    this.details = options.details;
  }
}

export type AdsApiSpTargetDailyCreateRequest = {
  name: string;
  startDate: string;
  endDate: string;
  configuration: {
    adProduct: 'SPONSORED_PRODUCTS';
    groupBy: ['targeting'];
    columns: string[];
    reportTypeId: 'spTargeting';
    timeUnit: 'DAILY';
    format: 'GZIP_JSON';
  };
};

export type AdsApiSpTargetDailyReportMetadata = {
  reportId: string;
  status: string | null;
  statusDetails: string | null;
  location: string | null;
  fileSize: number | null;
};

export type AdsApiSpTargetDailyRawPayload = {
  format: 'json' | 'csv';
  rows: Array<Record<string, unknown>>;
};

export type AdsApiSpTargetDailyRawArtifact = {
  schemaVersion: 'ads-api-sp-target-daily-raw/v1';
  generatedAt: string;
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  reportMetadata: Omit<AdsApiSpTargetDailyReportMetadata, 'location'> & {
    downloadUrlPresent: boolean;
  };
  rawRowsPayload: AdsApiSpTargetDailyRawPayload;
};

export type AdsApiSpTargetDailyNormalizedRow = {
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
  campaignId: string;
  campaignName: string | null;
  adGroupId: string;
  adGroupName: string | null;
  targetId: string;
  targetingExpression: string | null;
  matchType: string | null;
  targetStatus: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  attributedSales14d: number;
  attributedConversions14d: number;
  currencyCode: string | null;
};

export type AdsApiSpTargetDailyNormalizedArtifact = {
  schemaVersion: 'ads-api-sp-target-daily-normalized/v1';
  generatedAt: string;
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  rowCount: number;
  normalizedTargetRows: AdsApiSpTargetDailyNormalizedRow[];
};

export class AdsApiSpTargetDailyError extends Error {
  readonly code:
    | 'invalid_date'
    | 'profile_sync_artifact_missing'
    | 'profile_sync_artifact_invalid'
    | 'profile_sync_artifact_mismatch'
    | 'transport_error'
    | 'report_request_failed'
    | 'invalid_response'
    | 'report_timeout'
    | 'pending_timeout'
    | 'report_failed'
    | 'download_failed';
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code:
      | 'invalid_date'
      | 'profile_sync_artifact_missing'
      | 'profile_sync_artifact_invalid'
      | 'profile_sync_artifact_mismatch'
      | 'transport_error'
      | 'report_request_failed'
      | 'invalid_response'
      | 'report_timeout'
      | 'pending_timeout'
      | 'report_failed'
      | 'download_failed',
    message: string,
    options: { status?: number; details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AdsApiSpTargetDailyError';
    this.code = code;
    this.status = options.status;
    this.details = options.details;
  }
}

export type AdsApiSpPlacementDailyCreateRequest = {
  name: string;
  startDate: string;
  endDate: string;
  configuration: {
    adProduct: 'SPONSORED_PRODUCTS';
    groupBy: ['campaign', 'campaignPlacement'];
    columns: string[];
    reportTypeId: 'spCampaigns';
    timeUnit: 'DAILY';
    format: 'GZIP_JSON';
  };
};

export type AdsApiSpPlacementDailyReportMetadata = {
  reportId: string;
  status: string | null;
  statusDetails: string | null;
  location: string | null;
  fileSize: number | null;
};

export type AdsApiSpPlacementDailyRawPayload = {
  format: 'json' | 'csv';
  rows: Array<Record<string, unknown>>;
};

export type AdsApiSpPlacementDailyRawArtifact = {
  schemaVersion: 'ads-api-sp-placement-daily-raw/v1';
  generatedAt: string;
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  reportMetadata: Omit<AdsApiSpPlacementDailyReportMetadata, 'location'> & {
    downloadUrlPresent: boolean;
  };
  rawRowsPayload: AdsApiSpPlacementDailyRawPayload;
};

export type AdsApiSpPlacementDailyNormalizedRow = {
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
  campaignId: string;
  campaignName: string;
  campaignBiddingStrategy: string | null;
  placementClassification: string;
  placementRaw: string;
  placementCode: 'OA' | 'PP' | 'ROS' | 'TOS' | 'UNKNOWN';
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  attributedSales14d: number;
  attributedConversions14d: number;
  attributedUnitsOrdered14d: number;
  costPerClick: number | null;
  clickThroughRate: number | null;
  currencyCode: string | null;
};

export type AdsApiSpPlacementDailyNormalizedArtifact = {
  schemaVersion: 'ads-api-sp-placement-daily-normalized/v1';
  generatedAt: string;
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  rowCount: number;
  normalizedPlacementRows: AdsApiSpPlacementDailyNormalizedRow[];
};

export type AdsApiSpAdvertisedProductDailyCreateRequest = {
  name: string;
  startDate: string;
  endDate: string;
  configuration: {
    adProduct: 'SPONSORED_PRODUCTS';
    groupBy: ['advertiser'];
    columns: string[];
    reportTypeId: 'spAdvertisedProduct';
    timeUnit: 'DAILY';
    format: 'GZIP_JSON';
  };
};

export type AdsApiSpAdvertisedProductDailyReportMetadata = {
  reportId: string;
  status: string | null;
  statusDetails: string | null;
  location: string | null;
  fileSize: number | null;
};

export type AdsApiSpAdvertisedProductDailyRawPayload = {
  format: 'json' | 'csv';
  rows: Array<Record<string, unknown>>;
};

export type AdsApiSpAdvertisedProductDailyRawArtifact = {
  schemaVersion: 'ads-api-sp-advertised-product-daily-raw/v1';
  generatedAt: string;
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  reportMetadata: Omit<AdsApiSpAdvertisedProductDailyReportMetadata, 'location'> & {
    downloadUrlPresent: boolean;
  };
  rawRowsPayload: AdsApiSpAdvertisedProductDailyRawPayload;
};

export type AdsApiSpAdvertisedProductDailyNormalizedRow = {
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string | null;
  adGroupName: string | null;
  advertisedAsin: string;
  advertisedSku: string | null;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  attributedSales14d: number;
  attributedConversions14d: number;
  attributedUnitsOrdered14d: number;
  currencyCode: string | null;
};

export type AdsApiSpAdvertisedProductDailyNormalizedArtifact = {
  schemaVersion: 'ads-api-sp-advertised-product-daily-normalized/v1';
  generatedAt: string;
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  rowCount: number;
  normalizedAdvertisedProductRows: AdsApiSpAdvertisedProductDailyNormalizedRow[];
};

export class AdsApiSpAdvertisedProductDailyError extends Error {
  readonly code:
    | 'invalid_date'
    | 'profile_sync_artifact_missing'
    | 'profile_sync_artifact_invalid'
    | 'profile_sync_artifact_mismatch'
    | 'pending_report_not_found'
    | 'transport_error'
    | 'report_request_failed'
    | 'invalid_response'
    | 'report_timeout'
    | 'pending_timeout'
    | 'report_failed'
    | 'download_failed';
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code:
      | 'invalid_date'
      | 'profile_sync_artifact_missing'
      | 'profile_sync_artifact_invalid'
      | 'profile_sync_artifact_mismatch'
      | 'pending_report_not_found'
      | 'transport_error'
      | 'report_request_failed'
      | 'invalid_response'
      | 'report_timeout'
      | 'pending_timeout'
      | 'report_failed'
      | 'download_failed',
    message: string,
    options: { status?: number; details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AdsApiSpAdvertisedProductDailyError';
    this.code = code;
    this.status = options.status;
    this.details = options.details;
  }
}

export class AdsApiSpPlacementDailyError extends Error {
  readonly code:
    | 'invalid_date'
    | 'profile_sync_artifact_missing'
    | 'profile_sync_artifact_invalid'
    | 'profile_sync_artifact_mismatch'
    | 'transport_error'
    | 'report_request_failed'
    | 'invalid_response'
    | 'report_timeout'
    | 'pending_timeout'
    | 'report_failed'
    | 'download_failed';
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code:
      | 'invalid_date'
      | 'profile_sync_artifact_missing'
      | 'profile_sync_artifact_invalid'
      | 'profile_sync_artifact_mismatch'
      | 'transport_error'
      | 'report_request_failed'
      | 'invalid_response'
      | 'report_timeout'
      | 'pending_timeout'
      | 'report_failed'
      | 'download_failed',
    message: string,
    options: { status?: number; details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AdsApiSpPlacementDailyError';
    this.code = code;
    this.status = options.status;
    this.details = options.details;
  }
}

export type AdsApiPersistenceSources = {
  campaignRawArtifactPath: string;
  campaignNormalizedArtifactPath: string;
  targetRawArtifactPath: string;
  targetNormalizedArtifactPath: string;
  placementRawArtifactPath: string;
  placementNormalizedArtifactPath: string;
};

export type AdsApiSpDailySummaryRow = {
  date: string;
  campaignRowCount: number;
  targetRowCount: number;
  placementRowCount: number;
  campaignImpressions: number;
  campaignClicks: number;
  campaignCost: number;
  campaignAttributedSales14d: number;
  campaignAttributedConversions14d: number;
  targetImpressions: number;
  targetClicks: number;
  targetCost: number;
  targetAttributedSales14d: number;
  targetAttributedConversions14d: number;
  placementImpressions: number;
  placementClicks: number;
  placementCost: number;
  placementAttributedSales14d: number;
  placementAttributedConversions14d: number;
};

export type AdsApiPersistedLandingArtifact = {
  schemaVersion: 'ads-api-sp-daily-landed/v1';
  generatedAt: string;
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  sources: AdsApiPersistenceSources;
  campaignRaw: AdsApiSpCampaignDailyRawArtifact;
  targetRaw: AdsApiSpTargetDailyRawArtifact;
  placementRaw: AdsApiSpPlacementDailyRawArtifact;
};

export type AdsApiPersistedNormalizationArtifact = {
  schemaVersion: 'ads-api-sp-daily-persisted/v1';
  generatedAt: string;
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  campaignRowCount: number;
  targetRowCount: number;
  placementRowCount: number;
  campaignRows: AdsApiSpCampaignDailyNormalizedRow[];
  targetRows: AdsApiSpTargetDailyNormalizedRow[];
  placementRows: AdsApiSpPlacementDailyNormalizedRow[];
  dailySummary: AdsApiSpDailySummaryRow[];
};

export class AdsApiPersistenceError extends Error {
  readonly code:
    | 'artifact_missing'
    | 'artifact_invalid'
    | 'artifact_mismatch'
    | 'invalid_rows';
  readonly details?: unknown;

  constructor(
    code:
      | 'artifact_missing'
      | 'artifact_invalid'
      | 'artifact_mismatch'
      | 'invalid_rows',
    message: string,
    options: { details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AdsApiPersistenceError';
    this.code = code;
    this.details = options.details;
  }
}

export type AdsApiCampaignIngestGateSinkSummary = {
  ingestStatus: 'ok' | 'already ingested';
  mapStatus: 'ok' | 'missing_snapshot';
  uploadId: string;
  rawRowCount: number | null;
  factRows: number;
  issueRows: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  tempCsvPath: string;
};

export type AdsApiCampaignIngestGateResult = {
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  campaignRowCount: number;
  sinkResult: AdsApiCampaignIngestGateSinkSummary;
};

export class AdsApiCampaignIngestGateError extends Error {
  readonly code:
    | 'artifact_missing'
    | 'artifact_invalid'
    | 'artifact_mismatch'
    | 'invalid_rows'
    | 'sink_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'artifact_missing'
      | 'artifact_invalid'
      | 'artifact_mismatch'
      | 'invalid_rows'
      | 'sink_failed',
    message: string,
    options: { details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AdsApiCampaignIngestGateError';
    this.code = code;
    this.details = options.details;
  }
}

export type AdsApiTargetIngestGateSinkSummary = {
  ingestStatus: 'ok' | 'already ingested';
  mapStatus: 'ok' | 'missing_snapshot';
  uploadId: string;
  rawRowCount: number | null;
  factRows: number;
  issueRows: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  tempXlsxPath: string;
};

export type AdsApiTargetIngestGateResult = {
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  targetRowCount: number;
  sinkResult: AdsApiTargetIngestGateSinkSummary;
};

export class AdsApiTargetIngestGateError extends Error {
  readonly code:
    | 'artifact_missing'
    | 'artifact_invalid'
    | 'artifact_mismatch'
    | 'invalid_rows'
    | 'sink_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'artifact_missing'
      | 'artifact_invalid'
      | 'artifact_mismatch'
      | 'invalid_rows'
      | 'sink_failed',
    message: string,
    options: { details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AdsApiTargetIngestGateError';
    this.code = code;
    this.details = options.details;
  }
}

export type AdsApiPlacementIngestGateSinkSummary = {
  ingestStatus: 'ok' | 'already ingested';
  mapStatus: 'ok' | 'missing_snapshot';
  uploadId: string;
  rawRowCount: number | null;
  factRows: number;
  issueRows: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  tempXlsxPath: string;
};

export type AdsApiPlacementIngestGateResult = {
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  placementRowCount: number;
  sinkResult: AdsApiPlacementIngestGateSinkSummary;
};

export class AdsApiPlacementIngestGateError extends Error {
  readonly code:
    | 'artifact_missing'
    | 'artifact_invalid'
    | 'artifact_mismatch'
    | 'invalid_rows'
    | 'sink_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'artifact_missing'
      | 'artifact_invalid'
      | 'artifact_mismatch'
      | 'invalid_rows'
      | 'sink_failed',
    message: string,
    options: { details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AdsApiPlacementIngestGateError';
    this.code = code;
    this.details = options.details;
  }
}

export type AdsApiAdvertisedProductIngestGateSinkSummary = {
  ingestStatus: 'ok' | 'already ingested';
  mapStatus: 'not_required';
  uploadId: string;
  rowCount: number | null;
  factRows: number;
  issueRows: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  tempXlsxPath: string;
};

export type AdsApiAdvertisedProductIngestGateResult = {
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
  requestedDateRange: AdsApiDateRange;
  advertisedProductRowCount: number;
  sinkResult: AdsApiAdvertisedProductIngestGateSinkSummary;
};

export class AdsApiAdvertisedProductIngestGateError extends Error {
  readonly code:
    | 'artifact_missing'
    | 'artifact_invalid'
    | 'artifact_mismatch'
    | 'invalid_rows'
    | 'sink_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'artifact_missing'
      | 'artifact_invalid'
      | 'artifact_mismatch'
      | 'invalid_rows'
      | 'sink_failed',
    message: string,
    options: { details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AdsApiAdvertisedProductIngestGateError';
    this.code = code;
    this.details = options.details;
  }
}
