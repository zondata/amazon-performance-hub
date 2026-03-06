import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const tableData: Record<string, Row[]> = {};

const applyFilters = (rows: Row[], filters: Array<(row: Row) => boolean>) =>
  rows.filter((row) => filters.every((filter) => filter(row)));

const createQuery = (table: string) => {
  const filters: Array<(row: Row) => boolean> = [];
  let orderColumn: string | null = null;
  let orderAscending = true;
  let rangeBounds: { from: number; to: number } | null = null;

  const run = async () => {
    let rows = applyFilters(tableData[table] ?? [], filters);
    if (orderColumn) {
      rows = [...rows].sort((left, right) => {
        const leftValue = String(left[orderColumn!] ?? '');
        const rightValue = String(right[orderColumn!] ?? '');
        return orderAscending
          ? leftValue.localeCompare(rightValue)
          : rightValue.localeCompare(leftValue);
      });
    }
    if (rangeBounds) {
      rows = rows.slice(rangeBounds.from, rangeBounds.to + 1);
    }
    return {
      data: rows,
      error: null,
    };
  };

  const query: any = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return query;
    },
    gte: (column: string, value: unknown) => {
      filters.push((row) => String(row[column] ?? '') >= String(value ?? ''));
      return query;
    },
    lte: (column: string, value: unknown) => {
      filters.push((row) => String(row[column] ?? '') <= String(value ?? ''));
      return query;
    },
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]));
      return query;
    },
    order: (column: string, options?: { ascending?: boolean }) => {
      orderColumn = column;
      orderAscending = options?.ascending !== false;
      return query;
    },
    range: (from: number, to: number) => {
      rangeBounds = { from, to };
      return query;
    },
    then: (resolve: (value: { data: Row[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
      run().then(resolve, reject),
  };

  return query;
};

vi.mock('../apps/web/src/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: (table: string) => createQuery(table),
  },
}));

vi.mock('../apps/web/src/lib/supabaseFetchAll', () => ({
  fetchAllRows: async <TRow,>(run: (from: number, to: number) => Promise<{ data: TRow[] | null }>) => {
    const { data } = await run(0, 999);
    return data ?? [];
  },
}));

vi.mock('../apps/web/src/lib/products/fetchAsinOptions', () => ({
  fetchAsinOptions: async () => [{ asin: 'B0TEST1234', label: 'B0TEST1234' }],
}));

vi.mock('../apps/web/src/lib/bulksheets/fetchCurrent', () => ({
  fetchCurrentSpData: async () => ({
    snapshotDate: '2026-03-02',
    campaignsById: new Map(),
    adGroupsById: new Map(),
    targetsById: new Map(),
    placementsByKey: new Map(),
  }),
}));

import { getSpWorkspaceData } from '../apps/web/src/lib/ads/getSpWorkspaceData';

