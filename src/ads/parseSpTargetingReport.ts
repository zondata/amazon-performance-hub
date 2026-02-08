import fs from "node:fs";
import * as XLSX from "xlsx";
import { normText } from "../bulk/parseSponsoredProductsBulk";

export type SpTargetingRow = {
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
  top_of_search_impression_share: number | null;
};

export type SpTargetingParseResult = {
  rows: SpTargetingRow[];
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
  targeting_raw: ["targeting", "keyword or product targeting", "keyword or product targeting expression"],
  match_type_raw: ["match type"],
  impressions: ["impressions"],
  clicks: ["clicks"],
  spend: ["spend", "cost"],
  sales: ["sales", "attributed sales", "total sales", "14 day total sales", "7 day total sales"],
  orders: ["orders", "total orders", "14 day total orders", "7 day total orders"],
  units: ["units", "units sold", "total units", "14 day total units"],
  cpc: ["cpc", "cost per click"],
  ctr: ["ctr", "click through rate"],
  acos: ["acos"],
  roas: ["roas"],
  conversion_rate: ["conversion rate", "conversion rate 14 day"],
  top_of_search_impression_share: ["top of search impression share", "top of search impression share %"],
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

function parseDate(value: string): string | null {
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
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeMatchType(raw: string): string {
  const norm = raw.trim().toUpperCase();
  if (norm.includes("EXACT")) return "EXACT";
  if (norm.includes("PHRASE")) return "PHRASE";
  if (norm.includes("BROAD")) return "BROAD";
  return "UNKNOWN";
}

export function parseSpTargetingReport(input: string): SpTargetingParseResult {
  const isFile = fs.existsSync(input);
  const workbook = isFile ? XLSX.readFile(input, { dense: true }) : XLSX.read(input, { type: "string", dense: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { rows: [], coverageStart: null, coverageEnd: null };

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
  });

  if (!matrix.length) return { rows: [], coverageStart: null, coverageEnd: null };

  const headers = (matrix[0] ?? []).map((value) => String(value ?? ""));
  const headerMap = mapHeaders(headers);

  const rows: SpTargetingRow[] = [];
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;

  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i] ?? [];
    const dateValue = headerMap.date !== undefined ? row[headerMap.date] ?? "" : "";
    const date = parseDate(String(dateValue ?? ""));
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

    const portfolioRaw = headerMap.portfolio_name_raw !== undefined ? row[headerMap.portfolio_name_raw] ?? "" : "";
    const portfolioNameRaw = String(portfolioRaw ?? "").trim();

    const matchTypeRaw = headerMap.match_type_raw !== undefined
      ? String(row[headerMap.match_type_raw] ?? "").trim()
      : "";

    rows.push({
      date,
      portfolio_name_raw: portfolioNameRaw || null,
      portfolio_name_norm: portfolioNameRaw ? normText(portfolioNameRaw) : null,
      campaign_name_raw: campaignNameRaw,
      campaign_name_norm: normText(campaignNameRaw),
      ad_group_name_raw: adGroupNameRaw,
      ad_group_name_norm: normText(adGroupNameRaw),
      targeting_raw: targetingText,
      targeting_norm: normText(targetingText),
      match_type_raw: matchTypeRaw || null,
      match_type_norm: matchTypeRaw ? normalizeMatchType(matchTypeRaw) : "UNKNOWN",
      impressions: headerMap.impressions !== undefined
        ? parseIntSafe(String(row[headerMap.impressions] ?? ""))
        : null,
      clicks: headerMap.clicks !== undefined
        ? parseIntSafe(String(row[headerMap.clicks] ?? ""))
        : null,
      spend: headerMap.spend !== undefined
        ? parseMoney(String(row[headerMap.spend] ?? ""))
        : null,
      sales: headerMap.sales !== undefined
        ? parseMoney(String(row[headerMap.sales] ?? ""))
        : null,
      orders: headerMap.orders !== undefined
        ? parseIntSafe(String(row[headerMap.orders] ?? ""))
        : null,
      units: headerMap.units !== undefined
        ? parseIntSafe(String(row[headerMap.units] ?? ""))
        : null,
      cpc: headerMap.cpc !== undefined
        ? parseMoney(String(row[headerMap.cpc] ?? ""))
        : null,
      ctr: headerMap.ctr !== undefined
        ? parsePercent(String(row[headerMap.ctr] ?? ""))
        : null,
      acos: headerMap.acos !== undefined
        ? parsePercent(String(row[headerMap.acos] ?? ""))
        : null,
      roas: headerMap.roas !== undefined
        ? parseMoney(String(row[headerMap.roas] ?? ""))
        : null,
      conversion_rate: headerMap.conversion_rate !== undefined
        ? parsePercent(String(row[headerMap.conversion_rate] ?? ""))
        : null,
      top_of_search_impression_share: headerMap.top_of_search_impression_share !== undefined
        ? parsePercent(String(row[headerMap.top_of_search_impression_share] ?? ""))
        : null,
    });

    if (!coverageStart || date < coverageStart) coverageStart = date;
    if (!coverageEnd || date > coverageEnd) coverageEnd = date;
  }

  return { rows, coverageStart, coverageEnd };
}
