import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listDateFolders, selectDateFoldersInRange } from "../src/pipeline/backfillAds";

function makeDir(root: string, name: string) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe("backfillAds date folder selection", () => {
  it("lists only date-formatted folders and sorts ascending", () => {
    const root = path.resolve(__dirname, "tmp", `backfill-${Date.now()}`);
    fs.mkdirSync(root, { recursive: true });
    makeDir(root, "2025-01-02");
    makeDir(root, "2025-01-01");
    makeDir(root, "notes");
    fs.writeFileSync(path.join(root, "2025-01-03"), "file");

    const folders = listDateFolders(root);
    expect(folders.map((f) => f.date)).toEqual(["2025-01-01", "2025-01-02"]);
  });

  it("selects folders within inclusive range", () => {
    const root = path.resolve(__dirname, "tmp", `backfill-range-${Date.now()}`);
    fs.mkdirSync(root, { recursive: true });
    makeDir(root, "2025-01-01");
    makeDir(root, "2025-01-05");
    makeDir(root, "2025-01-10");

    const folders = listDateFolders(root);
    const selected = selectDateFoldersInRange(folders, "2025-01-02", "2025-01-09");
    expect(selected.map((f) => f.date)).toEqual(["2025-01-05"]);
  });
});
