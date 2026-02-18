'use client';

import type { CSSProperties, MouseEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { CalendarBucket, SalesGranularity } from '@/lib/sales/buckets/getCalendarBuckets';
import type { PivotMetricRow, PivotRow } from '@/lib/sales/pivot/pivotRows';
import type { SalesMetricKey } from '@/lib/sales/salesMetrics';

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const PROFITS_EXPANDED_KEY = 'sales.trend:pivot:profitsExpanded';
const DEFAULT_PROFITS_EXPANDED = false;

const buildBarHeights = (values: Array<number | null>, height: number) => {
  const numbers = values
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .map((value) => value);

  if (numbers.length === 0) return { heights: values.map(() => 0), hasNegative: false, maxAbs: 0 };

  const maxAbs = Math.max(...numbers.map((value) => Math.abs(value))) || 1;
  const hasNegative = numbers.some((value) => value < 0);
  const scale = hasNegative ? height / 2 : height;

  return {
    heights: values.map((value) => {
      if (value === null || !Number.isFinite(value)) return 0;
      return Math.round((Math.abs(value) / maxAbs) * scale);
    }),
    hasNegative,
    maxAbs,
  };
};

type SalesPivotTableProps = {
  buckets: CalendarBucket[];
  granularity: SalesGranularity;
  rows: PivotRow[];
  formatValue: (key: SalesMetricKey, value?: number | null) => string;
};

type RenderRow = {
  key: string;
  row: PivotRow | PivotMetricRow;
  level: 'group' | 'metric' | 'child';
  parentKey?: SalesMetricKey;
};

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  line1: string;
  line2: string;
};

