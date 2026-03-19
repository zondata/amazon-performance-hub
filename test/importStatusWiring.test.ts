import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const cliPath = path.join(process.cwd(), "src/cli/importBatchFromManifest.ts");
const uploaderPath = path.join(
  process.cwd(),
  "apps/web/src/components/imports/ImportBatchUploader.tsx"
);
const healthPath = path.join(
  process.cwd(),
  "apps/web/src/lib/health/getDataHealth.ts"
);

describe("import status visibility wiring", () => {
  it("distinguishes not_required from skipped in the batch CLI and uploader", () => {
    const cliSource = fs.readFileSync(cliPath, "utf-8");
    const uploaderSource = fs.readFileSync(uploaderPath, "utf-8");

    expect(cliSource).toContain('status: "ok" | "not_required" | "missing_snapshot" | "skipped" | "error"');
    expect(cliSource).toContain('status: "not_required"');
    expect(cliSource).toContain("No mapping step required for this source type.");
    expect(cliSource).toContain(
      "Mapping skipped because ingest status was already ingested and this flow did not remap the existing upload."
    );
    expect(cliSource).toContain("Mapping skipped because ingest failed.");
    expect(cliSource).toContain("Mapping skipped because upload_id was not returned from ingest.");
    expect(cliSource).toContain("await persistItemStatus({ accountId, item: summaryItem });");
    expect(uploaderSource).toContain("Ingest OK");
    expect(uploaderSource).toContain("No mapping required");
    expect(uploaderSource).toContain("Map problems");
    expect(uploaderSource).toContain("Ingest status");
    expect(uploaderSource).toContain("Map status");
    expect(uploaderSource).toContain("Details");
  });

  it("includes sp_advertised_product in the SP mapping-issues summary", () => {
    const healthSource = fs.readFileSync(healthPath, "utf-8");

    expect(healthSource).toContain("'sp_advertised_product'");
  });
});
