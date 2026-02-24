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

  it("does not query SP campaign baseline min/max availability", () => {
    const source = fs.readFileSync(routePath, "utf-8");
    expect(source).not.toContain('"SP campaign baseline"');
    expect(source).not.toMatch(
      /from\("sp_campaign_daily_fact_latest"\)[\s\S]{0,160}select\("date"\)/
    );
  });

  it("includes attribution aliases and notes in ads_baseline output", () => {
    const source = fs.readFileSync(routePath, "utf-8");
    expect(source).toContain("si_ppc_cost_attributed_total");
    expect(source).toContain("reconciliation_daily_campaigns");
    expect(source).toContain("attribution_model");
  });

  it("keeps warnings backward-compatible while adding severity-coded messages", () => {
    const source = fs.readFileSync(routePath, "utf-8");
    expect(source).toContain("const warnings = legacyWarningsFromMessages(messages)");
    expect(source).toContain("messages,");
    expect(source).toContain("warnings,");
  });
});
