import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260225120000_sp_advertised_product_daily.sql"
);

describe("sp advertised product migration", () => {
  it("creates the SP advertised product fact table and latest view", () => {
    const source = fs.readFileSync(migrationPath, "utf-8");
    expect(source).toContain("create table if not exists sp_advertised_product_daily_fact");
    expect(source).toContain("create or replace view sp_advertised_product_daily_fact_latest");
  });
});
