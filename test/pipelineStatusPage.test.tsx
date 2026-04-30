import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../apps/web/src/lib/pipeline-status/getPipelineStatus', () => ({
  getPipelineStatus: vi.fn(),
}));

import PipelineStatusPage from '../apps/web/src/app/pipeline-status/page';
import { getPipelineStatus } from '../apps/web/src/lib/pipeline-status/getPipelineStatus';

describe('PipelineStatusPage', () => {
  beforeEach(() => {
    vi.mocked(getPipelineStatus).mockResolvedValue({
      rows: [
        {
          sourceGroup: 'SP campaign daily',
          sourceType: 'ads_api_sp_campaign_daily',
          targetTable: 'sp_campaign_hourly_fact_gold',
          implementationStatus: 'implemented',
          implementationLabel: 'Implemented',
          earliestReportDay: '2026-04-01',
          latestReportDay: '2026-04-30',
          dataCompleteness: 'Complete',
          amazonApiState: 'imported',
          manualRunLabel: 'Run',
          manualRunEnabled: true,
          manualRunTitle: 'Manual source run is not wired yet.',
          sourceGroupStatus: 'success',
          latestPeriodEnd: '2026-04-30T23:59:59.000Z',
          lastSuccessfulImportTime: '2026-05-01T08:00:00.000Z',
          currentCoverageStatus: 'updated',
          activePendingCount: 0,
          oldestPendingAge: '—',
          failedOrStaleCount: 0,
          retryAfterAt: null,
          nextAction: 'No action required.',
          friendlySummary: 'Ready.',
          technicalDetails: null,
        },
        {
          sourceGroup: 'SB campaign daily',
          sourceType: 'ads_api_sb_campaign_daily',
          targetTable: 'sb_campaign_daily_fact_gold',
          implementationStatus: 'not_implemented',
          implementationLabel: 'Not implemented',
          earliestReportDay: '—',
          latestReportDay: '—',
          dataCompleteness: 'Blocked',
          amazonApiState: '—',
          manualRunLabel: 'Disabled',
          manualRunEnabled: false,
          manualRunTitle: 'Manual source run is not wired yet.',
          sourceGroupStatus: 'not_implemented',
          latestPeriodEnd: null,
          lastSuccessfulImportTime: null,
          currentCoverageStatus: 'not implemented',
          activePendingCount: 0,
          oldestPendingAge: '—',
          failedOrStaleCount: 0,
          retryAfterAt: null,
          nextAction: 'Wait.',
          friendlySummary: 'Blocked.',
          technicalDetails: null,
        },
      ],
      batchSummary: null,
    });
  });

  it('renders the simplified column set and manual run states', async () => {
    const element = await PipelineStatusPage();
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Source group');
    expect(html).toContain('Implementation');
    expect(html).toContain('Earliest report day');
    expect(html).toContain('Latest report day');
    expect(html).toContain('Data completeness');
    expect(html).toContain('Amazon/API state');
    expect(html).toContain('Manual run');
    expect(html).toContain('>Run<');
    expect(html).toContain('>Disabled<');
    expect(html).toContain('title="Manual source run is not wired yet."');
    expect(html).not.toContain('Source type');
    expect(html).not.toContain('Target table');
    expect(html).not.toContain('Next action');
  });
});
