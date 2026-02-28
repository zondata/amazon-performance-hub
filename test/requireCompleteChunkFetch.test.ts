import { describe, expect, it } from "vitest";

import { PackIncompleteError } from "../apps/web/src/lib/logbook/aiPack/PackIncompleteError";
import { requireCompleteChunkFetch } from "../apps/web/src/lib/logbook/aiPack/requireCompleteChunkFetch";

describe("requireCompleteChunkFetch", () => {
  it("throws PackIncompleteError when any chunk failed", () => {
    const result = {
      rows: [{ id: 1 }],
      chunkErrors: [
        {
          chunkStart: "2026-01-01",
          chunkEnd: "2026-01-07",
          message: "canceling statement due to statement timeout",
          timedOut: true,
        },
      ],
      stats: {
        chunksTotal: 4,
        chunksSucceeded: 3,
        chunksFailed: 1,
        retriesUsedMax: 1,
        failedRangesCount: 1,
        failedRangesSample: [
          {
            chunkStart: "2026-01-01",
            chunkEnd: "2026-01-07",
            message: "canceling statement due to statement timeout",
          },
        ],
      },
    };

    expect(() =>
      requireCompleteChunkFetch({
        label: "SP reconciliation rows",
        result,
      })
    ).toThrow(PackIncompleteError);
  });

  it("returns rows when no chunk failed", () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const result = {
      rows,
      chunkErrors: [],
      stats: {
        chunksTotal: 2,
        chunksSucceeded: 2,
        chunksFailed: 0,
        retriesUsedMax: 0,
        failedRangesCount: 0,
        failedRangesSample: [],
      },
    };

    expect(
      requireCompleteChunkFetch({
        label: "SB campaign baseline",
        result,
      })
    ).toEqual(rows);
  });
});
