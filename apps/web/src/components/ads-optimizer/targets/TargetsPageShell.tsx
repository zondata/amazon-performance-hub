'use client';

import { Fragment, type ReactNode, useMemo, useState } from 'react';
import Link from 'next/link';

import { readAdsOptimizerRunEffectiveVersionContext } from '@/lib/ads-optimizer/effectiveVersion';
import type { AdsOptimizerRunComparisonView } from '@/lib/ads-optimizer/comparison';
import type { AdsOptimizerTargetRole } from '@/lib/ads-optimizer/role';
import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';
import type { AdsOptimizerRun } from '@/lib/ads-optimizer/runtimeTypes';
import type { AdsOptimizerProductRunState } from '@/lib/ads-optimizer/state';
import {
  buildAdsOptimizerTargetRowSummaries,
  filterAdsOptimizerTargetRowSummaries,
  getDefaultAdsOptimizerTargetQueueSortDirection,
  type AdsOptimizerTargetExceptionFilterValue,
  type AdsOptimizerTargetFilterValue,
  type AdsOptimizerTargetQueueSort,
  type AdsOptimizerTargetQueueSortDirection,
} from '@/lib/ads-optimizer/targetRowSummary';
import type { AdsOptimizerRecommendationOverride } from '@/lib/ads-optimizer/types';
import {
  formatUiDateRange,
  formatUiDateTime as formatDateTime,
} from '@/lib/time/formatUiDate';
import TargetAdvancedSection from './TargetAdvancedSection';
import TargetExpandedPanel from './TargetExpandedPanel';
import TargetOverrideForm from './TargetOverrideForm';
import TargetSummaryRow from './TargetSummaryRow';
import TargetsToolbar from './TargetsToolbar';

export type OptimizerTargetsPanelProps = {
  asin: string;
  start: string;
  end: string;
  historyHref: string;
  returnTo: string;
  workspaceQueueHref: string;
  run: AdsOptimizerRun | null;
  latestCompletedRun: AdsOptimizerRun | null;
  productId: string | null;
  productState: AdsOptimizerProductRunState | null;
  comparison: AdsOptimizerRunComparisonView | null;
  rows: AdsOptimizerTargetReviewRow[];
  requestedRunId: string | null;
  resolvedContextSource: 'run_id' | 'window' | null;
  runLookupError: string | null;
  notice: string | null;
  error: string | null;
  overrideError: boolean;
  handoffAction: (formData: FormData) => Promise<void>;
  saveRecommendationOverrideAction: (formData: FormData) => Promise<void>;
};

type WorkspaceSupportedActionType =
  | 'update_target_bid'
  | 'update_target_state'
  | 'update_placement_modifier';
type DrawerInspectionEngineId =
  | 'action-plan'
  | 'guardrails'
  | 'portfolio-caps'
  | 'target-state'
  | 'role-history'
  | 'query-diagnostics'
  | 'placement-diagnostics'
  | 'run-comparison'
  | 'rollback-guidance'
  | 'raw-metrics'
  | 'derived-metrics';
type DrawerInspectionSelection = DrawerInspectionEngineId | 'all' | null;
type ProposedChangeCard =
  | {
      key: string;
      title: string;
      category: 'execution' | 'cadence';
      reviewOnly: false;
      currentValue: string;
      proposedValue: string;
      detail?: string;
    }
  | {
      key: string;
      title: string;
      category: 'review';
      reviewOnly: true;
      detail: string;
    };
type DrawerInspectionSection = {
  id: DrawerInspectionEngineId;
  label: string;
  render: () => ReactNode;
};

const GLOBAL_METHODOLOGY_NOTES = [
  'STIS, STIR, and TOS IS are non-additive diagnostics. The Targets page only shows latest observed values or explicit trend metadata, never a synthetic window average.',
  'Ranking follows the same rule. If rank context is shown, treat it as latest observed value plus direction or delta, not an averaged raw rank.',
  'Zero-click targets can legitimately show expected-unavailable search-term diagnostics. That is normal availability behavior unless other inputs also look incomplete.',
  'Ads Optimizer remains recommendation-first. Ads Workspace is still the only staging and execution boundary.',
];
const NOT_CAPTURED = 'Not captured';

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

const formatVersionResolutionSource = (value: 'product_assignment' | 'account_active_fallback') =>
  value === 'product_assignment' ? 'Product assignment' : 'Account fallback';

const formatVersionFallbackReason = (value: string | null) => {
  if (value === 'optimizer_disabled') return 'Product policy disabled';
  if (value === 'no_product_settings') return 'No product settings';
  if (value === 'assigned_version_missing') return 'Assigned version missing';
  if (value === 'no_product_row') return 'No product row';
  return 'Assignment active';
};

