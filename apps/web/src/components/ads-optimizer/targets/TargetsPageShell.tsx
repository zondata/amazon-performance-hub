'use client';

import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';

import { readAdsOptimizerRunEffectiveVersionContext } from '@/lib/ads-optimizer/effectiveVersion';
import type { AdsOptimizerRunComparisonView } from '@/lib/ads-optimizer/comparison';
import type { AdsOptimizerTargetRole } from '@/lib/ads-optimizer/role';
import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';
import {
  resolveVisibleExpandedTargetSnapshotId,
  toggleExpandedTargetSnapshotId,
} from '@/lib/ads-optimizer/targetInlineExpansion';
import type { AdsOptimizerRun } from '@/lib/ads-optimizer/runtimeTypes';
import type { AdsOptimizerProductRunState } from '@/lib/ads-optimizer/state';
import {
  buildAdsOptimizerTargetRowTableSummaries,
  filterAdsOptimizerTargetRowTableSummaries,
  getDefaultAdsOptimizerTargetTableSortDirection,
  type AdsOptimizerTargetExceptionFilterValue,
  type AdsOptimizerTargetFilterValue,
  type AdsOptimizerTargetTableSort,
  type AdsOptimizerTargetTableSortDirection,
} from '@/lib/ads-optimizer/targetRowTableSummary';
import {
  ADS_OPTIMIZER_TARGET_TABLE_COLUMNS,
  ADS_OPTIMIZER_TARGET_TABLE_LAYOUT_STORAGE_KEY,
  applyAdsOptimizerTargetTableColumnResizeDelta,
  getDefaultAdsOptimizerTargetTableLayoutPrefs,
  getAdsOptimizerTargetTableColumnConfig,
  parseAdsOptimizerTargetTableLayoutPrefs,
  serializeAdsOptimizerTargetTableLayoutPrefs,
  toggleAdsOptimizerTargetTableFrozenColumn,
  type AdsOptimizerTargetTableColumnKey,
  type AdsOptimizerTargetTableLayoutPrefs,
} from '@/lib/ads-optimizer/targetTableLayoutPrefs';
import {
  applyAdsOptimizerRecommendationOverrideOverlay,
  type AdsOptimizerRecommendationOverrideOverlay,
} from '@/lib/ads-optimizer/recommendationOverrideOverlay';
import type { SaveAdsOptimizerRecommendationOverrideInlineAction } from '@/lib/ads-optimizer/recommendationOverrideInlineState';
import type { AdsOptimizerRecommendationOverride } from '@/lib/ads-optimizer/types';
import {
  formatUiDateRange,
  formatUiDateTime as formatDateTime,
} from '@/lib/time/formatUiDate';
import TargetAdvancedSection from './TargetAdvancedSection';
import TargetChangePlanTab, {
  type TargetChangePlanOverrideActionItem,
  type TargetChangePlanPlacementCode,
  type TargetChangePlanProposalItem,
} from './TargetChangePlanTab';
import TargetExpandedPanel from './TargetExpandedPanel';
import TargetPlacementTab from './TargetPlacementTab';
import TargetSearchTermTab from './TargetSearchTermTab';
import TargetSqpTab from './TargetSqpTab';
import TargetExpandedTabs, {
  TARGET_EXPANDED_TAB_DEFINITIONS,
  getTargetExpandedTabId,
  getTargetExpandedTabPanelId,
  type TargetExpandedTabKey,
} from './TargetExpandedTabs';
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
  saveRecommendationOverrideAction: SaveAdsOptimizerRecommendationOverrideInlineAction;
};

type WorkspaceSupportedActionType =
  | 'update_target_bid'
  | 'update_target_state'
  | 'update_placement_modifier';
type ProposedChangeDetail =
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
type ActiveColumnResize = {
  key: AdsOptimizerTargetTableColumnKey;
  pointerId: number;
  startClientX: number;
  startWidth: number;
};
type HeaderSortOption = {
  value: AdsOptimizerTargetTableSort;
  label: string;
};

const GLOBAL_METHODOLOGY_NOTES = [
  'STIS, STIR, and TOS IS are non-additive diagnostics. The Targets page only shows latest observed values or explicit trend metadata, never a synthetic window average.',
  'Ranking follows the same rule. If rank context is shown, treat it as latest observed value plus direction or delta, not an averaged raw rank.',
  'Zero-click targets can legitimately show expected-unavailable search-term diagnostics. That is normal availability behavior unless other inputs also look incomplete.',
  'Ads Optimizer remains recommendation-first. Ads Workspace is still the only staging and execution boundary.',
];
const NOT_CAPTURED = 'Not captured';
const CHANGE_PLAN_PLACEMENT_CODES: TargetChangePlanPlacementCode[] = [
  'PLACEMENT_TOP',
  'PLACEMENT_REST_OF_SEARCH',
  'PLACEMENT_PRODUCT_PAGE',
];
const CHANGE_PLAN_PLACEMENT_SHORT_CODES: Record<TargetChangePlanPlacementCode, string> = {
  PLACEMENT_TOP: 'TOS',
  PLACEMENT_REST_OF_SEARCH: 'ROS',
  PLACEMENT_PRODUCT_PAGE: 'PP',
};
const CHANGE_PLAN_PLACEMENT_LABELS: Record<TargetChangePlanPlacementCode, string> = {
  PLACEMENT_TOP: 'Top of Search',
  PLACEMENT_REST_OF_SEARCH: 'Rest of Search',
  PLACEMENT_PRODUCT_PAGE: 'Product Pages',
};
const CHANGE_PLAN_PLACEMENT_ROW_IDS: Record<TargetChangePlanPlacementCode, string> = {
  PLACEMENT_TOP: 'update_placement_modifier::PLACEMENT_TOP',
  PLACEMENT_REST_OF_SEARCH: 'update_placement_modifier::PLACEMENT_REST_OF_SEARCH',
  PLACEMENT_PRODUCT_PAGE: 'update_placement_modifier::PLACEMENT_PRODUCT_PAGE',
};
const STATE_HEADER_SORT_OPTIONS: HeaderSortOption[] = [
  { value: 'state_current_profit_loss', label: 'P&L (current)' },
  { value: 'state_current_acos', label: 'ACoS (current)' },
];
const ECONOMICS_HEADER_SORT_OPTIONS: HeaderSortOption[] = [
  { value: 'economics_current_spend', label: 'Spend (current)' },
  { value: 'economics_current_sales', label: 'Sales (current)' },
  { value: 'economics_current_orders', label: 'Orders (current)' },
];
const CONTRIBUTION_HEADER_SORT_OPTIONS: HeaderSortOption[] = [
  { value: 'contribution_sales_rank', label: 'Sales rank' },
  { value: 'contribution_spend_rank', label: 'Spend rank' },
  { value: 'contribution_impression_rank', label: 'Impression rank' },
  { value: 'contribution_sqp_impression_rank', label: 'SQP impression rank' },
];
const RANKING_HEADER_SORT_OPTIONS: HeaderSortOption[] = [
  { value: 'ranking_organic_latest', label: 'Organic rank' },
  { value: 'ranking_organic_trend', label: 'Organic trend' },
];

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

