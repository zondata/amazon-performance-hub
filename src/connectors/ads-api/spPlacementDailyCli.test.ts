import { describe, expect, it } from 'vitest';

import { buildSpPlacementDailySuccessLines } from './spPlacementDailyCli';

describe('Amazon Ads SP placement daily CLI output', () => {
  it('prints a safe success summary', () => {
    const lines = buildSpPlacementDailySuccessLines({
      validatedProfileId: '3362351578582214',
      dateRange: {
        startDate: '2026-04-10',
        endDate: '2026-04-16',
      },
      normalizedArtifact: {
        schemaVersion: 'ads-api-sp-placement-daily-normalized/v1',
        generatedAt: '2026-04-17T00:00:00.000Z',
        appAccountId: 'sourbear',
        appMarketplace: 'US',
        adsApiBaseUrl: 'https://advertising-api.amazon.com',
        profileId: '3362351578582214',
        requestedDateRange: {
          startDate: '2026-04-10',
          endDate: '2026-04-16',
        },
        rowCount: 12,
        normalizedPlacementRows: [],
      },
      rawArtifactPath: '/repo/out/ads-api-sp-placement-daily/raw/sp-placement-daily.raw.json',
      normalizedArtifactPath:
        '/repo/out/ads-api-sp-placement-daily/normalized/sp-placement-daily.normalized.json',
    });

    expect(lines).toEqual([
      'Amazon Ads placement daily pull succeeded.',
      'Validated profile id: 3362351578582214',
      'Date range: 2026-04-10 -> 2026-04-16',
      'Row count: 12',
      'Raw artifact path: /repo/out/ads-api-sp-placement-daily/raw/sp-placement-daily.raw.json',
      'Normalized artifact path: /repo/out/ads-api-sp-placement-daily/normalized/sp-placement-daily.normalized.json',
    ]);
  });
});
