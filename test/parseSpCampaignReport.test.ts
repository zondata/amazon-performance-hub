import { describe, it, expect } from "vitest";
import { parseSpCampaignReport } from "../src/ads/parseSpCampaignReport";

const CSV = `\uFEFFStart Date,End Date,Start Time,Portfolio name,Campaign Name,Impressions,Clicks,Spend,"7 Day Total Orders (#)","7 Day Total Sales ",Units
2026-01-01,2026-01-01,00:00,Brand A,Campaign One,"1,234",12,"$1,234.56",3,"2,345.00",4
2026-01-01,2026-01-01,01:00,Brand A,Campaign One,100,5,12.34,0,0,0
2026-01-02,2026-01-02,02:00,,Campaign Two,50,2,$0,1,0,1
`;

describe("parseSpCampaignReport", () => {
  it("parses rows, money, and coverage range", () => {
    const result = parseSpCampaignReport(CSV);
    expect(result.rows.length).toBe(3);
    expect(result.coverageStart).toBe("2026-01-01");
    expect(result.coverageEnd).toBe("2026-01-02");

    const first = result.rows[0];
    expect(first.campaign_name_norm).toBe("campaign one");
    expect(first.impressions).toBe(1234);
    expect(first.spend).toBe(1234.56);
    expect(first.sales).toBe(2345);
    expect(first.startTime).toBe("00:00");

    const third = result.rows[2];
    expect(third.portfolio_name_raw).toBeNull();
    expect(third.spend).toBe(0);
    expect(third.startTime).toBe("02:00");
  });
});
