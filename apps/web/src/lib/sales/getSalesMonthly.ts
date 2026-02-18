import 'server-only';

import { getSalesDaily } from './getSalesDaily';
import { groupSalesMonthly } from './groupSalesMonthly';

type SalesMonthlyFilters = {
  accountId: string;
  marketplace: string;
  start: string;
  end: string;
  asin: string;
};

export const getSalesMonthly = async ({
  accountId,
  marketplace,
  start,
  end,
  asin,
}: SalesMonthlyFilters) => {
  const dailyData = await getSalesDaily({
    accountId,
    marketplace,
    start,
    end,
    asin,
  });

  const monthlySeries = groupSalesMonthly(dailyData.dailySeries);

  return {
    ...dailyData,
    monthlySeries,
  };
};

export type SalesMonthlyData = Awaited<ReturnType<typeof getSalesMonthly>>;
