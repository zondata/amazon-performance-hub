import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, it, expect } from "vitest";
import {
  buildUploadRows,
  resolveCreateRefs,
  SP_CREATE_SHEET_NAME,
} from "../src/bulksheet_gen_sp_create/buildUploadRows";
import { buildCreateManifest } from "../src/bulksheet_gen_sp_create/manifest";
import { writeSpBulkCreateXlsx, REVIEW_HELPER_COLUMNS } from "../src/bulksheet_gen_sp_create/writeXlsx";
import { SpCreateAction } from "../src/bulksheet_gen_sp_create/types";

function makeTemplate(templatePath: string, headers: string[]) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SP_CREATE_SHEET_NAME);
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

describe("bulkgen sp create", () => {
  it("writes upload_strict with template header order preserved", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    const templatePath = path.join(tmpDir, `template-sp-create-${Date.now()}.xlsx`);
    const outDir = path.join(tmpDir, `out-sp-create-${Date.now()}`);

    const headers = [
      "Product",
      "Entity",
      "Operation",
      "Campaign ID",
      "Campaign Name",
      "Daily Budget",
      "Targeting Type",
      "State",
      "Ad Group ID",
      "Ad Group Name",
      "Keyword Text",
      "Match Type",
      "Ad Group Default Bid",
      "Bid",
      "SKU",
      "ASIN",
    ];

    makeTemplate(templatePath, headers);

    const actions: SpCreateAction[] = [
      {
        type: "create_campaign",
        name: "Camp 1",
        daily_budget: 10,
        targeting_type: "Manual",
      },
    ];
    const refs = resolveCreateRefs(actions, "run-1");
    const rows = buildUploadRows({
      actions,
      refs,
      allowEnabled: false,
      maxBudget: 50,
      maxBid: 2,
      runId: "run-1",
    });

    const { uploadPath } = writeSpBulkCreateXlsx({
      templatePath,
      outDir,
      rows,
      requiredHeadersBySheet: new Map([
        [
          SP_CREATE_SHEET_NAME,
          [
            "Entity",
            "Operation",
            "Product",
            "Campaign ID",
            "Campaign Name",
            "Daily Budget",
            "Targeting Type",
            "State",
            "Ad Group ID",
          ],
        ],
      ]),
      writeUpload: true,
    });

    const uploadWorkbook = XLSX.readFile(uploadPath as string);
    const uploadSheet = uploadWorkbook.Sheets[SP_CREATE_SHEET_NAME];
    const uploadRows = XLSX.utils.sheet_to_json<unknown[]>(uploadSheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    expect(uploadRows[0]).toEqual(headers);
  });

  it("defaults state to Paused when not provided", () => {
    const actions: SpCreateAction[] = [
      {
        type: "create_campaign",
        name: "Camp 1",
        daily_budget: 10,
        targeting_type: "manual",
      },
    ];
    const refs = resolveCreateRefs(actions, "run-1");
    const rows = buildUploadRows({
      actions,
      refs,
      allowEnabled: false,
      maxBudget: 50,
      maxBid: 2,
      runId: "run-1",
    });
    expect(rows[0].cells.State).toBe("Paused");
  });

  it("validates targeting type and rejects Auto + keyword mix", () => {
    const actions: SpCreateAction[] = [
      {
        type: "create_campaign",
        name: "Auto Camp",
        daily_budget: 10,
        targeting_type: "Auto",
      },
      {
        type: "create_keyword",
        campaign_name: "Auto Camp",
        ad_group_name: "AG 1",
        keyword_text: "blue shoes",
        match_type: "Exact",
        bid: 1.1,
      },
    ];
    const refs = resolveCreateRefs(actions, "run-1");
    expect(() =>
      buildUploadRows({
        actions,
        refs,
        allowEnabled: false,
        maxBudget: 50,
        maxBid: 2,
        runId: "run-1",
      })
    ).toThrow(/Auto targeting campaigns cannot include create_keyword/i);

    const actions2: SpCreateAction[] = [
      {
        type: "create_campaign",
        name: "Camp 1",
        daily_budget: 10,
        targeting_type: "invalid",
      },
    ];
    const refs2 = resolveCreateRefs(actions2, "run-1");
    expect(() =>
      buildUploadRows({
        actions: actions2,
        refs: refs2,
        allowEnabled: false,
        maxBudget: 50,
        maxBid: 2,
        runId: "run-1",
      })
    ).toThrow(/Invalid targeting_type/i);
  });

  it("generates deterministic temp IDs from run_id", () => {
    const actions: SpCreateAction[] = [
      {
        type: "create_campaign",
        name: "Camp 1",
        daily_budget: 10,
        targeting_type: "Manual",
      },
      {
        type: "create_ad_group",
        campaign_name: "Camp 1",
        ad_group_name: "AG 1",
      },
    ];
    const refs = resolveCreateRefs(actions, "run-1");
    const rowsFirst = buildUploadRows({
      actions,
      refs,
      allowEnabled: false,
      maxBudget: 50,
      maxBid: 2,
      runId: "run-1",
    });
    const rowsSecond = buildUploadRows({
      actions,
      refs,
      allowEnabled: false,
      maxBudget: 50,
      maxBid: 2,
      runId: "run-1",
    });
    const firstCampaignId = rowsFirst.find((row) => row.cells.Entity === "Campaign")?.cells[
      "Campaign ID"
    ];
    const secondCampaignId = rowsSecond.find((row) => row.cells.Entity === "Campaign")?.cells[
      "Campaign ID"
    ];
    const firstAdGroupId = rowsFirst.find((row) => row.cells.Entity === "Ad Group")?.cells[
      "Ad Group ID"
    ];
    const secondAdGroupId = rowsSecond.find((row) => row.cells.Entity === "Ad Group")?.cells[
      "Ad Group ID"
    ];
    expect(firstCampaignId).toBe(secondCampaignId);
    expect(firstAdGroupId).toBe(secondAdGroupId);
  });

  it("uses Ad Group Default Bid column for ad group create", () => {
    const actions: SpCreateAction[] = [
      {
        type: "create_campaign",
        name: "Camp 1",
        daily_budget: 10,
        targeting_type: "Manual",
        temp_id: "c1",
      },
      {
        type: "create_ad_group",
        campaign_temp_id: "c1",
        ad_group_name: "AG 1",
        default_bid: 1.25,
      },
    ];
    const refs = resolveCreateRefs(actions, "run-1");
    const rows = buildUploadRows({
      actions,
      refs,
      allowEnabled: false,
      maxBudget: 50,
      maxBid: 2,
      runId: "run-1",
    });
    const adGroupRow = rows.find((row) => row.cells.Entity === "Ad Group");
    expect(adGroupRow?.cells["Ad Group Default Bid"]).toBe(1.25);
    expect(adGroupRow?.cells.Bid ?? "").toBe("");
    expect(adGroupRow?.cells["Campaign ID"]).toBeTruthy();
    expect(adGroupRow?.cells["Ad Group ID"]).toBeTruthy();
  });

  it("sets Portfolio ID on campaign when provided", () => {
    const actions: SpCreateAction[] = [
      {
        type: "create_campaign",
        name: "Camp 1",
        daily_budget: 10,
        targeting_type: "Manual",
      },
    ];
    const refs = resolveCreateRefs(actions, "run-1");
    const rows = buildUploadRows({
      actions,
      refs,
      allowEnabled: false,
      maxBudget: 50,
      maxBid: 2,
      portfolioId: "P1",
      availableHeaders: new Set([
        "Portfolio ID",
        "Campaign Name",
        "Daily Budget",
        "Targeting Type",
        "State",
        "Product",
        "Entity",
        "Operation",
        "Campaign ID",
      ]),
      runId: "run-1",
    });
    expect(rows[0].cells["Portfolio ID"]).toBe("P1");
  });

  it("enforces budget and bid caps", () => {
    const actions: SpCreateAction[] = [
      {
        type: "create_campaign",
        name: "Camp 1",
        daily_budget: 60,
        targeting_type: "manual",
      },
    ];
    const refs = resolveCreateRefs(actions, "run-1");
    expect(() =>
      buildUploadRows({
        actions,
        refs,
        allowEnabled: false,
        maxBudget: 50,
        maxBid: 2,
        runId: "run-1",
      })
    ).toThrow(/max budget cap/i);

    const actions2: SpCreateAction[] = [
      {
        type: "create_campaign",
        name: "Camp 1",
        daily_budget: 10,
        targeting_type: "Manual",
        temp_id: "c1",
      },
      {
        type: "create_ad_group",
        campaign_temp_id: "c1",
        ad_group_name: "AG 1",
        temp_id: "ag1",
      },
      {
        type: "create_keyword",
        campaign_temp_id: "c1",
        ad_group_temp_id: "ag1",
        keyword_text: "blue shoes",
        match_type: "Exact",
        bid: 5,
        state: "paused",
      },
    ];
    const refs2 = resolveCreateRefs(actions2, "run-1");
    expect(() =>
      buildUploadRows({
        actions: actions2,
        refs: refs2,
        allowEnabled: false,
        maxBudget: 50,
        maxBid: 2,
        runId: "run-1",
      })
    ).toThrow(/max bid cap/i);
  });

  it("writes review with helper columns and stable manifest", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    const templatePath = path.join(tmpDir, `template-sp-create-review-${Date.now()}.xlsx`);
    const outDir = path.join(tmpDir, `out-sp-create-review-${Date.now()}`);

    const headers = [
      "Product",
      "Entity",
      "Operation",
      "Campaign ID",
      "Campaign Name",
      "Daily Budget",
      "Targeting Type",
      "State",
      "Ad Group ID",
      "Ad Group Name",
      "Keyword Text",
      "Match Type",
      "Ad Group Default Bid",
      "Bid",
      "SKU",
      "ASIN",
    ];

    makeTemplate(templatePath, headers);

    const actions: SpCreateAction[] = [
      {
        type: "create_campaign",
        name: "Camp 1",
        daily_budget: 10,
        targeting_type: "Manual",
        temp_id: "c1",
      },
      {
        type: "create_ad_group",
        campaign_temp_id: "c1",
        ad_group_name: "AG 1",
        temp_id: "ag1",
      },
      {
        type: "create_product_ad",
        campaign_temp_id: "c1",
        ad_group_temp_id: "ag1",
        sku: "SKU1",
      },
      {
        type: "create_keyword",
        campaign_temp_id: "c1",
        ad_group_temp_id: "ag1",
        keyword_text: "blue shoes",
        match_type: "Exact",
        bid: 1.2,
      },
    ];
    const refs = resolveCreateRefs(actions, "run-1");
    const rows = buildUploadRows({
      actions,
      refs,
      allowEnabled: false,
      maxBudget: 50,
      maxBid: 2,
      runId: "run-1",
    });

    const campaignRow = rows.find((row) => row.cells.Entity === "Campaign");
    const adGroupRow = rows.find((row) => row.cells.Entity === "Ad Group");
    const keywordRow = rows.find((row) => row.cells.Entity === "Keyword");
    const productAdRow = rows.find((row) => row.cells.Entity === "Product Ad");
    expect(campaignRow?.cells["Campaign ID"]).toBeTruthy();
    expect(adGroupRow?.cells["Campaign ID"]).toBe(campaignRow?.cells["Campaign ID"]);
    expect(adGroupRow?.cells["Ad Group ID"]).toBeTruthy();
    expect(keywordRow?.cells["Campaign ID"]).toBe(campaignRow?.cells["Campaign ID"]);
    expect(keywordRow?.cells["Ad Group ID"]).toBe(adGroupRow?.cells["Ad Group ID"]);
    expect(productAdRow?.cells.State).toBe("Paused");

    const { reviewPath } = writeSpBulkCreateXlsx({
      templatePath,
      outDir,
      rows,
      requiredHeadersBySheet: new Map([[SP_CREATE_SHEET_NAME, ["Entity", "Operation", "Product"]]]),
      writeUpload: false,
    });

    const reviewWorkbook = XLSX.readFile(reviewPath);
    const reviewSheet = reviewWorkbook.Sheets[SP_CREATE_SHEET_NAME];
    const reviewRows = XLSX.utils.sheet_to_json<unknown[]>(reviewSheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    const reviewHeader = reviewRows[0] as string[];
    expect(reviewHeader).toEqual([...headers, ...REVIEW_HELPER_COLUMNS]);

    const manifest = buildCreateManifest({
      actions,
      refs,
      runId: "run-1",
      generator: "bulkgen:sp:create",
      portfolioId: "P1",
    });
    expect(manifest.run_id).toBe("run-1");
    expect(manifest.generator).toBe("bulkgen:sp:create");
    expect(manifest.campaigns[0].name).toBe("Camp 1");
    expect(manifest.campaigns[0].portfolio_id).toBe("P1");
    expect(manifest.campaigns[0].campaign_id).toBeTruthy();
    expect(manifest.ad_groups[0].ad_group_id).toBeTruthy();
    expect(manifest.ad_groups[0].ad_group_name).toBe("AG 1");
    expect(manifest.keywords[0].keyword_text).toBe("blue shoes");
  });
});
