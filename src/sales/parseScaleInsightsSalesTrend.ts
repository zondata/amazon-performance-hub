import fs from "node:fs";
import path from "node:path";
import { normalizeHeader, parseIntSafe, parseMoney, parsePercent } from "../ads/sdReportUtils";

export type ScaleInsightsSalesTrendRow = {
  date: string;
  referral_fees: number | null;
  fulfillment_fees: number | null;
  cost_of_goods: number | null;
  payout: number | null;
  profits: number | null;
  roi: number | null;
  margin: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
  organic_orders: number | null;
  organic_units: number | null;
  sessions: number | null;
  conversions: number | null;
  unit_session_pct: number | null;
  ppc_cost: number | null;
  ppc_sales: number | null;
  ppc_orders: number | null;
  ppc_units: number | null;
  ppc_impressions: number | null;
  ppc_clicks: number | null;
  cost_per_click: number | null;
  ppc_conversions: number | null;
  acos: number | null;
  tacos: number | null;
  ctr: number | null;
  ppc_cost_per_order: number | null;
  promotions: number | null;
  promotion_value: number | null;
  refund_units: number | null;
  refund_cost: number | null;
  refund_per_unit: number | null;
  avg_sales_price: number | null;
};

export type ScaleInsightsSalesTrendParseResult = {
  rows: ScaleInsightsSalesTrendRow[];
  coverageStart: string | null;
  coverageEnd: string | null;
  warnings: number;
};

