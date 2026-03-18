'use client';

import { useState } from 'react';
import Link from 'next/link';

import {
  type AdsOptimizerTargetTableColumnKey,
} from '@/lib/ads-optimizer/targetTableLayoutPrefs';
import type {
  AdsOptimizerTargetExceptionFilterValue,
  AdsOptimizerTargetFilterValue,
  AdsOptimizerTargetTableSort,
  AdsOptimizerTargetTableSortDirection,
} from '@/lib/ads-optimizer/targetRowTableSummary';

const SORT_OPTION_GROUPS: Array<{
  label: string;
  options: Array<{ value: AdsOptimizerTargetTableSort; label: string }>;
}> = [
  {
    label: 'Overview',
    options: [
      { value: 'priority', label: 'Priority' },
      { value: 'target', label: 'Target' },
      { value: 'recommendations', label: 'Change plan' },
      { value: 'workspace_actions', label: 'Workspace actions' },
      { value: 'efficiency', label: 'Efficiency' },
      { value: 'exceptions', label: 'Exceptions' },
    ],
  },
  {
    label: 'State',
    options: [
      { value: 'state_current_profit_loss', label: 'P&L (current)' },
      { value: 'state_current_acos', label: 'ACoS (current)' },
    ],
  },
  {
    label: 'Economics',
    options: [
      { value: 'economics_current_spend', label: 'Spend (current)' },
      { value: 'economics_current_sales', label: 'Sales (current)' },
      { value: 'economics_current_orders', label: 'Orders (current)' },
    ],
  },
  {
    label: 'Contribution',
    options: [
      { value: 'contribution_sales_rank', label: 'Sales rank' },
      { value: 'contribution_spend_rank', label: 'Spend rank' },
      { value: 'contribution_impression_rank', label: 'Impression rank' },
    ],
  },
  {
    label: 'Ranking',
    options: [
      { value: 'ranking_organic_latest', label: 'Organic rank' },
      { value: 'ranking_organic_trend', label: 'Organic trend' },
    ],
  },
];

const formatNumber = (value: number) =>
  value.toLocaleString('en-US', { maximumFractionDigits: 0 });

type TargetsToolbarProps = {
  roleFilter: AdsOptimizerTargetFilterValue;
  tierFilter: AdsOptimizerTargetFilterValue;
  trendFilter: AdsOptimizerTargetFilterValue;
  spendDirectionFilter: AdsOptimizerTargetFilterValue;
  exceptionFilter: AdsOptimizerTargetExceptionFilterValue;
  sortBy: AdsOptimizerTargetTableSort;
  sortDirection: AdsOptimizerTargetTableSortDirection;
  filteredRowCount: number;
  totalRowCount: number;
  persistedRecommendationRows: number;
  stageableRowCount: number;
  selectedCount: number;
  selectedActionCount: number;
  visibleStageableCount: number;
  selectedTargetSnapshotIds: string[];
  allVisibleStageableSelected: boolean;
  frozenColumns: AdsOptimizerTargetTableColumnKey[];
  historyHref: string;
  workspaceQueueHref: string;
  returnTo: string;
  asin: string;
  start: string;
  end: string;
  handoffAction: (formData: FormData) => Promise<void>;
  onRoleFilterChange: (value: AdsOptimizerTargetFilterValue) => void;
  onTierFilterChange: (value: AdsOptimizerTargetFilterValue) => void;
  onTrendFilterChange: (value: AdsOptimizerTargetFilterValue) => void;
  onSpendDirectionFilterChange: (value: AdsOptimizerTargetFilterValue) => void;
  onExceptionFilterChange: (value: AdsOptimizerTargetExceptionFilterValue) => void;
  onSortByChange: (value: AdsOptimizerTargetTableSort) => void;
  onToggleSortDirection: () => void;
  onToggleAllVisibleStageable: (checked: boolean) => void;
  onResetColumnWidths: () => void;
  onToggleFrozenColumn: (key: AdsOptimizerTargetTableColumnKey) => void;
};

export default function TargetsToolbar(props: TargetsToolbarProps) {
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const targetFrozen = props.frozenColumns.includes('target');

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
          Trend state
          <select
            value={props.trendFilter}
            onChange={(event) => props.onTrendFilterChange(event.target.value)}
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All trend states</option>
            <option value="same_text_visibility_context">Same-text visibility</option>
            <option value="search_term_visibility_context">Search-term visibility</option>
            <option value="top_of_search_visibility_context">Top-of-search visibility</option>
            <option value="missing">Unavailable</option>
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

      <div className="mt-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              Sort by
              <select
                value={props.sortBy}
                onChange={(event) =>
                  props.onSortByChange(event.target.value as AdsOptimizerTargetTableSort)
                }
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              >
                {SORT_OPTION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-foreground"
              onClick={props.onToggleSortDirection}
            >
              {props.sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            </button>
            <button
              type="button"
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-foreground"
              aria-expanded={showColumnMenu}
              aria-controls="targets-adjust-columns-panel"
              onClick={() => setShowColumnMenu((current) => !current)}
            >
              Adjust columns
            </button>
          </div>
          <div className="text-sm text-muted xl:text-right">
            Showing {formatNumber(props.filteredRowCount)} of {formatNumber(props.totalRowCount)}{' '}
            persisted target rows. {formatNumber(props.persistedRecommendationRows)} recommendation
            snapshots were loaded from the exact run, and {formatNumber(props.stageableRowCount)}{' '}
            row(s) currently contain Ads Workspace-supported actions.
          </div>
        </div>
        {showColumnMenu ? (
          <div
            id="targets-adjust-columns-panel"
            className="mt-4 rounded-xl border border-border/70 bg-surface-2 px-4 py-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                  Collapsed table options
                </div>
                <div className="mt-1 text-sm text-muted">
                  Drag header borders to resize columns. Saved widths become this
                  browser&apos;s default for the collapsed table.
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-xs text-muted">
                Resize is available on every collapsed-table header: Target, State, Economics,
                Contribution, Ranking, Role, and Change summary.
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground"
                  onClick={props.onResetColumnWidths}
                >
                  Reset widths
                </button>
                <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={targetFrozen}
                    onChange={() => props.onToggleFrozenColumn('target')}
                    aria-label="Freeze Target column"
                    className="h-4 w-4"
                  />
                  <span className="font-semibold">Freeze Target column</span>
                </label>
              </div>
            </div>
          </div>
        ) : null}
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
              Open Ads Workspace
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
