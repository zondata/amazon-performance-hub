import fs from "node:fs";
import path from "node:path";
import { normText } from "../bulk/parseSponsoredProductsBulk";
import { addDaysUtc } from "../ingest/utils";
import { normalizeHeader, parseIntSafe, parseMoney, parsePercent } from "../ads/sdReportUtils";

export type SqpScopeType = "brand" | "asin";

export type SqpWeeklyRow = {
  reporting_date: string;
  search_query_raw: string;
  search_query_norm: string;
  search_query_score: number | null;
  search_query_volume: number | null;

  impressions_total: number | null;
  impressions_self: number | null;
  impressions_self_share: number | null;

  clicks_total: number | null;
  clicks_rate_per_query: number | null;
  clicks_self: number | null;
  clicks_self_share: number | null;
  clicks_price_median_total: number | null;
  clicks_price_median_self: number | null;
  clicks_same_day_ship: number | null;
  clicks_1d_ship: number | null;
  clicks_2d_ship: number | null;

  cart_adds_total: number | null;
  cart_add_rate_per_query: number | null;
  cart_adds_self: number | null;
  cart_adds_self_share: number | null;
  cart_adds_price_median_total: number | null;
  cart_adds_price_median_self: number | null;
  cart_adds_same_day_ship: number | null;
  cart_adds_1d_ship: number | null;
  cart_adds_2d_ship: number | null;

  purchases_total: number | null;
  purchases_rate_per_query: number | null;
  purchases_self: number | null;
  purchases_self_share: number | null;
  purchases_price_median_total: number | null;
  purchases_price_median_self: number | null;
  purchases_same_day_ship: number | null;
  purchases_1d_ship: number | null;
  purchases_2d_ship: number | null;
};

export type SqpWeeklyParseResult = {
  scopeType: SqpScopeType;
  scopeValue: string;
  weekStart: string;
  weekEnd: string;
  coverageStart: string;
  coverageEnd: string;
  rows: SqpWeeklyRow[];
  warnings: string[];
};

type SqpHeaderField = Exclude<keyof SqpWeeklyRow, "search_query_norm">;

const HEADER_ALIASES: Record<SqpHeaderField, string[]> = {
  reporting_date: ["reporting date"],
  search_query_raw: ["search query"],
  search_query_score: ["search query score"],
  search_query_volume: ["search query volume"],

  impressions_total: ["impressions total count", "impressions total"],
  impressions_self: ["impressions brand count", "impressions asin count"],
  impressions_self_share: ["impressions brand share", "impressions asin share"],

  clicks_total: ["clicks total count", "clicks total"],
  clicks_rate_per_query: ["click rate", "click rate per query", "click rate by query volume", "click rate %"],
  clicks_self: ["clicks brand count", "clicks asin count"],
  clicks_self_share: ["clicks brand share", "clicks asin share"],
  clicks_price_median_total: [
    "clicks median price total",
    "click median price total",
    "median price clicked products total",
    "clicked products median price total",
  ],
  clicks_price_median_self: [
    "clicks median price brand",
    "clicks median price asin",
    "click median price brand",
    "click median price asin",
    "median price clicked products brand",
    "median price clicked products asin",
  ],
  clicks_same_day_ship: ["clicks same day shipping", "clicks same day ship"],
  clicks_1d_ship: ["clicks 1 day shipping", "clicks 1 day ship", "clicks one day shipping"],
  clicks_2d_ship: ["clicks 2 day shipping", "clicks 2 day ship", "clicks two day shipping"],

  cart_adds_total: ["cart adds total count", "cart add total count", "add to cart total count"],
  cart_add_rate_per_query: [
    "cart add rate",
    "cart adds rate",
    "cart add rate per query",
    "cart add rate by query volume",
    "cart add rate %",
  ],
  cart_adds_self: ["cart adds brand count", "cart adds asin count", "add to cart brand count", "add to cart asin count"],
  cart_adds_self_share: ["cart adds brand share", "cart adds asin share", "add to cart brand share", "add to cart asin share"],
  cart_adds_price_median_total: [
    "cart adds median price total",
    "cart add median price total",
    "median price cart adds total",
    "median price add to cart total",
  ],
  cart_adds_price_median_self: [
    "cart adds median price brand",
    "cart adds median price asin",
    "cart add median price brand",
    "cart add median price asin",
    "median price cart adds brand",
    "median price cart adds asin",
  ],
  cart_adds_same_day_ship: ["cart adds same day shipping", "cart adds same day ship", "add to cart same day shipping"],
  cart_adds_1d_ship: ["cart adds 1 day shipping", "cart adds 1 day ship", "add to cart 1 day shipping"],
  cart_adds_2d_ship: ["cart adds 2 day shipping", "cart adds 2 day ship", "add to cart 2 day shipping"],

  purchases_total: ["purchases total count", "purchase total count", "orders total count"],
  purchases_rate_per_query: [
    "purchase rate",
    "purchases rate",
    "purchase rate per query",
    "purchase rate by query volume",
    "purchase rate %",
  ],
  purchases_self: ["purchases brand count", "purchases asin count", "orders brand count", "orders asin count"],
  purchases_self_share: ["purchases brand share", "purchases asin share", "orders brand share", "orders asin share"],
  purchases_price_median_total: [
    "purchases median price total",
    "purchase median price total",
    "median price purchases total",
    "median price orders total",
  ],
  purchases_price_median_self: [
    "purchases median price brand",
    "purchases median price asin",
    "purchase median price brand",
    "purchase median price asin",
    "median price purchases brand",
    "median price purchases asin",
  ],
  purchases_same_day_ship: ["purchases same day shipping", "purchases same day ship", "orders same day shipping"],
  purchases_1d_ship: ["purchases 1 day shipping", "purchases 1 day ship", "orders 1 day shipping"],
  purchases_2d_ship: ["purchases 2 day shipping", "purchases 2 day ship", "orders 2 day shipping"],
};

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

