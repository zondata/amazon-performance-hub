import { describe, it, expect, vi } from "vitest";
import { fetchCurrentSpData } from "../src/bulksheet_gen_sp/fetchCurrent";
import { SpUpdateAction } from "../src/bulksheet_gen_sp/types";

type Row = Record<string, any>;

const dataByTable: Record<string, Row[]> = {};

function createQuery(table: string) {
  const query: any = {
    select: () => query,
    eq: () => query,
    not: () => query,
    order: () => query,
    limit: () => query,
    in: (col: string, ids: string[]) => {
      const rows = (dataByTable[table] ?? []).filter((row) => ids.includes(row[col]));
      return Promise.resolve({ data: rows, error: null });
    },
    maybeSingle: () => {
      const rows = dataByTable[table] ?? [];
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    },
  };
  return query;
}

const mockClient = {
  from: (table: string) => createQuery(table),
};

vi.mock("../src/db/supabaseClient", () => ({
  getSupabaseClient: () => mockClient,
}));

describe("fetchCurrentSpData", () => {
  it("includes ad groups for update_ad_group_state actions", async () => {
    dataByTable.uploads = [{ snapshot_date: "2026-02-14" }];
    dataByTable.bulk_ad_groups = [
      {
        ad_group_id: "AG1",
        campaign_id: "C1",
        ad_group_name_raw: "Ad Group 1",
        state: "enabled",
        default_bid: null,
      },
    ];
    dataByTable.bulk_campaigns = [
      {
        campaign_id: "C1",
        campaign_name_raw: "Campaign 1",
        state: "enabled",
        daily_budget: null,
        bidding_strategy: null,
        portfolio_id: null,
      },
    ];

    const actions: SpUpdateAction[] = [
      { type: "update_ad_group_state", ad_group_id: "AG1", new_state: "paused" },
      { type: "update_ad_group_default_bid", ad_group_id: "AG1", new_bid: 1.1 },
    ];

    const result = await fetchCurrentSpData("US", actions);
    expect(result.adGroupsById.has("AG1")).toBe(true);
  });

  it("includes campaigns for update_campaign_bidding_strategy actions", async () => {
    dataByTable.uploads = [{ snapshot_date: "2026-02-14" }];
    dataByTable.bulk_campaigns = [
      {
        campaign_id: "C99",
        campaign_name_raw: "Campaign 99",
        state: "enabled",
        daily_budget: null,
        bidding_strategy: "Legacy",
        portfolio_id: null,
      },
    ];

    const actions: SpUpdateAction[] = [
      {
        type: "update_campaign_bidding_strategy",
        campaign_id: "C99",
        new_strategy: "Dynamic bids - down only",
      },
    ];

    const result = await fetchCurrentSpData("US", actions);
    expect(result.campaignsById.has("C99")).toBe(true);
  });
});
