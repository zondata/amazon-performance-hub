import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildUploadRows as buildSpUploadRows } from "../src/bulksheet_gen_sp/buildUploadRows";
import { FetchCurrentResult } from "../src/bulksheet_gen_sp/fetchCurrent";
import { SpUpdateAction } from "../src/bulksheet_gen_sp/types";
import { buildSpBulkgenLogEntries, writeBulkgenLogs } from "../src/logbook/bulkgen";

const mockFind = vi.fn();
const mockUpsert = vi.fn();
const mockInsertEntities = vi.fn();
const mockLinkExperiment = vi.fn();

vi.mock("../src/logbook/db", () => ({
  findLogChangeByDedupeKey: (...args: unknown[]) => mockFind(...args),
  upsertLogChangeWithDedupe: (...args: unknown[]) => mockUpsert(...args),
  insertLogChangeEntities: (...args: unknown[]) => mockInsertEntities(...args),
  linkExperimentChange: (...args: unknown[]) => mockLinkExperiment(...args),
}));

describe("bulkgen logbook integration", () => {
  beforeEach(() => {
    mockFind.mockReset();
    mockUpsert.mockReset();
    mockInsertEntities.mockReset();
    mockLinkExperiment.mockReset();
  });

  it("builds correct change payloads for SP merged rows", () => {
    const actions: SpUpdateAction[] = [
      { type: "update_campaign_budget", campaign_id: "C1", new_budget: 30 },
      { type: "update_target_bid", target_id: "T1", new_bid: 1.5 },
    ];

    const current: FetchCurrentResult = {
      snapshotDate: "2026-02-14",
      campaignsById: new Map([
        [
          "C1",
          {
            campaign_id: "C1",
            campaign_name_raw: "Camp 1",
            state: "enabled",
            daily_budget: 20,
            bidding_strategy: null,
            portfolio_id: null,
          },
        ],
      ]),
      adGroupsById: new Map([
        [
          "AG1",
          {
            ad_group_id: "AG1",
            campaign_id: "C1",
            ad_group_name_raw: "Ad Group 1",
            state: "enabled",
            default_bid: 0.75,
          },
        ],
      ]),
      targetsById: new Map([
        [
          "T1",
          {
            target_id: "T1",
            ad_group_id: "AG1",
            campaign_id: "C1",
            expression_raw: "blue shoes",
            match_type: "EXACT",
            is_negative: false,
            state: "enabled",
            bid: 1.1,
          },
        ],
      ]),
      placementsByKey: new Map(),
    };

    const rows = buildSpUploadRows({ actions, current, notes: "logbook test" });
    const entries = buildSpBulkgenLogEntries({
      rows,
      current,
      runId: "run-1",
      generator: "bulkgen:sp:update",
      outputPaths: { uploadPath: "/tmp/upload.xlsx", reviewPath: "/tmp/review.xlsx" },
    });

    expect(entries.length).toBe(2);
    const campaignEntry = entries.find(
      (entry) => entry.change.change_type === "bulk_update_campaign"
    );
    expect(campaignEntry?.change.summary).toContain("campaign_id=C1");
    expect((campaignEntry?.change.before_json as any).daily_budget).toBe(20);
    expect((campaignEntry?.change.after_json as any).daily_budget).toBe(30);
    expect((campaignEntry?.change.after_json as any).run_id).toBe("run-1");

    const targetEntry = entries.find(
      (entry) => entry.change.change_type === "bulk_update_target"
    );
    expect(targetEntry?.change.summary).toContain("target_id=T1");
    expect((targetEntry?.change.before_json as any).bid).toBe(1.1);
    expect((targetEntry?.change.after_json as any).bid).toBe(1.5);
  });

  it("writes changes, links entities and experiment, and is idempotent", async () => {
    const entries = [
      {
        dedupeKey: "run-1::bulkgen:sp:update::Campaign::C1::::",
        change: {
          channel: "ads",
          change_type: "bulk_update_campaign",
          summary: "test",
          before_json: { daily_budget: 10 },
          after_json: { daily_budget: 20 },
          source: "bulkgen",
          dedupe_key: "run-1::bulkgen:sp:update::Campaign::C1::::",
          entities: [{ entity_type: "campaign", campaign_id: "C1" }],
        },
      },
    ];

    mockFind.mockResolvedValueOnce(null);
    mockUpsert.mockResolvedValueOnce({ change_id: "chg-1" });

    await writeBulkgenLogs({
      accountId: "US",
      marketplace: "US",
      entries,
      experimentId: "exp-1",
    });

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "US", dedupeKey: entries[0].dedupeKey })
    );
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockInsertEntities).toHaveBeenCalledTimes(1);
    expect(mockLinkExperiment).toHaveBeenCalledTimes(1);

    mockFind.mockResolvedValueOnce({ change_id: "chg-1" });
    mockUpsert.mockResolvedValueOnce({ change_id: "chg-1" });

    await writeBulkgenLogs({
      accountId: "US",
      marketplace: "US",
      entries,
      experimentId: "exp-1",
    });

    expect(mockInsertEntities).toHaveBeenCalledTimes(1);
  });
});