const ReasonCodeBadge = (props: { code: string }) => (
  <span className="rounded-[4px] border border-border bg-surface-2 px-2 py-[3px] font-mono text-[10px] text-muted">
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

const isTargetChangePlanPlacementCode = (
  value: string | null
): value is TargetChangePlanPlacementCode =>
  value === 'PLACEMENT_TOP' ||
  value === 'PLACEMENT_REST_OF_SEARCH' ||
  value === 'PLACEMENT_PRODUCT_PAGE';

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

const getOverrideActions = (override: AdsOptimizerRecommendationOverride | null | undefined) =>
  override?.replacement_action_bundle_json.actions ?? [];

const readJsonString = (value: Record<string, unknown> | null, key: string) =>
  typeof value?.[key] === 'string' ? (value[key] as string) : null;

const readJsonNumber = (value: Record<string, unknown> | null, key: string) => {
  const raw = value?.[key];
  if (raw === null || raw === undefined || raw === '') return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

const readPlacementCodeFromActionPayload = (
  entityContext: Record<string, unknown> | null,
  proposedChange: Record<string, unknown> | null
): TargetChangePlanPlacementCode | null => {
  const placementCode =
    readJsonString(entityContext, 'placement_code') ??
    readJsonString(proposedChange, 'placement_code');
  return isTargetChangePlanPlacementCode(placementCode) ? placementCode : null;
};

const getCurrentPlacementPercentage = (
  row: AdsOptimizerTargetReviewRow,
  placementCode: TargetChangePlanPlacementCode
) =>
  row.placementBreakdown.rows.find((placement) => placement.placementCode === placementCode)
    ?.modifierPct ?? null;

const sentenceCase = (value: string | null) => {
  if (!value) return NOT_CAPTURED;
  return labelize(value).toLowerCase();
};

const formatOverridePlacementPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)}%`;
};

const buildActionCards = (args: {
  cardKeyPrefix: string;
  actions: Array<{
    actionType: string;
    entityContext: Record<string, unknown> | null;
    proposedChange: Record<string, unknown> | null;
  }>;
}): ProposedChangeDetail[] => {
  const cards: ProposedChangeDetail[] = [];

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
      const placementCode = readPlacementCodeFromActionPayload(
        action.entityContext,
        action.proposedChange
      );
      cards.push({
        key: `${args.cardKeyPrefix}:placement:${placementCode ?? 'unknown'}`,
        title: placementCode
          ? `Update placement modifier · ${CHANGE_PLAN_PLACEMENT_SHORT_CODES[placementCode]}`
          : 'Update placement modifier',
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

const buildProposedChangeCards = (row: AdsOptimizerTargetReviewRow): ProposedChangeDetail[] => {
  const cards: ProposedChangeDetail[] = buildActionCards({
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

const buildTargetChangePlanProposalRows = (
  row: AdsOptimizerTargetReviewRow
): TargetChangePlanProposalItem[] =>
  buildProposedChangeCards(row).map((card) => {
    if (card.reviewOnly) {
      return {
        key: card.key,
        title: card.title,
        tone: 'review',
        status: 'review',
        currentValue: NOT_CAPTURED,
        currentValueUnknown: true,
        proposedValue: 'Review',
        footnote: card.detail,
      };
    }

    return {
      key: card.key,
      title: card.title,
      tone: card.category,
      status: card.category === 'execution' ? 'stageable' : 'review',
      currentValue: card.currentValue,
      currentValueUnknown:
        card.currentValue === NOT_CAPTURED || card.currentValue.trim().length === 0,
      proposedValue: card.proposedValue,
      footnote: card.detail ?? null,
    };
  });

const getActionEditorSource = (
  row: AdsOptimizerTargetReviewRow,
  actionType: WorkspaceSupportedActionType,
  placementCode?: TargetChangePlanPlacementCode
) => {
  const overrideAction = getOverrideActions(row.manualOverride).find(
    (action) =>
      action.action_type === actionType &&
      (actionType !== 'update_placement_modifier' ||
        placementCode === undefined ||
        readPlacementCodeFromActionPayload(
          action.entity_context_json,
          action.proposed_change_json
        ) === placementCode)
  );
  if (overrideAction) {
    return {
      entityContext: overrideAction.entity_context_json,
      proposedChange: overrideAction.proposed_change_json,
      source: 'override' as const,
    };
  }

  const recommendationAction =
    row.recommendation?.actions.find(
      (action) =>
        action.actionType === actionType &&
        (actionType !== 'update_placement_modifier' ||
          placementCode === undefined ||
          readPlacementCodeFromActionPayload(action.entityContext, action.proposedChange) ===
            placementCode)
    ) ?? null;

  return {
    entityContext: recommendationAction?.entityContext ?? null,
    proposedChange: recommendationAction?.proposedChange ?? null,
    source: recommendationAction ? ('recommendation' as const) : ('none' as const),
  };
};

const buildTargetChangePlanOverrideRows = (args: {
  row: AdsOptimizerTargetReviewRow;
  bidActionEditor: ReturnType<typeof getActionEditorSource>;
  stateActionEditor: ReturnType<typeof getActionEditorSource>;
  currentBid: number | null;
  nextBid: number | null;
  currentState: string | null;
  nextState: string | null;
}): TargetChangePlanOverrideActionItem[] => [
  {
    rowId: 'update_target_bid::default',
    actionType: 'update_target_bid',
    placementCode: null,
    title: 'Update target bid',
    currentLine: `Current: ${formatCurrency(args.currentBid)}`,
    enabledFieldName: 'override_bid_enabled',
    valueFieldName: 'override_bid_next_bid',
    inputType: 'number',
    initialChecked: args.bidActionEditor.source !== 'none',
    initialValue: args.nextBid === null ? '' : String(args.nextBid),
    placeholder: 'Next bid',
    min: '0.01',
    step: '0.01',
  },
  {
    rowId: 'update_target_state::default',
    actionType: 'update_target_state',
    placementCode: null,
    title: 'Update target state',
    currentLine: `Current: ${sentenceCase(args.currentState)}`,
    enabledFieldName: 'override_state_enabled',
    valueFieldName: 'override_state_next_state',
    inputType: 'select',
    initialChecked: args.stateActionEditor.source !== 'none',
    initialValue: args.nextState ?? 'paused',
    options: [
      { value: 'enabled', label: 'Enabled' },
      { value: 'paused', label: 'Paused' },
      { value: 'archived', label: 'Archived' },
    ],
  },
  ...CHANGE_PLAN_PLACEMENT_CODES.map((placementCode) => {
    const placementActionEditor = getActionEditorSource(
      args.row,
      'update_placement_modifier',
      placementCode
    );
    const currentPlacementPercentage = getCurrentPlacementPercentage(args.row, placementCode);
    const nextPlacementPercentage = readJsonNumber(
      placementActionEditor.proposedChange,
      'next_percentage'
    );

    return {
      rowId: CHANGE_PLAN_PLACEMENT_ROW_IDS[placementCode],
      actionType: 'update_placement_modifier',
      placementCode,
      title: `${CHANGE_PLAN_PLACEMENT_SHORT_CODES[placementCode]} · Update placement modifier`,
      currentLine: `${CHANGE_PLAN_PLACEMENT_LABELS[placementCode]} · Current: ${formatOverridePlacementPercent(
        currentPlacementPercentage
      )}`,
      enabledFieldName: `override_placement_enabled__${placementCode}`,
      valueFieldName: `override_placement_next_percentage__${placementCode}`,
      hiddenFields: [
        {
          name: `current_placement_code__${placementCode}`,
          value: placementCode,
        },
        {
          name: `current_placement_percentage__${placementCode}`,
          value:
            currentPlacementPercentage === null ? '' : String(currentPlacementPercentage),
        },
      ],
      inputType: 'number',
      initialChecked: placementActionEditor.source !== 'none',
      initialValue:
        nextPlacementPercentage === null ? '' : String(nextPlacementPercentage),
      placeholder: 'Next placement percentage',
      min: '0',
      step: '1',
    } satisfies TargetChangePlanOverrideActionItem;
  }),
];

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
  const [selectedTargetSnapshotId, setSelectedTargetSnapshotId] = useState<string | null>(null);
  const [selectedForHandoff, setSelectedForHandoff] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<AdsOptimizerTargetFilterValue>('all');
  const [tierFilter, setTierFilter] = useState<AdsOptimizerTargetFilterValue>('all');
  const [trendFilter, setTrendFilter] = useState<AdsOptimizerTargetFilterValue>('all');
  const [spendDirectionFilter, setSpendDirectionFilter] =
    useState<AdsOptimizerTargetFilterValue>('all');
  const [exceptionFilter, setExceptionFilter] =
    useState<AdsOptimizerTargetExceptionFilterValue>('all');
  const [targetSearch, setTargetSearch] = useState('');
  const [sortBy, setSortBy] = useState<AdsOptimizerTargetTableSort>('priority');
  const [sortDirection, setSortDirection] = useState<AdsOptimizerTargetTableSortDirection>('asc');
  const [tableLayoutPrefs, setTableLayoutPrefs] = useState<AdsOptimizerTargetTableLayoutPrefs>(
    () => getDefaultAdsOptimizerTargetTableLayoutPrefs()
  );
  const [hasLoadedTableLayoutPrefs, setHasLoadedTableLayoutPrefs] = useState(false);
  const [activeColumnResize, setActiveColumnResize] = useState<ActiveColumnResize | null>(null);
  const [activeExpandedTab, setActiveExpandedTab] =
    useState<TargetExpandedTabKey>('why_flagged');
  const [savedOverrideOverlay, setSavedOverrideOverlay] =
    useState<AdsOptimizerRecommendationOverrideOverlay>({});
  const effectiveRows = useMemo(
    () => applyAdsOptimizerRecommendationOverrideOverlay(props.rows, savedOverrideOverlay),
    [props.rows, savedOverrideOverlay]
  );
  const rowSummaries = useMemo(
    () => buildAdsOptimizerTargetRowTableSummaries(effectiveRows),
    [effectiveRows]
  );
  const rowLookup = useMemo(
    () => new Map(effectiveRows.map((row) => [row.targetSnapshotId, row])),
    [effectiveRows]
  );
  const filteredRowSummaries = useMemo(
    () =>
      filterAdsOptimizerTargetRowTableSummaries(rowSummaries, {
        role: roleFilter,
        efficiency: 'all',
        tier: tierFilter,
        confidence: 'all',
        spendDirection: spendDirectionFilter,
        exceptions: exceptionFilter,
        targetSearch,
        sortBy,
        sortDirection,
      }).filter((summary) =>
        trendFilter === 'all'
          ? true
          : trendFilter === 'missing'
            ? summary.filters.trendContext === null
            : summary.filters.trendContext === trendFilter
      ),
    [
      exceptionFilter,
      roleFilter,
      rowSummaries,
      sortBy,
      sortDirection,
      spendDirectionFilter,
      targetSearch,
      tierFilter,
      trendFilter,
    ]
  );
  const filteredRows = filteredRowSummaries
    .map((summary) => rowLookup.get(summary.targetSnapshotId) ?? null)
    .filter((row): row is AdsOptimizerTargetReviewRow => row !== null);
  const trimmedTargetSearch = targetSearch.trim();
  const hasCollapsedTableFilters =
    trimmedTargetSearch.length > 0 ||
    roleFilter !== 'all' ||
    tierFilter !== 'all' ||
    trendFilter !== 'all' ||
    spendDirectionFilter !== 'all' ||
    exceptionFilter !== 'all';
  const emptyTableTitle =
    trimmedTargetSearch.length > 0
      ? `No matching targets for "${trimmedTargetSearch}"`
      : hasCollapsedTableFilters
        ? 'No matching targets'
        : 'No target rows available';
  const emptyTableBody =
    trimmedTargetSearch.length > 0
      ? 'Try a different search or clear filters.'
      : hasCollapsedTableFilters
        ? 'Try a different search or clear filters.'
        : 'This run did not load persisted target rows.';
  const activeTargetSnapshotId = resolveVisibleExpandedTargetSnapshotId(
    selectedTargetSnapshotId,
    filteredRows.map((row) => row.targetSnapshotId)
  );
  const activeRow =
    filteredRows.find((row) => row.targetSnapshotId === activeTargetSnapshotId) ?? null;
  const effectiveVersionContext = props.run
    ? readAdsOptimizerRunEffectiveVersionContext(props.run.input_summary_json)
    : null;
  const isTargetColumnFrozen = tableLayoutPrefs.frozenColumns.includes('target');
  const targetHeaderClass = isTargetColumnFrozen
    ? 'sticky left-0 z-30 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.18)]'
    : '';
  const columnWidthStyle = (key: AdsOptimizerTargetTableColumnKey) => ({
    width: `${tableLayoutPrefs.widths[key]}px`,
    minWidth: `${tableLayoutPrefs.widths[key]}px`,
    maxWidth: `${tableLayoutPrefs.widths[key]}px`,
  });
  const headerCellStyle = (key: AdsOptimizerTargetTableColumnKey) => ({
    ...columnWidthStyle(key),
    backgroundColor: 'var(--color-surface)',
  });
  const tableWidthPx = ADS_OPTIMIZER_TARGET_TABLE_COLUMNS.reduce(
    (sum, column) => sum + tableLayoutPrefs.widths[column.key],
    0
  );

  useEffect(() => {
    setSavedOverrideOverlay({});
  }, [props.asin, props.end, props.run?.run_id, props.start]);

  useEffect(() => {
    try {
      setTableLayoutPrefs(
        parseAdsOptimizerTargetTableLayoutPrefs(
          window.localStorage.getItem(ADS_OPTIMIZER_TARGET_TABLE_LAYOUT_STORAGE_KEY)
        )
      );
    } catch {
      setTableLayoutPrefs(getDefaultAdsOptimizerTargetTableLayoutPrefs());
    } finally {
      setHasLoadedTableLayoutPrefs(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedTableLayoutPrefs || activeColumnResize) return;
    try {
      window.localStorage.setItem(
        ADS_OPTIMIZER_TARGET_TABLE_LAYOUT_STORAGE_KEY,
        serializeAdsOptimizerTargetTableLayoutPrefs(tableLayoutPrefs)
      );
    } catch {
      // Ignore localStorage write failures.
    }
  }, [activeColumnResize, hasLoadedTableLayoutPrefs, tableLayoutPrefs]);

  useEffect(() => {
    if (!activeColumnResize) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activeColumnResize.pointerId) return;
      const deltaX = event.clientX - activeColumnResize.startClientX;
      setTableLayoutPrefs((current) =>
        applyAdsOptimizerTargetTableColumnResizeDelta(
          current,
          activeColumnResize.key,
          activeColumnResize.startWidth,
          deltaX
        )
      );
      if (event.cancelable) {
        event.preventDefault();
      }
    };

    const stopResize = (event: PointerEvent) => {
      if (event.pointerId !== activeColumnResize.pointerId) return;
      setActiveColumnResize(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };
  }, [activeColumnResize]);

  useEffect(() => {
    setActiveExpandedTab('why_flagged');
  }, [activeTargetSnapshotId]);

  const expandTargetRow = (targetSnapshotId: string) => {
    setSelectedTargetSnapshotId(targetSnapshotId);
  };

  const toggleTargetRow = (targetSnapshotId: string) => {
    setSelectedTargetSnapshotId((current) =>
      toggleExpandedTargetSnapshotId(current, targetSnapshotId)
    );
  };

  const handleSavedOverride = (override: AdsOptimizerRecommendationOverride) => {
    setSavedOverrideOverlay((current) => {
      const existing = current[override.target_snapshot_id];
      if (existing?.recommendation_override_id === override.recommendation_override_id) {
        return current;
      }
      return {
        ...current,
        [override.target_snapshot_id]: override,
      };
    });
  };

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

  const persistedRecommendationRows = effectiveRows.filter((row) => row.recommendation).length;
  const actionCount = effectiveRows.reduce(
    (sum, row) => sum + (row.recommendation?.actionCount ?? 0),
    0
  );
  const coverageWarnings = effectiveRows.reduce(
    (count, row) => count + getActionableWarningCount(row),
    0
  );
  const topRiskRows = buildTopList(effectiveRows, 'risk');
  const topOpportunityRows = buildTopList(effectiveRows, 'opportunity');
  const stageableRows = effectiveRows.filter((row) => getWorkspaceSupportedActions(row).length > 0);
  const visibleStageableRows = filteredRows.filter(
    (row) => getWorkspaceSupportedActions(row).length > 0
  );
  const selectedVisibleStageableIds = visibleStageableRows
    .map((row) => row.targetSnapshotId)
    .filter((id) => selectedForHandoff.includes(id));
  const allVisibleStageableSelected =
    visibleStageableRows.length > 0 &&
    selectedVisibleStageableIds.length === visibleStageableRows.length;
  const selectedStageableRows = effectiveRows.filter((row) =>
    selectedForHandoff.includes(row.targetSnapshotId)
  );
  const selectedStageableActionCount = selectedStageableRows.reduce(
    (sum, row) => sum + getWorkspaceSupportedActions(row).length,
    0
  );
  const portfolioReference =
    effectiveRows.find((row) => row.recommendation?.portfolioControls)?.recommendation
      ?.portfolioControls ?? null;
  const budgetShareExceptions = effectiveRows.filter(
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

  const toggleSortDirection = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const handleSortByChange = (nextSort: AdsOptimizerTargetTableSort) => {
    if (nextSort === sortBy) return;
    setSortBy(nextSort);
    setSortDirection(getDefaultAdsOptimizerTargetTableSortDirection(nextSort));
  };
  const getHeaderSortValue = (options: HeaderSortOption[]) =>
    options.some((option) => option.value === sortBy) ? sortBy : '';
  const handleHeaderSortSelect = (value: string) => {
    if (!value) return;
    handleSortByChange(value as AdsOptimizerTargetTableSort);
  };
  const renderHeaderSortControls = (args: {
    label: string;
    options: HeaderSortOption[];
    ariaLabel: string;
  }) => {
    const activeSortValue = getHeaderSortValue(args.options);

    return (
      <div className="flex min-w-0 flex-col gap-1 pr-5">
        <div className="truncate">{args.label}</div>
        <div className="flex items-center gap-2">
          <select
            value={activeSortValue}
            onChange={(event) => handleHeaderSortSelect(event.target.value)}
            aria-label={args.ariaLabel}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] font-medium normal-case tracking-normal text-foreground"
          >
            <option value="">Sort…</option>
            {args.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={toggleSortDirection}
            disabled={!activeSortValue}
            aria-label={`${args.label} sort direction`}
            className="shrink-0 rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] font-semibold normal-case tracking-normal text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sortDirection === 'asc' ? 'Asc' : 'Desc'}
          </button>
        </div>
      </div>
    );
  };

  const handleResetColumnWidths = () => {
    setTableLayoutPrefs(getDefaultAdsOptimizerTargetTableLayoutPrefs());
  };

  const handleToggleFrozenColumn = (key: AdsOptimizerTargetTableColumnKey) => {
    setTableLayoutPrefs((current) => toggleAdsOptimizerTargetTableFrozenColumn(current, key));
  };

  const handleColumnResizePointerDown = (
    key: AdsOptimizerTargetTableColumnKey,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const config = getAdsOptimizerTargetTableColumnConfig(key);
    setActiveColumnResize({
      key,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startWidth: Math.max(config.minWidth, tableLayoutPrefs.widths[key]),
    });
  };

  const activeExpandedContent = activeRow
      ? (() => {
        const changePlanProposalRows = buildTargetChangePlanProposalRows(activeRow);
        const bidActionEditor = getActionEditorSource(activeRow, 'update_target_bid');
        const stateActionEditor = getActionEditorSource(activeRow, 'update_target_state');
        const currentBidForOverride =
          readJsonNumber(bidActionEditor.entityContext, 'current_bid') ?? activeRow.raw.cpc;
        const nextBidForOverride = readJsonNumber(bidActionEditor.proposedChange, 'next_bid');
        const currentStateForOverride = readJsonString(
          stateActionEditor.entityContext,
          'current_state'
        );
        const nextStateForOverride = readJsonString(stateActionEditor.proposedChange, 'next_state');
        const whyFlaggedNarrative = buildWhyFlaggedNarrative({
          row: activeRow,
          productState: props.productState,
        });
        const stageableCount = (activeRow.recommendation?.actions ?? []).filter((action) =>
          isWorkspaceSupportedActionType(action.actionType)
        ).length;
        const reviewOnlyCount = (activeRow.recommendation?.actions ?? []).filter(
          (action) => !isWorkspaceSupportedActionType(action.actionType)
        ).length;
        const changePlanOverrideRows = buildTargetChangePlanOverrideRows({
          row: activeRow,
          bidActionEditor,
          stateActionEditor,
          currentBid: currentBidForOverride,
          nextBid: nextBidForOverride,
          currentState: currentStateForOverride,
          nextState: nextStateForOverride,
        });
        const changePlanFormUnavailableNote =
          props.productId && activeRow.recommendation
            ? null
            : 'Product scope or recommendation context is missing, so this target cannot accept a saved override yet.';
        const portfolioControls = activeRow.recommendation?.portfolioControls ?? null;
        const importanceStripLabel =
          activeRow.state.importance.label.split(' / ')[0] || activeRow.state.importance.label;
        const contextFacts = [
          activeRow.role.guardrails.flags.autoPauseEligible ? 'Auto-pause eligible' : null,
          `Objective: ${props.productState?.objective ?? 'Not captured'}`,
          activeRow.recommendation?.spendDirection === 'stop' ||
          activeRow.queue.spendDirection === 'stop' ||
          activeCriticalWarnings.length > 0 ||
          activeRowSpecificExceptions.length > 0
            ? 'Blocking condition unresolved'
            : null,
        ].filter((fact): fact is string => Boolean(fact));
        const combinedCallouts = [...activeCriticalWarnings, ...activeRowSpecificExceptions];
        const renderExpandedPanel = (tabKey: TargetExpandedTabKey) => {
          switch (tabKey) {
            case 'why_flagged':
              return (
                <div>
                  <div className="mb-[6px] text-[10px] font-medium uppercase tracking-[0.4px] text-muted">
                    Flag explanation
                  </div>
                  <p className="text-[12px] leading-[1.6] text-foreground/80">
                    {whyFlaggedNarrative}
                  </p>

                  <div className="mt-[14px] mb-[6px] text-[10px] font-medium uppercase tracking-[0.4px] text-muted">
                    Coverage callouts
                  </div>
                  {combinedCallouts.length > 0 ? (
                    <div className="space-y-2">
                      {combinedCallouts.map((note, index) => (
                        <div
                          key={`${activeRow.targetSnapshotId}:callout:${index}:${note}`}
                          className="flex items-start gap-2"
                        >
                          <span className="mt-[5px] h-[5px] w-[5px] flex-none rounded-full bg-amber-500" />
                          <div className="text-[11px] text-amber-800">{note}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[12px] leading-[1.6] text-muted">
                      No coverage callouts.
                    </div>
                  )}

                  <div className="mt-[14px] mb-[6px] text-[10px] font-medium uppercase tracking-[0.4px] text-muted">
                    Reason codes
                  </div>
                  {activeRow.queue.reasonCodeBadges.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeRow.queue.reasonCodeBadges.map((code) => (
                        <ReasonCodeBadge
                          key={`${activeRow.targetSnapshotId}:reason-code:${code}`}
                          code={code}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-[12px] leading-[1.6] text-muted">
                      No persisted reason codes
                    </div>
                  )}
                </div>
              );
            case 'change_plan':
              return (
                <TargetChangePlanTab
                  initialScope={activeRow.manualOverride?.override_scope ?? 'one_time'}
                  initialOperatorNote={activeRow.manualOverride?.operator_note ?? ''}
                  proposalRows={changePlanProposalRows}
                  stageableCount={stageableCount}
                  reviewOnlyCount={reviewOnlyCount}
                  overrideRows={changePlanOverrideRows}
                  hiddenInputs={{
                    returnTo: props.returnTo,
                    productId: props.productId,
                    asin: activeRow.asin,
                    targetId: activeRow.targetId,
                    runId: activeRow.runId,
                    targetSnapshotId: activeRow.targetSnapshotId,
                    recommendationSnapshotId:
                      activeRow.recommendation?.recommendationSnapshotId ??
                      activeRow.manualOverride?.recommendation_snapshot_id ??
                      null,
                    campaignId: activeRow.campaignId,
                    currentState: currentStateForOverride,
                    currentBid: currentBidForOverride,
                  }}
                  canSave={Boolean(props.productId && activeRow.recommendation)}
                  formUnavailableNote={changePlanFormUnavailableNote}
                  saveRecommendationOverrideAction={props.saveRecommendationOverrideAction}
                  onSavedOverride={handleSavedOverride}
                />
              );
            case 'search_term':
              return (
                <TargetSearchTermTab
                  row={activeRow}
                  asin={props.asin}
                  start={props.start}
                  end={props.end}
                />
              );
            case 'placement':
              return <TargetPlacementTab row={activeRow} allRows={effectiveRows} />;
            case 'sqp':
              return <TargetSqpTab row={activeRow} />;
            case 'metrics':
              return (
                <div className="grid gap-4 xl:grid-cols-3">
                  <DetailGrid
                    items={[
                      { label: 'Impressions', value: formatNumber(activeRow.raw.impressions) },
                      { label: 'Clicks', value: formatNumber(activeRow.raw.clicks) },
                      { label: 'Spend', value: formatCurrency(activeRow.raw.spend) },
                      { label: 'Orders', value: formatNumber(activeRow.raw.orders) },
                      { label: 'Sales', value: formatCurrency(activeRow.raw.sales) },
                      { label: 'ACoS', value: formatPercent(activeRow.raw.acos) },
                    ]}
                  />
                  <DetailGrid
                    items={[
                      {
                        label: 'Contribution after ads',
                        value: formatCurrency(activeRow.derived.contributionAfterAds),
                      },
                      { label: 'Break-even gap', value: formatPercent(activeRow.derived.breakEvenGap) },
                      {
                        label: 'Max CPC support gap',
                        value: formatPercent(activeRow.derived.maxCpcSupportGap),
                      },
                      { label: 'Profit dollars', value: formatCurrency(activeRow.derived.profitDollars) },
                      { label: 'Loss dollars', value: formatCurrency(activeRow.derived.lossDollars) },
                      {
                        label: 'Organic context signal',
                        value:
                          activeRow.derived.organicContextSignal === null
                            ? NOT_CAPTURED
                            : labelize(activeRow.derived.organicContextSignal),
                      },
                    ]}
                  />
                  <DetailGrid
                    items={[
                      { label: 'TOS IS', value: formatPercent(activeRow.raw.tosIs) },
                      { label: 'STIS', value: formatPercent(activeRow.raw.stis) },
                      {
                        label: 'STIR',
                        value:
                          activeRow.raw.stir === null ? NOT_CAPTURED : formatNumber(activeRow.raw.stir),
                      },
                      { label: 'CTR', value: formatPercent(activeRow.raw.ctr) },
                      { label: 'CVR', value: formatPercent(activeRow.raw.cvr) },
                      { label: 'ROAS', value: formatNumber(activeRow.raw.roas) },
                    ]}
                  />
                </div>
              );
            case 'advanced':
              return (
                <div className="space-y-4">
                  <TargetAdvancedSection label="Action plan">
                    <DetailGrid
                      items={[
                        {
                          label: 'Status',
                          value: labelize(activeRow.recommendation?.status ?? 'not_captured'),
                        },
                        {
                          label: 'Spend direction',
                          value: labelize(activeRow.recommendation?.spendDirection ?? null),
                        },
                        {
                          label: 'Primary action',
                          value: labelize(activeRow.recommendation?.primaryActionType ?? null),
                        },
                        {
                          label: 'Action count',
                          value: formatNumber(activeRow.recommendation?.actionCount ?? 0),
                        },
                      ]}
                    />
                  </TargetAdvancedSection>

                  {portfolioControls ? (
                    <TargetAdvancedSection label="Portfolio-cap pressure">
                      <DetailGrid
                        items={[
                          {
                            label: 'Discover rank',
                            value:
                              portfolioControls.discoverRank === null
                                ? NOT_CAPTURED
                                : `${formatNumber(portfolioControls.discoverRank)} of ${formatNumber(
                                    portfolioControls.activeDiscoverTargets
                                  )}`,
                          },
                          {
                            label: 'Learning budget',
                            value: `${formatCurrency(portfolioControls.learningBudgetUsed)} / ${formatCurrency(
                              portfolioControls.learningBudgetCap
                            )}`,
                          },
                          {
                            label: 'Stop-loss cap',
                            value: `${formatCurrency(portfolioControls.totalStopLossSpend)} / ${formatCurrency(
                              portfolioControls.totalStopLossCap
                            )}`,
                          },
                          {
                            label: 'Budget share',
                            value:
                              portfolioControls.targetSpendShare === null
                                ? NOT_CAPTURED
                                : `${formatPercent(portfolioControls.targetSpendShare)} / ${formatPercent(
                                    portfolioControls.maxBudgetSharePerTarget
                                  )}`,
                          },
                        ]}
                      />
                    </TargetAdvancedSection>
                  ) : null}

                  <TargetAdvancedSection label="Target state">
                    <DetailGrid
                      items={[
                        { label: 'Efficiency', value: activeRow.state.efficiency.label },
                        { label: 'Confidence', value: activeRow.state.confidence.label },
                        { label: 'Importance', value: activeRow.state.importance.label },
                        { label: 'Current role', value: activeRow.role.currentRole.label },
                        { label: 'Desired role', value: activeRow.role.desiredRole.label },
                        { label: 'Previous role', value: activeRow.role.previousRole ?? NOT_CAPTURED },
                      ]}
                    />
                  </TargetAdvancedSection>

                  {activeRow.roleHistory.length > 0 ? (
                    <TargetAdvancedSection label="Role history">
                      <div className="space-y-2 text-sm text-foreground">
                        {activeRow.roleHistory.slice(0, 6).map((entry) => (
                          <div
                            key={entry.roleTransitionLogId}
                            className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3"
                          >
                            Run {entry.runId} · rule {entry.transitionRule ?? NOT_CAPTURED} ·
                            desired {entry.desiredRole ?? NOT_CAPTURED}
                          </div>
                        ))}
                      </div>
                    </TargetAdvancedSection>
                  ) : null}

                  {targetComparisonChanges.length > 0 ? (
                    <TargetAdvancedSection label="Run comparison">
                      <div className="space-y-2">
                        {targetComparisonChanges.map((change, index) => (
                          <div
                            key={`${activeRow.targetSnapshotId}:comparison:${change.kind}:${index}`}
                            className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3 text-sm text-foreground"
                          >
                            <div className="font-semibold">{change.summary}</div>
                            <div className="mt-1 text-muted">{change.why}</div>
                          </div>
                        ))}
                      </div>
                    </TargetAdvancedSection>
                  ) : null}

                  {targetRollbackGuidance.length > 0 ? (
                    <TargetAdvancedSection label="Rollback guidance">
                      <div className="space-y-2">
                        {targetRollbackGuidance.map((entry, index) => (
                          <div
                            key={`${activeRow.targetSnapshotId}:rollback:${index}`}
                            className="rounded-lg border border-border/70 bg-surface-2 px-3 py-3 text-sm text-foreground"
                          >
                            <div className="font-semibold">{entry.title}</div>
                            <div className="mt-1 text-muted">{entry.detail}</div>
                          </div>
                        ))}
                      </div>
                    </TargetAdvancedSection>
                  ) : null}

                  <TargetAdvancedSection label="Supporting metrics JSON">
                    <JsonBlock value={activeRow.recommendation?.supportingMetrics ?? null} />
                  </TargetAdvancedSection>
                </div>
              );
          }
        };

        return (
          <TargetExpandedPanel
            key={activeRow.targetSnapshotId}
            targetSnapshotId={activeRow.targetSnapshotId}
            contextStrip={
              <div className="flex min-w-max items-center gap-2 whitespace-nowrap">
                <span
                  className={`inline-flex items-center rounded-full border px-[7px] py-[2px] text-[10px] font-medium ${rolePillClass(
                    activeRow.role.desiredRole.value ?? activeRow.role.currentRole.value
                  )}`}
                >
                  {activeRow.role.currentRole.label} → {activeRow.role.desiredRole.label}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-[7px] py-[2px] text-[10px] font-medium ${statePillClass(
                    'importance',
                    activeRow.state.importance.value
                  )}`}
                >
                  {importanceStripLabel}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-[7px] py-[2px] text-[10px] font-medium ${statePillClass(
                    'efficiency',
                    activeRow.state.efficiency.value
                  )}`}
                >
                  {activeRow.state.efficiency.label}
                </span>
                <span className="h-3 w-px shrink-0 bg-border" />
                <span className="text-[10px] text-muted">{contextFacts.join(' · ')}</span>
              </div>
            }
            tabStrip={
              <TargetExpandedTabs
                targetSnapshotId={activeRow.targetSnapshotId}
                activeKey={activeExpandedTab}
                onChange={setActiveExpandedTab}
              />
            }
          >
            {TARGET_EXPANDED_TAB_DEFINITIONS.map((tab) => {
              const isActive = tab.key === activeExpandedTab;

              return (
                <div
                  key={tab.key}
                  id={getTargetExpandedTabPanelId(activeRow.targetSnapshotId, tab.key)}
                  role="tabpanel"
                  aria-labelledby={getTargetExpandedTabId(activeRow.targetSnapshotId, tab.key)}
                  hidden={!isActive}
                  className={isActive ? 'h-full min-h-0' : 'hidden h-full min-h-0'}
                >
                  {renderExpandedPanel(tab.key)}
                </div>
              );
            })}
          </TargetExpandedPanel>
        );
      })()
    : null;

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
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Targets review</div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              Inline decision rows for the selected persisted optimizer run
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              Review the highest-priority targets inline, open the new tabbed detail surface for
              row-level context across Why flagged, Change plan, Search term, Placement, Metrics,
              and Advanced, keep manual override controls inside Change plan, and stage only
              supported changes into Ads Workspace after operator review. Ads Workspace remains
              the only staging and execution boundary.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ProductStateBadge state={props.productState} />
            <div className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
              SP only V1
            </div>
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
              Inline V2 review surface
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
              <div>Use the inline list to sort and filter targets by priority, role, state, and confidence.</div>
              <div>Coverage rolls up into Ready, Partial, and Missing. Missing can be normal for zero-click search-term diagnostics or suspicious when source data should exist.</div>
              <div>Non-additive diagnostics such as STIS, STIR, TOS IS, and rank are shown only as latest observed values or explicit trend descriptors.</div>
              <div>The expanded row is now a tabbed detail surface with dedicated tabs for Why flagged, Change plan, Search term, Placement, Metrics, and Advanced.</div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted">What to do next</div>
            <div className="mt-2 space-y-2 text-sm text-foreground">
              <div>Review row-specific exceptions and critical warnings first.</div>
              <div>Expand a row to inspect the tabbed detail surface, compare the recommendation plan, review search-term and placement evidence, inspect metrics, use manual override controls inside Change plan, and open the advanced diagnostics blocks.</div>
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
          value={formatNumber(effectiveRows.length)}
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
                    onClick={() => expandTargetRow(row.targetSnapshotId)}
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
                      const match = effectiveRows.find((row) => row.targetId === entry.targetId);
                      if (match) expandTargetRow(match.targetSnapshotId);
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
                  onClick={() => expandTargetRow(row.targetSnapshotId)}
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
                  onClick={() => expandTargetRow(row.targetSnapshotId)}
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

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Targets review</div>
            <div className="mt-2 text-sm text-muted">
              Review persisted optimizer target decisions inline. Expand a row to open the tabbed
              detail surface with Why flagged, Change plan, Search term, Placement, Metrics, and
              Advanced tabs populated from the persisted review data.
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
                triage aid, then expand the row for the Why flagged narrative and the persisted
                reason-code block behind those badges.
              </InlineHelp>
            </div>
          </div>
          <Link href={props.historyHref} className="text-sm font-semibold text-primary">
            Go to History
          </Link>
        </div>

        <div className="mt-4">
          <TargetsToolbar
            roleFilter={roleFilter}
            tierFilter={tierFilter}
            trendFilter={trendFilter}
            spendDirectionFilter={spendDirectionFilter}
            exceptionFilter={exceptionFilter}
            sortBy={sortBy}
            sortDirection={sortDirection}
            filteredRowCount={filteredRows.length}
            totalRowCount={effectiveRows.length}
            persistedRecommendationRows={persistedRecommendationRows}
            stageableRowCount={stageableRows.length}
            selectedCount={selectedForHandoff.length}
            selectedActionCount={selectedStageableActionCount}
            visibleStageableCount={visibleStageableRows.length}
            selectedTargetSnapshotIds={selectedForHandoff}
            allVisibleStageableSelected={allVisibleStageableSelected}
            frozenColumns={tableLayoutPrefs.frozenColumns}
            historyHref={props.historyHref}
            workspaceQueueHref={props.workspaceQueueHref}
            returnTo={props.returnTo}
            asin={props.asin}
            start={props.start}
            end={props.end}
            handoffAction={props.handoffAction}
            onRoleFilterChange={setRoleFilter}
            onTierFilterChange={setTierFilter}
            onTrendFilterChange={setTrendFilter}
            onSpendDirectionFilterChange={setSpendDirectionFilter}
            onExceptionFilterChange={setExceptionFilter}
            onSortByChange={handleSortByChange}
            onToggleSortDirection={toggleSortDirection}
            onToggleAllVisibleStageable={toggleAllVisibleStageable}
            onResetColumnWidths={handleResetColumnWidths}
            onToggleFrozenColumn={handleToggleFrozenColumn}
          />
        </div>

        <div
          className="mt-4 overflow-x-auto overflow-y-visible"
          data-aph-hscroll
          data-aph-hscroll-axis="x"
        >
          <table
            className="min-w-full table-fixed border-collapse text-left text-sm"
            style={{ width: `${tableWidthPx}px`, minWidth: '100%' }}
          >
            <colgroup>
              {ADS_OPTIMIZER_TARGET_TABLE_COLUMNS.map((column) => (
                <col key={column.key} style={columnWidthStyle(column.key)} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                {ADS_OPTIMIZER_TARGET_TABLE_COLUMNS.map((column) => {
                  const isTargetColumn = column.key === 'target';
                  return (
                    <th
                      key={column.key}
                      className={`relative overflow-hidden border-b border-border bg-surface py-2 font-semibold whitespace-nowrap ${
                        isTargetColumn ? `${targetHeaderClass} pl-4 pr-5` : 'px-3 pr-5'
                      }`}
                      style={headerCellStyle(column.key)}
                    >
                      {column.key === 'target' ? (
                        <div className="flex min-w-0 flex-col gap-1 pr-5">
                          <div className="truncate">{column.label}</div>
                          <input
                            type="search"
                            value={targetSearch}
                            onChange={(event) => setTargetSearch(event.target.value)}
                            placeholder="Search targets"
                            aria-label="Search target rows"
                            className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] font-medium normal-case tracking-normal text-foreground placeholder:text-muted"
                          />
                        </div>
                      ) : column.key === 'state' ? (
                        renderHeaderSortControls({
                          label: column.label,
                          options: STATE_HEADER_SORT_OPTIONS,
                          ariaLabel: 'Sort State column',
                        })
                      ) : column.key === 'economics' ? (
                        renderHeaderSortControls({
                          label: column.label,
                          options: ECONOMICS_HEADER_SORT_OPTIONS,
                          ariaLabel: 'Sort Economics column',
                        })
                      ) : column.key === 'contribution' ? (
                        renderHeaderSortControls({
                          label: column.label,
                          options: CONTRIBUTION_HEADER_SORT_OPTIONS,
                          ariaLabel: 'Sort Contribution column',
                        })
                      ) : column.key === 'ranking' ? (
                        renderHeaderSortControls({
                          label: column.label,
                          options: RANKING_HEADER_SORT_OPTIONS,
                          ariaLabel: 'Sort Ranking column',
                        })
                      ) : (
                        <div className="truncate pr-5">{column.label}</div>
                      )}
                      <button
                        type="button"
                        data-column-resize-handle={column.key}
                        className="group absolute inset-y-0 right-[-6px] z-40 flex w-3 cursor-col-resize touch-none select-none items-center justify-center bg-transparent p-0"
                        aria-label={`Resize ${column.label} column`}
                        title={`Resize ${column.label} column`}
                        onPointerDown={(event) =>
                          handleColumnResizePointerDown(column.key, event)
                        }
                      >
                        <span className="h-6 w-px rounded-full bg-border transition group-hover:bg-primary/60" />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredRowSummaries.length === 0 ? (
                <tr>
                  <td
                    colSpan={ADS_OPTIMIZER_TARGET_TABLE_COLUMNS.length}
                    className="px-4 py-6 text-sm"
                  >
                    <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-4">
                      <div className="font-semibold text-foreground">{emptyTableTitle}</div>
                      <div className="mt-1 text-sm text-muted">{emptyTableBody}</div>
                      {trimmedTargetSearch.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setTargetSearch('')}
                          className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground"
                        >
                          Clear search
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRowSummaries.map((summary) => {
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
                      columnWidths={tableLayoutPrefs.widths}
                      isTargetColumnFrozen={isTargetColumnFrozen}
                      expandedContent={
                        summary.targetSnapshotId === activeTargetSnapshotId
                          ? activeExpandedContent
                          : null
                      }
                      colSpan={7}
                      onSelect={() => toggleTargetRow(summary.targetSnapshotId)}
                      onToggleSelect={(checked) =>
                        toggleSelectedRow(summary.targetSnapshotId, checked)
                      }
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
