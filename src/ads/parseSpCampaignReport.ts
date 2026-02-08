import fs from "node:fs";
import { normText } from "../bulk/parseSponsoredProductsBulk";

export type SpCampaignRow = {
  date: string;
  startTime: string | null;
  portfolio_name_raw: string | null;
  portfolio_name_norm: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
};

export type SpCampaignParseResult = {
  rows: SpCampaignRow[];
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

// Supported header variations (normalized):
// date: "date", "date utc", "start date"
// end date: "end date"
// start time: "start time"
// portfolio: "portfolio name"
// campaign: "campaign name", "campaign"
// impressions: "impressions"
// clicks: "clicks"
// spend: "spend", "cost"
// sales: "sales", "attributed sales", "total sales", "14 day total sales", "7 day total sales"
// orders: "orders", "orders 14 day", "14 day total orders", "7 day total orders"
// units: "units", "units sold", "14 day total units"
const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "date utc", "start date"],
  end_date: ["end date"],
  start_time: ["start time"],
  portfolio_name_raw: ["portfolio name"],
  campaign_name_raw: ["campaign name", "campaign"],
  impressions: ["impressions"],
  clicks: ["clicks"],
  spend: ["spend", "cost"],
  sales: ["sales", "attributed sales", "total sales", "14 day total sales", "7 day total sales"],
  orders: ["orders", "orders 14 day", "14 day total orders", "7 day total orders"],
  units: ["units", "units sold", "14 day total units"],
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

function parseTime(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const hm = raw.match(/^(\d{1,2}):(\d{2})/);
  if (hm) {
    return `${hm[1].padStart(2, "0")}:${hm[2]}`;
  }
  const parsed = new Date(`1970-01-01T${raw}`);
  if (Number.isNaN(parsed.getTime())) return null;
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
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

export function parseSpCampaignReport(input: string): SpCampaignParseResult {
  const content = fs.existsSync(input) ? fs.readFileSync(input, "utf8") : input;
  const rows = parseCsv(content);
  if (!rows.length) return { rows: [], coverageStart: null, coverageEnd: null };

  const headers = rows[0] ?? [];
  const headerMap = mapHeaders(headers);

  const dataRows: SpCampaignRow[] = [];
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const dateValue = headerMap.date !== undefined ? row[headerMap.date] ?? "" : "";
    const endDateValue = headerMap.end_date !== undefined ? row[headerMap.end_date] ?? "" : "";
    const date = parseDate(String(dateValue ?? ""));
    const endDate = parseDate(String(endDateValue ?? ""));
    if (!date) continue;
    if (endDate && endDate !== date) continue;

    const startTimeValue = headerMap.start_time !== undefined ? row[headerMap.start_time] ?? "" : "";
    const startTime = parseTime(String(startTimeValue ?? ""));

    const campaignRaw = headerMap.campaign_name_raw !== undefined ? row[headerMap.campaign_name_raw] ?? "" : "";
    const campaignNameRaw = String(campaignRaw).trim();
    if (!campaignNameRaw) continue;

    const portfolioRaw = headerMap.portfolio_name_raw !== undefined ? row[headerMap.portfolio_name_raw] ?? "" : "";
    const portfolioNameRaw = String(portfolioRaw ?? "").trim();

    const campaignNameNorm = normText(campaignNameRaw);
    const portfolioNameNorm = portfolioNameRaw ? normText(portfolioNameRaw) : null;

    const impressions = headerMap.impressions !== undefined
      ? parseIntSafe(String(row[headerMap.impressions] ?? ""))
      : null;
    const clicks = headerMap.clicks !== undefined
      ? parseIntSafe(String(row[headerMap.clicks] ?? ""))
      : null;
    const spend = headerMap.spend !== undefined
      ? parseMoney(String(row[headerMap.spend] ?? ""))
      : null;
    const sales = headerMap.sales !== undefined
      ? parseMoney(String(row[headerMap.sales] ?? ""))
      : null;
    const orders = headerMap.orders !== undefined
      ? parseIntSafe(String(row[headerMap.orders] ?? ""))
      : null;
    const units = headerMap.units !== undefined
      ? parseIntSafe(String(row[headerMap.units] ?? ""))
      : null;

    dataRows.push({
      date,
      startTime,
      portfolio_name_raw: portfolioNameRaw || null,
      portfolio_name_norm: portfolioNameNorm,
      campaign_name_raw: campaignNameRaw,
      campaign_name_norm: campaignNameNorm,
      impressions,
      clicks,
      spend,
      sales,
      orders,
      units,
    });

    if (!coverageStart || date < coverageStart) coverageStart = date;
    if (!coverageEnd || date > coverageEnd) coverageEnd = date;
  }

  return { rows: dataRows, coverageStart, coverageEnd };
}