function parseDate(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeMetadataKey(rawKey: string): string {
  const normalized = normalizeHeader(rawKey);
  if (normalized === "asin or product") return "asin";
  return normalized;
}

function parseMetadataRow(row: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const cell of row) {
    const text = String(cell ?? "").trim();
    if (!text) continue;
    const match = text.match(/^([^=]+)=\[(.*)\]$/);
    if (!match) continue;
    const key = normalizeMetadataKey(match[1]);
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    value = value.replace(/""/g, '"').trim();
    out[key] = value;
  }
  return out;
}

function resolveScopeType(scopeValueMeta: Record<string, string>, filename: string): SqpScopeType {
  if (scopeValueMeta.brand) return "brand";
  if (scopeValueMeta.asin || scopeValueMeta.product) return "asin";
  if (/brand[_\s-]*view/i.test(filename)) return "brand";
  if (/asin[_\s-]*view/i.test(filename)) return "asin";
  return "brand";
}

function resolveScopeValue(scopeType: SqpScopeType, meta: Record<string, string>): string {
  const raw = scopeType === "brand" ? meta.brand : meta.asin ?? meta.product;
  return String(raw ?? "").trim() || "unknown";
}

function parseWeekRangeFromText(value: string): { weekStart: string; weekEnd: string } | null {
  const match = value.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  return { weekStart: match[1], weekEnd: match[2] };
}

function parseWeekRangeFromFilename(filename: string): { weekStart: string; weekEnd: string } | null {
  const match = filename.match(/_(\d{4})_(\d{2})_(\d{2})\.[^.]+$/i);
  if (!match) return null;
  const weekEnd = `${match[1]}-${match[2]}-${match[3]}`;
  return { weekStart: addDaysUtc(weekEnd, -6), weekEnd };
}

function mapHeaders(headers: string[]): Record<SqpHeaderField, number | undefined> {
  const normalized = headers.map((h) => normalizeHeader(h));
  const out: Record<SqpHeaderField, number | undefined> = {} as Record<
    SqpHeaderField,
    number | undefined
  >;

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[SqpHeaderField, string[]]>) {
    let found: number | undefined;
    for (let i = 0; i < normalized.length; i += 1) {
      if (aliases.includes(normalized[i])) {
        found = i;
        break;
      }
    }
    out[field] = found;
  }

  return out;
}

function asString(row: string[], idx: number | undefined): string {
  if (idx === undefined) return "";
  return String(row[idx] ?? "");
}

function asInt(row: string[], idx: number | undefined): number | null {
  if (idx === undefined) return null;
  return parseIntSafe(row[idx]);
}

function asMoney(row: string[], idx: number | undefined): number | null {
  if (idx === undefined) return null;
  return parseMoney(row[idx]);
}

function asPercent(row: string[], idx: number | undefined): number | null {
  if (idx === undefined) return null;
  return parsePercent(row[idx]);
}

