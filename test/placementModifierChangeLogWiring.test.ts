import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const routePath = path.join(
  process.cwd(),
  "apps/web/src/app/products/[asin]/logbook/ai-data-pack-v3/route.ts"
);

describe("ai-data-pack-v3 placement modifier and refunds wiring", () => {
  it("loads SP placement modifier change log rows and emits them in output", () => {
    const source = fs.readFileSync(routePath, "utf-8");

    expect(source).toContain('.from("sp_placement_modifier_change_log")');
    expect(source).toContain("placement_modifier_change_log:");
  });

  it("selects SI refund fields and emits sales adjustments dataset", () => {
    const source = fs.readFileSync(routePath, "utf-8");

    expect(source).toContain("refund_units");
    expect(source).toContain("refund_cost");
    expect(source).toContain("sales_adjustments_daily:");
  });
});
