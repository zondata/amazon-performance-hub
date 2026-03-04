import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("STIS/STIR route wiring", () => {
  it("adds confirmation and mode handling in v3 data-pack route", () => {
    const routePath = join(
      process.cwd(),
      "apps/web/src/app/products/[asin]/logbook/ai-data-pack-v3/route.ts"
    );
    const source = readFileSync(routePath, "utf8");

    expect(source).toContain("stis_mode_confirmation_required");
    expect(source).toContain("chooseStisModeInteractivelyIfNeeded");
    expect(source).toContain("detectStisStirAvailability");
    expect(source).toContain("stis_stir: stisStirPack.manifest");
  });

  it("supports dedicated STIR download route and metric-aware STIS export", () => {
    const stisRoutePath = join(
      process.cwd(),
      "apps/web/src/app/products/[asin]/logbook/ai-data-pack-v3/stis/route.ts"
    );
    const stirRoutePath = join(
      process.cwd(),
      "apps/web/src/app/products/[asin]/logbook/ai-data-pack-v3/stir/route.ts"
    );
    const stisSource = readFileSync(stisRoutePath, "utf8");
    const stirSource = readFileSync(stirRoutePath, "utf8");

    expect(stisSource).toContain('type Metric = "stis" | "stir" | "both"');
    expect(stisSource).toContain("metricName");
    expect(stirSource).toContain('url.searchParams.set("metric", "stir")');
  });
});
