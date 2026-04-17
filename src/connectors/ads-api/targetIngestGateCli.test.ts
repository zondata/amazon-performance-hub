import { describe, expect, it } from 'vitest';

import { buildTargetIngestGateSuccessLines } from './targetIngestGateCli';

describe('target ingest gate CLI output', () => {
  it('prints a safe success summary', () => {
    const lines = buildTargetIngestGateSuccessLines({
      appAccountId: 'sourbear',
      appMarketplace: 'US',
      profileId: '3362351578582214',
      requestedDateRange: {
        startDate: '2026-04-10',
        endDate: '2026-04-16',
      },
      targetRowCount: 545,
      sinkResult: {
        ingestStatus: 'ok',
        mapStatus: 'ok',
        uploadId: 'upload-123',
        rawRowCount: 545,
        factRows: 544,
        issueRows: 1,
        coverageStart: '2026-04-10',
        coverageEnd: '2026-04-16',
        tempXlsxPath: '/repo/out/ads-api-ingest-gate/sp-target-daily.ingest.xlsx',
      },
    });

    expect(lines).toEqual([
      'Target daily ingest succeeded.',
      'App account id: sourbear',
      'App marketplace: US',
      'Profile id: 3362351578582214',
      'Date range: 2026-04-10 -> 2026-04-16',
      'Target row count: 545',
      'Sink result summary: raw_ingest=ok, mapping=ok, fact_rows=544, issue_rows=1',
      'Upload id: upload-123',
    ]);
    expect(lines.join('\n')).not.toContain('access-token');
    expect(lines.join('\n')).not.toContain('refresh-token');
    expect(lines.join('\n')).not.toContain('client-secret');
  });
});
