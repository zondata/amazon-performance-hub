import { describe, expect, it } from "vitest";

import {
  computeBaselineWindow,
  computeEndCandidate,
  computeTodayMinusExcludeDays,
} from "../apps/web/src/lib/logbook/aiPack/computeBaselineWindow";

describe("computeBaselineWindow", () => {
  it("uses overlap bounds in all-range mode", () => {
    const window = computeBaselineWindow({
      requestedRange: "all",
      endCandidate: "2025-12-20",
      availability: {
        sales: { minDate: "2025-01-01", maxDate: "2025-12-31" },
        sp_campaign: { minDate: "2025-02-01", maxDate: "2025-10-31" },
        sqp: { minDate: "2025-03-01", maxDate: "2025-09-30" },
      },
    });

    expect(window.overlapStart).toBe("2025-03-01");
    expect(window.overlapEnd).toBe("2025-09-30");
    expect(window.effectiveStart).toBe("2025-03-01");
    expect(window.effectiveEnd).toBe("2025-09-30");
    expect(window.usedFallback).toBe(false);
  });

  it("caps end candidate by today minus exclude days", () => {
    const todayMinus2 = computeTodayMinusExcludeDays(2, new Date("2026-02-21T18:00:00Z"));
    const capped = computeEndCandidate(todayMinus2, "2026-02-25");

    expect(todayMinus2).toBe("2026-02-19");
    expect(capped).toBe("2026-02-19");
  });

  it("ignores missing datasets in overlap calculation", () => {
    const window = computeBaselineWindow({
      requestedRange: "60d",
      endCandidate: "2026-02-19",
      availability: {
        sales: { minDate: "2025-01-01", maxDate: "2026-02-19" },
        sp_campaign: { minDate: "2025-12-01", maxDate: "2026-02-10" },
        ranking: { minDate: null, maxDate: null },
      },
    });

    expect(window.startCandidate).toBe("2025-12-22");
    expect(window.overlapStart).toBe("2025-12-01");
    expect(window.overlapEnd).toBe("2026-02-10");
    expect(window.effectiveStart).toBe("2025-12-22");
    expect(window.effectiveEnd).toBe("2026-02-10");
    expect(window.usedFallback).toBe(false);
  });

  it("builds preset start candidates correctly", () => {
    const availability = {
      sales: { minDate: "2025-01-01", maxDate: "2026-02-19" },
    };

    expect(
      computeBaselineWindow({
        requestedRange: "30d",
        endCandidate: "2026-02-19",
        availability,
      }).startCandidate
    ).toBe("2026-01-21");
    expect(
      computeBaselineWindow({
        requestedRange: "60d",
        endCandidate: "2026-02-19",
        availability,
      }).startCandidate
    ).toBe("2025-12-22");
    expect(
      computeBaselineWindow({
        requestedRange: "90d",
        endCandidate: "2026-02-19",
        availability,
      }).startCandidate
    ).toBe("2025-11-22");
    expect(
      computeBaselineWindow({
        requestedRange: "180d",
        endCandidate: "2026-02-19",
        availability,
      }).startCandidate
    ).toBe("2025-08-24");
  });
});
