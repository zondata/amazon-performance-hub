import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  exportedAtIsoToUtcFolderDate,
  buildSpPlacementReportPath,
  deriveExportedAtFromPath,
} from "../src/cli/spPlacementDateUtils";

describe("spPlacementDateUtils", () => {
  it("converts exported_at ISO to UTC folder date", () => {
    expect(exportedAtIsoToUtcFolderDate("2026-01-05T23:30:00-05:00")).toBe("2026-01-06");
    expect(exportedAtIsoToUtcFolderDate("2026-01-05T01:00:00Z")).toBe("2026-01-05");
  });

  it("builds placement report path from root + folder date", () => {
    const root = "/mnt/d/Dropbox/AmazonReports";
    const expected = path.join(root, "2026-01-05", "Sponsored_Products_Placement_report.xlsx");
    expect(buildSpPlacementReportPath(root, "2026-01-05")).toBe(expected);
  });

  it("derives exported_at from a date segment in path", () => {
    const xlsxPath = path.join(
      "/mnt/d/Dropbox/AmazonReports",
      "2026-01-05",
      "Sponsored_Products_Placement_report.xlsx"
    );
    expect(deriveExportedAtFromPath(xlsxPath)).toBe("2026-01-05T00:00:00Z");
  });
});
