const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ASIN_RE = /^[A-Z0-9]{10}$/i;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 90;

export function parseRequiredDate(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD.`);
  }
  return value;
}

export function parseOptionalDate(value: unknown, fieldName: string): string | null {
  if (value == null) return null;
  return parseRequiredDate(value, fieldName);
}

export function assertDateRangeWithinLimit(startDate: string, endDate: string, maxDays = MAX_RANGE_DAYS): void {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new Error("Date range is invalid.");
  }
  const spanDays = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  if (spanDays > maxDays) {
    throw new Error(`Date range cannot exceed ${maxDays} days in MCP v1.`);
  }
}

export function clampLimit(value: unknown, defaultLimit: number, maxLimit: number): number {
  if (value == null) return defaultLimit;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error("limit must be a positive integer.");
  }
  return Math.min(value, maxLimit);
}

export function parseRequiredAsin(value: unknown): string {
  if (typeof value !== "string" || !ASIN_RE.test(value.trim())) {
    throw new Error("asin must be a valid 10-character Amazon ASIN.");
  }
  return value.trim().toUpperCase();
}

export function parseOptionalString(value: unknown, fieldName: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseKeywordArray(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("keywords must be an array of strings.");
  }
  const normalized = value
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : null;
}

export function defaultLast30DaysRange(today = new Date()): { startDate: string; endDate: string } {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end.getTime() - 29 * MS_PER_DAY);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}
