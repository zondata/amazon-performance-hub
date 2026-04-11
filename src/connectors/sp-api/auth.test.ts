import { describe, expect, it, vi } from 'vitest';

import { buildSpApiTokenRefreshRequest, refreshSpApiAccessToken } from './auth';
import { loadSpApiEnv } from './env';

const config = loadSpApiEnv({
  SP_API_LWA_CLIENT_ID: 'client-id',
  SP_API_LWA_CLIENT_SECRET: 'client-secret',
  SP_API_REFRESH_TOKEN: 'refresh-token',
  SP_API_REGION: 'na',
  SP_API_MARKETPLACE_ID: 'ATVPDKIKX0DER',
});

describe('sp-api token refresh boundary', () => {
  it('builds the refresh-token request payload', () => {
    const request = buildSpApiTokenRefreshRequest(config);

    expect(request).toEqual({
      url: 'https://api.amazon.com/auth/o2/token',
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: 'grant_type=refresh_token&refresh_token=refresh-token&client_id=client-id&client_secret=client-secret',
    });
  });

  it('handles a mocked success response', async () => {
    const transport = vi.fn(async () => ({
      status: 200,
      json: {
        access_token: 'access-token',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'sellingpartnerapi::notifications',
      },
    }));

    await expect(
      refreshSpApiAccessToken({
        config,
        transport,
      })
    ).resolves.toEqual({
      ok: true,
      accessToken: 'access-token',
      expiresIn: 3600,
      tokenType: 'bearer',
      scope: 'sellingpartnerapi::notifications',
      raw: {
        access_token: 'access-token',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'sellingpartnerapi::notifications',
      },
    });
  });

  it('handles a mocked error response', async () => {
    const transport = vi.fn(async () => ({
      status: 400,
      json: {
        error: 'invalid_grant',
      },
    }));

    const result = await refreshSpApiAccessToken({
      config,
      transport,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected refresh result to fail');
    }
    expect(result.error.code).toBe('token_exchange_failed');
    expect(result.error.status).toBe(400);
  });
});
