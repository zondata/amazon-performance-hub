import { describe, expect, it } from "vitest";
import { buildSpUpdateActions } from "../apps/web/src/lib/bulksheets/actionBuilders";

describe("bulksheet action builders", () => {
  it("maps sp update rows into actions", () => {
    const actions = buildSpUpdateActions([
      {
        type: "update_campaign_budget",
        campaign_id: "123",
        new_budget: "25",
      },
    ]);

    expect(actions).toEqual([
      {
        type: "update_campaign_budget",
        campaign_id: "123",
        new_budget: 25,
      },
    ]);
  });
});
