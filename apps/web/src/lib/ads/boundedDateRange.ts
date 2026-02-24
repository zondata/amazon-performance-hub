const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

type RequestedRange = "30d" | "60d" | "90d" | "180d" | "all" | "baseline";

const normalizeRequestedRange = (value: string | null | undefined): RequestedRange => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "30d") return "30d";
  if (normalized === "60d") return "60d";
  if (normalized === "90d") return "90d";
  if (normalized === "180d") return "180d";
  if (normalized === "all") return "all";
  if (normalized === "baseline") return "baseline";
  return "baseline";
};

export const computeBoundedRange = (input: {
  requestedRange: string | null | undefined;
  endDate: string;
  allRangeCapDays?: number;
  allowUnboundedAllRange?: boolean;
}): { startBound: string; endBound: string } => {
  const endBound = isDateString(input.endDate) ? input.endDate : toDateString(new Date());
  const allRangeCapDays = input.allRangeCapDays ?? 365;
  const requestedRange = normalizeRequestedRange(input.requestedRange);

  let lookbackDays = 60;
  if (requestedRange === "30d") lookbackDays = 60;
  if (requestedRange === "60d" || requestedRange === "baseline") lookbackDays = 60;
  if (requestedRange === "90d") lookbackDays = 120;
  if (requestedRange === "180d") lookbackDays = 210;
  if (requestedRange === "all") {
    lookbackDays = input.allowUnboundedAllRange ? 100_000 : allRangeCapDays;
  }

  const safeLookbackDays = Math.max(1, lookbackDays);
  const startBound = addUtcDays(endBound, -(safeLookbackDays - 1));
  return { startBound, endBound };
};
