export type CampaignMetricRow = {
  campaign_id: string | null;
  campaign_name_raw?: string | null;
  impressions?: number | string | null;
  clicks?: number | string | null;
  spend?: number | string | null;
  sales?: number | string | null;
  orders?: number | string | null;
  units?: number | string | null;
};

export type CampaignAggregate = {
  campaign_id: string;
  campaign_name?: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  units: number;
  ctr: number | null;
  cpc: number | null;
  acos: number | null;
  roas: number | null;
};

const numberValue = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return numeric;
};

const safeDivide = (numerator: number, denominator: number): number | null => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
};

export const aggregateCampaignRows = (rows: CampaignMetricRow[]) => {
  const byCampaign = new Map<string, CampaignAggregate>();

  rows.forEach((row) => {
    if (!row.campaign_id) return;
    const key = row.campaign_id;
    const existing = byCampaign.get(key) ?? {
      campaign_id: key,
      campaign_name: row.campaign_name_raw ?? null,
      impressions: 0,
      clicks: 0,
      spend: 0,
      sales: 0,
      orders: 0,
      units: 0,
      ctr: null,
      cpc: null,
      acos: null,
      roas: null,
    };

    existing.impressions += numberValue(row.impressions);
    existing.clicks += numberValue(row.clicks);
    existing.spend += numberValue(row.spend);
    existing.sales += numberValue(row.sales);
    existing.orders += numberValue(row.orders);
    existing.units += numberValue(row.units);

    byCampaign.set(key, existing);
  });

  const aggregates = Array.from(byCampaign.values()).map((row) => ({
    ...row,
    ctr: safeDivide(row.clicks, row.impressions),
    cpc: safeDivide(row.spend, row.clicks),
    acos: safeDivide(row.spend, row.sales),
    roas: safeDivide(row.sales, row.spend),
  }));

  aggregates.sort((a, b) => b.spend - a.spend);

  const totals = aggregates.reduce(
    (acc, row) => {
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.spend += row.spend;
      acc.sales += row.sales;
      acc.orders += row.orders;
      acc.units += row.units;
      return acc;
    },
    {
      impressions: 0,
      clicks: 0,
      spend: 0,
      sales: 0,
      orders: 0,
      units: 0,
      ctr: null as number | null,
      cpc: null as number | null,
      acos: null as number | null,
      roas: null as number | null,
    }
  );

  return {
    rows: aggregates,
    totals: {
      ...totals,
      ctr: safeDivide(totals.clicks, totals.impressions),
      cpc: safeDivide(totals.spend, totals.clicks),
      acos: safeDivide(totals.spend, totals.sales),
      roas: safeDivide(totals.sales, totals.spend),
    },
  };
};
