import { describe, expect, it } from 'vitest';

import { buildRefreshAccessTokenSuccessLines } from './refreshAccessTokenCli';

describe('Amazon Ads refresh CLI output', () => {
  it('prints a redacted success summary', () => {
    const lines = buildRefreshAccessTokenSuccessLines({
      result: {
        ok: true,
        accessToken: 'at-secret-123',
        refreshToken: 'rt-secret-456',
        expiresIn: 3600,
        tokenType: 'bearer',
        scope: null,
        raw: {
          access_token: 'at-secret-123',
          refresh_token: 'rt-secret-456',
          token_type: 'bearer',
          expires_in: 3600,
        },
      },
      apiBaseUrl: 'https://advertising-api.amazon.com',
    });

    expect(lines).toEqual([
      'Amazon Ads refresh-token exchange succeeded.',
      'Token type: bearer',
      'Expires in: 3600',
      'Refresh token returned in payload: yes (redacted)',
      'Configured Ads API base URL: https://advertising-api.amazon.com',
    ]);
    expect(lines.join('\n')).not.toContain('at-secret-123');
    expect(lines.join('\n')).not.toContain('rt-secret-456');
  });
});
