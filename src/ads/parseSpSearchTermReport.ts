import fs from "node:fs";

import { normText } from "../bulk/parseSponsoredProductsBulk";

export type SpSearchTermRow = {
  date: string;
  portfolio_name_raw: string | null;
  portfolio_name_norm: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  ad_group_name_raw: string;
  ad_group_name_norm: string;
  targeting_raw: string;
  targeting_norm: string;
  match_type_raw: string | null;
  match_type_norm: string | null;
  keyword_type: string | null;
  target_status: string | null;
  search_term_raw: string;
  search_term_norm: string;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
  cpc: number | null;
  ctr: number | null;
  acos: number | null;
  roas: number | null;
  conversion_rate: number | null;
};

export type SpSearchTermParseResult = {
  rows: SpSearchTermRow[];
  coverageStart: string | null;
  coverageEnd: string | null;
};

function normalizeHeader(value: string): string {
  const trimmed = value.replace(/^\uFEFF/, "");
  return trimmed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "start date"],
  portfolio_name_raw: ["portfolio name", "portfolio"],
  campaign_name_raw: ["campaign name", "campaign"],
  ad_group_name_raw: ["ad group name", "ad group"],
  targeting_raw: ["targeting", "keyword", "keyword or product targeting", "keyword or product targeting expression"],
  match_type_raw: ["match type"],
  keyword_type: ["keyword type"],
  target_status: ["target status", "ad keyword status", "status"],
  search_term_raw: ["search term", "customer search term"],
  impressions: ["impressions"],
  clicks: ["clicks"],
  spend: ["spend", "cost"],
  sales: ["sales", "attributed sales", "total sales", "14 day total sales", "7 day total sales"],
  orders: ["orders", "total orders", "14 day total orders", "7 day total orders"],
  units: ["units", "units sold", "total units", "14 day total units", "7 day total units"],
  cpc: ["cpc", "cost per click"],
  ctr: ["ctr", "click through rate"],
  acos: ["acos"],
  roas: ["roas"],
  conversion_rate: ["conversion rate", "purchase click rate 14 day", "conversion rate 14 day"],
};

function mapHeaders(headers: string[]): Record<string, number> {
  const normalized = headers.map((header) => normalizeHeader(header));
  const indexMap: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (let index = 0; index < normalized.length; index += 1) {
      if (aliases.includes(normalized[index])) {
        indexMap[field] = index;
        break;
      }
    }
  }
  return indexMap;
}

function parseIntSafe(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "");
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMoney(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[$,]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[% ,]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed / 100 : null;
}

