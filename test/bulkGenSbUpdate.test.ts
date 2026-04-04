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
      "Portfolio ID",
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
            portfolio_id: "P1",
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
    const rowObj = rowToObject(uploadRows[0] as string[], uploadRows[1] as unknown[]);
    expect(rowObj["Portfolio ID"]).toBe("P1");
  });

  it("preserves Portfolio ID on every generated non-campaign row type", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    const templatePath = path.join(tmpDir, `template-sb-portfolio-all-${Date.now()}.xlsx`);
    const outDir = path.join(tmpDir, `out-sb-portfolio-all-${Date.now()}`);

    const headers = [
      "Product",
      "Entity",
      "Operation",
      "Campaign ID",
      "Campaign Name",
      "Portfolio ID",
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
      { type: "update_ad_group_state", ad_group_id: "AG1", new_state: "paused" },
      { type: "update_target_state", target_id: "T1", new_state: "paused" },
      {
        type: "update_placement_modifier",
        campaign_id: "C1",
        placement_raw: "Top of Search",
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
            portfolio_id: "P1",
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
            default_bid: 0.8,
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
            bid: 0.75,
          },
        ],
      ]),
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
    const { uploadPath } = writeSbBulkUpdateXlsx({
      templatePath,
      outDir,
      rows,
      requiredHeadersBySheet: new Map([
        [
          SB_DEFAULT_SHEET_NAME,
          [
            "Entity",
            "Operation",
            "Campaign ID",
            "State",
            "Ad Group ID",
            "Keyword ID",
            "Product Targeting ID",
            "Keyword Text",
            "Product Targeting Expression",
            "Match Type",
            "Placement",
            "Percentage",
          ],
        ],
      ]),
    });

    const uploadWorkbook = XLSX.readFile(uploadPath);
    const uploadSheet = uploadWorkbook.Sheets[SB_DEFAULT_SHEET_NAME];
    const uploadRows = XLSX.utils.sheet_to_json<unknown[]>(uploadSheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    const uploadHeader = uploadRows[0] as string[];
    const rowObjects = uploadRows.slice(1).map((row) => rowToObject(uploadHeader, row as unknown[]));

    const campaignRow = rowObjects.find((row) => row.Entity === "Campaign");
    expect(campaignRow?.["Portfolio ID"]).toBe("P1");

    const adGroupRow = rowObjects.find((row) => row.Entity === "Ad Group");
    expect(adGroupRow?.["Portfolio ID"]).toBe("P1");

    const targetRow = rowObjects.find((row) => row.Entity === "Keyword");
    expect(targetRow?.["Portfolio ID"]).toBe("P1");

    const placementRow = rowObjects.find(
      (row) => row.Entity === "Bidding Adjustment by Placement"
    );
    expect(placementRow?.["Portfolio ID"]).toBe("P1");
  });

  it("fails when a portfolio-backed non-campaign row cannot be preserved by the template", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    const templatePath = path.join(tmpDir, `template-sb-missing-portfolio-${Date.now()}.xlsx`);
    const outDir = path.join(tmpDir, `out-sb-missing-portfolio-${Date.now()}`);

    makeTemplate(templatePath, [
      "Entity",
      "Operation",
      "Campaign ID",
      "Keyword ID",
      "Bid",
    ]);

    const actions: SbUpdateAction[] = [
      { type: "update_target_bid", target_id: "T1", new_bid: 1.25 },
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
            portfolio_id: "P1",
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
            default_bid: 0.8,
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
            bid: 0.75,
          },
        ],
      ]),
      placementsByKey: new Map(),
    };

    const rows = buildUploadRows({ actions, current });
    const expectedError = `Template sheet ${SB_DEFAULT_SHEET_NAME} missing required column: Portfolio ID. Cannot safely generate update rows for campaigns already assigned to portfolios.`;

    expect(() =>
      writeSbBulkUpdateXlsx({
        templatePath,
        outDir,
        rows,
        requiredHeadersBySheet: new Map([
          [SB_DEFAULT_SHEET_NAME, ["Entity", "Operation", "Campaign ID", "Keyword ID", "Bid"]],
        ]),
      })
    ).toThrow(expectedError);
  });

  it("fails when campaign context is missing for a non-campaign row", () => {
    const actions: SbUpdateAction[] = [
      { type: "update_target_state", target_id: "T1", new_state: "paused" },
    ];

    const current: FetchCurrentSbResult = {
      snapshotDate: "2026-02-14",
      campaignsById: new Map(),
      adGroupsById: new Map([
        [
          "AG1",
          {
            ad_group_id: "AG1",
            campaign_id: "C1",
            ad_group_name_raw: "Ad Group 1",
            state: "enabled",
            default_bid: 0.8,
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
            bid: 0.75,
          },
        ],
      ]),
      placementsByKey: new Map(),
    };

    expect(() => buildUploadRows({ actions, current })).toThrow(
      "Cannot safely preserve Portfolio ID for target row: missing campaign context for campaign_id=C1"
    );
  });

  it("supports Budget header alias for campaign budgets", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    const templatePath = path.join(tmpDir, `template-sb-budget-${Date.now()}.xlsx`);
    const outDir = path.join(tmpDir, `out-sb-budget-${Date.now()}`);

    const headers = [
      "Product",
      "Entity",
      "Operation",
      "Campaign ID",
      "Campaign Name",
      "Budget",
      "State",
    ];

    makeTemplate(templatePath, headers);

    const actions: SbUpdateAction[] = [
      { type: "update_campaign_budget", campaign_id: "C1", new_budget: 55 },
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

    const rows = buildUploadRows({ actions, current, budgetColumn: "Budget" });
    const { uploadPath } = writeSbBulkUpdateXlsx({
      templatePath,
      outDir,
      rows,
      requiredHeadersBySheet: new Map([
        [SB_DEFAULT_SHEET_NAME, ["Entity", "Operation", "Campaign ID", "Budget"]],
      ]),
    });

    const uploadWorkbook = XLSX.readFile(uploadPath);
    const uploadSheet = uploadWorkbook.Sheets[SB_DEFAULT_SHEET_NAME];
    const uploadRows = XLSX.utils.sheet_to_json<unknown[]>(uploadSheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    const rowObj = rowToObject(uploadRows[0] as string[], uploadRows[1] as unknown[]);
    expect(Number(rowObj.Budget)).toBe(55);
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
