import { MAX_DATE_RANGE_DAYS } from "./constants";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoDate = (value: string, fieldName: string): Date => {
  if (!ISO_DATE_RE.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  return parsed;
};

export const validateDateRange = (
  startDate: string,
  endDate: string,
): { startDate: string; endDate: string; dayCount: number } => {
  const start = parseIsoDate(startDate, "start_date");
  const end = parseIsoDate(endDate, "end_date");

  if (end < start) {
    throw new Error("end_date must be on or after start_date");
  }

  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (dayCount > MAX_DATE_RANGE_DAYS) {
    throw new Error(`date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`);
  }

  return { startDate, endDate, dayCount };
};

export const validateOptionalIdentifier = (
  value: string | undefined,
  fieldName: string,
): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 200) {
    throw new Error(`${fieldName} is too long`);
  }
  return trimmed;
};

export const validateLimit = (value: number | undefined, max: number): number => {
  if (value == null) return max;
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`limit must be an integer between 1 and ${max}`);
  }
  return value;
};
