import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const routePaths = [
  path.join(process.cwd(), "apps/web/src/app/products/[asin]/logbook/ai-data-pack/route.ts"),
  path.join(process.cwd(), "apps/web/src/app/products/[asin]/logbook/ai-data-pack-v3/route.ts"),
];

describe("product baseline data pack gold routes", () => {
  it("uses gold campaign views for reconciliation and mapped spend", () => {
    for (const routePath of routePaths) {
      const source = fs.readFileSync(routePath, "utf-8");
      expect(source).toContain("sp_campaign_daily_fact_latest_gold");
      expect(source).toContain("sb_campaign_daily_fact_latest_gold");
      expect(source).toContain("sd_campaign_daily_fact_latest_gold");
      expect(source).not.toContain('.from("ads_campaign_daily_fact_latest")');
      expect(source).not.toContain('.from("sp_campaign_daily_fact_latest")');
    }
  });

  it("enforces pack_incomplete flow without partial fallback text", () => {
    for (const routePath of routePaths) {
      const source = fs.readFileSync(routePath, "utf-8");
      expect(source).toContain("requireCompleteChunkFetch");
      expect(source).toContain('status: "pack_incomplete"');
      expect(source).not.toContain("using successful chunks only");
    }
  });
});
