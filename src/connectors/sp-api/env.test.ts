import { describe, expect, it } from 'vitest';

import { loadSpApiEnv } from './env';
import { SpApiConfigError } from './types';

const makeEnv = () => ({
  SP_API_LWA_CLIENT_ID: 'client-id',
  SP_API_LWA_CLIENT_SECRET: 'client-secret',
  SP_API_REFRESH_TOKEN: 'refresh-token',
  SP_API_REGION: 'na',
  SP_API_MARKETPLACE_ID: 'ATVPDKIKX0DER',
});

describe('sp-api env loader', () => {
  it('succeeds with a complete valid config', () => {
    expect(loadSpApiEnv(makeEnv())).toEqual({
      region: 'na',
      marketplaceId: 'ATVPDKIKX0DER',
      credentials: {
        lwaClientId: 'client-id',
        lwaClientSecret: 'client-secret',
        refreshToken: 'refresh-token',
      },
    });
  });

  it('fails with missing required fields', () => {
    expect(() =>
      loadSpApiEnv({
        ...makeEnv(),
        SP_API_LWA_CLIENT_SECRET: '   ',
        SP_API_MARKETPLACE_ID: undefined,
      })
    ).toThrowError(SpApiConfigError);
  });

  it('fails with invalid region', () => {
    expect(() =>
      loadSpApiEnv({
        ...makeEnv(),
        SP_API_REGION: 'apac',
      })
    ).toThrowError(/SP_API_REGION must be one of: na, eu, fe/);
  });
});
