import { describe, expect, it } from 'vitest';

import { buildCampaignIngestGateSuccessLines } from './campaignIngestGateCli';

describe('campaign ingest gate CLI output', () => {
  it('prints a safe success summary', () => {
    const lines = buildCampaignIngestGateSuccessLines({
      appAccountId: 'sourbear',
      appMarketplace: 'US',
      profileId: '3362351578582214',
      requestedDateRange: {
        startDate: '2026-04-10',
        endDate: '2026-04-16',
      },
      campaignRowCount: 733,
      sinkResult: {
        ingestStatus: 'ok',
        mapStatus: 'ok',
        uploadId: 'upload-123',
        rawRowCount: 733,
        factRows: 733,
        issueRows: 0,
        coverageStart: '2026-04-10',
        coverageEnd: '2026-04-16',
        tempCsvPath: '/repo/out/ads-api-ingest-gate/sp-campaign-daily.ingest.csv',
      },
    });

    expect(lines).toEqual([
      'Campaign daily ingest succeeded.',
      'App account id: sourbear',
      'App marketplace: US',
      'Profile id: 3362351578582214',
      'Date range: 2026-04-10 -> 2026-04-16',
      'Campaign row count: 733',
      'Sink result summary: raw_ingest=ok, mapping=ok, fact_rows=733, issue_rows=0',
      'Upload id: upload-123',
    ]);
    expect(lines.join('\n')).not.toContain('access-token');
    expect(lines.join('\n')).not.toContain('refresh-token');
    expect(lines.join('\n')).not.toContain('client-secret');
  });
});
