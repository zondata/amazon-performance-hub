import { formatUiDateRange } from '@/lib/time/formatUiDate';
import { overviewSectionClassName } from './overviewShared';

type OverviewEmptyStateProps = {
  start: string;
  end: string;
};

export default function OverviewEmptyState(props: OverviewEmptyStateProps) {
  return (
    <section className={overviewSectionClassName}>
      <div className="text-xs uppercase tracking-[0.3em] text-muted">Overview scope</div>
      <div className="mt-2 text-lg font-semibold text-foreground">
        Select one ASIN to load the Phase 3 product command-center.
      </div>
      <div className="mt-2 max-w-3xl text-sm text-muted">
        The optimizer overview computes product inputs, product state, and objective for one
        selected ASIN at a time. Target profiling, scoring, roles, and read-only recommendations
        are active in the optimizer run flow, but execution handoff remains outside Overview.
      </div>
      <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
        Scope is currently set to all advertised ASINs. Choose a single ASIN above, then apply the
        filters to render the command-center for {formatUiDateRange(props.start, props.end)}.
      </div>
    </section>
  );
}
