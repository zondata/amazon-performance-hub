const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const BASELINE_RANGE_PRESETS = ["30d", "60d", "90d", "180d", "all"] as const;
export type BaselineRangePreset = (typeof BASELINE_RANGE_PRESETS)[number];

export type BaselineDatasetAvailability = {
  minDate: string | null;
  maxDate: string | null;
};

export type BaselineAvailabilityMap = Record<string, BaselineDatasetAvailability>;

export type ComputedBaselineWindow = {
  requestedRange: BaselineRangePreset;
  startCandidate: string;
  endCandidate: string;
  overlapStart: string | null;
  overlapEnd: string | null;
  effectiveStart: string;
  effectiveEnd: string;
  usedFallback: boolean;
};

const toDateString = (value: Date): string => value.toISOString().slice(0, 10);

const isDateString = (value: string | null | undefined): value is string => {
  if (!value || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
};

const addUtcDays = (date: string, days: number): string => {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toDateString(parsed);
};

const minDate = (left: string, right: string) => (left <= right ? left : right);
const maxDate = (left: string, right: string) => (left >= right ? left : right);

export const normalizeBaselineRange = (
  value: string | null | undefined
): BaselineRangePreset => {
  if (!value) return "60d";
  const normalized = value.trim().toLowerCase();
  if (normalized === "30d") return "30d";
  if (normalized === "60d") return "60d";
  if (normalized === "90d") return "90d";
  if (normalized === "180d") return "180d";
  if (normalized === "all") return "all";
  return "60d";
};

export const normalizeExcludeLastDays = (value: string | null | undefined): number => {
  if (!value) return 2;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 2;
  if (parsed < 0) return 0;
  return parsed;
};

export const computeTodayMinusExcludeDays = (
  excludeLastDays: number,
  now = new Date()
): string => {
  const utcDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  utcDate.setUTCDate(utcDate.getUTCDate() - excludeLastDays);
  return toDateString(utcDate);
};

export const computeEndCandidate = (
  todayMinusExcludeDays: string,
  userEnd: string | null | undefined
): string => {
  if (!isDateString(userEnd)) return todayMinusExcludeDays;
  return minDate(userEnd, todayMinusExcludeDays);
};

export const computeBaselineWindow = (input: {
  requestedRange: BaselineRangePreset;
  endCandidate: string;
  availability: BaselineAvailabilityMap;
  fallbackDays?: number;
}): ComputedBaselineWindow => {
  const fallbackDays = input.fallbackDays ?? 60;
  const rangeDays =
    input.requestedRange === "30d"
      ? 30
      : input.requestedRange === "60d"
        ? 60
        : input.requestedRange === "90d"
          ? 90
          : input.requestedRange === "180d"
            ? 180
            : null;

  const startCandidate =
    rangeDays === null ? "1900-01-01" : addUtcDays(input.endCandidate, -(rangeDays - 1));

  const available = Object.values(input.availability).flatMap((row) =>
    isDateString(row.minDate) && isDateString(row.maxDate)
      ? [{ minDate: row.minDate, maxDate: row.maxDate }]
      : []
  );

  const overlapStart =
    available.length > 0
      ? available.map((row) => row.minDate).reduce((left, right) => maxDate(left, right))
      : null;

  const overlapUpper =
    available.length > 0
      ? available.map((row) => row.maxDate).reduce((left, right) => minDate(left, right))
      : null;
  const overlapEnd = overlapUpper ? minDate(overlapUpper, input.endCandidate) : null;

  let effectiveStart = overlapStart ? maxDate(startCandidate, overlapStart) : startCandidate;
  let effectiveEnd = overlapEnd;
  let usedFallback = false;

  if (!effectiveEnd || effectiveStart > effectiveEnd) {
    effectiveEnd = input.endCandidate;
    effectiveStart = addUtcDays(effectiveEnd, -(fallbackDays - 1));
    usedFallback = true;
  }

  return {
    requestedRange: input.requestedRange,
    startCandidate,
    endCandidate: input.endCandidate,
    overlapStart,
    overlapEnd,
    effectiveStart,
    effectiveEnd,
    usedFallback,
  };
};
