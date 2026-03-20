'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { buildAdsWorkspaceNavigationHref } from '@/lib/ads/adsWorkspaceNavigation';
import {
  buildAdsOptimizerSearchTermTableRows,
  buildAdsOptimizerSearchTermsEmptyState,
  type AdsOptimizerSearchTermMetricCell,
  type AdsOptimizerSearchTermTableRow,
} from '@/lib/ads-optimizer/targetDecisionSurface';
import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';

type TargetSearchTermTabProps = {
  row: AdsOptimizerTargetReviewRow;
  asin: string;
  start: string;
  end: string;
};

type SearchTermSortKey =
  | 'stis'
  | 'stir'
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'spend'
  | 'orders'
  | 'acos';

type SearchTermSortDirection = 'asc' | 'desc';
type SearchTermMetricKind = 'impressions' | 'clicks' | 'ctr' | 'spend' | 'orders' | 'acos';

const SORT_LABELS: Record<SearchTermSortKey, string> = {
  stis: 'stis',
  stir: 'stir',
  impressions: 'impressions',
  clicks: 'clicks',
  ctr: 'ctr',
  spend: 'spend',
  orders: 'orders',
  acos: 'acos',
};

const getSortValue = (row: AdsOptimizerSearchTermTableRow, key: SearchTermSortKey) => {
  switch (key) {
    case 'stis':
      return row.stis;
    case 'stir':
      return row.stir;
    case 'impressions':
      return row.impressions.current;
    case 'clicks':
      return row.clicks.current;
    case 'ctr':
      return row.ctr.current;
    case 'spend':
      return row.spend.current;
    case 'orders':
      return row.orders.current;
    case 'acos':
      return row.acos.current;
  }
};

