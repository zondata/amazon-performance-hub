import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { processPendingManifests } from "../src/bulksheet_gen_sp_create/reconcilePending";

type Row = Record<string, any>;

const dataByTable: Record<string, Row[]> = {};

function createQuery(table: string) {
  const query: any = {};
  query._execute = () => {
    const rows = dataByTable[table] ?? [];
    return Promise.resolve({ data: rows, error: null });
  };
  query.select = () => query;
  query.eq = () => query;
  query.in = () => query;
  query.not = () => query;
  query.order = () => query;
  query.limit = () => query;
  query.maybeSingle = () => Promise.resolve({ data: null, error: null });
  query.then = (resolve: any, reject: any) => query._execute().then(resolve, reject);
  return query;
}

const mockClient = {
  from: (table: string) => createQuery(table),
};

vi.mock("../src/db/supabaseClient", () => ({
  getSupabaseClient: () => mockClient,
}));

function writeJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function makeManifest(overrides: Partial<any> = {}) {
  return {
    run_id: "run-1",
    generator: "bulkgen:sp:create",
    created_at: "2026-02-15T00:00:00Z",
    campaigns: [{ name: "Camp 1", campaign_id: "TMP-CAMP-1" }],
    ad_groups: [{ campaign_name: "Camp 1", ad_group_name: "AG 1", ad_group_id: "TMP-AG-1" }],
    product_ads: [],
    keywords: [{ campaign_name: "Camp 1", ad_group_name: "AG 1", keyword_text: "blue shoes", match_type: "Exact", bid: 1.2 }],
    ...overrides,
  };
}

describe("sp create reconcile pending", () => {
  beforeEach(() => {
    dataByTable.bulk_campaigns = [];
    dataByTable.bulk_ad_groups = [];
    dataByTable.bulk_targets = [];
  });

  it("processes manifests in sorted order and reconciles when matched", async () => {
    const baseDir = path.resolve(__dirname, "tmp", `pending-${Date.now()}`);
    const pendingDir = path.join(baseDir, "_PENDING_RECONCILE");
    fs.mkdirSync(pendingDir, { recursive: true });

    const aPath = path.join(pendingDir, "a.json");
    const bPath = path.join(pendingDir, "b.json");
    writeJson(aPath, makeManifest());
    writeJson(bPath, makeManifest({ run_id: "run-2" }));

    dataByTable.bulk_campaigns = [
      { campaign_id: "C1", campaign_name_norm: "camp 1", campaign_name_raw: "Camp 1" },
    ];
    dataByTable.bulk_ad_groups = [
      { ad_group_id: "AG1", ad_group_name_norm: "ag 1", ad_group_name_raw: "AG 1", campaign_id: "C1" },
    ];
    dataByTable.bulk_targets = [
      { target_id: "T1", ad_group_id: "AG1", expression_norm: "blue shoes", match_type: "Exact" },
    ];

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: any) => logs.push(String(msg ?? ""));

    try {
      await processPendingManifests({
        accountId: "US",
        snapshotDate: "2026-02-14",
        pendingDir,
        dryRun: false,
      });
    } finally {
      console.log = originalLog;
    }

    expect(logs[0]).toContain("RECONCILED a.json");
    expect(logs[1]).toContain("RECONCILED b.json");

    const reconciledDir = path.join(baseDir, "_RECONCILED");
    expect(fs.existsSync(path.join(reconciledDir, "a.json"))).toBe(true);
    expect(fs.existsSync(path.join(reconciledDir, "a.reconcile_result.json"))).toBe(true);
  });

  it("leaves pending when not all matches found", async () => {
    const baseDir = path.resolve(__dirname, "tmp", `pending-partial-${Date.now()}`);
    const pendingDir = path.join(baseDir, "_PENDING_RECONCILE");
    fs.mkdirSync(pendingDir, { recursive: true });
    const filePath = path.join(pendingDir, "c.json");
    writeJson(filePath, makeManifest());

    dataByTable.bulk_campaigns = [
      { campaign_id: "C1", campaign_name_norm: "camp 1", campaign_name_raw: "Camp 1" },
    ];
    dataByTable.bulk_ad_groups = [];
    dataByTable.bulk_targets = [];

    await processPendingManifests({
      accountId: "US",
      snapshotDate: "2026-02-14",
      pendingDir,
      dryRun: false,
    });

    expect(fs.existsSync(filePath)).toBe(true);
    const reconciledDir = path.join(baseDir, "_RECONCILED");
    expect(fs.existsSync(reconciledDir)).toBe(true);
    expect(fs.existsSync(path.join(reconciledDir, "c.json"))).toBe(false);
  });

  it("moves malformed manifest to failed with fail.json", async () => {
    const baseDir = path.resolve(__dirname, "tmp", `pending-fail-${Date.now()}`);
    const pendingDir = path.join(baseDir, "_PENDING_RECONCILE");
    fs.mkdirSync(pendingDir, { recursive: true });
    const filePath = path.join(pendingDir, "bad.json");
    fs.writeFileSync(filePath, "{not-json", "utf-8");

    await processPendingManifests({
      accountId: "US",
      snapshotDate: "2026-02-14",
      pendingDir,
      dryRun: false,
    });

    const failedDir = path.join(baseDir, "_FAILED");
    expect(fs.existsSync(path.join(failedDir, "bad.json"))).toBe(true);
    expect(fs.existsSync(path.join(failedDir, "bad.fail.json"))).toBe(true);
  });

  it("dry-run does not move or write files", async () => {
    const baseDir = path.resolve(__dirname, "tmp", `pending-dry-${Date.now()}`);
    const pendingDir = path.join(baseDir, "_PENDING_RECONCILE");
    fs.mkdirSync(pendingDir, { recursive: true });
    const filePath = path.join(pendingDir, "dry.json");
    writeJson(filePath, makeManifest());

    dataByTable.bulk_campaigns = [
      { campaign_id: "C1", campaign_name_norm: "camp 1", campaign_name_raw: "Camp 1" },
    ];
    dataByTable.bulk_ad_groups = [
      { ad_group_id: "AG1", ad_group_name_norm: "ag 1", ad_group_name_raw: "AG 1", campaign_id: "C1" },
    ];
    dataByTable.bulk_targets = [
      { target_id: "T1", ad_group_id: "AG1", expression_norm: "blue shoes", match_type: "Exact" },
    ];

    await processPendingManifests({
      accountId: "US",
      snapshotDate: "2026-02-14",
      pendingDir,
      dryRun: true,
    });

    expect(fs.existsSync(filePath)).toBe(true);
    const reconciledDir = path.join(baseDir, "_RECONCILED");
    expect(fs.existsSync(reconciledDir)).toBe(false);
  });
});
