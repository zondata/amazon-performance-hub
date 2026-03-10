'use client';

import { Fragment, type ReactNode, useState } from 'react';
import Link from 'next/link';

import type { AdsOptimizerTargetRole } from '@/lib/ads-optimizer/role';
import type { AdsOptimizerRun } from '@/lib/ads-optimizer/runtimeTypes';
import type { AdsOptimizerProductRunState } from '@/lib/ads-optimizer/state';
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
  productState: AdsOptimizerProductRunState | null;
  rows: AdsOptimizerTargetProfileSnapshotView[];
};

const TARGET_TABLE_COL_COUNT = 32;

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

const labelize = (value: string | null) =>
  value
    ? value
        .split(/[_\s]+/)
        .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
        .join(' ')
    : 'Not captured';

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

const getCoverageItems = (row: AdsOptimizerTargetProfileSnapshotView) => [
  { label: 'TOS', status: row.coverage.statuses.tosIs },
  { label: 'STIS', status: row.coverage.statuses.stis },
  { label: 'STIR', status: row.coverage.statuses.stir },
  { label: 'Place', status: row.coverage.statuses.placementContext },
  { label: 'Terms', status: row.coverage.statuses.searchTerms },
  { label: 'BE', status: row.coverage.statuses.breakEvenInputs },
] as const;

const getCoverageSummary = (row: AdsOptimizerTargetProfileSnapshotView) => {
  const counts = { ready: 0, missing: 0, partial: 0 };

  for (const item of getCoverageItems(row)) {
    counts[item.status] += 1;
  }

  return counts;
};

const coverageSummaryTextClass = (status: 'ready' | 'partial' | 'missing', count: number) => {
  if (count <= 0) return 'text-muted';
  if (status === 'ready') return 'text-emerald-700';
  if (status === 'partial') return 'text-amber-700';
  return 'text-rose-700';
};

const statePillClass = (kind: 'efficiency' | 'confidence' | 'importance', value: string | null) => {
  if (kind === 'efficiency') {
    if (value === 'profitable') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (value === 'break_even') return 'border-amber-200 bg-amber-50 text-amber-800';
    if (value === 'converting_but_loss_making') {
      return 'border-rose-200 bg-rose-50 text-rose-800';
    }
    if (value === 'learning_no_sale') return 'border-sky-200 bg-sky-50 text-sky-800';
    return 'border-border bg-surface-2 text-muted';
  }

  if (kind === 'confidence') {
    if (value === 'confirmed') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (value === 'directional') return 'border-sky-200 bg-sky-50 text-sky-800';
    return 'border-border bg-surface-2 text-muted';
  }

  if (value === 'tier_1_dominant') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (value === 'tier_2_core') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-border bg-surface-2 text-muted';
};

const StatePill = (props: {
  kind: 'efficiency' | 'confidence' | 'importance';
  value: string | null;
  label: string;
}) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${statePillClass(
      props.kind,
      props.value
    )}`}
  >
    {props.label}
  </span>
);

const rolePillClass = (value: AdsOptimizerTargetRole | null) => {
  if (value === 'Scale') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (value === 'Harvest') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (value === 'Rank Push') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (value === 'Rank Defend') return 'border-violet-200 bg-violet-50 text-violet-800';
  if (value === 'Suppress') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (value === 'Discover') return 'border-cyan-200 bg-cyan-50 text-cyan-800';
  return 'border-border bg-surface-2 text-muted';
};

const RolePill = (props: { value: AdsOptimizerTargetRole | null; label: string }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${rolePillClass(
      props.value
    )}`}
  >
    {props.label}
  </span>
);

