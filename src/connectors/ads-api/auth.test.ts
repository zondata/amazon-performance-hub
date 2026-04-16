import { describe, expect, it, vi } from 'vitest';

import {
  buildAdsAuthorizationCodeExchangeRequest,
  buildAdsAuthorizationUrl,
  buildAdsRefreshTokenRequest,
  exchangeAdsAuthorizationCode,
  parseAdsTokenSuccessResponse,
  refreshAdsAccessToken,
} from './auth';
import { loadAdsApiEnvForRefresh, loadAdsApiEnv } from './env';

const baseEnv = {
  AMAZON_ADS_CLIENT_ID: 'client-id',
  AMAZON_ADS_CLIENT_SECRET: 'client-secret',
  AMAZON_ADS_API_BASE_URL: 'https://advertising-api.amazon.com',
};

describe('Amazon Ads auth boundary', () => {
  it('builds the operator authorization URL', () => {
    expect(
      buildAdsAuthorizationUrl({
        clientId: 'client-id',
        redirectUri: 'https://example.com/callback',
        scope: 'cpc_advertising:campaign_management',
        state: 'local-state',
      })
    ).toBe(
      'https://www.amazon.com/ap/oa?client_id=client-id&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&scope=cpc_advertising%3Acampaign_management&response_type=code&state=local-state'
    );
  });

  it('builds the authorization-code exchange request payload', () => {
    const config = loadAdsApiEnv(baseEnv);

    expect(
      buildAdsAuthorizationCodeExchangeRequest({
        config,
        input: {
          code: 'auth-code',
          redirectUri: 'https://example.com/callback',
          scope: 'cpc_advertising:campaign_management',
        },
      })
    ).toEqual({
      url: 'https://api.amazon.com/auth/o2/token',
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: 'grant_type=authorization_code&code=auth-code&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&client_id=client-id&client_secret=client-secret&scope=cpc_advertising%3Acampaign_management',
    });
  });

  it('builds the refresh-token request payload', () => {
    const config = loadAdsApiEnvForRefresh({
      ...baseEnv,
      AMAZON_ADS_REFRESH_TOKEN: 'refresh-token',
    });

    expect(buildAdsRefreshTokenRequest(config)).toEqual({
      url: 'https://api.amazon.com/auth/o2/token',
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: 'grant_type=refresh_token&refresh_token=refresh-token&client_id=client-id&client_secret=client-secret',
    });
  });

  it('parses a success payload', () => {
    expect(
      parseAdsTokenSuccessResponse({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'scope-a',
      })
    ).toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      scope: 'scope-a',
    });
  });

  it('fails on invalid payloads', async () => {
    const config = loadAdsApiEnvForRefresh({
      ...baseEnv,
      AMAZON_ADS_REFRESH_TOKEN: 'refresh-token',
    });
    const transport = vi.fn(async () => ({
      status: 200,
      json: {
        token_type: 'bearer',
      },
    }));

    const result = await refreshAdsAccessToken({ config, transport });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected invalid payload result to fail');
    }
    expect(result.error.code).toBe('invalid_response');
  });

  it('normalizes a non-2xx token exchange failure', async () => {
    const config = loadAdsApiEnv({
      ...baseEnv,
    });
    const transport = vi.fn(async () => ({
      status: 400,
      json: {
        error: 'invalid_grant',
      },
    }));

    const result = await exchangeAdsAuthorizationCode({
      config,
      input: {
        code: 'auth-code',
        redirectUri: 'https://example.com/callback',
      },
      transport,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected exchange result to fail');
    }
    expect(result.error.code).toBe('token_exchange_failed');
    expect(result.error.status).toBe(400);
  });

  it('normalizes a transport failure', async () => {
    const config = loadAdsApiEnvForRefresh({
      ...baseEnv,
      AMAZON_ADS_REFRESH_TOKEN: 'refresh-token',
    });
    const transport = vi.fn(async () => {
      throw new Error('socket hang up');
    });

    const result = await refreshAdsAccessToken({ config, transport });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected transport result to fail');
    }
    expect(result.error.code).toBe('transport_error');
    expect(result.error.message).toContain('refresh-token exchange');
  });
});
