import { describe, expect, it, vi } from 'vitest';

import {
  buildMarketplaceParticipationsRequest,
  fetchMarketplaceParticipations,
  summarizeMarketplaceParticipations,
} from './firstCall';

const makeEnv = () => ({
  SP_API_LWA_CLIENT_ID: 'client-id',
  SP_API_LWA_CLIENT_SECRET: 'client-secret',
  SP_API_REFRESH_TOKEN: 'refresh-token',
  SP_API_REGION: 'na',
  SP_API_MARKETPLACE_ID: 'ATVPDKIKX0DER',
});

describe('sp-api first real call boundary', () => {
  it('fails clearly when required env is missing', async () => {
    await expect(
      fetchMarketplaceParticipations({
        envSource: {
          ...makeEnv(),
          SP_API_LWA_CLIENT_SECRET: '   ',
        },
      })
    ).rejects.toMatchObject({
      name: 'SpApiConfigError',
      code: 'missing_env',
    });
  });

  it('surfaces token exchange errors as typed errors', async () => {
    const tokenTransport = vi.fn(async () => ({
      status: 401,
      json: { error: 'invalid_grant' },
    }));

    await expect(
      fetchMarketplaceParticipations({
        envSource: makeEnv(),
        tokenTransport,
        apiTransport: vi.fn(),
      })
    ).rejects.toMatchObject({
      name: 'SpApiAuthError',
      code: 'token_exchange_failed',
      status: 401,
    });
  });

  it('builds a safe summary from a mocked success response', async () => {
    const tokenTransport = vi.fn(async () => ({
      status: 200,
      json: {
        access_token: 'access-token',
        token_type: 'bearer',
        expires_in: 3600,
      },
    }));
    const apiTransport = vi.fn(async () => ({
      status: 200,
      json: {
        payload: [
          {
            marketplace: {
              id: 'ATVPDKIKX0DER',
              countryCode: 'US',
              name: 'Amazon.com',
            },
            participation: {
              isParticipating: true,
              hasSuspendedListings: false,
            },
          },
          {
            marketplace: {
              id: 'A1PA6795UKMFR9',
              countryCode: 'DE',
              name: 'Amazon.de',
            },
            participation: {
              isParticipating: true,
              hasSuspendedListings: false,
            },
          },
        ],
      },
    }));

    await expect(
      fetchMarketplaceParticipations({
        envSource: makeEnv(),
        tokenTransport,
        apiTransport,
      })
    ).resolves.toEqual({
      endpoint: 'getMarketplaceParticipations',
      region: 'na',
      marketplaceIds: ['ATVPDKIKX0DER', 'A1PA6795UKMFR9'],
      participationCount: 2,
    });

    expect(apiTransport).toHaveBeenCalledTimes(1);
    expect(apiTransport).toHaveBeenCalledWith({
      url: 'https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations',
      method: 'GET',
      headers: {
        'user-agent': 'amazon-performance-hub/v2-spapi-first-call',
        'x-amz-access-token': 'access-token',
      },
    });
  });

  it('covers safe-summary redaction behavior', () => {
    expect(
      summarizeMarketplaceParticipations({
        region: 'na',
        participations: [
          {
            marketplaceId: 'ATVPDKIKX0DER',
            countryCode: 'US',
            name: 'Amazon.com',
            isParticipating: true,
            hasSuspendedListings: false,
          },
        ],
      })
    ).toEqual({
      endpoint: 'getMarketplaceParticipations',
      region: 'na',
      marketplaceIds: ['ATVPDKIKX0DER'],
      participationCount: 1,
    });
  });

  it('builds an LWA-only request without AWS authorization headers', () => {
    expect(
      buildMarketplaceParticipationsRequest({
        region: 'na',
        accessToken: 'access-token',
      })
    ).toEqual({
      url: 'https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations',
      method: 'GET',
      headers: {
        'user-agent': 'amazon-performance-hub/v2-spapi-first-call',
        'x-amz-access-token': 'access-token',
      },
    });
  });
});
