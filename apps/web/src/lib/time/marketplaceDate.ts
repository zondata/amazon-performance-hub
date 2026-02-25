const MARKETPLACE_TIME_ZONES: Record<string, string> = {
  US: 'America/Los_Angeles',
  CA: 'America/Toronto',
  UK: 'Europe/London',
  DE: 'Europe/Berlin',
  FR: 'Europe/Berlin',
  IT: 'Europe/Berlin',
  ES: 'Europe/Berlin',
  NL: 'Europe/Berlin',
  AU: 'Australia/Sydney',
};

export const marketplaceToIanaTimeZone = (marketplace: string): string => {
  const normalized = marketplace.trim().toUpperCase();
  return MARKETPLACE_TIME_ZONES[normalized] ?? 'UTC';
};

export const toMarketplaceDate = (now: Date, marketplace: string): string => {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('Invalid date input.');
  }

  const timeZone = marketplaceToIanaTimeZone(marketplace);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Could not derive marketplace date for timezone ${timeZone}.`);
  }

  return `${year}-${month}-${day}`;
};
