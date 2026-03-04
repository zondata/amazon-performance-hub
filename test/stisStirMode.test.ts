import { describe, expect, it } from "vitest";

import {
  buildPack,
  chooseStisModeInteractivelyIfNeeded,
  detectStisStirAvailability,
  exportStisStirArtifacts,
} from "../apps/web/src/lib/logbook/aiPack/stisStirMode";

describe("detectStisStirAvailability", () => {
  it("returns structured STIS/STIR availability", () => {
    const availability = detectStisStirAvailability({
      stisRowCount: 12,
      stirRowCount: 9,
      campaignCount: 4,
      start: "2026-01-01",
      end: "2026-01-31",
    });

    expect(availability).toEqual({
      stisAvailable: true,
      stirAvailable: true,
      stisRowCount: 12,
      stirRowCount: 9,
      campaignCount: 4,
      start: "2026-01-01",
      end: "2026-01-31",
    });
  });
});

describe("chooseStisModeInteractivelyIfNeeded", () => {
  it("requires an explicit choice when both are available and interactive confirmation is requested", () => {
    const decision = chooseStisModeInteractivelyIfNeeded({
      availability: detectStisStirAvailability({
        stisRowCount: 3,
        stirRowCount: 5,
        campaignCount: 1,
        start: "2026-02-01",
        end: "2026-02-20",
      }),
      requestedMode: null,
      interactiveConfirmRequested: true,
    });

    expect(decision.confirmationRequired).toBe(true);
    expect(decision.mode).toBe("pack");
    expect(decision.source).toBe("confirmation_required");
  });

  it("respects explicit non-interactive mode flags", () => {
    const decision = chooseStisModeInteractivelyIfNeeded({
      availability: detectStisStirAvailability({
        stisRowCount: 8,
        stirRowCount: 7,
        campaignCount: 2,
        start: "2026-02-01",
        end: "2026-02-20",
      }),
      requestedMode: "export",
      interactiveConfirmRequested: false,
    });

    expect(decision.confirmationRequired).toBe(false);
    expect(decision.mode).toBe("export");
    expect(decision.source).toBe("explicit");
  });

  it("defaults to pack mode for non-interactive requests without explicit mode", () => {
    const decision = chooseStisModeInteractivelyIfNeeded({
      availability: detectStisStirAvailability({
        stisRowCount: 8,
        stirRowCount: 7,
        campaignCount: 2,
        start: "2026-02-01",
        end: "2026-02-20",
      }),
      requestedMode: null,
      interactiveConfirmRequested: false,
    });

    expect(decision.confirmationRequired).toBe(false);
    expect(decision.mode).toBe("pack");
    expect(decision.source).toBe("default_non_interactive");
  });

  it("skips prompting when one artifact is missing", () => {
    const decision = chooseStisModeInteractivelyIfNeeded({
      availability: detectStisStirAvailability({
        stisRowCount: 8,
        stirRowCount: 0,
        campaignCount: 2,
        start: "2026-02-01",
        end: "2026-02-20",
      }),
      requestedMode: null,
      interactiveConfirmRequested: true,
    });

    expect(decision.confirmationRequired).toBe(false);
    expect(decision.mode).toBe("pack");
    expect(decision.source).toBe("single_or_missing");
  });
});

describe("buildPack STIS/STIR routing", () => {
  const availability = detectStisStirAvailability({
    stisRowCount: 1,
    stirRowCount: 1,
    campaignCount: 1,
    start: "2026-02-01",
    end: "2026-02-20",
  });
  const exportPaths = exportStisStirArtifacts({
    outputDir: "/products/B0TEST/logbook/ai-data-pack-v3",
    start: "2026-02-01",
    end: "2026-02-20",
    channel: "sp",
    scope: "included",
    format: "ndjson.gz",
  });
  const stisRows = [{ target_key: "a", search_term_impression_share: 0.5 }];
  const stirRows = [{ target_key: "a", search_term_impression_rank: 1 }];

  it("includes both STIS and STIR rows in pack mode", () => {
    const result = buildPack({
      includeStisStir: true,
      mode: "pack",
      decisionSource: "explicit",
      availability,
      stisRows,
      stirRows,
      exportPaths,
    });

    expect(result.stisRowsInPack).toEqual(stisRows);
    expect(result.stirRowsInPack).toEqual(stirRows);
    expect(result.manifest.stis.included_in_pack).toBe(true);
    expect(result.manifest.stir.included_in_pack).toBe(true);
  });

  it("excludes both STIS and STIR rows in export mode", () => {
    const result = buildPack({
      includeStisStir: false,
      mode: "export",
      decisionSource: "explicit",
      availability,
      stisRows,
      stirRows,
      exportPaths,
    });

    expect(result.stisRowsInPack).toBeNull();
    expect(result.stirRowsInPack).toBeNull();
    expect(result.manifest.stis.included_in_pack).toBe(false);
    expect(result.manifest.stir.included_in_pack).toBe(false);
  });

  it("produces exactly two exported artifact paths in export mode", () => {
    const result = buildPack({
      includeStisStir: false,
      mode: "export",
      decisionSource: "explicit",
      availability,
      stisRows,
      stirRows,
      exportPaths,
    });

    const exportedPaths = [
      ...result.manifest.stis.exported_paths,
      ...result.manifest.stir.exported_paths,
    ];
    expect(exportedPaths).toHaveLength(2);
    expect(exportedPaths[0]).toContain("/stis?");
    expect(exportedPaths[1]).toContain("/stir?");
  });
});
