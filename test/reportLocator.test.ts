import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  findBulkXlsx,
  getSpCampaignCsv,
  getSbCampaignXlsx,
  getSdCampaignXlsx,
  getScaleInsightsSalesTrendCsvFiles,
} from "../src/fs/reportLocator";

function touch(filePath: string, mtimeMs: number) {
  fs.writeFileSync(filePath, "test");
  fs.utimesSync(filePath, mtimeMs / 1000, mtimeMs / 1000);
}

describe("reportLocator", () => {
  it("returns the only bulk file", () => {
    const tmpDir = path.resolve(__dirname, "tmp", `bulk-one-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, "bulk-single.xlsx");
    fs.writeFileSync(filePath, "test");

    const found = findBulkXlsx(tmpDir);
    expect(found).toBe(filePath);
  });

  it("picks the newest bulk file by mtime", () => {
    const tmpDir = path.resolve(__dirname, "tmp", `bulk-multi-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const oldFile = path.join(tmpDir, "bulk-old.xlsx");
    const newFile = path.join(tmpDir, "bulk-new.xlsx");
    const baseTime = Date.now();
    touch(oldFile, baseTime - 10000);
    touch(newFile, baseTime + 10000);

    const found = findBulkXlsx(tmpDir);
    expect(found).toBe(newFile);
  });

  it("throws when fixed campaign csv is missing", () => {
    const tmpDir = path.resolve(__dirname, "tmp", `fixed-missing-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    expect(() => getSpCampaignCsv(tmpDir)).toThrow(/Missing Sponsored Products Campaign report/);
  });

  it("throws when SB campaign xlsx is missing", () => {
    const tmpDir = path.resolve(__dirname, "tmp", `sb-campaign-missing-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    expect(() => getSbCampaignXlsx(tmpDir)).toThrow(/Missing Sponsored Brands Campaign report/);
  });

  it("throws when SD campaign xlsx is missing", () => {
    const tmpDir = path.resolve(__dirname, "tmp", `sd-campaign-missing-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    expect(() => getSdCampaignXlsx(tmpDir)).toThrow(/Missing Sponsored Display Campaign report/);
  });

  it("finds Scale Insights SalesTrend csv files", () => {
    const tmpDir = path.resolve(__dirname, "tmp", `si-sales-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const fileA = path.join(tmpDir, "B0B2K57W5R SalesTrend - Retirement.csv");
    const fileB = path.join(tmpDir, "B0FYPRWPN1 salestrend.csv");
    fs.writeFileSync(fileA, "test");
    fs.writeFileSync(fileB, "test");

    const found = getScaleInsightsSalesTrendCsvFiles(tmpDir);
    expect(found).toEqual([fileA, fileB]);
  });
});
