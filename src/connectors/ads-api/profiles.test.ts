import { describe, expect, it, vi } from 'vitest';

import {
  buildAdsProfilesListRequest,
  buildAdsProfilesSyncArtifact,
  fetchAdsProfiles,
  findConfiguredAdsProfile,
  parseAdsProfilesResponse,
} from './profiles';
import { loadAdsApiEnvForProfileSync } from './env';

const profileSyncEnv = {
  AMAZON_ADS_CLIENT_ID: 'client-id',
  AMAZON_ADS_CLIENT_SECRET: 'client-secret',
  AMAZON_ADS_API_BASE_URL: 'https://advertising-api.amazon.com',
  AMAZON_ADS_REFRESH_TOKEN: 'refresh-token',
  AMAZON_ADS_PROFILE_ID: '222222222222222',
  APP_ACCOUNT_ID: 'sourbear',
  APP_MARKETPLACE: 'US',
};

const profilesPayload = [
  {
    profileId: 111111111111111,
    countryCode: 'CA',
    currencyCode: 'CAD',
    timezone: 'America/Toronto',
    accountInfo: {
      id: 991,
      type: 'seller',
      name: 'Maple Co',
      validPaymentMethod: false,
      ignored: 'field',
    },
    ignored: 'field',
  },
  {
    profileId: 222222222222222,
    countryCode: 'US',
    currencyCode: 'USD',
    timezone: 'America/Los_Angeles',
    accountInfo: {
      id: '992',
      type: 'seller',
      name: 'Bear Co',
      validPaymentMethod: true,
    },
  },
];

describe('Amazon Ads profiles boundary', () => {
  it('builds the profiles list request without a scope header', () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);

    expect(
      buildAdsProfilesListRequest({
        config,
        accessToken: 'access-token',
      })
    ).toEqual({
      url: 'https://advertising-api.amazon.com/v2/profiles',
      method: 'GET',
      headers: {
        authorization: 'Bearer access-token',
        'Amazon-Advertising-API-ClientId': 'client-id',
      },
    });
  });

  it('parses a successful profiles array payload', () => {
    expect(parseAdsProfilesResponse(profilesPayload)).toEqual([
      {
        profileId: '111111111111111',
        countryCode: 'CA',
        currencyCode: 'CAD',
        timezone: 'America/Toronto',
        accountInfo: {
          id: '991',
          type: 'seller',
          name: 'Maple Co',
          validPaymentMethod: false,
        },
      },
      {
        profileId: '222222222222222',
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'America/Los_Angeles',
        accountInfo: {
          id: '992',
          type: 'seller',
          name: 'Bear Co',
          validPaymentMethod: true,
        },
      },
    ]);
  });

  it('fails on non-array payloads', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const transport = vi.fn(async () => ({
      status: 200,
      json: {
        profileId: 123,
      },
    }));

    const result = await fetchAdsProfiles({
      config,
      accessToken: 'access-token',
      transport,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected invalid payload result to fail');
    }
    expect(result.error.code).toBe('invalid_response');
  });

  it('normalizes a non-2xx profiles fetch failure', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const transport = vi.fn(async () => ({
      status: 401,
      json: {
        detail: 'unauthorized',
      },
    }));

    const result = await fetchAdsProfiles({
      config,
      accessToken: 'access-token',
      transport,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected fetch result to fail');
    }
    expect(result.error.code).toBe('profiles_fetch_failed');
    expect(result.error.status).toBe(401);
  });

  it('normalizes a transport failure', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const transport = vi.fn(async () => {
      throw new Error('socket hang up');
    });

    const result = await fetchAdsProfiles({
      config,
      accessToken: 'access-token',
      transport,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected transport result to fail');
    }
    expect(result.error.code).toBe('transport_error');
    expect(result.error.message).toContain('before a response was received');
  });

  it('matches the configured profile and builds a deterministic artifact', () => {
    const parsedProfiles = parseAdsProfilesResponse(profilesPayload);
    if (!parsedProfiles) {
      throw new Error('expected profiles payload to parse');
    }

    expect(
      findConfiguredAdsProfile({
        profiles: parsedProfiles,
        configuredProfileId: '222222222222222',
      })
    ).toEqual({
      profileId: '222222222222222',
      countryCode: 'US',
      currencyCode: 'USD',
      timezone: 'America/Los_Angeles',
      accountInfo: {
        id: '992',
        type: 'seller',
        name: 'Bear Co',
        validPaymentMethod: true,
      },
    });

    expect(
      buildAdsProfilesSyncArtifact({
        profiles: parsedProfiles,
        configuredProfileId: '222222222222222',
        appAccountId: 'sourbear',
        appMarketplace: 'US',
        adsApiBaseUrl: 'https://advertising-api.amazon.com',
        generatedAt: '2026-04-17T00:00:00.000Z',
      })
    ).toEqual({
      schemaVersion: 'ads-api-profile-sync/v1',
      generatedAt: '2026-04-17T00:00:00.000Z',
      appAccountId: 'sourbear',
      appMarketplace: 'US',
      adsApiBaseUrl: 'https://advertising-api.amazon.com',
      configuredProfileId: '222222222222222',
      selectedProfile: {
        profileId: '222222222222222',
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'America/Los_Angeles',
        accountInfo: {
          id: '992',
          type: 'seller',
          name: 'Bear Co',
          validPaymentMethod: true,
        },
      },
      profileCount: 2,
      profilesSummary: [
        {
          profileId: '111111111111111',
          countryCode: 'CA',
          currencyCode: 'CAD',
          timezone: 'America/Toronto',
          accountInfo: {
            id: '991',
            type: 'seller',
            name: 'Maple Co',
            validPaymentMethod: false,
          },
        },
        {
          profileId: '222222222222222',
          countryCode: 'US',
          currencyCode: 'USD',
          timezone: 'America/Los_Angeles',
          accountInfo: {
            id: '992',
            type: 'seller',
            name: 'Bear Co',
            validPaymentMethod: true,
          },
        },
      ],
    });
  });

  it('fails when the configured profile is missing', () => {
    const parsedProfiles = parseAdsProfilesResponse(profilesPayload);
    if (!parsedProfiles) {
      throw new Error('expected profiles payload to parse');
    }

    expect(() =>
      findConfiguredAdsProfile({
        profiles: parsedProfiles,
        configuredProfileId: '999999999999999',
      })
    ).toThrowError(
      'Configured Amazon Ads profile id 999999999999999 was not found in the fetched profiles list'
    );
  });
});