const formatInteger = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const formatWholePercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(2)}%`;
};

const formatUsd = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatMetricCurrentOrPrevious = (
  kind: SearchTermMetricKind,
  value: number | null
): string => {
  if (kind === 'impressions' || kind === 'clicks' || kind === 'orders') {
    return formatInteger(value);
  }
  if (kind === 'ctr' || kind === 'acos') return formatPercent(value);
  return formatUsd(value);
};

const getRoundedChangeValue = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(1));
};

const formatChangePercent = (value: number | null) => {
  const rounded = getRoundedChangeValue(value);
  if (rounded === null) return '—';
  if (Object.is(rounded, -0) || rounded === 0) return '0.0%';
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
};

const getChangeToneClass = (kind: SearchTermMetricKind, value: number | null) => {
  const rounded = getRoundedChangeValue(value);
  if (rounded === null || rounded === 0) return 'text-muted';

  const positiveIsFavorable =
    kind === 'impressions' || kind === 'clicks' || kind === 'ctr' || kind === 'orders';
  const isPositive = rounded > 0;

  if ((positiveIsFavorable && isPositive) || (!positiveIsFavorable && !isPositive)) {
    return 'text-emerald-700';
  }
  return 'text-rose-700';
};

const renderMetricLines = (args: {
  kind: SearchTermMetricKind;
  metric: AdsOptimizerSearchTermMetricCell;
}) => {
  const previousLabel = args.metric.isNew
    ? '—'
    : formatMetricCurrentOrPrevious(args.kind, args.metric.previous);
  const changeLabel = args.metric.isNew ? 'new' : formatChangePercent(args.metric.changePercent);
  const changeClass = args.metric.isNew
    ? 'text-muted italic'
    : args.metric.changePercent === null
      ? 'text-muted'
      : getChangeToneClass(args.kind, args.metric.changePercent);

  return (
    <>
      <div className="metric-current text-[13px] font-medium text-foreground">
        {formatMetricCurrentOrPrevious(args.kind, args.metric.current)}
      </div>
      <div className="metric-prev text-[11px] text-muted">{previousLabel}</div>
      <div className={`metric-change text-[11px] ${changeClass}`}>{changeLabel}</div>
    </>
  );
};

const renderEvidenceBadge = (row: AdsOptimizerSearchTermTableRow) => {
  if (row.primaryEvidence === null) return null;

  const badgeProps =
    row.primaryEvidence === 'same'
      ? {
          label: 'Same',
          className: 'bg-surface-2 text-foreground/80',
        }
      : row.primaryEvidence === 'winning'
        ? {
            label: 'Winning',
            className: 'bg-[#EAF3DE] text-[#3B6D11]',
          }
        : {
            label: 'Losing',
            className: 'bg-[#FCEBEB] text-[#A32D2D]',
          };

  return (
    <>
      <span
        className={`inline-block rounded-[4px] px-2 py-[2px] text-[10px] font-medium ${badgeProps.className}`}
      >
        {badgeProps.label}
      </span>
      {row.actionHint ? (
        <span className="mt-[3px] block text-[10px] text-primary">
          {row.actionHint === 'isolate' ? 'Isolate →' : 'Negate →'}
        </span>
      ) : null}
    </>
  );
};

export default function TargetSearchTermTab(props: TargetSearchTermTabProps) {
  const [showPreviousAndChange, setShowPreviousAndChange] = useState(true);
  const [sortKey, setSortKey] = useState<SearchTermSortKey>('impressions');
  const [sortDirection, setSortDirection] = useState<SearchTermSortDirection>('desc');

  const tableRows = useMemo(() => buildAdsOptimizerSearchTermTableRows(props.row), [props.row]);
  const emptyState = useMemo(() => buildAdsOptimizerSearchTermsEmptyState(props.row), [props.row]);

  const sortedRows = useMemo(() => {
    return [...tableRows].sort((left, right) => {
      const leftValue = getSortValue(left, sortKey);
      const rightValue = getSortValue(right, sortKey);
      const leftMissing = leftValue === null || !Number.isFinite(leftValue);
      const rightMissing = rightValue === null || !Number.isFinite(rightValue);

      if (leftMissing && rightMissing) {
        return left.searchTerm.localeCompare(right.searchTerm, 'en-US');
      }
      if (leftMissing) return 1;
      if (rightMissing) return -1;

      const delta =
        sortDirection === 'desc'
          ? (rightValue as number) - (leftValue as number)
          : (leftValue as number) - (rightValue as number);

      if (delta !== 0) return delta;
      return left.searchTerm.localeCompare(right.searchTerm, 'en-US');
    });
  }, [sortDirection, sortKey, tableRows]);

  const summaryCounts = useMemo(
    () => ({
      total: tableRows.length,
      winning: tableRows.filter((row) => row.primaryEvidence === 'winning').length,
      losing: tableRows.filter((row) => row.primaryEvidence === 'losing').length,
      same: tableRows.filter((row) => row.primaryEvidence === 'same').length,
    }),
    [tableRows]
  );

  const trendHref = useMemo(() => {
    const search = new URLSearchParams({
      channel: 'sp',
      start: props.start,
      end: props.end,
      asin: props.asin,
    }).toString();

    return buildAdsWorkspaceNavigationHref({
      pathname: '/ads/performance',
      search,
      level: 'targets',
      view: 'trend',
      trendEntityId: props.row.targetId,
      scope: {
        campaignScopeId: props.row.campaignId,
        campaignScopeLabel: props.row.campaignName,
        adGroupScopeId: props.row.adGroupId,
        adGroupScopeLabel: props.row.adGroupName,
      },
    });
  }, [
    props.asin,
    props.end,
    props.row.adGroupId,
    props.row.adGroupName,
    props.row.campaignId,
    props.row.campaignName,
    props.row.targetId,
    props.start,
  ]);

  const handleSortChange = (nextKey: SearchTermSortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection('desc');
  };

  const renderSortableHeader = (label: string, key: SearchTermSortKey) => {
    const isActive = sortKey === key;

    return (
      <button
        type="button"
        onClick={() => handleSortChange(key)}
        className="inline-flex w-full cursor-pointer items-center justify-end text-right"
      >
        <span>{label}</span>
        {isActive ? <span className="ml-[2px]">{sortDirection === 'desc' ? '▼' : '▲'}</span> : null}
      </button>
    );
  };

  return (
    <div
      data-ads-optimizer-search-term-tab="true"
      className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]"
    >
      <div className="mb-[10px] flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[10px] text-muted">
          <span>Top = current · Middle = previous · Bottom = change %</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-[5px]">
            <span className="h-[6px] w-[6px] rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Favorable</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-[5px]">
            <span className="h-[6px] w-[6px] rounded-full bg-rose-500" aria-hidden="true" />
            <span>Unfavorable</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-[6px]">
            <button
              type="button"
              role="switch"
              aria-checked={showPreviousAndChange}
              aria-label="Previous & change"
              onClick={() => setShowPreviousAndChange((current) => !current)}
              className={`relative h-4 w-[30px] rounded-full transition-colors duration-200 ${
                showPreviousAndChange ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`absolute top-[2px] left-[2px] h-3 w-3 rounded-full bg-white transition-transform duration-200 ${
                  showPreviousAndChange ? 'translate-x-[14px]' : ''
                }`}
              />
            </button>
            <span
              className={`text-[11px] transition-colors duration-150 ${
                showPreviousAndChange ? 'text-primary' : 'text-muted'
              }`}
            >
              Previous &amp; change
            </span>
          </div>

          <Link
            href={trendHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-[5px] rounded-[6px] border-[0.5px] border-border bg-transparent px-[10px] py-1 text-[11px] font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="2 12 5.5 7 9 9.5 14 3" />
              <polyline points="10.5 3 14 3 14 6.5" />
            </svg>
            <span>Trend</span>
          </Link>
        </div>
      </div>

      <div
        data-show-previous-change={showPreviousAndChange ? 'true' : 'false'}
        data-aph-hscroll
        data-aph-hscroll-axis="x"
        className="min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-border/70 bg-surface"
      >
        {sortedRows.length > 0 ? (
          <table className="min-w-[1095px] w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: '280px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '95px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '90px' }} />
            </colgroup>
            <thead className="sticky top-0 z-[1]">
              <tr>
                <th className="border-b-[0.5px] border-border/70 bg-surface px-2 py-[6px] text-left text-[10px] font-medium uppercase tracking-[0.3px] text-muted">
                  Search term
                </th>
                <th className="border-b-[0.5px] border-border/70 bg-surface px-2 py-[6px] text-left text-[10px] font-medium uppercase tracking-[0.3px] text-muted">
                  Evidence
                </th>
                <th className="border-b-[0.5px] border-border/70 bg-surface px-2 py-[6px] text-right text-[10px] font-medium uppercase tracking-[0.3px] text-muted">
                  {renderSortableHeader('STIS', 'stis')}
                </th>
                <th className="border-b-[0.5px] border-border/70 bg-surface px-2 py-[6px] text-right text-[10px] font-medium uppercase tracking-[0.3px] text-muted">
                  {renderSortableHeader('STIR', 'stir')}
                </th>
                <th className="border-b-[0.5px] border-border/70 bg-surface px-2 py-[6px] text-right text-[10px] font-medium uppercase tracking-[0.3px] text-muted">
                  {renderSortableHeader('Impr.', 'impressions')}
                </th>
                <th className="border-b-[0.5px] border-border/70 bg-surface px-2 py-[6px] text-right text-[10px] font-medium uppercase tracking-[0.3px] text-muted">
                  {renderSortableHeader('Clicks', 'clicks')}
                </th>
                <th className="border-b-[0.5px] border-border/70 bg-surface px-2 py-[6px] text-right text-[10px] font-medium uppercase tracking-[0.3px] text-muted">
                  {renderSortableHeader('CTR', 'ctr')}
                </th>
                <th className="border-b-[0.5px] border-border/70 bg-surface px-2 py-[6px] text-right text-[10px] font-medium uppercase tracking-[0.3px] text-muted">
                  {renderSortableHeader('Spend', 'spend')}
                </th>
                <th className="border-b-[0.5px] border-border/70 bg-surface px-2 py-[6px] text-right text-[10px] font-medium uppercase tracking-[0.3px] text-muted">
                  {renderSortableHeader('Orders', 'orders')}
                </th>
                <th className="border-b-[0.5px] border-border/70 bg-surface px-2 py-[6px] text-right text-[10px] font-medium uppercase tracking-[0.3px] text-muted">
                  {renderSortableHeader('ACOS', 'acos')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, index) => (
                <tr
                  key={`${props.row.targetSnapshotId}:${row.searchTerm}:${row.sameText}`}
                  className={index === sortedRows.length - 1 ? '' : 'border-b-[0.5px] border-border/70'}
                >
                  <td className="px-2 py-[10px] align-top">
                    <div className="text-[13px] font-medium text-foreground">{row.searchTerm}</div>
                  </td>
                  <td className="px-2 py-[10px] align-top">{renderEvidenceBadge(row)}</td>
                  <td className="px-2 py-[10px] text-right align-top">
                    <div className="text-[13px] font-medium text-foreground">
                      {formatWholePercent(row.stis)}
                    </div>
                  </td>
                  <td className="px-2 py-[10px] text-right align-top">
                    <div className="text-[13px] font-medium text-foreground">
                      {formatInteger(row.stir)}
                    </div>
                  </td>
                  <td className="px-2 py-[10px] text-right align-top">
                    {renderMetricLines({ kind: 'impressions', metric: row.impressions })}
                  </td>
                  <td className="px-2 py-[10px] text-right align-top">
                    {renderMetricLines({ kind: 'clicks', metric: row.clicks })}
                  </td>
                  <td className="px-2 py-[10px] text-right align-top">
                    {renderMetricLines({ kind: 'ctr', metric: row.ctr })}
                  </td>
                  <td className="px-2 py-[10px] text-right align-top">
                    {renderMetricLines({ kind: 'spend', metric: row.spend })}
                  </td>
                  <td className="px-2 py-[10px] text-right align-top">
                    {renderMetricLines({ kind: 'orders', metric: row.orders })}
                  </td>
                  <td className="px-2 py-[10px] text-right align-top">
                    {renderMetricLines({ kind: 'acos', metric: row.acos })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="m-3 rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted">
            {emptyState}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 text-[11px] text-muted">
        <div>
          {summaryCounts.total} search terms · {summaryCounts.winning} winning ·{' '}
          {summaryCounts.losing} losing · {summaryCounts.same} same
        </div>
        <div>
          Sorted by {SORT_LABELS[sortKey]} ({sortDirection})
        </div>
      </div>

      <style>{`
        [data-ads-optimizer-search-term-tab='true'] [data-show-previous-change='true'] .metric-prev,
        [data-ads-optimizer-search-term-tab='true'] [data-show-previous-change='true'] .metric-change {
          opacity: 1;
          max-height: 1.5rem;
        }

        [data-ads-optimizer-search-term-tab='true'] [data-show-previous-change='true'] .metric-prev {
          margin-top: 2px;
        }

        [data-ads-optimizer-search-term-tab='true'] [data-show-previous-change='true'] .metric-change {
          margin-top: 1px;
        }

        [data-ads-optimizer-search-term-tab='true'] .metric-prev,
        [data-ads-optimizer-search-term-tab='true'] .metric-change {
          overflow: hidden;
          opacity: 0;
          max-height: 0;
          margin-top: 0;
          transition:
            opacity 0.15s ease,
            max-height 0.2s ease,
            margin-top 0.2s ease;
        }
      `}</style>
    </div>
  );
}
