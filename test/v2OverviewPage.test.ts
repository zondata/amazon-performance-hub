import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import V2OverviewPageView from '../apps/web/src/app/v2/overview/[asin]/V2OverviewPageView';
import {
  loadV2OverviewPageState,
  parseV2OverviewDateWindow,
} from '../apps/web/src/lib/v2/overview';
import type {
  ProductOverviewAdsSpendSourceRow,
  ProductOverviewMartSource,
  ProductOverviewRetailTruthSourceRow,
} from '../src/marts/productOverviewMart';

const requireFromWeb = createRequire(path.join(process.cwd(), 'apps/web/package.json'));
const React = requireFromWeb('react') as {
  createElement: (type: unknown, props?: Record<string, unknown> | null) => unknown;
};
const { renderToStaticMarkup } = requireFromWeb('react-dom/server') as {
  renderToStaticMarkup: (element: unknown) => string;
};

const pagePath = path.join(
  process.cwd(),
  'apps/web/src/app/v2/overview/[asin]/page.tsx'
);
const loaderPath = path.join(process.cwd(), 'apps/web/src/lib/v2/overview.ts');

const retailRow = (
  overrides: Partial<ProductOverviewRetailTruthSourceRow> = {}
): ProductOverviewRetailTruthSourceRow => ({
  account_id: 'sourbear',
  marketplace: 'US',
  asin: 'B0FYPRWPN1',
  date: '2026-04-04',
  report_window_start: '2026-04-04',
  report_window_end: '2026-04-04',
  ordered_product_sales_amount: 62.97,
  total_order_items: 4,
  sessions: 30,
  report_id: '487536020563',
  canonical_record_id: 'record-1',
  exported_at: '2026-04-20T00:00:00.000Z',
  ingested_at: '2026-04-20T00:05:00.000Z',
  retail_truth_source: 'sp-api-sales-and-traffic',
  legacy_sales_trend_fallback: false,
  ...overrides,
});

const adsRow = (
  overrides: Partial<ProductOverviewAdsSpendSourceRow> = {}
): ProductOverviewAdsSpendSourceRow => ({
  account_id: 'sourbear',
  date: '2026-04-04',
  advertised_asin_norm: 'B0FYPRWPN1',
  spend: 31.23,
  campaign_id: 'campaign-1',
  ad_group_id: 'ad-group-1',
  exported_at: '2026-04-20T00:00:00.000Z',
  ...overrides,
});

const makeSource = (args: {
  retailRows?: ProductOverviewRetailTruthSourceRow[];
  adsRows?: ProductOverviewAdsSpendSourceRow[];
}): ProductOverviewMartSource => ({
  fetchRetailTruthRows: async () => args.retailRows ?? [retailRow()],
  fetchAdsSpendRows: async () => args.adsRows ?? [adsRow()],
});

const loadFixtureState = (source: ProductOverviewMartSource = makeSource({})) =>
  loadV2OverviewPageState(
    {
      asin: 'b0fyprwpn1',
      searchParams: {
        start: '2026-04-04',
        end: '2026-04-04',
      },
    },
    {
      source,
      accountId: 'sourbear',
      marketplace: 'US',
    }
  );

const renderState = async (source?: ProductOverviewMartSource) => {
  const state = await loadFixtureState(source);
  return renderToStaticMarkup(React.createElement(V2OverviewPageView, { state }));
};

