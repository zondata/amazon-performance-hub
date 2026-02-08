import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { hashFileSha256, chunkArray } from "../src/ingest/utils";
import { planNameHistoryUpdates } from "../src/ingest/nameHistoryUtils";

describe("ingest utils", () => {
  it("hashFileSha256 is deterministic", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `hash-${Date.now()}.txt`);
    fs.writeFileSync(filePath, "hello world");

    const first = hashFileSha256(filePath);
    const second = hashFileSha256(filePath);
    expect(first).toBe(second);
  });

  it("chunkArray splits deterministically", () => {
    const input = [1, 2, 3, 4, 5];
    const chunks = chunkArray(input, 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("planNameHistoryUpdates detects renames", () => {
    const current = [
      { entityId: "1", nameRaw: "New Name", nameNorm: "new name" },
      { entityId: "2", nameRaw: "Same", nameNorm: "same" },
    ];
    const open = [
      { entityId: "1", nameRaw: "Old Name", nameNorm: "old name", validFrom: "2026-01-01" },
      { entityId: "2", nameRaw: "Same", nameNorm: "same", validFrom: "2026-01-01" },
    ];

    const plan = planNameHistoryUpdates(current, open, "2026-02-01");
    expect(plan.toClose.length).toBe(1);
    expect(plan.toClose[0]?.entityId).toBe("1");
    expect(plan.toClose[0]?.validTo).toBe("2026-01-31");
    expect(plan.toInsert.length).toBe(1);
    expect(plan.toInsert[0]?.entityId).toBe("1");
  });
});
