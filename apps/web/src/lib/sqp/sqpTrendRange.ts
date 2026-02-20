import type { SqpWeek } from '@/lib/sqp/getProductSqpWeekly';

export const selectSqpTrendRange = ({
  availableWeeks,
  fromWeekEnd,
  toWeekEnd,
  windowSize = 12,
}: {
  availableWeeks: SqpWeek[];
  fromWeekEnd?: string | null;
  toWeekEnd?: string | null;
  windowSize?: number;
}): { from: string | null; to: string | null } => {
  if (!availableWeeks.length) return { from: null, to: null };
  const weekEndsDesc = availableWeeks.map((week) => week.week_end);
  const weekSet = new Set(weekEndsDesc);

  const fallbackTo = weekEndsDesc[0] ?? null;
  const safeTo = toWeekEnd && weekSet.has(toWeekEnd) ? toWeekEnd : fallbackTo;
  if (!safeTo) return { from: null, to: null };

  const toIndex = weekEndsDesc.indexOf(safeTo);
  const fallbackFromIndex = Math.min(toIndex + windowSize - 1, weekEndsDesc.length - 1);
  const fallbackFrom = weekEndsDesc[fallbackFromIndex] ?? safeTo;
  const safeFrom = fromWeekEnd && weekSet.has(fromWeekEnd) ? fromWeekEnd : fallbackFrom;

  if (safeFrom > safeTo) {
    return { from: safeTo, to: safeFrom };
  }

  return { from: safeFrom, to: safeTo };
};
