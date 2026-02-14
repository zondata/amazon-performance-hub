import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, it, expect } from "vitest";
import { buildUploadRows, SP_SHEET_NAME } from "../src/bulksheet_gen_sp/buildUploadRows";
import { writeSpBulkUpdateXlsx, REVIEW_HELPER_COLUMNS } from "../src/bulksheet_gen_sp/writeXlsx";
import { FetchCurrentResult } from "../src/bulksheet_gen_sp/fetchCurrent";
import { SpUpdateAction } from "../src/bulksheet_gen_sp/types";

function makeTemplate(templatePath: string, headers: string[]) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SP_SHEET_NAME);
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

describe("bulkgen sp update", () => {
  it("writes upload_strict and review with correct headers and rows", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    const templatePath = path.join(tmpDir, `template-${Date.now()}.xlsx`);
    const outDir = path.join(tmpDir, `out-${Date.now()}`);

    const headers = [
      "Entity",
      "Operation",
      "Campaign ID",
      "Campaign Name",
      "Ad Group ID",
      "Ad Group Name",
      "Keyword ID",
      "Product Targeting ID",
      "Keyword Text",
      "Product Targeting Expression",
      "Match Type",
      "State",
      "Daily Budget",
      "Bidding Strategy",
      "Bid",
      "Placement",
      "Percentage",
      "Portfolio ID",
      "Portfolio Name",
    ];

    makeTemplate(templatePath, headers);

    const actions: SpUpdateAction[] = [
      { type: "update_campaign_budget", campaign_id: "C1", new_budget: 50 },
      { type: "update_campaign_state", campaign_id: "C1", new_state: "paused" },
      { type: "update_target_bid", target_id: "T1", new_bid: 1.5 },
      {
        type: "update_placement_modifier",
        campaign_id: "C1",
        placement_code: "TOP_OF_SEARCH",
        new_pct: 30,
      },
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
            bidding_strategy: "",
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
          "C1::top_of_search",
          {
            campaign_id: "C1",
            placement_raw: "Top of Search (first page)",
            placement_code: "TOP_OF_SEARCH",
            percentage: 20,
          },
        ],
      ]),
    };

    const rows = buildUploadRows({ actions, current, notes: "test notes" });

    const requiredHeaders = new Set<string>([
      "Entity",
      "Operation",
      "Campaign ID",
      "Daily Budget",
      "Ad Group ID",
      "Keyword ID",
      "Product Targeting ID",
      "Keyword Text",
      "Product Targeting Expression",
      "Match Type",
      "Bid",
      "Placement",
      "Percentage",
    ]);

    const { uploadPath, reviewPath } = writeSpBulkUpdateXlsx({
      templatePath,
      outDir,
      rows,
      requiredHeadersBySheet: new Map([[SP_SHEET_NAME, [...requiredHeaders]]]),
    });

    const uploadWorkbook = XLSX.readFile(uploadPath);
    const uploadSheet = uploadWorkbook.Sheets[SP_SHEET_NAME];
    const uploadRows = XLSX.utils.sheet_to_json<unknown[]>(uploadSheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    expect(uploadRows.length).toBe(1 + 3);
    expect(uploadRows[0]).toEqual(headers);

    const uploadHeader = uploadRows[0] as string[];
    for (let i = 1; i < uploadRows.length; i += 1) {
      const rowObj = rowToObject(uploadHeader, uploadRows[i] as unknown[]);
      expect(rowObj["Operation"]).toBe("Update");
    }

    const reviewWorkbook = XLSX.readFile(reviewPath);
    const reviewSheet = reviewWorkbook.Sheets[SP_SHEET_NAME];
    const reviewRows = XLSX.utils.sheet_to_json<unknown[]>(reviewSheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    const reviewHeader = reviewRows[0] as string[];
    expect(reviewHeader).toEqual([...headers, ...REVIEW_HELPER_COLUMNS]);

    const reviewRowObjects = reviewRows.slice(1).map((row) => rowToObject(reviewHeader, row));
    const campaignRow = reviewRowObjects.find((row) => row.Entity === "Campaign");
    expect(Number(campaignRow?.["Daily Budget"])).toBe(50);
    expect(String(campaignRow?.State)).toBe("paused");
    expect(campaignRow?.action_type).toBe("update_campaign_budget+update_campaign_state");
  });
});