const formatStrategyProfile = (value: string | null | undefined) =>
  value ? value.replace(/_/g, ' ') : 'hybrid';

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatWholePercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return NOT_CAPTURED;
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)}%`;
};

const formatSignedPercentChange = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return null;
  const digits = Math.abs(value) >= 10 || Number.isInteger(value) ? 0 : 1;
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
};

const labelize = (value: string | null) =>
  value
    ? value
        .split(/[_\s]+/)
        .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
        .join(' ')
    : 'Not captured';

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

const ProposedChangeSummaryCard = (props: { card: ProposedChangeCard }) => (
  <div className="rounded-xl border border-border bg-surface px-4 py-4">
    <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
      {props.card.reviewOnly
        ? 'Review-only proposed action'
        : props.card.category === 'cadence'
          ? 'Cadence recommendation'
          : 'Execution-changing action'}
    </div>
    <div className="mt-2 text-sm font-semibold text-foreground">{props.card.title}</div>
    {props.card.reviewOnly ? (
      <div className="mt-3 text-sm text-muted">{props.card.detail}</div>
    ) : (
      <>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Current
            </div>
            <div className="mt-1 text-sm text-foreground">{props.card.currentValue}</div>
          </div>
          <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Proposed
            </div>
            <div className="mt-1 text-sm text-foreground">{props.card.proposedValue}</div>
          </div>
        </div>
        {props.card.detail ? <div className="mt-3 text-sm text-muted">{props.card.detail}</div> : null}
      </>
    )}
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

const CollapsibleSummaryPanel = (props: {
  label: string;
  summary: ReactNode;
  children: ReactNode;
}) => (
  <details className="rounded-xl border border-border bg-surface shadow-sm">
    <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
        {props.label}
      </div>
      <div className="min-w-0 flex-1 text-sm text-foreground">{props.summary}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
        Expand details
      </div>
    </summary>
    <div className="border-t border-border px-4 py-4 text-sm text-foreground">{props.children}</div>
  </details>
);

const InlineHelp = (props: { title: string; children: ReactNode }) => (
  <details className="rounded-lg border border-border/70 bg-surface-2 px-3 py-2 text-sm text-muted">
    <summary className="cursor-pointer list-none font-semibold text-foreground">
      {props.title}
    </summary>
    <div className="mt-2 text-sm text-muted">{props.children}</div>
  </details>
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

const getRowSpecificExceptions = (row: AdsOptimizerTargetReviewRow) => [...row.coverage.notes];

const getCriticalWarnings = (row: AdsOptimizerTargetReviewRow) => {
  const warnings = [...row.coverage.criticalWarnings];
  if (!row.recommendation) {
    warnings.unshift('Recommendation snapshot missing for this target in the selected run.');
  }
  return warnings;
};

const getActionableWarningCount = (row: AdsOptimizerTargetReviewRow) =>
  getRowSpecificExceptions(row).length + getCriticalWarnings(row).length;

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
  (
    row.manualOverride?.replacement_action_bundle_json.actions.map((action) => ({
      actionType: action.action_type,
    })) ??
    row.recommendation?.actions ??
    []
  ).filter((action) =>
    isWorkspaceSupportedActionType(action.actionType)
  );

const getUnsupportedReviewOnlyActions = (row: AdsOptimizerTargetReviewRow) =>
  (row.recommendation?.actions ?? []).filter(
    (action) => !isWorkspaceSupportedActionType(action.actionType)
  );

const getOverrideActions = (override: AdsOptimizerRecommendationOverride | null | undefined) =>
  override?.replacement_action_bundle_json.actions ?? [];

const buildOverrideBadgeLabel = (override: AdsOptimizerRecommendationOverride) =>
  override.override_scope === 'persistent' ? 'Human override · persistent' : 'Human override';

const readJsonString = (value: Record<string, unknown> | null, key: string) =>
  typeof value?.[key] === 'string' ? (value[key] as string) : null;

const readJsonNumber = (value: Record<string, unknown> | null, key: string) => {
  const raw = value?.[key];
  if (raw === null || raw === undefined || raw === '') return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

const sentenceCase = (value: string | null) => {
  if (!value) return NOT_CAPTURED;
  return labelize(value).toLowerCase();
};

const buildActionCards = (args: {
  cardKeyPrefix: string;
  actions: Array<{
    actionType: string;
    entityContext: Record<string, unknown> | null;
    proposedChange: Record<string, unknown> | null;
  }>;
}): ProposedChangeCard[] => {
  const cards: ProposedChangeCard[] = [];

  for (const action of args.actions) {
    if (action.actionType === 'update_target_state') {
      cards.push({
        key: `${args.cardKeyPrefix}:state`,
        title: 'Update target state',
        category: 'execution',
        reviewOnly: false,
        currentValue: sentenceCase(readJsonString(action.entityContext, 'current_state')),
        proposedValue: sentenceCase(readJsonString(action.proposedChange, 'next_state')),
      });
      continue;
    }

    if (action.actionType === 'update_target_bid') {
      const currentBid = readJsonNumber(action.entityContext, 'current_bid');
      const nextBid = readJsonNumber(action.proposedChange, 'next_bid');
      const deltaPct = formatSignedPercentChange(readJsonNumber(action.proposedChange, 'delta_pct'));
      cards.push({
        key: `${args.cardKeyPrefix}:bid`,
        title: 'Update target bid',
        category: 'execution',
        reviewOnly: false,
        currentValue: currentBid === null ? NOT_CAPTURED : formatCurrency(currentBid),
        proposedValue:
          nextBid === null
            ? NOT_CAPTURED
            : deltaPct
              ? `${formatCurrency(nextBid)} (${deltaPct})`
              : formatCurrency(nextBid),
      });
      continue;
    }

    if (action.actionType === 'update_placement_modifier') {
      cards.push({
        key: `${args.cardKeyPrefix}:placement`,
        title: 'Update placement modifier',
        category: 'execution',
        reviewOnly: false,
        currentValue: formatWholePercent(readJsonNumber(action.entityContext, 'current_percentage')),
        proposedValue: formatWholePercent(readJsonNumber(action.proposedChange, 'next_percentage')),
      });
      continue;
    }

    if (action.actionType === 'change_review_cadence') {
      cards.push({
        key: `${args.cardKeyPrefix}:cadence`,
        title: 'Change review cadence',
        category: 'cadence',
        reviewOnly: false,
        currentValue: NOT_CAPTURED,
        proposedValue: labelize(readJsonString(action.proposedChange, 'recommended_cadence')),
        detail: 'Current cadence is not persisted in this snapshot.',
      });
    }
  }

  return cards;
};

const buildProposedChangeCards = (row: AdsOptimizerTargetReviewRow): ProposedChangeCard[] => {
  const cards: ProposedChangeCard[] = buildActionCards({
    cardKeyPrefix: row.targetSnapshotId,
    actions: row.recommendation?.actions ?? [],
  });

  for (const action of row.recommendation?.actions ?? []) {
    if (action.actionType === 'negative_candidate') {
      const searchTerm = readJsonString(action.entityContext, 'search_term') ?? 'this query';
      cards.push({
        key: `${row.targetSnapshotId}:negative`,
        title: 'Negative candidate review',
        category: 'review',
        reviewOnly: true,
        detail: `Review-only proposed action: consider adding "${searchTerm}" as a negative if the operator agrees with the observed waste pattern.`,
      });
      continue;
    }

    if (action.actionType === 'isolate_query_candidate') {
      const searchTerm = readJsonString(action.entityContext, 'search_term') ?? 'this query';
      cards.push({
        key: `${row.targetSnapshotId}:isolate`,
        title: 'Isolation candidate review',
        category: 'review',
        reviewOnly: true,
        detail: `Review-only proposed action: consider isolating "${searchTerm}" into its own target for cleaner control.`,
      });
    }
  }

  const promoteCandidate = row.recommendation?.queryDiagnostics?.promoteToExactCandidates[0] ?? null;
  if (promoteCandidate) {
    cards.push({
      key: `${row.targetSnapshotId}:promote-exact`,
      title: 'Promote-to-exact candidate review',
      category: 'review',
      reviewOnly: true,
      detail: `Review-only proposed action: consider promoting "${promoteCandidate.searchTerm}" into an exact target based on the persisted query diagnostics.`,
    });
  }

  const executionOrder = { execution: 0, review: 1, cadence: 2 } as const;
  return cards.sort(
    (left, right) =>
      executionOrder[left.category] - executionOrder[right.category] ||
      left.title.localeCompare(right.title)
  );
};

const buildManualOverrideCards = (row: AdsOptimizerTargetReviewRow): ProposedChangeCard[] =>
  buildActionCards({
    cardKeyPrefix: `${row.targetSnapshotId}:override`,
    actions: getOverrideActions(row.manualOverride).map((action) => ({
      actionType: action.action_type,
      entityContext: action.entity_context_json,
      proposedChange: action.proposed_change_json,
    })),
  });

const getActionEditorSource = (
  row: AdsOptimizerTargetReviewRow,
  actionType: WorkspaceSupportedActionType
) => {
  const overrideAction = getOverrideActions(row.manualOverride).find(
    (action) => action.action_type === actionType
  );
  if (overrideAction) {
    return {
      entityContext: overrideAction.entity_context_json,
      proposedChange: overrideAction.proposed_change_json,
      source: 'override' as const,
    };
  }

  const recommendationAction =
    row.recommendation?.actions.find((action) => action.actionType === actionType) ?? null;

  return {
    entityContext: recommendationAction?.entityContext ?? null,
    proposedChange: recommendationAction?.proposedChange ?? null,
    source: recommendationAction ? ('recommendation' as const) : ('none' as const),
  };
};

const formatPlacementLabel = (value: string | null) => {
  if (value === 'PLACEMENT_TOP') return 'Top of Search';
  if (value === 'PLACEMENT_REST_OF_SEARCH') return 'Rest of Search';
  if (value === 'PLACEMENT_PRODUCT_PAGE') return 'Product Pages';
  return labelize(value);
};

const OverrideDisclosureCard = (props: {
  id: string;
  label: string;
  status: 'None' | 'Active' | 'Applied';
  summary: string;
  notePreview: string;
  highlight: boolean;
  defaultExpanded: boolean;
  children: ReactNode;
}) => {
  const [expanded, setExpanded] = useState(props.defaultExpanded);

  return (
    <div className="space-y-4">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={props.id}
        className={`flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-4 text-left transition hover:border-primary/40 ${
          props.highlight ? 'border-amber-200 bg-amber-50/70' : 'border-border bg-surface-2'
        }`}
        onClick={() => setExpanded((current) => !current)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs uppercase tracking-[0.3em] text-muted">{props.label}</div>
            <div
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getOverrideStatusClass(
                props.status
              )}`}
            >
              {props.status}
            </div>
          </div>
          <div className="mt-2 line-clamp-1 text-sm font-semibold text-foreground">
            {props.summary}
          </div>
          <div className="mt-1 line-clamp-1 text-sm text-muted">{props.notePreview}</div>
        </div>
        <div className="pt-0.5 text-xs font-semibold uppercase tracking-wide text-muted">
          {expanded ? 'Collapse' : 'Expand'}
        </div>
      </button>

      {expanded ? <div id={props.id}>{props.children}</div> : null}
    </div>
  );
};

const getOverrideStatus = (override: AdsOptimizerRecommendationOverride | null | undefined) => {
  if (!override) return 'None';
  return override.apply_count > 0 ? 'Applied' : 'Active';
};

const getOverrideStatusClass = (status: 'None' | 'Active' | 'Applied') => {
  if (status === 'Active') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Applied') return 'border-sky-200 bg-sky-50 text-sky-800';
  return 'border-border bg-surface-2 text-muted';
};

const buildOverrideActionSummary = (cards: ProposedChangeCard[]) => {
  const primaryCard = cards[0] ?? null;
  if (!primaryCard) return 'No saved override bundle.';
  if (primaryCard.reviewOnly) return primaryCard.detail;
  return `${primaryCard.title}: ${primaryCard.proposedValue}`;
};

const buildTargetActivityFact = (row: AdsOptimizerTargetReviewRow) => {
  if (row.raw.clicks <= 0 && row.raw.spend <= 0) {
    return 'It showed no paid activity in the selected window.';
  }
  if (row.raw.orders <= 0) {
    return `It spent ${formatCurrency(row.raw.spend)} across ${formatNumber(row.raw.clicks)} clicks without an order.`;
  }
  return `It delivered ${formatNumber(row.raw.orders)} order(s) from ${formatNumber(row.raw.clicks)} clicks on ${formatCurrency(row.raw.spend)} spend.`;
};

