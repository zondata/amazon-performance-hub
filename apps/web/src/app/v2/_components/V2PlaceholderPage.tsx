import Link from 'next/link';

type V2PlaceholderPageProps = {
  title: string;
  routePath: string;
  summary: string;
};

const quickLinks = [
  { href: '/v2', label: 'V2 home' },
  { href: '/v2/admin/connections', label: 'Admin connections' },
  { href: '/v2/admin/imports', label: 'Admin imports' },
  { href: '/v2/admin/history', label: 'Admin history' },
];

export default function V2PlaceholderPage({
  title,
  routePath,
  summary,
}: V2PlaceholderPageProps) {
  return (
    <section className="space-y-6 rounded-3xl border border-border bg-surface p-8 shadow-sm">
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">V2 Placeholder</div>
        <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted">{summary}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Route</div>
          <div className="mt-2 font-mono text-sm text-foreground">{routePath}</div>
          <p className="mt-3 text-sm leading-6 text-muted">
            This boundary exists so V2 work can land outside the monolithic V1 pages before any real Amazon
            connector or marts logic is introduced.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Current Status</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
            <li>No live data fetching</li>
            <li>No Amazon auth or sync logic</li>
            <li>Placeholder UI only</li>
          </ul>
        </div>
      </div>

      <nav className="flex flex-wrap gap-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition hover:border-primary hover:text-primary"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