function parseDate(value: string, nextValue?: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw;
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }
  const monthOnlyMatch = raw.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (monthOnlyMatch) {
    const yearRaw = (nextValue ?? "").trim();
    const yearMatch = yearRaw.match(/^\d{4}$/);
    if (!yearMatch) return null;
    const monthMap: Record<string, string> = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };
    const month = monthMap[monthOnlyMatch[1].toLowerCase()];
    if (!month) return null;
    const day = monthOnlyMatch[2].padStart(2, "0");
    return `${yearMatch[0]}-${month}-${day}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizeMatchType(raw: string): string {
  const normalized = raw.trim().toUpperCase();
  if (normalized.includes("EXACT")) return "EXACT";
  if (normalized.includes("PHRASE")) return "PHRASE";
  if (normalized.includes("BROAD")) return "BROAD";
  if (normalized.includes("AUTO")) return "UNKNOWN";
  return "UNKNOWN";
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === "\"") {
      const next = content[index + 1];
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
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
      if (char === "\r" && content[index + 1] === "\n") {
        index += 1;
      }
      current.push(field);
      field = "";
      if (current.length > 1 || current[0]?.trim()) {
        rows.push(current);
      }
      current = [];
      continue;
    }
    field += char;
  }

  current.push(field);
  if (current.length > 1 || current[0]?.trim()) {
    rows.push(current);
  }
  return rows;
}

export function parseSpSearchTermReport(input: string): SpSearchTermParseResult {
  const content = fs.existsSync(input) ? fs.readFileSync(input, "utf8") : input;
  const matrix = parseCsv(content);
  if (!matrix.length) {
    return { rows: [], coverageStart: null, coverageEnd: null };
  }

  const headers = (matrix[0] ?? []).map((value) => String(value ?? ""));
  const headerMap = mapHeaders(headers);
  const rows: SpSearchTermRow[] = [];
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;

  for (let index = 1; index < matrix.length; index += 1) {
    const row = matrix[index] ?? [];
    const dateValue = headerMap.date !== undefined ? row[headerMap.date] ?? "" : "";
    const date = parseDate(String(dateValue ?? ""), headerMap.date !== undefined ? String(row[headerMap.date + 1] ?? "") : "");
    if (!date) continue;

    const campaignNameRaw = String(
      headerMap.campaign_name_raw !== undefined ? row[headerMap.campaign_name_raw] ?? "" : ""
    ).trim();
    const adGroupNameRaw = String(
      headerMap.ad_group_name_raw !== undefined ? row[headerMap.ad_group_name_raw] ?? "" : ""
    ).trim();
    const targetingRaw = String(
      headerMap.targeting_raw !== undefined ? row[headerMap.targeting_raw] ?? "" : ""
    ).trim();
    const searchTermRaw = String(
      headerMap.search_term_raw !== undefined ? row[headerMap.search_term_raw] ?? "" : ""
    ).trim();

    if (!campaignNameRaw || !adGroupNameRaw || !targetingRaw || !searchTermRaw) continue;

    const portfolioNameRaw = String(
      headerMap.portfolio_name_raw !== undefined ? row[headerMap.portfolio_name_raw] ?? "" : ""
    ).trim();
    const matchTypeRaw = String(
      headerMap.match_type_raw !== undefined ? row[headerMap.match_type_raw] ?? "" : ""
    ).trim();
    const keywordType = String(
      headerMap.keyword_type !== undefined ? row[headerMap.keyword_type] ?? "" : ""
    ).trim();
    const targetStatus = String(
      headerMap.target_status !== undefined ? row[headerMap.target_status] ?? "" : ""
    ).trim();

    rows.push({
      date,
      portfolio_name_raw: portfolioNameRaw || null,
      portfolio_name_norm: portfolioNameRaw ? normText(portfolioNameRaw) : null,
      campaign_name_raw: campaignNameRaw,
      campaign_name_norm: normText(campaignNameRaw),
      ad_group_name_raw: adGroupNameRaw,
      ad_group_name_norm: normText(adGroupNameRaw),
      targeting_raw: targetingRaw,
      targeting_norm: normText(targetingRaw),
      match_type_raw: matchTypeRaw || null,
      match_type_norm: matchTypeRaw ? normalizeMatchType(matchTypeRaw) : "UNKNOWN",
      keyword_type: keywordType || null,
      target_status: targetStatus || null,
      search_term_raw: searchTermRaw,
      search_term_norm: normText(searchTermRaw),
      impressions:
        headerMap.impressions !== undefined
          ? parseIntSafe(String(row[headerMap.impressions] ?? ""))
          : null,
      clicks:
        headerMap.clicks !== undefined
          ? parseIntSafe(String(row[headerMap.clicks] ?? ""))
          : null,
      spend:
        headerMap.spend !== undefined
          ? parseMoney(String(row[headerMap.spend] ?? ""))
          : null,
      sales:
        headerMap.sales !== undefined
          ? parseMoney(String(row[headerMap.sales] ?? ""))
          : null,
      orders:
        headerMap.orders !== undefined
          ? parseIntSafe(String(row[headerMap.orders] ?? ""))
          : null,
      units:
        headerMap.units !== undefined
          ? parseIntSafe(String(row[headerMap.units] ?? ""))
          : null,
      cpc:
        headerMap.cpc !== undefined
          ? parseMoney(String(row[headerMap.cpc] ?? ""))
          : null,
      ctr:
        headerMap.ctr !== undefined
          ? parsePercent(String(row[headerMap.ctr] ?? ""))
          : null,
      acos:
        headerMap.acos !== undefined
          ? parsePercent(String(row[headerMap.acos] ?? ""))
          : null,
      roas:
        headerMap.roas !== undefined
          ? parseMoney(String(row[headerMap.roas] ?? ""))
          : null,
      conversion_rate:
        headerMap.conversion_rate !== undefined
          ? parsePercent(String(row[headerMap.conversion_rate] ?? ""))
          : null,
    });

    if (!coverageStart || date < coverageStart) coverageStart = date;
    if (!coverageEnd || date > coverageEnd) coverageEnd = date;
  }

  return { rows, coverageStart, coverageEnd };
}
