import {
  AdsApiAuthError,
  type AdsApiAuthorizationCodeExchangeInput,
  type AdsApiAuthorizationUrlInput,
  type AdsApiEnvConfig,
  type AdsApiTokenResponsePayload,
  type AdsApiTokenResult,
  type AdsApiTransport,
  type AdsApiTransportRequest,
} from './types';
import { buildAdsAuthorizationUrlFromInputs, LWA_TOKEN_ENDPOINT } from './endpoints';

const CONTENT_TYPE = 'application/x-www-form-urlencoded; charset=UTF-8';

const parseExpiresIn = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export const parseAdsTokenSuccessResponse = (
  value: unknown
): AdsApiTokenResponsePayload | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const expiresIn = parseExpiresIn(candidate.expires_in);

  if (
    typeof candidate.access_token !== 'string' ||
    typeof candidate.token_type !== 'string' ||
    expiresIn === null
  ) {
    return null;
  }

  return {
    access_token: candidate.access_token,
    refresh_token:
      typeof candidate.refresh_token === 'string'
        ? candidate.refresh_token
        : undefined,
    token_type: candidate.token_type,
    expires_in: expiresIn,
    scope: typeof candidate.scope === 'string' ? candidate.scope : undefined,
  };
};

export const buildAdsAuthorizationUrl = (
  input: AdsApiAuthorizationUrlInput
): string => buildAdsAuthorizationUrlFromInputs(input);

export const buildAdsAuthorizationCodeExchangeRequest = (args: {
  config: AdsApiEnvConfig;
  input: AdsApiAuthorizationCodeExchangeInput;
}): AdsApiTransportRequest => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.input.code.trim(),
    redirect_uri: args.input.redirectUri.trim(),
    client_id: args.config.credentials.clientId,
    client_secret: args.config.credentials.clientSecret,
  });

  if (typeof args.input.scope === 'string' && args.input.scope.trim().length > 0) {
    body.set('scope', args.input.scope.trim());
  }

  return {
    url: LWA_TOKEN_ENDPOINT,
    method: 'POST',
    headers: {
      'content-type': CONTENT_TYPE,
    },
    body: body.toString(),
  };
};

export const buildAdsRefreshTokenRequest = (
  config: AdsApiEnvConfig
): AdsApiTransportRequest => ({
  url: LWA_TOKEN_ENDPOINT,
  method: 'POST',
  headers: {
    'content-type': CONTENT_TYPE,
  },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: config.credentials.refreshToken ?? '',
    client_id: config.credentials.clientId,
    client_secret: config.credentials.clientSecret,
  }).toString(),
});

const toTokenResult = (
  responseStatus: number,
  json: unknown
): AdsApiTokenResult => {
  if (responseStatus < 200 || responseStatus >= 300) {
    return {
      ok: false,
      error: new AdsApiAuthError(
        'token_exchange_failed',
        `Amazon Ads token request failed with status ${responseStatus}`,
        { status: responseStatus, details: json }
      ),
    };
  }

  const parsed = parseAdsTokenSuccessResponse(json);
  if (!parsed) {
    return {
      ok: false,
      error: new AdsApiAuthError(
        'invalid_response',
        'Amazon Ads token request returned an invalid response payload',
        { status: responseStatus, details: json }
      ),
    };
  }

  return {
    ok: true,
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? null,
    expiresIn: parsed.expires_in,
    tokenType: parsed.token_type,
    scope: parsed.scope ?? null,
    raw: parsed,
  };
};

const runAdsTokenRequest = async (args: {
  request: AdsApiTransportRequest;
  transport: AdsApiTransport;
  operationLabel: string;
}): Promise<AdsApiTokenResult> => {
  let response;

  try {
    response = await args.transport(args.request);
  } catch (error) {
    return {
      ok: false,
      error: new AdsApiAuthError(
        'transport_error',
        `Amazon Ads ${args.operationLabel} request failed before a response was received`,
        { details: error }
      ),
    };
  }

  return toTokenResult(response.status, response.json);
};

export const exchangeAdsAuthorizationCode = async (args: {
  config: AdsApiEnvConfig;
  input: AdsApiAuthorizationCodeExchangeInput;
  transport: AdsApiTransport;
}): Promise<AdsApiTokenResult> =>
  runAdsTokenRequest({
    request: buildAdsAuthorizationCodeExchangeRequest({
      config: args.config,
      input: args.input,
    }),
    transport: args.transport,
    operationLabel: 'authorization-code exchange',
  });

export const refreshAdsAccessToken = async (args: {
  config: AdsApiEnvConfig;
  transport: AdsApiTransport;
}): Promise<AdsApiTokenResult> =>
  runAdsTokenRequest({
    request: buildAdsRefreshTokenRequest(args.config),
    transport: args.transport,
    operationLabel: 'refresh-token exchange',
  });

export const adsApiFetchTransport: AdsApiTransport = async (request) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  const text = await response.text();
  let json: unknown = null;

  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { rawText: text };
    }
  }

  return {
    status: response.status,
    json,
  };
};
