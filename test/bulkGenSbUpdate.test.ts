import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, it, expect } from "vitest";
import { buildUploadRows, SB_DEFAULT_SHEET_NAME } from "../src/bulksheet_gen_sb/buildUploadRows";
import { writeSbBulkUpdateXlsx, REVIEW_HELPER_COLUMNS } from "../src/bulksheet_gen_sb/writeXlsx";
import { FetchCurrentSbResult } from "../src/bulksheet_gen_sb/fetchCurrent";
import { SbUpdateAction } from "../src/bulksheet_gen_sb/types";

function makeTemplate(templatePath: string, headers: string[]) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SB_DEFAULT_SHEET_NAME);
  const dir = path.dirname(templatePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  XLSX.writeFile(workbook, templatePath);
}

function rowToObject(headers: string[], row: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  headers.forEach((header, idx) => {
    obj[header] = row[idx];
  });
  return obj;
}

describe("bulkgen sb update", () => {
  it("writes upload_strict with template header order preserved", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    const templatePath = path.join(tmpDir, `template-sb-${Date.now()}.xlsx`);
    const outDir = path.join(tmpDir, `out-sb-${Date.now()}`);

    const headers = [
      "Product",
      "Entity",
      "Operation",
      "Campaign ID",
      "Campaign Name",
      "Daily Budget",
      "State",
      "Ad Group ID",
      "Ad Group Name",
      "Ad Group Default Bid",
      "Keyword ID",
      "Keyword Text",
      "Match Type",
      "Bid",
      "Product Targeting ID",
      "Product Targeting Expression",
      "Placement",
      "Percentage",
      "Bidding Strategy",
    ];

    makeTemplate(templatePath, headers);

    const actions: SbUpdateAction[] = [
      { type: "update_campaign_budget", campaign_id: "C1", new_budget: 40 },
    ];

    const current: FetchCurrentSbResult = {
      snapshotDate: "2026-02-14",
      campaignsById: new Map([
        [
          "C1",
          {
            campaign_id: "C1",
            campaign_name_raw: "SB Camp",
            state: "enabled",
            daily_budget: 20,
            bidding_strategy: "Legacy",
            portfolio_id: null,
          },
        ],
      ]),
      adGroupsById: new Map(),
      targetsById: new Map(),
      placementsByKey: new Map(),
    };

    const rows = buildUploadRows({ actions, current });
    const { uploadPath } = writeSbBulkUpdateXlsx({
      templatePath,
      outDir,
      rows,
      requiredHeadersBySheet: new Map([
        [SB_DEFAULT_SHEET_NAME, ["Entity", "Operation", "Campaign ID", "Daily Budget"]],
      ]),
    });

    const uploadWorkbook = XLSX.readFile(uploadPath);
    const uploadSheet = uploadWorkbook.Sheets[SB_DEFAULT_SHEET_NAME];
    const uploadRows = XLSX.utils.sheet_to_json<unknown[]>(uploadSheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    expect(uploadRows[0]).toEqual(headers);
  });

  it("writes review output with helper columns appended", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    const templatePath = path.join(tmpDir, `template-sb-review-${Date.now()}.xlsx`);
    const outDir = path.join(tmpDir, `out-sb-review-${Date.now()}`);

    const headers = [
      "Product",
      "Entity",
      "Operation",
      "Campaign ID",
      "Campaign Name",
      "Daily Budget",
      "State",
      "Ad Group ID",
      "Ad Group Name",
      "Ad Group Default Bid",
      "Keyword ID",
      "Keyword Text",
      "Match Type",
      "Bid",
      "Product Targeting ID",
      "Product Targeting Expression",
      "Placement",
      "Percentage",
      "Bidding Strategy",
    ];

    makeTemplate(templatePath, headers);

    const actions: SbUpdateAction[] = [
      { type: "update_campaign_state", campaign_id: "C1", new_state: "paused" },
    ];

    const current: FetchCurrentSbResult = {
      snapshotDate: "2026-02-14",
      campaignsById: new Map([
        [
          "C1",
          {
            campaign_id: "C1",
            campaign_name_raw: "SB Camp",
            state: "enabled",
            daily_budget: 20,
            bidding_strategy: "Legacy",
            portfolio_id: null,
          },
        ],
      ]),
      adGroupsById: new Map(),
      targetsById: new Map(),
      placementsByKey: new Map(),
    };

    const rows = buildUploadRows({ actions, current });
    const { reviewPath } = writeSbBulkUpdateXlsx({
      templatePath,
      outDir,
      rows,
      requiredHeadersBySheet: new Map([
        [SB_DEFAULT_SHEET_NAME, ["Entity", "Operation", "Campaign ID", "State"]],
      ]),
    });

    const reviewWorkbook = XLSX.readFile(reviewPath);
    const reviewSheet = reviewWorkbook.Sheets[SB_DEFAULT_SHEET_NAME];
    const reviewRows = XLSX.utils.sheet_to_json<unknown[]>(reviewSheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    const reviewHeader = reviewRows[0] as string[];
    expect(reviewHeader).toEqual([...headers, ...REVIEW_HELPER_COLUMNS]);
  });

  it("merges multiple campaign actions into one row", () => {
    const actions: SbUpdateAction[] = [
      { type: "update_campaign_budget", campaign_id: "C1", new_budget: 50 },
      { type: "update_campaign_state", campaign_id: "C1", new_state: "paused" },
      {
        type: "update_campaign_bidding_strategy",
        campaign_id: "C1",
        new_strategy: "Bid Optimization",
      },
    ];

    const current: FetchCurrentSbResult = {
      snapshotDate: "2026-02-14",
      campaignsById: new Map([
        [
          "C1",
          {
            campaign_id: "C1",
            campaign_name_raw: "SB Camp",
            state: "enabled",
            daily_budget: 20,
            bidding_strategy: "Legacy",
            portfolio_id: null,
          },
        ],
      ]),
      adGroupsById: new Map(),
      targetsById: new Map(),
      placementsByKey: new Map(),
    };

    const rows = buildUploadRows({ actions, current });
    expect(rows.length).toBe(1);
    expect(rows[0].review.action_type).toBe(
      "update_campaign_budget+update_campaign_state+update_campaign_bidding_strategy"
    );
  });

  it("merges placement updates by campaign_id and placement_raw_norm", () => {
    const actions: SbUpdateAction[] = [
      {
        type: "update_placement_modifier",
        campaign_id: "C1",
        placement_raw: "Top of Search",
        new_pct: 20,
      },
      {
        type: "update_placement_modifier",
        campaign_id: "C1",
        placement_raw: "top  of   search",
        new_pct: 25,
      },
    ];

    const current: FetchCurrentSbResult = {
      snapshotDate: "2026-02-14",
      campaignsById: new Map([
        [
          "C1",
          {
            campaign_id: "C1",
            campaign_name_raw: "SB Camp",
            state: "enabled",
            daily_budget: 20,
            bidding_strategy: "Legacy",
            portfolio_id: null,
          },
        ],
      ]),
      adGroupsById: new Map(),
      targetsById: new Map(),
      placementsByKey: new Map([
        [
          "C1::top of search::TOS",
          {
            campaign_id: "C1",
            placement_raw: "Top of Search",
            placement_raw_norm: "top of search",
            placement_code: "TOS",
            percentage: 10,
          },
        ],
      ]),
    };

    const rows = buildUploadRows({ actions, current });
    expect(rows.length).toBe(1);
    expect(String(rows[0].cells["Placement"])).toBe("Top of Search");
  });

  it("fails fast on missing required columns", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    const templatePath = path.join(tmpDir, `template-sb-missing-${Date.now()}.xlsx`);
    const outDir = path.join(tmpDir, `out-sb-missing-${Date.now()}`);

    const headers = ["Entity", "Operation", "Campaign ID"];
    makeTemplate(templatePath, headers);

    const actions: SbUpdateAction[] = [
      { type: "update_campaign_budget", campaign_id: "C1", new_budget: 50 },
    ];

    const current: FetchCurrentSbResult = {
      snapshotDate: "2026-02-14",
      campaignsById: new Map([
        [
          "C1",
          {
            campaign_id: "C1",
            campaign_name_raw: "SB Camp",
            state: "enabled",
            daily_budget: 20,
            bidding_strategy: "Legacy",
            portfolio_id: null,
          },
        ],
      ]),
      adGroupsById: new Map(),
      targetsById: new Map(),
      placementsByKey: new Map(),
    };

    const rows = buildUploadRows({ actions, current });
    expect(() =>
      writeSbBulkUpdateXlsx({
        templatePath,
        outDir,
        rows,
        requiredHeadersBySheet: new Map([
          [SB_DEFAULT_SHEET_NAME, ["Entity", "Operation", "Campaign ID", "Daily Budget"]],
        ]),
      })
    ).toThrow(/missing required columns/i);
  });
});
