'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatSqpWeekLabel } from '@/lib/sqp/formatSqpWeekLabel';
import type { SqpTrendRow } from '@/lib/sqp/getProductSqpTrendSeries';
import type { SqpWeek } from '@/lib/sqp/getProductSqpWeekly';

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

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

type MetricOption = {
  key: string;
  label: string;
  kind: 'int' | 'pct' | 'money' | 'index';
  axisGroup: 'count' | 'ratio';
};

const METRIC_OPTIONS: MetricOption[] = [
  { key: 'search_query_volume', label: 'Search Query Volume', kind: 'int', axisGroup: 'count' },
  { key: 'impressions_total', label: 'Impressions (Market)', kind: 'int', axisGroup: 'count' },
  { key: 'impressions_self', label: 'Impressions (Self)', kind: 'int', axisGroup: 'count' },
  { key: 'impressions_self_share', label: 'Impression Share (Self)', kind: 'pct', axisGroup: 'ratio' },
  { key: 'clicks_total', label: 'Clicks (Market)', kind: 'int', axisGroup: 'count' },
  { key: 'clicks_self', label: 'Clicks (Self)', kind: 'int', axisGroup: 'count' },
  { key: 'clicks_self_share', label: 'Click Share (Self)', kind: 'pct', axisGroup: 'ratio' },
  { key: 'cart_adds_total', label: 'Cart Adds (Market)', kind: 'int', axisGroup: 'count' },
  { key: 'cart_adds_self', label: 'Cart Adds (Self)', kind: 'int', axisGroup: 'count' },
  { key: 'cart_adds_self_share', label: 'Cart Add Share (Self)', kind: 'pct', axisGroup: 'ratio' },
  { key: 'purchases_total', label: 'Purchases (Market)', kind: 'int', axisGroup: 'count' },
  { key: 'purchases_self', label: 'Purchases (Self)', kind: 'int', axisGroup: 'count' },
  { key: 'purchases_self_share', label: 'Purchase Share (Self)', kind: 'pct', axisGroup: 'ratio' },
  { key: 'market_ctr', label: 'Market CTR', kind: 'pct', axisGroup: 'ratio' },
  { key: 'self_ctr', label: 'Self CTR', kind: 'pct', axisGroup: 'ratio' },
  { key: 'market_cvr', label: 'Market CVR', kind: 'pct', axisGroup: 'ratio' },
  { key: 'self_cvr', label: 'Self CVR', kind: 'pct', axisGroup: 'ratio' },
  { key: 'self_ctr_index', label: 'Self CTR Index', kind: 'index', axisGroup: 'ratio' },
  { key: 'self_cvr_index', label: 'Self CVR Index', kind: 'index', axisGroup: 'ratio' },
  { key: 'cart_add_rate_from_clicks_market', label: 'Cart Adds / Clicks (Market)', kind: 'pct', axisGroup: 'ratio' },
  { key: 'cart_add_rate_from_clicks_self', label: 'Cart Adds / Clicks (Self)', kind: 'pct', axisGroup: 'ratio' },
  { key: 'clicks_rate_per_query', label: 'Click Rate / Query', kind: 'pct', axisGroup: 'ratio' },
  { key: 'cart_add_rate_per_query', label: 'Cart Add Rate / Query', kind: 'pct', axisGroup: 'ratio' },
  { key: 'purchases_rate_per_query', label: 'Purchase Rate / Query', kind: 'pct', axisGroup: 'ratio' },
  { key: 'clicks_price_median_total', label: 'Median Click Price (Market)', kind: 'money', axisGroup: 'count' },
  { key: 'clicks_price_median_self', label: 'Median Click Price (Self)', kind: 'money', axisGroup: 'count' },
  { key: 'cart_adds_price_median_total', label: 'Median Cart Price (Market)', kind: 'money', axisGroup: 'count' },
  { key: 'cart_adds_price_median_self', label: 'Median Cart Price (Self)', kind: 'money', axisGroup: 'count' },
  { key: 'purchases_price_median_total', label: 'Median Purchase Price (Market)', kind: 'money', axisGroup: 'count' },
  { key: 'purchases_price_median_self', label: 'Median Purchase Price (Self)', kind: 'money', axisGroup: 'count' },
];

const METRICS_BY_KEY = Object.fromEntries(
  METRIC_OPTIONS.map((metric) => [metric.key, metric])
) as Record<string, MetricOption>;

const CHART_COLORS = [
  '#0f172a',
  '#f97316',
  '#2563eb',
  '#16a34a',
  '#9333ea',
  '#facc15',
  '#0ea5e9',
  '#f43f5e',
];

