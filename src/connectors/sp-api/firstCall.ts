import { loadSpApiEnv, type SpApiEnvSource } from './env';
import {
  SELLERS_MARKETPLACE_PARTICIPATIONS_PATH,
  resolveSpApiEndpoint,
} from './endpoints';
import { refreshSpApiAccessToken } from './auth';
import {
  SpApiRequestError,
  type SpApiFirstCallSummary,
  type SpApiMarketplaceParticipation,
  type SpApiRegion,
  type SpApiTransport,
  type SpApiTransportRequest,
  type SpApiTransportResponse,
} from './types';

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

const asBoolean = (value: unknown) =>
  typeof value === 'boolean' ? value : null;

const parseMarketplaceParticipations = (
  value: unknown
): SpApiMarketplaceParticipation[] | null => {
  const payload = asObject(value)?.payload;
  if (!Array.isArray(payload)) return null;

  return payload.map((entry) => {
    const row = asObject(entry);
    const marketplace = asObject(row?.marketplace);
    const participation = asObject(row?.participation);

    return {
      marketplaceId: asString(marketplace?.id),
      countryCode: asString(marketplace?.countryCode),
      name: asString(marketplace?.name),
      isParticipating: asBoolean(participation?.isParticipating),
      hasSuspendedListings: asBoolean(participation?.hasSuspendedListings),
    };
  });
};

export const summarizeMarketplaceParticipations = (args: {
  region: 'na' | 'eu' | 'fe';
  participations: SpApiMarketplaceParticipation[];
}): SpApiFirstCallSummary => ({
  endpoint: 'getMarketplaceParticipations',
  region: args.region,
  marketplaceIds: Array.from(
    new Set(
      args.participations
        .map((entry) => entry.marketplaceId)
        .filter((entry): entry is string => Boolean(entry))
    )
  ),
  participationCount: args.participations.length,
});

export const buildMarketplaceParticipationsRequest = (args: {
  region: SpApiRegion;
  accessToken: string;
}): SpApiTransportRequest => {
  const accessToken = args.accessToken.trim();
  if (!accessToken) {
    throw new SpApiRequestError(
      'request_build_error',
      'SP-API request requires a non-empty access token'
    );
  }

  return {
    url: `${resolveSpApiEndpoint(args.region)}${SELLERS_MARKETPLACE_PARTICIPATIONS_PATH}`,
    method: 'GET',
    headers: {
      'user-agent': 'amazon-performance-hub/v2-spapi-first-call',
      'x-amz-access-token': accessToken,
    },
  };
};

export const fetchMarketplaceParticipations = async (args?: {
  envSource?: SpApiEnvSource;
  tokenTransport?: SpApiTransport;
  apiTransport?: SpApiTransport;
}): Promise<SpApiFirstCallSummary> => {
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

  const request = buildMarketplaceParticipationsRequest({
    region: config.region,
    accessToken: tokenResult.accessToken,
  });

  let response: SpApiTransportResponse;
  try {
    response = await apiTransport(request);
  } catch (error) {
    throw new SpApiRequestError(
      'api_response_error',
      'SP-API marketplace participations request failed before receiving a response',
      { details: error }
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw new SpApiRequestError(
      'api_response_error',
      `SP-API marketplace participations request failed with status ${response.status}`,
      { status: response.status, details: response.json }
    );
  }

  const participations = parseMarketplaceParticipations(response.json);
  if (!participations) {
    throw new SpApiRequestError(
      'invalid_response',
      'SP-API marketplace participations response did not contain a valid payload array',
      { status: response.status, details: response.json }
    );
  }

  return summarizeMarketplaceParticipations({
    region: config.region,
    participations,
  });
};

export const getMarketplaceParticipationsEndpointSummary = (
  envSource?: SpApiEnvSource
) => {
  const config = loadSpApiEnv(envSource);

  return {
    region: config.region,
    endpoint: resolveSpApiEndpoint(config.region),
    path: SELLERS_MARKETPLACE_PARTICIPATIONS_PATH,
    marketplaceId: config.marketplaceId,
  };
};
