import { describe, expect, it } from 'vitest';

import { aggregateCampaignRows } from '../apps/web/src/lib/ads/aggregateCampaigns';

describe('aggregateCampaignRows', () => {
  it('aggregates metrics and computes derived ratios', () => {
    const rows = [
      {
        campaign_id: 'c1',
        campaign_name_raw: 'Alpha',
        impressions: 100,
        clicks: 10,
        spend: 20,
        sales: 80,
        orders: 4,
        units: 5,
      },
      {
        campaign_id: 'c1',
        campaign_name_raw: 'Alpha',
        impressions: 50,
        clicks: 5,
        spend: 10,
        sales: 40,
        orders: 2,
        units: 3,
      },
      {
        campaign_id: 'c2',
        campaign_name_raw: 'Beta',
        impressions: 0,
        clicks: 0,
        spend: 0,
        sales: 0,
        orders: 0,
        units: 0,
      },
    ];

    const result = aggregateCampaignRows(rows);
    expect(result.rows.length).toBe(2);

    const c1 = result.rows.find((row) => row.campaign_id === 'c1');
    expect(c1?.impressions).toBe(150);
    expect(c1?.clicks).toBe(15);
    expect(c1?.spend).toBe(30);
    expect(c1?.sales).toBe(120);
    expect(c1?.orders).toBe(6);
    expect(c1?.units).toBe(8);
    expect(c1?.ctr).toBeCloseTo(0.1);
    expect(c1?.cpc).toBeCloseTo(2);
    expect(c1?.acos).toBeCloseTo(0.25);
    expect(c1?.roas).toBeCloseTo(4);

    const c2 = result.rows.find((row) => row.campaign_id === 'c2');
    expect(c2?.ctr).toBeNull();
    expect(c2?.cpc).toBeNull();
    expect(c2?.acos).toBeNull();
    expect(c2?.roas).toBeNull();

    expect(result.totals.impressions).toBe(150);
    expect(result.totals.clicks).toBe(15);
    expect(result.totals.spend).toBe(30);
    expect(result.totals.sales).toBe(120);
    expect(result.totals.ctr).toBeCloseTo(0.1);
  });
});
