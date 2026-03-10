'use client';

import type { ComponentType, SVGProps } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AdsIcon,
  BulksheetOpsIcon,
  DashboardIcon,
  GenericItemIcon,
  ImportsHealthIcon,
  LogbookIcon,
  ProductsIcon,
  SalesIcon,
  SettingsIcon,
} from './navIcons';

type NavItem = {
  label: string;
  href: string;
  badge?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const BASE_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
  { label: 'Sales', href: '/sales/trend', icon: SalesIcon },
  { label: 'Products', href: '/products', icon: ProductsIcon },
  { label: 'Ads', href: '/ads/performance', icon: AdsIcon },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
  { label: 'SQP', href: '#', icon: GenericItemIcon },
  { label: 'Ranking', href: '#', icon: GenericItemIcon },
  { label: 'Logbook', href: '/logbook/experiments', icon: LogbookIcon },
  { label: 'Bulksheet Ops', href: '/bulksheet-ops/sp-update', icon: BulksheetOpsIcon },
  { label: 'Imports & Health', href: '/imports-health', badge: 'Live', icon: ImportsHealthIcon },
  { label: 'Settings', href: '/settings/keyword-ai-packs', icon: SettingsIcon },
];

const ADS_OPTIMIZER_NAV_ITEM: NavItem = {
  label: 'Ads Optimizer',
  href: '/ads/optimizer',
  icon: GenericItemIcon,
};

type SidebarNavProps = {
  enableAdsOptimizer?: boolean;
};

const isActive = (pathname: string, href: string) => {
  if (href === '#') return false;
  if (href === '/dashboard') return pathname === '/' || pathname.startsWith('/dashboard');
  return pathname.startsWith(href);
};

export default function SidebarNav({ enableAdsOptimizer = false }: SidebarNavProps) {
  const pathname = usePathname();
  const navItems = enableAdsOptimizer
    ? [...BASE_NAV_ITEMS, ADS_OPTIMIZER_NAV_ITEM, ...SECONDARY_NAV_ITEMS]
    : [...BASE_NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

  return (
    <nav className="space-y-2 text-sm">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            title={item.label}
            className={`aph-sidebar-link flex items-center gap-3 rounded-lg px-3 py-2 transition ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted hover:bg-surface-2/60'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="aph-sidebar-label">{item.label}</span>
            {item.badge ? (
              <span
                className={`aph-sidebar-badge ml-auto rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                  active
                    ? 'bg-white/20 text-primary-foreground'
                    : 'bg-surface-2 text-muted'
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
