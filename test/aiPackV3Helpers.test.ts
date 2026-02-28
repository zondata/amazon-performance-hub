import { describe, expect, it } from "vitest";

import {
  calcCvrOrdersPerClick,
  mapPlacementModifierKey,
  weightedAvgTosIs,
} from "../apps/web/src/lib/logbook/aiPack/aiPackV3Helpers";

describe("aiPackV3Helpers", () => {
  it("uses orders/clicks for CVR", () => {
    const cvr = calcCvrOrdersPerClick(4, 20);
    expect(cvr).toBe(0.2);
  });

  it("computes weighted SP top-of-search impression share", () => {
    const value = weightedAvgTosIs([
      { impressions: 100, share: 0.2 },
      { impressions: 50, share: 0.5 },
      { impressions: 20, share: null },
    ]);
    // (100*0.2 + 50*0.5) / (100 + 50)
    expect(value).toBeCloseTo(0.3, 10);
  });

  it("maps SP placement rows to bulk modifier keys", () => {
    expect(mapPlacementModifierKey("sp", "TOS", "top of search")).toBe("PLACEMENT_TOP");
    expect(mapPlacementModifierKey("sp", "ROS", "rest of search")).toBe(
      "PLACEMENT_REST_OF_SEARCH"
    );
    expect(mapPlacementModifierKey("sp", "PP", "product pages")).toBe(
      "PLACEMENT_PRODUCT_PAGE"
    );
    expect(mapPlacementModifierKey("sp", "OA", "off-amazon")).toBeNull();
    expect(mapPlacementModifierKey("sp", null, "amazon business placements")).toBe(
      "PLACEMENT_AMAZON_BUSINESS"
    );
  });

  it("maps SB placement rows to bulk modifier keys", () => {
    expect(mapPlacementModifierKey("sb", "TOS", "top of search")).toBe("TOS");
    expect(mapPlacementModifierKey("sb", "PP", "product pages")).toBe("DETAIL_PAGE");
    expect(mapPlacementModifierKey("sb", "HOME", "homepage")).toBe("HOME");
    expect(mapPlacementModifierKey("sb", "ROS", "rest of search")).toBe("OTHER");
  });
});
