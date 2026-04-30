import { describe, expect, it } from 'vitest';

import { parseSpSearchTermReport } from './parseSpSearchTermReport';

describe('parseSpSearchTermReport', () => {
  it('parses search term CSV rows and coverage bounds', () => {
    const csv = [
      'Date,Portfolio Name,Campaign Name,Ad Group Name,Targeting,Match Type,Keyword Type,Target Status,Search Term,Impressions,Clicks,Spend,Sales,Orders,Units,CPC,CTR,ACOS,ROAS,Conversion Rate',
      '2026-04-28,Portfolio A,Campaign A,Ad Group A,vitamin c serum,Exact,KEYWORD,enabled,vitamin c serum,100,10,25.00,125.00,5,6,2.50,10.00%,20.00%,5.00,50.00%',
      '2026-04-29,Portfolio A,Campaign A,Ad Group A,vitamin c serum,Exact,KEYWORD,enabled,best vitamin c serum,50,5,12.50,50.00,2,2,2.50,10.00%,25.00%,4.00,40.00%',
    ].join('\n');

    const result = parseSpSearchTermReport(csv);

    expect(result.coverageStart).toBe('2026-04-28');
    expect(result.coverageEnd).toBe('2026-04-29');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      campaign_name_norm: 'campaign a',
      targeting_norm: 'vitamin c serum',
      search_term_norm: 'vitamin c serum',
      impressions: 100,
      clicks: 10,
      spend: 25,
      sales: 125,
      orders: 5,
      units: 6,
      cpc: 2.5,
      ctr: 0.1,
      acos: 0.2,
      roas: 5,
      conversion_rate: 0.5,
    });
  });
});
