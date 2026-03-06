import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sourcePath = path.join(process.cwd(), "src/mapping/db.ts");

describe("sp advertised product remap wiring", () => {
  it("remaps against account_id + exported_at instead of requiring upload_id on the fact table", () => {
    const source = fs.readFileSync(sourcePath, "utf-8");

    expect(source).toContain('"sp_advertised_product_daily_fact"');
    expect(source).toContain("discoverAdvertisedProductBatch");
    expect(source).toContain("coverageStart: upload.coverage_start");
    expect(source).toContain("coverageEnd: upload.coverage_end");
    expect(source).toContain("clearExistingAdvertisedProductFacts(upload.account_id, advertisedBatchExportedAt)");
    expect(source).toContain("exportedAt: advertisedBatchExportedAt");
    expect(source).not.toContain('.from("sp_advertised_product_daily_fact")\n    .delete()\n    .eq("upload_id"');
  });
});
