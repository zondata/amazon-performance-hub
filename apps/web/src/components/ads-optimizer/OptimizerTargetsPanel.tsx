'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';

import type { AdsOptimizerRunComparisonView } from '@/lib/ads-optimizer/comparison';
import type { AdsOptimizerTargetRole } from '@/lib/ads-optimizer/role';
import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';
import type { AdsOptimizerRun } from '@/lib/ads-optimizer/runtimeTypes';
import type { AdsOptimizerProductRunState } from '@/lib/ads-optimizer/state';
import {
  formatUiDateRange,
  formatUiDateTime as formatDateTime,
} from '@/lib/time/formatUiDate';

type OptimizerTargetsPanelProps = {
  asin: string;
  start: string;
  end: string;
  historyHref: string;
  returnTo: string;
  workspaceQueueHref: string;
  run: AdsOptimizerRun | null;
  latestCompletedRun: AdsOptimizerRun | null;
  productState: AdsOptimizerProductRunState | null;
  comparison: AdsOptimizerRunComparisonView | null;
  rows: AdsOptimizerTargetReviewRow[];
  handoffAction: (formData: FormData) => Promise<void>;
};

type QueueSort = 'priority' | 'risk' | 'opportunity' | 'target';
type FilterValue = 'all' | string;
type WorkspaceSupportedActionType =
  | 'update_target_bid'
  | 'update_target_state'
  | 'update_placement_modifier';

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

const statePillClass = (
  kind: 'efficiency' | 'confidence' | 'importance',
  value: string | null
) => {
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

const rolePillClass = (value: AdsOptimizerTargetRole | null) => {
  if (value === 'Scale') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (value === 'Harvest') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (value === 'Rank Push') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (value === 'Rank Defend') return 'border-violet-200 bg-violet-50 text-violet-800';
  if (value === 'Suppress') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (value === 'Discover') return 'border-cyan-200 bg-cyan-50 text-cyan-800';
  return 'border-border bg-surface-2 text-muted';
};

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

const SummaryCard = (props: { label: string; value: string; detail?: string }) => (
  <div className="rounded-xl border border-border bg-surface px-4 py-3">
    <div className="text-xs uppercase tracking-wide text-muted">{props.label}</div>
    <div className="mt-2 text-lg font-semibold text-foreground">{props.value}</div>
    {props.detail ? <div className="mt-1 text-sm text-muted">{props.detail}</div> : null}
  </div>
);

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

const RolePill = (props: { value: AdsOptimizerTargetRole | null; label: string }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${rolePillClass(
      props.value
    )}`}
  >
    {props.label}
  </span>
);

const CoverageBadge = (props: { label: string; status: 'ready' | 'partial' | 'missing' }) => (
  <span
    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${coverageBadgeClass(
      props.status
    )}`}
  >
    {props.label} {props.status}
  </span>
);

const ReasonCodeBadge = (props: { code: string }) => (
  <span className="rounded-full border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-foreground">
    {props.code}
  </span>
);

const exceptionSeverityClass = (severity: 'high' | 'medium' | 'low') => {
  if (severity === 'high') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-sky-200 bg-sky-50 text-sky-800';
};