const buildFlagLead = (args: {
  row: AdsOptimizerTargetReviewRow;
  productState: AdsOptimizerProductRunState | null;
}) => {
  const { row } = args;
  const recommendation = row.recommendation;
  const portfolio = recommendation?.portfolioControls;
  const highSeveritySignal = recommendation?.exceptionSignals.find(
    (signal) => signal.severity === 'high'
  );

  if (recommendation?.spendDirection === 'stop') {
    if (row.role.guardrails.flags.autoPauseEligible) {
      return 'This target is flagged for a hard stop because its guardrails mark it as auto-pause eligible.';
    }
    if (portfolio?.stopLossCapExceeded) {
      return 'This target is flagged for a hard stop because the ASIN-level stop-loss cap is already exceeded.';
    }
    return 'This target is flagged for a hard stop because the persisted recommendation says spend should stop now.';
  }

  if (portfolio?.discoverCapBlocked) {
    return 'This target is flagged because the Discover portfolio cap is already full, so growth on this row is constrained.';
  }
  if (portfolio?.learningBudgetExceeded) {
    return 'This target is flagged because the ASIN learning-budget cap is already exceeded.';
  }
  if (portfolio?.budgetShareExceeded) {
    return 'This target is flagged because it is already above the allowed budget share for one target.';
  }
  if (highSeveritySignal) {
    return `${highSeveritySignal.title}.`;
  }
  if (row.state.efficiency.value === 'converting_but_loss_making') {
    return 'This target is flagged because it is converting at a loss and the optimizer is protecting margin.';
  }
  if (row.state.efficiency.value === 'learning_no_sale') {
    return 'This target is flagged because it is still spending in learning mode without a sale.';
  }
  if (row.state.confidence.value === 'insufficient') {
    return 'This target is flagged because the optimizer has low confidence relative to the observed exposure.';
  }

  const desiredRole = row.role.desiredRole.label;
  const currentRole = row.role.currentRole.label;
  if (desiredRole !== currentRole) {
    return `This target is flagged because its current role of ${currentRole.toLowerCase()} no longer matches the desired ${desiredRole.toLowerCase()} role.`;
  }

  return `This target is flagged because the persisted optimizer state points to a ${labelize(
    recommendation?.spendDirection ?? row.queue.spendDirection
  ).toLowerCase()} posture instead of hold.`;
};

const buildWhyFlaggedNarrative = (args: {
  row: AdsOptimizerTargetReviewRow;
  productState: AdsOptimizerProductRunState | null;
}) => {
  const { row, productState } = args;
  const recommendation = row.recommendation;
  const portfolio = recommendation?.portfolioControls;
  const pieces = [
    buildFlagLead(args),
    buildTargetActivityFact(row),
    `The persisted state is ${row.state.efficiency.label.toLowerCase()} with ${row.state.confidence.label.toLowerCase()} confidence and ${row.state.importance.label.toLowerCase()} importance.`,
  ];

  if (row.role.currentRole.label !== row.role.desiredRole.label) {
    pieces.push(
      `The optimizer wants this target to move from ${row.role.currentRole.label.toLowerCase()} to ${row.role.desiredRole.label.toLowerCase()}.`
    );
  }

  if (portfolio) {
    const capFacts = [
      portfolio.discoverCapBlocked ? 'Discover cap blocked' : null,
      portfolio.learningBudgetExceeded ? 'learning budget exceeded' : null,
      portfolio.stopLossCapExceeded ? 'stop-loss cap exceeded' : null,
      portfolio.budgetShareExceeded ? 'budget share exceeded' : null,
    ].filter(Boolean);
    if (capFacts.length > 0) {
      pieces.push(`Portfolio caps in play: ${capFacts.join(', ')}.`);
    }
  }

  if (productState?.objective) {
    pieces.push(`This sits inside a product objective of ${productState.objective}.`);
  }

  if (recommendation?.spendDirection === 'stop') {
    pieces.push(
      'Because the spend direction is stop, pausing is safer than bid or placement tuning while the blocking condition remains unresolved.'
    );
  }

  return pieces.join(' ');
};

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