export function parseSqpReport(input: string, filenameHint?: string): SqpWeeklyParseResult {
  const isFilePath = fs.existsSync(input);
  const content = isFilePath ? fs.readFileSync(input, "utf8") : input;
  const filename = filenameHint ?? (isFilePath ? path.basename(input) : "");

  const csvRows = parseCsv(content);
  if (csvRows.length < 2) {
    throw new Error("SQP CSV must contain metadata row and header row.");
  }

  const metadata = parseMetadataRow(csvRows[0] ?? []);
  const headerRow = csvRows[1] ?? [];
  const headerMap = mapHeaders(headerRow);

  const scopeType = resolveScopeType(metadata, filename);
  const scopeValue = resolveScopeValue(scopeType, metadata);

  const rangeFromMeta = parseWeekRangeFromText(metadata["select week"] ?? "");
  const rangeFromFilename = parseWeekRangeFromFilename(filename);
  const resolvedRange = rangeFromMeta ?? rangeFromFilename;
  if (!resolvedRange) {
    throw new Error("Unable to determine SQP week range from metadata or filename.");
  }

  const warnings: string[] = [];
  const rows: SqpWeeklyRow[] = [];

  for (let i = 2; i < csvRows.length; i += 1) {
    const row = csvRows[i] ?? [];
    const searchQueryRaw = asString(row, headerMap.search_query_raw).trim();
    if (!searchQueryRaw) continue;

    const reportingDate = parseDate(asString(row, headerMap.reporting_date));
    if (!reportingDate) continue;

    if (reportingDate !== resolvedRange.weekEnd) {
      warnings.push(
        `Reporting Date mismatch at row ${i + 1}: reporting_date=${reportingDate}, week_end=${resolvedRange.weekEnd}`
      );
    }

    rows.push({
      reporting_date: reportingDate,
      search_query_raw: searchQueryRaw,
      search_query_norm: normText(searchQueryRaw),
      search_query_score: asInt(row, headerMap.search_query_score),
      search_query_volume: asInt(row, headerMap.search_query_volume),

      impressions_total: asInt(row, headerMap.impressions_total),
      impressions_self: asInt(row, headerMap.impressions_self),
      impressions_self_share: asPercent(row, headerMap.impressions_self_share),

      clicks_total: asInt(row, headerMap.clicks_total),
      clicks_rate_per_query: asPercent(row, headerMap.clicks_rate_per_query),
      clicks_self: asInt(row, headerMap.clicks_self),
      clicks_self_share: asPercent(row, headerMap.clicks_self_share),
      clicks_price_median_total: asMoney(row, headerMap.clicks_price_median_total),
      clicks_price_median_self: asMoney(row, headerMap.clicks_price_median_self),
      clicks_same_day_ship: asInt(row, headerMap.clicks_same_day_ship),
      clicks_1d_ship: asInt(row, headerMap.clicks_1d_ship),
      clicks_2d_ship: asInt(row, headerMap.clicks_2d_ship),

      cart_adds_total: asInt(row, headerMap.cart_adds_total),
      cart_add_rate_per_query: asPercent(row, headerMap.cart_add_rate_per_query),
      cart_adds_self: asInt(row, headerMap.cart_adds_self),
      cart_adds_self_share: asPercent(row, headerMap.cart_adds_self_share),
      cart_adds_price_median_total: asMoney(row, headerMap.cart_adds_price_median_total),
      cart_adds_price_median_self: asMoney(row, headerMap.cart_adds_price_median_self),
      cart_adds_same_day_ship: asInt(row, headerMap.cart_adds_same_day_ship),
      cart_adds_1d_ship: asInt(row, headerMap.cart_adds_1d_ship),
      cart_adds_2d_ship: asInt(row, headerMap.cart_adds_2d_ship),

      purchases_total: asInt(row, headerMap.purchases_total),
      purchases_rate_per_query: asPercent(row, headerMap.purchases_rate_per_query),
      purchases_self: asInt(row, headerMap.purchases_self),
      purchases_self_share: asPercent(row, headerMap.purchases_self_share),
      purchases_price_median_total: asMoney(row, headerMap.purchases_price_median_total),
      purchases_price_median_self: asMoney(row, headerMap.purchases_price_median_self),
      purchases_same_day_ship: asInt(row, headerMap.purchases_same_day_ship),
      purchases_1d_ship: asInt(row, headerMap.purchases_1d_ship),
      purchases_2d_ship: asInt(row, headerMap.purchases_2d_ship),
    });
  }

  return {
    scopeType,
    scopeValue,
    weekStart: resolvedRange.weekStart,
    weekEnd: resolvedRange.weekEnd,
    coverageStart: resolvedRange.weekStart,
    coverageEnd: resolvedRange.weekEnd,
    rows,
    warnings,
  };
}
