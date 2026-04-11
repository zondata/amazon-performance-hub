import Link from 'next/link';

const routeCards = [
  {
    href: '/v2/overview/demo-asin',
    title: 'Overview placeholder',
    description: 'ASIN-scoped shell for future V2 diagnostics.',
  },
  {
    href: '/v2/queries/demo-asin',
    title: 'Queries placeholder',
    description: 'ASIN-scoped shell for future query and rank workflows.',
  },
  {
    href: '/v2/admin/connections',
    title: 'Connections placeholder',
    description: 'Reserved for future connector and credential status surfaces.',
  },
  {
    href: '/v2/admin/imports',
    title: 'Imports placeholder',
    description: 'Reserved for future V2 import and sync monitoring.',
  },
  {
    href: '/v2/admin/history',
    title: 'History placeholder',
    description: 'Reserved for future V2 change and evidence history tools.',
  },
];

export default function V2HomePage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-border bg-surface p-8 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">Stage 1</div>
        <h2 className="mt-3 text-3xl font-semibold text-foreground">V2 route boundary</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          This page is intentionally small. It confirms that the `/v2` namespace is live and that future V2 work can
          be added without expanding monolithic V1 pages.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {routeCards.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="rounded-3xl border border-border bg-surface p-6 shadow-sm transition hover:border-primary"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Placeholder route</div>
            <div className="mt-3 text-xl font-semibold text-foreground">{route.title}</div>
            <p className="mt-2 text-sm leading-6 text-muted">{route.description}</p>
            <div className="mt-4 font-mono text-xs text-muted">{route.href}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
