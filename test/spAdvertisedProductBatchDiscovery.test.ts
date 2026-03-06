import { describe, expect, it } from "vitest";

import { pickAdvertisedProductBatchCandidate } from "../src/mapping/db";

describe("pickAdvertisedProductBatchCandidate", () => {
  it("does not require exact upload.exported_at equality and prefers exact coverage on the same exported date", () => {
    const selected = pickAdvertisedProductBatchCandidate({
      uploadExportedAt: "2026-03-02T11:55:53.569Z",
      coverageStart: "2026-02-01",
      coverageEnd: "2026-03-01",
      candidates: [
        {
          exportedAt: "2026-03-02T00:00:00.000Z",
          minDate: "2026-02-01",
          maxDate: "2026-03-01",
          rowCount: 120,
        },
        {
          exportedAt: "2026-03-01T00:00:00.000Z",
          minDate: "2026-02-01",
          maxDate: "2026-02-28",
          rowCount: 110,
        },
      ],
    });

    expect(selected?.exportedAt).toBe("2026-03-02T00:00:00.000Z");
  });

  it("prefers the batch whose coverage best matches the upload window", () => {
    const selected = pickAdvertisedProductBatchCandidate({
      uploadExportedAt: "2026-03-04T08:29:01.640Z",
      coverageStart: "2026-02-04",
      coverageEnd: "2026-03-03",
      candidates: [
        {
          exportedAt: "2026-03-04T00:00:00.000Z",
          minDate: "2026-02-04",
          maxDate: "2026-03-03",
          rowCount: 180,
        },
        {
          exportedAt: "2026-03-03T00:00:00.000Z",
          minDate: "2026-02-05",
          maxDate: "2026-03-03",
          rowCount: 220,
        },
      ],
    });

    expect(selected?.exportedAt).toBe("2026-03-04T00:00:00.000Z");
  });
});
