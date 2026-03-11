import { describe, expect, it } from "vitest";
import { buildSpStisAutoTargetBridge } from "../src/mapping/db";

describe("buildSpStisAutoTargetBridge", () => {
  it("keeps only auto targeting rows and dedupes target ids per date/campaign/ad group key", () => {
    const bridge = buildSpStisAutoTargetBridge([
      {
        date: "2025-01-01",
        campaign_id: "c1",
        ad_group_id: "ag1",
        target_id: "t1",
        targeting_norm: "close-match",
      },
      {
        date: "2025-01-01",
        campaign_id: "c1",
        ad_group_id: "ag1",
        target_id: "t1",
        targeting_norm: "close-match",
      },
      {
        date: "2025-01-01",
        campaign_id: "c1",
        ad_group_id: "ag1",
        target_id: "t2",
        targeting_norm: "substitutes",
      },
      {
        date: "2025-01-01",
        campaign_id: "c1",
        ad_group_id: "ag2",
        target_id: "t3",
        targeting_norm: "manual-keyword",
      },
      {
        date: "2025-01-02",
        campaign_id: "c1",
        ad_group_id: "ag1",
        target_id: null,
        targeting_norm: "complements",
      },
    ]);

    expect(bridge.get("2025-01-01::c1::ag1")).toEqual(["t1", "t2"]);
    expect(bridge.has("2025-01-01::c1::ag2")).toBe(false);
    expect(bridge.has("2025-01-02::c1::ag1")).toBe(false);
  });
});
