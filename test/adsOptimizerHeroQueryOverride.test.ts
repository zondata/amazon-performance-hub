import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  saveManualStrategicOverride,
  from,
  maybeSingle,
  updateEq,
} = vi.hoisted(() => {
  const saveManualStrategicOverride = vi.fn();
  const updateEq = vi.fn();
  const maybeSingle = vi.fn();

  const buildQuery = () => ({
    select: vi.fn(() => buildQuery()),
    eq: vi.fn(() => buildQuery()),
    order: vi.fn(() => buildQuery()),
    limit: vi.fn(() => buildQuery()),
    maybeSingle,
    update: vi.fn(() => ({
      eq: updateEq,
    })),
  });

  const from = vi.fn(() => buildQuery());

  return {
    saveManualStrategicOverride,
    from,
    maybeSingle,
    updateEq,
  };
});

vi.mock('../apps/web/src/lib/env', () => ({
  env: {
    accountId: 'account-1',
    marketplace: 'US',
  },
}));

vi.mock('../apps/web/src/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from,
  },
}));

vi.mock('../apps/web/src/lib/ads-optimizer/repoConfig', () => ({
  saveManualStrategicOverride,
}));

import {
  ADS_OPTIMIZER_HERO_QUERY_OVERRIDE_KEY,
  getAdsOptimizerHeroQueryManualOverride,
  parseAdsOptimizerHeroQueryOverrideQuery,
  resetAdsOptimizerHeroQueryManualOverride,
  saveAdsOptimizerHeroQueryManualOverride,
} from '../apps/web/src/lib/ads-optimizer/heroQueryOverride';

describe('ads optimizer hero query override helpers', () => {
  beforeEach(() => {
    saveManualStrategicOverride.mockReset();
    from.mockClear();
    maybeSingle.mockReset();
    updateEq.mockReset();
  });

  it('parses stored hero query override payloads', () => {
    expect(parseAdsOptimizerHeroQueryOverrideQuery({ query: 'blue widgets' })).toBe(
      'blue widgets'
    );
    expect(parseAdsOptimizerHeroQueryOverrideQuery({ query: '   ' })).toBeNull();
    expect(parseAdsOptimizerHeroQueryOverrideQuery({ other: 'value' })).toBeNull();
  });

  it('saves the hero query through manual overrides with the dedicated override key', async () => {
    saveManualStrategicOverride.mockResolvedValueOnce({ manual_override_id: 'override-1' });

    await saveAdsOptimizerHeroQueryManualOverride({
      productId: 'product-1',
      query: 'blue widgets',
    });

    expect(saveManualStrategicOverride).toHaveBeenCalledWith({
      product_id: 'product-1',
      override_key: ADS_OPTIMIZER_HERO_QUERY_OVERRIDE_KEY,
      override_value_json: {
        query: 'blue widgets',
      },
      notes: 'Overview hero query default',
    });
  });

  it('loads the active saved manual hero query', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        manual_override_id: 'override-1',
        override_value_json: {
          query: 'blue widgets',
        },
        created_at: '2026-03-18T10:00:00Z',
      },
      error: null,
    });

    const result = await getAdsOptimizerHeroQueryManualOverride('product-1');

    expect(from).toHaveBeenCalledWith('ads_optimizer_manual_overrides');
    expect(result).toEqual({
      manualOverrideId: 'override-1',
      query: 'blue widgets',
      createdAt: '2026-03-18T10:00:00Z',
    });
  });

  it('archives active hero query overrides on reset-to-auto', async () => {
    updateEq.mockReturnValue({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      })),
    });

    await resetAdsOptimizerHeroQueryManualOverride('product-1');

    expect(from).toHaveBeenCalledWith('ads_optimizer_manual_overrides');
  });
});
