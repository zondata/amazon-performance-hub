import { describe, expect, it } from 'vitest';

import { computeMovingAverages } from '../apps/web/src/lib/sales/computeMovingAverages';

describe('computeMovingAverages', () => {
  it('computes 7d averages and leaves early values null', () => {
    const daily = Array.from({ length: 8 }, (_, index) => {
      const day = index + 1;
      return {
        date: `2026-01-0${day}`.slice(0, 10),
        sales: day * 10,
        orders: day,
        units: day,
        ppc_cost: 1,
        tacos: 0.1,
        avg_price: 50,
      };
    });

    const result = computeMovingAverages(daily);

    result.slice(0, 6).forEach((row) => {
      expect(row.sales_7d).toBeNull();
      expect(row.ppc_cost_7d).toBeNull();
      expect(row.tacos_7d).toBeNull();
    });

    expect(result[6].sales_7d).toBeCloseTo(40, 4);
    expect(result[6].ppc_cost_7d).toBeCloseTo(1, 4);
    expect(result[6].tacos_7d).toBeCloseTo(7 / 280, 4);

    expect(result[7].sales_7d).toBeCloseTo(50, 4);
    expect(result[7].ppc_cost_7d).toBeCloseTo(1, 4);
    expect(result[7].tacos_7d).toBeCloseTo(7 / 350, 4);

    result.forEach((row) => {
      expect(row.sales_14d).toBeNull();
      expect(row.ppc_cost_14d).toBeNull();
      expect(row.tacos_14d).toBeNull();
    });
  });
});
