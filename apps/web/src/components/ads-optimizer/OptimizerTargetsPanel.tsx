import Link from 'next/link';

import type { AdsOptimizerRun } from '@/lib/ads-optimizer/runtimeTypes';
import type { AdsOptimizerTargetProfileSnapshotView } from '@/lib/ads-optimizer/targetProfile';
import {
  formatUiDateRange,
  formatUiDateTime as formatDateTime,
} from '@/lib/time/formatUiDate';

type OptimizerTargetsPanelProps = {
  asin: string;
  start: string;
  end: string;
  historyHref: string;
  run: AdsOptimizerRun | null;
  latestCompletedRun: AdsOptimizerRun | null;
  rows: AdsOptimizerTargetProfileSnapshotView[];
};

const formatNumber = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const formatCurrency = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  });
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const coverageBadgeClass = (status: 'ready' | 'partial' | 'missing') => {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-rose-200 bg-rose-50 text-rose-800';
};

const CoverageBadge = (props: { label: string; status: 'ready' | 'partial' | 'missing' }) => (
  <span
    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${coverageBadgeClass(
      props.status
    )}`}
  >
    {props.label} {props.status}
  </span>
);

const SummaryCard = (props: { label: string; value: string; detail?: string }) => (
  <div className="rounded-xl border border-border bg-surface px-4 py-3">
    <div className="text-xs uppercase tracking-wide text-muted">{props.label}</div>
    <div className="mt-2 text-lg font-semibold text-foreground">{props.value}</div>
    {props.detail ? <div className="mt-1 text-sm text-muted">{props.detail}</div> : null}
  </div>
);

export default function OptimizerTargetsPanel(props: OptimizerTargetsPanelProps) {
  if (props.asin === 'all') {
    return (
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Targets scope</div>
        <div className="mt-2 text-lg font-semibold text-foreground">
          Select one ASIN to review target profiles.
        </div>
        <div className="mt-2 max-w-3xl text-sm text-muted">
          Phase 5 target profiles are captured and reviewed per selected ASIN only. Pick one ASIN,
          then run the optimizer from History to persist reviewable target profile rows.
        </div>
      </section>
    );
  }

  if (!props.run) {
    return (
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Targets run state</div>
        <div className="mt-2 text-lg font-semibold text-foreground">
          No captured target profiles exist for this ASIN/date range yet.
        </div>
        <div className="mt-2 max-w-3xl text-sm text-muted">
          Phase 5 reads the latest completed optimizer run that exactly matches the current ASIN and
          date range. Create a manual run first so the full raw + derived target profile rows can be
          reviewed here.
        </div>
        {props.latestCompletedRun ? (
          <div className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-4 text-sm text-muted">
            Latest completed run for {props.asin}: {formatUiDateRange(
              props.latestCompletedRun.date_start,
              props.latestCompletedRun.date_end
            )}{' '}
            · created {formatDateTime(props.latestCompletedRun.created_at)}.
          </div>
        ) : null}
        <div className="mt-5">
          <Link
            href={props.historyHref}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Open History
          </Link>
        </div>
      </section>
    );
  }

  const coverageWarnings = props.rows.reduce((count, row) => count + row.coverage.notes.length, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Target profile engine</div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              Raw + derived target profiles only
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              Phase 5 captures target-level raw inputs and derived diagnostics from existing SP
              facts. No state engine, role engine, recommendation logic, or execution handoff is
              active in this view.
            </div>
          </div>
          <div className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
            SP only V1
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="Captured run" value={formatUiDateRange(props.run.date_start, props.run.date_end)} />
        <SummaryCard
          label="Run created"
          value={formatDateTime(props.run.created_at)}
          detail={`Rule pack ${props.run.rule_pack_version_label}`}
        />
        <SummaryCard
          label="Target profile rows"
          value={formatNumber(props.rows.length)}
          detail="Read-only rows persisted from the matching manual run."
        />
        <SummaryCard
          label="Coverage notes"
          value={formatNumber(coverageWarnings)}
          detail="Coverage gaps stay explicit instead of being guessed."
        />
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Target rows</div>
            <div className="mt-2 text-sm text-muted">
              Showing persisted Phase 5 profiles for {props.asin} from the exact run window{' '}
              {formatUiDateRange(props.start, props.end)}.
            </div>
          </div>
          <Link href={props.historyHref} className="text-sm font-semibold text-primary">
            Go to History
          </Link>
        </div>

        {props.rows.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
            The selected run exists, but no target profile rows were returned from snapshot storage.
          </div>
        ) : (
          <div className="mt-4 overflow-y-auto">
            <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
              <table className="min-w-[1800px] table-auto border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Campaign</th>
                    <th className="px-3 py-2">Ad group</th>
                    <th className="px-3 py-2">Impr</th>
                    <th className="px-3 py-2">Clicks</th>
                    <th className="px-3 py-2">Spend</th>
                    <th className="px-3 py-2">Orders</th>
                    <th className="px-3 py-2">Sales</th>
                    <th className="px-3 py-2">CPC</th>
                    <th className="px-3 py-2">CTR</th>
                    <th className="px-3 py-2">CVR</th>
                    <th className="px-3 py-2">ACoS</th>
                    <th className="px-3 py-2">ROAS</th>
                    <th className="px-3 py-2">TOS IS</th>
                    <th className="px-3 py-2">STIS</th>
                    <th className="px-3 py-2">STIR</th>
                    <th className="px-3 py-2">Contrib after ads</th>
                    <th className="px-3 py-2">Break-even gap</th>
                    <th className="px-3 py-2">Max CPC gap</th>
                    <th className="px-3 py-2">Loss $</th>
                    <th className="px-3 py-2">Profit $</th>
                    <th className="px-3 py-2">Click vel.</th>
                    <th className="px-3 py-2">Impr vel.</th>
                    <th className="px-3 py-2">Organic leverage</th>
                    <th className="px-3 py-2">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {props.rows.map((row) => (
                    <tr key={row.targetSnapshotId} className="border-b border-border/60 align-top">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-foreground">{row.targetText}</div>
                        <div className="mt-1 text-xs text-muted">
                          {row.typeLabel ?? 'Target'} · {row.matchType ?? '—'} · {row.targetId}
                        </div>
                        <details className="mt-2 text-xs text-muted">
                          <summary className="cursor-pointer font-semibold text-foreground">
                            Details
                          </summary>
                          <div className="mt-2 space-y-2">
                            <div>
                              Demand proxies: {formatNumber(row.demandProxies.searchTermCount)} search
                              terms, {formatNumber(row.demandProxies.sameTextSearchTermCount)} same-text,
                              {formatNumber(row.demandProxies.totalSearchTermImpressions)} search-term
                              impressions, {formatNumber(row.demandProxies.totalSearchTermClicks)} search-term
                              clicks.
                            </div>
                            <div>
                              Placement context: {formatCurrency(row.placementContext.spend)} spend,{' '}
                              {formatNumber(row.placementContext.clicks)} clicks, modifier{' '}
                              {formatPercent(
                                row.placementContext.topOfSearchModifierPct !== null
                                  ? row.placementContext.topOfSearchModifierPct / 100
                                  : null
                              )}
                              .
                            </div>
                            <div>
                              Representative search term: {row.searchTermDiagnostics.representativeSearchTerm ?? '—'}
                              {row.searchTermDiagnostics.representativeSameText ? ' (same text)' : ''}.
                            </div>
                            <div className="space-y-1">
                              {row.searchTermDiagnostics.topTerms.map((term) => (
                                <div key={`${row.targetSnapshotId}:${term.searchTerm}`}>
                                  {term.searchTerm} · {term.sameText ? 'same text' : 'adjacent'} ·{' '}
                                  {formatNumber(term.clicks)} clicks · {formatCurrency(term.spend)} spend ·
                                  STIS {formatPercent(term.stis)} · STIR {formatNumber(term.stir)}
                                </div>
                              ))}
                            </div>
                          </div>
                        </details>
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        <div>{row.campaignName ?? row.campaignId}</div>
                        <div className="mt-1 text-xs text-muted">{row.campaignId}</div>
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        <div>{row.adGroupName ?? row.adGroupId}</div>
                        <div className="mt-1 text-xs text-muted">{row.adGroupId}</div>
                      </td>
                      <td className="px-3 py-3 text-foreground">{formatNumber(row.raw.impressions)}</td>
                      <td className="px-3 py-3 text-foreground">{formatNumber(row.raw.clicks)}</td>
                      <td className="px-3 py-3 text-foreground">{formatCurrency(row.raw.spend)}</td>
                      <td className="px-3 py-3 text-foreground">{formatNumber(row.raw.orders)}</td>
                      <td className="px-3 py-3 text-foreground">{formatCurrency(row.raw.sales)}</td>
                      <td className="px-3 py-3 text-foreground">{formatCurrency(row.raw.cpc)}</td>
                      <td className="px-3 py-3 text-foreground">{formatPercent(row.raw.ctr)}</td>
                      <td className="px-3 py-3 text-foreground">{formatPercent(row.raw.cvr)}</td>
                      <td className="px-3 py-3 text-foreground">{formatPercent(row.raw.acos)}</td>
                      <td className="px-3 py-3 text-foreground">
                        {row.raw.roas === null ? '—' : row.raw.roas.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-foreground">{formatPercent(row.raw.tosIs)}</td>
                      <td className="px-3 py-3 text-foreground">{formatPercent(row.raw.stis)}</td>
                      <td className="px-3 py-3 text-foreground">{formatNumber(row.raw.stir)}</td>
                      <td className="px-3 py-3 text-foreground">
                        {formatCurrency(row.derived.contributionAfterAds)}
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        {formatPercent(row.derived.breakEvenGap)}
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        {formatCurrency(row.derived.maxCpcSupportGap)}
                      </td>
                      <td className="px-3 py-3 text-foreground">{formatCurrency(row.derived.lossDollars)}</td>
                      <td className="px-3 py-3 text-foreground">{formatCurrency(row.derived.profitDollars)}</td>
                      <td className="px-3 py-3 text-foreground">
                        {row.derived.clickVelocity === null ? '—' : row.derived.clickVelocity.toFixed(1)}
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        {row.derived.impressionVelocity === null
                          ? '—'
                          : row.derived.impressionVelocity.toFixed(1)}
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        {row.derived.organicLeverageProxy === null
                          ? '—'
                          : row.derived.organicLeverageProxy.toFixed(3)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <CoverageBadge label="TOS" status={row.coverage.statuses.tosIs} />
                          <CoverageBadge label="STIS" status={row.coverage.statuses.stis} />
                          <CoverageBadge label="STIR" status={row.coverage.statuses.stir} />
                          <CoverageBadge
                            label="Place"
                            status={row.coverage.statuses.placementContext}
                          />
                          <CoverageBadge label="Terms" status={row.coverage.statuses.searchTerms} />
                          <CoverageBadge
                            label="BE"
                            status={row.coverage.statuses.breakEvenInputs}
                          />
                        </div>
                        <div className="mt-2 text-xs text-muted">
                          Observed {formatNumber(row.coverage.daysObserved)} day(s)
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-muted">
                          {row.coverage.notes.slice(0, 3).map((note) => (
                            <div key={`${row.targetSnapshotId}:${note}`}>{note}</div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
