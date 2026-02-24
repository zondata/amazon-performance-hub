import { describe, expect, it } from "vitest";

import { fetchByDateChunks } from "../apps/web/src/lib/logbook/aiPack/fetchByDateChunks";

describe("fetchByDateChunks", () => {
  it("splits date windows into inclusive chunks", async () => {
    const calls: Array<{ start: string; end: string }> = [];
    const result = await fetchByDateChunks<string>({
      startDate: "2026-01-01",
      endDate: "2026-01-20",
      chunkDays: 7,
      runChunk: async (chunkStart, chunkEnd) => {
        calls.push({ start: chunkStart, end: chunkEnd });
        return [`${chunkStart}..${chunkEnd}`];
      },
    });

    expect(calls).toEqual([
      { start: "2026-01-01", end: "2026-01-07" },
      { start: "2026-01-08", end: "2026-01-14" },
      { start: "2026-01-15", end: "2026-01-20" },
    ]);
    expect(result.rows).toEqual([
      "2026-01-01..2026-01-07",
      "2026-01-08..2026-01-14",
      "2026-01-15..2026-01-20",
    ]);
    expect(result.chunkErrors).toEqual([]);
    expect(result.totalChunks).toBe(3);
    expect(result.failedChunks).toBe(0);
  });

  it("continues after chunk errors and returns successful rows", async () => {
    const result = await fetchByDateChunks<string>({
      startDate: "2026-01-01",
      endDate: "2026-01-20",
      chunkDays: 7,
      runChunk: async (chunkStart, chunkEnd) => {
        if (chunkStart === "2026-01-08") {
          throw new Error("canceling statement due to statement timeout");
        }
        return [`${chunkStart}..${chunkEnd}`];
      },
    });

    expect(result.rows).toEqual(["2026-01-01..2026-01-07", "2026-01-15..2026-01-20"]);
    expect(result.chunkErrors).toEqual([
      {
        chunkStart: "2026-01-08",
        chunkEnd: "2026-01-14",
        message: "canceling statement due to statement timeout",
        timedOut: true,
      },
    ]);
    expect(result.totalChunks).toBe(3);
    expect(result.failedChunks).toBe(1);
  });

  it("increases chunk size for very large windows to cap chunk count", async () => {
    const calls: Array<{ start: string; end: string }> = [];
    const result = await fetchByDateChunks<null>({
      startDate: "2024-01-01",
      endDate: "2026-12-31",
      chunkDays: 7,
      runChunk: async (chunkStart, chunkEnd) => {
        calls.push({ start: chunkStart, end: chunkEnd });
        return [];
      },
    });

    expect(calls[0]).toEqual({ start: "2024-01-01", end: "2024-01-30" });
    expect(calls[1]).toEqual({ start: "2024-01-31", end: "2024-02-29" });
    expect(result.totalChunks).toBeLessThanOrEqual(60);
    expect(result.chunkErrors).toEqual([]);
  });
});
