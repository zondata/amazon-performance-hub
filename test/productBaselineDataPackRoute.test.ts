import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const routePath = path.join(
  process.cwd(),
  'apps/web/src/app/products/[asin]/logbook/ai-data-pack/route.ts'
);
const spTargetingBoundsHelperPath = path.join(
  process.cwd(),
  "apps/web/src/lib/logbook/aiPack/spTargetingBaselineBounds.ts"
);

describe('product baseline data pack route filters', () => {
  it('does not use campaign_name_norm ilike scans', () => {
    const source = fs.readFileSync(routePath, 'utf-8');
    expect(source).not.toContain('.ilike("campaign_name_norm"');
    expect(source).not.toContain(".ilike('campaign_name_norm'");
  });

  it('uses campaign-scoped SP targeting bounds helper and candidate-campaign filters', () => {
    const routeSource = fs.readFileSync(routePath, "utf-8");
    const helperSource = fs.readFileSync(spTargetingBoundsHelperPath, "utf-8");

    expect(routeSource).toContain("loadSpTargetingBaselineDateBounds({");
    expect(routeSource).toContain('.in("campaign_id", sbCandidateCampaignIds)');

    expect(helperSource).toContain('.in("campaign_id", campaignIds)');
    expect(helperSource).toContain('.order("date", { ascending: params.ascending }).limit(1)');
    expect(helperSource).not.toContain("max(");
    expect(helperSource).toContain('.from("sp_advertised_product_daily_fact_latest")');
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
