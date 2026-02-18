import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';

import SidebarCollapseToggle from '@/components/SidebarCollapseToggle';
import SidebarNav from '@/components/SidebarNav';
import StickyHScrollBar from '@/components/StickyHScrollBar';
import ThemeSwitcher from '@/components/ThemeSwitcher';
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

const themeInitScript = `
  (function () {
    var valid = { stripe: true, 'saas-analytics': true, 'real-time': true };
    try {
      var stored = window.localStorage.getItem('aph.theme');
      var next = stored && valid[stored] ? stored : 'stripe';
      document.documentElement.dataset.theme = next;
    } catch (_error) {
      document.documentElement.dataset.theme = 'stripe';
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-sidebar="expanded" data-theme="stripe" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen overflow-x-hidden bg-background text-foreground antialiased`}
      >
        <Script id="aph-sidebar-init" strategy="beforeInteractive">
          {sidebarInitScript}
        </Script>
        <Script id="aph-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <div className="flex min-h-screen">
          <aside className="aph-sidebar sticky top-0 h-dvh self-start shrink-0 border-r border-border/70 bg-surface/80 backdrop-blur relative">
            <SidebarCollapseToggle className="absolute -right-3 top-20 z-50" />
            <div className="h-full overflow-y-auto px-4 py-8">
              <div className="mb-8">
                <div className="aph-sidebar-brand-expanded">
                  <div className="text-xs uppercase tracking-[0.3em] text-muted">
                    Performance Hub
                  </div>
                  <div className="text-xl font-semibold">Operations</div>
                </div>
                <div className="aph-sidebar-brand-collapsed items-center justify-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                    PH
                  </div>
                </div>
              </div>
              <SidebarNav />
            </div>
          </aside>

          <div className="flex min-h-screen flex-1 min-w-0 flex-col">
            <header className="flex items-center justify-between border-b border-border/70 bg-surface/70 px-8 py-4 backdrop-blur">
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-muted">
                  Amazon Performance Hub
                </div>
                <div className="text-lg font-semibold text-foreground">
                  Operational overview
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                  {env.accountId} · {env.marketplace}
                </div>
                <div className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
                  Date range: last 30 days
                </div>
                <ThemeSwitcher />
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
