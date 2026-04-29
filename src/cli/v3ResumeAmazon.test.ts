import { describe, expect, it, vi } from 'vitest';

import { reconcileCompletedPendingRequests } from './v3ResumeAmazon';

describe('reconcileCompletedPendingRequests', () => {
  it('marks completed requests as imported when downstream coverage already exists', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            source_type: 'ads_api_sp_campaign_daily',
            report_id: 'campaign-report',
            status: 'completed',
            start_date: '2026-04-01',
            end_date: '2026-04-29',
            created_at: '2026-04-29T10:00:00.000Z',
            updated_at: '2026-04-29T10:05:00.000Z',
            completed_at: '2026-04-29T10:05:00.000Z',
            retry_after_at: null,
            last_polled_at: '2026-04-29T10:05:00.000Z',
            attempt_count: 1,
            notes: 'Amazon Ads SP campaign report reached a terminal success status.',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ has_rows: true }],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    const pool = { query } as unknown as Parameters<
      typeof reconcileCompletedPendingRequests
    >[0];

    const reconciled = await reconcileCompletedPendingRequests(pool, {
      accountId: 'sourbear',
      marketplace: 'US',
    });

    expect(reconciled).toEqual(['campaign-report']);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2]?.[0]).toContain("status = 'imported'");
  });
});
