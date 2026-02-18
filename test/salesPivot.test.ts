import { describe, expect, it } from 'vitest';

import { bucketAggregate } from '../apps/web/src/lib/sales/pivot/bucketAggregate';
import { buildPivotRows } from '../apps/web/src/lib/sales/pivot/pivotRows';
import type { CalendarBucket } from '../apps/web/src/lib/sales/buckets/getCalendarBuckets';
import type { SalesMetricKey } from '../apps/web/src/lib/sales/salesMetrics';

const metrics = [
  {
    key: 'sales',
    label: 'Sales',
    group: 'Revenue',
    format: 'currency',
    axisGroup: 'currency',
    kind: 'sum',
  },
  {
    key: 'ppc_cost',
    label: 'PPC Cost',
    group: 'Advertising',
    format: 'currency',
    axisGroup: 'currency',
    kind: 'sum',
  },
  {
    key: 'tacos',
    label: 'TACOS',
    group: 'Advertising',
    format: 'percent',
    axisGroup: 'percent',
    kind: 'ratio',
    numeratorKey: 'ppc_cost',
    denominatorKey: 'sales',
  },
] as const;

const buckets: CalendarBucket[] = [
  { key: 'b1', label: 'B1', start: '2026-02-01', end: '2026-02-07' },
  { key: 'b2', label: 'B2', start: '2026-02-08', end: '2026-02-14' },
];

describe('bucketAggregate', () => {
  it('sums metrics across buckets and computes ratios from sums', () => {
    const rows = [
      { date: '2026-02-01', sales: 100, ppc_cost: 10 },
      { date: '2026-02-02', sales: 50, ppc_cost: 5 },
      { date: '2026-02-08', sales: 200, ppc_cost: 20 },
    ];

    const result = bucketAggregate(rows, buckets, metrics as any);

    expect(result.bucketTotals.sales).toEqual([150, 200]);
    expect(result.bucketTotals.ppc_cost).toEqual([15, 20]);
    expect(result.bucketTotals.tacos?.[0]).toBeCloseTo(15 / 150, 6);
    expect(result.bucketTotals.tacos?.[1]).toBeCloseTo(20 / 200, 6);

    expect(result.summaryTotals.sales).toBe(350);
    expect(result.summaryTotals.tacos).toBeCloseTo(35 / 350, 6);
  });

  it('returns null ratios when denominator is missing', () => {
    const rows = [{ date: '2026-02-01', ppc_cost: 10 }];

    const result = bucketAggregate(rows, buckets, metrics as any);

    expect(result.bucketTotals.tacos).toEqual([null, null]);
    expect(result.summaryTotals.tacos).toBeNull();
  });
});

describe('buildPivotRows', () => {
  it('orders rows with Sales first and Profits grouped', () => {
    const rows = [
      {
        date: '2026-02-01',
        sales: 100,
        profits: 25,
        payout: 80,
        orders: 5,
        units: 6,
      },
    ];

    const { bucketTotals, summaryTotals } = bucketAggregate(rows, buckets);

    const result = buildPivotRows(bucketTotals, summaryTotals, {
      enabledMetrics: [
        'sales',
        'profits',
        'payout',
        'cost_of_goods',
        'referral_fees',
        'fulfillment_fees',
        'refund_cost',
        'promotion_value',
        'orders',
        'units',
      ],
    });

    expect(result[0]?.metricKey).toBe('sales');
    expect(result[1]?.type).toBe('group');
    expect(result[1]?.metricKey).toBe('profits');

    const profitsGroup = result[1];
    if (profitsGroup && profitsGroup.type === 'group') {
      expect(profitsGroup.children.map((child) => child.metricKey)).toEqual([
        'payout',
        'cost_of_goods',
        'referral_fees',
        'fulfillment_fees',
        'refund_cost',
        'promotion_value',
      ]);
    }
  });
});
