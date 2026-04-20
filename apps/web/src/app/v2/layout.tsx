import Link from 'next/link';

export default function V2Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-surface px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Amazon Performance Hub V2</div>
            <h1 className="text-2xl font-semibold text-foreground">API-backed operator workspace</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted">
              V2 routes expose bounded operator surfaces backed by curated marts and verified ingestion paths.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/v2"
              className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition hover:border-primary hover:text-primary"
            >
              V2 home
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition hover:border-primary hover:text-primary"
            >
              Back to V1 dashboard
            </Link>
          </div>
        </div>
      </section>

      {children}
    </div>
  );
}
