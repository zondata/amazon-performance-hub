type KpiItem = {
  label: string;
  value: string;
  subvalue?: string;
};

type KpiCardsProps = {
  items: KpiItem[];
};

export default function KpiCards({ items }: KpiCardsProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm"
        >
          <div className="text-xs uppercase tracking-[0.25em] text-muted">
            {item.label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {item.value}
          </div>
          {item.subvalue ? (
            <div className="mt-1 text-xs text-muted">{item.subvalue}</div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
