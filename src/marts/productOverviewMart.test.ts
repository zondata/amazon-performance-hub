import { describe, expect, it } from 'vitest';

import {
  PRODUCT_OVERVIEW_ADS_SPEND_SOURCE,
  PRODUCT_OVERVIEW_MART_CONTRACT,
  buildProductOverviewMart,
  buildProductOverviewMartFromRows,
  type ProductOverviewAdsSpendSourceRow,
  type ProductOverviewRetailTruthSourceRow,
} from './productOverviewMart';
import {
  parseProductOverviewMartCliArgs,
  runProductOverviewMartCli,
} from './productOverviewMartCli';
import {
  RETAIL_TRUTH_SOURCE,
  SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
} from '../warehouse/retailSalesTrafficTruth';

const request = {
  account_id: 'sourbear',
  marketplace: 'US',
  start_date: '2026-04-01',
  end_date: '2026-04-02',
};

const retailRow = (
  overrides: Partial<ProductOverviewRetailTruthSourceRow> = {}
): ProductOverviewRetailTruthSourceRow => ({
  account_id: 'sourbear',
  marketplace: 'US',
  asin: 'B0TESTASIN',
  date: null,
  report_window_start: '2026-04-01',
  report_window_end: '2026-04-02',
  ordered_product_sales_amount: 150,
  total_order_items: 7,
  sessions: 75,
  report_id: 'report-1',
  canonical_record_id: 'report-1:salesAndTrafficByAsin:0',
  exported_at: '2026-04-20T00:00:00.000Z',
  ingested_at: '2026-04-20T00:01:00.000Z',
  retail_truth_source: RETAIL_TRUTH_SOURCE,
  legacy_sales_trend_fallback: false,
  ...overrides,
});

const adsRow = (
  overrides: Partial<ProductOverviewAdsSpendSourceRow> = {}
): ProductOverviewAdsSpendSourceRow => ({
  account_id: 'sourbear',
  date: '2026-04-01',
  advertised_asin_norm: 'B0TESTASIN',
  spend: 0,
  campaign_id: 'campaign-1',
  ad_group_id: 'ad-group-1',
  exported_at: '2026-04-20T00:00:00.000Z',
  ...overrides,
});

