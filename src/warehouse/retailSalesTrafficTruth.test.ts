import { describe, expect, it } from 'vitest';

import {
  InMemoryRetailSalesTrafficTruthReader,
  RETAIL_TRUTH_SOURCE,
  SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
  SPAPI_RETAIL_SALES_TRAFFIC_BY_DATE_TRUTH_VIEW,
  RetailSalesTrafficTruthError,
  runRetailSalesTrafficTruthProof,
  selectRetailSalesTrafficByAsinTruthRows,
  selectRetailSalesTrafficByDateTruthRows,
  summarizeRetailSalesTrafficTruthProof,
} from './retailSalesTrafficTruth';

const baseDateRow = {
  accountId: 'sourbear',
  marketplace: 'US',
  date: '2026-04-12',
  reportId: 'report-old',
  ingestionJobId: '00000000-0000-0000-0000-000000000001',
  canonicalRecordId: 'report-old:salesAndTrafficByDate:0',
  reportWindowStart: '2026-04-12',
  reportWindowEnd: '2026-04-12',
  orderedProductSalesAmount: 100,
  orderedProductSalesCurrency: 'USD',
  unitsOrdered: 5,
  totalOrderItems: 5,
  sessions: 10,
  pageViews: 20,
  exportedAt: '2026-04-20T00:00:00.000Z',
  ingestedAt: '2026-04-20T00:05:00.000Z',
  retailTruthSource: RETAIL_TRUTH_SOURCE,
  legacySalesTrendFallback: false,
};

const baseAsinRow = {
  accountId: 'sourbear',
  marketplace: 'US',
  asin: 'B0TESTASIN',
  parentAsin: 'B0TESTASIN',
  childAsin: null,
  sku: null,
  date: null,
  reportId: 'report-old',
  ingestionJobId: '00000000-0000-0000-0000-000000000001',
  canonicalRecordId: 'report-old:salesAndTrafficByAsin:0',
  reportWindowStart: '2026-04-12',
  reportWindowEnd: '2026-04-18',
  orderedProductSalesAmount: 200,
  orderedProductSalesCurrency: 'USD',
  unitsOrdered: 10,
  totalOrderItems: 10,
  sessions: 40,
  pageViews: 80,
  exportedAt: '2026-04-20T00:00:00.000Z',
  ingestedAt: '2026-04-20T00:05:00.000Z',
  retailTruthSource: RETAIL_TRUTH_SOURCE,
  legacySalesTrendFallback: false,
};

describe('FT-02 retail Sales and Traffic truth contract', () => {
  it('returns deterministic by-date truth rows using latest exported rows', () => {
    const rows = selectRetailSalesTrafficByDateTruthRows(
      [
        baseDateRow,
        {
          ...baseDateRow,
          reportId: 'report-new',
          canonicalRecordId: 'report-new:salesAndTrafficByDate:0',
          orderedProductSalesAmount: 150,
          exportedAt: '2026-04-21T00:00:00.000Z',
          ingestedAt: '2026-04-21T00:05:00.000Z',
        },
        {
          ...baseDateRow,
          accountId: 'other-account',
          reportId: 'report-other-account',
          canonicalRecordId: 'report-other-account:salesAndTrafficByDate:0',
          orderedProductSalesAmount: 999,
          exportedAt: '2026-04-22T00:00:00.000Z',
        },
      ],
      {
        accountId: 'sourbear',
        marketplace: 'us',
        startDate: '2026-04-12',
        endDate: '2026-04-12',
      }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      accountId: 'sourbear',
      marketplace: 'US',
      date: '2026-04-12',
      reportId: 'report-new',
      orderedProductSalesAmount: 150,
      retailTruthSource: RETAIL_TRUTH_SOURCE,
      legacySalesTrendFallback: false,
    });
  });

  it('returns deterministic by-ASIN truth rows with account marketplace and ASIN filters', () => {
    const rows = selectRetailSalesTrafficByAsinTruthRows(
      [
        baseAsinRow,
        {
          ...baseAsinRow,
          reportId: 'report-new',
          canonicalRecordId: 'report-new:salesAndTrafficByAsin:0',
          orderedProductSalesAmount: 250,
          exportedAt: '2026-04-21T00:00:00.000Z',
          ingestedAt: '2026-04-21T00:05:00.000Z',
        },
        {
          ...baseAsinRow,
          asin: 'B0OTHERASIN',
          parentAsin: 'B0OTHERASIN',
          reportId: 'report-other-asin',
          canonicalRecordId: 'report-other-asin:salesAndTrafficByAsin:0',
          exportedAt: '2026-04-22T00:00:00.000Z',
        },
        {
          ...baseAsinRow,
          marketplace: 'CA',
          reportId: 'report-other-marketplace',
          canonicalRecordId: 'report-other-marketplace:salesAndTrafficByAsin:0',
          exportedAt: '2026-04-22T00:00:00.000Z',
        },
      ],
      {
        accountId: 'sourbear',
        marketplace: 'US',
        startDate: '2026-04-12',
        endDate: '2026-04-18',
        asin: 'B0TESTASIN',
      }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      accountId: 'sourbear',
      marketplace: 'US',
      asin: 'B0TESTASIN',
      reportId: 'report-new',
      orderedProductSalesAmount: 250,
      retailTruthSource: RETAIL_TRUTH_SOURCE,
      legacySalesTrendFallback: false,
    });
  });

  it('builds a proof summary over both truth surfaces without SI fallback', async () => {
    const reader = new InMemoryRetailSalesTrafficTruthReader(
      [baseDateRow],
      [baseAsinRow]
    );

    const summary = await runRetailSalesTrafficTruthProof({
      reader,
      query: {
        accountId: 'sourbear',
        marketplace: 'US',
        startDate: '2026-04-12',
        endDate: '2026-04-18',
      },
    });

    expect(summary).toMatchObject({
      ok: true,
      accountId: 'sourbear',
      marketplace: 'US',
      byDateRowCount: 1,
      byAsinRowCount: 1,
      retailTruthSource: RETAIL_TRUTH_SOURCE,
      legacySalesTrendFallback: false,
      targetTruthSurfaceNames: [
        SPAPI_RETAIL_SALES_TRAFFIC_BY_DATE_TRUTH_VIEW,
        SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
      ],
    });
    expect(summary.sourceReportIds).toEqual(['report-old']);
    expect(summarizeRetailSalesTrafficTruthProof(summary)).toContain(
      'legacy_sales_trend_fallback=no'
    );
  });

  it('rejects rows that indicate legacy SalesTrend fallback', async () => {
    const reader = new InMemoryRetailSalesTrafficTruthReader(
      [
        {
          ...baseDateRow,
          legacySalesTrendFallback: true,
        },
      ],
      []
    );

    await expect(
      runRetailSalesTrafficTruthProof({
        reader,
        query: {
          accountId: 'sourbear',
          marketplace: 'US',
          startDate: '2026-04-12',
          endDate: '2026-04-12',
        },
      })
    ).rejects.toMatchObject({
      code: 'invalid_truth_source',
    } satisfies Partial<RetailSalesTrafficTruthError>);
  });
});
