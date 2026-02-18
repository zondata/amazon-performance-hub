'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'SP Update', href: '/bulksheet-ops/sp-update' },
  { label: 'SB Update', href: '/bulksheet-ops/sb-update' },
  { label: 'SP Create', href: '/bulksheet-ops/sp-create' },
  { label: 'Reconcile', href: '/bulksheet-ops/reconcile' },
];

export default function BulksheetOpsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              active
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
