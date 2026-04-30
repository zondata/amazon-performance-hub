import { describe, expect, it } from 'vitest';

import {
  buildSpSearchTermDailyCreateRequestBody,
  normalizeSpSearchTermDailyRows,
} from './spSearchTermDaily';

describe('spSearchTermDaily', () => {
  it('builds the expected Ads API request body', () => {
    expect(
      buildSpSearchTermDailyCreateRequestBody({
        dateRange: { startDate: '2026-04-01', endDate: '2026-04-30' },
      })
    ).toMatchObject({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      configuration: {
        adProduct: 'SPONSORED_PRODUCTS',
        groupBy: ['searchTerm'],
        reportTypeId: 'spSearchTerm',
        timeUnit: 'DAILY',
        format: 'GZIP_JSON',
      },
    });
  });

  it('normalizes downloaded search term rows', () => {
    const rows = normalizeSpSearchTermDailyRows({
      appAccountId: 'sourbear',
      appMarketplace: 'US',
      profileId: '123',
      rawRowsPayload: {
        format: 'json',
        rows: [
          {
            date: '2026-04-29',
            campaignId: '10',
            campaignName: 'Campaign A',
            campaignStatus: 'enabled',
            adGroupId: '20',
            adGroupName: 'Ad Group A',
            keywordId: '30',
            keyword: 'vitamin c serum',
            matchType: 'EXACT',
            keywordType: 'KEYWORD',
            adKeywordStatus: 'enabled',
            searchTerm: 'best vitamin c serum',
            impressions: 100,
            clicks: 12,
            cost: 24,
            costPerClick: 2,
            clickThroughRate: 0.12,
            sales14d: 120,
            purchases14d: 4,
            unitsSoldClicks14d: 5,
            roasClicks14d: 5,
            acosClicks14d: 0.2,
            purchaseClickRate14d: 0.3333,
            campaignBudgetCurrencyCode: 'USD',
          },
        ],
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      campaignId: '10',
      adGroupId: '20',
      targetId: '30',
      targetingExpression: 'vitamin c serum',
      matchType: 'EXACT',
      keywordType: 'KEYWORD',
      targetStatus: 'enabled',
      searchTerm: 'best vitamin c serum',
      cost: 24,
      attributedSales14d: 120,
      attributedConversions14d: 4,
      attributedUnitsOrdered14d: 5,
      currencyCode: 'USD',
    });
  });
});