export default function TargetsPageShell(props: OptimizerTargetsPanelProps) {
  const [selectedTargetSnapshotId, setSelectedTargetSnapshotId] = useState<string | null>(
    props.rows[0]?.targetSnapshotId ?? null
  );
  const [selectedForHandoff, setSelectedForHandoff] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<AdsOptimizerTargetFilterValue>('all');
  const [efficiencyFilter, setEfficiencyFilter] = useState<AdsOptimizerTargetFilterValue>('all');
  const [tierFilter, setTierFilter] = useState<AdsOptimizerTargetFilterValue>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<AdsOptimizerTargetFilterValue>('all');
  const [spendDirectionFilter, setSpendDirectionFilter] =
    useState<AdsOptimizerTargetFilterValue>('all');
  const [exceptionFilter, setExceptionFilter] =
    useState<AdsOptimizerTargetExceptionFilterValue>('all');
  const [sortBy, setSortBy] = useState<AdsOptimizerTargetQueueSort>('priority');
  const [sortDirection, setSortDirection] = useState<AdsOptimizerTargetQueueSortDirection>('asc');
  const [selectedInspectionEngineState, setSelectedInspectionEngineState] = useState<{
    targetSnapshotId: string | null;
    engine: DrawerInspectionSelection;
  }>({
    targetSnapshotId: null,
    engine: null,
  });
  const rowSummaries = useMemo(() => buildAdsOptimizerTargetRowSummaries(props.rows), [props.rows]);
  const rowLookup = useMemo(
    () => new Map(props.rows.map((row) => [row.targetSnapshotId, row])),
    [props.rows]
  );
  const filteredRowSummaries = useMemo(
    () =>
      filterAdsOptimizerTargetRowSummaries(rowSummaries, {
        role: roleFilter,
        efficiency: efficiencyFilter,
        tier: tierFilter,
        confidence: confidenceFilter,
        spendDirection: spendDirectionFilter,
        exceptions: exceptionFilter,
        sortBy,
        sortDirection,
      }),
    [
      confidenceFilter,
      efficiencyFilter,
      exceptionFilter,
      roleFilter,
      rowSummaries,
      sortBy,
      sortDirection,
      spendDirectionFilter,
      tierFilter,
    ]
  );
  const filteredRows = filteredRowSummaries
    .map((summary) => rowLookup.get(summary.targetSnapshotId) ?? null)
    .filter((row): row is AdsOptimizerTargetReviewRow => row !== null);
  const activeTargetSnapshotId = filteredRows.some(
    (row) => row.targetSnapshotId === selectedTargetSnapshotId
  )
    ? selectedTargetSnapshotId
    : (filteredRows[0]?.targetSnapshotId ?? null);
  const selectedInspectionEngine =
    selectedInspectionEngineState.targetSnapshotId === activeTargetSnapshotId
      ? selectedInspectionEngineState.engine
      : null;
  const activeRow =
    filteredRows.find((row) => row.targetSnapshotId === activeTargetSnapshotId) ?? null;
  const effectiveVersionContext = props.run
    ? readAdsOptimizerRunEffectiveVersionContext(props.run.input_summary_json)
    : null;

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
          {props.runLookupError
            ? 'Requested persisted optimizer run could not be loaded.'
            : 'No persisted optimizer review run exists for this ASIN/date range yet.'}
        </div>
        <div className="mt-2 max-w-3xl text-sm text-muted">
          {props.runLookupError
            ? `${props.runLookupError} Use History to pick a valid completed run, or clear the runId and review by ASIN/date window instead.`
            : 'Phase 12 only hands off persisted snapshots from the exact ASIN and exact date window shown above. Create a manual run first so the target queue can load target profiles, states, roles, diagnostics, comparison cues, and recommendation snapshots before any supported actions are staged into Ads Workspace.'}
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

  const persistedRecommendationRows = props.rows.filter((row) => row.recommendation).length;
  const actionCount = props.rows.reduce(
    (sum, row) => sum + (row.recommendation?.actionCount ?? 0),
    0
  );
  const coverageWarnings = props.rows.reduce(
    (count, row) => count + getActionableWarningCount(row),
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
  const activeRowSpecificExceptions = activeRow ? getRowSpecificExceptions(activeRow) : [];
  const activeCriticalWarnings = activeRow ? getCriticalWarnings(activeRow) : [];
  const highSeverityExceptionCount = exceptionEntries.filter(
    (entry) => entry.signal.severity === 'high'
  ).length;
  const rollbackGuidanceCount = props.comparison?.rollbackGuidance.length ?? 0;
  const rollbackCautionFlagCount =
    props.comparison?.rollbackGuidance.reduce(
      (sum, entry) => sum + entry.cautionFlags.length,
      0
    ) ?? 0;
  const comparisonIsStable = Boolean(
    props.comparison &&
      !props.comparison.versionComparison.changed &&
      props.comparison.summary.stateChanges === 0 &&
      props.comparison.summary.roleChanges === 0 &&
      props.comparison.summary.recommendationChanges === 0 &&
      props.comparison.summary.exceptionChanges === 0 &&
      props.comparison.summary.portfolioControlChanges === 0
  );

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

  const toggleQueueSort = (nextSort: AdsOptimizerTargetQueueSort) => {
    if (sortBy === nextSort) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(nextSort);
    setSortDirection(getDefaultAdsOptimizerTargetQueueSortDirection(nextSort));
  };

  const buildSortIndicator = (column: AdsOptimizerTargetQueueSort) => {
    if (sortBy !== column) return ' ';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="space-y-6">
      {props.notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {props.notice}
        </div>
      ) : null}
      {props.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {props.error}
        </div>
      ) : null}

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

      {props.resolvedContextSource === 'run_id' ? (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-sky-700">
                Persisted run review
              </div>
              <div className="mt-1 font-semibold">
                Viewing persisted run: {formatDateTime(props.run.created_at)} ·{' '}
                {props.run.rule_pack_version_label} ·{' '}
                {formatUiDateRange(props.run.date_start, props.run.date_end)}
              </div>
              <div className="mt-1 text-sky-800">
                This Targets view is pinned to run {props.run.run_id}. It is reviewing saved
                historical optimizer output, not triggering a fresh recompute.
                {effectiveVersionContext
                  ? ` ${formatVersionResolutionSource(
                      effectiveVersionContext.resolutionSource
                    )} was recorded for this run, using ${formatStrategyProfile(
                      effectiveVersionContext.strategyProfile
                    )}${
                      effectiveVersionContext.productArchetype
                        ? ` for a ${formatStrategyProfile(
                            effectiveVersionContext.productArchetype
                          )} product archetype`
                        : ''
                    }.`
                  : ''}
              </div>
            </div>
            <Link href={props.historyHref} className="text-sm font-semibold text-sky-900 underline">
              Back to History
            </Link>
          </div>
        </section>
      ) : null}

      <details className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm">
        <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
          How to read the Targets page
        </summary>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted">What this is</div>
            <div className="mt-2 text-sm text-foreground">
              A read-first optimizer workbench for one ASIN and one exact date window. It shows
              persisted target diagnostics, recommended actions, comparison cues, and handoff
              readiness without bypassing Ads Workspace.
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted">Why it matters</div>
            <div className="mt-2 text-sm text-foreground">
              This view helps operators see what changed, what looks incomplete, and what is safe
              to hand off before any staged draft is created in Ads Workspace.
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted">How to read it</div>
            <div className="mt-2 space-y-2 text-sm text-foreground">
              <div>Use the queue to sort and filter targets by priority, role, state, and confidence.</div>
              <div>Coverage rolls up into Ready, Partial, and Missing. Missing can be normal for zero-click search-term diagnostics or suspicious when source data should exist.</div>
              <div>Non-additive diagnostics such as STIS, STIR, TOS IS, and rank are shown only as latest observed values or explicit trend descriptors.</div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted">What to do next</div>
            <div className="mt-2 space-y-2 text-sm text-foreground">
              <div>Review row-specific exceptions and critical warnings first.</div>
              <div>Use the drawer to inspect recommendation details, portfolio context, comparison cues, and rollback guidance.</div>
              <div>Handoff only the supported actions you want staged into Ads Workspace.</div>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-surface px-4 py-4">
          <div className="text-xs uppercase tracking-wide text-muted">Global methodology notes</div>
          <ul className="mt-2 space-y-2 text-sm text-muted">
            {GLOBAL_METHODOLOGY_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </details>

      <section className="grid gap-4 xl:grid-cols-8">
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
          label="Effective rule pack"
          value={props.run.rule_pack_version_label}
          detail={
            effectiveVersionContext
              ? `${formatVersionResolutionSource(effectiveVersionContext.resolutionSource)} · ${formatStrategyProfile(
                  effectiveVersionContext.strategyProfile
                )} · ${formatVersionFallbackReason(
                  effectiveVersionContext.fallbackReason
                )}`
              : 'Effective version recorded on the run snapshot.'
          }
        />
        <SummaryCard
          label="Strategy profile"
          value={formatStrategyProfile(effectiveVersionContext?.strategyProfile)}
          detail="Persisted from the effective rule-pack version used for this run."
        />
        <SummaryCard
          label="Product archetype"
          value={formatStrategyProfile(effectiveVersionContext?.productArchetype)}
          detail="Persisted from saved product settings when available."
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
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Actionable warnings</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(coverageWarnings)}</div>
          <div className="mt-2 text-sm text-muted">
            This count includes row-specific exceptions and critical warnings only. Global
            methodology notes live in the help panel instead of inflating every row.
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <CollapsibleSummaryPanel
          label="Portfolio controls"
          summary={
            portfolioReference ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs xl:justify-end">
                <span>
                  <span className="font-semibold text-foreground">Active Discover</span>{' '}
                  <span className="text-muted">
                    {formatNumber(portfolioReference.activeDiscoverTargets)} /{' '}
                    {formatNumber(portfolioReference.maxActiveDiscoverTargets)}
                  </span>
                </span>
                <span>
                  <span className="font-semibold text-foreground">Learning Budget Cap</span>{' '}
                  <span className="text-muted">
                    {formatCurrency(portfolioReference.learningBudgetUsed)} /{' '}
                    {formatCurrency(portfolioReference.learningBudgetCap)}
                  </span>
                </span>
                <span>
                  <span className="font-semibold text-foreground">Stop-loss Cap</span>{' '}
                  <span className="text-muted">
                    {formatCurrency(portfolioReference.totalStopLossSpend)} /{' '}
                    {formatCurrency(portfolioReference.totalStopLossCap)}
                  </span>
                </span>
                <span>
                  <span className="font-semibold text-foreground">Budget Share Breaches</span>{' '}
                  <span className="text-muted">{formatNumber(budgetShareExceptions)}</span>
                </span>
              </div>
            ) : (
              <div className="text-sm text-muted">
                Portfolio-control diagnostics were not captured for this run.
              </div>
            )
          }
        >
          <div className="space-y-3">
            <InlineHelp title="Portfolio controls">
              These caps apply at the ASIN level. They can hold back an individual target even when
              that target looks strong on its own, because the wider portfolio is already at its
              Discover, learning-budget, stop-loss, or budget-share limit.
            </InlineHelp>
            {portfolioReference ? (
              <>
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
                  These caps are computed at the ASIN run level and can push individual targets
                  from increase to hold or reduce when the broader portfolio envelope is already
                  full.
                </div>
              </>
            ) : null}
          </div>
        </CollapsibleSummaryPanel>

        <CollapsibleSummaryPanel
          label="Exception queue"
          summary={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs xl:justify-end">
              <span>
                <span className="font-semibold text-foreground">Total exceptions</span>{' '}
                <span className="text-muted">{formatNumber(exceptionEntries.length)}</span>
              </span>
              <span>
                <span className="font-semibold text-foreground">High severity</span>{' '}
                <span className="text-muted">{formatNumber(highSeverityExceptionCount)}</span>
              </span>
            </div>
          }
        >
          <div className="space-y-3">
            <InlineHelp title="Exception signals">
              Exceptions highlight rows that need extra operator review, such as guardrail
              breaches, major role changes, main-driver degradation, or high-spend low-confidence
              cases.
            </InlineHelp>
            {exceptionEntries.length > 0 ? (
              <div className="space-y-2 xl:max-h-72 xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
                {exceptionEntries.map(({ key, row, signal }) => (
                  <button
                    key={key}
                    type="button"
                    className="w-full rounded-lg border border-border/70 bg-surface-2 px-3 py-2 text-left transition hover:border-primary/40"
                    onClick={() => setSelectedTargetSnapshotId(row.targetSnapshotId)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">{signal.title}</div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted">
                          {row.targetText} · {labelize(signal.type)} ·{' '}
                          {buildPriorityLabel(row.queue.priority, row.queue.primaryActionType)}
                        </div>
                      </div>
                      <ExceptionSeverityBadge severity={signal.severity} />
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-foreground">
                      {signal.detail}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted">
                No exception signals were persisted for the current queue filters.
              </div>
            )}
          </div>
        </CollapsibleSummaryPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <CollapsibleSummaryPanel
          label="Run comparison"
          summary={
            props.comparison ? (
              comparisonIsStable ? (
                <div className="text-sm text-muted">
                  Nothing material changed versus the prior comparable run.
                </div>
              ) : (
                <div className="grid gap-x-4 gap-y-1 text-xs xl:grid-cols-4">
                  <span>
                    <span className="font-semibold text-foreground">Baseline run</span>{' '}
                    <span className="text-muted">
                      {props.comparison.baselineRun
                        ? props.comparison.baselineRun.rulePackVersionLabel
                        : 'No prior comparable run'}
                    </span>
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">Version changed</span>{' '}
                    <span className="text-muted">
                      {String(props.comparison.versionComparison.changed)}
                    </span>
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">State changes</span>{' '}
                    <span className="text-muted">
                      {formatNumber(props.comparison.summary.stateChanges)}
                    </span>
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">Role changes</span>{' '}
                    <span className="text-muted">
                      {formatNumber(props.comparison.summary.roleChanges)}
                    </span>
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">
                      Recommendation changes
                    </span>{' '}
                    <span className="text-muted">
                      {formatNumber(props.comparison.summary.recommendationChanges)}
                    </span>
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">Exception changes</span>{' '}
                    <span className="text-muted">
                      {formatNumber(props.comparison.summary.exceptionChanges)}
                    </span>
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">
                      Portfolio control changes
                    </span>{' '}
                    <span className="text-muted">
                      {formatNumber(props.comparison.summary.portfolioControlChanges)}
                    </span>
                  </span>
                </div>
              )
            ) : (
              <div className="text-sm text-muted">
                No prior completed run exists yet for this same ASIN and exact date window.
              </div>
            )
          }
        >
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
                  Current version:{' '}
                  {props.comparison.versionComparison.currentChangeSummary ??
                    'No version summary captured.'}
                </div>
                <div className="mt-1 text-muted">
                  Previous version:{' '}
                  {props.comparison.versionComparison.previousChangeSummary ??
                    'No prior version summary captured.'}
                </div>
              </div>
              <div className="text-sm text-muted">
                Handoff audit: current run{' '}
                {formatNumber(props.comparison.handoffAudit.currentRunChangeSetCount)} draft set(s)
                / {formatNumber(props.comparison.handoffAudit.currentRunItemCount)} item(s); prior
                comparable run{' '}
                {formatNumber(props.comparison.handoffAudit.previousRunChangeSetCount)} draft
                set(s) / {formatNumber(props.comparison.handoffAudit.previousRunItemCount)} item(s).
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
          ) : null}
        </CollapsibleSummaryPanel>

        <CollapsibleSummaryPanel
          label="Rollback / reversal guidance"
          summary={
            rollbackGuidanceCount > 0 ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs xl:justify-end">
                <span>
                  <span className="font-semibold text-foreground">Rollback cues</span>{' '}
                  <span className="text-muted">{formatNumber(rollbackGuidanceCount)}</span>
                </span>
                <span>
                  <span className="font-semibold text-foreground">Caution flags</span>{' '}
                  <span className="text-muted">{formatNumber(rollbackCautionFlagCount)}</span>
                </span>
              </div>
            ) : (
              <div className="text-sm text-muted">
                No rollback or reversal cues were generated for the current comparable runs.
              </div>
            )
          }
        >
          <div className="space-y-3">
            <InlineHelp title="Rollback guidance">
              These cues are advisory only. They call out prior staged decisions or changed
              optimizer outputs that may deserve reversal review in Ads Workspace.
            </InlineHelp>
            {props.comparison && props.comparison.rollbackGuidance.length > 0 ? (
              <div className="space-y-2 xl:max-h-72 xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
                {props.comparison.rollbackGuidance.map((entry, index) => (
                  <button
                    key={`${entry.targetId}:${entry.title}:${index}`}
                    type="button"
                    className="w-full rounded-lg border border-border/70 bg-surface-2 px-3 py-2 text-left transition hover:border-primary/40"
                    onClick={() => {
                      const match = props.rows.find((row) => row.targetId === entry.targetId);
                      if (match) setSelectedTargetSnapshotId(match.targetSnapshotId);
                    }}
                  >
                    <div className="line-clamp-1 text-sm font-semibold text-foreground">
                      {entry.title}
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted">
                      {entry.targetText}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-foreground">{entry.detail}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entry.cautionFlags.map((flag) => (
                        <ReasonCodeBadge key={`${entry.targetId}:${flag}`} code={flag} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </CollapsibleSummaryPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <TargetAdvancedSection label="Top risks">
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
        </TargetAdvancedSection>

        <TargetAdvancedSection label="Top opportunities">
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
        </TargetAdvancedSection>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)] xl:items-stretch">
        <div className="space-y-4 xl:flex xl:h-[calc(100vh-1.5rem)] xl:min-h-0 xl:flex-col">
          <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted">Target queue</div>
                <div className="mt-2 text-sm text-muted">
                  Priority sorting still opens as the default queue order from the exact run. You
                  can now sort directly from the sticky table headers while keeping filters scoped
                  to this ASIN and date window.
                </div>
                <div className="mt-3">
                  <InlineHelp title="Coverage">
                    Ready means the needed target inputs were captured. Partial means some context
                    exists but a needed supporting input was incomplete. Missing can be normal for
                    zero-click search-term diagnostics or suspicious when a source-day diagnostic
                    should have been present.
                  </InlineHelp>
                </div>
                <div className="mt-3">
                  <InlineHelp title="Reason-code badges">
                    Badges summarize the main persisted reason codes for a row. Use them as a quick
                    triage aid, then open the drawer for the full recommendation, state, and
                    comparison details behind those badges.
                  </InlineHelp>
                </div>
              </div>
              <Link href={props.historyHref} className="text-sm font-semibold text-primary">
                Go to History
              </Link>
            </div>

            <div className="mt-4 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
              <div>
                <TargetsToolbar
                  roleFilter={roleFilter}
                  efficiencyFilter={efficiencyFilter}
                  tierFilter={tierFilter}
                  confidenceFilter={confidenceFilter}
                  spendDirectionFilter={spendDirectionFilter}
                  exceptionFilter={exceptionFilter}
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  filteredRowCount={filteredRows.length}
                  totalRowCount={props.rows.length}
                  persistedRecommendationRows={persistedRecommendationRows}
                  stageableRowCount={stageableRows.length}
                  selectedCount={selectedForHandoff.length}
                  selectedActionCount={selectedStageableActionCount}
                  visibleStageableCount={visibleStageableRows.length}
                  selectedTargetSnapshotIds={selectedForHandoff}
                  allVisibleStageableSelected={allVisibleStageableSelected}
                  historyHref={props.historyHref}
                  workspaceQueueHref={props.workspaceQueueHref}
                  returnTo={props.returnTo}
                  asin={props.asin}
                  start={props.start}
                  end={props.end}
                  handoffAction={props.handoffAction}
                  onRoleFilterChange={setRoleFilter}
                  onEfficiencyFilterChange={setEfficiencyFilter}
                  onTierFilterChange={setTierFilter}
                  onConfidenceFilterChange={setConfidenceFilter}
                  onSpendDirectionFilterChange={setSpendDirectionFilter}
                  onExceptionFilterChange={setExceptionFilter}
                  onToggleAllVisibleStageable={toggleAllVisibleStageable}
                />
              </div>

              {filteredRows.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
                  No target rows match the current optimizer queue filters.
                </div>
              ) : (
                <div className="mt-3 xl:min-h-0 xl:flex-1 xl:overflow-auto xl:overscroll-contain">
                  <table className="min-w-[1800px] table-auto border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                        <th className="sticky top-0 z-20 border-b border-border bg-surface px-3 py-2 shadow-sm">
                          <input
                            type="checkbox"
                            aria-label="Select all visible stageable optimizer rows"
                            checked={allVisibleStageableSelected}
                            disabled={visibleStageableRows.length === 0}
                            onChange={(event) => toggleAllVisibleStageable(event.target.checked)}
                          />
                        </th>
                        <th className="sticky top-0 left-0 z-30 border-b border-border bg-surface px-3 py-2 shadow-sm">
                          <button
                            type="button"
                            className="flex items-center gap-1 font-semibold text-foreground transition hover:text-primary"
                            onClick={() => toggleQueueSort('target')}
                          >
                            <span>Target</span>
                            <span className="text-[11px] text-muted">{buildSortIndicator('target')}</span>
                          </button>
                        </th>
                        <th className="sticky top-0 z-20 border-b border-border bg-surface px-3 py-2 shadow-sm">
                          <button
                            type="button"
                            className="flex items-center gap-1 font-semibold text-foreground transition hover:text-primary"
                            onClick={() => toggleQueueSort('priority')}
                          >
                            <span>Priority</span>
                            <span className="text-[11px] text-muted">
                              {buildSortIndicator('priority')}
                            </span>
                          </button>
                        </th>
                        <th className="sticky top-0 z-20 border-b border-border bg-surface px-3 py-2 shadow-sm">
                          <button
                            type="button"
                            className="flex items-center gap-1 font-semibold text-foreground transition hover:text-primary"
                            onClick={() => toggleQueueSort('recommendations')}
                          >
                            <span>Recommendations</span>
                            <span className="text-[11px] text-muted">
                              {buildSortIndicator('recommendations')}
                            </span>
                          </button>
                        </th>
                        <th className="sticky top-0 z-20 border-b border-border bg-surface px-3 py-2 shadow-sm">
                          <button
                            type="button"
                            className="flex items-center gap-1 font-semibold text-foreground transition hover:text-primary"
                            onClick={() => toggleQueueSort('workspace_actions')}
                          >
                            <span>Workspace actions</span>
                            <span className="text-[11px] text-muted">
                              {buildSortIndicator('workspace_actions')}
                            </span>
                          </button>
                        </th>
                        <th className="sticky top-0 z-20 border-b border-border bg-surface px-3 py-2 shadow-sm">
                          <button
                            type="button"
                            className="flex items-center gap-1 font-semibold text-foreground transition hover:text-primary"
                            onClick={() => toggleQueueSort('current_role')}
                          >
                            <span>Current role</span>
                            <span className="text-[11px] text-muted">
                              {buildSortIndicator('current_role')}
                            </span>
                          </button>
                        </th>
                        <th className="sticky top-0 z-20 border-b border-border bg-surface px-3 py-2 shadow-sm">
                          <button
                            type="button"
                            className="flex items-center gap-1 font-semibold text-foreground transition hover:text-primary"
                            onClick={() => toggleQueueSort('efficiency')}
                          >
                            <span>Efficiency</span>
                            <span className="text-[11px] text-muted">
                              {buildSortIndicator('efficiency')}
                            </span>
                          </button>
                        </th>
                        <th className="sticky top-0 z-20 border-b border-border bg-surface px-3 py-2 shadow-sm">
                          <button
                            type="button"
                            className="flex items-center gap-1 font-semibold text-foreground transition hover:text-primary"
                            onClick={() => toggleQueueSort('confidence')}
                          >
                            <span>Confidence</span>
                            <span className="text-[11px] text-muted">
                              {buildSortIndicator('confidence')}
                            </span>
                          </button>
                        </th>
                        <th className="sticky top-0 z-20 border-b border-border bg-surface px-3 py-2 shadow-sm">
                          <button
                            type="button"
                            className="flex items-center gap-1 font-semibold text-foreground transition hover:text-primary"
                            onClick={() => toggleQueueSort('tier')}
                          >
                            <span>Tier</span>
                            <span className="text-[11px] text-muted">{buildSortIndicator('tier')}</span>
                          </button>
                        </th>
                        <th className="sticky top-0 z-20 border-b border-border bg-surface px-3 py-2 shadow-sm">
                          <button
                            type="button"
                            className="flex items-center gap-1 font-semibold text-foreground transition hover:text-primary"
                            onClick={() => toggleQueueSort('spend_direction')}
                          >
                            <span>Spend direction</span>
                            <span className="text-[11px] text-muted">
                              {buildSortIndicator('spend_direction')}
                            </span>
                          </button>
                        </th>
                        <th className="sticky top-0 z-20 border-b border-border bg-surface px-3 py-2 shadow-sm">
                          <button
                            type="button"
                            className="flex items-center gap-1 font-semibold text-foreground transition hover:text-primary"
                            onClick={() => toggleQueueSort('exceptions')}
                          >
                            <span>Exceptions</span>
                            <span className="text-[11px] text-muted">
                              {buildSortIndicator('exceptions')}
                            </span>
                          </button>
                        </th>
                        <th className="sticky top-0 z-20 border-b border-border bg-surface px-3 py-2 shadow-sm">Reason-code badges</th>
                        <th className="sticky top-0 z-20 border-b border-border bg-surface px-3 py-2 shadow-sm">Coverage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRowSummaries.map((summary) => {
                        const row = rowLookup.get(summary.targetSnapshotId);
                        if (!row) return null;

                        return (
                          <TargetSummaryRow
                            key={summary.rowId}
                            row={row}
                            summary={summary}
                            isActive={summary.targetSnapshotId === activeTargetSnapshotId}
                            isSelected={selectedForHandoff.includes(summary.targetSnapshotId)}
                            isStageable={summary.handoff.stageable}
                            onSelect={() => setSelectedTargetSnapshotId(summary.targetSnapshotId)}
                            onToggleSelect={(checked) =>
                              toggleSelectedRow(summary.targetSnapshotId, checked)
                            }
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        <TargetExpandedPanel
          drawerId={activeRow ? `target-detail-drawer-${activeRow.targetSnapshotId}` : undefined}
          activeRow={activeRow}
        >
          {activeRow ? (
              (() => {
                const proposedChangeCards = buildProposedChangeCards(activeRow);
                const manualOverrideCards = buildManualOverrideCards(activeRow);
                const bidActionEditor = getActionEditorSource(activeRow, 'update_target_bid');
                const stateActionEditor = getActionEditorSource(activeRow, 'update_target_state');
                const placementActionEditor = getActionEditorSource(
                  activeRow,
                  'update_placement_modifier'
                );
                const currentBidForOverride =
                  readJsonNumber(bidActionEditor.entityContext, 'current_bid') ?? activeRow.raw.cpc;
                const nextBidForOverride = readJsonNumber(
                  bidActionEditor.proposedChange,
                  'next_bid'
                );
                const currentStateForOverride = readJsonString(
                  stateActionEditor.entityContext,
                  'current_state'
                );
                const nextStateForOverride = readJsonString(
                  stateActionEditor.proposedChange,
                  'next_state'
                );
                const currentPlacementCodeForOverride =
                  readJsonString(placementActionEditor.entityContext, 'placement_code') ??
                  readJsonString(placementActionEditor.proposedChange, 'placement_code') ??
                  activeRow.recommendation?.placementDiagnostics?.currentPlacementCode ??
                  'PLACEMENT_TOP';
                const currentPlacementPctForOverride =
                  readJsonNumber(placementActionEditor.entityContext, 'current_percentage') ??
                  activeRow.recommendation?.placementDiagnostics?.currentPercentage ??
                  activeRow.placementContext.topOfSearchModifierPct;
                const nextPlacementPctForOverride = readJsonNumber(
                  placementActionEditor.proposedChange,
                  'next_percentage'
                );
                const whyFlaggedNarrative = buildWhyFlaggedNarrative({
                  row: activeRow,
                  productState: props.productState,
                });
                const portfolioControls = activeRow.recommendation?.portfolioControls ?? null;
                const hasPortfolioConstraint = Boolean(
                  portfolioControls &&
                    (portfolioControls.reasonCodes.length > 0 ||
                      portfolioControls.discoverCapBlocked ||
                      portfolioControls.learningBudgetExceeded ||
                      portfolioControls.stopLossCapExceeded ||
                      portfolioControls.budgetShareExceeded)
                );
                const hasMaterialGuardrailDriver =
                  activeRow.role.guardrails.flags.requiresManualApproval ||
                  activeRow.role.guardrails.flags.autoPauseEligible ||
                  activeRow.role.guardrails.flags.transitionLocked ||
                  activeRow.role.guardrails.notes.length > 0 ||
                  (activeRow.recommendation?.unsupportedActionBlocks.length ?? 0) > 0 ||
                  activeRow.recommendation?.manualReviewRequired === true;
                const hasMaterialQueryDriver =
                  activeRow.searchTermDiagnostics.topTerms.length > 0 ||
                  activeRow.demandProxies.searchTermCount > 0 ||
                  (activeRow.recommendation?.queryDiagnostics?.sameTextQueryPinning.status ?? 'not_observed') !==
                    'not_observed' ||
                  (activeRow.recommendation?.queryDiagnostics?.promoteToExactCandidates.length ?? 0) > 0 ||
                  (activeRow.recommendation?.queryDiagnostics?.isolateCandidates.length ?? 0) > 0 ||
                  (activeRow.recommendation?.queryDiagnostics?.negativeCandidates.length ?? 0) > 0;
                const hasMaterialPlacementDriver =
                  activeRow.placementContext.topOfSearchModifierPct !== null ||
                  activeRow.placementContext.impressions !== null ||
                  activeRow.placementContext.spend !== null ||
                  (activeRow.recommendation?.placementDiagnostics?.biasRecommendation ?? 'unknown') !==
                    'unknown' ||
                  (activeRow.recommendation?.placementDiagnostics?.reasonCodes.length ?? 0) > 0;
                const hasDerivedMetrics =
                  activeRow.derived.contributionAfterAds !== null ||
                  activeRow.derived.breakEvenGap !== null ||
                  activeRow.derived.maxCpcSupportGap !== null ||
                  activeRow.derived.lossDollars !== null ||
                  activeRow.derived.profitDollars !== null ||
                  activeRow.derived.clickVelocity !== null ||
                  activeRow.derived.impressionVelocity !== null ||
                  activeRow.derived.organicContextSignal !== null;

                const drawerSections: DrawerInspectionSection[] = [
                  {
                    id: 'action-plan',
                    label: 'Action plan',
                    render: () => (
                      <DetailSection label="Action plan">
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
                                { label: 'Status', value: labelize(activeRow.recommendation.status) },
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
                                  value: activeRow.recommendation.executionBoundary ?? NOT_CAPTURED,
                                },
                                {
                                  label: 'Workspace handoff',
                                  value: activeRow.recommendation.workspaceHandoff ?? NOT_CAPTURED,
                                },
                                {
                                  label: 'Writes execution tables',
                                  value:
                                    activeRow.recommendation.writesExecutionTables === null
                                      ? NOT_CAPTURED
                                      : String(activeRow.recommendation.writesExecutionTables),
                                },
                                {
                                  label: 'Manual review required',
                                  value:
                                    activeRow.recommendation.manualReviewRequired === null
                                      ? NOT_CAPTURED
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
                                    <ReasonCodeBadge
                                      key={`${activeRow.targetSnapshotId}:${flag}`}
                                      code={flag}
                                    />
                                  ))
                                ) : (
                                  <div className="text-sm text-muted">
                                    No coverage flags were persisted.
                                  </div>
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
                                <div className="text-sm text-muted">
                                  No confidence notes were persisted.
                                </div>
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
                                        <div className="font-semibold text-foreground">
                                          {signal.title}
                                        </div>
                                        <ExceptionSeverityBadge severity={signal.severity} />
                                      </div>
                                      <div className="mt-2 text-sm text-foreground">
                                        {signal.detail}
                                      </div>
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
                                    <ReasonCodeBadge
                                      key={`${activeRow.targetSnapshotId}:${code}`}
                                      code={code}
                                    />
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
                    ),
                  },
                  {
                    id: 'portfolio-caps',
                    label: 'Portfolio caps',
                    render: () => (
                      <DetailSection label="Portfolio caps">
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
                    ),
                  },
                  {
                    id: 'run-comparison',
                    label: 'Run comparison',
                    render: () => (
                      <DetailSection label="Run comparison">
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
                                    <div className="font-semibold text-foreground">
                                      {change.summary}
                                    </div>
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
                    ),
                  },
                  {
                    id: 'rollback-guidance',
                    label: 'Rollback guidance',
                    render: () => (
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
                    ),
                  },
                  {
                    id: 'raw-metrics',
                    label: 'Raw metrics',
                    render: () => (
                      <DetailSection label="Raw metrics">
                        <div className="space-y-3">
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
                                value:
                                  activeRow.raw.roas === null ? '—' : activeRow.raw.roas.toFixed(2),
                              },
                              {
                                label: 'Latest observed TOS IS',
                                value: formatPercent(activeRow.raw.tosIs),
                              },
                              {
                                label: 'Latest observed STIS',
                                value: formatPercent(activeRow.raw.stis),
                              },
                              {
                                label: 'Latest observed STIR',
                                value: formatNumber(activeRow.raw.stir),
                              },
                            ]}
                          />
                          <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3 text-sm text-muted">
                            {activeRow.nonAdditiveDiagnostics.note ??
                              'Non-additive diagnostics stay point-in-time only. Use the latest observed value and explicit trend cues instead of treating them like additive totals.'}
                          </div>
                        </div>
                      </DetailSection>
                    ),
                  },
                  {
                    id: 'derived-metrics',
                    label: 'Derived metrics',
                    render: () => (
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
                            {
                              label: 'Loss dollars',
                              value: formatCurrency(activeRow.derived.lossDollars),
                            },
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
                              label: 'Organic context signal',
                              value:
                                activeRow.derived.organicContextSignal === null
                                  ? '—'
                                  : labelize(activeRow.derived.organicContextSignal),
                            },
                          ]}
                        />
                      </DetailSection>
                    ),
                  },
                  {
                    id: 'target-state',
                    label: 'Target state',
                    render: () => (
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
                            <div className="text-xs uppercase tracking-wide text-muted">
                              State breakdown
                            </div>
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
                              <div className="text-sm text-muted">
                                No state reason codes were captured.
                              </div>
                            )}
                          </div>
                        </div>
                      </DetailSection>
                    ),
                  },
                  {
                    id: 'role-history',
                    label: 'Role history',
                    render: () => (
                      <DetailSection label="Role history">
                        <div className="space-y-3">
                          <DetailGrid
                            items={[
                              { label: 'Desired role', value: activeRow.role.desiredRole.label },
                              { label: 'Current role', value: activeRow.role.currentRole.label },
                              {
                                label: 'Previous role',
                                value: activeRow.role.previousRole ?? NOT_CAPTURED,
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
                                      Run {entry.runId} · rule {entry.transitionRule ?? NOT_CAPTURED} ·
                                      desired {entry.desiredRole ?? NOT_CAPTURED}
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
                    ),
                  },
                  {
                    id: 'guardrails',
                    label: 'Guardrails',
                    render: () => (
                      <DetailSection label="Guardrails">
                        <div className="space-y-3">
                          <DetailGrid
                            items={[
                              {
                                label: 'No-sale spend cap',
                                value: formatCurrency(
                                  activeRow.role.guardrails.categories.noSaleSpendCap
                                ),
                              },
                              {
                                label: 'No-sale click cap',
                                value: formatNumber(activeRow.role.guardrails.categories.noSaleClickCap),
                              },
                              {
                                label: 'Max loss per cycle',
                                value: formatCurrency(
                                  activeRow.role.guardrails.categories.maxLossPerCycle
                                ),
                              },
                              {
                                label: 'Max bid increase %',
                                value:
                                  activeRow.role.guardrails.categories.maxBidIncreasePerCyclePct ===
                                  null
                                    ? '—'
                                    : `${activeRow.role.guardrails.categories.maxBidIncreasePerCyclePct}%`,
                              },
                              {
                                label: 'Max bid decrease %',
                                value:
                                  activeRow.role.guardrails.categories.maxBidDecreasePerCyclePct ===
                                  null
                                    ? '—'
                                    : `${activeRow.role.guardrails.categories.maxBidDecreasePerCyclePct}%`,
                              },
                              {
                                label: 'Placement bias increase %',
                                value:
                                  activeRow.role.guardrails.categories
                                    .maxPlacementBiasIncreasePerCyclePct === null
                                    ? '—'
                                    : `${activeRow.role.guardrails.categories.maxPlacementBiasIncreasePerCyclePct}%`,
                              },
                              {
                                label: 'Rank push time limit',
                                value:
                                  activeRow.role.guardrails.categories.rankPushTimeLimitDays === null
                                    ? '—'
                                    : `${activeRow.role.guardrails.categories.rankPushTimeLimitDays} days`,
                              },
                              {
                                label: 'Manual approval threshold',
                                value: labelize(
                                  activeRow.role.guardrails.categories.manualApprovalThreshold
                                ),
                              },
                              {
                                label: 'Auto-pause threshold',
                                value: formatCurrency(
                                  activeRow.role.guardrails.categories.autoPauseThreshold
                                ),
                              },
                              {
                                label: 'Min bid floor',
                                value: formatCurrency(activeRow.role.guardrails.categories.minBidFloor),
                              },
                              {
                                label: 'Max bid ceiling',
                                value: formatCurrency(
                                  activeRow.role.guardrails.categories.maxBidCeiling
                                ),
                              },
                            ]}
                          />
                          <div className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3">
                            <div className="text-xs uppercase tracking-wide text-muted">
                              Guardrail flags
                            </div>
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
                                  <li key={`${activeRow.targetSnapshotId}:guardrail-note:${note}`}>
                                    {note}
                                  </li>
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
                    ),
                  },
                  {
                    id: 'query-diagnostics',
                    label: 'Query diagnostics',
                    render: () => (
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
                                  activeRow.searchTermDiagnostics.representativeSearchTerm ??
                                  NOT_CAPTURED,
                              },
                              {
                                label: 'Representative same-text',
                                value:
                                  activeRow.searchTermDiagnostics.representativeSameText === null
                                    ? NOT_CAPTURED
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
                            <div className="text-xs uppercase tracking-wide text-muted">
                              Top query rows
                            </div>
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
                                    <div className="font-semibold text-foreground">
                                      {term.searchTerm}
                                    </div>
                                    <div className="mt-1 text-xs text-muted">
                                      same_text={String(term.sameText)} · clicks{' '}
                                      {formatNumber(term.clicks)} · orders{' '}
                                      {formatNumber(term.orders)} · spend{' '}
                                      {formatCurrency(term.spend)} · sales{' '}
                                      {formatCurrency(term.sales)}
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
                                candidates={
                                  activeRow.recommendation.queryDiagnostics.promoteToExactCandidates
                                }
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
                    ),
                  },
                  {
                    id: 'placement-diagnostics',
                    label: 'Placement diagnostics',
                    render: () => (
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
                                  NOT_CAPTURED,
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
                    ),
                  },
                ];

                const engineChips: Array<{ id: DrawerInspectionSelection; label: string }> = [];
                engineChips.push({ id: 'action-plan', label: 'Action plan' });
                if (hasMaterialGuardrailDriver) {
                  engineChips.push({ id: 'guardrails', label: 'Guardrails' });
                }
                if (hasPortfolioConstraint) {
                  engineChips.push({ id: 'portfolio-caps', label: 'Portfolio caps' });
                }
                engineChips.push({ id: 'target-state', label: 'Target state' });
                if (
                  activeRow.roleHistory.length > 0 ||
                  activeRow.role.previousRole !== null ||
                  activeRow.role.currentRole.label !== activeRow.role.desiredRole.label
                ) {
                  engineChips.push({ id: 'role-history', label: 'Role history' });
                }
                if (hasMaterialQueryDriver) {
                  engineChips.push({ id: 'query-diagnostics', label: 'Query diagnostics' });
                }
                if (hasMaterialPlacementDriver) {
                  engineChips.push({ id: 'placement-diagnostics', label: 'Placement diagnostics' });
                }
                if (targetComparisonChanges.length > 0) {
                  engineChips.push({ id: 'run-comparison', label: 'Run comparison' });
                }
                if (targetRollbackGuidance.length > 0) {
                  engineChips.push({ id: 'rollback-guidance', label: 'Rollback guidance' });
                }
                engineChips.push({ id: 'raw-metrics', label: 'Raw metrics' });
                if (hasDerivedMetrics) {
                  engineChips.push({ id: 'derived-metrics', label: 'Derived metrics' });
                }
                engineChips.push({ id: 'all', label: 'All engines' });

                const inspectionSections =
                  selectedInspectionEngine === null
                    ? []
                    : selectedInspectionEngine === 'all'
                      ? drawerSections
                      : drawerSections.filter((section) => section.id === selectedInspectionEngine);

                return (
                  <div className="mt-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                    <div className="border-b border-border bg-surface pb-4 xl:sticky xl:top-0 xl:z-20">
                      <div className="space-y-4 px-0 xl:px-0 xl:pt-1">
                        <div>
                          <div className="text-lg font-semibold text-foreground">
                            {activeRow.targetText}
                          </div>
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
                            <input
                              type="hidden"
                              name="workspace_return_to"
                              value={props.workspaceQueueHref}
                            />
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

                        <div className="flex flex-wrap gap-2">
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
                          <StatePill
                            kind="confidence"
                            value={activeRow.state.confidence.value}
                            label={activeRow.state.confidence.label}
                          />
                          <StatePill
                            kind="importance"
                            value={activeRow.state.importance.value}
                            label={activeRow.state.importance.label}
                          />
                          {activeRow.manualOverride ? (
                            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                              {buildOverrideBadgeLabel(activeRow.manualOverride)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain">
                      <div className="space-y-6">
                        {activeCriticalWarnings.length > 0 || activeRowSpecificExceptions.length > 0 ? (
                          <div
                            className={`rounded-xl border px-4 py-3 text-sm ${
                              activeCriticalWarnings.length > 0
                                ? 'border-rose-200 bg-rose-50 text-rose-900'
                                : 'border-amber-200 bg-amber-50 text-amber-900'
                            }`}
                          >
                            <div className="font-semibold">Row-specific exceptions</div>
                            {activeCriticalWarnings.length > 0 ? (
                              <div className="mt-3">
                                <div className="font-semibold">Critical warnings</div>
                                <ul className="mt-2 space-y-1">
                                  {activeCriticalWarnings.map((note) => (
                                    <li key={`${activeRow.targetSnapshotId}:critical:${note}`}>
                                      {note}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {activeRowSpecificExceptions.length > 0 ? (
                              <div className={activeCriticalWarnings.length > 0 ? 'mt-3' : 'mt-2'}>
                                <div className="font-semibold">Exceptions</div>
                                <ul className="mt-2 space-y-1">
                                  {activeRowSpecificExceptions.map((note) => (
                                    <li key={`${activeRow.targetSnapshotId}:exception:${note}`}>
                                      {note}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="space-y-3">
                          <div className="text-xs uppercase tracking-[0.3em] text-muted">
                            Proposed changes
                          </div>
                          {proposedChangeCards.length > 0 ? (
                            <div className="grid gap-3">
                              {proposedChangeCards.map((card) => (
                                <ProposedChangeSummaryCard key={card.key} card={card} />
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-border bg-surface px-4 py-4 text-sm text-muted">
                              No concrete changes were proposed for this target in the selected run.
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border border-border bg-surface px-4 py-4">
                          {(() => {
                            const overrideStatus = getOverrideStatus(activeRow.manualOverride);
                            const overrideSummary = buildOverrideActionSummary(manualOverrideCards);
                            const overrideSectionId = `human-override-panel-${activeRow.targetSnapshotId}`;

                            return (
                              <OverrideDisclosureCard
                                key={`${activeRow.targetSnapshotId}:${props.overrideError ? 'error' : 'default'}`}
                                id={overrideSectionId}
                                label="Human override"
                                status={overrideStatus}
                                summary={overrideSummary}
                                notePreview={
                                  activeRow.manualOverride?.operator_note ??
                                  'Open to create or replace a staged override bundle.'
                                }
                                highlight={Boolean(activeRow.manualOverride)}
                                defaultExpanded={props.overrideError}
                              >
                                <div className="space-y-4">
                                    <div className="text-sm text-foreground">
                                      Replace staged actions
                                    </div>
                                    <div className="text-sm text-muted">
                                      This override replaces the staged Ads Workspace bundle. The
                                      persisted optimizer proposal above remains visible for audit
                                      review.
                                    </div>

                                    {activeRow.manualOverride ? (
                                      <div className="space-y-3">
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <div className="rounded-full border border-amber-200 bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                                              {buildOverrideBadgeLabel(activeRow.manualOverride)}
                                            </div>
                                            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                                              Override scope
                                            </div>
                                            <div className="text-sm text-foreground">
                                              {labelize(activeRow.manualOverride.override_scope)}
                                            </div>
                                          </div>
                                          <div className="mt-3 text-sm text-foreground">
                                            <span className="font-semibold">Override note:</span>{' '}
                                            {activeRow.manualOverride.operator_note}
                                          </div>
                                          <div className="mt-2 text-xs text-muted">
                                            Created {formatDateTime(activeRow.manualOverride.created_at)}{' '}
                                            · applied{' '}
                                            {formatNumber(activeRow.manualOverride.apply_count)} time(s)
                                          </div>
                                        </div>
                                        {manualOverrideCards.length > 0 ? (
                                          <div className="grid gap-3">
                                            {manualOverrideCards.map((card) => (
                                              <ProposedChangeSummaryCard key={card.key} card={card} />
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
                                        No active human override is saved for this target.
                                      </div>
                                    )}

                                    {activeRow.recommendation ? (
                                      <TargetOverrideForm
                                        row={activeRow}
                                        recommendation={activeRow.recommendation}
                                        productId={props.productId}
                                        returnTo={props.returnTo}
                                        saveRecommendationOverrideAction={
                                          props.saveRecommendationOverrideAction
                                        }
                                        bidActionEditor={bidActionEditor}
                                        stateActionEditor={stateActionEditor}
                                        placementActionEditor={placementActionEditor}
                                        currentBid={currentBidForOverride}
                                        nextBid={nextBidForOverride}
                                        currentState={currentStateForOverride}
                                        nextState={nextStateForOverride}
                                        currentPlacementCode={currentPlacementCodeForOverride}
                                        currentPlacementPercentage={currentPlacementPctForOverride}
                                        nextPlacementPercentage={nextPlacementPctForOverride}
                                        formatCurrency={formatCurrency}
                                        formatWholePercent={formatWholePercent}
                                        formatPlacementLabel={formatPlacementLabel}
                                        sentenceCase={sentenceCase}
                                      />
                                    ) : (
                                      <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
                                        Product scope or recommendation context is missing, so this
                                        target cannot accept a saved override yet.
                                      </div>
                                    )}
                                </div>
                              </OverrideDisclosureCard>
                            );
                          })()}
                        </div>

                        <div className="rounded-xl border border-border bg-surface px-4 py-4">
                          <div className="text-xs uppercase tracking-[0.3em] text-muted">
                            Why this target is flagged
                          </div>
                          <div className="mt-3 text-sm text-foreground">
                            {whyFlaggedNarrative}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="text-xs uppercase tracking-[0.3em] text-muted">
                            Decision engines
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {engineChips.map((chip) => {
                              const isActiveChip = selectedInspectionEngine === chip.id;
                              return (
                                <button
                                  key={`${activeRow.targetSnapshotId}:engine:${chip.id}`}
                                  type="button"
                                  aria-pressed={isActiveChip}
                                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                                    isActiveChip
                                      ? 'border-primary bg-primary text-primary-foreground'
                                      : 'border-border bg-surface text-foreground hover:border-primary/40 hover:text-primary'
                                  }`}
                                  onClick={() =>
                                    setSelectedInspectionEngineState({
                                      targetSnapshotId: activeRow.targetSnapshotId,
                                      engine: chip.id,
                                    })
                                  }
                                >
                                  {chip.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {selectedInspectionEngine === null ? (
                          <div className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
                            Select an engine above to inspect its details.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {inspectionSections.map((section) => (
                              <Fragment key={`inspection-${section.id}`}>{section.render()}</Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
          ) : null}
        </TargetExpandedPanel>
      </section>
    </div>
  );
}
