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

import {
  buildHeroQueryTrend,
  classifyAdsOptimizerProductState,
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
});
