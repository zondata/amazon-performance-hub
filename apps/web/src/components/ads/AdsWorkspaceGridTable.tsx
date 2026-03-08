'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import type {
  AdsWorkspaceSurfaceSettings,
  AdsWorkspaceTableFontSize,
} from '@/lib/ads-workspace/adsWorkspaceUiSettings';
import { normalizeAdsWorkspaceSurfaceSettings } from '@/lib/ads-workspace/adsWorkspaceUiSettings';

export type AdsWorkspaceNumericFilterOperator =
  | 'gte'
  | 'lte'
  | 'gt'
  | 'lt'
  | 'has_value';

type NumericFilter = {
  operator: AdsWorkspaceNumericFilterOperator;
  value: string;
};

export type AdsWorkspaceGridColumn<TRow> = {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
  supportsWrap?: boolean;
  defaultFrozen?: boolean;
  alwaysVisible?: boolean;
  getSortValue?: (row: TRow) => string | number | null;
  getNumericValue?: (row: TRow) => number | null;
  renderCell: (row: TRow, context: { wrapLongLabels: boolean; fontSize: AdsWorkspaceTableFontSize }) => ReactNode;
};

type AdsWorkspaceGridTableProps<TRow> = {
  surfaceTitle: string;
  surfaceDescription: string;
  emptyMessage: string;
  activeDraftName?: string | null;
  rows: TRow[];
  rowKey: (row: TRow) => string;
  columns: AdsWorkspaceGridColumn<TRow>[];
  surfaceSettings?: AdsWorkspaceSurfaceSettings | null;
  onSurfaceSettingsChange: (settings: AdsWorkspaceSurfaceSettings) => void;
  settingsSaveStateLabel?: string | null;
  rowLinkRole?: 'link' | undefined;
  onRowClick?: (row: TRow) => void;
  onRowKeyDown?: (row: TRow, event: KeyboardEvent<HTMLDivElement>) => void;
  renderExpanded?: (row: TRow, context: { fontSize: AdsWorkspaceTableFontSize; wrapLongLabels: boolean }) => ReactNode;
  rowClassName?: string | ((row: TRow) => string | null | undefined);
  expandedRowClassName?: string;
};

const fontSizeClassName = (fontSize: AdsWorkspaceTableFontSize) => {
  if (fontSize === 'compact') return 'text-[13px]';
  if (fontSize === 'comfortable') return 'text-[15px]';
  return 'text-sm';
};

const compareNullable = (
  left: string | number | null,
  right: string | number | null,
  direction: 'asc' | 'desc'
) => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === 'number' && typeof right === 'number') {
    return direction === 'asc' ? left - right : right - left;
  }
  const leftText = String(left).toLowerCase();
  const rightText = String(right).toLowerCase();
  if (leftText === rightText) return 0;
  return direction === 'asc'
    ? leftText.localeCompare(rightText)
    : rightText.localeCompare(leftText);
};

const buildFrozenOffsets = <TRow,>(
  columns: AdsWorkspaceGridColumn<TRow>[],
  frozenKeys: Set<string>
) => {
  const offsets = new Map<string, number>();
  let offset = 0;
  for (const column of columns) {
    if (!frozenKeys.has(column.key)) continue;
    offsets.set(column.key, offset);
    offset += column.width;
  }
  return offsets;
};

