import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260426203000_v3_mcp_views.sql"),
  "utf8",
);

describe("V3 Phase 8 MCP views migration", () => {
  it("creates every required MCP view", () => {
    for (const viewName of [
      "v_mcp_sales_traffic_daily",
      "v_mcp_ads_current_settings",
      "v_mcp_ads_performance_daily",
      "v_mcp_ads_performance_hourly",
      "v_mcp_sqp_weekly",
      "v_mcp_sqp_monthly",
      "v_mcp_h10_keyword_rankings",
      "v_mcp_ads_change_logbook",
      "v_mcp_non_ads_change_logbook",
      "v_mcp_data_freshness",
    ]) {
      expect(migrationSql).toContain(`view public.${viewName}`);
    }
  });

  it("does not perform destructive cleanup in the MCP view migration", () => {
    expect(migrationSql.toLowerCase()).not.toContain("drop table");
    expect(migrationSql.toLowerCase()).not.toContain("truncate table");
  });

  it("does not expose direct auth secret columns", () => {
    expect(migrationSql).not.toMatch(/\bauth_secret_ref\b/i);
    expect(migrationSql).not.toMatch(/\brefresh_token\b/i);
    expect(migrationSql).not.toMatch(/\bclient_secret\b/i);
  });
});
