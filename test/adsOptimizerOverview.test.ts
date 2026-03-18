import { describe, expect, it, vi } from 'vitest';

vi.mock('../apps/web/src/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: () => {
      throw new Error('supabaseAdmin should not be called in adsOptimizerOverview.test.ts');
    },
  },
}));

vi.mock('../apps/web/src/lib/sales/getSalesDaily', () => ({
  getSalesDaily: async () => {
    throw new Error('getSalesDaily should not be called in adsOptimizerOverview.test.ts');
  },
}));

vi.mock('../apps/web/src/lib/ranking/getProductRankingDaily', () => ({
  getProductRankingDaily: async () => {
    throw new Error(
      'getProductRankingDaily should not be called in adsOptimizerOverview.test.ts'
    );
  },
}));

vi.mock('../apps/web/src/lib/sqp/getProductSqpWeekly', () => ({
  getProductSqpWeekly: async () => {
    throw new Error('getProductSqpWeekly should not be called in adsOptimizerOverview.test.ts');
  },
}));

vi.mock('../apps/web/src/lib/ads-optimizer/heroQueryOverride', () => ({
  getAdsOptimizerHeroQueryManualOverride: async () => null,
}));

import {
  buildAdsOptimizerOverviewComparisonWindow,
  buildAdsOptimizerOverviewMetricDelta,
  buildAdsOptimizerRankingLadder,
  buildHeroQueryTrend,
  classifyAdsOptimizerProductState,
  normalizeAdsOptimizerOverviewTrendEnabled,
  normalizeAdsOptimizerOverviewTrendMode,
  recommendAdsOptimizerObjective,
} from '../apps/web/src/lib/ads-optimizer/overview';