const ExceptionSeverityBadge = (props: { severity: 'high' | 'medium' | 'low' }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${exceptionSeverityClass(
      props.severity
    )}`}
  >
    {props.severity}
  </span>
);

const DetailSection = (props: { label: string; children: ReactNode }) => (
  <section className="rounded-xl border border-border bg-surface px-4 py-4">
    <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
      {props.label}
    </div>
    <div className="mt-3 text-sm text-foreground">{props.children}</div>
  </section>
);

const DetailGrid = (props: { items: Array<{ label: string; value: string }> }) => (
  <dl className="grid gap-3 sm:grid-cols-2">
    {props.items.map((item) => (
      <div key={item.label} className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          {item.label}
        </dt>
        <dd className="mt-1 text-sm text-foreground">{item.value}</dd>
      </div>
    ))}
  </dl>
);

const JsonBlock = (props: { value: Record<string, unknown> | null }) => {
  if (!props.value) {
    return <div className="text-sm text-muted">Not captured in this snapshot.</div>;
  }

  return (
    <pre className="overflow-x-auto rounded-lg border border-border/70 bg-surface-2 p-3 text-[11px] leading-5 text-foreground">
      {JSON.stringify(props.value, null, 2)}
    </pre>
  );
};

const QueryCandidateList = (props: {
  label: string;
  candidates: Array<{
    searchTerm: string;
    sameText: boolean;
    clicks: number;
    orders: number;
    spend: number;
    sales: number;
  }>;
  emptyLabel: string;
}) => (
  <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3">
    <div className="text-xs uppercase tracking-wide text-muted">{props.label}</div>
    {props.candidates.length > 0 ? (
      <div className="mt-3 space-y-2">
        {props.candidates.map((candidate, index) => (
          <div
            key={`${props.label}:${candidate.searchTerm}:${index}`}
            className="rounded-lg border border-border bg-surface px-3 py-3"
          >
            <div className="font-semibold text-foreground">{candidate.searchTerm}</div>
            <div className="mt-1 text-xs text-muted">
              same_text={String(candidate.sameText)} · clicks {formatNumber(candidate.clicks)} ·
              orders {formatNumber(candidate.orders)} · spend {formatCurrency(candidate.spend)} ·
              sales {formatCurrency(candidate.sales)}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="mt-2 text-sm text-muted">{props.emptyLabel}</div>
    )}
  </div>
);

const getCoverageItems = (row: AdsOptimizerTargetReviewRow) => [
  { label: 'TOS', status: row.coverage.statuses.tosIs },
  { label: 'STIS', status: row.coverage.statuses.stis },
  { label: 'STIR', status: row.coverage.statuses.stir },
  { label: 'Place', status: row.coverage.statuses.placementContext },
  { label: 'Terms', status: row.coverage.statuses.searchTerms },
  { label: 'BE', status: row.coverage.statuses.breakEvenInputs },
] as const;

const getCoverageSummary = (row: AdsOptimizerTargetReviewRow) => {
  const counts = { ready: 0, partial: 0, missing: 0 };
  getCoverageItems(row).forEach((item) => {
    counts[item.status] += 1;
  });
  return counts;
};

const compareNullableNumber = (left: number | null, right: number | null) => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
};

const buildPriorityLabel = (priority: number | null, actionType: string | null) => {
  if (priority === null) return 'Monitor only';
  return `P${Math.max(1, Math.round(priority / 10))} · ${labelize(actionType)}`;
};

const getSeverityRank = (severity: 'high' | 'medium' | 'low') => {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
};

const isWorkspaceSupportedActionType = (
  value: string
): value is WorkspaceSupportedActionType =>
  value === 'update_target_bid' ||
  value === 'update_target_state' ||
  value === 'update_placement_modifier';

const getWorkspaceSupportedActions = (row: AdsOptimizerTargetReviewRow) =>
  (row.recommendation?.actions ?? []).filter((action) =>
    isWorkspaceSupportedActionType(action.actionType)
  );

const getUnsupportedReviewOnlyActions = (row: AdsOptimizerTargetReviewRow) =>
  (row.recommendation?.actions ?? []).filter(
    (action) => !isWorkspaceSupportedActionType(action.actionType)
  );

const buildWorkspaceTargetHref = (args: {
  asin: string;
  start: string;
  end: string;
  targetId: string;
}) => {
  const usp = new URLSearchParams({
    panel: 'workspace',
    channel: 'sp',
    level: 'targets',
    view: 'table',
    asin: args.asin,
    start: args.start,
    end: args.end,
    compose_level: 'targets',
    compose_row: args.targetId,
  });
  return `/ads/performance?${usp.toString()}`;
};

const buildTopList = (rows: AdsOptimizerTargetReviewRow[], kind: 'risk' | 'opportunity') =>
  [...rows]
    .filter((row) =>
      kind === 'risk'
        ? row.state.riskScore !== null && row.state.riskScore > 0
        : row.state.opportunityScore !== null && row.state.opportunityScore > 0
    )
    .sort((left, right) => {
      const leftScore = kind === 'risk' ? left.state.riskScore ?? -1 : left.state.opportunityScore ?? -1;
      const rightScore =
        kind === 'risk' ? right.state.riskScore ?? -1 : right.state.opportunityScore ?? -1;
      return (
        rightScore - leftScore ||
        compareNullableNumber(left.queue.priority, right.queue.priority) ||
        left.targetText.localeCompare(right.targetText)
      );
    })
    .slice(0, 3);

const coverageGapText = (row: AdsOptimizerTargetReviewRow) => {
  const notes = [...row.coverage.notes];
  if (!row.recommendation) {
    notes.unshift('Recommendation snapshot missing for this target in the selected run.');
  }
  return notes;
};

const filterRows = (
  rows: AdsOptimizerTargetReviewRow[],
  filters: {
    role: FilterValue;
    state: FilterValue;
    tier: FilterValue;
    confidence: FilterValue;
    sortBy: QueueSort;
  }
) =>
  [...rows]
    .filter((row) => (filters.role === 'all' ? true : row.role.currentRole.value === filters.role))
    .filter((row) => (filters.state === 'all' ? true : row.state.efficiency.value === filters.state))
    .filter((row) => (filters.tier === 'all' ? true : row.state.importance.value === filters.tier))
    .filter((row) =>
      filters.confidence === 'all' ? true : row.state.confidence.value === filters.confidence
    )
    .sort((left, right) => {
      if (filters.sortBy === 'risk') {
        return (
          (right.state.riskScore ?? -1) - (left.state.riskScore ?? -1) ||
          compareNullableNumber(left.queue.priority, right.queue.priority) ||
          left.targetText.localeCompare(right.targetText)
        );
      }
      if (filters.sortBy === 'opportunity') {
        return (
          (right.state.opportunityScore ?? -1) - (left.state.opportunityScore ?? -1) ||
          compareNullableNumber(left.queue.priority, right.queue.priority) ||
          left.targetText.localeCompare(right.targetText)
        );
      }
      if (filters.sortBy === 'target') {
        return left.targetText.localeCompare(right.targetText);
      }

      return (
        compareNullableNumber(left.queue.priority, right.queue.priority) ||
        (right.queue.recommendationCount ?? 0) - (left.queue.recommendationCount ?? 0) ||
        (right.state.riskScore ?? -1) - (left.state.riskScore ?? -1) ||
        (right.state.opportunityScore ?? -1) - (left.state.opportunityScore ?? -1) ||
        left.targetText.localeCompare(right.targetText)
      );
    });

export default function OptimizerTargetsPanel(props: OptimizerTargetsPanelProps) {
  const [selectedTargetSnapshotId, setSelectedTargetSnapshotId] = useState<string | null>(
    props.rows[0]?.targetSnapshotId ?? null
  );
  const [selectedForHandoff, setSelectedForHandoff] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<FilterValue>('all');
  const [stateFilter, setStateFilter] = useState<FilterValue>('all');
  const [tierFilter, setTierFilter] = useState<FilterValue>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<FilterValue>('all');
  const [sortBy, setSortBy] = useState<QueueSort>('priority');

  if (props.asin === 'all') {
    return (
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Targets scope</div>
        <div className="mt-2 text-lg font-semibold text-foreground">
          Select one ASIN to open the optimizer command center.
        </div>
        <div className="mt-2 max-w-3xl text-sm text-muted">
          Phase 12 review and handoff stays scoped to one selected ASIN and one exact date range.
          Pick an ASIN, then use History to capture a run that fills the command center, target
          queue, diagnostics, comparison layer, and rollback guidance from persisted optimizer
          snapshots before handing any supported actions into Ads Workspace.
        </div>
      </section>
    );
  }

  if (!props.run) {
    return (
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Targets run state</div>
        <div className="mt-2 text-lg font-semibold text-foreground">
          No persisted optimizer review run exists for this ASIN/date range yet.
        </div>
        <div className="mt-2 max-w-3xl text-sm text-muted">
          Phase 12 only hands off persisted snapshots from the exact ASIN and exact date window
          shown above. Create a manual run first so the target queue can load target profiles,
          states, roles, diagnostics, comparison cues, and recommendation snapshots before any
          supported actions are staged into Ads Workspace.
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

  const filteredRows = filterRows(props.rows, {
    role: roleFilter,
    state: stateFilter,
    tier: tierFilter,
    confidence: confidenceFilter,
    sortBy,
  });
  const activeTargetSnapshotId = filteredRows.some(
    (row) => row.targetSnapshotId === selectedTargetSnapshotId
  )
    ? selectedTargetSnapshotId
    : (filteredRows[0]?.targetSnapshotId ?? null);
  const activeRow =
    filteredRows.find((row) => row.targetSnapshotId === activeTargetSnapshotId) ?? null;
  const persistedRecommendationRows = props.rows.filter((row) => row.recommendation).length;
  const actionCount = props.rows.reduce(
    (sum, row) => sum + (row.recommendation?.actionCount ?? 0),
    0
  );
  const coverageWarnings = props.rows.reduce(
    (count, row) => count + coverageGapText(row).length,
    0
  );
  const topRiskRows = buildTopList(props.rows, 'risk');
  const topOpportunityRows = buildTopList(props.rows, 'opportunity');
  const stageableRows = props.rows.filter((row) => getWorkspaceSupportedActions(row).length > 0);
  const visibleStageableRows = filteredRows.filter(
    (row) => getWorkspaceSupportedActions(row).length > 0
  );
  const selectedVisibleStageableIds = visibleStageableRows
    .map((row) => row.targetSnapshotId)
    .filter((id) => selectedForHandoff.includes(id));
  const allVisibleStageableSelected =
    visibleStageableRows.length > 0 &&
    selectedVisibleStageableIds.length === visibleStageableRows.length;
  const selectedStageableRows = props.rows.filter((row) =>
    selectedForHandoff.includes(row.targetSnapshotId)
  );
  const selectedStageableActionCount = selectedStageableRows.reduce(
    (sum, row) => sum + getWorkspaceSupportedActions(row).length,
    0
  );
  const portfolioReference =
    props.rows.find((row) => row.recommendation?.portfolioControls)?.recommendation
      ?.portfolioControls ?? null;
  const budgetShareExceptions = props.rows.filter(
    (row) => row.recommendation?.portfolioControls?.budgetShareExceeded
  ).length;
  const exceptionEntries = filteredRows
    .flatMap((row) =>
      (row.recommendation?.exceptionSignals ?? []).map((signal, index) => ({
        key: `${row.targetSnapshotId}:${signal.type}:${index}`,
        row,
        signal,
      }))
    )
    .sort(
      (left, right) =>
        getSeverityRank(right.signal.severity) - getSeverityRank(left.signal.severity) ||
        compareNullableNumber(left.row.queue.priority, right.row.queue.priority) ||
        left.row.targetText.localeCompare(right.row.targetText)
    );
  const targetComparisonChanges = activeRow
    ? props.comparison?.materialChanges.filter((change) => change.targetId === activeRow.targetId) ?? []
    : [];
  const targetRollbackGuidance = activeRow
    ? props.comparison?.rollbackGuidance.filter((entry) => entry.targetId === activeRow.targetId) ?? []
    : [];

  const toggleSelectedRow = (targetSnapshotId: string, checked: boolean) => {
    setSelectedForHandoff((current) => {
      if (checked) {
        return current.includes(targetSnapshotId) ? current : [...current, targetSnapshotId];
      }
      return current.filter((value) => value !== targetSnapshotId);
    });
  };

  const toggleAllVisibleStageable = (checked: boolean) => {
    setSelectedForHandoff((current) => {
      const next = new Set(current);
      visibleStageableRows.forEach((row) => {
        if (checked) {
          next.add(row.targetSnapshotId);
        } else {
          next.delete(row.targetSnapshotId);
        }
      });
      return [...next];
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              Optimizer command center
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              Review persisted target outputs without leaving `/ads/optimizer`
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              This Phase 12 surface reads the exact run&apos;s persisted product state, target
              state, role, diagnostics, comparison cues, rollback guidance, and recommendation
              snapshots. The optimizer still proposes, while Ads Workspace remains the only place
              where staged and executable actions live.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ProductStateBadge state={props.productState} />
            <div className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
              SP only V1
            </div>
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
              Review + comparison + handoff
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-6">
        <SummaryCard
          label="Product objective"
          value={props.productState?.objective ?? 'Not captured'}
          detail={props.productState?.objectiveReason ?? 'This run did not persist a product objective.'}
        />
        <SummaryCard
          label="Product state"
          value={props.productState?.label ?? 'Not captured'}
          detail={props.productState?.reason ?? 'This run did not persist a product state.'}
        />
        <SummaryCard
          label="Run status"
          value={labelize(props.run.status)}
          detail={`Created ${formatDateTime(props.run.created_at)}`}
        />
        <SummaryCard
          label="Rule pack"
          value={props.run.rule_pack_version_label}
          detail="Active version recorded on the run snapshot."
        />
        <SummaryCard
          label="Persisted targets"
          value={formatNumber(props.rows.length)}
          detail={`Exact run window ${formatUiDateRange(props.run.date_start, props.run.date_end)}`}
        />
        <SummaryCard
          label="Persisted recommendations"
          value={formatNumber(persistedRecommendationRows)}
          detail={`${formatNumber(actionCount)} read-only actions across persisted rows.`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm xl:col-span-2">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Review boundary</div>
          <div className="mt-2 text-sm text-foreground">
            Handoff from this panel creates staged draft items inside Ads Workspace only. The
            optimizer still does not execute changes, write bulksheets directly, or bypass the
            existing Ads Workspace execution boundary.
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted">Execution boundary</div>
              <div className="mt-2 text-sm font-semibold text-foreground">
                read_only_recommendation_only
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">Workspace handoff</div>
               <div className="mt-2 text-sm font-semibold text-foreground">
                 staged only after operator handoff
               </div>
             </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted">Execution writes</div>
              <div className="mt-2 text-sm font-semibold text-foreground">false</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Coverage notes</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(coverageWarnings)}</div>
          <div className="mt-2 text-sm text-muted">
            Coverage gaps and null states are shown explicitly in the queue and target detail
            drawer instead of being hidden or guessed.
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DetailSection label="Portfolio controls">
          {portfolioReference ? (
            <div className="space-y-3">
              <DetailGrid
                items={[
                  {
                    label: 'Active Discover targets',
                    value: `${formatNumber(portfolioReference.activeDiscoverTargets)} / ${formatNumber(
                      portfolioReference.maxActiveDiscoverTargets
                    )}`,
                  },
                  {
                    label: 'Learning budget cap',
                    value: `${formatCurrency(portfolioReference.learningBudgetUsed)} / ${formatCurrency(
                      portfolioReference.learningBudgetCap
                    )}`,
                  },
                  {
                    label: 'Total stop-loss cap',
                    value: `${formatCurrency(portfolioReference.totalStopLossSpend)} / ${formatCurrency(
                      portfolioReference.totalStopLossCap
                    )}`,
                  },
                  {
                    label: 'Budget share breaches',
                    value: formatNumber(budgetShareExceptions),
                  },
                ]}
              />
              <div className="text-sm text-muted">
                These caps are computed at the ASIN run level and can push individual targets from
                increase to hold or reduce when the broader portfolio envelope is already full.
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted">
              Portfolio-control diagnostics were not captured for this run.
            </div>
          )}
        </DetailSection>

        <DetailSection label="Exception queue">
          {exceptionEntries.length > 0 ? (
            <div className="space-y-3">
              {exceptionEntries.slice(0, 10).map(({ key, row, signal }) => (
                <button
                  key={key}
                  type="button"
                  className="w-full rounded-lg border border-border/70 bg-surface-2 px-3 py-3 text-left transition hover:border-primary/40"
                  onClick={() => setSelectedTargetSnapshotId(row.targetSnapshotId)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">{signal.title}</div>
                      <div className="mt-1 text-xs text-muted">
                        {row.targetText} · {labelize(signal.type)} · {buildPriorityLabel(
                          row.queue.priority,
                          row.queue.primaryActionType
                        )}
                      </div>
                    </div>
                    <ExceptionSeverityBadge severity={signal.severity} />
                  </div>
                  <div className="mt-2 text-sm text-foreground">{signal.detail}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted">
              No exception signals were persisted for the current queue filters.
            </div>
          )}
        </DetailSection>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DetailSection label="Run comparison">
          {props.comparison ? (
            <div className="space-y-3">
              <DetailGrid
                items={[
                  {
                    label: 'Baseline run',
                    value:
                      props.comparison.baselineRun
                        ? `${formatDateTime(props.comparison.baselineRun.createdAt)} · ${props.comparison.baselineRun.rulePackVersionLabel}`
                        : 'No prior comparable run',
                  },
                  {
                    label: 'Version changed',
                    value: String(props.comparison.versionComparison.changed),
                  },
                  {
                    label: 'Current version',
                    value: props.comparison.versionComparison.currentVersionLabel,
                  },
                  {
                    label: 'Previous version',
                    value:
                      props.comparison.versionComparison.previousVersionLabel ?? 'Not captured',
                  },
                  {
                    label: 'State changes',
                    value: formatNumber(props.comparison.summary.stateChanges),
                  },
                  {
                    label: 'Role changes',
                    value: formatNumber(props.comparison.summary.roleChanges),
                  },
                  {
                    label: 'Recommendation changes',
                    value: formatNumber(props.comparison.summary.recommendationChanges),
                  },
                  {
                    label: 'Exception changes',
                    value: formatNumber(props.comparison.summary.exceptionChanges),
                  },
                  {
                    label: 'Portfolio control changes',
                    value: formatNumber(props.comparison.summary.portfolioControlChanges),
                  },
                ]}
              />
              <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3 text-sm text-foreground">
                <div className="font-semibold">Portfolio control changes vs prior comparable run</div>
                <div className="mt-2 text-muted">
                  {props.comparison.summary.portfolioControlChanges > 0
                    ? `${formatNumber(props.comparison.summary.portfolioControlChanges)} target-level portfolio cap change(s) were detected between the current run and the prior comparable run for this same ASIN/date scope.`
                    : 'No target-level portfolio cap changes were detected between the current run and the prior comparable run for this same ASIN/date scope.'}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3 text-sm text-foreground">
                <div className="font-semibold">What changed and why</div>
                <div className="mt-2 text-muted">
                  Current version: {props.comparison.versionComparison.currentChangeSummary ?? 'No version summary captured.'}
                </div>
                <div className="mt-1 text-muted">
                  Previous version: {props.comparison.versionComparison.previousChangeSummary ?? 'No prior version summary captured.'}
                </div>
              </div>
              <div className="text-sm text-muted">
                Handoff audit: current run {formatNumber(props.comparison.handoffAudit.currentRunChangeSetCount)} draft set(s) /
                {` ${formatNumber(props.comparison.handoffAudit.currentRunItemCount)} item(s)`}; prior comparable run{' '}
                {formatNumber(props.comparison.handoffAudit.previousRunChangeSetCount)} draft set(s) /
                {` ${formatNumber(props.comparison.handoffAudit.previousRunItemCount)} item(s)`}.
              </div>
              <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">Recent comparable runs</div>
                <div className="mt-2 space-y-2 text-sm text-foreground">
                  {props.comparison.recentComparableRuns.map((run) => (
                    <div key={run.runId}>
                      {formatDateTime(run.createdAt)} · {run.rulePackVersionLabel}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted">
              No prior completed run exists yet for this same ASIN and exact date window, so
              comparison cues are not available.
            </div>
          )}
        </DetailSection>

        <DetailSection label="Rollback / reversal guidance">
          {props.comparison && props.comparison.rollbackGuidance.length > 0 ? (
            <div className="space-y-3">
              {props.comparison.rollbackGuidance.slice(0, 8).map((entry, index) => (
                <button
                  key={`${entry.targetId}:${entry.title}:${index}`}
                  type="button"
                  className="w-full rounded-lg border border-border/70 bg-surface-2 px-3 py-3 text-left transition hover:border-primary/40"
                  onClick={() => {
                    const match = props.rows.find((row) => row.targetId === entry.targetId);
                    if (match) setSelectedTargetSnapshotId(match.targetSnapshotId);
                  }}
                >
                  <div className="font-semibold text-foreground">{entry.title}</div>
                  <div className="mt-1 text-xs text-muted">{entry.targetText}</div>
                  <div className="mt-2 text-sm text-foreground">{entry.detail}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {entry.cautionFlags.map((flag) => (
                      <ReasonCodeBadge key={`${entry.targetId}:${flag}`} code={flag} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted">
              No rollback or reversal cues were generated for the current comparable runs.
            </div>
          )}
        </DetailSection>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DetailSection label="Top risks">
          {topRiskRows.length === 0 ? (
            <div className="text-sm text-muted">No persisted risk scores were captured for this run.</div>
          ) : (
            <div className="space-y-3">
              {topRiskRows.map((row) => (
                <button
                  key={`risk-${row.targetSnapshotId}`}
                  type="button"
                  className="flex w-full items-start justify-between rounded-lg border border-border/70 bg-surface-2 px-3 py-3 text-left transition hover:border-primary/40"
                  onClick={() => setSelectedTargetSnapshotId(row.targetSnapshotId)}
                >
                  <div>
                    <div className="font-semibold text-foreground">{row.targetText}</div>
                    <div className="mt-1 text-xs text-muted">
                      {row.role.currentRole.label} · {row.state.efficiency.label}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">
                      Risk {formatNumber(row.state.riskScore)}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {buildPriorityLabel(row.queue.priority, row.queue.primaryActionType)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection label="Top opportunities">
          {topOpportunityRows.length === 0 ? (
            <div className="text-sm text-muted">
              No persisted opportunity scores were captured for this run.
            </div>
          ) : (
            <div className="space-y-3">
              {topOpportunityRows.map((row) => (
                <button
                  key={`opportunity-${row.targetSnapshotId}`}
                  type="button"
                  className="flex w-full items-start justify-between rounded-lg border border-border/70 bg-surface-2 px-3 py-3 text-left transition hover:border-primary/40"
                  onClick={() => setSelectedTargetSnapshotId(row.targetSnapshotId)}
                >
                  <div>
                    <div className="font-semibold text-foreground">{row.targetText}</div>
                    <div className="mt-1 text-xs text-muted">
                      {row.role.currentRole.label} · {row.state.importance.label}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">
                      Opportunity {formatNumber(row.state.opportunityScore)}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {buildPriorityLabel(row.queue.priority, row.queue.primaryActionType)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DetailSection>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted">Target queue</div>
                <div className="mt-2 text-sm text-muted">
                  Priority sorting uses the persisted recommendation action priority from the exact
                  run. Filters stay within the current ASIN and date window only, while exception
                  signals and contextual diagnostics remain visible without bypassing Ads Workspace.
                </div>
              </div>
              <Link href={props.historyHref} className="text-sm font-semibold text-primary">
                Go to History
              </Link>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Role
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All roles</option>
                  <option value="Discover">Discover</option>
                  <option value="Harvest">Harvest</option>
                  <option value="Scale">Scale</option>
                  <option value="Rank Push">Rank Push</option>
                  <option value="Rank Defend">Rank Defend</option>
                  <option value="Suppress">Suppress</option>
                </select>
              </label>

              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                State
                <select
                  value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value)}
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All states</option>
                  <option value="profitable">Profitable</option>
                  <option value="break_even">Break Even</option>
                  <option value="converting_but_loss_making">Loss Making</option>
                  <option value="learning_no_sale">Learning No Sale</option>
                  <option value="no_data">No Data</option>
                </select>
              </label>

              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Tier
                <select
                  value={tierFilter}
                  onChange={(event) => setTierFilter(event.target.value)}
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All tiers</option>
                  <option value="tier_1_dominant">Tier 1 dominant</option>
                  <option value="tier_2_core">Tier 2 core</option>
                  <option value="tier_3_test_long_tail">Tier 3 test / long-tail</option>
                </select>
              </label>

              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Confidence
                <select
                  value={confidenceFilter}
                  onChange={(event) => setConfidenceFilter(event.target.value)}
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All confidence</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="directional">Directional</option>
                  <option value="insufficient">Insufficient</option>
                </select>
              </label>

              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Queue order
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as QueueSort)}
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="priority">Priority</option>
                  <option value="risk">Risk</option>
                  <option value="opportunity">Opportunity</option>
                  <option value="target">Target</option>
                </select>
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
              Showing {formatNumber(filteredRows.length)} of {formatNumber(props.rows.length)} persisted
              target rows for {props.asin}. {formatNumber(persistedRecommendationRows)} recommendation
              snapshots were loaded from the exact run, and {formatNumber(stageableRows.length)} row(s)
              currently contain Ads Workspace-supported actions.
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-muted">
                Select one or more stageable rows, then hand off the supported actions into Ads
                Workspace. Unsupported recommendation types stay review-only in the optimizer.
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={visibleStageableRows.length === 0}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => toggleAllVisibleStageable(!allVisibleStageableSelected)}
                >
                  {allVisibleStageableSelected ? 'Clear visible selection' : 'Select visible stageable'}
                </button>
                <form action={props.handoffAction}>
                  <input type="hidden" name="return_to" value={props.returnTo} />
                  <input type="hidden" name="workspace_return_to" value={props.workspaceQueueHref} />
                  <input type="hidden" name="asin" value={props.asin} />
                  <input type="hidden" name="start" value={props.start} />
                  <input type="hidden" name="end" value={props.end} />
                  {selectedForHandoff.map((targetSnapshotId) => (
                    <input
                      key={`selected-${targetSnapshotId}`}
                      type="hidden"
                      name="target_snapshot_id"
                      value={targetSnapshotId}
                    />
                  ))}
                  <button
                    type="submit"
                    disabled={selectedForHandoff.length === 0}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Handoff selected to Ads Workspace
                  </button>
                </form>
                <Link href={props.workspaceQueueHref} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-foreground">
                  Open Queue Review
                </Link>
              </div>
            </div>

            <div className="mt-3 text-sm text-muted">
              {formatNumber(selectedForHandoff.length)} selected row(s) ·{' '}
              {formatNumber(selectedStageableActionCount)} supported staged action(s)
            </div>

            {filteredRows.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
                No target rows match the current optimizer queue filters.
              </div>
            ) : (
              <div className="mt-4 overflow-y-auto">
                <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
                  <table className="min-w-[1800px] table-auto border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                        <th className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label="Select all visible stageable optimizer rows"
                            checked={allVisibleStageableSelected}
                            disabled={visibleStageableRows.length === 0}
                            onChange={(event) => toggleAllVisibleStageable(event.target.checked)}
                          />
                        </th>
                        <th className="px-3 py-2">Target</th>
                        <th className="px-3 py-2">Priority</th>
                        <th className="px-3 py-2">Recommendations</th>
                        <th className="px-3 py-2">Workspace actions</th>
                        <th className="px-3 py-2">Current role</th>
                        <th className="px-3 py-2">Efficiency</th>
                        <th className="px-3 py-2">Confidence</th>
                        <th className="px-3 py-2">Tier</th>
                        <th className="px-3 py-2">Spend direction</th>
                        <th className="px-3 py-2">Exceptions</th>
                        <th className="px-3 py-2">Reason-code badges</th>
                        <th className="px-3 py-2">Coverage</th>
                        <th className="px-3 py-2">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => {
                        const coverageSummary = getCoverageSummary(row);
                        const coverageNotes = coverageGapText(row);
                        const isActive = row.targetSnapshotId === activeTargetSnapshotId;
                        const workspaceSupportedActions = getWorkspaceSupportedActions(row);
                        const unsupportedReviewOnlyActions = getUnsupportedReviewOnlyActions(row);
                        const isSelected = selectedForHandoff.includes(row.targetSnapshotId);
                        const isStageable = workspaceSupportedActions.length > 0;
                        const exceptionSignals = row.recommendation?.exceptionSignals ?? [];

                        return (
                          <tr
                            key={row.targetSnapshotId}
                            className={`border-b border-border/60 align-top ${
                              isActive ? 'bg-primary/5' : ''
                            }`}
                          >
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                aria-label={`Select ${row.targetText} for Ads Workspace handoff`}
                                checked={isSelected}
                                disabled={!isStageable}
                                onChange={(event) =>
                                  toggleSelectedRow(row.targetSnapshotId, event.target.checked)
                                }
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-semibold text-foreground">{row.targetText}</div>
                              <div className="mt-1 text-xs text-muted">
                                {row.typeLabel ?? 'Target'} · {row.matchType ?? '—'} · {row.targetId}
                              </div>
                              <div className="mt-1 text-xs text-muted">
                                {row.campaignName ?? row.campaignId} / {row.adGroupName ?? row.adGroupId}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-foreground">
                              {buildPriorityLabel(row.queue.priority, row.queue.primaryActionType)}
                            </td>
                            <td className="px-3 py-3 text-foreground">
                              <div>{formatNumber(row.queue.recommendationCount)}</div>
                              <div className="mt-1 text-xs text-muted">
                                {labelize(row.queue.primaryActionType)}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-foreground">
                                {formatNumber(workspaceSupportedActions.length)}
                              </div>
                              <div className="mt-1 text-xs text-muted">
                                {unsupportedReviewOnlyActions.length > 0
                                  ? `${formatNumber(unsupportedReviewOnlyActions.length)} review-only`
                                  : 'Ready for handoff'}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <RolePill
                                value={row.role.currentRole.value}
                                label={row.role.currentRole.label}
                              />
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
                            <td className="px-3 py-3 text-foreground">
                              {labelize(row.queue.spendDirection)}
                            </td>
                            <td className="px-3 py-3">
                              {exceptionSignals.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="text-foreground">
                                    {formatNumber(exceptionSignals.length)}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {exceptionSignals.slice(0, 2).map((signal, index) => (
                                      <ExceptionSeverityBadge
                                        key={`${row.targetSnapshotId}:exception:${signal.type}:${index}`}
                                        severity={signal.severity}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-muted">No exceptions</div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex max-w-[320px] flex-wrap gap-1.5">
                                {row.queue.reasonCodeBadges.length > 0 ? (
                                  row.queue.reasonCodeBadges.map((code) => (
                                    <ReasonCodeBadge key={`${row.targetSnapshotId}:${code}`} code={code} />
                                  ))
                                ) : (
                                  <span className="text-xs text-muted">No badges captured</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-xs text-muted">
                                Ready {coverageSummary.ready} · Partial {coverageSummary.partial} ·
                                Missing {coverageSummary.missing}
                              </div>
                              <div className="mt-2 flex max-w-[260px] flex-wrap gap-1.5">
                                {getCoverageItems(row).map((item) => (
                                  <CoverageBadge
                                    key={`${row.targetSnapshotId}:${item.label}`}
                                    label={item.label}
                                    status={item.status}
                                  />
                                ))}
                              </div>
                              {coverageNotes.length > 0 ? (
                                <div className="mt-2 text-xs text-amber-700">
                                  {coverageNotes.length} explicit coverage note(s)
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
                                aria-expanded={isActive}
                                aria-controls={
                                  activeRow ? `target-detail-drawer-${activeRow.targetSnapshotId}` : undefined
                                }
                                onClick={() => setSelectedTargetSnapshotId(row.targetSnapshotId)}
                              >
                                {isActive ? 'Viewing' : 'Open'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside
          id={activeRow ? `target-detail-drawer-${activeRow.targetSnapshotId}` : undefined}
          className="xl:sticky xl:top-4 xl:self-start"
        >
          <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              Target detail drawer
            </div>
            {activeRow ? (
              <div className="mt-3 space-y-4">
                <div className="border-b border-border pb-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-foreground">{activeRow.targetText}</div>
                      <div className="mt-1 text-sm text-muted">
                        {activeRow.typeLabel ?? 'Target'} · {activeRow.matchType ?? '—'} ·{' '}
                        {activeRow.targetId}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={buildWorkspaceTargetHref({
                          asin: props.asin,
                          start: props.start,
                          end: props.end,
                          targetId: activeRow.persistedTargetKey,
                        })}
                        className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-foreground"
                      >
                        Open in Ads Workspace
                      </Link>
                      <form action={props.handoffAction}>
                        <input type="hidden" name="return_to" value={props.returnTo} />
                        <input type="hidden" name="workspace_return_to" value={props.workspaceQueueHref} />
                        <input type="hidden" name="asin" value={props.asin} />
                        <input type="hidden" name="start" value={props.start} />
                        <input type="hidden" name="end" value={props.end} />
                        <input
                          type="hidden"
                          name="target_snapshot_id"
                          value={activeRow.targetSnapshotId}
                        />
                        <button
                          type="submit"
                          disabled={getWorkspaceSupportedActions(activeRow).length === 0}
                          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Handoff this target
                        </button>
                      </form>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <RolePill
                      value={activeRow.role.currentRole.value}
                      label={`Current ${activeRow.role.currentRole.label}`}
                    />
                    <RolePill
                      value={activeRow.role.desiredRole.value}
                      label={`Desired ${activeRow.role.desiredRole.label}`}
                    />
                    <StatePill
                      kind="efficiency"
                      value={activeRow.state.efficiency.value}
                      label={activeRow.state.efficiency.label}
                    />
                  </div>
                </div>

                {coverageGapText(activeRow).length > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <div className="font-semibold">Coverage notes and null states</div>
                    <ul className="mt-2 space-y-1">
                      {coverageGapText(activeRow).map((note) => (
                        <li key={`${activeRow.targetSnapshotId}:${note}`}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <DetailSection label="Recommendation details">
                  {activeRow.recommendation ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3">
                        <div className="text-xs uppercase tracking-wide text-muted">
                          Workspace handoff status
                        </div>
                        <div className="mt-2 text-sm text-foreground">
                          {formatNumber(getWorkspaceSupportedActions(activeRow).length)} supported
                          workspace action(s) can be staged from this target.{' '}
                          {formatNumber(getUnsupportedReviewOnlyActions(activeRow).length)} action(s)
                          remain review-only inside the optimizer.
                        </div>
                      </div>

                      <DetailGrid
                        items={[
                          {
                            label: 'Status',
                            value: labelize(activeRow.recommendation.status),
                          },
                          {
                            label: 'Spend direction',
                            value: labelize(activeRow.recommendation.spendDirection),
                          },
                          {
                            label: 'Primary action',
                            value: labelize(activeRow.recommendation.primaryActionType),
                          },
                          {
                            label: 'Action count',
                            value: formatNumber(activeRow.recommendation.actionCount),
                          },
                          {
                            label: 'Execution boundary',
                            value: activeRow.recommendation.executionBoundary ?? 'Not captured',
                          },
                          {
                            label: 'Workspace handoff',
                            value: activeRow.recommendation.workspaceHandoff ?? 'Not captured',
                          },
                          {
                            label: 'Writes execution tables',
                            value:
                              activeRow.recommendation.writesExecutionTables === null
                                ? 'Not captured'
                                : String(activeRow.recommendation.writesExecutionTables),
                          },
                          {
                            label: 'Manual review required',
                            value:
                              activeRow.recommendation.manualReviewRequired === null
                                ? 'Not captured'
                                : String(activeRow.recommendation.manualReviewRequired),
                          },
                        ]}
                      />

                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-muted">
                          Coverage flags
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {activeRow.recommendation.coverageFlags.length > 0 ? (
                            activeRow.recommendation.coverageFlags.map((flag) => (
                              <ReasonCodeBadge key={`${activeRow.targetSnapshotId}:${flag}`} code={flag} />
                            ))
                          ) : (
                            <div className="text-sm text-muted">No coverage flags were persisted.</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-muted">
                          Confidence notes
                        </div>
                        {activeRow.recommendation.confidenceNotes.length > 0 ? (
                          <ul className="space-y-1 text-sm text-foreground">
                            {activeRow.recommendation.confidenceNotes.map((note) => (
                              <li key={`${activeRow.targetSnapshotId}:${note}`}>{note}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-muted">No confidence notes were persisted.</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-muted">
                          Exception signals
                        </div>
                        {activeRow.recommendation.exceptionSignals.length > 0 ? (
                          <div className="space-y-2">
                            {activeRow.recommendation.exceptionSignals.map((signal, index) => (
                              <div
                                key={`${activeRow.targetSnapshotId}:exception-detail:${signal.type}:${index}`}
                                className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="font-semibold text-foreground">{signal.title}</div>
                                  <ExceptionSeverityBadge severity={signal.severity} />
                                </div>
                                <div className="mt-2 text-sm text-foreground">{signal.detail}</div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {signal.reasonCodes.map((code) => (
                                    <ReasonCodeBadge
                                      key={`${activeRow.targetSnapshotId}:exception-reason:${signal.type}:${code}`}
                                      code={code}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted">
                            No exception signals were persisted for this target.
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-muted">
                          Unsupported action blocks
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {activeRow.recommendation.unsupportedActionBlocks.length > 0 ? (
                            activeRow.recommendation.unsupportedActionBlocks.map((code) => (
                              <ReasonCodeBadge key={`${activeRow.targetSnapshotId}:${code}`} code={code} />
                            ))
                          ) : (
                            <div className="text-sm text-muted">
                              No unsupported action blocks were persisted for this target.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="text-xs uppercase tracking-wide text-muted">
                          Recommended read-only actions
                        </div>
                        {activeRow.recommendation.actions.length > 0 ? (
                          activeRow.recommendation.actions.map((action, index) => (
                            <div
                              key={`${activeRow.targetSnapshotId}:${action.actionType}:${index}`}
                              className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="font-semibold text-foreground">
                                  {labelize(action.actionType)}
                                </div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                                  Priority {action.priority ?? '—'}
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {action.reasonCodes.map((code) => (
                                  <ReasonCodeBadge
                                    key={`${activeRow.targetSnapshotId}:${action.actionType}:${code}`}
                                    code={code}
                                  />
                                ))}
                              </div>
                              <div className="mt-3 grid gap-3">
                                <div>
                                  <div className="mb-1 text-xs uppercase tracking-wide text-muted">
                                    Proposed change
                                  </div>
                                  <JsonBlock value={action.proposedChange} />
                                </div>
                                <div>
                                  <div className="mb-1 text-xs uppercase tracking-wide text-muted">
                                    Entity context
                                  </div>
                                  <JsonBlock value={action.entityContext} />
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-muted">
                            No concrete actions were persisted for this target. The review cadence
                            or coverage notes may still explain the monitor posture.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted">
                      No recommendation snapshot was found for this target in the selected run.
                    </div>
                  )}
                </DetailSection>

                <DetailSection label="Portfolio controls">
                  {activeRow.recommendation?.portfolioControls ? (
                    <div className="space-y-3">
                      <DetailGrid
                        items={[
                          {
                            label: 'Discover rank',
                            value:
                              activeRow.recommendation.portfolioControls.discoverRank === null
                                ? 'Not a Discover target'
                                : `${formatNumber(activeRow.recommendation.portfolioControls.discoverRank)} of ${formatNumber(
                                    activeRow.recommendation.portfolioControls.activeDiscoverTargets
                                  )}`,
                          },
                          {
                            label: 'Discover cap blocked',
                            value: String(
                              activeRow.recommendation.portfolioControls.discoverCapBlocked
                            ),
                          },
                          {
                            label: 'Learning budget',
                            value: `${formatCurrency(activeRow.recommendation.portfolioControls.learningBudgetUsed)} / ${formatCurrency(
                              activeRow.recommendation.portfolioControls.learningBudgetCap
                            )}`,
                          },
                          {
                            label: 'Learning budget exceeded',
                            value: String(
                              activeRow.recommendation.portfolioControls.learningBudgetExceeded
                            ),
                          },
                          {
                            label: 'Stop-loss spend',
                            value: `${formatCurrency(activeRow.recommendation.portfolioControls.totalStopLossSpend)} / ${formatCurrency(
                              activeRow.recommendation.portfolioControls.totalStopLossCap
                            )}`,
                          },
                          {
                            label: 'Stop-loss cap exceeded',
                            value: String(
                              activeRow.recommendation.portfolioControls.stopLossCapExceeded
                            ),
                          },
                          {
                            label: 'Target spend share',
                            value: formatPercent(
                              activeRow.recommendation.portfolioControls.targetSpendShare
                            ),
                          },
                          {
                            label: 'Budget share ceiling',
                            value: formatPercent(
                              activeRow.recommendation.portfolioControls.maxBudgetSharePerTarget
                            ),
                          },
                        ]}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {activeRow.recommendation.portfolioControls.reasonCodes.length > 0 ? (
                          activeRow.recommendation.portfolioControls.reasonCodes.map((code) => (
                            <ReasonCodeBadge
                              key={`${activeRow.targetSnapshotId}:portfolio:${code}`}
                              code={code}
                            />
                          ))
                        ) : (
                          <div className="text-sm text-muted">
                            No ASIN-level portfolio caps were breached for this target.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted">
                      Portfolio controls were not captured for this target in the selected run.
                    </div>
                  )}
                </DetailSection>

                <DetailSection label="Run comparison cues">
                  {props.comparison ? (
                    targetComparisonChanges.length > 0 ? (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3 text-sm text-muted">
                          These target cues include state, role, recommendation, exception, and
                          portfolio-control changes versus the prior comparable run for this exact
                          ASIN/date scope.
                        </div>
                        {targetComparisonChanges.map((change, index) => (
                          <div
                            key={`${activeRow.targetSnapshotId}:comparison:${change.kind}:${index}`}
                            className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="font-semibold text-foreground">{change.summary}</div>
                              <ExceptionSeverityBadge severity={change.severity} />
                            </div>
                            <div className="mt-2 text-sm text-foreground">{change.why}</div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-lg border border-border bg-surface px-3 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                                  Previous
                                </div>
                                <div className="mt-1 text-sm text-foreground">
                                  {change.previousValue ?? '—'}
                                </div>
                              </div>
                              <div className="rounded-lg border border-border bg-surface px-3 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                                  Current
                                </div>
                                <div className="mt-1 text-sm text-foreground">
                                  {change.currentValue ?? '—'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted">
                        This target did not have any material comparison changes versus the prior
                        comparable run.
                      </div>
                    )
                  ) : (
                    <div className="text-sm text-muted">
                      No prior comparable run exists for this exact ASIN/date scope.
                    </div>
                  )}
                </DetailSection>

                <DetailSection label="Rollback guidance">
                  {targetRollbackGuidance.length > 0 ? (
                    <div className="space-y-3">
                      {targetRollbackGuidance.map((entry, index) => (
                        <div
                          key={`${activeRow.targetSnapshotId}:rollback:${entry.title}:${index}`}
                          className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3"
                        >
                          <div className="font-semibold text-foreground">{entry.title}</div>
                          <div className="mt-2 text-sm text-foreground">{entry.detail}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {entry.cautionFlags.map((flag) => (
                              <ReasonCodeBadge
                                key={`${activeRow.targetSnapshotId}:rollback-flag:${flag}`}
                                code={flag}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted">
                      No target-specific rollback guidance was generated for this row.
                    </div>
                  )}
                </DetailSection>

                <DetailSection label="Raw metrics">
                  <DetailGrid
                    items={[
                      { label: 'Impressions', value: formatNumber(activeRow.raw.impressions) },
                      { label: 'Clicks', value: formatNumber(activeRow.raw.clicks) },
                      { label: 'Spend', value: formatCurrency(activeRow.raw.spend) },
                      { label: 'Orders', value: formatNumber(activeRow.raw.orders) },
                      { label: 'Sales', value: formatCurrency(activeRow.raw.sales) },
                      { label: 'CPC', value: formatCurrency(activeRow.raw.cpc) },
                      { label: 'CTR', value: formatPercent(activeRow.raw.ctr) },
                      { label: 'CVR', value: formatPercent(activeRow.raw.cvr) },
                      { label: 'ACoS', value: formatPercent(activeRow.raw.acos) },
                      {
                        label: 'ROAS',
                        value: activeRow.raw.roas === null ? '—' : activeRow.raw.roas.toFixed(2),
                      },
                      { label: 'TOS IS', value: formatPercent(activeRow.raw.tosIs) },
                      { label: 'STIS', value: formatPercent(activeRow.raw.stis) },
                      { label: 'STIR', value: formatNumber(activeRow.raw.stir) },
                    ]}
                  />
                </DetailSection>

                <DetailSection label="Derived metrics">
                  <DetailGrid
                    items={[
                      {
                        label: 'Contribution after ads',
                        value: formatCurrency(activeRow.derived.contributionAfterAds),
                      },
                      {
                        label: 'Break-even gap',
                        value: formatPercent(activeRow.derived.breakEvenGap),
                      },
                      {
                        label: 'Max CPC support gap',
                        value: formatCurrency(activeRow.derived.maxCpcSupportGap),
                      },
                      { label: 'Loss dollars', value: formatCurrency(activeRow.derived.lossDollars) },
                      {
                        label: 'Profit dollars',
                        value: formatCurrency(activeRow.derived.profitDollars),
                      },
                      {
                        label: 'Click velocity',
                        value:
                          activeRow.derived.clickVelocity === null
                            ? '—'
                            : activeRow.derived.clickVelocity.toFixed(1),
                      },
                      {
                        label: 'Impression velocity',
                        value:
                          activeRow.derived.impressionVelocity === null
                            ? '—'
                            : activeRow.derived.impressionVelocity.toFixed(1),
                      },
                      {
                        label: 'Organic leverage',
                        value:
                          activeRow.derived.organicLeverageProxy === null
                            ? '—'
                            : activeRow.derived.organicLeverageProxy.toFixed(3),
                      },
                    ]}
                  />
                </DetailSection>

                <DetailSection label="Target state">
                  <div className="space-y-3">
                    <DetailGrid
                      items={[
                        { label: 'Efficiency', value: activeRow.state.efficiency.label },
                        { label: 'Confidence', value: activeRow.state.confidence.label },
                        { label: 'Importance', value: activeRow.state.importance.label },
                        {
                          label: 'Opportunity score',
                          value: formatNumber(activeRow.state.opportunityScore),
                        },
                        { label: 'Risk score', value: formatNumber(activeRow.state.riskScore) },
                      ]}
                    />
                    <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3">
                      <div className="text-xs uppercase tracking-wide text-muted">State breakdown</div>
                      <div className="mt-2 space-y-2 text-sm text-foreground">
                        <div>
                          <span className="font-semibold">Efficiency:</span>{' '}
                          {activeRow.state.efficiency.detail}
                        </div>
                        <div>
                          <span className="font-semibold">Confidence:</span>{' '}
                          {activeRow.state.confidence.detail}
                        </div>
                        <div>
                          <span className="font-semibold">Tier:</span>{' '}
                          {activeRow.state.importance.detail}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        ...activeRow.state.summaryReasonCodes,
                        ...activeRow.state.opportunityReasonCodes,
                        ...activeRow.state.riskReasonCodes,
                      ].length > 0 ? (
                        [
                          ...activeRow.state.summaryReasonCodes,
                          ...activeRow.state.opportunityReasonCodes,
                          ...activeRow.state.riskReasonCodes,
                        ].map((code, index) => (
                          <ReasonCodeBadge
                            key={`${activeRow.targetSnapshotId}:state:${code}:${index}`}
                            code={code}
                          />
                        ))
                      ) : (
                        <div className="text-sm text-muted">No state reason codes were captured.</div>
                      )}
                    </div>
                  </div>
                </DetailSection>

                <DetailSection label="Role history">
                  <div className="space-y-3">
                    <DetailGrid
                      items={[
                        { label: 'Desired role', value: activeRow.role.desiredRole.label },
                        { label: 'Current role', value: activeRow.role.currentRole.label },
                        {
                          label: 'Previous role',
                          value: activeRow.role.previousRole ?? 'Not captured',
                        },
                        { label: 'Transition rule', value: activeRow.role.transitionRule },
                      ]}
                    />
                    <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3">
                      <div className="text-xs uppercase tracking-wide text-muted">
                        Recent role transitions
                      </div>
                      {activeRow.roleHistory.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {activeRow.roleHistory.slice(0, 6).map((entry) => (
                            <div
                              key={entry.roleTransitionLogId}
                              className="rounded-lg border border-border bg-surface px-3 py-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="font-semibold text-foreground">
                                  {entry.fromRole ?? 'None'} → {entry.toRole ?? 'None'}
                                </div>
                                <div className="text-xs text-muted">
                                  {formatDateTime(entry.createdAt)}
                                </div>
                              </div>
                              <div className="mt-1 text-xs text-muted">
                                Run {entry.runId} · rule {entry.transitionRule ?? 'Not captured'} ·
                                desired {entry.desiredRole ?? 'Not captured'}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {[
                                  ...entry.transitionReasonCodes,
                                  ...entry.roleReasonCodes,
                                  ...entry.guardrailReasonCodes,
                                ].map((code, index) => (
                                  <ReasonCodeBadge
                                    key={`${entry.roleTransitionLogId}:${code}:${index}`}
                                    code={code}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-muted">
                          No role transition log rows were recorded yet for this target.
                        </div>
                      )}
                    </div>
                  </div>
                </DetailSection>

                <DetailSection label="Guardrails">
                  <div className="space-y-3">
                    <DetailGrid
                      items={[
                        {
                          label: 'No-sale spend cap',
                          value: formatCurrency(activeRow.role.guardrails.categories.noSaleSpendCap),
                        },
                        {
                          label: 'No-sale click cap',
                          value: formatNumber(activeRow.role.guardrails.categories.noSaleClickCap),
                        },
                        {
                          label: 'Max loss per cycle',
                          value: formatCurrency(activeRow.role.guardrails.categories.maxLossPerCycle),
                        },
                        {
                          label: 'Max bid increase %',
                          value: activeRow.role.guardrails.categories.maxBidIncreasePerCyclePct === null
                            ? '—'
                            : `${activeRow.role.guardrails.categories.maxBidIncreasePerCyclePct}%`,
                        },
                        {
                          label: 'Max bid decrease %',
                          value: activeRow.role.guardrails.categories.maxBidDecreasePerCyclePct === null
                            ? '—'
                            : `${activeRow.role.guardrails.categories.maxBidDecreasePerCyclePct}%`,
                        },
                        {
                          label: 'Placement bias increase %',
                          value:
                            activeRow.role.guardrails.categories.maxPlacementBiasIncreasePerCyclePct === null
                              ? '—'
                              : `${activeRow.role.guardrails.categories.maxPlacementBiasIncreasePerCyclePct}%`,
                        },
                        {
                          label: 'Rank push time limit',
                          value: activeRow.role.guardrails.categories.rankPushTimeLimitDays === null
                            ? '—'
                            : `${activeRow.role.guardrails.categories.rankPushTimeLimitDays} days`,
                        },
                        {
                          label: 'Manual approval threshold',
                          value: labelize(activeRow.role.guardrails.categories.manualApprovalThreshold),
                        },
                        {
                          label: 'Auto-pause threshold',
                          value: formatCurrency(activeRow.role.guardrails.categories.autoPauseThreshold),
                        },
                        {
                          label: 'Min bid floor',
                          value: formatCurrency(activeRow.role.guardrails.categories.minBidFloor),
                        },
                        {
                          label: 'Max bid ceiling',
                          value: formatCurrency(activeRow.role.guardrails.categories.maxBidCeiling),
                        },
                      ]}
                    />
                    <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3">
                      <div className="text-xs uppercase tracking-wide text-muted">Guardrail flags</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <ReasonCodeBadge
                          code={`requires_manual_approval=${String(activeRow.role.guardrails.flags.requiresManualApproval)}`}
                        />
                        <ReasonCodeBadge
                          code={`auto_pause_eligible=${String(activeRow.role.guardrails.flags.autoPauseEligible)}`}
                        />
                        <ReasonCodeBadge
                          code={`bid_changes_allowed=${String(activeRow.role.guardrails.flags.bidChangesAllowed)}`}
                        />
                        <ReasonCodeBadge
                          code={`placement_changes_allowed=${String(activeRow.role.guardrails.flags.placementChangesAllowed)}`}
                        />
                        <ReasonCodeBadge
                          code={`transition_locked=${String(activeRow.role.guardrails.flags.transitionLocked)}`}
                        />
                      </div>
                      {activeRow.role.guardrails.notes.length > 0 ? (
                        <ul className="mt-3 space-y-1 text-sm text-foreground">
                          {activeRow.role.guardrails.notes.map((note) => (
                            <li key={`${activeRow.targetSnapshotId}:guardrail-note:${note}`}>{note}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-3 text-sm text-muted">
                          No additional guardrail notes were persisted.
                        </div>
                      )}
                    </div>
                  </div>
                </DetailSection>

                <DetailSection label="Query diagnostics">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3">
                      <div className="text-xs uppercase tracking-wide text-muted">
                        Same-text query pinning
                      </div>
                      {activeRow.recommendation?.queryDiagnostics ? (
                        <div className="mt-3 space-y-3">
                          <DetailGrid
                            items={[
                              {
                                label: 'Pinning status',
                                value: labelize(
                                  activeRow.recommendation.queryDiagnostics.sameTextQueryPinning
                                    .status
                                ),
                              },
                              {
                                label: 'Pinned query',
                                value:
                                  activeRow.recommendation.queryDiagnostics.sameTextQueryPinning
                                    .searchTerm ?? 'Not observed',
                              },
                              {
                                label: 'Click share',
                                value: formatPercent(
                                  activeRow.recommendation.queryDiagnostics.sameTextQueryPinning
                                    .clickShare
                                ),
                              },
                              {
                                label: 'Order share proxy',
                                value: formatPercent(
                                  activeRow.recommendation.queryDiagnostics.sameTextQueryPinning
                                    .orderShareProxy
                                ),
                              },
                            ]}
                          />
                          <div className="text-sm text-muted">
                            {activeRow.recommendation.queryDiagnostics.note}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {activeRow.recommendation.queryDiagnostics.sameTextQueryPinning.reasonCodes.map(
                              (code) => (
                                <ReasonCodeBadge
                                  key={`${activeRow.targetSnapshotId}:pinning:${code}`}
                                  code={code}
                                />
                              )
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-muted">
                          Same-text query diagnostics were not captured for this target.
                        </div>
                      )}
                    </div>

                    <DetailGrid
                      items={[
                        {
                          label: 'Representative query',
                          value:
                            activeRow.searchTermDiagnostics.representativeSearchTerm ?? 'Not captured',
                        },
                        {
                          label: 'Representative same-text',
                          value:
                            activeRow.searchTermDiagnostics.representativeSameText === null
                              ? 'Not captured'
                              : String(activeRow.searchTermDiagnostics.representativeSameText),
                        },
                        {
                          label: 'Search term count',
                          value: formatNumber(activeRow.demandProxies.searchTermCount),
                        },
                        {
                          label: 'Same-text query count',
                          value: formatNumber(activeRow.demandProxies.sameTextSearchTermCount),
                        },
                        {
                          label: 'Search term impressions',
                          value: formatNumber(activeRow.demandProxies.totalSearchTermImpressions),
                        },
                        {
                          label: 'Search term clicks',
                          value: formatNumber(activeRow.demandProxies.totalSearchTermClicks),
                        },
                      ]}
                    />
                    <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3">
                      <div className="text-xs uppercase tracking-wide text-muted">Top query rows</div>
                      {activeRow.searchTermDiagnostics.note ? (
                        <div className="mt-2 text-sm text-muted">
                          {activeRow.searchTermDiagnostics.note}
                        </div>
                      ) : null}
                      {activeRow.searchTermDiagnostics.topTerms.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {activeRow.searchTermDiagnostics.topTerms.map((term, index) => (
                            <div
                              key={`${activeRow.targetSnapshotId}:term:${term.searchTerm}:${index}`}
                              className="rounded-lg border border-border bg-surface px-3 py-3"
                            >
                              <div className="font-semibold text-foreground">{term.searchTerm}</div>
                              <div className="mt-1 text-xs text-muted">
                                same_text={String(term.sameText)} · clicks {formatNumber(term.clicks)} ·
                                orders {formatNumber(term.orders)} · spend {formatCurrency(term.spend)} ·
                                sales {formatCurrency(term.sales)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-muted">
                          No search-term diagnostics were captured for this target in the selected run.
                        </div>
                      )}
                    </div>

                    {activeRow.recommendation?.queryDiagnostics ? (
                      <div className="grid gap-3">
                        <QueryCandidateList
                          label="Promote-to-exact candidates"
                          candidates={activeRow.recommendation.queryDiagnostics.promoteToExactCandidates}
                          emptyLabel="No promote-to-exact candidates were persisted."
                        />
                        <QueryCandidateList
                          label="Isolate candidates"
                          candidates={activeRow.recommendation.queryDiagnostics.isolateCandidates}
                          emptyLabel="No isolate candidates were persisted."
                        />
                        <QueryCandidateList
                          label="Negative candidates"
                          candidates={activeRow.recommendation.queryDiagnostics.negativeCandidates}
                          emptyLabel="No negative candidates were persisted."
                        />
                      </div>
                    ) : null}
                  </div>
                </DetailSection>

                <DetailSection label="Placement diagnostics">
                  <div className="space-y-3">
                    <DetailGrid
                      items={[
                        {
                          label: 'Top of search modifier',
                          value:
                            activeRow.placementContext.topOfSearchModifierPct === null
                              ? '—'
                              : `${activeRow.placementContext.topOfSearchModifierPct}%`,
                        },
                        {
                          label: 'Placement impressions',
                          value: formatNumber(activeRow.placementContext.impressions),
                        },
                        {
                          label: 'Placement clicks',
                          value: formatNumber(activeRow.placementContext.clicks),
                        },
                        {
                          label: 'Placement orders',
                          value: formatNumber(activeRow.placementContext.orders),
                        },
                        {
                          label: 'Placement spend',
                          value: formatCurrency(activeRow.placementContext.spend),
                        },
                        {
                          label: 'Placement sales',
                          value: formatCurrency(activeRow.placementContext.sales),
                        },
                        {
                          label: 'Bias recommendation',
                          value: labelize(
                            activeRow.recommendation?.placementDiagnostics?.biasRecommendation ??
                              null
                          ),
                        },
                        {
                          label: 'Context scope',
                          value:
                            activeRow.recommendation?.placementDiagnostics?.contextScope ??
                            'Not captured',
                        },
                      ]}
                    />
                    <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3 text-sm text-foreground">
                      {activeRow.recommendation?.placementDiagnostics?.note ??
                        activeRow.placementContext.note ??
                        'Placement diagnostics were not captured for this target in the selected run.'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeRow.recommendation?.placementDiagnostics?.reasonCodes.length ? (
                        activeRow.recommendation.placementDiagnostics.reasonCodes.map((code) => (
                          <ReasonCodeBadge
                            key={`${activeRow.targetSnapshotId}:placement:${code}`}
                            code={code}
                          />
                        ))
                      ) : (
                        <div className="text-sm text-muted">
                          No placement-diagnostic reason codes were persisted.
                        </div>
                      )}
                    </div>
                  </div>
                </DetailSection>
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted">
                Select one queue row to open the target detail drawer.
              </div>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}
