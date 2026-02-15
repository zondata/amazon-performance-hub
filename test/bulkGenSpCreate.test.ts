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
      "Campaign Name",
      "Daily Budget",
      "State",
      "Ad Group Name",
      "Keyword Text",
      "Match Type",
      "Bid",
      "SKU",
      "ASIN",
    ];

    makeTemplate(templatePath, headers);

    const actions: SpCreateAction[] = [
      { type: "create_campaign", name: "Camp 1", daily_budget: 10 },
    ];
    const refs = resolveCreateRefs(actions);
    const rows = buildUploadRows({
      actions,
      refs,
      allowEnabled: false,
      maxBudget: 50,
      maxBid: 2,
    });

    const { uploadPath } = writeSpBulkCreateXlsx({
      templatePath,
      outDir,
      rows,
      requiredHeadersBySheet: new Map([
        [SP_CREATE_SHEET_NAME, ["Entity", "Operation", "Product", "Campaign Name", "Daily Budget", "State"]],
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
      { type: "create_campaign", name: "Camp 1", daily_budget: 10 },
    ];
    const refs = resolveCreateRefs(actions);
    const rows = buildUploadRows({
      actions,
      refs,
      allowEnabled: false,
      maxBudget: 50,
      maxBid: 2,
    });
    expect(rows[0].cells.State).toBe("Paused");
  });

  it("enforces budget and bid caps", () => {
    const actions: SpCreateAction[] = [
      { type: "create_campaign", name: "Camp 1", daily_budget: 60 },
    ];
    const refs = resolveCreateRefs(actions);
    expect(() =>
      buildUploadRows({
        actions,
        refs,
        allowEnabled: false,
        maxBudget: 50,
        maxBid: 2,
      })
    ).toThrow(/max budget cap/i);

    const actions2: SpCreateAction[] = [
      {
        type: "create_keyword",
        campaign_name: "Camp 1",
        ad_group_name: "AG 1",
        keyword_text: "blue shoes",
        match_type: "Exact",
        bid: 5,
      },
    ];
    const refs2 = resolveCreateRefs(actions2);
    expect(() =>
      buildUploadRows({
        actions: actions2,
        refs: refs2,
        allowEnabled: false,
        maxBudget: 50,
        maxBid: 2,
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
      "Campaign Name",
      "Daily Budget",
      "State",
      "Ad Group Name",
      "Keyword Text",
      "Match Type",
      "Bid",
      "SKU",
      "ASIN",
    ];

    makeTemplate(templatePath, headers);

    const actions: SpCreateAction[] = [
      { type: "create_campaign", name: "Camp 1", daily_budget: 10, temp_id: "c1" },
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
        bid: 1.2,
      },
    ];
    const refs = resolveCreateRefs(actions);
    const rows = buildUploadRows({
      actions,
      refs,
      allowEnabled: false,
      maxBudget: 50,
      maxBid: 2,
    });

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
    });
    expect(manifest.run_id).toBe("run-1");
    expect(manifest.generator).toBe("bulkgen:sp:create");
    expect(manifest.campaigns[0].name).toBe("Camp 1");
    expect(manifest.ad_groups[0].ad_group_name).toBe("AG 1");
    expect(manifest.keywords[0].keyword_text).toBe("blue shoes");
  });
});