describe('ads optimizer phase 3 overview logic', () => {
  it('classifies low-volume products as structurally weak', () => {
    const result = classifyAdsOptimizerProductState({
      sales: 180,
      orders: 2,
      units: 3,
      acos: 0.21,
      breakEvenAcos: 0.32,
      contributionAfterAds: 25,
    });

    expect(result.value).toBe('structurally_weak');
  });

  it('classifies negative post-ad contribution as loss', () => {
    const result = classifyAdsOptimizerProductState({
      sales: 1200,
      orders: 24,
      units: 26,
      acos: 0.34,
      breakEvenAcos: 0.22,
      contributionAfterAds: -90,
    });

    expect(result.value).toBe('loss');
  });

  it('recommends rank growth when profitable visibility is weak but demand exists', () => {
    const result = recommendAdsOptimizerObjective({
      state: 'profitable',
      acos: 0.18,
      breakEvenAcos: 0.36,
      totalSqpSearchVolume: 6200,
      heroQueryTrend: {
        status: 'ready',
        keyword: 'blue widgets',
        searchVolume: 4200,
        latestOrganicRank: 27,
        baselineOrganicRank: 25,
        rankDelta: -2,
        detail: 'Hero query is weak but demand exists.',
      },
    });

    expect(result.value).toBe('Rank Growth');
  });

  it('recommends rank defense when profitable rank is slipping near the top results', () => {
    const result = recommendAdsOptimizerObjective({
      state: 'profitable',
      acos: 0.2,
      breakEvenAcos: 0.34,
      totalSqpSearchVolume: 1800,
      heroQueryTrend: {
        status: 'ready',
        keyword: 'red widgets',
        searchVolume: 1600,
        latestOrganicRank: 12,
        baselineOrganicRank: 5,
        rankDelta: -7,
        detail: 'Hero query rank is slipping.',
      },
    });

    expect(result.value).toBe('Rank Defense');
  });

  it('keeps the same profitable rank-slip case in scale-profit mode under design-led posture', () => {
    const visibilityLed = recommendAdsOptimizerObjective({
      state: 'profitable',
      acos: 0.2,
      breakEvenAcos: 0.34,
      totalSqpSearchVolume: 1800,
      archetype: 'visibility_led',
      heroQueryTrend: {
        status: 'ready',
        keyword: 'red widgets',
        searchVolume: 1600,
        latestOrganicRank: 12,
        baselineOrganicRank: 5,
        rankDelta: -7,
        detail: 'Hero query rank is slipping.',
      },
    });
    const designLed = recommendAdsOptimizerObjective({
      state: 'profitable',
      acos: 0.2,
      breakEvenAcos: 0.34,
      totalSqpSearchVolume: 1800,
      archetype: 'design_led',
      heroQueryTrend: {
        status: 'ready',
        keyword: 'red widgets',
        searchVolume: 1600,
        latestOrganicRank: 12,
        baselineOrganicRank: 5,
        rankDelta: -7,
        detail: 'Hero query rank is slipping.',
      },
    });

    expect(visibilityLed.value).toBe('Rank Defense');
    expect(designLed.value).toBe('Scale Profit');
  });

  it('builds ranking trend from first and latest observed ranks without averaging the window', () => {
    const trend = buildHeroQueryTrend([
      {
        observed_date: '2026-03-01',
        keyword_norm: 'blue widgets',
        keyword_raw: 'blue widgets',
        search_volume: 4200,
        organic_rank_value: 21,
      },
      {
        observed_date: '2026-03-02',
        keyword_norm: 'blue widgets',
        keyword_raw: 'blue widgets',
        search_volume: 4200,
        organic_rank_value: 12,
      },
      {
        observed_date: '2026-03-10',
        keyword_norm: 'blue widgets',
        keyword_raw: 'blue widgets',
        search_volume: 4200,
        organic_rank_value: 7,
      },
    ] as any);

    expect(trend.baselineOrganicRank).toBe(21);
    expect(trend.latestOrganicRank).toBe(7);
    expect(trend.rankDelta).toBe(14);
    expect(trend.detail).toContain('from rank 21 to 7');
  });

  it('uses a saved manual hero query instead of the auto-picked query when it is present', () => {
    const trend = buildHeroQueryTrend(
      [
        {
          observed_date: '2026-03-01',
          keyword_norm: 'blue widgets',
          keyword_raw: 'blue widgets',
          search_volume: 4200,
          organic_rank_value: 8,
        },
        {
          observed_date: '2026-03-01',
          keyword_norm: 'red widgets',
          keyword_raw: 'red widgets',
          search_volume: 1200,
          organic_rank_value: 18,
        },
        {
          observed_date: '2026-03-10',
          keyword_norm: 'red widgets',
          keyword_raw: 'red widgets',
          search_volume: 1200,
          organic_rank_value: 11,
        },
      ] as any,
      'red widgets'
    );

    expect(trend.keyword).toBe('red widgets');
    expect(trend.baselineOrganicRank).toBe(18);
    expect(trend.latestOrganicRank).toBe(11);
  });

  it('keeps the saved manual hero query explicit when it is not in current ranking candidates', () => {
    const trend = buildHeroQueryTrend(
      [
        {
          observed_date: '2026-03-10',
          keyword_norm: 'blue widgets',
          keyword_raw: 'blue widgets',
          search_volume: 4200,
          organic_rank_value: 7,
        },
      ] as any,
      'red widgets'
    );

    expect(trend.keyword).toBe('red widgets');
    expect(trend.latestOrganicRank).toBeNull();
    expect(trend.detail).toContain('not present in the current ranking candidates');
  });

  it('builds an equal-length previous comparison window', () => {
    const result = buildAdsOptimizerOverviewComparisonWindow({
      start: '2026-03-10',
      end: '2026-03-16',
    });

    expect(result.current.days).toBe(7);
    expect(result.previous.start).toBe('2026-03-03');
    expect(result.previous.end).toBe('2026-03-09');
    expect(result.previous.days).toBe(7);
  });

  it('classifies ranking ladder bands from latest observed raw ranks only', () => {
    const ladder = buildAdsOptimizerRankingLadder({
      currentRows: [
        {
          observed_date: '2026-03-10',
          keyword_norm: 'a',
          keyword_raw: 'a',
          organic_rank_value: 2,
        },
        {
          observed_date: '2026-03-10',
          keyword_norm: 'b',
          keyword_raw: 'b',
          organic_rank_value: 5,
        },
        {
          observed_date: '2026-03-10',
          keyword_norm: 'c',
          keyword_raw: 'c',
          organic_rank_value: 10,
        },
        {
          observed_date: '2026-03-10',
          keyword_norm: 'd',
          keyword_raw: 'd',
          organic_rank_value: 20,
        },
        {
          observed_date: '2026-03-10',
          keyword_norm: 'e',
          keyword_raw: 'e',
          organic_rank_value: 45,
        },
        {
          observed_date: '2026-03-10',
          keyword_norm: 'f',
          keyword_raw: 'f',
          organic_rank_value: 90,
        },
        {
          observed_date: '2026-03-10',
          keyword_norm: 'g',
          keyword_raw: 'g',
          organic_rank_value: 135,
        },
        {
          observed_date: '2026-03-10',
          keyword_norm: 'h',
          keyword_raw: 'h',
          organic_rank_value: 306,
        },
        {
          observed_date: '2026-03-10',
          keyword_norm: 'i',
          keyword_raw: 'i',
          organic_rank_value: 420,
        },
      ] as any,
      previousRows: [
        {
          observed_date: '2026-03-02',
          keyword_norm: 'a',
          keyword_raw: 'a',
          organic_rank_value: 1,
        },
        {
          observed_date: '2026-03-02',
          keyword_norm: 'b',
          keyword_raw: 'b',
          organic_rank_value: 7,
        },
        {
          observed_date: '2026-03-02',
          keyword_norm: 'c',
          keyword_raw: 'c',
          organic_rank_value: 50,
        },
        {
          observed_date: '2026-03-02',
          keyword_norm: 'd',
          keyword_raw: 'd',
          organic_rank_value: 320,
        },
      ] as any,
    });

    expect(ladder.bands).toEqual([
      { label: '1-2', currentCount: 1, deltaCount: 0 },
      { label: '3-5', currentCount: 1, deltaCount: 1 },
      { label: '6-10', currentCount: 1, deltaCount: 0 },
      { label: '11-20', currentCount: 1, deltaCount: 1 },
      { label: '21-45', currentCount: 1, deltaCount: 1 },
      { label: 'Page 2', currentCount: 1, deltaCount: 0 },
      { label: 'Page 3', currentCount: 1, deltaCount: 1 },
      { label: 'Page 4', currentCount: 0, deltaCount: 0 },
      { label: 'Page 5', currentCount: 0, deltaCount: 0 },
      { label: 'Page 6', currentCount: 0, deltaCount: 0 },
      { label: 'Page 7', currentCount: 1, deltaCount: 1 },
      { label: 'Beyond tracked range', currentCount: 1, deltaCount: 0 },
    ]);
    expect(ladder.detail).toContain('signed bucket counts');
    expect(ladder.detail).toContain('without averaging rank');
  });

  it('keeps ladder deltas explicit when the previous period lacks comparable ranking coverage', () => {
    const ladder = buildAdsOptimizerRankingLadder({
      currentRows: [
        {
          observed_date: '2026-03-10',
          keyword_norm: 'only-current',
          keyword_raw: 'only-current',
          organic_rank_value: 60,
        },
      ] as any,
      previousRows: [],
    });

    expect(ladder.status).toBe('partial');
    expect(ladder.bands.find((band) => band.label === 'Page 2')).toEqual({
      label: 'Page 2',
      currentCount: 1,
      deltaCount: null,
    });
    expect(ladder.detail).toContain('deltas are unavailable');
  });

  it('builds metric-aware delta semantics without forcing contextual metrics into good/bad labels', () => {
    const contextual = buildAdsOptimizerOverviewMetricDelta({
      current: 150,
      previous: 100,
      semantics: 'contextual',
      label: 'Ad spend',
    });
    const inverse = buildAdsOptimizerOverviewMetricDelta({
      current: 0.12,
      previous: 0.2,
      semantics: 'lower_is_better',
      label: 'TACOS',
    });

    expect(contextual.direction).toBe('up');
    expect(contextual.evaluation).toBe('unknown');
    expect(inverse.direction).toBe('down');
    expect(inverse.evaluation).toBe('better');
  });

  it('normalizes overview trend mode to approved page-level options', () => {
    expect(normalizeAdsOptimizerOverviewTrendMode('7')).toBe('7');
    expect(normalizeAdsOptimizerOverviewTrendMode('60')).toBe('60');
    expect(normalizeAdsOptimizerOverviewTrendMode('90')).toBe('30');
    expect(normalizeAdsOptimizerOverviewTrendMode(undefined)).toBe('30');
  });

  it('normalizes overview trend display to a simple on/off control', () => {
    expect(normalizeAdsOptimizerOverviewTrendEnabled(undefined)).toBe(true);
    expect(normalizeAdsOptimizerOverviewTrendEnabled('on')).toBe(true);
    expect(normalizeAdsOptimizerOverviewTrendEnabled('14')).toBe(true);
    expect(normalizeAdsOptimizerOverviewTrendEnabled('off')).toBe(false);
    expect(normalizeAdsOptimizerOverviewTrendEnabled('0')).toBe(false);
  });
});