describe('product overview mart', () => {
  it('exposes a typed API-backed contract with row keys, nullability, ordering, and diagnostics', () => {
    expect(PRODUCT_OVERVIEW_MART_CONTRACT.sources).toEqual({
      retail: SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
      retail_truth_source: RETAIL_TRUTH_SOURCE,
      ads_spend: PRODUCT_OVERVIEW_ADS_SPEND_SOURCE,
      legacy_sales_trend_fallback: false,
    });
    expect(PRODUCT_OVERVIEW_MART_CONTRACT.row_key).toEqual([
      'account_id',
      'marketplace',
      'asin',
      'start_date',
      'end_date',
    ]);
    expect(PRODUCT_OVERVIEW_MART_CONTRACT.metric_nullability.tacos).toContain(
      'ad_spend / sales'
    );
    expect(PRODUCT_OVERVIEW_MART_CONTRACT.deterministic_order).toContain(
      'asin ASC'
    );
    expect(PRODUCT_OVERVIEW_MART_CONTRACT.diagnostics).toContain(
      'missing_ads_data'
    );
    expect(JSON.stringify(PRODUCT_OVERVIEW_MART_CONTRACT)).not.toContain(
      'si_sales_trend_daily_latest'
    );
  });

  it('reads retail metrics from FT-02 truth and ad spend from Ads-backed rows', () => {
    const result = buildProductOverviewMartFromRows({
      request,
      retailTruthRows: [retailRow()],
      adsSpendRows: [
        adsRow({ date: '2026-04-01', spend: 20 }),
        adsRow({ date: '2026-04-02', spend: 5 }),
      ],
    });

    expect(result.source_summary).toMatchObject({
      retail_source: SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
      retail_truth_source: RETAIL_TRUTH_SOURCE,
      ads_source: PRODUCT_OVERVIEW_ADS_SPEND_SOURCE,
      legacy_sales_trend_fallback: false,
      retail_row_count: 1,
      ads_row_count: 2,
    });
    expect(result.row_count).toBe(1);
    expect(result.diagnostics_count).toBe(0);
    expect(result.rows[0]).toMatchObject({
      account_id: 'sourbear',
      marketplace: 'US',
      asin: 'B0TESTASIN',
      start_date: '2026-04-01',
      end_date: '2026-04-02',
      sales: 150,
      orders: 7,
      sessions: 75,
      ad_spend: 25,
    });
    expect(result.rows[0]?.conversion_rate).toBeCloseTo(7 / 75, 8);
    expect(result.rows[0]?.tacos).toBeCloseTo(25 / 150, 8);
  });

  it('rejects non-SP-API retail truth and legacy SalesTrend fallback rows', () => {
    expect(() =>
      buildProductOverviewMartFromRows({
        request,
        retailTruthRows: [
          retailRow({
            retail_truth_source: 'legacy-sales-trend',
            legacy_sales_trend_fallback: true,
          }),
        ],
        adsSpendRows: [adsRow({ spend: 1 })],
      })
    ).toThrow(/unsupported source|legacy SalesTrend fallback/);
  });

  it('returns null ad_spend and a missing_ads_data diagnostic when Ads-backed spend is absent', () => {
    const result = buildProductOverviewMartFromRows({
      request,
      retailTruthRows: [retailRow()],
      adsSpendRows: [],
    });

    expect(result.rows[0]?.ad_spend).toBeNull();
    expect(result.rows[0]?.tacos).toBeNull();
    expect(result.rows[0]?.diagnostics.map((item) => item.code)).toContain(
      'missing_ads_data'
    );
    expect(result.rows[0]?.diagnostics.map((item) => item.source)).toContain(
      PRODUCT_OVERVIEW_ADS_SPEND_SOURCE
    );
  });

  it('returns null sessions and conversion_rate when retail sessions data is missing', () => {
    const result = buildProductOverviewMartFromRows({
      request,
      retailTruthRows: [retailRow({ sessions: null })],
      adsSpendRows: [adsRow({ spend: 8 }), adsRow({ date: '2026-04-02', spend: 2 })],
    });

    expect(result.rows[0]?.sessions).toBeNull();
    expect(result.rows[0]?.conversion_rate).toBeNull();
    expect(result.rows[0]?.diagnostics.map((item) => item.code)).toContain(
      'missing_sessions_data'
    );
  });

  it('returns null conversion_rate when sessions is zero', () => {
    const result = buildProductOverviewMartFromRows({
      request: { ...request, start_date: '2026-04-01', end_date: '2026-04-01' },
      retailTruthRows: [
        retailRow({
          report_window_start: '2026-04-01',
          report_window_end: '2026-04-01',
          ordered_product_sales_amount: 80,
          total_order_items: 4,
          sessions: 0,
        }),
      ],
      adsSpendRows: [adsRow({ date: '2026-04-01', spend: 8 })],
    });

    expect(result.rows[0]?.sessions).toBe(0);
    expect(result.rows[0]?.conversion_rate).toBeNull();
    expect(result.rows[0]?.diagnostics.map((item) => item.code)).toContain(
      'zero_sessions_denominator'
    );
  });

  it('returns null tacos when sales is zero', () => {
    const result = buildProductOverviewMartFromRows({
      request: { ...request, start_date: '2026-04-01', end_date: '2026-04-01' },
      retailTruthRows: [
        retailRow({
          report_window_start: '2026-04-01',
          report_window_end: '2026-04-01',
          ordered_product_sales_amount: 0,
          total_order_items: 0,
          sessions: 10,
        }),
      ],
      adsSpendRows: [adsRow({ date: '2026-04-01', spend: 12 })],
    });

    expect(result.rows[0]?.sales).toBe(0);
    expect(result.rows[0]?.ad_spend).toBe(12);
    expect(result.rows[0]?.tacos).toBeNull();
    expect(result.rows[0]?.diagnostics.map((item) => item.code)).toContain(
      'zero_sales_denominator'
    );
  });

  it('orders rows deterministically by account, marketplace, and ASIN', () => {
    const result = buildProductOverviewMartFromRows({
      request,
      retailTruthRows: [
        retailRow({ asin: 'B0ZZZZZZZZ' }),
        retailRow({ asin: 'B0AAAAAAAA' }),
      ],
      adsSpendRows: [
        adsRow({ advertised_asin_norm: 'B0ZZZZZZZZ', spend: 1 }),
        adsRow({ advertised_asin_norm: 'B0AAAAAAAA', spend: 1 }),
        adsRow({
          advertised_asin_norm: 'B0ZZZZZZZZ',
          date: '2026-04-02',
          spend: 1,
        }),
        adsRow({
          advertised_asin_norm: 'B0AAAAAAAA',
          date: '2026-04-02',
          spend: 1,
        }),
      ],
    });

    expect(result.rows.map((item) => item.asin)).toEqual([
      'B0AAAAAAAA',
      'B0ZZZZZZZZ',
    ]);
  });

  it('returns deterministic repeated output for the same source inputs', async () => {
    const retailTruthRows = [
      retailRow({ asin: 'B0ZZZZZZZZ' }),
      retailRow({ asin: 'B0AAAAAAAA' }),
    ];
    const adsSpendRows = [
      adsRow({ advertised_asin_norm: 'B0ZZZZZZZZ', spend: 3 }),
      adsRow({ advertised_asin_norm: 'B0AAAAAAAA', spend: 2 }),
      adsRow({
        advertised_asin_norm: 'B0ZZZZZZZZ',
        date: '2026-04-02',
        spend: 1,
      }),
      adsRow({
        advertised_asin_norm: 'B0AAAAAAAA',
        date: '2026-04-02',
        spend: 1,
      }),
    ];
    const source = {
      async fetchRetailTruthRows() {
        return retailTruthRows;
      },
      async fetchAdsSpendRows() {
        return adsSpendRows;
      },
    };

    const first = await buildProductOverviewMart({ request, source });
    const second = await buildProductOverviewMart({ request, source });

    expect(second).toEqual(first);
  });

  it('uses explicit inclusive date-window boundaries and ignores outside rows', () => {
    const result = buildProductOverviewMartFromRows({
      request,
      retailTruthRows: [
        retailRow({
          report_window_start: '2026-03-31',
          report_window_end: '2026-03-31',
          ordered_product_sales_amount: 999,
          total_order_items: 99,
          sessions: 99,
        }),
        retailRow({
          report_window_start: '2026-04-01',
          report_window_end: '2026-04-02',
          ordered_product_sales_amount: 30,
          total_order_items: 3,
          sessions: 15,
        }),
        retailRow({
          report_window_start: '2026-04-03',
          report_window_end: '2026-04-03',
          ordered_product_sales_amount: 999,
          total_order_items: 99,
          sessions: 99,
        }),
      ],
      adsSpendRows: [
        adsRow({ date: '2026-03-31', spend: 999 }),
        adsRow({ date: '2026-04-01', spend: 1 }),
        adsRow({ date: '2026-04-02', spend: 2 }),
        adsRow({ date: '2026-04-03', spend: 999 }),
      ],
    });

    expect(result.rows[0]?.sales).toBe(30);
    expect(result.rows[0]?.orders).toBe(3);
    expect(result.rows[0]?.sessions).toBe(15);
    expect(result.rows[0]?.ad_spend).toBe(3);
  });

  it('emits diagnostics for incomplete retail and ads source coverage', () => {
    const result = buildProductOverviewMartFromRows({
      request: {
        ...request,
        start_date: '2026-04-01',
        end_date: '2026-04-03',
      },
      retailTruthRows: [
        retailRow({
          report_window_start: '2026-04-01',
          report_window_end: '2026-04-01',
          ordered_product_sales_amount: 10,
          total_order_items: 1,
          sessions: 5,
        }),
      ],
      adsSpendRows: [adsRow({ date: '2026-04-01', spend: 1 })],
    });

    expect(result.rows[0]?.source_coverage).toMatchObject({
      expected_days: 3,
      retail_observed_days: 1,
      ads_observed_days: 1,
      retail_missing_dates: ['2026-04-02', '2026-04-03'],
      ads_missing_dates: ['2026-04-02', '2026-04-03'],
    });
    expect(result.rows[0]?.diagnostics.map((item) => item.code)).toContain(
      'incomplete_source_coverage'
    );
  });

  it('parses CLI arguments and prints API-backed source summaries', async () => {
    const parsed = parseProductOverviewMartCliArgs([
      '--account-id',
      'sourbear',
      '--marketplace',
      'us',
      '--start-date',
      '2026-04-01',
      '--end-date',
      '2026-04-02',
      '--asin',
      'b0stubasin',
      '--scenario',
      'stub-valid',
    ]);

    expect(parsed).toMatchObject({
      account_id: 'sourbear',
      marketplace: 'us',
      start_date: '2026-04-01',
      end_date: '2026-04-02',
      asin: 'b0stubasin',
      scenario: 'stub-valid',
    });

    const summary = await runProductOverviewMartCli([
      '--account-id=sourbear',
      '--marketplace=US',
      '--start-date=2026-04-01',
      '--end-date=2026-04-02',
      '--asin=B0STUBASIN',
      '--scenario=stub-valid',
    ]);

    expect(summary).toContain('Product overview mart build');
    expect(summary).toContain('ok=yes');
    expect(summary).toContain(
      `Retail source: ${SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW}`
    );
    expect(summary).toContain(`Ads source: ${PRODUCT_OVERVIEW_ADS_SPEND_SOURCE}`);
    expect(summary).toContain('Legacy SI fallback: no');
    expect(summary).toContain('Row count: 1');
    expect(summary).toContain('Diagnostics count: 0');
    expect(summary).toContain('Row B0STUBASIN');
    expect(summary).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('fails the CLI stub when legacy fallback is attempted', async () => {
    await expect(
      runProductOverviewMartCli([
        '--account-id=sourbear',
        '--marketplace=US',
        '--start-date=2026-04-01',
        '--end-date=2026-04-02',
        '--asin=B0STUBASIN',
        '--scenario=stub-legacy-fallback',
      ])
    ).rejects.toThrow(/unsupported source|legacy SalesTrend fallback/);
  });
});
