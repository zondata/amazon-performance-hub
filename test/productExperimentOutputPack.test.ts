import { describe, expect, it } from "vitest";
import {
  parseProductExperimentOutputPack,
  PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND,
} from "../apps/web/src/lib/logbook/aiPack/parseProductExperimentOutputPack";

describe("product experiment output pack parser", () => {
  it("rejects missing required experiment fields", () => {
    const result = parseProductExperimentOutputPack(
      JSON.stringify({
        kind: PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND,
        product: { asin: "B0TEST12345" },
        experiment: {
          scope: { status: "planned" },
        },
      }),
      "B0TEST12345"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/experiment\.name/i);
      expect(result.error).toMatch(/experiment\.objective/i);
    }
  });

  it("rejects ASIN mismatch", () => {
    const result = parseProductExperimentOutputPack(
      JSON.stringify({
        kind: PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND,
        product: { asin: "B0OTHER0000" },
        experiment: {
          name: "Test",
          objective: "Test objective",
          scope: { status: "planned" },
        },
      }),
      "B0TEST12345"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/must match route ASIN/i);
    }
  });

  it("rejects invalid actions shape", () => {
    const result = parseProductExperimentOutputPack(
      JSON.stringify({
        kind: PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND,
        product: { asin: "B0TEST12345" },
        experiment: {
          name: "Budget test",
          objective: "Grow sales",
          scope: {
            status: "planned",
            bulkgen_plans: [
              {
                channel: "SP",
                generator: "bulkgen:sp:update",
                run_id: "exp-sp-001",
                actions: [{ type: "update_campaign_budget", new_budget: 25 }],
              },
            ],
          },
        },
      }),
      "B0TEST12345"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/campaign_id/i);
    }
  });
});
