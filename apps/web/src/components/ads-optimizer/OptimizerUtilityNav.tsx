import type { AdsOptimizerUtility } from '@/lib/ads-optimizer/shell';

type OptimizerUtilityNavItem = {
  label: string;
  value: AdsOptimizerUtility;
  href: string;
};

type OptimizerUtilityNavProps = {
  items: OptimizerUtilityNavItem[];
  activeUtility: AdsOptimizerUtility | null;
  clearHref: string;
};

export default function OptimizerUtilityNav(props: OptimizerUtilityNavProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/70 p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Utilities</div>
        <div className="mt-1 text-sm text-muted">
          History, Config, and Outcome Review stay available as secondary tools without adding more
          primary tabs.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {props.items.map((item) => {
          const active = item.value === props.activeUtility;
          return (
            <a
              key={item.value}
              href={item.href}
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                active
                  ? 'border-primary/40 bg-primary text-primary-foreground'
                  : 'border-border bg-surface-2 text-foreground hover:border-primary/40 hover:text-primary'
              }`}
            >
              {item.label}
            </a>
          );
        })}
        {props.activeUtility ? (
          <a
            href={props.clearHref}
            className="rounded-full border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted transition hover:border-primary/40 hover:text-primary"
          >
            Back to main view
          </a>
        ) : null}
      </div>
    </div>
  );
}
