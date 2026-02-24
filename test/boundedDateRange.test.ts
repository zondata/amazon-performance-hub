import { describe, expect, it } from "vitest";

import { computeBoundedRange } from "../apps/web/src/lib/ads/boundedDateRange";

describe("computeBoundedRange", () => {
  it("uses a 60-day lookback for baseline range", () => {
    const bounded = computeBoundedRange({
      requestedRange: "baseline",
      endDate: "2026-02-19",
    });

    expect(bounded).toEqual({
      startBound: "2025-12-22",
      endBound: "2026-02-19",
    });
  });

  it("adds a safety buffer for 90d range", () => {
    const bounded = computeBoundedRange({
      requestedRange: "90d",
      endDate: "2026-02-19",
    });

    expect(bounded).toEqual({
      startBound: "2025-10-23",
      endBound: "2026-02-19",
    });
  });

  it("caps all-range availability probes to 365 days by default", () => {
    const bounded = computeBoundedRange({
      requestedRange: "all",
      endDate: "2026-02-19",
    });

    expect(bounded).toEqual({
      startBound: "2025-02-20",
      endBound: "2026-02-19",
    });
  });
});
