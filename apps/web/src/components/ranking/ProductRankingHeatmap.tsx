'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';

import InlineFilters from '@/components/InlineFilters';
import type { KeywordGroupSummaryResult } from '@/lib/products/getProductKeywordGroups';
import type { ProductKeywordGroupMemberships } from '@/lib/products/getProductKeywordGroupMemberships';
import type { SortDir } from '@/lib/ranking/compareNullableNumber';
import { compareNullableNumber } from '@/lib/ranking/compareNullableNumber';
import { formatRankDateHeader } from '@/lib/ranking/formatRankDate';
import {
  RESULTS_PER_PAGE,
  TOP10_CUTOFF,
  getRankBadgeStyle,
  getRankHue,
} from '@/lib/ranking/rankBands';
import type { ProductRankingRow } from '@/lib/ranking/getProductRankingDaily';

const normalizeKeyword = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const formatNumber = (value?: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
};

type RankCell = {
  value: number | null;
  kind: string;
  raw: string | null;
};

type RankPair = {
  organic: RankCell;
  sponsored: RankCell;
};

type KeywordEntry = {
  key: string;
  keywordId: string | null;
  keywordRaw: string;
  keywordNorm: string;
  searchVolume: number | null;
  ranks: Record<string, RankPair>;
};

type ProductRankingHeatmapProps = {
  asin: string;
  start: string;
  end: string;
  rankingRows: ProductRankingRow[];
  keywordGroups: KeywordGroupSummaryResult | null;
  keywordGroupMemberships: ProductKeywordGroupMemberships | null;
};

type SortKey =
  | 'keyword'
  | 'search_volume'
  | { type: 'date'; dateIso: string };

const buildRankCell = (
  value: number | null,
  kind?: string | null,
  raw?: string | null
): RankCell => ({
  value: value ?? null,
  kind: kind ?? 'missing',
  raw: raw ?? null,
});

const displayRank = (cell: RankCell): string => {
  if (cell.value === null || cell.value === undefined) return '—';
  if (cell.raw && cell.raw.trim()) return cell.raw.trim();
  if (cell.kind === 'gte') return `≥${cell.value}`;
  return String(cell.value);
};

const isSameSortKey = (a: SortKey | null, b: SortKey): boolean => {
  if (!a) return false;
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  if (typeof a === 'object' && typeof b === 'object') {
    return a.type === b.type && a.dateIso === b.dateIso;
  }
  return false;
};

const getSortArrow = (active: boolean, dir: SortDir): string =>
  active ? (dir === 'asc' ? '▲' : '▼') : '';

