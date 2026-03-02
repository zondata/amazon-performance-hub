import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveRepoRoot } from "../apps/web/src/lib/logbook/runBulkgenValidation";

describe("resolveRepoRoot", () => {
  it("resolves monorepo root when starting from apps/web", () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(testDir, "..");
    const webDir = path.join(repoRoot, "apps", "web");

    expect(fs.realpathSync(resolveRepoRoot(webDir))).toBe(fs.realpathSync(repoRoot));
  });
});
