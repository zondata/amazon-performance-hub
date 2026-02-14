import { describe, expect, it } from "vitest";
import { parseChangeInput, parseExperimentInput } from "../src/logbook/validate";

describe("logbook validation", () => {
  it("rejects experiments missing required fields", () => {
    expect(() => parseExperimentInput({})).toThrow(/name[\s\S]*objective/i);
  });

  it("rejects changes missing required fields", () => {
    expect(() => parseChangeInput({ entities: [] })).toThrow(/channel[\s\S]*change_type[\s\S]*summary/i);
  });

  it("parses entity links with optional ids", () => {
    const result = parseChangeInput({
      channel: "ads",
      change_type: "budget_update",
      summary: "Raised daily budget",
      entities: [
        {
          entity_type: "campaign",
          campaign_id: "123",
          note: "main campaign",
          extra: { foo: "bar" },
        },
        {
          entity_type: "product",
          product_id: "9a0e6a9c-1c7a-4c0f-9a6f-3a2c119bb2b1",
        },
      ],
    });

    expect(result.entities.length).toBe(2);
    expect(result.entities[0].entity_type).toBe("campaign");
    expect(result.entities[0].campaign_id).toBe("123");
    expect(result.entities[0].note).toBe("main campaign");
    expect(result.entities[1].entity_type).toBe("product");
    expect(result.entities[1].product_id).toBe("9a0e6a9c-1c7a-4c0f-9a6f-3a2c119bb2b1");
  });
});
