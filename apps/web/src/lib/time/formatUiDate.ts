const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const TIME_ONLY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

const formatDateParts = (year: string, month: string, day: string) => {
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    return `${year}-${month}-${day}`;
  }
  return `${Number(day)} ${MONTHS_SHORT[monthIndex]} ${year}`;
};

export const formatUiDate = (value?: string | null): string => {
  if (!value) return '—';

  const dateOnlyMatch = DATE_ONLY_RE.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return formatDateParts(year, month, day);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return formatDateParts(
    String(parsed.getFullYear()),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0')
  );
};

export const formatUiDateTime = (value?: string | null): string => {
  if (!value) return '—';
  if (DATE_ONLY_RE.test(value)) {
    return formatUiDate(value);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const dateText = formatDateParts(
    String(parsed.getFullYear()),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0')
  );

  return `${dateText}, ${TIME_ONLY_FORMATTER.format(parsed)}`;
};

export const formatUiDateRange = (start?: string | null, end?: string | null): string =>
  `${formatUiDate(start)} → ${formatUiDate(end)}`;
