import { describe, expect, it } from 'vitest';

import {
  buildAdsOptimizerCoverageSummary,
  normalizeAdsOptimizerCoverageStatus,
  rollupAdsOptimizerCoverageStatus,
} from '../apps/web/src/lib/ads-optimizer/coverage';

describe('ads optimizer phase 12B coverage semantics', () => {
  it('maps expected-unavailable coverage into the compact missing bucket without treating it as suspicious', () => {
    const summary = buildAdsOptimizerCoverageSummary([
      { label: 'TOS', status: 'ready' },
      { label: 'STIS', status: 'expected_unavailable' },
      { label: 'STIR', status: 'expected_unavailable' },
      { label: 'Terms', status: 'expected_unavailable' },
      { label: 'Place', status: 'partial' },
      { label: 'BE', status: 'true_missing' },
    ]);

    expect(summary.ready).toBe(1);
    expect(summary.partial).toBe(1);
    expect(summary.missing).toBe(4);
    expect(summary.missingExpected).toBe(3);
    expect(summary.missingSuspicious).toBe(1);
    expect(summary.buckets.expectedUnavailable).toEqual(['STIS', 'STIR', 'Terms']);
    expect(summary.buckets.trueMissing).toEqual(['BE']);
  });

  it('keeps expected-unavailable out of the critical missing rollup while legacy missing maps to true_missing', () => {
    expect(normalizeAdsOptimizerCoverageStatus('missing')).toBe('true_missing');
    expect(
      rollupAdsOptimizerCoverageStatus(['ready', 'expected_unavailable', 'partial'])
    ).toBe('partial');
    expect(rollupAdsOptimizerCoverageStatus(['ready', 'missing'])).toBe('missing');
  });
});
