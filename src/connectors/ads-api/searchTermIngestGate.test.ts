import { describe, expect, it } from 'vitest';

import { buildSearchTermIngestGateCsv } from './searchTermIngestGate';

describe('searchTermIngestGate', () => {
  it('renders CSV rows in the legacy ingest shape', () => {
    const csv = buildSearchTermIngestGateCsv({
      gateRunId: '2026-04-30T10:00:00.000Z',
      searchTermRows: [
        {
          appAccountId: 'sourbear',
          appMarketplace: 'US',
          profileId: '123',
          campaignId: '10',
          campaignName: 'Campaign A',
          campaignStatus: 'enabled',
          adGroupId: '20',
          adGroupName: 'Ad Group A',
          targetId: '30',
          targetingExpression: 'vitamin c serum',
          matchType: 'EXACT',
          keywordType: 'KEYWORD',
          targetStatus: 'enabled',
          searchTerm: 'best vitamin c serum',
          date: '2026-04-29',
          impressions: 100,
          clicks: 10,
          cost: 20,
          costPerClick: 2,
          clickThroughRate: 0.1,
          attributedSales14d: 100,
          attributedConversions14d: 4,
          attributedUnitsOrdered14d: 5,
          roasClicks14d: 5,
          acosClicks14d: 0.2,
          purchaseClickRate14d: 0.4,
          currencyCode: 'USD',
        },
      ],
    });

    expect(csv).toContain('Search Term');
    expect(csv).toContain('best vitamin c serum');
    expect(csv).toContain('vitamin c serum');
  });
});
