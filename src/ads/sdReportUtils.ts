import * as XLSX from "xlsx";

export function ensureWorksheetRef(ws: XLSX.WorkSheet) {
  const ref = ws["!ref"];
  if (!ref || ref === "A1") {
    let maxR = 0;
    let maxC = 0;

    for (const key of Object.keys(ws)) {
      if (key[0] === "!") continue;
      const addr = XLSX.utils.decode_cell(key);
      if (addr.r > maxR) maxR = addr.r;
      if (addr.c > maxC) maxC = addr.c;
    }

    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  }
}

export function normalizeHeader(value: string): string {
  const trimmed = value.replace(/^\uFEFF/, "");
  return trimmed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseIntSafe(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "");
  const num = Number.parseInt(cleaned, 10);
  return Number.isFinite(num) ? num : null;
}

export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[$,]/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function parsePercent(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[% ,]/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num / 100 : null;
}

function parseDateString(value: string): string | null {
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

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateCell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatUtcDate(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const dateCode = XLSX.SSF.parse_date_code(value);
    if (!dateCode) return null;
    const year = String(dateCode.y).padStart(4, "0");
    const month = String(dateCode.m).padStart(2, "0");
    const day = String(dateCode.d).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "string") {
    return parseDateString(value);
  }
  return null;
}
