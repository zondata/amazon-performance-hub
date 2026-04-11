import {
  SpApiAuthError,
  type LwaTokenSuccessResponse,
  type SpApiEnvConfig,
  type SpApiTokenRefreshResult,
  type SpApiTransport,
  type SpApiTransportRequest,
} from './types';
import { LWA_TOKEN_ENDPOINT } from './endpoints';

const parseLwaTokenResponse = (value: unknown): LwaTokenSuccessResponse | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.access_token !== 'string' ||
    typeof candidate.token_type !== 'string' ||
    typeof candidate.expires_in !== 'number'
  ) {
    return null;
  }

  return {
    access_token: candidate.access_token,
    token_type: candidate.token_type,
    expires_in: candidate.expires_in,
    scope: typeof candidate.scope === 'string' ? candidate.scope : undefined,
  };
};

export const buildSpApiTokenRefreshRequest = (
  config: SpApiEnvConfig
): SpApiTransportRequest => ({
  url: LWA_TOKEN_ENDPOINT,
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: config.credentials.refreshToken,
    client_id: config.credentials.lwaClientId,
    client_secret: config.credentials.lwaClientSecret,
  }).toString(),
});

export const refreshSpApiAccessToken = async (args: {
  config: SpApiEnvConfig;
  transport: SpApiTransport;
}): Promise<SpApiTokenRefreshResult> => {
  const request = buildSpApiTokenRefreshRequest(args.config);

  let response;
  try {
    response = await args.transport(request);
  } catch (error) {
    return {
      ok: false,
      error: new SpApiAuthError(
        'transport_error',
        'SP-API LWA token refresh transport failed',
        { details: error }
      ),
    };
  }

  if (response.status < 200 || response.status >= 300) {
    return {
      ok: false,
      error: new SpApiAuthError(
        'token_exchange_failed',
        `SP-API LWA token refresh failed with status ${response.status}`,
        { status: response.status, details: response.json }
      ),
    };
  }

  const parsed = parseLwaTokenResponse(response.json);
  if (!parsed) {
    return {
      ok: false,
      error: new SpApiAuthError(
        'invalid_response',
        'SP-API LWA token refresh returned an invalid response payload',
        { status: response.status, details: response.json }
      ),
    };
  }

  return {
    ok: true,
    accessToken: parsed.access_token,
    expiresIn: parsed.expires_in,
    tokenType: parsed.token_type,
    scope: parsed.scope ?? null,
    raw: parsed,
  };
};
