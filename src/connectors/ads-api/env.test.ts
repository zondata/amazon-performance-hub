import { describe, expect, it } from 'vitest';

import {
  loadAdsApiEnv,
  loadAdsApiEnvForRefresh,
  normalizeAmazonAdsRefreshToken,
} from './env';

describe('Amazon Ads env loading', () => {
  it('lists exact missing required keys', () => {
    expect(() => loadAdsApiEnv({})).toThrowError(
      'Missing required Amazon Ads environment variables: AMAZON_ADS_CLIENT_ID, AMAZON_ADS_CLIENT_SECRET, AMAZON_ADS_API_BASE_URL'
    );
  });

  it('normalizes a quoted refresh token without changing interior characters', () => {
    expect(normalizeAmazonAdsRefreshToken('  " refresh token value "  ')).toBe(
      'refresh token value'
    );
    expect(normalizeAmazonAdsRefreshToken("  'abc=123/xyz'  ")).toBe(
      'abc=123/xyz'
    );
    expect(normalizeAmazonAdsRefreshToken('"abc"def')).toBe('"abc"def');
  });

  it('loads base config with optional profile id', () => {
    const config = loadAdsApiEnv({
      AMAZON_ADS_CLIENT_ID: ' client-id ',
      AMAZON_ADS_CLIENT_SECRET: ' client-secret ',
      AMAZON_ADS_API_BASE_URL: ' https://advertising-api.amazon.com/ ',
      AMAZON_ADS_PROFILE_ID: ' 123456789 ',
    });

    expect(config).toEqual({
      apiBaseUrl: 'https://advertising-api.amazon.com',
      profileId: '123456789',
      credentials: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: null,
      },
    });
  });

  it('requires refresh token for refresh-only config', () => {
    expect(() =>
      loadAdsApiEnvForRefresh({
        AMAZON_ADS_CLIENT_ID: 'client-id',
        AMAZON_ADS_CLIENT_SECRET: 'client-secret',
        AMAZON_ADS_API_BASE_URL: 'https://advertising-api.amazon.com',
      })
    ).toThrowError(
      'Missing required Amazon Ads environment variables: AMAZON_ADS_REFRESH_TOKEN'
    );
  });
});
