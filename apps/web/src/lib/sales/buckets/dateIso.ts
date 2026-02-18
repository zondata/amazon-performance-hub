export const parseISODate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
};

export const formatISODate = (date: Date): string => date.toISOString().slice(0, 10);

export const addDaysUTC = (date: Date, days: number): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );

export const startOfISOWeekUTC = (date: Date): Date => {
  const day = date.getUTCDay();
  const offset = (day + 6) % 7;
  return addDaysUTC(date, -offset);
};

export const endOfISOWeekUTC = (date: Date): Date =>
  addDaysUTC(startOfISOWeekUTC(date), 6);

export const startOfMonthUTC = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

export const endOfMonthUTC = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

export const startOfQuarterUTC = (date: Date): Date => {
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1));
};

export const endOfQuarterUTC = (date: Date): Date => {
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth + 3, 0));
};
