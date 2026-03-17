import { describe, expect, it } from 'vitest';

import {
  ADS_OPTIMIZER_VIEWS,
  buildAdsOptimizerHref,
  normalizeAdsOptimizerShell,
  normalizeAdsOptimizerView,
} from '../apps/web/src/lib/ads-optimizer/shell';

describe('ads optimizer shell', () => {
  it('keeps only overview and targets as primary tabs', () => {
    expect(ADS_OPTIMIZER_VIEWS).toEqual([
      { label: 'Overview', value: 'overview' },
      { label: 'Targets', value: 'targets' },
    ]);
  });

  it('normalizes legacy utility views into the new shell contract', () => {
    expect(normalizeAdsOptimizerView('history')).toBe('targets');
    expect(normalizeAdsOptimizerView('config')).toBe('overview');
    expect(normalizeAdsOptimizerView('outcomes')).toBe('overview');
    expect(normalizeAdsOptimizerShell({ view: 'history' })).toEqual({
      view: 'targets',
      utility: 'history',
    });
    expect(normalizeAdsOptimizerShell({ view: 'config' })).toEqual({
      view: 'overview',
      utility: 'config',
    });
  });

  it('enforces utility parent views and emits utility query params in hrefs', () => {
    expect(normalizeAdsOptimizerShell({ view: 'targets', utility: 'config' })).toEqual({
      view: 'overview',
      utility: 'config',
    });

    expect(
      buildAdsOptimizerHref({
        start: '2026-03-01',
        end: '2026-03-31',
        asin: 'B012345678',
        view: 'history',
        runId: 'run-123',
      })
    ).toBe(
      '/ads/optimizer?start=2026-03-01&end=2026-03-31&asin=B012345678&view=targets&utility=history&runId=run-123'
    );

    expect(
      buildAdsOptimizerHref({
        start: '2026-03-01',
        end: '2026-03-31',
        asin: 'B012345678',
        view: 'overview',
        utility: 'outcomes',
        horizon: '14',
        metric: 'acos',
      })
    ).toBe(
      '/ads/optimizer?start=2026-03-01&end=2026-03-31&asin=B012345678&view=overview&utility=outcomes&horizon=14&metric=acos'
    );
  });
});
