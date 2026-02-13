import { describe, it, expect } from "vitest";
import { parseHelium10KeywordTracker } from "../src/ranking/parseHelium10KeywordTracker";

const CSV = `Title,ASIN,Keyword Sales,Keyword,Marketplace,Search Volume,Organic Rank,Sponsored Position,Date Added
"Vitamin C Serum",B0B2K57W5R,120,vitamin c serum,amazon.com,2000,54,4,2026-02-10 11:05:30
"Vitamin C Serum",B0B2K57W5R,-,retinol serum,amazon.com,-,>306,>96,2026-02-10 13:45:10
"Vitamin C Serum",B0B2K57W5R,8,hyaluronic acid,amazon.com,400,-,-,2/11/2026 4:01 PM
`;

describe("parseHelium10KeywordTracker", () => {
  it("parses rank fields (exact/gte/missing) and numeric nullable fields", () => {
    const result = parseHelium10KeywordTracker(CSV);
    expect(result.rows.length).toBe(3);

    const first = result.rows[0];
    expect(first.keyword_sales).toBe(120);
    expect(first.search_volume).toBe(2000);
    expect(first.organic_rank_kind).toBe("exact");
    expect(first.organic_rank_value).toBe(54);
    expect(first.sponsored_pos_kind).toBe("exact");
    expect(first.sponsored_pos_value).toBe(4);

    const second = result.rows[1];
    expect(second.keyword_sales).toBeNull();
    expect(second.search_volume).toBeNull();
    expect(second.organic_rank_kind).toBe("gte");
    expect(second.organic_rank_value).toBe(306);
    expect(second.sponsored_pos_kind).toBe("gte");
    expect(second.sponsored_pos_value).toBe(96);

    const third = result.rows[2];
    expect(third.organic_rank_kind).toBe("missing");
    expect(third.organic_rank_value).toBeNull();
    expect(third.sponsored_pos_kind).toBe("missing");
    expect(third.sponsored_pos_value).toBeNull();
  });

  it("parses observed_at and observed_date, coverage range, and normalized keyword", () => {
    const result = parseHelium10KeywordTracker(CSV);
    expect(result.coverageStart).toBe("2026-02-10");
    expect(result.coverageEnd).toBe("2026-02-11");
    expect(result.rows[0].observed_at).toBe("2026-02-10 11:05:30");
    expect(result.rows[2].observed_at).toBe("2026-02-11 16:01:00");
    expect(result.rows[0].observed_date).toBe("2026-02-10");
    expect(result.rows[0].keyword_norm).toBe("vitamin c serum");
    expect(result.asin).toBe("B0B2K57W5R");
    expect(result.marketplace_domain_raw).toBe("amazon.com");
  });

  it("throws on mixed ASIN rows", () => {
    const mixed = `Title,ASIN,Keyword Sales,Keyword,Marketplace,Search Volume,Organic Rank,Sponsored Position,Date Added
x,B0B2K57W5R,1,k1,amazon.com,1,1,1,2026-02-10 00:00:00
x,B0FYPRWPN1,1,k2,amazon.com,1,1,1,2026-02-10 01:00:00
`;

    expect(() => parseHelium10KeywordTracker(mixed)).toThrow(/multiple ASINs/i);
  });
});
