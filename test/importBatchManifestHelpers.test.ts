import { describe, expect, it } from "vitest";
import { resolveSalesTrendAsinOverrideFromManifestItem } from "../src/cli/importBatchManifestHelpers";

describe("resolveSalesTrendAsinOverrideFromManifestItem", () => {
  it("uses explicit asin_override when provided", () => {
    expect(
      resolveSalesTrendAsinOverrideFromManifestItem({
        original_filename: "temp-upload.csv",
        asin_override: "b0fyprwpn1",
      })
    ).toBe("B0FYPRWPN1");
  });

  it("falls back to ASIN parsed from original_filename", () => {
    expect(
      resolveSalesTrendAsinOverrideFromManifestItem({
        original_filename: "B0B2K57W5R SalesTrend.csv",
      })
    ).toBe("B0B2K57W5R");
  });

  it("returns undefined when override and filename ASIN are missing", () => {
    expect(
      resolveSalesTrendAsinOverrideFromManifestItem({
        original_filename: "SalesTrend.csv",
      })
    ).toBeUndefined();
  });
});