beforeEach(() => {
  Object.keys(tableData).forEach((key) => delete tableData[key]);

  tableData.sp_advertised_product_daily_fact_latest = [
    {
      account_id: 'acct',
      date: '2026-03-01',
      campaign_id: 'c1',
      ad_group_id: 'ag1',
      advertised_asin_norm: 'B0TEST1234',
    },
    {
      account_id: 'acct',
      date: '2026-03-01',
      campaign_id: 'c2',
      ad_group_id: 'ag-other',
      advertised_asin_norm: 'B0CAMP0001',
    },
  ];
  tableData.sp_campaign_daily_fact_latest_gold = [
    {
      account_id: 'acct',
      date: '2026-03-01',
      campaign_id: 'c1',
      portfolio_name_raw: 'Portfolio A',
      campaign_name_raw: 'Campaign A',
      impressions: 100,
      clicks: 10,
      spend: 20,
      sales: 60,
      orders: 2,
      units: 2,
    },
  ];
  tableData.sp_targeting_daily_fact_latest = [
    {
      account_id: 'acct',
      date: '2026-03-01',
      exported_at: '2026-03-02T00:00:00.000Z',
      target_id: 't1',
      campaign_id: 'c1',
      ad_group_id: 'ag1',
      portfolio_name_raw: 'Portfolio A',
      campaign_name_raw: 'Campaign A',
      ad_group_name_raw: 'Ad Group A',
      targeting_raw: 'Blue Shoes',
      targeting_norm: 'blue shoes',
      match_type_norm: 'EXACT',
      impressions: 100,
      clicks: 10,
      spend: 20,
      sales: 60,
      orders: 2,
      units: 2,
      top_of_search_impression_share: 0.21,
    },
  ];
  tableData.sp_placement_daily_fact_latest = [
    {
      account_id: 'acct',
      date: '2026-03-01',
      campaign_id: 'c1',
      portfolio_name_raw: 'Portfolio A',
      campaign_name_raw: 'Campaign A',
      placement_code: 'PLACEMENT_TOP',
      placement_raw: 'Top of Search (first page)',
      placement_raw_norm: 'top of search (first page)',
      impressions: 60,
      clicks: 6,
      spend: 12,
      sales: 30,
      orders: 1,
      units: 1,
    },
  ];
  tableData.sp_stis_daily_fact_latest = [
    {
      account_id: 'acct',
      date: '2026-03-01',
      exported_at: '2026-03-02T00:00:00.000Z',
      campaign_id: 'c1',
      ad_group_id: 'ag1',
      target_id: 't1',
      target_key: 'tk1',
      campaign_name_raw: 'Campaign A',
      ad_group_name_raw: 'Ad Group A',
      targeting_raw: 'Blue Shoes',
      targeting_norm: 'blue shoes',
      match_type_norm: 'EXACT',
      customer_search_term_raw: 'blue shoes',
      customer_search_term_norm: 'blue shoes',
      search_term_impression_share: 0.41,
      search_term_impression_rank: 3,
      impressions: 40,
      clicks: 4,
      spend: 8,
      sales: 20,
      orders: 1,
      units: 1,
    },
    {
      account_id: 'acct',
      date: '2026-03-01',
      exported_at: '2026-03-02T00:00:00.000Z',
      campaign_id: 'c2',
      ad_group_id: 'ag-missing',
      target_id: 't2',
      target_key: 'tk2',
      campaign_name_raw: 'Campaign B',
      ad_group_name_raw: 'Ad Group Missing',
      targeting_raw: 'Winter Boots',
      targeting_norm: 'winter boots',
      match_type_norm: 'PHRASE',
      customer_search_term_raw: 'winter boots',
      customer_search_term_norm: 'winter boots',
      search_term_impression_share: 0.11,
      search_term_impression_rank: 9,
      impressions: 30,
      clicks: 3,
      spend: 9,
      sales: 18,
      orders: 1,
      units: 1,
    },
    {
      account_id: 'acct',
      date: '2026-03-01',
      exported_at: '2026-03-02T00:00:00.000Z',
      campaign_id: 'c3',
      ad_group_id: 'ag3',
      target_id: 't3',
      target_key: 'tk3',
      campaign_name_raw: 'Campaign C',
      ad_group_name_raw: 'Ad Group C',
      targeting_raw: 'Green Shoes',
      targeting_norm: 'green shoes',
      match_type_norm: 'BROAD',
      customer_search_term_raw: 'green shoes',
      customer_search_term_norm: 'green shoes',
      search_term_impression_share: 0.05,
      search_term_impression_rank: 15,
      impressions: 15,
      clicks: 1,
      spend: 2,
      sales: 0,
      orders: 0,
      units: 0,
    },
  ];
});

describe('getSpWorkspaceData advertised-ASIN scope', () => {
  it('keeps all five SP tabs populated for a valid uppercase-stored selected ASIN', async () => {
    const levels = ['campaigns', 'adgroups', 'targets', 'placements', 'searchterms'] as const;

    const results = await Promise.all(
      levels.map((level) =>
        getSpWorkspaceData({
          accountId: 'acct',
          marketplace: 'US',
          start: '2026-03-01',
          end: '2026-03-31',
          asinFilter: 'b0test1234',
          level,
        })
      )
    );

    results.forEach((result) => expect(result.rows.length).toBeGreaterThan(0));
    const searchTerms = results[4];
    expect(searchTerms.rows).toHaveLength(1);
    expect((searchTerms.rows[0] as { asin_label: string; coverage_label: string | null }).asin_label).toBe(
      'B0TEST1234'
    );
    expect(
      (searchTerms.rows[0] as { coverage_label: string | null }).coverage_label
    ).not.toBe('ASIN fallback');
  });

  it('uses real ASIN buckets before fallback in all-ASIN search terms mode', async () => {
    const result = await getSpWorkspaceData({
      accountId: 'acct',
      marketplace: 'US',
      start: '2026-03-01',
      end: '2026-03-31',
      asinFilter: 'all',
      level: 'searchterms',
    });

    const rows = result.rows as Array<{ asin_label: string; coverage_label: string | null }>;
    expect(rows.map((row) => row.asin_label)).toEqual([
      'B0CAMP0001',
      'B0TEST1234',
      'Unattributed',
    ]);
    expect(rows.filter((row) => row.coverage_label === 'ASIN fallback')).toHaveLength(1);
  });

  it('keeps lower SP tabs populated when advertised-product coverage is mapped only at campaign level', async () => {
    tableData.sp_advertised_product_daily_fact_latest = [
      {
        account_id: 'acct',
        date: '2026-03-01',
        campaign_id: 'c1',
        ad_group_id: null,
        advertised_asin_norm: 'B0TEST1234',
      },
    ];

    const levels = ['campaigns', 'adgroups', 'targets', 'placements', 'searchterms'] as const;
    const results = await Promise.all(
      levels.map((level) =>
        getSpWorkspaceData({
          accountId: 'acct',
          marketplace: 'US',
          start: '2026-03-01',
          end: '2026-03-31',
          asinFilter: 'B0TEST1234',
          level,
        })
      )
    );

    results.forEach((result) => expect(result.rows.length).toBeGreaterThan(0));
  });
});
