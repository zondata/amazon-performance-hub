import { describe, expect, it } from 'vitest';

import {
  buildPipelineStatusRows,
  type PipelineStatusSpec,
} from '../apps/web/src/lib/pipeline-status/model';

describe('buildPipelineStatusRows', () => {
  it('marks unsupported sources as not implemented instead of failed', () => {
    const specs: PipelineStatusSpec[] = [
      {
        sourceGroup: 'SP placement daily',
        sourceType: 'ads_api_sp_placement_daily',
        targetTable: 'sp_placement_daily_fact',
        implementationStatus: 'not_implemented',
      },
    ];

    const rows = buildPipelineStatusRows({
      specs,
      coverageRows: [],
      pendingRows: [],
      nowIso: '2026-04-29T12:00:00.000Z',
    });

    expect(rows[0].implementationStatus).toBe('not_implemented');
    expect(rows[0].currentCoverageStatus).toBe('not_implemented');
    expect(rows[0].nextAction).toContain('Not implemented yet');
  });

  it('surfaces active pending counts and retry_after_at for implemented sources', () => {
    const specs: PipelineStatusSpec[] = [
      {
        sourceGroup: 'SP target daily',
        sourceType: 'ads_api_sp_target_daily',
        targetTable: 'sp_targeting_daily_fact',
        implementationStatus: 'implemented',
        pendingSourceType: 'ads_api_sp_target_daily',
      },
    ];

    const rows = buildPipelineStatusRows({
      specs,
      coverageRows: [
        {
          tableName: 'sp_targeting_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:00:00.000Z',
          notes: null,
        },
      ],
      pendingRows: [
        {
          sourceType: 'ads_api_sp_target_daily',
          status: 'pending',
          createdAt: '2026-04-29T09:00:00.000Z',
          retryAfterAt: '2026-04-29T12:15:00.000Z',
        },
      ],
      nowIso: '2026-04-29T12:00:00.000Z',
    });

    expect(rows[0].activePendingCount).toBe(1);
    expect(rows[0].retryAfterAt).toBe('2026-04-29T12:15:00.000Z');
    expect(rows[0].nextAction).toContain('Waiting for retry_after_at');
  });
});
