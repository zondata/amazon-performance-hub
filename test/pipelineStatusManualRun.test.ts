import { describe, expect, it } from 'vitest';

import {
  classifyManualRunFailure,
  deriveRecentManualRunWindow,
  summarizeManualRunOutput,
  supportsPipelineManualRun,
} from '../apps/web/src/lib/pipeline-status/manualRun';

describe('pipeline status manual run helpers', () => {
  it('detects which source types support manual runs', () => {
    expect(supportsPipelineManualRun('ads_api_sp_campaign_daily')).toBe(true);
    expect(supportsPipelineManualRun('sp_api_sales_traffic_daily')).toBe(true);
    expect(supportsPipelineManualRun('ads_api_sb_campaign_daily')).toBe(false);
  });

  it('builds a recent 30 day window ending on the provided day', () => {
    expect(deriveRecentManualRunWindow(new Date('2026-04-30T12:00:00.000Z'))).toEqual({
      from: '2026-04-01',
      to: '2026-04-30',
    });
  });

  it('treats pending timeout output as pending instead of hard failure', () => {
    expect(
      classifyManualRunFailure('', 'Amazon Ads search term daily error code: pending_timeout')
    ).toBe('pending');
  });

  it('prefers a meaningful summary line from command output', () => {
    expect(
      summarizeManualRunOutput(
        'Downloaded report successfully\nNormalized artifact saved',
        ''
      )
    ).toBe('Downloaded report successfully');
  });
});