export default function SalesPivotTable({
  buckets,
  granularity,
  rows,
  formatValue,
}: SalesPivotTableProps) {
  const [colWidths, setColWidths] = useState({ kpi: 220, summary: 140 });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') {
      return { profits: DEFAULT_PROFITS_EXPANDED };
    }
    const stored = sessionStorage.getItem(PROFITS_EXPANDED_KEY);
    if (stored === null) {
      return { profits: DEFAULT_PROFITS_EXPANDED };
    }
    return { profits: stored === 'true' };
  });
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    line1: '',
    line2: '',
  });
  const lastHoverKeyRef = useRef<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const visibleRows = useMemo<RenderRow[]>(() => {
    const output: RenderRow[] = [];
    rows.forEach((row) => {
      if (row.type === 'group') {
        output.push({ key: row.metricKey, row, level: 'group' });
        const isExpanded =
          expandedGroups[row.metricKey] ??
          (row.metricKey === 'profits' ? DEFAULT_PROFITS_EXPANDED : true);
        if (isExpanded) {
          row.children.forEach((child) => {
            output.push({
              key: `${row.metricKey}:${child.metricKey}`,
              row: child,
              level: 'child',
              parentKey: row.metricKey,
            });
          });
        }
      } else {
        output.push({ key: row.metricKey, row, level: 'metric' });
      }
    });
    return output;
  }, [rows, expandedGroups]);

  useEffect(() => {
    sessionStorage.setItem(
      PROFITS_EXPANDED_KEY,
      String(expandedGroups.profits ?? DEFAULT_PROFITS_EXPANDED)
    );
  }, [expandedGroups.profits]);

  const measureWidths = useCallback(() => {
    if (visibleRows.length === 0) return;

    const measurement = document.createElement('div');
    measurement.style.position = 'absolute';
    measurement.style.visibility = 'hidden';
    measurement.style.whiteSpace = 'nowrap';
    measurement.style.left = '0';
    measurement.style.top = '0';
    measurement.className = 'text-sm font-sans text-slate-700';

    document.body.appendChild(measurement);

    const measureSpan = (
      text: string,
      className?: string,
      styles?: Partial<CSSStyleDeclaration>
    ) => {
      const span = document.createElement('span');
      span.textContent = text;
      if (className) span.className = className;
      if (styles) Object.assign(span.style, styles);
      measurement.appendChild(span);
      const width = span.offsetWidth;
      measurement.removeChild(span);
      return width;
    };

    let kpiWidth = measureSpan('KPI', 'font-semibold');
    let summaryWidth = measureSpan('Summary', 'font-semibold');

    visibleRows.forEach(({ row, level }) => {
      const isGroup = row.type === 'group' && level === 'group';
      const isChild = level === 'child';
      const label = isGroup ? `▸ ${row.label}` : row.label;
      const labelWidth = measureSpan(
        label,
        isChild ? undefined : 'font-semibold',
        isChild ? { paddingLeft: '32px' } : undefined
      );
      kpiWidth = Math.max(kpiWidth, labelWidth);

      const summaryText = formatValue(row.metricKey, row.summaryValue);
      summaryWidth = Math.max(summaryWidth, measureSpan(summaryText));
    });

    document.body.removeChild(measurement);

    setColWidths({
      kpi: clamp(kpiWidth + 24, 140, 220),
      summary: clamp(summaryWidth + 24, 90, 160),
    });
  }, [formatValue, visibleRows]);

  useLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      measureWidths();
    });
    return () => cancelAnimationFrame(rafId);
  }, [measureWidths]);

  useEffect(() => {
    const handleResize = () => measureWidths();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measureWidths]);

  const hideTooltip = () => {
    lastHoverKeyRef.current = null;
    setTooltip((current) => (current.visible ? { ...current, visible: false } : current));
  };

  const showTooltip = (
    event: MouseEvent<HTMLDivElement>,
    rowKey: SalesMetricKey,
    bucketValues: Array<number | null>
  ) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const width = rect.width || 1;
    const offsetX = event.clientX - rect.left;
    const bucketCount = buckets.length;
    if (bucketCount === 0) return;
    const rawIndex = Math.floor((offsetX / width) * bucketCount);
    const bucketIndex = clamp(rawIndex, 0, bucketCount - 1);
    const hoverKey = `${rowKey}:${bucketIndex}`;
    if (lastHoverKeyRef.current === hoverKey) return;
    lastHoverKeyRef.current = hoverKey;

    const bucket = buckets[bucketIndex];
    const line1 = bucket
      ? granularity === 'daily'
        ? bucket.label
        : `${bucket.start} – ${bucket.end}`
      : '';
    const line2 = formatValue(rowKey, bucketValues[bucketIndex] ?? null);

    const viewportPadding = 12;
    const tooltipWidth = 200;
    const tooltipHeight = 52;
    let x = event.clientX + 12;
    let y = event.clientY + 12;
    if (x + tooltipWidth > window.innerWidth - viewportPadding) {
      x = event.clientX - tooltipWidth - 12;
    }
    if (y + tooltipHeight > window.innerHeight - viewportPadding) {
      y = event.clientY - tooltipHeight - 12;
    }

    setTooltip({
      visible: true,
      x,
      y,
      line1,
      line2,
    });
  };

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white/90"
      style={
        {
          '--kpi-col-w': `${colWidths.kpi}px`,
          '--summary-col-w': `${colWidths.summary}px`,
          '--analysis-col-w': '110px',
        } as CSSProperties
      }
    >
      <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
        <table
          ref={tableRef}
          className="min-w-max w-full table-auto border-separate border-spacing-0 text-left text-sm"
        >
          <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="sticky left-0 z-30 w-[var(--kpi-col-w)] border-b border-r border-slate-200/70 bg-white px-3 py-3 text-left shadow-sm">
                KPI
              </th>
              <th className="sticky left-[var(--kpi-col-w)] z-30 w-[var(--summary-col-w)] border-b border-r border-slate-200/70 bg-white px-3 py-3 text-left shadow-sm">
                Summary
              </th>
              {buckets.map((bucket) => (
                <th
                  key={bucket.key}
                  className="border-b border-r border-slate-200/70 px-2 py-2 text-left"
                >
                  {granularity === 'daily' ? (
                    <div className="text-xs font-semibold text-slate-700">
                      {bucket.label}
                    </div>
                  ) : (
                    <div className="text-[10px] leading-tight">
                      <div className="font-semibold text-slate-700">
                        {bucket.label}
                      </div>
                      <div className="text-slate-500">{bucket.start}</div>
                      <div className="text-slate-500">{bucket.end}</div>
                    </div>
                  )}
                </th>
              ))}
              <th className="w-[var(--analysis-col-w)] border-b border-slate-200/70 px-2 py-2 text-left">
                Analysis
              </th>
            </tr>
          </thead>
          <tbody className="text-sm text-slate-700">
            {visibleRows.map(({ key, row, level }) => {
              const bucketValues = row.bucketValues;
              const summaryValue = row.summaryValue;
              const { heights, hasNegative } = buildBarHeights(bucketValues, 32);
              const baseline = hasNegative ? 16 : 32;
              const isGroup = row.type === 'group' && level === 'group';
              const isChild = level === 'child';
              const rowMetricKey = row.metricKey;
              const rowLabel = row.label;
              const expanded =
                expandedGroups[rowMetricKey] ??
                (rowMetricKey === 'profits' ? DEFAULT_PROFITS_EXPANDED : true);

              return (
                <tr key={key} className="hover:bg-slate-50">
                  <td
                    data-kpi-cell
                    className={`sticky left-0 z-20 w-[var(--kpi-col-w)] border-b border-r border-slate-200/70 bg-white px-3 py-3 shadow-[2px_0_0_rgba(226,232,240,0.6)] ${
                      isChild ? 'pl-8 text-slate-500' : 'font-semibold text-slate-700'
                    }`}
                  >
                    {isGroup ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedGroups((current) => ({
                            ...current,
                            [rowMetricKey]: !(
                              current[rowMetricKey] ??
                              (rowMetricKey === 'profits'
                                ? DEFAULT_PROFITS_EXPANDED
                                : true)
                            ),
                          }))
                        }
                        className="flex items-center gap-2 text-left"
                        aria-expanded={expanded}
                      >
                        <span
                          className={`inline-block text-xs transition-transform ${
                            expanded
                              ? 'rotate-90'
                              : 'rotate-0'
                          }`}
                        >
                          ▸
                        </span>
                        <span>{rowLabel}</span>
                      </button>
                    ) : (
                      rowLabel
                    )}
                  </td>
                  <td
                    data-summary-cell
                    className={`sticky left-[var(--kpi-col-w)] z-20 w-[var(--summary-col-w)] border-b border-r border-slate-200/70 bg-white px-3 py-3 shadow-[2px_0_0_rgba(226,232,240,0.6)] ${
                      isChild ? 'text-slate-500' : 'text-slate-700'
                    }`}
                  >
                    {formatValue(rowMetricKey, summaryValue)}
                  </td>
                  {bucketValues.map((value, index) => (
                    <td
                      key={`${key}-${index}`}
                      className={`border-b border-r border-slate-200/70 px-2 py-2 text-right text-slate-600 whitespace-nowrap ${
                        isChild ? 'text-slate-500' : ''
                      }`}
                    >
                      {formatValue(rowMetricKey, value)}
                    </td>
                  ))}
                  <td className="border-b border-slate-200/70 px-2 py-2">
                    {bucketValues.some((value) => value !== null) ? (
                      <div
                        className="relative h-9 w-[var(--analysis-col-w)]"
                        onMouseMove={(event) =>
                          showTooltip(event, rowMetricKey, bucketValues)
                        }
                        onMouseLeave={hideTooltip}
                      >
                        {hasNegative ? (
                          <div
                            className="absolute left-0 right-0 h-px bg-slate-200"
                            style={{ top: `${baseline}px` }}
                          />
                        ) : null}
                        <div className="flex h-full items-stretch gap-[2px]">
                          {bucketValues.map((value, index) => {
                            const height = heights[index] ?? 0;
                            const isNegative = (value ?? 0) < 0;

                            return (
                              <div key={`${key}-spark-${index}`} className="relative flex-1">
                                <div
                                  className={`absolute left-0 right-0 rounded-sm ${
                                    isNegative ? 'bg-rose-400/70' : 'bg-slate-700/70'
                                  }`}
                                  style={
                                    hasNegative
                                      ? isNegative
                                        ? { height: `${height}px`, top: `${baseline}px` }
                                        : {
                                            height: `${height}px`,
                                            bottom: `${32 - baseline}px`,
                                          }
                                      : { height: `${height}px`, bottom: '0' }
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tooltip.visible ? (
        <div
          className="fixed z-50 max-w-[220px] rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y, pointerEvents: 'none' }}
        >
          <div className="font-semibold text-slate-900">{tooltip.line1}</div>
          <div className="mt-1 text-slate-600">{tooltip.line2}</div>
        </div>
      ) : null}
    </div>
  );
}