const FilterIcon = ({ active }: { active: boolean }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    className={`h-3.5 w-3.5 ${active ? 'text-primary-foreground' : 'text-current'}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 3.25h11L9.5 8v4.25l-3-1.75V8L2.5 3.25Z" />
  </svg>
);

export default function AdsWorkspaceGridTable<TRow>({
  surfaceTitle,
  surfaceDescription,
  emptyMessage,
  activeDraftName,
  rows,
  rowKey,
  columns,
  surfaceSettings,
  onSurfaceSettingsChange,
  settingsSaveStateLabel,
  rowLinkRole,
  onRowClick,
  onRowKeyDown,
  renderExpanded,
  rowClassName,
  expandedRowClassName,
}: AdsWorkspaceGridTableProps<TRow>) {
  const [sortState, setSortState] = useState<{ columnKey: string | null; direction: 'asc' | 'desc' }>({
    columnKey: null,
    direction: 'desc',
  });
  const [numericFilters, setNumericFilters] = useState<Record<string, NumericFilter>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeFilterColumnKey, setActiveFilterColumnKey] = useState<string | null>(null);
  const [draftFilterOperator, setDraftFilterOperator] =
    useState<AdsWorkspaceNumericFilterOperator>('gte');
  const [draftFilterValue, setDraftFilterValue] = useState('');

  const normalizedSettings = useMemo(
    () =>
      normalizeAdsWorkspaceSurfaceSettings({
        raw: surfaceSettings,
        columnKeys: columns.map((column) => column.key),
        defaultFrozenColumns: columns.filter((column) => column.defaultFrozen).map((column) => column.key),
      }),
    [columns, surfaceSettings]
  );

  const visibleColumns = useMemo(() => {
    const columnByKey = new Map(columns.map((column) => [column.key, column]));
    return normalizedSettings.columnOrder
      .map((key) => columnByKey.get(key) ?? null)
      .filter((column): column is AdsWorkspaceGridColumn<TRow> => Boolean(column))
      .filter((column) => !normalizedSettings.hiddenColumns.includes(column.key));
  }, [columns, normalizedSettings]);

  const frozenKeys = useMemo(
    () => new Set(normalizedSettings.frozenColumns.filter((key) => visibleColumns.some((column) => column.key === key))),
    [normalizedSettings.frozenColumns, visibleColumns]
  );
  const frozenOffsets = useMemo(() => buildFrozenOffsets(visibleColumns, frozenKeys), [visibleColumns, frozenKeys]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      Object.entries(numericFilters).every(([columnKey, filter]) => {
        const column = columns.find((entry) => entry.key === columnKey);
        if (!column?.getNumericValue) return true;
        const numericValue = column.getNumericValue(row);
        if (filter.operator === 'has_value') {
          return numericValue !== null;
        }
        if (numericValue === null) return false;
        const filterValue = Number(filter.value);
        if (!Number.isFinite(filterValue)) return true;
        if (filter.operator === 'gte') return numericValue >= filterValue;
        if (filter.operator === 'lte') return numericValue <= filterValue;
        if (filter.operator === 'gt') return numericValue > filterValue;
        return numericValue < filterValue;
      })
    );
  }, [columns, numericFilters, rows]);

  const sortedRows = useMemo(() => {
    if (!sortState.columnKey) return filteredRows;
    const column = columns.find((entry) => entry.key === sortState.columnKey);
    if (!column?.getSortValue) return filteredRows;
    return [...filteredRows].sort((left, right) =>
      compareNullable(
        column.getSortValue?.(left) ?? null,
        column.getSortValue?.(right) ?? null,
        sortState.direction
      )
    );
  }, [columns, filteredRows, sortState]);

  const totalWidth = visibleColumns.reduce((sum, column) => sum + column.width, 0);
  const filterCount = Object.keys(numericFilters).length;

  const setSurfaceSettings = (next: AdsWorkspaceSurfaceSettings) => {
    onSurfaceSettingsChange(
      normalizeAdsWorkspaceSurfaceSettings({
        raw: next,
        columnKeys: columns.map((column) => column.key),
        defaultFrozenColumns: columns.filter((column) => column.defaultFrozen).map((column) => column.key),
      })
    );
  };

  const toggleWrap = () => {
    setSurfaceSettings({
      ...normalizedSettings,
      wrapLongLabels: !normalizedSettings.wrapLongLabels,
    });
  };

  const setFontSize = (fontSize: AdsWorkspaceTableFontSize) => {
    setSurfaceSettings({
      ...normalizedSettings,
      fontSize,
    });
  };

  const toggleColumnVisibility = (columnKey: string) => {
    const column = columns.find((entry) => entry.key === columnKey);
    if (column?.alwaysVisible) return;

    const hidden = new Set(normalizedSettings.hiddenColumns);
    if (hidden.has(columnKey)) {
      hidden.delete(columnKey);
    } else {
      const visibleCount = columns.length - hidden.size;
      if (visibleCount <= 1) return;
      hidden.add(columnKey);
    }
    setSurfaceSettings({
      ...normalizedSettings,
      hiddenColumns: [...hidden],
    });
  };

  const moveColumn = (columnKey: string, direction: -1 | 1) => {
    const nextOrder = [...normalizedSettings.columnOrder];
    const currentIndex = nextOrder.indexOf(columnKey);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= nextOrder.length) return;
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(nextIndex, 0, moved);
    setSurfaceSettings({
      ...normalizedSettings,
      columnOrder: nextOrder,
    });
  };

  const toggleFrozen = (columnKey: string) => {
    const frozen = new Set(normalizedSettings.frozenColumns);
    if (frozen.has(columnKey)) {
      frozen.delete(columnKey);
    } else {
      frozen.add(columnKey);
    }
    setSurfaceSettings({
      ...normalizedSettings,
      frozenColumns: [...frozen],
    });
  };

  const toggleSort = (columnKey: string) => {
    setSortState((current) => {
      if (current.columnKey !== columnKey) {
        return { columnKey, direction: 'desc' };
      }
      if (current.direction === 'desc') {
        return { columnKey, direction: 'asc' };
      }
      return { columnKey: null, direction: 'desc' };
    });
  };

  const openFilter = (columnKey: string) => {
    const existing = numericFilters[columnKey];
    setActiveFilterColumnKey(columnKey);
    setDraftFilterOperator(existing?.operator ?? 'gte');
    setDraftFilterValue(existing?.value ?? '');
  };

  const applyFilter = () => {
    if (!activeFilterColumnKey) return;
    setNumericFilters((current) => ({
      ...current,
      [activeFilterColumnKey]: {
        operator: draftFilterOperator,
        value: draftFilterValue,
      },
    }));
    setActiveFilterColumnKey(null);
  };

  const clearFilter = (columnKey: string) => {
    setNumericFilters((current) => {
      const next = { ...current };
      delete next[columnKey];
      return next;
    });
    if (activeFilterColumnKey === columnKey) {
      setActiveFilterColumnKey(null);
    }
  };

  const rowFontClassName = fontSizeClassName(normalizedSettings.fontSize);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/80 px-5 py-10 text-sm text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface/80 shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">{surfaceTitle}</div>
            <div className="mt-1 text-sm text-foreground">{surfaceDescription}</div>
          </div>
          <div className="text-xs text-muted xl:text-right">
            {activeDraftName ? `Active draft: ${activeDraftName}` : 'A draft queue is created on first save.'}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleWrap}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                normalizedSettings.wrapLongLabels
                  ? 'border-primary/30 bg-primary text-primary-foreground'
                  : 'border-border bg-surface-2 text-foreground'
              }`}
            >
              Wrap long labels {normalizedSettings.wrapLongLabels ? 'On' : 'Off'}
            </button>

            <label className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground">
              Font
              <select
                value={normalizedSettings.fontSize}
                onChange={(event) => setFontSize(event.target.value as AdsWorkspaceTableFontSize)}
                className="bg-transparent text-sm text-foreground outline-none"
              >
                <option value="compact">Compact</option>
                <option value="default">Default</option>
                <option value="comfortable">Comfortable</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => setIsSettingsOpen((current) => !current)}
              className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm font-semibold text-foreground"
            >
              Columns
            </button>

            {filterCount > 0 ? (
              <button
                type="button"
                onClick={() => setNumericFilters({})}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted"
              >
                Clear {filterCount} filter{filterCount === 1 ? '' : 's'}
              </button>
            ) : null}
          </div>

          <div className="text-xs text-muted">
            {sortedRows.length.toLocaleString('en-US')} row(s)
            {settingsSaveStateLabel ? ` · ${settingsSaveStateLabel}` : ''}
          </div>
        </div>

        {isSettingsOpen ? (
          <div className="mt-4 rounded-2xl border border-border bg-surface-2/70 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Per-tab column settings</div>
            <div className="mt-3 space-y-2">
              {normalizedSettings.columnOrder.map((columnKey, index) => {
                const column = columns.find((entry) => entry.key === columnKey);
                if (!column) return null;
                const isHidden = normalizedSettings.hiddenColumns.includes(column.key);
                const isFrozen = normalizedSettings.frozenColumns.includes(column.key);
                return (
                  <div
                    key={column.key}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-background/70 px-3 py-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{column.label}</div>
                      <div className="text-xs text-muted">{column.key}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveColumn(column.key, -1)}
                        disabled={index === 0}
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold text-foreground disabled:opacity-40"
                      >
                        Left
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumn(column.key, 1)}
                        disabled={index === normalizedSettings.columnOrder.length - 1}
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold text-foreground disabled:opacity-40"
                      >
                        Right
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFrozen(column.key)}
                        className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                          isFrozen
                            ? 'border-primary/30 bg-primary text-primary-foreground'
                            : 'border-border bg-surface text-foreground'
                        }`}
                      >
                        {isFrozen ? 'Frozen' : 'Freeze'}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleColumnVisibility(column.key)}
                        disabled={column.alwaysVisible === true}
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold text-foreground disabled:opacity-40"
                      >
                        {isHidden ? 'Show' : 'Hide'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div
        data-aph-hscroll
        data-aph-hscroll-axis="x"
        className="max-h-[760px] min-h-[320px] overflow-auto"
      >
        <div className={rowFontClassName} style={{ minWidth: `${totalWidth}px` }}>
          <div
            className="sticky top-0 z-20 grid border-b border-border bg-surface text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
            style={{ gridTemplateColumns: visibleColumns.map((column) => `${column.width}px`).join(' ') }}
          >
            {visibleColumns.map((column) => {
              const isFrozen = frozenKeys.has(column.key);
              const isSorted = sortState.columnKey === column.key;
              const filter = numericFilters[column.key] ?? null;
              return (
                <div
                  key={column.key}
                  className={`relative px-3 py-3 ${isFrozen ? 'sticky z-30 bg-surface shadow-[2px_0_0_rgba(0,0,0,0.04)]' : ''}`}
                  style={isFrozen ? { left: `${frozenOffsets.get(column.key) ?? 0}px` } : undefined}
                >
                  <div className={`flex items-center gap-2 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : 'justify-between'}`}>
                    <button
                      type="button"
                      onClick={() => column.getSortValue && toggleSort(column.key)}
                      className={`min-w-0 text-left ${column.getSortValue ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span>{column.label}</span>
                      {isSorted ? <span className="ml-1">{sortState.direction === 'asc' ? '▲' : '▼'}</span> : null}
                    </button>
                    {column.getNumericValue ? (
                      <button
                        type="button"
                        onClick={() => openFilter(column.key)}
                        aria-label={`Filter ${column.label}`}
                        title={`Filter ${column.label}`}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                          filter
                            ? 'border-primary/30 bg-primary text-primary-foreground'
                            : 'border-border bg-surface-2 text-muted'
                        }`}
                      >
                        <FilterIcon active={Boolean(filter)} />
                      </button>
                    ) : null}
                  </div>
                  {activeFilterColumnKey === column.key ? (
                    <div className="absolute right-0 top-[calc(100%-4px)] z-40 w-56 rounded-2xl border border-border bg-surface p-3 shadow-xl">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted">{column.label}</div>
                      <select
                        value={draftFilterOperator}
                        onChange={(event) =>
                          setDraftFilterOperator(event.target.value as AdsWorkspaceNumericFilterOperator)
                        }
                        className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      >
                        <option value="gte">&gt;=</option>
                        <option value="lte">&lt;=</option>
                        <option value="gt">&gt;</option>
                        <option value="lt">&lt;</option>
                        <option value="has_value">Has value</option>
                      </select>
                      {draftFilterOperator !== 'has_value' ? (
                        <input
                          type="number"
                          value={draftFilterValue}
                          onChange={(event) => setDraftFilterValue(event.target.value)}
                          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                        />
                      ) : null}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => clearFilter(column.key)}
                          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-foreground"
                        >
                          Clear
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveFilterColumnKey(null)}
                            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-foreground"
                          >
                            Close
                          </button>
                          <button
                            type="button"
                            onClick={applyFilter}
                            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {sortedRows.map((row) => {
            const resolvedRowClassName =
              typeof rowClassName === 'function' ? rowClassName(row) ?? '' : rowClassName ?? '';
            const hasCustomRowSurfaceTone =
              resolvedRowClassName.includes('bg-') ||
              resolvedRowClassName.includes('ring-') ||
              resolvedRowClassName.includes('border-l-');
            const summary = (
              <div
                role={rowLinkRole}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowKeyDown ? (event) => onRowKeyDown(row, event) : undefined}
                className={`grid transition ${
                  hasCustomRowSurfaceTone ? '' : 'bg-surface/70 hover:bg-surface-2/70'
                } ${resolvedRowClassName}`}
                style={{ gridTemplateColumns: visibleColumns.map((column) => `${column.width}px`).join(' ') }}
              >
                {visibleColumns.map((column) => {
                  const isFrozen = frozenKeys.has(column.key);
                  return (
                    <div
                      key={`${rowKey(row)}:${column.key}`}
                      className={`min-w-0 px-3 py-3 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'} ${
                        isFrozen ? 'sticky z-10 bg-[inherit] shadow-[2px_0_0_rgba(0,0,0,0.04)]' : ''
                      }`}
                      style={isFrozen ? { left: `${frozenOffsets.get(column.key) ?? 0}px` } : undefined}
                    >
                      {renderExpanded && column.key === visibleColumns[0]?.key ? (
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="mt-0.5 text-xs text-muted transition-transform group-open:rotate-90">
                            ▸
                          </span>
                          <div className="min-w-0">
                            {column.renderCell(row, {
                              wrapLongLabels: normalizedSettings.wrapLongLabels,
                              fontSize: normalizedSettings.fontSize,
                            })}
                          </div>
                        </div>
                      ) : (
                        column.renderCell(row, {
                          wrapLongLabels: normalizedSettings.wrapLongLabels,
                          fontSize: normalizedSettings.fontSize,
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            );

            if (!renderExpanded) {
              return <div key={rowKey(row)}>{summary}</div>;
            }

            return (
              <details key={rowKey(row)} className="group border-b border-border last:border-b-0">
                <summary className="list-none [&::-webkit-details-marker]:hidden">{summary}</summary>
                <div className={expandedRowClassName ?? ''}>
                  {renderExpanded(row, {
                    fontSize: normalizedSettings.fontSize,
                    wrapLongLabels: normalizedSettings.wrapLongLabels,
                  })}
                </div>
              </details>
            );
          })}

          {sortedRows.length === 0 ? (
            <div
              className="grid min-h-[240px] place-items-center border-t border-border bg-surface/50 px-5 py-10 text-center text-sm text-muted"
              style={{ gridTemplateColumns: `${Math.max(totalWidth, 1)}px` }}
            >
              <div className="max-w-md">
                No rows matched the current filters. Adjust or clear the header filters to restore results.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
