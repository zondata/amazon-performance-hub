import 'server-only';

import { toMarketplaceDate } from './marketplaceDate';

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map((v) => Number(v));
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getDefaultMarketplaceDateRange(opts: {
  marketplace: string;
  daysBack?: number;
  delayDays?: number;
}): { start: string; end: string } {
  const daysBack = opts.daysBack ?? 30;
  const delayDays = opts.delayDays ?? 0;

  const now = new Date();
  const marketplaceToday = toMarketplaceDate(now, opts.marketplace);

  const end = addDaysToYmd(marketplaceToday, -delayDays);
  const start = addDaysToYmd(end, -(daysBack - 1));

  return { start, end };
}
