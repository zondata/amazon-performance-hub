import { describe, expect, it } from "vitest";
import { compareExpectedToActual } from "../src/logbook/validateBulkgenChanges";

describe("logbook bulkgen validation comparison logic", () => {
  it("returns validated when expected fields match actual fields", () => {
    const result = compareExpectedToActual({
      expected: {
        daily_budget: 25,
        state: "enabled",
      },
      actual: {
        daily_budget: "25",
        state: "ENABLED",
      },
    });

    expect(result.status).toBe("validated");
    expect(result.diff_json.mismatches).toEqual([]);
    expect(result.diff_json.matched_fields).toEqual(["daily_budget", "state"]);
  });

  it("returns mismatch with structured diff_json when fields differ", () => {
    const result = compareExpectedToActual({
      expected: {
        bid: 1.2,
        state: "paused",
      },
      actual: {
        bid: 1.5,
        state: "enabled",
      },
    });

    expect(result.status).toBe("mismatch");
    expect(result.diff_json.mismatches.length).toBe(2);
    expect(result.diff_json.mismatches[0]).toHaveProperty("field");
    expect(result.diff_json).toHaveProperty("matched_fields");
    expect(result.diff_json).toHaveProperty("missing_actual_fields");
  });

  it("returns not_found when the entity row is missing", () => {
    const result = compareExpectedToActual({
      expected: {
        percentage: 35,
      },
      actual: null,
    });

    expect(result.status).toBe("not_found");
    expect(result.diff_json.reason).toBe("entity_not_found");
    expect(result.diff_json.missing_actual_fields).toEqual(["percentage"]);
  });
});
