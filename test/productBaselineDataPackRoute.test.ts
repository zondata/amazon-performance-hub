import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const routePath = path.join(
  process.cwd(),
  'apps/web/src/app/products/[asin]/logbook/ai-data-pack/route.ts'
);

describe('product baseline data pack route filters', () => {
  it('does not use campaign_name_norm ilike scans', () => {
    const source = fs.readFileSync(routePath, 'utf-8');
    expect(source).not.toContain('.ilike("campaign_name_norm"');
    expect(source).not.toContain(".ilike('campaign_name_norm'");
  });

  it('uses campaign_id IN filters with candidate campaign IDs', () => {
    const source = fs.readFileSync(routePath, 'utf-8');
    expect(source).toContain('.in("campaign_id", spCandidateCampaignIds)');
    expect(source).toContain('.in("campaign_id", sbCandidateCampaignIds)');
  });
});
