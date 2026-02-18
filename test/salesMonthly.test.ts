import { describe, expect, it } from 'vitest';

import { groupSalesMonthly } from '../apps/web/src/lib/sales/groupSalesMonthly';

describe('groupSalesMonthly', () => {
  it('aggregates daily rows into monthly totals with weighted price', () => {
    const daily = [
      {
        date: '2026-01-01',
        sales: 100,
        orders: 1,
        units: 2,
        ppc_cost: 10,
        tacos: 0.1,
        avg_price: 50,
      },
      {
        date: '2026-01-15',
        sales: 60,
        orders: 1,
        units: 1,
        ppc_cost: 6,
        tacos: 0.1,
        avg_price: 60,
      },
      {
        date: '2026-02-02',
        sales: 200,
        orders: 2,
        units: 4,
        ppc_cost: 20,
        tacos: 0.1,
        avg_price: 50,
      },
    ];

    const monthly = groupSalesMonthly(daily);

    expect(monthly).toHaveLength(2);
    expect(monthly[0].month).toBe('2026-01');
    expect(monthly[0].sales).toBe(160);
    expect(monthly[0].orders).toBe(2);
    expect(monthly[0].units).toBe(3);
    expect(monthly[0].ppc_cost).toBe(16);
    expect(monthly[0].avg_price).toBeCloseTo(53.333, 3);
    expect(monthly[0].tacos).toBeCloseTo(16 / 160, 4);

    expect(monthly[1].month).toBe('2026-02');
    expect(monthly[1].sales).toBe(200);
    expect(monthly[1].orders).toBe(2);
    expect(monthly[1].units).toBe(4);
    expect(monthly[1].ppc_cost).toBe(20);
    expect(monthly[1].avg_price).toBeCloseTo(50, 4);
    expect(monthly[1].tacos).toBeCloseTo(0.1, 4);
  });
});
