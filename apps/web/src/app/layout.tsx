import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';

import SidebarCollapseToggle from '@/components/SidebarCollapseToggle';
import SidebarNav from '@/components/SidebarNav';
import StickyHScrollBar from '@/components/StickyHScrollBar';
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

const sidebarInitScript = `
  (function () {
    try {
      var collapsed = window.localStorage.getItem('aph.sidebarCollapsed');
      document.documentElement.dataset.sidebar = collapsed === '1' ? 'collapsed' : 'expanded';
    } catch (_error) {
      document.documentElement.dataset.sidebar = 'expanded';
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-sidebar="expanded" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen overflow-x-hidden bg-gradient-to-br from-amber-50 via-white to-sky-50 text-slate-900 antialiased`}
      >
        <Script id="aph-sidebar-init" strategy="beforeInteractive">
          {sidebarInitScript}
        </Script>
        <div className="flex min-h-screen">
          <aside className="aph-sidebar sticky top-0 h-dvh self-start shrink-0 border-r border-slate-200/70 bg-white/80 backdrop-blur relative">
            <SidebarCollapseToggle className="absolute -right-3 top-20 z-50" />
            <div className="h-full overflow-y-auto px-4 py-8">
              <div className="mb-8">
                <div className="aph-sidebar-brand-expanded">
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-500">
                    Performance Hub
                  </div>
                  <div className="text-xl font-semibold">Operations</div>
                </div>
                <div className="aph-sidebar-brand-collapsed items-center justify-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold uppercase tracking-wide text-white">
                    PH
                  </div>
                </div>
              </div>
              <SidebarNav />
            </div>
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

            <main className="flex-1 min-w-0 w-full px-8 py-6 pb-12">{children}</main>
          </div>
        </div>
        <StickyHScrollBar />
      </body>
    </html>
  );
}
