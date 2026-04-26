import { describe, expect, it } from "vitest";
import {
  parseChangeInput,
  parseChangeOutcomeEvaluationInput,
  parseExperimentInput,
} from "../src/logbook/validate";

describe("logbook validation", () => {
  it("rejects experiments missing required fields", () => {
    expect(() => parseExperimentInput({})).toThrow(/name[\s\S]*objective/i);
  });

  it("rejects changes missing required fields", () => {
    expect(() => parseChangeInput({ entities: [] })).toThrow(/channel[\s\S]*change_type[\s\S]*summary/i);
  });

  it("parses entity links with optional ids", () => {
    const result = parseChangeInput({
      channel: "listing",
      change_type: "title_update",
      summary: "Updated title benefit claim",
      why: "Improve click-through rate on priority query",
      expected_outcome: "CTR improves within two weeks",
      evaluation_window_days: 14,
      notes: "Manual non-ads smoke payload",
      entities: [
        {
          entity_type: "product",
          product_id: "9a0e6a9c-1c7a-4c0f-9a6f-3a2c119bb2b1",
          asin: "b0b2k57w5r",
          sku: "SKU-1",
        },
      ],
    });

    expect(result.expected_outcome).toBe("CTR improves within two weeks");
    expect(result.evaluation_window_days).toBe(14);
    expect(result.notes).toBe("Manual non-ads smoke payload");
    expect(result.entities.length).toBe(1);
    expect(result.entities[0].entity_type).toBe("product");
    expect(result.entities[0].product_id).toBe("9a0e6a9c-1c7a-4c0f-9a6f-3a2c119bb2b1");
    expect(result.entities[0].asin).toBe("B0B2K57W5R");
    expect(result.entities[0].sku).toBe("SKU-1");
  });

  it("parses later change outcome evaluations without mutating the change payload", () => {
    const result = parseChangeOutcomeEvaluationInput({
      change_id: "9a0e6a9c-1c7a-4c0f-9a6f-3a2c119bb2b1",
      evaluated_at: "2026-04-26T00:00:00Z",
      window_start: "2026-04-12",
      window_end: "2026-04-25",
      actual_result: "CTR improved",
      learning: "Benefit claim appears directionally useful",
      notes: "Keep monitoring conversion rate",
      metrics_json: { ctr_delta: 0.02 },
    });

    expect(result.change_id).toBe("9a0e6a9c-1c7a-4c0f-9a6f-3a2c119bb2b1");
    expect(result.actual_result).toBe("CTR improved");
    expect(result.learning).toBe("Benefit claim appears directionally useful");
    expect(result.window_start).toBe("2026-04-12");
  });
});
