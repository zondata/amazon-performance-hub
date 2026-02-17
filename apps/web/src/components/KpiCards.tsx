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
          className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm"
        >
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
            {item.label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {item.value}
          </div>
          {item.subvalue ? (
            <div className="mt-1 text-xs text-slate-500">{item.subvalue}</div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
