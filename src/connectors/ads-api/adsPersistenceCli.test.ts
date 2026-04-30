import { describe, expect, it } from 'vitest';

import { buildAdsPersistenceSuccessLines } from './adsPersistenceCli';

describe('Ads persistence CLI output', () => {
  it('prints a safe success summary', () => {
    const lines = buildAdsPersistenceSuccessLines({
      appAccountId: 'sourbear',
      appMarketplace: 'US',
      profileId: '3362351578582214',
      dateRange: {
        startDate: '2026-04-10',
        endDate: '2026-04-16',
      },
      persistedArtifact: {
        schemaVersion: 'ads-api-sp-daily-persisted/v1',
        generatedAt: '2026-04-17T00:00:00.000Z',
        appAccountId: 'sourbear',
        appMarketplace: 'US',
        adsApiBaseUrl: 'https://advertising-api.amazon.com',
        profileId: '3362351578582214',
        requestedDateRange: {
          startDate: '2026-04-10',
          endDate: '2026-04-16',
        },
        campaignRowCount: 734,
        targetRowCount: 545,
        placementRowCount: 82,
        campaignRows: [],
        targetRows: [],
        placementRows: [],
        dailySummary: [],
      },
      landingArtifactPath: '/repo/out/ads-api-persisted/raw/ads-sp-daily.landed.json',
      normalizationArtifactPath:
        '/repo/out/ads-api-persisted/normalized/ads-sp-daily.persisted.json',
    });

    expect(lines).toEqual([
      'Ads persistence succeeded.',
      'App account id: sourbear',
      'App marketplace: US',
      'Profile id: 3362351578582214',
      'Date range: 2026-04-10 -> 2026-04-16',
      'Campaign row count: 734',
      'Target row count: 545',
      'Placement row count: 82',
      'Landing artifact path: /repo/out/ads-api-persisted/raw/ads-sp-daily.landed.json',
      'Normalization artifact path: /repo/out/ads-api-persisted/normalized/ads-sp-daily.persisted.json',
    ]);
    expect(lines.join('\n')).not.toContain('access-token');
    expect(lines.join('\n')).not.toContain('refresh-token');
    expect(lines.join('\n')).not.toContain('client-secret');
  });
});