const HEADER_ALIASES: Record<string, string[]> = {
  start_date: ["start date", "date", "start"],
  end_date: ["end date"],
  referral_fees: ["referral fees", "referral fee"],
  fulfillment_fees: ["fulfillment fees", "fulfillment fee", "fba fees"],
  cost_of_goods: ["cost of goods", "cogs"],
  payout: ["payout"],
  profits: ["profits", "profit"],
  roi: ["roi", "return on investment"],
  margin: ["margin", "profit margin"],
  sales: ["sales", "total sales"],
  orders: ["orders", "total orders"],
  units: ["units", "total units"],
  organic_orders: ["organic orders"],
  organic_units: ["organic units"],
  sessions: ["sessions"],
  conversions: ["conversions", "conversion rate"],
  unit_session_pct: ["unit session pct", "unit session percentage", "unit session %", "unit session"],
  ppc_cost: ["ppc cost", "ppc spend"],
  ppc_sales: ["ppc sales", "ppc revenue", "ppc attributed sales"],
  ppc_orders: ["ppc orders"],
  ppc_units: ["ppc units"],
  ppc_impressions: ["ppc impressions", "impressions"],
  ppc_clicks: ["ppc clicks", "clicks"],
  cost_per_click: ["cost per click", "cpc"],
  ppc_conversions: ["ppc conversions", "ppc conversion rate"],
  acos: ["acos"],
  tacos: ["tacos"],
  ctr: ["ctr", "click through rate", "click-through rate"],
  ppc_cost_per_order: ["ppc cost per order", "ppc cpo", "cost per order"],
  promotions: ["promotions", "promotion"],
  promotion_value: ["promotion value", "promotion amount"],
  refund_units: ["refund units", "refunded units"],
  refund_cost: ["refund cost", "refund amount"],
  refund_per_unit: ["refund per unit", "refund cost per unit"],
  avg_sales_price: ["avg sales price", "average sales price", "avg sale price", "average sale price"],
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

function parseDateFlexible(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw;
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const first = Number.parseInt(slashMatch[1], 10);
    const second = Number.parseInt(slashMatch[2], 10);
    const year = slashMatch[3];
    let month = first;
    let day = second;

    // Assumption: if the first number exceeds 12, treat as DD/MM/YYYY.
    // Otherwise, default to MM/DD/YYYY for ambiguous cases.
    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    }

    const monthStr = String(month).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    return `${year}-${monthStr}-${dayStr}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export function parseAsinFromFilename(filename: string): string | null {
  const base = path.basename(filename);
  const match = base.match(/^(B0[A-Z0-9]{8,})\s/i);
  if (!match) return null;
  return match[1].toUpperCase();
}

export function resolveSalesTrendAsinFromFilenameOrOverride(
  filename: string,
  asinOverride?: string | null
): string {
  const override = (asinOverride ?? "").trim().toUpperCase();
  if (override) {
    if (!/^[A-Z0-9]{10}$/.test(override)) {
      throw new Error(`Invalid --asin value "${asinOverride}". ASIN must be 10 alphanumeric characters.`);
    }
    return override;
  }

  const parsed = parseAsinFromFilename(filename);
  if (parsed) return parsed;

  throw new Error(
    "Provide --asin or rename file to start with ASIN, e.g. B0B2K57W5R SalesTrend - Name.csv"
  );
}

export function parseScaleInsightsSalesTrend(input: string): ScaleInsightsSalesTrendParseResult {
  const content = fs.existsSync(input) ? fs.readFileSync(input, "utf8") : input;
  const rows = parseCsv(content);
  if (!rows.length) return { rows: [], coverageStart: null, coverageEnd: null, warnings: 0 };

  const headers = rows[0] ?? [];
  const headerMap = mapHeaders(headers);

  const dataRows: ScaleInsightsSalesTrendRow[] = [];
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;
  let warnings = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const startDateValue = headerMap.start_date !== undefined ? row[headerMap.start_date] ?? "" : "";
    const endDateValue = headerMap.end_date !== undefined ? row[headerMap.end_date] ?? "" : "";
    const startDate = parseDateFlexible(String(startDateValue ?? ""));
    const endDate = parseDateFlexible(String(endDateValue ?? ""));
    if (!startDate) continue;
    if (endDate && endDate !== startDate) warnings += 1;

    const rowData: ScaleInsightsSalesTrendRow = {
      date: startDate,
      referral_fees:
        headerMap.referral_fees !== undefined ? parseMoney(row[headerMap.referral_fees]) : null,
      fulfillment_fees:
        headerMap.fulfillment_fees !== undefined ? parseMoney(row[headerMap.fulfillment_fees]) : null,
      cost_of_goods:
        headerMap.cost_of_goods !== undefined ? parseMoney(row[headerMap.cost_of_goods]) : null,
      payout: headerMap.payout !== undefined ? parseMoney(row[headerMap.payout]) : null,
      profits: headerMap.profits !== undefined ? parseMoney(row[headerMap.profits]) : null,
      roi: headerMap.roi !== undefined ? parsePercent(row[headerMap.roi]) : null,
      margin: headerMap.margin !== undefined ? parsePercent(row[headerMap.margin]) : null,
      sales: headerMap.sales !== undefined ? parseMoney(row[headerMap.sales]) : null,
      orders: headerMap.orders !== undefined ? parseIntSafe(row[headerMap.orders]) : null,
      units: headerMap.units !== undefined ? parseIntSafe(row[headerMap.units]) : null,
      organic_orders:
        headerMap.organic_orders !== undefined ? parseIntSafe(row[headerMap.organic_orders]) : null,
      organic_units:
        headerMap.organic_units !== undefined ? parseIntSafe(row[headerMap.organic_units]) : null,
      sessions: headerMap.sessions !== undefined ? parseIntSafe(row[headerMap.sessions]) : null,
      conversions:
        headerMap.conversions !== undefined ? parsePercent(row[headerMap.conversions]) : null,
      unit_session_pct:
        headerMap.unit_session_pct !== undefined ? parsePercent(row[headerMap.unit_session_pct]) : null,
      ppc_cost: headerMap.ppc_cost !== undefined ? parseMoney(row[headerMap.ppc_cost]) : null,
      ppc_sales: headerMap.ppc_sales !== undefined ? parseMoney(row[headerMap.ppc_sales]) : null,
      ppc_orders: headerMap.ppc_orders !== undefined ? parseIntSafe(row[headerMap.ppc_orders]) : null,
      ppc_units: headerMap.ppc_units !== undefined ? parseIntSafe(row[headerMap.ppc_units]) : null,
      ppc_impressions:
        headerMap.ppc_impressions !== undefined ? parseIntSafe(row[headerMap.ppc_impressions]) : null,
      ppc_clicks: headerMap.ppc_clicks !== undefined ? parseIntSafe(row[headerMap.ppc_clicks]) : null,
      cost_per_click:
        headerMap.cost_per_click !== undefined ? parseMoney(row[headerMap.cost_per_click]) : null,
      ppc_conversions:
        headerMap.ppc_conversions !== undefined ? parsePercent(row[headerMap.ppc_conversions]) : null,
      acos: headerMap.acos !== undefined ? parsePercent(row[headerMap.acos]) : null,
      tacos: headerMap.tacos !== undefined ? parsePercent(row[headerMap.tacos]) : null,
      ctr: headerMap.ctr !== undefined ? parsePercent(row[headerMap.ctr]) : null,
      ppc_cost_per_order:
        headerMap.ppc_cost_per_order !== undefined
          ? parseMoney(row[headerMap.ppc_cost_per_order])
          : null,
      promotions:
        headerMap.promotions !== undefined ? parseIntSafe(row[headerMap.promotions]) : null,
      promotion_value:
        headerMap.promotion_value !== undefined ? parseMoney(row[headerMap.promotion_value]) : null,
      refund_units: headerMap.refund_units !== undefined ? parseIntSafe(row[headerMap.refund_units]) : null,
      refund_cost: headerMap.refund_cost !== undefined ? parseMoney(row[headerMap.refund_cost]) : null,
      refund_per_unit:
        headerMap.refund_per_unit !== undefined ? parseMoney(row[headerMap.refund_per_unit]) : null,
      avg_sales_price:
        headerMap.avg_sales_price !== undefined ? parseMoney(row[headerMap.avg_sales_price]) : null,
    };

    dataRows.push(rowData);

    if (!coverageStart || startDate < coverageStart) coverageStart = startDate;
    if (!coverageEnd || startDate > coverageEnd) coverageEnd = startDate;
  }

  return { rows: dataRows, coverageStart, coverageEnd, warnings };
}

export function buildScaleInsightsSalesTrendRawRows(params: {
  rows: ScaleInsightsSalesTrendRow[];
  accountId: string;
  marketplace: string;
  asin: string;
  uploadId: string;
  exportedAt: string;
}) {
  const { rows, accountId, marketplace, asin, uploadId, exportedAt } = params;
  return rows.map((row) => ({
    upload_id: uploadId,
    account_id: accountId,
    marketplace,
    asin,
    date: row.date,
    referral_fees: row.referral_fees,
    fulfillment_fees: row.fulfillment_fees,
    cost_of_goods: row.cost_of_goods,
    payout: row.payout,
    profits: row.profits,
    roi: row.roi,
    margin: row.margin,
    sales: row.sales,
    orders: row.orders,
    units: row.units,
    organic_orders: row.organic_orders,
    organic_units: row.organic_units,
    sessions: row.sessions,
    conversions: row.conversions,
    unit_session_pct: row.unit_session_pct,
    ppc_cost: row.ppc_cost,
    ppc_sales: row.ppc_sales,
    ppc_orders: row.ppc_orders,
    ppc_units: row.ppc_units,
    ppc_impressions: row.ppc_impressions,
    ppc_clicks: row.ppc_clicks,
    cost_per_click: row.cost_per_click,
    ppc_conversions: row.ppc_conversions,
    acos: row.acos,
    tacos: row.tacos,
    ctr: row.ctr,
    ppc_cost_per_order: row.ppc_cost_per_order,
    promotions: row.promotions,
    promotion_value: row.promotion_value,
    refund_units: row.refund_units,
    refund_cost: row.refund_cost,
    refund_per_unit: row.refund_per_unit,
    avg_sales_price: row.avg_sales_price,
    exported_at: exportedAt,
  }));
}
