import {
  addDaysUTC,
  endOfISOWeekUTC,
  endOfMonthUTC,
  endOfQuarterUTC,
  formatISODate,
  parseISODate,
  startOfISOWeekUTC,
  startOfMonthUTC,
  startOfQuarterUTC,
} from './dateIso';

export type SalesGranularity = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type CalendarBucket = {
  key: string;
  label: string;
  start: string;
  end: string;
};

const isoWeekInfo = (date: Date) => {
  const temp = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = temp.getUTCDay() === 0 ? 7 : temp.getUTCDay();
  temp.setUTCDate(temp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return { week, year: temp.getUTCFullYear() };
};

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

const formatQuarterLabel = (date: Date) => {
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()} Q${quarter}`;
};

export const getCalendarBuckets = (options: {
  last: string;
  cols: number;
  granularity: SalesGranularity;
}): CalendarBucket[] => {
  const { last, cols, granularity } = options;
  const total = Math.max(1, cols);
  const lastDate = parseISODate(last);

  const periodStart = (date: Date): Date => {
    switch (granularity) {
      case 'weekly':
        return startOfISOWeekUTC(date);
      case 'monthly':
        return startOfMonthUTC(date);
      case 'quarterly':
        return startOfQuarterUTC(date);
      default:
        return date;
    }
  };

  const periodEnd = (date: Date): Date => {
    switch (granularity) {
      case 'weekly':
        return endOfISOWeekUTC(date);
      case 'monthly':
        return endOfMonthUTC(date);
      case 'quarterly':
        return endOfQuarterUTC(date);
      default:
        return date;
    }
  };

  const labelFor = (startDate: Date, endDate: Date): string => {
    switch (granularity) {
      case 'weekly': {
        const info = isoWeekInfo(startDate);
        return `W${String(info.week).padStart(2, '0')} ${info.year}`;
      }
      case 'monthly':
        return formatMonthLabel(startDate);
      case 'quarterly':
        return formatQuarterLabel(startDate);
      default:
        return formatISODate(endDate);
    }
  };

  const buckets: Array<{ start: Date; end: Date }> = [];
  const lastStart = periodStart(lastDate);
  const lastBucket = {
    start: lastStart,
    end: lastDate,
  };

  buckets.push(lastBucket);

  while (buckets.length < total) {
    const previousStart = buckets[buckets.length - 1]?.start ?? lastStart;
    const dayBefore = addDaysUTC(previousStart, -1);
    const start = periodStart(dayBefore);
    const end = periodEnd(dayBefore);
    buckets.push({ start, end });
  }

  return buckets
    .reverse()
    .map(({ start, end }) => {
      const startIso = formatISODate(start);
      const endIso = formatISODate(end);
      return {
        key: `${granularity}:${startIso}:${endIso}`,
        label: labelFor(start, end),
        start: startIso,
        end: endIso,
      };
    });
};
