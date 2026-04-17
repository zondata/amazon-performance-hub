import { describe, expect, it } from 'vitest';

import { buildSpTargetDailySuccessLines } from './spTargetDailyCli';

describe('Amazon Ads SP target daily CLI output', () => {
  it('prints a safe success summary', () => {
    const lines = buildSpTargetDailySuccessLines({
      validatedProfileId: '3362351578582214',
      dateRange: {
        startDate: '2026-04-10',
        endDate: '2026-04-16',
      },
      normalizedArtifact: {
        schemaVersion: 'ads-api-sp-target-daily-normalized/v1',
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
        normalizedTargetRows: [],
      },
      rawArtifactPath: '/repo/out/ads-api-sp-target-daily/raw/sp-target-daily.raw.json',
      normalizedArtifactPath:
        '/repo/out/ads-api-sp-target-daily/normalized/sp-target-daily.normalized.json',
    });

    expect(lines).toEqual([
      'Amazon Ads target daily pull succeeded.',
      'Validated profile id: 3362351578582214',
      'Date range: 2026-04-10 -> 2026-04-16',
      'Row count: 12',
      'Raw artifact path: /repo/out/ads-api-sp-target-daily/raw/sp-target-daily.raw.json',
      'Normalized artifact path: /repo/out/ads-api-sp-target-daily/normalized/sp-target-daily.normalized.json',
    ]);
    expect(lines.join('\n')).not.toContain('access-token');
    expect(lines.join('\n')).not.toContain('refresh-token');
    expect(lines.join('\n')).not.toContain('client-secret');
  });
});
