'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  label: string;
  href: string;
  badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Sales', href: '#' },
  { label: 'Products', href: '/products' },
  { label: 'Ads', href: '/ads/performance' },
  { label: 'SQP', href: '#' },
  { label: 'Ranking', href: '#' },
  { label: 'Logbook', href: '#' },
  { label: 'Bulksheet Ops', href: '#' },
  { label: 'Imports & Health', href: '/imports-health', badge: 'Live' },
  { label: 'Settings', href: '#' },
];

const isActive = (pathname: string, href: string) => {
  if (href === '#') return false;
  if (href === '/dashboard') return pathname === '/' || pathname.startsWith('/dashboard');
  return pathname.startsWith(href);
};

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2 text-sm">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex items-center justify-between rounded-lg px-3 py-2 transition ${
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>{item.label}</span>
            {item.badge ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
