import { describe, expect, it } from 'vitest';

import { enrichSqpRow } from '../apps/web/src/lib/sqp/enrichSqpRow';

describe('enrichSqpRow', () => {
  it('computes CTR/CVR and index metrics', () => {
    const row = enrichSqpRow({
      impressions_total: 100,
      impressions_self: 50,
      clicks_total: 10,
      clicks_self: 10,
      purchases_total: 5,
      purchases_self: 5,
      cart_adds_total: 4,
      cart_adds_self: 2,
    });

    expect(row.market_ctr).toBeCloseTo(0.1, 5);
    expect(row.self_ctr).toBeCloseTo(0.2, 5);
    expect(row.market_cvr).toBeCloseTo(0.5, 5);
    expect(row.self_cvr).toBeCloseTo(0.5, 5);
    expect(row.self_ctr_index).toBeCloseTo(2.0, 5);
    expect(row.self_cvr_index).toBeCloseTo(1.0, 5);
    expect(row.cart_add_rate_from_clicks_market).toBeCloseTo(0.4, 5);
    expect(row.cart_add_rate_from_clicks_self).toBeCloseTo(0.2, 5);
  });

  it('guards division by zero and nulls', () => {
    const row = enrichSqpRow({
      impressions_total: 0,
      impressions_self: null,
      clicks_total: 0,
      clicks_self: null,
      purchases_total: null,
      purchases_self: null,
      cart_adds_total: null,
      cart_adds_self: null,
    });

    expect(row.market_ctr).toBeNull();
    expect(row.self_ctr).toBeNull();
    expect(row.market_cvr).toBeNull();
    expect(row.self_cvr).toBeNull();
    expect(row.self_ctr_index).toBeNull();
    expect(row.self_cvr_index).toBeNull();
    expect(row.cart_add_rate_from_clicks_market).toBeNull();
    expect(row.cart_add_rate_from_clicks_self).toBeNull();
  });
});
