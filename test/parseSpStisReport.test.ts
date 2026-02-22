import { describe, it, expect } from "vitest";
import { parseSpStisReport } from "../src/ads/parseSpStisReport";

const CSV = `Date,Portfolio Name,Campaign Name,Ad Group Name,Targeting,Match Type,Customer Search Term,Search Term Impression Rank,Search Term Impression Share,Impressions,Clicks,Spend,Sales,Orders,Units,CTR,ACOS,Conversion Rate
"Jan 05, 2026",Brand A,Campaign One,Ad Group One,blue shoes,Exact,blue running shoes,1,45%,"1,234",12,"$1,234.56",2345.00,3,4,0.98%,28.6%,12.5%
"Jan 06, 2026",,Campaign Two,Ad Group Two,red shoes,Phrase,red shoes,2,,100,5,12.34,0,0,0,,0%,0%
"Jan 07, 2026",Brand A,Campaign Two,Ad Group Two,"category=""123""",-,category search,3,1.00%,80,4,10.00,12.00,1,1,5.00%,83.33%,25.0%
`;

describe("parseSpStisReport", () => {
  it("parses percent/money and coverage range", () => {
    const result = parseSpStisReport(CSV);
    expect(result.rows.length).toBe(2);
    expect(result.coverageStart).toBe("2026-01-05");
    expect(result.coverageEnd).toBe("2026-01-06");

    const first = result.rows[0];
    expect(first.customer_search_term_norm).toBe("blue running shoes");
    expect(first.search_term_impression_share).toBeCloseTo(0.45, 6);
    expect(first.spend).toBe(1234.56);
    expect(first.ctr).toBeCloseTo(0.0098, 6);
    expect(first.acos).toBeCloseTo(0.286, 6);
    expect(first.conversion_rate).toBeCloseTo(0.125, 6);

    const second = result.rows[1];
    expect(second.portfolio_name_raw).toBeNull();
    expect(second.search_term_impression_share).toBeNull();
    expect(second.ctr).toBeNull();
    expect(result.rows.some((row) => row.targeting_norm === 'category="123"')).toBe(false);
  });
});
