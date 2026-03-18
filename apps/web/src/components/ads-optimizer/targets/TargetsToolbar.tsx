'use client';

import Link from 'next/link';

import type {
  AdsOptimizerTargetExceptionFilterValue,
  AdsOptimizerTargetFilterValue,
  AdsOptimizerTargetQueueSort,
  AdsOptimizerTargetQueueSortDirection,
} from '@/lib/ads-optimizer/targetRowSummary';

const labelize = (value: string | null) =>
  value
    ? value
        .split(/[_\s]+/)
        .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
        .join(' ')
    : 'Not captured';

const formatNumber = (value: number) =>
  value.toLocaleString('en-US', { maximumFractionDigits: 0 });

type TargetsToolbarProps = {
  roleFilter: AdsOptimizerTargetFilterValue;
  efficiencyFilter: AdsOptimizerTargetFilterValue;
  tierFilter: AdsOptimizerTargetFilterValue;
  confidenceFilter: AdsOptimizerTargetFilterValue;
  spendDirectionFilter: AdsOptimizerTargetFilterValue;
  exceptionFilter: AdsOptimizerTargetExceptionFilterValue;
  sortBy: AdsOptimizerTargetQueueSort;
  sortDirection: AdsOptimizerTargetQueueSortDirection;
  filteredRowCount: number;
  totalRowCount: number;
  persistedRecommendationRows: number;
  stageableRowCount: number;
  selectedCount: number;
  selectedActionCount: number;
  visibleStageableCount: number;
  selectedTargetSnapshotIds: string[];
  allVisibleStageableSelected: boolean;
  historyHref: string;
  workspaceQueueHref: string;
  returnTo: string;
  asin: string;
  start: string;
  end: string;
  handoffAction: (formData: FormData) => Promise<void>;
  onRoleFilterChange: (value: AdsOptimizerTargetFilterValue) => void;
  onEfficiencyFilterChange: (value: AdsOptimizerTargetFilterValue) => void;
  onTierFilterChange: (value: AdsOptimizerTargetFilterValue) => void;
  onConfidenceFilterChange: (value: AdsOptimizerTargetFilterValue) => void;
  onSpendDirectionFilterChange: (value: AdsOptimizerTargetFilterValue) => void;
  onExceptionFilterChange: (value: AdsOptimizerTargetExceptionFilterValue) => void;
  onToggleAllVisibleStageable: (checked: boolean) => void;
};

export default function TargetsToolbar(props: TargetsToolbarProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
          Role
          <select
            value={props.roleFilter}
            onChange={(event) => props.onRoleFilterChange(event.target.value)}
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
          Efficiency
          <select
            value={props.efficiencyFilter}
            onChange={(event) => props.onEfficiencyFilterChange(event.target.value)}
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All efficiency</option>
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
            value={props.tierFilter}
            onChange={(event) => props.onTierFilterChange(event.target.value)}
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
            value={props.confidenceFilter}
            onChange={(event) => props.onConfidenceFilterChange(event.target.value)}
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All confidence</option>
            <option value="confirmed">Confirmed</option>
            <option value="directional">Directional</option>
            <option value="insufficient">Insufficient</option>
          </select>
        </label>

        <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
          Spend direction
          <select
            value={props.spendDirectionFilter}
            onChange={(event) => props.onSpendDirectionFilterChange(event.target.value)}
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All spend directions</option>
            <option value="increase">Increase</option>
            <option value="hold">Hold</option>
            <option value="reduce">Reduce</option>
            <option value="collapse">Collapse</option>
            <option value="stop">Stop</option>
          </select>
        </label>

        <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
          Exceptions
          <select
            value={props.exceptionFilter}
            onChange={(event) =>
              props.onExceptionFilterChange(
                event.target.value as AdsOptimizerTargetExceptionFilterValue
              )
            }
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All exception states</option>
            <option value="has_exception">Has exception</option>
            <option value="high_severity">High severity</option>
            <option value="manual_review_required">Manual review required</option>
          </select>
        </label>
      </div>

      <div className="mt-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-muted">
        Active sort: <span className="font-semibold text-foreground">{labelize(props.sortBy)}</span>{' '}
        <span className="font-semibold text-foreground">
          {props.sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-muted">
        Showing {formatNumber(props.filteredRowCount)} of {formatNumber(props.totalRowCount)}{' '}
        persisted target rows. {formatNumber(props.persistedRecommendationRows)} recommendation
        snapshots were loaded from the exact run, and {formatNumber(props.stageableRowCount)} row(s)
        currently contain Ads Workspace-supported actions.
      </div>

      <div className="mt-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <button
            type="button"
            disabled={props.visibleStageableCount === 0}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => props.onToggleAllVisibleStageable(!props.allVisibleStageableSelected)}
          >
            {props.allVisibleStageableSelected ? 'Clear visible selection' : 'Select visible stageable'}
          </button>
          <div className="text-sm text-muted xl:text-center">
            {formatNumber(props.selectedCount)} selected row(s) ·{' '}
            {formatNumber(props.selectedActionCount)} supported staged action(s)
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <form action={props.handoffAction}>
              <input type="hidden" name="return_to" value={props.returnTo} />
              <input type="hidden" name="workspace_return_to" value={props.workspaceQueueHref} />
              <input type="hidden" name="asin" value={props.asin} />
              <input type="hidden" name="start" value={props.start} />
              <input type="hidden" name="end" value={props.end} />
              {props.selectedTargetSnapshotIds.map((targetSnapshotId) => (
                <input
                  key={`selected-${targetSnapshotId}`}
                  type="hidden"
                  name="target_snapshot_id"
                  value={targetSnapshotId}
                />
              ))}
              <button
                type="submit"
                disabled={props.selectedTargetSnapshotIds.length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Handoff selected to Ads Workspace
              </button>
            </form>
            <Link
              href={props.workspaceQueueHref}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-foreground"
            >
              Open Queue Review
            </Link>
            <Link href={props.historyHref} className="rounded-lg px-3 py-2 text-sm font-semibold text-primary">
              Go to History
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
