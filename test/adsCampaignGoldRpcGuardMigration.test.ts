import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260228160000_ads_campaign_gold_rpc_guard_fix.sql"
);

const functionNames = [
  "refresh_sp_campaign_hourly_fact_gold",
  "refresh_sb_campaign_daily_fact_gold",
  "refresh_sd_campaign_daily_fact_gold",
  "rebuild_sp_campaign_hourly_fact_gold",
  "rebuild_sb_campaign_daily_fact_gold",
  "rebuild_sd_campaign_daily_fact_gold",
];

describe("ads campaign gold rpc guard migration", () => {
  it("uses auth.role() guard for all gold refresh/rebuild RPCs", () => {
    const source = fs.readFileSync(migrationPath, "utf-8");
    const authRoleGuard = "if auth.role() <> 'service_role' then";
    const authRoleGuardCount = source.split(authRoleGuard).length - 1;

    for (const functionName of functionNames) {
      expect(source).toContain(`create or replace function public.${functionName}`);
    }
    expect(authRoleGuardCount).toBe(6);
    expect(source).not.toContain("request.jwt.claim.role");
  });
});