const formatValueByKind = (value: number | null, kind: MetricOption['kind']): string => {
  if (kind === 'pct') return formatPercent(value);
  if (kind === 'money') return formatMoney(value);
  if (kind === 'index') return formatIndex(value);
  return formatNumber(value);
};

type SqpTrendInspectorProps = {
  availableWeeks: SqpWeek[];
  selectedFrom: string;
  selectedTo: string;
  trendKey: string;
  trendQueryLabel: string;
  metricKeys: string[];
  series: SqpTrendRow[];
};

type ChartMode = 'overlay' | 'small-multiples';

export default function SqpTrendInspector({
  availableWeeks,
  selectedFrom,
  selectedTo,
  trendKey,
  trendQueryLabel,
  metricKeys,
  series,
}: SqpTrendInspectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMetricPanelOpen, setIsMetricPanelOpen] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode | null>(null);
  const [normalizeOverlay, setNormalizeOverlay] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(
    null
  );

  const weeksAsc = useMemo(
    () => [...availableWeeks].sort((a, b) => a.week_end.localeCompare(b.week_end)),
    [availableWeeks]
  );

  const metricOptions = METRIC_OPTIONS;
  const appliedMetrics = useMemo(() => {
    const filtered = metricKeys.filter((key) => METRICS_BY_KEY[key]);
    return filtered.length > 0 ? filtered : ['search_query_volume'];
  }, [metricKeys]);
  const selectedMetricOptions = appliedMetrics.map((key) => METRICS_BY_KEY[key]);
  const [draftMetrics, setDraftMetrics] = useState<string[] | null>(null);
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);
  const draftMetricsValue = draftMetrics ?? appliedMetrics;
  const draftFromValue = draftFrom ?? selectedFrom;
  const draftToValue = draftTo ?? selectedTo;

  const basePoints = useMemo(() => {
    const sorted = [...series].sort((a, b) =>
      (a.week_end ?? '').localeCompare(b.week_end ?? '')
    );
    return sorted.map((row) => {
      const base: Record<string, number | null> = {};
      const raw: Record<string, number | null> = {};
      appliedMetrics.forEach((key) => {
        const value = toNumber(row[key as keyof typeof row]);
        base[key] = value;
        raw[`${key}__raw`] = value;
      });
      return {
        week_end: row.week_end ?? '',
        week_start: row.week_start ?? '',
        ...base,
        ...raw,
      };
    });
  }, [appliedMetrics, series]);

  const normalizedPoints = useMemo(() => {
    if (!normalizeOverlay) return basePoints;
    const maxByKey = new Map<string, number>();
    appliedMetrics.forEach((key) => {
      let max = 0;
      basePoints.forEach((point) => {
        const value = toNumber(point[key as keyof typeof point]);
        if (value !== null && value > max) max = value;
      });
      maxByKey.set(key, max);
    });
    return basePoints.map((point) => {
      const next: Record<string, number | null> = {};
      appliedMetrics.forEach((key) => {
        const rawValue = toNumber(point[key as keyof typeof point]);
        const max = maxByKey.get(key) ?? 0;
        next[key] = rawValue === null || max === 0 ? null : (rawValue / max) * 100;
      });
      return {
        ...point,
        ...next,
      };
    });
  }, [appliedMetrics, basePoints, normalizeOverlay]);

  const axisGroups = useMemo(() => {
    const groupSet = new Set<string>();
    selectedMetricOptions.forEach((metric) => groupSet.add(metric.axisGroup));
    return groupSet;
  }, [selectedMetricOptions]);

  const effectiveChartMode: ChartMode =
    chartMode ?? (appliedMetrics.length > 1 ? 'small-multiples' : 'overlay');

  const hasCountAxis = axisGroups.has('count');
  const hasRatioAxis = axisGroups.has('ratio');
  const ratioKinds = useMemo(() => {
    const kinds = new Set<MetricOption['kind']>();
    selectedMetricOptions.forEach((metric) => {
      if (metric.axisGroup === 'ratio') {
        kinds.add(metric.kind);
      }
    });
    return kinds;
  }, [selectedMetricOptions]);

  const formatRatioAxis = (value: number) => {
    if (ratioKinds.size === 1 && ratioKinds.has('pct')) {
      return formatPercent(value);
    }
    if (ratioKinds.size === 1 && ratioKinds.has('index')) {
      return formatIndex(value);
    }
    return formatNumber(value);
  };

  const handleParamChange = (updates: Record<string, string | null>) => {
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
  };

  const applyDraft = () => {
    const nextMetrics =
      draftMetrics && draftMetrics.length > 0 ? draftMetrics : appliedMetrics;
    const nextFrom = draftFrom ?? selectedFrom;
    const nextTo = draftTo ?? selectedTo;
    const params = new URLSearchParams(searchParams?.toString());
    params.set('tab', 'sqp');
    params.set('sqp_trend_kpis', nextMetrics.join(','));
    params.set('sqp_trend_from', nextFrom);
    params.set('sqp_trend_to', nextTo);
    router.replace(`?${params.toString()}`);
    setIsMetricPanelOpen(false);
  };

  const resetDraft = () => {
    setDraftMetrics(null);
    setDraftFrom(null);
    setDraftTo(null);
  };

  useLayoutEffect(() => {
    if (!isMetricPanelOpen) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;
      const triggerRect = trigger.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();
      const padding = 12;
      let left = triggerRect.left;
      let top = triggerRect.bottom + 8;
      if (left + popRect.width > window.innerWidth - padding) {
        left = window.innerWidth - padding - popRect.width;
      }
      if (left < padding) left = padding;
      if (top + popRect.height > window.innerHeight - padding) {
        const altTop = triggerRect.top - popRect.height - 8;
        if (altTop >= padding) top = altTop;
      }
      setPopoverPosition({ top, left });
    };
    updatePosition();
    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMetricPanelOpen]);

  useEffect(() => {
    if (!isMetricPanelOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setIsMetricPanelOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMetricPanelOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isMetricPanelOpen]);

  const formatNormalizedPercent = (value: number) => `${value.toFixed(0)}%`;

  const renderOverlayChart = () => {
    if (normalizedPoints.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
          No data available for this trend.
        </div>
      );
    }

    return (
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={normalizedPoints}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="week_end"
              tickFormatter={(value) => (typeof value === 'string' ? formatSqpWeekLabel(value) : '')}
              stroke="#94a3b8"
            />
            {hasCountAxis ? (
              <YAxis
                yAxisId="count"
                tickFormatter={(value) =>
                  normalizeOverlay ? formatNormalizedPercent(Number(value)) : formatNumber(Number(value))
                }
                stroke="#94a3b8"
                domain={normalizeOverlay ? [0, 100] : undefined}
              />
            ) : null}
            {hasRatioAxis ? (
              <YAxis
                yAxisId="ratio"
                orientation={hasCountAxis ? 'right' : 'left'}
                tickFormatter={(value) =>
                  normalizeOverlay ? formatNormalizedPercent(Number(value)) : formatRatioAxis(Number(value))
                }
                stroke="#94a3b8"
                width={hasCountAxis ? 80 : 70}
                domain={normalizeOverlay ? [0, 100] : undefined}
              />
            ) : null}
            <Tooltip
              labelFormatter={(label) =>
                typeof label === 'string' ? `Week ending ${label}` : ''
              }
              formatter={(value, name, props) => {
                const dataKey = props.dataKey as string;
                const metric = METRICS_BY_KEY[dataKey];
                if (!metric) return value as string;
                if (!normalizeOverlay) {
                  return formatValueByKind(Number(value), metric.kind);
                }
                const rawValue = toNumber(
                  (props.payload as Record<string, unknown>)?.[`${dataKey}__raw`]
                );
                const rawFormatted = formatValueByKind(rawValue, metric.kind);
                const normalizedValue = Number(value);
                if (!Number.isFinite(normalizedValue)) return rawFormatted;
                return `${rawFormatted} · ${formatNormalizedPercent(normalizedValue)}`;
              }}
            />
            {selectedMetricOptions.map((metric, index) => (
              <Line
                key={metric.key}
                type="linear"
                dataKey={metric.key}
                yAxisId={metric.axisGroup}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                name={metric.label}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderSmallMultiples = () => {
    if (basePoints.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
          No data available for this trend.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {selectedMetricOptions.map((metric, index) => (
          <div key={metric.key} className="rounded-lg border border-border bg-background/30 p-3">
            <div className="mb-2 text-xs font-semibold text-foreground">{metric.label}</div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={basePoints}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="week_end"
                    tickFormatter={(value) =>
                      typeof value === 'string' ? formatSqpWeekLabel(value) : ''
                    }
                    stroke="#94a3b8"
                  />
                  <YAxis
                    tickFormatter={(value) => formatValueByKind(Number(value), metric.kind)}
                    stroke="#94a3b8"
                    width={80}
                  />
                  <Tooltip
                    labelFormatter={(label) =>
                      typeof label === 'string' ? `Week ending ${label}` : ''
                    }
                    formatter={(value) => formatValueByKind(Number(value), metric.kind)}
                  />
                  <Line
                    type="linear"
                    dataKey={metric.key}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={metric.label}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Trend</div>
          <div className="mt-2 text-lg font-semibold text-foreground">
            {trendQueryLabel}
          </div>
          <div className="mt-1 text-xs text-muted">Key {trendKey}</div>
        </div>
        <button
          type="button"
          onClick={() =>
            handleParamChange({
              sqp_trend: null,
              sqp_trend_query: null,
              sqp_trend_kpis: null,
              sqp_trend_metrics: null,
              sqp_trend_from: null,
              sqp_trend_to: null,
            })
          }
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2"
        >
          Close
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative">
          <button
            type="button"
            ref={triggerRef}
            onClick={() => {
              setDraftMetrics((prev) => prev ?? appliedMetrics);
              setIsMetricPanelOpen((prev) => !prev);
            }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground"
          >
            KPIs ({draftMetricsValue.length})
          </button>
          {isMetricPanelOpen
            ? createPortal(
                <div
                  ref={popoverRef}
                  style={{
                    position: 'fixed',
                    top: popoverPosition?.top ?? 0,
                    left: popoverPosition?.left ?? -9999,
                  }}
                  className="z-50 w-72 rounded-xl border border-border bg-surface p-3 text-xs text-muted shadow-lg"
                >
                  <div className="mb-2 text-[10px] uppercase tracking-wide text-muted">
                    Select KPIs
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {metricOptions.map((metric) => {
                      const checked = draftMetricsValue.includes(metric.key);
                      return (
                        <label
                          key={metric.key}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-xs text-foreground">
                            {metric.label}
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? draftMetricsValue.filter((key) => key !== metric.key)
                                : [...draftMetricsValue, metric.key];
                              if (next.length === 0) return;
                              setDraftMetrics(next);
                            }}
                            className="h-4 w-4 rounded border-border"
                          />
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={resetDraft}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-surface-2"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={applyDraft}
                      className="rounded-md border border-primary bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:opacity-90"
                    >
                      Apply
                    </button>
                  </div>
                </div>,
                document.body
              )
            : null}
        </div>
        <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
          Chart mode
          <div className="mt-1 inline-flex rounded-lg border border-border bg-surface p-1">
            {(
              [
                { value: 'overlay', label: 'Overlay' },
                { value: 'small-multiples', label: 'Small multiples' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setChartMode(option.value)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  effectiveChartMode === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-surface-2'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </label>
        {effectiveChartMode === 'overlay' ? (
          <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
            Normalize
            <div className="mt-1 inline-flex rounded-lg border border-border bg-surface p-1">
              <button
                type="button"
                onClick={() => setNormalizeOverlay((prev) => !prev)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  normalizeOverlay
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-surface-2'
                }`}
              >
                {normalizeOverlay ? '0–100' : 'Off'}
              </button>
            </div>
          </label>
        ) : null}
        <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
          From week
          <select
            value={draftFromValue}
            onChange={(event) => {
              const nextFrom = event.target.value;
              const nextTo = nextFrom > draftToValue ? nextFrom : draftToValue;
              setDraftFrom(nextFrom);
              setDraftTo(nextTo);
            }}
            className="mt-1 min-w-[160px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            {weeksAsc.map((week) => (
              <option key={week.week_end} value={week.week_end}>
                {formatSqpWeekLabel(week.week_end)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
          To week
          <select
            value={draftToValue}
            onChange={(event) => {
              const nextTo = event.target.value;
              const nextFrom = nextTo < draftFromValue ? nextTo : draftFromValue;
              setDraftFrom(nextFrom);
              setDraftTo(nextTo);
            }}
            className="mt-1 min-w-[160px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            {weeksAsc.map((week) => (
              <option key={week.week_end} value={week.week_end}>
                {formatSqpWeekLabel(week.week_end)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={applyDraft}
            className="rounded-lg border border-primary bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={resetDraft}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background/40 p-4">
        {effectiveChartMode === 'overlay' ? renderOverlayChart() : renderSmallMultiples()}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[320px] w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="border-b border-border pb-2">Week</th>
              {selectedMetricOptions.map((metric) => (
                <th key={metric.key} className="border-b border-border pb-2">
                  {metric.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {basePoints.map((point) => {
              return (
                <tr key={point.week_end}>
                  <td className="border-b border-border/60 py-2 text-foreground">
                    {formatSqpWeekLabel(point.week_end)}
                  </td>
                  {selectedMetricOptions.map((metric) => (
                    <td
                      key={`${point.week_end}-${metric.key}`}
                      className="border-b border-border/60 py-2 text-foreground"
                    >
                      {formatValueByKind(
                        toNumber(point[metric.key as keyof typeof point]),
                        metric.kind
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
