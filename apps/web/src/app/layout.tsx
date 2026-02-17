import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';

import { env } from '@/lib/env';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Amazon Performance Hub',
  description: 'Imports & data health diagnostics',
};

export const dynamic = 'force-dynamic';

const navItems = [
  'Dashboard',
  'Sales',
  'Products',
  'Ads',
  'SQP',
  'Ranking',
  'Logbook',
  'Bulksheet Ops',
  'Imports & Health',
  'Settings',
];

const navHref = (label: string) => {
  if (label === 'Imports & Health') return '/imports-health';
  return '#';
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-gradient-to-br from-amber-50 via-white to-sky-50 text-slate-900 antialiased`}
      >
        <div className="flex min-h-screen">
          <aside className="w-64 border-r border-slate-200/70 bg-white/80 px-6 py-8 backdrop-blur">
            <div className="mb-8">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Performance Hub
              </div>
              <div className="text-xl font-semibold">Operations</div>
            </div>
            <nav className="space-y-2 text-sm">
              {navItems.map((label) => (
                <Link
                  key={label}
                  href={navHref(label)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 transition ${
                    label === 'Imports & Health'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{label}</span>
                  {label === 'Imports & Health' ? (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
                      Live
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>
          </aside>

          <div className="flex min-h-screen flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-slate-200/70 bg-white/70 px-8 py-4 backdrop-blur">
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  Imports & Data Health
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  System heartbeat overview
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  {env.accountId} · {env.marketplace}
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
                  Date range: last 30 days
                </div>
              </div>
            </header>

            <main className="flex-1 px-8 py-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
