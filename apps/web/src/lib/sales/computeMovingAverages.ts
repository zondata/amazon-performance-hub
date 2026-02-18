import type { SalesDailyPoint } from './getSalesDaily';

type MovingAveragePoint = {
  date: string;
  sales_7d: number | null;
  sales_14d: number | null;
  ppc_cost_7d: number | null;
  ppc_cost_14d: number | null;
  tacos_7d: number | null;
  tacos_14d: number | null;
};

const computeWindowAverage = (
  series: SalesDailyPoint[],
  index: number,
  windowSize: number
) => {
  if (index + 1 < windowSize) {
    return {
      sales: null,
      ppc_cost: null,
      tacos: null,
    };
  }

  let salesSum = 0;
  let ppcCostSum = 0;

  for (let i = index - windowSize + 1; i <= index; i += 1) {
    salesSum += series[i].sales;
    ppcCostSum += series[i].ppc_cost;
  }

  return {
    sales: salesSum / windowSize,
    ppc_cost: ppcCostSum / windowSize,
    tacos: salesSum > 0 ? ppcCostSum / salesSum : null,
  };
};

export const computeMovingAverages = (
  dailySeries: SalesDailyPoint[]
): MovingAveragePoint[] => {
  return dailySeries.map((row, index) => {
    const avg7 = computeWindowAverage(dailySeries, index, 7);
    const avg14 = computeWindowAverage(dailySeries, index, 14);

    return {
      date: row.date,
      sales_7d: avg7.sales,
      sales_14d: avg14.sales,
      ppc_cost_7d: avg7.ppc_cost,
      ppc_cost_14d: avg14.ppc_cost,
      tacos_7d: avg7.tacos,
      tacos_14d: avg14.tacos,
    };
  });
};

export type { MovingAveragePoint };
