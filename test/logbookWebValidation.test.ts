import { describe, expect, it } from "vitest";
import {
  safeParseJson,
  validateChangePayload,
  validateExperimentPayload,
} from "../apps/web/src/lib/logbook/validation";

describe("logbook web validation", () => {
  it("flags missing experiment fields", () => {
    const result = validateExperimentPayload({});
    expect(result.errors.join(" ")).toMatch(/name/);
    expect(result.errors.join(" ")).toMatch(/objective/);
  });

  it("flags missing change fields", () => {
    const result = validateChangePayload({});
    expect(result.errors.join(" ")).toMatch(/channel/);
    expect(result.errors.join(" ")).toMatch(/change_type/);
    expect(result.errors.join(" ")).toMatch(/summary/);
  });

  it("parses JSON safely", () => {
    const ok = safeParseJson("{\"a\":1}", "Test");
    expect(ok.error).toBeUndefined();
    expect(ok.value).toEqual({ a: 1 });

    const bad = safeParseJson("{", "Test");
    expect(bad.error).toMatch(/JSON/);
  });
});
