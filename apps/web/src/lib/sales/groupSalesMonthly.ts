import type { SalesDailyPoint } from './getSalesDaily';

export type SalesMonthlyPoint = {
  month: string;
  sales: number;
  orders: number;
  units: number;
  ppc_cost: number;
  tacos: number | null;
  avg_price: number | null;
};

export const groupSalesMonthly = (
  dailySeries: SalesDailyPoint[]
): SalesMonthlyPoint[] => {
  const monthlyMap = new Map<
    string,
    {
      month: string;
      sales: number;
      orders: number;
      units: number;
      ppc_cost: number;
      weighted_price_total: number;
      weighted_units_total: number;
    }
  >();

  dailySeries.forEach((row) => {
    if (!row.date) return;
    const monthKey = row.date.slice(0, 7);
    const existing = monthlyMap.get(monthKey) ?? {
      month: monthKey,
      sales: 0,
      orders: 0,
      units: 0,
      ppc_cost: 0,
      weighted_price_total: 0,
      weighted_units_total: 0,
    };

    existing.sales += row.sales;
    existing.orders += row.orders;
    existing.units += row.units;
    existing.ppc_cost += row.ppc_cost;

    const avgPrice = row.avg_sales_price ?? row.avg_price;
    if (avgPrice !== null && avgPrice !== undefined) {
      existing.weighted_price_total += avgPrice * row.units;
      existing.weighted_units_total += row.units;
    }

    monthlyMap.set(monthKey, existing);
  });

  return Array.from(monthlyMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => {
      const avgPrice =
        row.weighted_units_total > 0
          ? row.weighted_price_total / row.weighted_units_total
          : null;
      const tacos = row.sales > 0 ? row.ppc_cost / row.sales : null;
      return {
        month: row.month,
        sales: row.sales,
        orders: row.orders,
        units: row.units,
        ppc_cost: row.ppc_cost,
        tacos,
        avg_price: avgPrice,
      };
    });
};
