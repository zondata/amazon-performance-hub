import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import SidebarNav from '@/components/SidebarNav';
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
            <SidebarNav />
          </aside>

          <div className="flex min-h-screen flex-1 min-w-0 flex-col">
            <header className="flex items-center justify-between border-b border-slate-200/70 bg-white/70 px-8 py-4 backdrop-blur">
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  Amazon Performance Hub
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  Operational overview
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

            <main className="flex-1 min-w-0 w-full px-8 py-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
