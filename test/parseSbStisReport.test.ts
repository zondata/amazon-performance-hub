import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { parseSbStisReport } from "../src/ads/parseSbStisReport";

function writeStisCsv(filePath: string) {
  const content = [
    [
      "Date",
      "Portfolio Name",
      "Campaign Name",
      "Ad Group Name",
      "Keyword Text",
      "Match Type",
      "Customer Search Term",
      "Search Term Impression Rank",
      "Search Term Impression Share",
      "Impressions",
      "Clicks",
      "Spend",
      "Sales",
      "Orders",
      "Units",
      "CPC",
      "CTR",
      "ACOS",
      "ROAS",
      "Conversion Rate",
    ].join(","),
    [
      "2026-01-01",
      "Brand A",
      "Campaign One",
      "Adgroup A",
      "blue widgets",
      "Exact",
      "blue widgets",
      "1",
      "12.5%",
      "1234",
      "12",
      "1234.56",
      "2345.00",
      "3",
      "4",
      "2.34",
      "0.98%",
      "28.6%",
      "3.50",
      "10.0%",
    ].join(","),
    [
      "\"Jan 2, 2026\"",
      "Brand A",
      "Campaign One",
      "Adgroup A",
      "red widgets",
      "-",
      "red widgets",
      "2",
      "1.00%",
      "100",
      "5",
      "12.34",
      "0",
      "0",
      "0",
      "1.23",
      "1.00%",
      "0%",
      "0",
      "0%",
    ].join(","),
  ].join("\n");

  fs.writeFileSync(filePath, content, "utf8");
}

describe("parseSbStisReport", () => {
  it("parses match types, percents, and coverage range", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `sb-stis-${Date.now()}.csv`);
    writeStisCsv(filePath);

    const result = parseSbStisReport(filePath);
    expect(result.rows.length).toBe(2);
    expect(result.coverageStart).toBe("2026-01-01");
    expect(result.coverageEnd).toBe("2026-01-02");

    const first = result.rows[0];
    expect(first.search_term_impression_share).toBeCloseTo(0.125, 6);
    expect(first.match_type_norm).toBe("EXACT");

    const second = result.rows[1];
    expect(second.match_type_raw).toBe("-");
    expect(second.match_type_norm).toBe("UNKNOWN");
  });
});
