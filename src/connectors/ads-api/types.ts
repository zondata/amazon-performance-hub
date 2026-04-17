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
};

export type AdsApiTransport = (
  request: AdsApiTransportRequest
) => Promise<AdsApiTransportResponse>;

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
