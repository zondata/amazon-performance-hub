import fs from "node:fs";
import * as XLSX from "xlsx";
import { normText } from "../bulk/parseSponsoredProductsBulk";
import {
  ensureWorksheetRef,
  normalizeHeader,
  parseDateCell,
  parseIntSafe,
  parseMoney,
  parsePercent,
} from "./sdReportUtils";

export type SdTargetingRow = {
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
  cost_type: string | null;
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

export type SdTargetingParseResult = {
  rows: SdTargetingRow[];
  coverageStart: string | null;
  coverageEnd: string | null;
};

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "start date"],
  portfolio_name_raw: ["portfolio name", "portfolio"],
  campaign_name_raw: ["campaign name", "campaign"],
  ad_group_name_raw: ["ad group name", "ad group"],
  targeting_raw: [
    "targeting",
    "targeting expression",
    "audience",
    "contextual targeting",
    "targeting criteria",
  ],
  match_type_raw: ["match type"],
  cost_type: ["cost type", "cost type (billing)"],
  impressions: ["impressions"],
  clicks: ["clicks"],
  spend: ["spend", "cost"],
  sales: ["sales", "attributed sales", "total sales", "14 day total sales", "7 day total sales"],
  orders: ["orders", "total orders", "14 day total orders", "7 day total orders"],
  units: ["units", "units sold", "total units", "14 day total units"],
  cpc: ["cpc", "cost per click"],
  ctr: ["ctr", "click through rate", "click thru rate ctr"],
  acos: ["acos", "total advertising cost of sales acos"],
  roas: ["roas", "total return on advertising spend roas"],
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

export function parseSdTargetingReport(input: string): SdTargetingParseResult {
  const isFile = fs.existsSync(input);
  const workbook = isFile
    ? XLSX.readFile(input, { dense: true, cellDates: true })
    : XLSX.read(input, { type: "string", dense: true, cellDates: true });

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

  const rows: SdTargetingRow[] = [];
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;

  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i] ?? [];
    const dateValue = headerMap.date !== undefined ? row[headerMap.date] ?? "" : "";
    const date = parseDateCell(dateValue);
    if (!date) continue;

    const campaignRaw =
      headerMap.campaign_name_raw !== undefined ? row[headerMap.campaign_name_raw] ?? "" : "";
    const campaignNameRaw = String(campaignRaw).trim();
    if (!campaignNameRaw) continue;

    const adGroupRaw =
      headerMap.ad_group_name_raw !== undefined ? row[headerMap.ad_group_name_raw] ?? "" : "";
    const adGroupNameRaw = String(adGroupRaw).trim();
    if (!adGroupNameRaw) continue;

    const targetingRaw =
      headerMap.targeting_raw !== undefined ? row[headerMap.targeting_raw] ?? "" : "";
    const targetingText = String(targetingRaw).trim();
    if (!targetingText) continue;

    const portfolioRaw =
      headerMap.portfolio_name_raw !== undefined ? row[headerMap.portfolio_name_raw] ?? "" : "";
    const portfolioNameRaw = String(portfolioRaw ?? "").trim();

    const matchTypeRaw =
      headerMap.match_type_raw !== undefined
        ? String(row[headerMap.match_type_raw] ?? "").trim()
        : "";
    const matchTypeRawValue = matchTypeRaw ? matchTypeRaw : null;

    const costTypeRaw =
      headerMap.cost_type !== undefined ? String(row[headerMap.cost_type] ?? "").trim() : "";

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
      match_type_raw: matchTypeRawValue,
      match_type_norm: normalizeMatchType(matchTypeRawValue),
      cost_type: costTypeRaw || null,
      impressions:
        headerMap.impressions !== undefined
          ? parseIntSafe(row[headerMap.impressions])
          : null,
      clicks:
        headerMap.clicks !== undefined ? parseIntSafe(row[headerMap.clicks]) : null,
      spend:
        headerMap.spend !== undefined ? parseMoney(row[headerMap.spend]) : null,
      sales:
        headerMap.sales !== undefined ? parseMoney(row[headerMap.sales]) : null,
      orders:
        headerMap.orders !== undefined ? parseIntSafe(row[headerMap.orders]) : null,
      units:
        headerMap.units !== undefined ? parseIntSafe(row[headerMap.units]) : null,
      cpc: headerMap.cpc !== undefined ? parseMoney(row[headerMap.cpc]) : null,
      ctr: headerMap.ctr !== undefined ? parsePercent(row[headerMap.ctr]) : null,
      acos: headerMap.acos !== undefined ? parsePercent(row[headerMap.acos]) : null,
      roas: headerMap.roas !== undefined ? parseMoney(row[headerMap.roas]) : null,
      conversion_rate:
        headerMap.conversion_rate !== undefined
          ? parsePercent(row[headerMap.conversion_rate])
          : null,
    });

    if (!coverageStart || date < coverageStart) coverageStart = date;
    if (!coverageEnd || date > coverageEnd) coverageEnd = date;
  }

  return { rows, coverageStart, coverageEnd };
}
