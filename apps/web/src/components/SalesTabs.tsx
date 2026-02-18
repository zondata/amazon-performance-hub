'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const toDateString = (value: Date): string => value.toISOString().slice(0, 10);

const defaultDateRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);
  return { start: toDateString(start), end: toDateString(end) };
};

const buildHref = (
  href: string,
  start: string,
  end: string,
  asin: string
): string => {
  const usp = new URLSearchParams({ start, end, asin });
  return `${href}?${usp.toString()}`;
};

const TABS = [
  { label: 'Trend', href: '/sales/trend' },
  { label: 'Monthly', href: '/sales/monthly' },
  { label: 'Moving Avg', href: '/sales/moving-average' },
];

export default function SalesTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaults = defaultDateRange();

  const start = searchParams.get('start') ?? defaults.start;
  const end = searchParams.get('end') ?? defaults.end;
  const asin = searchParams.get('asin') ?? 'all';

  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={buildHref(tab.href, start, end, asin)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
