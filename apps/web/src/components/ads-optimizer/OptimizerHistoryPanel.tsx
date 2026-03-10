import type { AdsOptimizerRun } from '@/lib/ads-optimizer/runtimeTypes';
import {
  formatUiDateRange,
  formatUiDateTime as formatDateTime,
} from '@/lib/time/formatUiDate';

type OptimizerHistoryPanelProps = {
  asin: string;
  start: string;
  end: string;
  returnTo: string;
  activeVersionLabel: string;
  runs: AdsOptimizerRun[];
  notice: string | null;
  error: string | null;
  runNowAction: (formData: FormData) => Promise<void>;
};

const statusBadgeClass = (status: AdsOptimizerRun['status']) => {
  if (status === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (status === 'running') {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }
  if (status === 'failed') {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800';
};

const MetricCard = (props: { label: string; value: string; detail?: string }) => (
  <div className="rounded-xl border border-border bg-surface px-4 py-3">
    <div className="text-xs uppercase tracking-wide text-muted">{props.label}</div>
    <div className="mt-2 text-lg font-semibold text-foreground">{props.value}</div>
    {props.detail ? <div className="mt-1 text-sm text-muted">{props.detail}</div> : null}
  </div>
);

export default function OptimizerHistoryPanel(props: OptimizerHistoryPanelProps) {
  const runDisabled = props.asin === 'all';

  return (
    <div className="space-y-6">
      {props.notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          {props.notice}
        </div>
      ) : null}
      {props.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          {props.error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Run boundary</div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              Manual runs capture auditable snapshots only
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              Runs persist auditable product snapshots plus Phase 5 target profile snapshots, while
              recommendation rows remain frozen placeholders only. No recommendation engine,
              target-role engine, or Ads Workspace execution handoff is running yet.
            </div>
          </div>
          <div className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
            SP only V1
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Run now</div>
          <div className="mt-2 text-sm text-muted">
            New runs are append-only. Each run freezes the selected date window, ASIN scope, and
            active optimizer rule-pack version for auditability.
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <MetricCard label="Selected ASIN" value={props.asin === 'all' ? 'All ASINs' : props.asin} />
            <MetricCard
              label="Active rule pack"
              value={props.activeVersionLabel}
              detail="The active config version is copied onto the run header."
            />
            <MetricCard label="Start" value={props.start} />
            <MetricCard label="End" value={props.end} />
          </div>
          <form action={props.runNowAction} className="mt-5 space-y-4">
            <input type="hidden" name="return_to" value={props.returnTo} />
            <input type="hidden" name="asin" value={props.asin} />
            <input type="hidden" name="start" value={props.start} />
            <input type="hidden" name="end" value={props.end} />
            {runDisabled ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
                Phase 4 manual runs support one ASIN at a time. Select a single ASIN above, then
                open the History view again to create a run.
              </div>
            ) : (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-800">
                This creates a manual run record and stores product + target profile snapshots for{' '}
                {props.asin}. Recommendation snapshots remain placeholders only.
              </div>
            )}
            <button
              type="submit"
              disabled={runDisabled}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Run optimizer now
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">History</div>
          <div className="mt-2 text-sm text-muted">
            {props.asin === 'all'
              ? 'Showing the latest optimizer runs across all ASIN scopes for this account/marketplace.'
              : `Showing the latest optimizer runs for ${props.asin}.`}
          </div>
          {props.runs.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
              No optimizer runs exist yet for the current scope.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {props.runs.map((run) => (
                <div key={run.run_id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-base font-semibold text-foreground">
                          {run.selected_asin} · {formatUiDateRange(run.date_start, run.date_end)}
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(
                            run.status
                          )}`}
                        >
                          {run.status}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-muted">
                        Created {formatDateTime(run.created_at)} · Rule pack {run.rule_pack_version_label}
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard
                          label="Product snapshots"
                          value={String(run.product_snapshot_count)}
                        />
                        <MetricCard
                          label="Target snapshots"
                          value={String(run.target_snapshot_count)}
                        />
                        <MetricCard
                          label="Recommendation snapshots"
                          value={String(run.recommendation_snapshot_count)}
                          detail="Phase 4 placeholders only"
                        />
                        <MetricCard
                          label="Role transitions"
                          value={String(run.role_transition_count)}
                          detail="Expected to remain zero before Phase 7"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
                      <div>Started {formatDateTime(run.started_at)}</div>
                      <div className="mt-1">Completed {formatDateTime(run.completed_at)}</div>
                    </div>
                  </div>
                  <details className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-foreground">
                      Run details
                    </summary>
                    <div className="mt-3 grid gap-4 xl:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted">Inputs</div>
                        <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-surface p-3 text-xs text-muted">
                          {JSON.stringify(run.input_summary_json, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted">Diagnostics</div>
                        <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-surface p-3 text-xs text-muted">
                          {JSON.stringify(run.diagnostics_json, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
