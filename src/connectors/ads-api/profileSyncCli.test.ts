import { describe, expect, it } from 'vitest';

import { buildProfileSyncSuccessLines } from './profileSyncCli';

describe('Amazon Ads profile sync CLI output', () => {
  it('prints a safe success summary', () => {
    const lines = buildProfileSyncSuccessLines({
      artifact: {
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
        profilesSummary: [],
      },
      artifactPath: '/repo/out/ads-api-profile-sync/ads-profiles.sync.json',
    });

    expect(lines).toEqual([
      'Amazon Ads profile sync succeeded.',
      'Configured profile id: 222222222222222',
      'Selected profile id: 222222222222222',
      'Profile count: 2',
      'Selected country code: US',
      'Selected account name: Bear Co',
      'Artifact path: /repo/out/ads-api-profile-sync/ads-profiles.sync.json',
    ]);
    expect(lines.join('\n')).not.toContain('access-token');
    expect(lines.join('\n')).not.toContain('refresh-token');
    expect(lines.join('\n')).not.toContain('client-secret');
  });
});
