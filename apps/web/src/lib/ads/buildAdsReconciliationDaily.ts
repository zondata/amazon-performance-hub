type ValueLike = number | string | null | undefined;

type SiRow = {
  date: string | null;
  ppc_cost: ValueLike;
};

type SpendRow = {
  date: string | null;
  spend: ValueLike;
};

type BuildAdsReconciliationDailyInput = {
  siRows: SiRow[];
  spRows: SpendRow[];
  sbRows: SpendRow[];
  sdRows: SpendRow[];
  start: string;
  end: string;
};

export type AdsReconciliationDailyRow = {
  date: string;
  si_ppc_cost: number;
  si_ppc_cost_attributed: number;
  sp_spend_total: number;
  sb_spend_total: number;
  sd_spend_total: number;
  ads_spend_total: number;
  advertised_ads_total: number;
  diff: number;
  attribution_delta: number;
};

const toNumber = (value: ValueLike): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const round2 = (value: number): number => Number(value.toFixed(2));

const isDateInRange = (date: string, start: string, end: string): boolean => date >= start && date <= end;

const sumByDate = (rows: Array<{ date: string | null; value: ValueLike }>, start: string, end: string) => {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const date = typeof row.date === "string" ? row.date : "";
    if (!date || !isDateInRange(date, start, end)) continue;
    totals.set(date, round2((totals.get(date) ?? 0) + toNumber(row.value)));
  }
  return totals;
};

const addDays = (date: string, days: number): string => {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

export const buildAdsReconciliationDaily = (
  input: BuildAdsReconciliationDailyInput
): AdsReconciliationDailyRow[] => {
  if (!input.start || !input.end || input.start > input.end) return [];

  const siByDate = sumByDate(
    input.siRows.map((row) => ({ date: row.date, value: row.ppc_cost })),
    input.start,
    input.end
  );
  const spByDate = sumByDate(
    input.spRows.map((row) => ({ date: row.date, value: row.spend })),
    input.start,
    input.end
  );
  const sbByDate = sumByDate(
    input.sbRows.map((row) => ({ date: row.date, value: row.spend })),
    input.start,
    input.end
  );
  const sdByDate = sumByDate(
    input.sdRows.map((row) => ({ date: row.date, value: row.spend })),
    input.start,
    input.end
  );

  const rows: AdsReconciliationDailyRow[] = [];
  let cursor = input.start;
  while (cursor <= input.end) {
    const si = round2(siByDate.get(cursor) ?? 0);
    const sp = round2(spByDate.get(cursor) ?? 0);
    const sb = round2(sbByDate.get(cursor) ?? 0);
    const sd = round2(sdByDate.get(cursor) ?? 0);
    const adsSpendTotal = round2(sp + sb + sd);
    const diff = round2(si - adsSpendTotal);
    rows.push({
      date: cursor,
      si_ppc_cost: si,
      si_ppc_cost_attributed: si,
      sp_spend_total: sp,
      sb_spend_total: sb,
      sd_spend_total: sd,
      ads_spend_total: adsSpendTotal,
      advertised_ads_total: adsSpendTotal,
      diff,
      attribution_delta: diff,
    });
    cursor = addDays(cursor, 1);
  }

  return rows;
};
