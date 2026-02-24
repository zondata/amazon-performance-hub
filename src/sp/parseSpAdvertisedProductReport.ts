import fs from "node:fs";
import * as XLSX from "xlsx";
import { normText } from "../bulk/parseSponsoredProductsBulk";
import {
  ensureWorksheetRef,
  normalizeHeader,
  parseDateCell,
  parseIntSafe,
  parseMoney,
} from "../ads/sdReportUtils";

export type SpAdvertisedProductRow = {
  date: string;
  campaign_id: string;
  ad_group_id: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  ad_group_name_raw: string | null;
  ad_group_name_norm: string | null;
  advertised_asin_raw: string;
  advertised_asin_norm: string;
  sku_raw: string | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
};

export type SpAdvertisedProductParseResult = {
  rows: SpAdvertisedProductRow[];
  coverageStart: string | null;
  coverageEnd: string | null;
};

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "start date"],
  campaign_id: ["campaign id", "campaign id informational only"],
  ad_group_id: ["ad group id", "ad group id informational only"],
  campaign_name_raw: ["campaign name", "campaign"],
  ad_group_name_raw: ["ad group name", "ad group"],
  advertised_asin_raw: ["advertised asin", "asin", "advertised product asin"],
  sku_raw: ["advertised sku", "sku", "advertised product sku"],
  impressions: ["impressions"],
  clicks: ["clicks"],
  spend: ["spend", "cost"],
  sales: ["sales", "attributed sales", "total sales", "14 day total sales", "7 day total sales"],
  orders: ["orders", "total orders", "14 day total orders", "7 day total orders"],
  units: ["units", "units sold", "total units", "14 day total units", "7 day total units"],
};

function mapHeaders(headers: string[]): Record<string, number> {
  const normalized = headers.map((h) => normalizeHeader(h));
  const indexMap: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (let i = 0; i < normalized.length; i += 1) {
      if (aliases.includes(normalized[i])) {
        indexMap[field] = i;
        break;
      }
    }
  }
  return indexMap;
}

function normalizeId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const withoutExcelSuffix = raw.match(/^(\d+)\.0+$/);
  if (withoutExcelSuffix) {
    return withoutExcelSuffix[1];
  }
  return raw;
}

function readWorkbook(input: string | Buffer): XLSX.WorkBook {
  if (Buffer.isBuffer(input)) {
    return XLSX.read(input, { type: "buffer", dense: true, cellDates: true });
  }
  const isFile = fs.existsSync(input);
  if (isFile) {
    return XLSX.readFile(input, { dense: true, cellDates: true });
  }
  return XLSX.read(input, { type: "string", dense: true, cellDates: true });
}

export function parseSpAdvertisedProductReport(input: string | Buffer): SpAdvertisedProductParseResult {
  const workbook = readWorkbook(input);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { rows: [], coverageStart: null, coverageEnd: null };

  ensureWorksheetRef(sheet);

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
    header: 1,
    raw: true,
    blankrows: false,
  });
  if (matrix.length <= 1) return { rows: [], coverageStart: null, coverageEnd: null };

  const headers = (matrix[0] ?? []).map((value) => String(value ?? ""));
  const headerMap = mapHeaders(headers);

  const rows: SpAdvertisedProductRow[] = [];
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;

  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i] ?? [];
    const dateValue = headerMap.date !== undefined ? row[headerMap.date] ?? "" : "";
    const date = parseDateCell(dateValue);
    if (!date) continue;

    const campaignNameRaw =
      headerMap.campaign_name_raw !== undefined
        ? String(row[headerMap.campaign_name_raw] ?? "").trim()
        : "";
    if (!campaignNameRaw) continue;
    const campaignNameNorm = normText(campaignNameRaw);
    if (!campaignNameNorm) continue;

    const campaignIdFromFile =
      headerMap.campaign_id !== undefined ? normalizeId(row[headerMap.campaign_id]) : null;
    const campaignId = campaignIdFromFile ?? `name:${campaignNameNorm}`;

    const adGroupId =
      headerMap.ad_group_id !== undefined ? normalizeId(row[headerMap.ad_group_id]) : null;

    const adGroupNameRaw =
      headerMap.ad_group_name_raw !== undefined
        ? String(row[headerMap.ad_group_name_raw] ?? "").trim()
        : "";

    const advertisedAsinRaw =
      headerMap.advertised_asin_raw !== undefined
        ? String(row[headerMap.advertised_asin_raw] ?? "").trim()
        : "";
    if (!advertisedAsinRaw) continue;

    const skuRaw =
      headerMap.sku_raw !== undefined ? String(row[headerMap.sku_raw] ?? "").trim() : "";

    rows.push({
      date,
      campaign_id: campaignId,
      ad_group_id: adGroupId || null,
      campaign_name_raw: campaignNameRaw,
      campaign_name_norm: campaignNameNorm,
      ad_group_name_raw: adGroupNameRaw || null,
      ad_group_name_norm: adGroupNameRaw ? normText(adGroupNameRaw) : null,
      advertised_asin_raw: advertisedAsinRaw,
      advertised_asin_norm: advertisedAsinRaw.trim().toUpperCase(),
      sku_raw: skuRaw || null,
      impressions:
        headerMap.impressions !== undefined ? parseIntSafe(row[headerMap.impressions]) : null,
      clicks: headerMap.clicks !== undefined ? parseIntSafe(row[headerMap.clicks]) : null,
      spend: headerMap.spend !== undefined ? parseMoney(row[headerMap.spend]) : null,
      sales: headerMap.sales !== undefined ? parseMoney(row[headerMap.sales]) : null,
      orders: headerMap.orders !== undefined ? parseIntSafe(row[headerMap.orders]) : null,
      units: headerMap.units !== undefined ? parseIntSafe(row[headerMap.units]) : null,
    });

    if (!coverageStart || date < coverageStart) coverageStart = date;
    if (!coverageEnd || date > coverageEnd) coverageEnd = date;
  }

  return { rows, coverageStart, coverageEnd };
}
