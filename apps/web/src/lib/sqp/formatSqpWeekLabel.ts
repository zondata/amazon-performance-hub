export const getIsoWeekYear = (dateIso: string): { week: number; year: number } => {
  const parsed = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return { week: 0, year: 0 };
  }

  const target = new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  );
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  const year = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const diffDays = Math.floor((target.getTime() - yearStart.getTime()) / 86400000) + 1;
  const week = Math.ceil(diffDays / 7);

  return { week, year };
};

export const formatSqpWeekLabel = (dateIso: string): string => {
  const { week, year } = getIsoWeekYear(dateIso);
  if (!week || !year) return dateIso;
  const parsed = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(parsed);
  return `W${String(week).padStart(2, '0')} ${year} (${monthShort})`;
};
