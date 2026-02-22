import fs from "node:fs";
import { normText } from "../bulk/parseSponsoredProductsBulk";
import { isCategoryTargetingExpression } from "./targetingFilters";

export type SbStisRow = {
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
  customer_search_term_raw: string;
  customer_search_term_norm: string;
  search_term_impression_rank: number | null;
  search_term_impression_share: number | null;
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

export type SbStisParseResult = {
  rows: SbStisRow[];
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
  targeting_raw: [
    "targeting","keyword", "keyword text", "keyword or product targeting", "keyword or product targeting expression"],
  match_type_raw: ["match type"],
  customer_search_term_raw: ["customer search term", "search term"],
  search_term_impression_rank: ["search term impression rank"],
  search_term_impression_share: ["search term impression share", "search term impression share %"],
  impressions: ["impressions"],
  clicks: ["clicks"],
  spend: ["spend", "cost"],
  sales: ["sales", "attributed sales", "total sales", "14 day total sales", "7 day total sales"],
  orders: ["orders", "total orders", "14 day total orders", "7 day total orders"],
  units: ["units", "units sold", "total units", "14 day total units"],
  cpc: ["cpc", "cost per click", "cost per click cpc"],
  ctr: ["ctr", "click through rate", "click thru rate ctr"],
  acos: ["acos"],
  roas: ["roas"],
  conversion_rate: ["conversion rate", "conversion rate 14 day"],
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

function parseIntSafe(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "");
  const num = Number.parseInt(cleaned, 10);
  return Number.isFinite(num) ? num : null;
}

function parseMoney(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[$,]/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parsePercent(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[% ,]/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num / 100 : null;
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
    const year = yearMatch[0];
    return `${year}-${month}-${day}`;
  }
  const monthYearMatch = raw.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/);
  if (monthYearMatch) {
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
    const month = monthMap[monthYearMatch[1].toLowerCase()];
    if (!month) return null;
    const day = monthYearMatch[2].padStart(2, "0");
    const year = monthYearMatch[3];
    return `${year}-${month}-${day}`;
  }
  return null;
}

function normalizeMatchType(raw: string | null): string {
  if (!raw) return "UNKNOWN";
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return "UNKNOWN";
  const norm = trimmed.toUpperCase();
  if (norm.includes("EXACT")) return "EXACT";
  if (norm.includes("PHRASE")) return "PHRASE";
  if (norm.includes("BROAD")) return "BROAD";
  return "UNKNOWN";
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
      if (char === "\r" && content[i + 1] === "\n") {
        i += 1;
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

  if (field.length || current.length) {
    current.push(field);
    if (current.length > 1 || current[0]?.trim()) rows.push(current);
  }

  return rows;
}

export function parseSbStisReport(input: string): SbStisParseResult {
  const content = fs.existsSync(input) ? fs.readFileSync(input, "utf8") : input;
  const rows = parseCsv(content);
  if (!rows.length) return { rows: [], coverageStart: null, coverageEnd: null };

  const headers = rows[0] ?? [];
  const headerMap = mapHeaders(headers);

  const dataRows: SbStisRow[] = [];
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const dateValue = headerMap.date !== undefined ? row[headerMap.date] ?? "" : "";
    const dateNext = headerMap.date !== undefined ? row[headerMap.date + 1] ?? "" : "";
    const date = parseDate(String(dateValue ?? ""), String(dateNext ?? ""));
    if (!date) continue;

    const campaignRaw = headerMap.campaign_name_raw !== undefined ? row[headerMap.campaign_name_raw] ?? "" : "";
    const campaignNameRaw = String(campaignRaw).trim();
    if (!campaignNameRaw) continue;

    const adGroupRaw = headerMap.ad_group_name_raw !== undefined ? row[headerMap.ad_group_name_raw] ?? "" : "";
    const adGroupNameRaw = String(adGroupRaw).trim();
    if (!adGroupNameRaw) continue;

    const targetingRaw = headerMap.targeting_raw !== undefined ? row[headerMap.targeting_raw] ?? "" : "";
    const targetingText = String(targetingRaw).trim();
    if (!targetingText) continue;
    const targetingNorm = normText(targetingText);
    if (isCategoryTargetingExpression(targetingNorm)) continue;

    const searchTermRaw =
      headerMap.customer_search_term_raw !== undefined ? row[headerMap.customer_search_term_raw] ?? "" : "";
    const searchTermText = String(searchTermRaw).trim();
    if (!searchTermText) continue;

    const portfolioRaw = headerMap.portfolio_name_raw !== undefined ? row[headerMap.portfolio_name_raw] ?? "" : "";
    const portfolioNameRaw = String(portfolioRaw ?? "").trim();

    const matchTypeRaw = headerMap.match_type_raw !== undefined
      ? String(row[headerMap.match_type_raw] ?? "").trim()
      : "";
    const matchTypeRawValue = matchTypeRaw ? matchTypeRaw : null;

    dataRows.push({
      date,
      portfolio_name_raw: portfolioNameRaw || null,
      portfolio_name_norm: portfolioNameRaw ? normText(portfolioNameRaw) : null,
      campaign_name_raw: campaignNameRaw,
      campaign_name_norm: normText(campaignNameRaw),
      ad_group_name_raw: adGroupNameRaw,
      ad_group_name_norm: normText(adGroupNameRaw),
      targeting_raw: targetingText,
      targeting_norm: targetingNorm,
      match_type_raw: matchTypeRawValue,
      match_type_norm: normalizeMatchType(matchTypeRawValue),
      customer_search_term_raw: searchTermText,
      customer_search_term_norm: normText(searchTermText),
      search_term_impression_rank:
        headerMap.search_term_impression_rank !== undefined
          ? parseIntSafe(String(row[headerMap.search_term_impression_rank] ?? ""))
          : null,
      search_term_impression_share:
        headerMap.search_term_impression_share !== undefined
          ? parsePercent(String(row[headerMap.search_term_impression_share] ?? ""))
          : null,
      impressions:
        headerMap.impressions !== undefined ? parseIntSafe(String(row[headerMap.impressions] ?? "")) : null,
      clicks: headerMap.clicks !== undefined ? parseIntSafe(String(row[headerMap.clicks] ?? "")) : null,
      spend: headerMap.spend !== undefined ? parseMoney(String(row[headerMap.spend] ?? "")) : null,
      sales: headerMap.sales !== undefined ? parseMoney(String(row[headerMap.sales] ?? "")) : null,
      orders: headerMap.orders !== undefined ? parseIntSafe(String(row[headerMap.orders] ?? "")) : null,
      units: headerMap.units !== undefined ? parseIntSafe(String(row[headerMap.units] ?? "")) : null,
      cpc: headerMap.cpc !== undefined ? parseMoney(String(row[headerMap.cpc] ?? "")) : null,
      ctr: headerMap.ctr !== undefined ? parsePercent(String(row[headerMap.ctr] ?? "")) : null,
      acos: headerMap.acos !== undefined ? parsePercent(String(row[headerMap.acos] ?? "")) : null,
      roas: headerMap.roas !== undefined ? parseMoney(String(row[headerMap.roas] ?? "")) : null,
      conversion_rate:
        headerMap.conversion_rate !== undefined ? parsePercent(String(row[headerMap.conversion_rate] ?? "")) : null,
    });

    if (!coverageStart || date < coverageStart) coverageStart = date;
    if (!coverageEnd || date > coverageEnd) coverageEnd = date;
  }

  return { rows: dataRows, coverageStart, coverageEnd };
}