export default function ProductRankingHeatmap({
  asin,
  start,
  end,
  rankingRows,
  keywordGroups,
  keywordGroupMemberships,
}: ProductRankingHeatmapProps) {
  const [setScope, setSetScope] = useState<string>(
    keywordGroups?.active_set?.group_set_id ?? 'all'
  );
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [columnCount, setColumnCount] = useState<'14' | '30' | '60' | 'all'>(
    '30'
  );
  const [keywordSearch, setKeywordSearch] = useState('');
  const [hideUnranked, setHideUnranked] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const groupOptions = useMemo(() => {
    if (setScope === 'all') return [];
    const groupsFromMemberships = keywordGroupMemberships?.groupsBySet?.[setScope];
    if (groupsFromMemberships && groupsFromMemberships.length > 0) {
      return [...groupsFromMemberships].sort((a, b) =>
        a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
      );
    }
    const fallback =
      keywordGroups?.group_sets.find((set) => set.group_set_id === setScope)
        ?.groups ?? [];
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

  const { allDates, keywordEntries } = useMemo(() => {
    const dates = new Set<string>();
    const entries = new Map<string, KeywordEntry>();

    rankingRows.forEach((row) => {
      const observedDate = row.observed_date;
      if (!observedDate) return;
      dates.add(observedDate);

      const keywordRaw = row.keyword_raw ?? row.keyword_norm ?? '';
      const keywordNorm = row.keyword_norm ?? normalizeKeyword(keywordRaw);
      const keywordId = row.keyword_id ?? null;
      const key = keywordId ?? keywordNorm ?? keywordRaw;
      if (!key) return;

      let entry = entries.get(key);
      if (!entry) {
        entry = {
          key,
          keywordId,
          keywordRaw: keywordRaw || keywordNorm || key,
          keywordNorm: keywordNorm || normalizeKeyword(keywordRaw || key),
          searchVolume: null,
          ranks: {},
        };
        entries.set(key, entry);
      }

      if (row.search_volume !== null && row.search_volume !== undefined) {
        const value = Number(row.search_volume);
        if (Number.isFinite(value)) {
          entry.searchVolume = Math.max(entry.searchVolume ?? value, value);
        }
      }

      const organicCell = buildRankCell(
        row.organic_rank_value,
        row.organic_rank_kind,
        row.organic_rank_raw
      );
      const sponsoredCell = buildRankCell(
        row.sponsored_pos_value,
        row.sponsored_pos_kind,
        row.sponsored_pos_raw
      );

      entry.ranks[observedDate] = {
        organic: organicCell,
        sponsored: sponsoredCell,
      };
    });

    const allDates = Array.from(dates).sort((a, b) => b.localeCompare(a));
    return { allDates, keywordEntries: Array.from(entries.values()) };
  }, [rankingRows]);

  const visibleDates = useMemo(() => {
    if (columnCount === 'all') return allDates;
    const count = Number(columnCount);
    if (!Number.isFinite(count) || count <= 0) return allDates;
    return allDates.slice(0, count);
  }, [allDates, columnCount]);

  const filteredEntries = useMemo(() => {
    let entries = keywordEntries;

    if (setScope !== 'all') {
      entries = entries.filter(
        (entry) => entry.keywordId && membershipMap.has(entry.keywordId)
      );
    }

    if (setScope !== 'all' && safeGroupFilter !== 'all') {
      entries = entries.filter((entry) => {
        if (!entry.keywordId) return false;
        const groups = membershipMap.get(entry.keywordId) ?? [];
        return groups.includes(safeGroupFilter);
      });
    }

    const query = keywordSearch.trim().toLowerCase();
    if (query) {
      entries = entries.filter((entry) => {
        if (entry.keywordRaw.toLowerCase().includes(query)) return true;
        if (entry.keywordNorm.includes(query)) return true;
        return false;
      });
    }

    if (hideUnranked && visibleDates.length > 0) {
      entries = entries.filter((entry) =>
        visibleDates.some((date) => {
          const ranks = entry.ranks[date];
          if (!ranks) return false;
          return ranks.organic.value != null || ranks.sponsored.value != null;
        })
      );
    }

    const latestDate = visibleDates[0];
    const effectiveSortKey =
      sortKey ?? (latestDate ? ({ type: 'date', dateIso: latestDate } as const) : 'keyword');
    const dir = sortDir;

    entries = [...entries].sort((a, b) => {
      if (effectiveSortKey === 'keyword') {
        const cmp = a.keywordNorm.localeCompare(b.keywordNorm, 'en', {
          sensitivity: 'base',
        });
        return dir === 'asc' ? cmp : -cmp;
      }
      if (effectiveSortKey === 'search_volume') {
        return compareNullableNumber(a.searchVolume, b.searchVolume, dir);
      }
      if (typeof effectiveSortKey === 'object' && effectiveSortKey.type === 'date') {
        const dateIso = effectiveSortKey.dateIso;
        const aValue = a.ranks[dateIso]?.organic.value ?? null;
        const bValue = b.ranks[dateIso]?.organic.value ?? null;
        const cmp = compareNullableNumber(aValue, bValue, dir);
        if (cmp !== 0) return cmp;
        const fallback = a.keywordNorm.localeCompare(b.keywordNorm, 'en', {
          sensitivity: 'base',
        });
        return dir === 'asc' ? fallback : -fallback;
      }
      return 0;
    });

    return entries;
  }, [
    hideUnranked,
    keywordEntries,
    keywordSearch,
    membershipMap,
    safeGroupFilter,
    setScope,
    sortDir,
    sortKey,
    visibleDates,
  ]);

  const showGroupColumn = setScope !== 'all';
  const activeSortKey: SortKey =
    sortKey ?? (visibleDates[0] ? { type: 'date', dateIso: visibleDates[0] } : 'keyword');

  const columnStyles: CSSProperties = {
    '--kw-col-w': '240px',
    '--group-col-w': showGroupColumn ? '180px' : '0px',
    '--sv-col-w': '110px',
  } as CSSProperties;

  const renderOrganicBadge = (rank: RankCell | undefined) => {
    if (!rank || rank.value === null || rank.value === undefined) {
      return <span className="text-xs text-muted">—</span>;
    }

    return (
      <span
        className="inline-flex min-w-[36px] items-center justify-center rounded-md px-2 py-1 text-sm font-semibold text-foreground"
        style={getRankBadgeStyle(rank.value, rank.kind)}
      >
        {displayRank(rank)}
      </span>
    );
  };

  const renderSponsoredBadge = (rank: RankCell | undefined) => {
    if (!rank || rank.value === null || rank.value === undefined) {
      return <span className="text-[11px] text-muted">—</span>;
    }

    return (
      <span className="inline-flex min-w-[36px] items-center justify-center rounded-md border border-border/60 bg-surface-2/60 px-2 py-1 text-[11px] font-semibold text-muted">
        {displayRank(rank)}
      </span>
    );
  };

  const totalKeywords = keywordEntries.length;
  const filteredCount = filteredEntries.length;

  return (
    <div className="space-y-6">
      <InlineFilters>
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Ranking</div>
          <div className="mt-2 text-lg font-semibold text-foreground">
            {asin} · {start} → {end}
          </div>
          <div className="mt-1 text-xs text-muted">
            {visibleDates.length} columns · {filteredCount} keywords
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
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
            Columns
            <select
              value={columnCount}
              onChange={(event) =>
                setColumnCount(event.target.value as '14' | '30' | '60' | 'all')
              }
              className="mt-1 w-[110px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              <option value="14">14</option>
              <option value="30">30</option>
              <option value="60">60</option>
              <option value="all">∞</option>
            </select>
          </label>
          <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
            Search
            <input
              value={keywordSearch}
              onChange={(event) => setKeywordSearch(event.target.value)}
              placeholder="Contains"
              className="mt-1 w-[180px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
            <input
              type="checkbox"
              checked={hideUnranked}
              onChange={(event) => setHideUnranked(event.target.checked)}
              className="h-4 w-4 rounded border-border text-primary"
            />
            Hide unranked
          </label>
        </div>
        <div className="ml-auto flex flex-col items-end text-xs text-muted">
          <div>Tracked keywords {totalKeywords}</div>
          <div>Results per page {RESULTS_PER_PAGE}</div>
        </div>
      </InlineFilters>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold text-foreground"
            style={getRankBadgeStyle(1, 'exact')}
          >
            {TOP10_CUTOFF}
          </span>
          <span>Top 10 highlight</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold text-foreground"
            style={getRankBadgeStyle(11, 'exact')}
          >
            45
          </span>
          <span>Every {RESULTS_PER_PAGE} ranks shifts band</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold text-foreground"
            style={getRankBadgeStyle(46, 'exact')}
          >
            90
          </span>
          <span>Next page hue · HSL {getRankHue(46)}°</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        {visibleDates.length === 0 || filteredEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
            {rankingRows.length === 0
              ? 'No ranking data for this date range.'
              : 'No keywords match the current filters.'}
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
                    <th
                      className="sticky left-0 top-0 z-50 w-[var(--kw-col-w)] cursor-pointer border-b border-r border-border bg-surface px-3 py-3 text-left shadow-sm"
                      onClick={() => {
                        const nextKey: SortKey = 'keyword';
                        if (isSameSortKey(sortKey, nextKey)) {
                          setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortKey(nextKey);
                          setSortDir('asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>Keyword</span>
                        <span className="text-[10px] text-muted">
                          {getSortArrow(isSameSortKey(activeSortKey, 'keyword'), sortDir)}
                        </span>
                      </div>
                    </th>
                    {showGroupColumn ? (
                      <th className="sticky left-[var(--kw-col-w)] top-0 z-50 w-[var(--group-col-w)] border-b border-r border-border bg-surface px-3 py-3 text-left shadow-sm">
                        Group
                      </th>
                    ) : null}
                    <th
                      className="sticky top-0 z-50 w-[var(--sv-col-w)] cursor-pointer border-b border-r border-border bg-surface px-3 py-3 text-left shadow-sm"
                      style={{
                        left: showGroupColumn
                          ? 'calc(var(--kw-col-w) + var(--group-col-w))'
                          : 'var(--kw-col-w)',
                      }}
                      onClick={() => {
                        const nextKey: SortKey = 'search_volume';
                        if (isSameSortKey(sortKey, nextKey)) {
                          setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortKey(nextKey);
                          setSortDir('asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>Search vol</span>
                        <span className="text-[10px] text-muted">
                          {getSortArrow(isSameSortKey(activeSortKey, 'search_volume'), sortDir)}
                        </span>
                      </div>
                    </th>
                    {visibleDates.map((date) => (
                      <th
                        key={date}
                        className="cursor-pointer border-b border-border bg-surface px-3 py-3 text-left"
                        onClick={() => {
                          const nextKey: SortKey = { type: 'date', dateIso: date };
                          if (isSameSortKey(sortKey, nextKey)) {
                            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey(nextKey);
                            setSortDir('asc');
                          }
                        }}
                      >
                        <div
                          className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground"
                          title={date}
                        >
                          <div className="flex flex-col leading-tight">
                            <span className="text-xs font-semibold text-foreground">
                              {formatRankDateHeader(date).day}
                            </span>
                            <span className="text-[10px] uppercase text-muted">
                              {formatRankDateHeader(date).month}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted">
                            {getSortArrow(
                              isSameSortKey(activeSortKey, { type: 'date', dateIso: date }),
                              sortDir
                            )}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-sm text-foreground/85">
                  {filteredEntries.map((entry) => {
                    const groupIds =
                      showGroupColumn && entry.keywordId
                        ? membershipMap.get(entry.keywordId) ?? []
                        : [];
                    const groupNames = groupIds
                      .map((id) => groupNameById.get(id) ?? id)
                      .filter(Boolean)
                      .join(', ');

                    return (
                      <tr key={entry.key} className="hover:bg-surface-2/70">
                        <td className="sticky left-0 z-20 w-[var(--kw-col-w)] border-b border-r border-border/70 bg-surface px-3 py-3 font-semibold text-foreground shadow-[2px_0_0_rgba(0,0,0,0.06)]">
                          {entry.keywordRaw}
                        </td>
                        {showGroupColumn ? (
                          <td className="sticky left-[var(--kw-col-w)] z-20 w-[var(--group-col-w)] border-b border-r border-border/70 bg-surface px-3 py-3 text-muted shadow-[2px_0_0_rgba(0,0,0,0.06)]">
                            {groupNames || '—'}
                          </td>
                        ) : null}
                        <td
                          className="sticky z-20 w-[var(--sv-col-w)] border-b border-r border-border/70 bg-surface px-3 py-3 text-muted shadow-[2px_0_0_rgba(0,0,0,0.06)]"
                          style={{
                            left: showGroupColumn
                              ? 'calc(var(--kw-col-w) + var(--group-col-w))'
                              : 'var(--kw-col-w)',
                          }}
                        >
                          {formatNumber(entry.searchVolume)}
                        </td>
                        {visibleDates.map((date) => (
                        <td
                          key={`${entry.key}-${date}`}
                          className="border-b border-r border-border/70 px-3 py-3 text-center text-muted"
                        >
                          <div className="flex min-h-[44px] flex-col items-center justify-center gap-1">
                            {renderOrganicBadge(entry.ranks[date]?.organic)}
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-semibold text-muted">
                                S
                              </span>
                              {renderSponsoredBadge(entry.ranks[date]?.sponsored)}
                            </div>
                          </div>
                        </td>
                      ))}
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
