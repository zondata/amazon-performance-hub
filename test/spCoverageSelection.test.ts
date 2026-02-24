import { describe, expect, it } from "vitest";

import { selectSpRowsForCoverage } from "../apps/web/src/lib/logbook/aiPack/spCoverageSelection";

describe("selectSpRowsForCoverage", () => {
  it("includes enough campaigns and targets to reach 95% spend coverage", () => {
    const campaignRows = [
      { campaign_id: "C1", spend: 400 },
      { campaign_id: "C2", spend: 300 },
      { campaign_id: "C3", spend: 260 },
      { campaign_id: "C4", spend: 40 },
    ];
    const targetRows = [
      { target_id: "T1", campaign_id: "C1", spend: 220 },
      { target_id: "T2", campaign_id: "C1", spend: 180 },
      { target_id: "T3", campaign_id: "C2", spend: 160 },
      { target_id: "T4", campaign_id: "C2", spend: 140 },
      { target_id: "T5", campaign_id: "C3", spend: 130 },
      { target_id: "T6", campaign_id: "C3", spend: 130 },
      { target_id: "T7", campaign_id: "C4", spend: 40 },
    ];

    const result = selectSpRowsForCoverage({
      mappedSpendTotal: 1000,
      campaignRows,
      targetRows,
      campaignLimit: 50,
      targetLimit: 500,
      coverageThreshold: 0.95,
    });

    expect(result.campaigns.map((row) => row.campaign_id)).toEqual(["C1", "C2", "C3"]);
    expect(result.targets.map((row) => row.target_id)).toEqual(["T1", "T2", "T3", "T4", "T5", "T6"]);
    expect(result.campaigns.length).toBeGreaterThan(1);
    expect(result.targets.length).toBeGreaterThan(2);
    expect(result.includedSpendTotal).toBeGreaterThanOrEqual(950);
    expect(result.coveragePct ?? 0).toBeGreaterThanOrEqual(0.95);
  });
});