const ProductStateBadge = (props: { state: AdsOptimizerProductRunState | null }) => {
  if (!props.state) {
    return (
      <div className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
        Product state not captured
      </div>
    );
  }

  const value = props.state.value;
  const className =
    value === 'profitable'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : value === 'break_even'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : value === 'loss'
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : 'border-border bg-surface-2 text-muted';

  return (
    <div
      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${className}`}
    >
      {props.state.label}
    </div>
  );
};

const CoverageDetailsToggle = (props: {
  items: ReadonlyArray<{ label: string; status: 'ready' | 'partial' | 'missing' }>;
  notes: string[];
  daysObserved: number;
  targetSnapshotId: string;
}) => (
  <details className="inline text-xs text-muted">
    <summary className="inline cursor-pointer font-semibold text-primary">View coverage</summary>
    <div className="mt-2 rounded-lg border border-border bg-surface-2 p-3">
      <div>Observed {formatNumber(props.daysObserved)} day(s)</div>
      <div className="mt-2 flex max-w-[280px] flex-wrap gap-1.5">
        {props.items.map((item) => (
          <CoverageBadge
            key={`${props.targetSnapshotId}:${item.label}`}
            label={item.label}
            status={item.status}
          />
        ))}
      </div>
      {props.notes.length > 0 ? (
        <div className="mt-2 space-y-1">
          {props.notes.map((note) => (
            <div key={`${props.targetSnapshotId}:${note}`}>{note}</div>
          ))}
        </div>
      ) : null}
    </div>
  </details>
);

const ReasonCodes = (props: { codes: string[] }) => {
  if (props.codes.length === 0) {
    return <div className="text-muted">No explicit reason codes were captured.</div>;
  }

  return (
    <ul className="space-y-1.5">
      {props.codes.map((code) => (
        <li
          key={code}
          className="rounded-md border border-border bg-surface-2 px-2.5 py-2 font-mono text-[11px] leading-4 text-foreground"
        >
          {code}
        </li>
      ))}
    </ul>
  );
};

const DetailSection = (props: { label: string; children: ReactNode; subtle?: boolean }) => (
  <div
    className={
      props.subtle
        ? 'rounded-lg border border-border/70 bg-surface px-3 py-3'
        : 'space-y-2'
    }
  >
    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{props.label}</div>
    <div className="text-sm text-foreground">{props.children}</div>
  </div>
);

export default function OptimizerTargetsPanel(props: OptimizerTargetsPanelProps) {
  const [expandedTargetSnapshotId, setExpandedTargetSnapshotId] = useState<string | null>(null);

  if (props.asin === 'all') {
    return (
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Targets scope</div>
        <div className="mt-2 text-lg font-semibold text-foreground">
          Select one ASIN to review target states.
        </div>
        <div className="mt-2 max-w-3xl text-sm text-muted">
          Phase 7 role review is captured and audited per selected ASIN only. Pick one ASIN, then
          run the optimizer from History to persist reviewable target role rows.
        </div>
      </section>
    );
  }

  if (!props.run) {
    return (
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Targets run state</div>
        <div className="mt-2 text-lg font-semibold text-foreground">
          No captured target roles exist for this ASIN/date range yet.
        </div>
        <div className="mt-2 max-w-3xl text-sm text-muted">
          Phase 7 reads the latest completed optimizer run that exactly matches the current ASIN
          and date range. Create a manual run first so the persisted target profile, state, role,
          and guardrail rows can be reviewed here.
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
            <div className="text-xs uppercase tracking-[0.3em] text-muted">State engine</div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              Target profiles plus deterministic role + guardrail outputs
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              Phase 7 reads the exact run’s target profiles and persists deterministic efficiency,
              confidence, tier, opportunity, risk, desired role, current role, and resolved
              guardrail envelopes. No recommendation logic or execution handoff is active in this
              view.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ProductStateBadge state={props.productState} />
            <div className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
              SP only V1
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-6">
        <SummaryCard
          label="Captured run"
          value={formatUiDateRange(props.run.date_start, props.run.date_end)}
        />
        <SummaryCard
          label="Run created"
          value={formatDateTime(props.run.created_at)}
          detail={`Rule pack ${props.run.rule_pack_version_label}`}
        />
        <SummaryCard
          label="Product state"
          value={props.productState?.label ?? 'Not captured'}
          detail={
            props.productState
              ? `Objective ${props.productState.objective}`
              : 'Older runs may predate persisted product state capture.'
          }
        />
        <SummaryCard
          label="Target role rows"
          value={formatNumber(props.rows.length)}
          detail="Read-only rows persisted from the matching manual run."
        />
        <SummaryCard
          label="Role transitions"
          value={formatNumber(props.run.role_transition_count)}
          detail="Append-only transition logs saved for this run."
        />
        <SummaryCard
          label="Coverage notes"
          value={formatNumber(coverageWarnings)}
          detail="Coverage gaps stay explicit instead of being guessed."
        />
      </section>

      {props.productState ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Product state snapshot</div>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface px-4 py-4">
              <div className="text-xs uppercase tracking-wide text-muted">Product state reason</div>
              <div className="mt-2 text-sm text-foreground">{props.productState.reason}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-4">
              <div className="text-xs uppercase tracking-wide text-muted">Objective reason</div>
              <div className="mt-2 text-sm text-foreground">
                {props.productState.objectiveReason}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Target rows</div>
            <div className="mt-2 text-sm text-muted">
              Showing persisted Phase 7 profiles, states, roles, and guardrails for {props.asin}{' '}
              from the exact run window {formatUiDateRange(props.start, props.end)}.
            </div>
          </div>
          <Link href={props.historyHref} className="text-sm font-semibold text-primary">
            Go to History
          </Link>
        </div>

        {props.rows.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
            The selected run exists, but no target role rows were returned from snapshot storage.
          </div>
        ) : (
          <div className="mt-4 overflow-y-auto">
            <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
              <table className="min-w-[2520px] table-auto border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Campaign</th>
                    <th className="px-3 py-2">Ad group</th>
                    <th className="px-3 py-2">Efficiency</th>
                    <th className="px-3 py-2">Confidence</th>
                    <th className="px-3 py-2">Tier</th>
                    <th className="px-3 py-2">Desired role</th>
                    <th className="px-3 py-2">Current role</th>
                    <th className="px-3 py-2">Opportunity</th>
                    <th className="px-3 py-2">Risk</th>
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
                  {props.rows.map((row) => {
                    const coverageSummary = getCoverageSummary(row);
                    const isExpanded = expandedTargetSnapshotId === row.targetSnapshotId;

                    return (
                      <Fragment key={row.targetSnapshotId}>
                        <tr className="border-b border-border/60 align-top">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-foreground">{row.targetText}</div>
                            <div className="mt-1 text-xs text-muted">
                              {row.typeLabel ?? 'Target'} · {row.matchType ?? '—'} · {row.targetId}
                            </div>
                            <button
                              type="button"
                              className="mt-2 text-xs font-semibold text-foreground underline decoration-border underline-offset-4 transition hover:text-primary"
                              aria-expanded={isExpanded}
                              aria-controls={`target-detail-panel-${row.targetSnapshotId}`}
                              onClick={() =>
                                setExpandedTargetSnapshotId((current) =>
                                  current === row.targetSnapshotId ? null : row.targetSnapshotId
                                )
                              }
                            >
                              {isExpanded ? 'Hide details' : 'Details'}
                            </button>
                          </td>
                        <td className="px-3 py-3 text-foreground">
                          <div>{row.campaignName ?? row.campaignId}</div>
                          <div className="mt-1 text-xs text-muted">{row.campaignId}</div>
                        </td>
                        <td className="px-3 py-3 text-foreground">
                          <div>{row.adGroupName ?? row.adGroupId}</div>
                          <div className="mt-1 text-xs text-muted">{row.adGroupId}</div>
                        </td>
                        <td className="px-3 py-3">
                          <StatePill
                            kind="efficiency"
                            value={row.state.efficiency.value}
                            label={row.state.efficiency.label}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <StatePill
                            kind="confidence"
                            value={row.state.confidence.value}
                            label={row.state.confidence.label}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <StatePill
                            kind="importance"
                            value={row.state.importance.value}
                            label={row.state.importance.label}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <RolePill
                            value={row.role.desiredRole.value}
                            label={row.role.desiredRole.label}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <RolePill
                            value={row.role.currentRole.value}
                            label={row.role.currentRole.label}
                          />
                        </td>
                        <td className="px-3 py-3 text-foreground">
                          {formatNumber(row.state.opportunityScore)}
                        </td>
                        <td className="px-3 py-3 text-foreground">{formatNumber(row.state.riskScore)}</td>
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
                        <td className="px-3 py-3 text-foreground">
                          {formatCurrency(row.derived.lossDollars)}
                        </td>
                        <td className="px-3 py-3 text-foreground">
                          {formatCurrency(row.derived.profitDollars)}
                        </td>
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
                          <div className="text-xs text-muted">
                            <span
                              className={`font-medium ${coverageSummaryTextClass(
                                'ready',
                                coverageSummary.ready
                              )}`}
                            >
                              Ready {coverageSummary.ready}
                            </span>{' '}
                            ·{' '}
                            <span
                              className={`font-medium ${coverageSummaryTextClass(
                                'missing',
                                coverageSummary.missing
                              )}`}
                            >
                              Missing {coverageSummary.missing}
                            </span>{' '}
                            ·{' '}
                            <span
                              className={`font-medium ${coverageSummaryTextClass(
                                'partial',
                                coverageSummary.partial
                              )}`}
                            >
                              Partial {coverageSummary.partial}
                            </span>{' '}
                            ·{' '}
                            <CoverageDetailsToggle
                              items={getCoverageItems(row)}
                              notes={row.coverage.notes}
                              daysObserved={row.coverage.daysObserved}
                              targetSnapshotId={row.targetSnapshotId}
                            />
                          </div>
                        </td>
                        </tr>
                        {isExpanded ? (
                          <tr className="border-b border-border/60 bg-surface-2/30">
                            <td
                              id={`target-detail-panel-${row.targetSnapshotId}`}
                              colSpan={TARGET_TABLE_COL_COUNT}
                              className="px-4 py-4"
                            >
                              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                                <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="text-xs uppercase tracking-[0.3em] text-muted">
                                      Target details
                                    </div>
                                    <div className="mt-2 text-base font-semibold text-foreground">
                                      {row.targetText}
                                    </div>
                                    <div className="mt-1 text-sm text-muted">
                                      {row.typeLabel ?? 'Target'} · {row.matchType ?? '—'} ·{' '}
                                      {row.targetId}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <RolePill
                                      value={row.role.currentRole.value}
                                      label={`Current ${row.role.currentRole.label}`}
                                    />
                                    <RolePill
                                      value={row.role.desiredRole.value}
                                      label={`Desired ${row.role.desiredRole.label}`}
                                    />
                                    <StatePill
                                      kind="efficiency"
                                      value={row.state.efficiency.value}
                                      label={row.state.efficiency.label}
                                    />
                                    <StatePill
                                      kind="confidence"
                                      value={row.state.confidence.value}
                                      label={row.state.confidence.label}
                                    />
                                    <StatePill
                                      kind="importance"
                                      value={row.state.importance.value}
                                      label={row.state.importance.label}
                                    />
                                  </div>
                                </div>

                                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)]">
                                  <div className="space-y-4">
                                    <div className="rounded-xl border border-border bg-surface-2 p-4">
                                      <div className="text-xs uppercase tracking-wide text-muted">
                                        State breakdown
                                      </div>
                                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                                        <DetailSection label="Efficiency" subtle>
                                          {row.state.efficiency.detail}
                                        </DetailSection>
                                        <DetailSection label="Confidence" subtle>
                                          {row.state.confidence.detail}
                                        </DetailSection>
                                        <DetailSection label="Importance" subtle>
                                          {row.state.importance.detail}
                                        </DetailSection>
                                      </div>
                                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                                        <DetailSection
                                          label={`Opportunity ${formatNumber(row.state.opportunityScore)}`}
                                          subtle
                                        >
                                          <ReasonCodes codes={row.state.opportunityReasonCodes} />
                                        </DetailSection>
                                        <DetailSection
                                          label={`Risk ${formatNumber(row.state.riskScore)}`}
                                          subtle
                                        >
                                          <ReasonCodes codes={row.state.riskReasonCodes} />
                                        </DetailSection>
                                      </div>
                                      <div className="mt-4 border-t border-border pt-4">
                                        <DetailSection label="Summary reason codes">
                                          <ReasonCodes codes={row.state.summaryReasonCodes} />
                                        </DetailSection>
                                      </div>
                                    </div>

                                    <div className="rounded-xl border border-border bg-surface-2 p-4">
                                      <div className="text-xs uppercase tracking-wide text-muted">
                                        Role resolution
                                      </div>
                                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                                        <DetailSection label="Desired role" subtle>
                                          <div className="space-y-3">
                                            <RolePill
                                              value={row.role.desiredRole.value}
                                              label={row.role.desiredRole.label}
                                            />
                                            <div>{row.role.desiredRole.detail}</div>
                                            <ReasonCodes codes={row.role.desiredRole.reasonCodes} />
                                          </div>
                                        </DetailSection>
                                        <DetailSection label="Current role" subtle>
                                          <div className="space-y-3">
                                            <RolePill
                                              value={row.role.currentRole.value}
                                              label={row.role.currentRole.label}
                                            />
                                            <div>{row.role.currentRole.detail}</div>
                                            <ReasonCodes codes={row.role.currentRole.reasonCodes} />
                                          </div>
                                        </DetailSection>
                                        <DetailSection label="Transition" subtle>
                                          <div className="space-y-3">
                                            <div>
                                              Previous role: {row.role.previousRole ?? 'None captured'}
                                            </div>
                                            <div>Transition rule: {labelize(row.role.transitionRule)}</div>
                                            <ReasonCodes codes={row.role.transitionReasonCodes} />
                                          </div>
                                        </DetailSection>
                                      </div>
                                      <div className="mt-4 border-t border-border pt-4">
                                        <DetailSection label="Role summary reason codes">
                                          <ReasonCodes codes={row.role.summaryReasonCodes} />
                                        </DetailSection>
                                      </div>
                                    </div>

                                    <div className="grid gap-4 xl:grid-cols-2">
                                      <DetailSection label="Demand proxies" subtle>
                                        Demand proxies: {formatNumber(row.demandProxies.searchTermCount)}{' '}
                                        search terms,{' '}
                                        {formatNumber(row.demandProxies.sameTextSearchTermCount)} same-text,{' '}
                                        {formatNumber(row.demandProxies.totalSearchTermImpressions)}{' '}
                                        search-term impressions,{' '}
                                        {formatNumber(row.demandProxies.totalSearchTermClicks)} search-term
                                        clicks.
                                      </DetailSection>
                                      <DetailSection label="Placement context" subtle>
                                        Placement context: {formatCurrency(row.placementContext.spend)} spend,{' '}
                                        {formatNumber(row.placementContext.clicks)} clicks, modifier{' '}
                                        {formatPercent(
                                          row.placementContext.topOfSearchModifierPct !== null
                                            ? row.placementContext.topOfSearchModifierPct / 100
                                            : null
                                        )}
                                        .
                                      </DetailSection>
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="rounded-xl border border-border bg-surface-2 p-4">
                                      <div className="text-xs uppercase tracking-wide text-muted">
                                        Guardrail-ready envelope
                                      </div>
                                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                        <DetailSection label="Control flags" subtle>
                                          <div className="space-y-2">
                                            <div>
                                              Manual approval:{' '}
                                              {row.role.guardrails.flags.requiresManualApproval
                                                ? 'Required'
                                                : 'Not required'}
                                            </div>
                                            <div>
                                              Auto-pause eligible:{' '}
                                              {row.role.guardrails.flags.autoPauseEligible
                                                ? 'Yes'
                                                : 'No'}
                                            </div>
                                            <div>
                                              Bid changes allowed:{' '}
                                              {row.role.guardrails.flags.bidChangesAllowed ? 'Yes' : 'No'}
                                            </div>
                                            <div>
                                              Placement changes allowed:{' '}
                                              {row.role.guardrails.flags.placementChangesAllowed
                                                ? 'Yes'
                                                : 'No'}
                                            </div>
                                            <div>
                                              Transition locked:{' '}
                                              {row.role.guardrails.flags.transitionLocked ? 'Yes' : 'No'}
                                            </div>
                                          </div>
                                        </DetailSection>
                                        <DetailSection label="Guardrail categories" subtle>
                                          <div className="grid gap-2 sm:grid-cols-2">
                                            <div>
                                              No-sale spend cap:{' '}
                                              {formatCurrency(row.role.guardrails.categories.noSaleSpendCap)}
                                            </div>
                                            <div>
                                              No-sale click cap:{' '}
                                              {formatNumber(row.role.guardrails.categories.noSaleClickCap)}
                                            </div>
                                            <div>
                                              Max loss / cycle:{' '}
                                              {formatCurrency(row.role.guardrails.categories.maxLossPerCycle)}
                                            </div>
                                            <div>
                                              Max bid increase / cycle:{' '}
                                              {row.role.guardrails.categories.maxBidIncreasePerCyclePct === null
                                                ? '—'
                                                : `${row.role.guardrails.categories.maxBidIncreasePerCyclePct}%`}
                                            </div>
                                            <div>
                                              Max bid decrease / cycle:{' '}
                                              {row.role.guardrails.categories.maxBidDecreasePerCyclePct === null
                                                ? '—'
                                                : `${row.role.guardrails.categories.maxBidDecreasePerCyclePct}%`}
                                            </div>
                                            <div>
                                              Max placement bias increase / cycle:{' '}
                                              {row.role.guardrails.categories
                                                .maxPlacementBiasIncreasePerCyclePct === null
                                                ? '—'
                                                : `${row.role.guardrails.categories.maxPlacementBiasIncreasePerCyclePct}%`}
                                            </div>
                                            <div>
                                              Rank-push time limit:{' '}
                                              {formatNumber(row.role.guardrails.categories.rankPushTimeLimitDays)} day(s)
                                            </div>
                                            <div>
                                              Manual approval threshold:{' '}
                                              {labelize(row.role.guardrails.categories.manualApprovalThreshold)}
                                            </div>
                                            <div>
                                              Auto-pause threshold:{' '}
                                              {formatNumber(row.role.guardrails.categories.autoPauseThreshold)}
                                            </div>
                                            <div>
                                              Min bid floor:{' '}
                                              {formatCurrency(row.role.guardrails.categories.minBidFloor)}
                                            </div>
                                            <div>
                                              Max bid ceiling:{' '}
                                              {formatCurrency(row.role.guardrails.categories.maxBidCeiling)}
                                            </div>
                                          </div>
                                        </DetailSection>
                                      </div>
                                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                                        <DetailSection label="Guardrail reason codes" subtle>
                                          <ReasonCodes codes={row.role.guardrails.reasonCodes} />
                                        </DetailSection>
                                        <DetailSection label="Guardrail notes" subtle>
                                          {row.role.guardrails.notes.length > 0 ? (
                                            <div className="space-y-2 text-sm text-foreground">
                                              {row.role.guardrails.notes.map((note) => (
                                                <div key={`${row.targetSnapshotId}:${note}`}>{note}</div>
                                              ))}
                                            </div>
                                          ) : (
                                            'No additional guardrail notes were captured.'
                                          )}
                                        </DetailSection>
                                      </div>
                                    </div>

                                    <DetailSection label="Representative search term" subtle>
                                      Representative search term:{' '}
                                      {row.searchTermDiagnostics.representativeSearchTerm ?? '—'}
                                      {row.searchTermDiagnostics.representativeSameText
                                        ? ' (same text)'
                                        : ''}
                                      .
                                    </DetailSection>
                                    <DetailSection label="Top search-term diagnostics" subtle>
                                      <div className="space-y-2">
                                        {row.searchTermDiagnostics.topTerms.map((term) => (
                                          <div key={`${row.targetSnapshotId}:${term.searchTerm}`}>
                                            {term.searchTerm} ·{' '}
                                            {term.sameText ? 'same text' : 'adjacent'} ·{' '}
                                            {formatNumber(term.clicks)} clicks ·{' '}
                                            {formatCurrency(term.spend)} spend · STIS{' '}
                                            {formatPercent(term.stis)} · STIR{' '}
                                            {formatNumber(term.stir)}
                                          </div>
                                        ))}
                                      </div>
                                    </DetailSection>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
