import fs from "node:fs";
import { normText } from "../bulk/parseSponsoredProductsBulk";
import { normalizeHeader, parseDateCell, parseIntSafe, parseMoney } from "./sdReportUtils";

export type SbAttributedPurchasesRow = {
  date: string;
  campaign_id: string;
  campaign_name_raw: string;
  campaign_name_norm: string;
  purchased_sku_raw: string | null;
  purchased_sku_norm: string | null;
  purchased_asin_raw: string;
  purchased_asin_norm: string;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
};

export type SbAttributedPurchasesParseResult = {
  rows: SbAttributedPurchasesRow[];
  coverageStart: string | null;
  coverageEnd: string | null;
};

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "start date"],
  campaign_id: ["campaign id", "campaign id informational only"],
  campaign_name_raw: ["campaign name", "campaign"],
  purchased_asin_raw: [
    "purchased asin",
    "purchased asin informational only",
    "purchased product asin",
    "asin",
  ],
  purchased_sku_raw: ["purchased sku", "purchased product sku", "sku"],
  impressions: ["impressions"],
  clicks: ["clicks"],
  spend: ["spend", "cost"],
  sales: [
    "sales",
    "attributed sales",
    "total sales",
    "14 day total sales",
    "7 day total sales",
    "attributed sales 14d",
    "attributed sales 7d",
  ],
  orders: [
    "orders",
    "purchases",
    "total orders",
    "14 day total orders",
    "7 day total orders",
    "attributed purchases 14d",
    "attributed purchases 7d",
    "attributed orders 14d",
  ],
  units: [
    "units",
    "units sold",
    "total units",
    "14 day total units",
    "7 day total units",
    "attributed units 14d",
    "attributed units 7d",
  ],
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
    return String(value);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const withoutExcelSuffix = raw.match(/^(\d+)\.0+$/);
  if (withoutExcelSuffix) return withoutExcelSuffix[1];
  return raw;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (char === '"') {
      const next = content[i + 1];
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      current.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && content[i + 1] === "\n") i += 1;
      current.push(field);
      field = "";
      if (current.length > 1 || current[0]?.trim()) rows.push(current);
      current = [];
      continue;
    }

    field += char;
  }

  if (field.length || current.length) {
    current.push(field);
    if (current.length > 1 || current[0]?.trim()) rows.push(current);
  }

  return rows;
}

export function parseSbAttributedPurchasesReport(input: string): SbAttributedPurchasesParseResult {
  const content = fs.existsSync(input) ? fs.readFileSync(input, "utf8") : input;
  const matrix = parseCsv(content);
  if (matrix.length <= 1) return { rows: [], coverageStart: null, coverageEnd: null };

  const headers = matrix[0] ?? [];
  const headerMap = mapHeaders(headers);

  const rows: SbAttributedPurchasesRow[] = [];
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;

  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i] ?? [];

    const dateValue = headerMap.date !== undefined ? row[headerMap.date] ?? "" : "";
    const date = parseDateCell(String(dateValue ?? ""));
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

    const purchasedAsinRaw =
      headerMap.purchased_asin_raw !== undefined
        ? String(row[headerMap.purchased_asin_raw] ?? "").trim()
        : "";
    if (!purchasedAsinRaw) continue;

    const purchasedSkuRaw =
      headerMap.purchased_sku_raw !== undefined
        ? String(row[headerMap.purchased_sku_raw] ?? "").trim()
        : "";
    const purchasedSkuNorm = purchasedSkuRaw ? normText(purchasedSkuRaw) : null;

    rows.push({
      date,
      campaign_id: campaignId,
      campaign_name_raw: campaignNameRaw,
      campaign_name_norm: campaignNameNorm,
      purchased_sku_raw: purchasedSkuRaw || null,
      purchased_sku_norm: purchasedSkuNorm,
      purchased_asin_raw: purchasedAsinRaw,
      purchased_asin_norm: purchasedAsinRaw.trim().toUpperCase(),
      impressions: headerMap.impressions !== undefined ? parseIntSafe(row[headerMap.impressions]) : null,
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
