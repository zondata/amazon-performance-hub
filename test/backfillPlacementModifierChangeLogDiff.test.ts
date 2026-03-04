import { describe, expect, it } from "vitest";

import { diffPlacementModifierUpdates } from "../src/backfill/spPlacementModifierChangeLogDiff";

describe("diffPlacementModifierUpdates", () => {
  it("returns only updated campaign/placement pairs where both sides exist", () => {
    const previousRows = [
      {
        campaign_id: "C1",
        placement_code: "TOS",
        placement_raw: "Top of search",
        percentage: 10,
      },
      {
        campaign_id: "C1",
        placement_code: "ROS",
        placement_raw: "Rest of search",
        percentage: 20,
      },
      {
        campaign_id: "C2",
        placement_code: "PP",
        placement_raw: "Product pages",
        percentage: 30,
      },
    ];

    const currentRows = [
      {
        campaign_id: "C1",
        placement_code: "TOS",
        placement_raw: "Top of search",
        percentage: 15,
      },
      {
        campaign_id: "C1",
        placement_code: "ROS",
        placement_raw: "Rest of search",
        percentage: 20,
      },
      {
        campaign_id: "C2",
        placement_code: "PP",
        placement_raw: "Product pages",
        percentage: 30,
      },
      {
        campaign_id: "C3",
        placement_code: "TOS",
        placement_raw: "Top of search",
        percentage: 25,
      },
    ];

    expect(diffPlacementModifierUpdates(previousRows, currentRows)).toEqual([
      {
        campaign_id: "C1",
        placement_code: "TOS",
        placement_raw: "Top of search",
        old_pct: 10,
        new_pct: 15,
      },
    ]);
  });

  it("skips rows with missing/non-numeric percentages", () => {
    const previousRows = [
      {
        campaign_id: "C1",
        placement_code: "TOS",
        placement_raw: "Top of search",
        percentage: "12",
      },
      {
        campaign_id: "C1",
        placement_code: "ROS",
        placement_raw: "Rest of search",
        percentage: null,
      },
    ];
    const currentRows = [
      {
        campaign_id: "C1",
        placement_code: "TOS",
        placement_raw: "Top of search",
        percentage: "not-a-number",
      },
      {
        campaign_id: "C1",
        placement_code: "ROS",
        placement_raw: "Rest of search",
        percentage: 50,
      },
    ];

    expect(diffPlacementModifierUpdates(previousRows, currentRows)).toEqual([]);
  });
});
