import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const sourcePath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads/getSpWorkspaceData.ts'
);

describe('sp workspace campaign data wiring', () => {
  it('uses gold campaign facts and chunked loading for the campaigns tab', () => {
    const source = fs.readFileSync(sourcePath, 'utf-8');

    expect(source).toContain("from('sp_campaign_daily_fact_latest_gold')");
    expect(source).toContain('fetchCampaignRowsChunked');
    expect(source).toContain('CAMPAIGN_CHUNK_DAYS');
    expect(source).not.toContain("from('sp_campaign_daily_fact_latest')");
    expect(source).not.toContain('fetchAllRows<SpCampaignFactRow>');
  });
});
