import {
  AdsApiProfilesError,
  type AdsApiEnvConfig,
  type AdsApiProfile,
  type AdsApiProfileAccountInfo,
  type AdsApiProfilesResult,
  type AdsApiProfilesSummaryEntry,
  type AdsApiProfilesSyncArtifact,
  type AdsApiTransport,
  type AdsApiTransportRequest,
} from './types';

const PROFILES_PATH = '/v2/profiles';

const readStringLike = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const parseAccountInfo = (value: unknown): AdsApiProfileAccountInfo | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  return {
    id: readStringLike(candidate.id),
    type: readStringLike(candidate.type),
    name: readStringLike(candidate.name),
    validPaymentMethod:
      typeof candidate.validPaymentMethod === 'boolean'
        ? candidate.validPaymentMethod
        : null,
  };
};

const parseProfile = (value: unknown): AdsApiProfile | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const profileId = readStringLike(candidate.profileId);

  if (!profileId) {
    return null;
  }

  return {
    profileId,
    countryCode: readStringLike(candidate.countryCode),
    currencyCode: readStringLike(candidate.currencyCode),
    timezone: readStringLike(candidate.timezone),
    accountInfo: parseAccountInfo(candidate.accountInfo),
  };
};

export const buildAdsProfilesListRequest = (args: {
  config: AdsApiEnvConfig;
  accessToken: string;
}): AdsApiTransportRequest => ({
  url: `${args.config.apiBaseUrl}${PROFILES_PATH}`,
  method: 'GET',
  headers: {
    authorization: `Bearer ${args.accessToken}`,
    'Amazon-Advertising-API-ClientId': args.config.credentials.clientId,
  },
});

export const parseAdsProfilesResponse = (
  value: unknown
): AdsApiProfile[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const profiles: AdsApiProfile[] = [];

  for (const item of value) {
    const parsed = parseProfile(item);
    if (!parsed) {
      return null;
    }
    profiles.push(parsed);
  }

  return profiles;
};

export const fetchAdsProfiles = async (args: {
  config: AdsApiEnvConfig;
  accessToken: string;
  transport: AdsApiTransport;
}): Promise<AdsApiProfilesResult> => {
  let response;

  try {
    response = await args.transport(
      buildAdsProfilesListRequest({
        config: args.config,
        accessToken: args.accessToken,
      })
    );
  } catch (error) {
    return {
      ok: false,
      error: new AdsApiProfilesError(
        'transport_error',
        'Amazon Ads profiles request failed before a response was received',
        { details: error }
      ),
    };
  }

  if (response.status < 200 || response.status >= 300) {
    return {
      ok: false,
      error: new AdsApiProfilesError(
        'profiles_fetch_failed',
        `Amazon Ads profiles request failed with status ${response.status}`,
        { status: response.status, details: response.json }
      ),
    };
  }

  const profiles = parseAdsProfilesResponse(response.json);
  if (!profiles) {
    return {
      ok: false,
      error: new AdsApiProfilesError(
        'invalid_response',
        'Amazon Ads profiles request returned an invalid response payload',
        { status: response.status, details: response.json }
      ),
    };
  }

  return {
    ok: true,
    profiles,
  };
};

const compareProfilesById = (left: { profileId: string }, right: { profileId: string }) =>
  left.profileId.localeCompare(right.profileId, 'en', { numeric: true });

export const findConfiguredAdsProfile = (args: {
  profiles: AdsApiProfile[];
  configuredProfileId: string;
}): AdsApiProfile => {
  const selected = args.profiles.find(
    (profile) => profile.profileId === args.configuredProfileId
  );

  if (!selected) {
    throw new AdsApiProfilesError(
      'configured_profile_missing',
      `Configured Amazon Ads profile id ${args.configuredProfileId} was not found in the fetched profiles list`,
      {
        details: {
          configuredProfileId: args.configuredProfileId,
          availableProfileIds: args.profiles.map((profile) => profile.profileId),
        },
      }
    );
  }

  return selected;
};

export const toAdsProfileSummaryEntry = (
  profile: AdsApiProfile
): AdsApiProfilesSummaryEntry => ({
  profileId: profile.profileId,
  countryCode: profile.countryCode,
  currencyCode: profile.currencyCode,
  timezone: profile.timezone,
  accountInfo: profile.accountInfo,
});

export const buildAdsProfilesSyncArtifact = (args: {
  profiles: AdsApiProfile[];
  configuredProfileId: string;
  appAccountId: string;
  appMarketplace: string;
  adsApiBaseUrl: string;
  generatedAt?: string;
}): AdsApiProfilesSyncArtifact => {
  const selectedProfile = findConfiguredAdsProfile({
    profiles: args.profiles,
    configuredProfileId: args.configuredProfileId,
  });

  return {
    schemaVersion: 'ads-api-profile-sync/v1',
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    appAccountId: args.appAccountId,
    appMarketplace: args.appMarketplace,
    adsApiBaseUrl: args.adsApiBaseUrl,
    configuredProfileId: args.configuredProfileId,
    selectedProfile,
    profileCount: args.profiles.length,
    profilesSummary: args.profiles
      .map(toAdsProfileSummaryEntry)
      .sort(compareProfilesById),
  };
};
