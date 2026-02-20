'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import InlineFilters from '@/components/InlineFilters';
import SqpTrendInspector from '@/components/sqp/SqpTrendInspector';
import type { KeywordGroupSummaryResult } from '@/lib/products/getProductKeywordGroups';
import type { ProductKeywordGroupMemberships } from '@/lib/products/getProductKeywordGroupMemberships';
import { compareNullableNumber } from '@/lib/ranking/compareNullableNumber';
import { enrichSqpRow } from '@/lib/sqp/enrichSqpRow';
import { formatSqpWeekLabel } from '@/lib/sqp/formatSqpWeekLabel';
import { coerceFloat, coerceInt } from '@/lib/sqp/normalizeSqpValue';
import type {
  SqpKnownKeywordRow,
  SqpWeek,
} from '@/lib/sqp/getProductSqpWeekly';
import type { SqpTrendRow } from '@/lib/sqp/getProductSqpTrendSeries';
import { ALL_COLUMNS, IMPORTANT_COLUMNS } from '@/lib/sqp/sqpColumns';

const formatNumber = (value?: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
};

const formatPercent = (value?: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatMoney = (value?: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
};

const formatIndex = (value?: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}x`;
};

const formatText = (value?: string | null): string => {
  if (!value) return '—';
  return value;
};

const toNumber = (value: unknown): number | null => coerceFloat(value);

const toInt = (value: unknown): number | null => coerceInt(value);

type ProductSqpTableProps = {
  availableWeeks: SqpWeek[];
  selectedWeekEnd: string | null;
  rows: SqpKnownKeywordRow[];
  keywordGroups: KeywordGroupSummaryResult | null;
  keywordGroupMemberships: ProductKeywordGroupMemberships | null;
  trendKey?: string | null;
  trendMetrics?: string[] | null;
  trendFrom?: string | null;
  trendTo?: string | null;
  trendAvailableWeeks?: SqpWeek[] | null;
  trendSeries?: SqpTrendRow[] | null;
  trendQueryLabel?: string | null;
};

export default function ProductSqpTable({
  availableWeeks,
  selectedWeekEnd,
  rows,
  keywordGroups,
  keywordGroupMemberships,
  trendKey,
  trendMetrics,
  trendFrom,
  trendTo,
  trendAvailableWeeks,
  trendSeries,
  trendQueryLabel,
}: ProductSqpTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [columnsMode, setColumnsMode] = useState<'important' | 'all'>('important');
  const [setScope, setSetScope] = useState<string>(
    keywordGroups?.active_set?.group_set_id ?? 'all'
  );
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [keywordSearch, setKeywordSearch] = useState<string>('');
  const [sortKey, setSortKey] = useState<string>('search_query_volume');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const groupOptions = useMemo(() => {
    if (setScope === 'all') return [];
    const groupsFromMemberships = keywordGroupMemberships?.groupsBySet?.[setScope];
    if (groupsFromMemberships && groupsFromMemberships.length > 0) {
      return [...groupsFromMemberships].sort((a, b) =>
        a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
      );
    }
    const fallback =
      keywordGroups?.group_sets.find((set) => set.group_set_id === setScope)?.groups ??
      [];
    return [...fallback].sort((a, b) =>
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
    );
  }, [keywordGroups, keywordGroupMemberships, setScope]);

  const safeGroupFilter = useMemo(() => {
    if (setScope === 'all') return 'all';
    if (groupFilter === 'all') return 'all';
    const exists = groupOptions.some((group) => group.group_id === groupFilter);
    return exists ? groupFilter : 'all';
  }, [groupFilter, groupOptions, setScope]);

  const membershipMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (setScope === 'all') return map;
    const memberships = keywordGroupMemberships?.memberships ?? [];
    memberships.forEach((row) => {
      if (row.group_set_id !== setScope) return;
      const existing = map.get(row.keyword_id) ?? [];
      existing.push(row.group_id);
      map.set(row.keyword_id, existing);
    });
    return map;
  }, [keywordGroupMemberships, setScope]);

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    groupOptions.forEach((group) => {
      map.set(group.group_id, group.name);
    });
    return map;
  }, [groupOptions]);

  const enrichedRows = useMemo(() => rows.map((row) => enrichSqpRow(row)), [rows]);

  const filteredRows = useMemo(() => {
    let nextRows = enrichedRows;

    if (setScope !== 'all') {
      nextRows = nextRows.filter(
        (row) => row.keyword_id && membershipMap.has(row.keyword_id)
      );
    }

    if (setScope !== 'all' && safeGroupFilter !== 'all') {
      nextRows = nextRows.filter((row) => {
        if (!row.keyword_id) return false;
        const groups = membershipMap.get(row.keyword_id) ?? [];
        return groups.includes(safeGroupFilter);
      });
    }

    const query = keywordSearch.trim().toLowerCase();
    if (query) {
      nextRows = nextRows.filter((row) => {
        const raw = (row.search_query_raw ?? '').toLowerCase();
        const norm = (row.search_query_norm ?? '').toLowerCase();
        return raw.includes(query) || norm.includes(query);
      });
    }

    return nextRows;
  }, [enrichedRows, keywordSearch, membershipMap, safeGroupFilter, setScope]);

  const sortedRows = useMemo(() => {
    const rowsCopy = [...filteredRows];
    if (!sortKey) return rowsCopy;
    rowsCopy.sort((a, b) =>
      compareNullableNumber(
        toNumber(a[sortKey as keyof typeof a]),
        toNumber(b[sortKey as keyof typeof b]),
        sortDir
      )
    );
    return rowsCopy;
  }, [filteredRows, sortDir, sortKey]);

  const columns = useMemo(() => {
    const base = columnsMode === 'all' ? ALL_COLUMNS : IMPORTANT_COLUMNS;
    const queryIndex = base.findIndex((column) => column.key === 'search_query_raw');
    if (queryIndex <= 0) return base;
    return [base[queryIndex], ...base.slice(0, queryIndex), ...base.slice(queryIndex + 1)];
  }, [columnsMode]);

  const handleParamChange = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString());
      params.set('tab', 'sqp');
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const replaceParamChange = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString());
      params.set('tab', 'sqp');
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      router.replace(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const showGroupColumn = setScope !== 'all';

  const columnStyles: CSSProperties = {
    '--query-col-w': '260px',
    '--group-col-w': showGroupColumn ? '200px' : '0px',
    '--trend-col-w': '110px',
  } as CSSProperties;

  const queryColumn = columns.find((column) => column.key === 'search_query_raw');
  const dataColumns = columns.filter((column) => column.key !== 'search_query_raw');
  const selectedWeek = useMemo(
    () => availableWeeks.find((week) => week.week_end === selectedWeekEnd) ?? null,
    [availableWeeks, selectedWeekEnd]
  );
  const activeTrendFrom = trendFrom ?? null;
  const activeTrendTo = trendTo ?? null;
  const activeTrendMetrics =
    trendMetrics && trendMetrics.length > 0 ? trendMetrics : ['search_query_volume'];
  const activeTrendKey = trendKey ?? null;
  const activeTrendSeries = trendSeries ?? null;
  const activeTrendLabel = trendQueryLabel ?? trendKey ?? 'Selected query';
  const trendWeeks = trendAvailableWeeks?.length ? trendAvailableWeeks : availableWeeks;

  const openTrend = (queryNorm: string | null) => {
    if (!queryNorm) return;
    handleParamChange({
      sqp_trend: '1',
      sqp_trend_query: queryNorm,
      sqp_trend_kpis: activeTrendMetrics.join(','),
      sqp_trend_from: null,
      sqp_trend_to: null,
    });
  };

  useEffect(() => {
    const weekParam = searchParams?.get('sqp_week_end');
    if (!weekParam && selectedWeekEnd === null) return;
    if (weekParam && selectedWeekEnd && weekParam !== selectedWeekEnd) {
      replaceParamChange({ sqp_week_end: null });
    } else if (weekParam && selectedWeekEnd === null) {
      replaceParamChange({ sqp_week_end: null });
    }
  }, [replaceParamChange, searchParams, selectedWeekEnd]);


  return (
    <div className="space-y-6">
      <InlineFilters>
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted">SQP</div>
          <div className="mt-2 text-lg font-semibold text-foreground">
            {selectedWeekEnd
              ? `Week ending: ${formatSqpWeekLabel(selectedWeekEnd)}`
              : 'No weeks available'}
          </div>
          <div className="mt-1 text-xs text-muted">
            {selectedWeekEnd
              ? `${selectedWeek?.week_start ?? '—'} → ${selectedWeekEnd}`
              : 'No weeks available'}{' '}
            · {sortedRows.length} rows
          </div>
          <div className="mt-2 text-xs text-muted">
            SQP is weekly — pick a week ending in the filters.
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
            Week ending
            <select
              value={selectedWeekEnd ?? ''}
              onChange={(event) =>
                handleParamChange({
                  sqp_week_end: event.target.value || null,
                })
              }
              disabled={availableWeeks.length === 0}
              className="mt-1 min-w-[160px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-60"
            >
              {availableWeeks.length === 0 ? (
                <option value="">No weeks available</option>
              ) : null}
              {availableWeeks.map((week) => (
                <option
                  key={week.week_end}
                  value={week.week_end}
                  title={`${week.week_start} → ${week.week_end}`}
                >
                  {formatSqpWeekLabel(week.week_end)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
            Columns
            <div className="mt-1 inline-flex rounded-lg border border-border bg-surface p-1">
              {(
                [
                  { value: 'important', label: 'Important' },
                  { value: 'all', label: 'All' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColumnsMode(option.value)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    columnsMode === option.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-surface-2'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </label>
          <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
            Keyword set
            <select
              value={setScope}
              onChange={(event) => {
                setSetScope(event.target.value);
                setGroupFilter('all');
              }}
              className="mt-1 min-w-[200px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All tracked keywords</option>
              {(keywordGroups?.group_sets ?? []).map((set) => (
                <option key={set.group_set_id} value={set.group_set_id}>
                  {set.name}
                  {set.is_active ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </label>
          {showGroupColumn ? (
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              Group
              <select
                value={safeGroupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
                className="mt-1 min-w-[160px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              >
                <option value="all">All groups</option>
                {groupOptions.map((group) => (
                  <option key={group.group_id} value={group.group_id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
            Search
            <input
              value={keywordSearch}
              onChange={(event) => setKeywordSearch(event.target.value)}
              placeholder="Contains"
              className="mt-1 w-[180px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>
      </InlineFilters>

      {activeTrendKey && activeTrendFrom && activeTrendTo && activeTrendSeries ? (
        <SqpTrendInspector
          availableWeeks={trendWeeks}
          selectedFrom={activeTrendFrom}
          selectedTo={activeTrendTo}
          trendKey={activeTrendKey}
          trendQueryLabel={activeTrendLabel}
          metricKeys={activeTrendMetrics}
          series={activeTrendSeries}
        />
      ) : null}

      <div className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        {selectedWeekEnd === null || sortedRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
            {rows.length === 0
              ? 'No SQP data for the selected week.'
              : 'No rows match the current filters.'}
          </div>
        ) : (
          <div
            data-aph-hscroll
            data-aph-hscroll-axis="x"
            className="overflow-x-auto"
            style={columnStyles}
          >
            <div className="max-h-[520px] overflow-y-auto">
              <table className="min-w-max w-full table-auto border-separate border-spacing-0 text-left text-sm text-foreground">
                <thead className="sticky top-0 z-40 bg-surface text-[10px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="sticky top-0 left-0 z-50 w-[var(--trend-col-w)] border-b border-border bg-surface px-3 py-3 text-left shadow-sm">
                      Trend
                    </th>
                    {queryColumn ? (() => {
                      const isActiveSort = sortKey === queryColumn.key;
                      const arrow = isActiveSort ? (sortDir === 'asc' ? '▲' : '▼') : '';
                      return (
                        <th
                          key={queryColumn.key}
                          className="sticky top-0 left-[var(--trend-col-w)] z-50 w-[var(--query-col-w)] border-b border-border bg-surface px-3 py-3 text-left shadow-sm"
                          title={queryColumn.tooltip ?? queryColumn.label}
                        >
                          <div className="flex items-center gap-2">
                            <span>{queryColumn.shortLabel ?? queryColumn.label}</span>
                            <span className="text-[10px] text-muted">{arrow}</span>
                          </div>
                        </th>
                      );
                    })() : null}
                    {showGroupColumn ? (
                      <th className="sticky top-0 left-[calc(var(--query-col-w)+var(--trend-col-w))] z-50 w-[var(--group-col-w)] border-b border-border bg-surface px-3 py-3 text-left shadow-sm">
                        Groups
                      </th>
                    ) : null}
                    {dataColumns.map((column, index) => {
                      const isSortable = column.kind !== 'text';
                      const isActiveSort = sortKey === column.key;
                      const arrow = isActiveSort ? (sortDir === 'asc' ? '▲' : '▼') : '';
                      return (
                        <th
                          key={`${column.key}-${index}`}
                          className={`top-0 z-40 border-b border-border bg-surface px-3 py-3 text-left ${
                            isSortable ? 'cursor-pointer' : ''
                          } shadow-sm`}
                          onClick={() => {
                            if (!isSortable) return;
                            if (isActiveSort) {
                              setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                              return;
                            }
                            setSortKey(column.key);
                            setSortDir('desc');
                          }}
                          title={column.tooltip ?? column.label}
                        >
                          <div className="flex items-center gap-2">
                            <span>{column.shortLabel ?? column.label}</span>
                            {isSortable ? (
                              <span className="text-[10px] text-muted">{arrow}</span>
                            ) : null}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {sortedRows.map((row, rowIndex) => {
                    const groupNames = row.keyword_id
                      ? (membershipMap.get(row.keyword_id) ?? [])
                          .map((groupId) => groupNameById.get(groupId))
                          .filter(Boolean)
                      : [];
                    const trendKeyValue = row.search_query_norm ?? null;
                    return (
                      <tr key={`${row.search_query_norm}-${rowIndex}`}>
                        <td className="sticky left-0 z-20 w-[var(--trend-col-w)] border-b border-border/60 bg-surface px-3 py-3">
                          {trendKeyValue ? (
                            <button
                              type="button"
                              onClick={() => openTrend(trendKeyValue)}
                              className="whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-surface-2"
                            >
                              Trend
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted">—</span>
                          )}
                        </td>
                        {queryColumn ? (() => {
                          const rawValue = row[queryColumn.key as keyof typeof row] as
                            | number
                            | string
                            | null
                            | undefined;
                          const displayValue = formatText(rawValue as string | null | undefined);
                          return (
                            <td
                              key={`${rowIndex}-${queryColumn.key}`}
                              className="sticky left-[var(--trend-col-w)] z-20 w-[var(--query-col-w)] border-b border-border/60 bg-surface px-3 py-3 font-semibold"
                            >
                              <button
                                type="button"
                                onClick={() => openTrend(trendKeyValue)}
                                className="group flex min-w-0 flex-col text-left"
                              >
                                <span className="truncate">{displayValue}</span>
                                <span className="mt-1 text-[10px] font-normal text-muted group-hover:text-foreground">
                                  {row.search_query_norm ?? '—'}
                                </span>
                              </button>
                            </td>
                          );
                        })() : null}
                        {showGroupColumn ? (
                          <td className="sticky left-[calc(var(--query-col-w)+var(--trend-col-w))] z-10 border-b border-border/60 bg-surface px-3 py-3 text-xs text-muted">
                            {groupNames.length > 0 ? groupNames.join(', ') : '—'}
                          </td>
                        ) : null}
                        {dataColumns.map((column, columnIndex) => {
                          const rawValue = row[column.key as keyof typeof row] as
                            | number
                            | string
                            | null
                            | undefined;
                          let displayValue = '';
                          if (column.key.endsWith('_index')) {
                            displayValue = formatIndex(toNumber(rawValue));
                          } else if (column.kind === 'text') {
                            displayValue = formatText(rawValue as string | null | undefined);
                          } else if (column.kind === 'int') {
                            displayValue = formatNumber(toInt(rawValue));
                          } else if (column.kind === 'money') {
                            displayValue = formatMoney(toNumber(rawValue));
                          } else {
                            displayValue = formatPercent(toNumber(rawValue));
                          }
                          return (
                            <td
                              key={`${rowIndex}-${column.key}-${columnIndex}`}
                              className="border-b border-border/60 px-3 py-3 align-top"
                            >
                              {displayValue}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