describe('V2 Overview page loader', () => {
  it('parses explicit start and end date search params', () => {
    expect(
      parseV2OverviewDateWindow({
        start: ['2026-04-04', '2026-04-05'],
        end: '2026-04-06',
      })
    ).toEqual({
      startDate: '2026-04-04',
      endDate: '2026-04-06',
      error: null,
    });
  });

  it('requires explicit dates and does not call the mart source without them', async () => {
    let called = false;
    const source: ProductOverviewMartSource = {
      fetchRetailTruthRows: async () => {
        called = true;
        return [];
      },
      fetchAdsSpendRows: async () => {
        called = true;
        return [];
      },
    };

    const state = await loadV2OverviewPageState(
      {
        asin: 'B0FYPRWPN1',
        searchParams: {},
      },
      {
        source,
        accountId: 'sourbear',
        marketplace: 'US',
      }
    );

    expect(state.kind).toBe('missing-date-window');
    expect(called).toBe(false);
  });

  it('loads the FT-03 product overview mart path for the route ASIN and date window', async () => {
    const calls: { retail?: unknown; ads?: unknown } = {};
    const source: ProductOverviewMartSource = {
      fetchRetailTruthRows: async (request) => {
        calls.retail = request;
        return [retailRow()];
      },
      fetchAdsSpendRows: async (request) => {
        calls.ads = request;
        return [adsRow()];
      },
    };

    const state = await loadFixtureState(source);

    expect(state.kind).toBe('loaded');
    if (state.kind !== 'loaded') return;
    expect(calls.retail).toEqual({
      account_id: 'sourbear',
      marketplace: 'US',
      start_date: '2026-04-04',
      end_date: '2026-04-04',
      asin: 'B0FYPRWPN1',
    });
    expect(calls.ads).toEqual(calls.retail);
    expect(state.mart.source_summary.retail_source).toBe(
      'spapi_retail_sales_traffic_by_asin_truth'
    );
    expect(state.mart.source_summary.ads_source).toBe(
      'sp_advertised_product_daily_fact_latest'
    );
    expect(state.mart.source_summary.legacy_sales_trend_fallback).toBe(false);
  });

  it('returns a bounded error state when the mart source fails', async () => {
    const state = await loadFixtureState({
      fetchRetailTruthRows: async () => {
        throw new Error('source unavailable');
      },
      fetchAdsSpendRows: async () => [],
    });

    expect(state.kind).toBe('error');
    if (state.kind !== 'error') return;
    expect(state.message).toContain('source unavailable');
  });
});

describe('V2 Overview page surface', () => {
  it('renders the required overview metrics and source/fallback state', async () => {
    const markup = await renderState();

    expect(markup).toContain('B0FYPRWPN1');
    expect(markup).toContain('2026-04-04 -&gt; 2026-04-04');
    expect(markup).toContain('Sales');
    expect(markup).toContain('$62.97');
    expect(markup).toContain('Orders');
    expect(markup).toContain('4');
    expect(markup).toContain('Sessions');
    expect(markup).toContain('30');
    expect(markup).toContain('Conversion rate');
    expect(markup).toContain('13.3%');
    expect(markup).toContain('Ad spend');
    expect(markup).toContain('$31.23');
    expect(markup).toContain('TACOS');
    expect(markup).toContain('49.6%');
    expect(markup).toContain('spapi_retail_sales_traffic_by_asin_truth');
    expect(markup).toContain('sp-api-sales-and-traffic');
    expect(markup).toContain('sp_advertised_product_daily_fact_latest');
    expect(markup).toContain('Legacy SI fallback');
    expect(markup).toContain('No');
  });

  it('renders no-data state without fabricating metrics', async () => {
    const markup = await renderState(
      makeSource({
        retailRows: [],
        adsRows: [],
      })
    );

    expect(markup).toContain('No product overview data');
    expect(markup).toContain('No metrics were fabricated');
    expect(markup).not.toContain('$0.00');
  });

  it('renders partial-data diagnostics returned by the mart', async () => {
    const markup = await renderState(
      makeSource({
        retailRows: [retailRow()],
        adsRows: [],
      })
    );

    expect(markup).toContain('Diagnostics');
    expect(markup).toContain('missing_ads_data');
    expect(markup).toContain('No non-null spend values were present');
  });

  it('keeps the page and loader free of direct SI SalesTrend table reads', () => {
    const pageSource = fs.readFileSync(pagePath, 'utf8');
    const loaderSource = fs.readFileSync(loaderPath, 'utf8');

    expect(pageSource).not.toContain('si_sales_trend_daily_latest');
    expect(loaderSource).not.toContain('si_sales_trend_daily_latest');
  });
});
