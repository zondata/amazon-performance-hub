import { describe, expect, it } from "vitest";
import { dedupeFactRows, getOnConflictColumns } from "../src/mapping_sb/upsert";

describe("sb upsert helpers", () => {
  it("returns correct onConflict columns", () => {
    expect(getOnConflictColumns("sb_campaign")).toBe("account_id,upload_id,date,campaign_id");
    expect(getOnConflictColumns("sb_campaign_placement")).toBe(
      "account_id,upload_id,date,campaign_id,placement_code,placement_raw_norm"
    );
    expect(getOnConflictColumns("sb_keyword")).toBe(
      "account_id,upload_id,date,campaign_id,ad_group_id,target_id"
    );
    expect(getOnConflictColumns("sb_stis")).toBe(
      "account_id,upload_id,date,campaign_id,ad_group_id,target_key,customer_search_term_norm"
    );
  });

  it("dedupes sb_campaign rows by unique key", () => {
    const rows = [
      {
        account_id: "a1",
        upload_id: "u1",
        date: "2025-01-01",
        campaign_id: "c1",
        spend: 1,
      },
      {
        account_id: "a1",
        upload_id: "u1",
        date: "2025-01-01",
        campaign_id: "c1",
        spend: 2,
      },
    ];
    const deduped = dedupeFactRows("sb_campaign", rows as never);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.spend).toBe(2);
  });
});
