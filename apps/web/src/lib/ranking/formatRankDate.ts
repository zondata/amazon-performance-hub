export const formatRankDateHeader = (
  dateIso: string
): { day: string; month: string } => {
  const parsed = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return { day: dateIso, month: '' };
  }

  const day = String(parsed.getUTCDate());
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(parsed);

  return { day, month };
};
