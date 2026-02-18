'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import InlineFilters from '@/components/InlineFilters';
import SalesPivotTable from '@/components/sales/SalesPivotTable';
import SalesMultiMetricChart from '@/components/sales/SalesMultiMetricChart';
import type { SalesDailyPoint } from '@/lib/sales/getSalesDaily';
import { getCalendarBuckets, type CalendarBucket, type SalesGranularity } from '@/lib/sales/buckets/getCalendarBuckets';
import { bucketAggregate } from '@/lib/sales/pivot/bucketAggregate';
import { buildPivotRows, type PivotRow } from '@/lib/sales/pivot/pivotRows';
import {
  DEFAULT_ENABLED_METRICS,
  DEFAULT_KPI_CARD_SLOTS,
  SALES_METRIC_KEYS,
  SALES_METRICS,
  type SalesMetricKey,
} from '@/lib/sales/salesMetrics';
import { saveSalesTrendSettings } from '@/app/sales/trend/actions';

type AsinOption = {
  asin: string;
  label: string;
};

type SalesTrendSettings = {
  enabledMetrics?: string[];
  cardSlots?: string[];
};

type SalesTrendBucketConfig = {
  granularity: SalesGranularity;
  cols: number;
  last: string;
};

type SalesTrendInteractiveProps = {
  dailyRows: SalesDailyPoint[];
  kpiTotals: Record<string, number | null | undefined>;
  filters: { start: string; end: string; asin: string };
  bucketConfig: SalesTrendBucketConfig;
  buckets: CalendarBucket[];
  asinOptions: AsinOption[];
  defaultSettings: SalesTrendSettings | null;
};

const METRIC_LABELS = Object.fromEntries(
  SALES_METRICS.map((metric) => [metric.key, metric.label])
) as Record<SalesMetricKey, string>;

const SESSION_STORAGE_KEY = 'sales.trend.session';
const KPI_COLLAPSE_KEY = 'sales.trend:kpisCollapsed';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeISODate = (value: string): string | null => {
  if (!DATE_RE.test(value)) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return value;
};

const clampCols = (value: number, min = 1, max = 120): number =>
  Math.min(Math.max(value, min), max);

const groupMetrics = () => {
  const grouped = new Map<string, SalesMetricKey[]>();
  SALES_METRICS.forEach((metric) => {
    const list = grouped.get(metric.group) ?? [];
    list.push(metric.key);
    grouped.set(metric.group, list);
  });
  return grouped;
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
};

const formatMetricValue = (key: SalesMetricKey, value?: number | null) => {
  const metric = SALES_METRICS.find((item) => item.key === key);
  if (!metric) return '—';
  switch (metric.format) {
    case 'currency':
      return formatCurrency(value ?? null);
    case 'percent':
      return formatPercent(value ?? null);
    default:
      return formatNumber(value ?? null);
  }
};

const normalizeMetricKeys = (value?: string[] | null): SalesMetricKey[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is SalesMetricKey => SALES_METRIC_KEYS.has(item as SalesMetricKey)
  );
};

const sanitizeSettings = (settings: SalesTrendSettings | null) => {
  const enabled = normalizeMetricKeys(settings?.enabledMetrics);
  const enabledMetrics = enabled.length > 0 ? enabled : DEFAULT_ENABLED_METRICS;

  const slots = normalizeMetricKeys(settings?.cardSlots);
  const cardSlots: SalesMetricKey[] = [];

  for (let index = 0; index < 8; index += 1) {
    const fallback = DEFAULT_KPI_CARD_SLOTS[index] ?? enabledMetrics[0];
    const candidate = slots[index] ?? fallback;
    cardSlots.push(
      enabledMetrics.includes(candidate) ? candidate : enabledMetrics[0]
    );
  }

  return { enabledMetrics, cardSlots };
};

const DEFAULT_CHART_METRICS: SalesMetricKey[] = ['sales', 'ppc_cost', 'tacos'];

export default function SalesTrendInteractive({
  dailyRows,
  kpiTotals,
  filters,
  bucketConfig,
  buckets,
  asinOptions,
  defaultSettings,
}: SalesTrendInteractiveProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupedMetrics = useMemo(() => groupMetrics(), []);
  const initial = useMemo(() => sanitizeSettings(defaultSettings), [defaultSettings]);
  const sessionLoadedRef = useRef(false);

  const [enabledMetrics, setEnabledMetrics] = useState<SalesMetricKey[]>(
    initial.enabledMetrics
  );
  const [cardSlots, setCardSlots] = useState<(SalesMetricKey | 'none')[]>(
    initial.cardSlots
  );
  const [chartMetrics, setChartMetrics] = useState<SalesMetricKey[]>(() => {
    const fallback = DEFAULT_CHART_METRICS.filter((key) =>
      initial.enabledMetrics.includes(key)
    );
    return fallback.length > 0 ? fallback : initial.enabledMetrics.slice(0, 2);
  });
  const [granularity, setGranularity] = useState<SalesGranularity>(
    bucketConfig.granularity
  );
  const [cols, setCols] = useState<string>(String(bucketConfig.cols));
  const [lastDate, setLastDate] = useState<string>(bucketConfig.last);
  const [asin, setAsin] = useState<string>(filters.asin);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftMetrics, setDraftMetrics] = useState<SalesMetricKey[]>(
    initial.enabledMetrics
  );
  const [kpisCollapsed, setKpisCollapsed] = useState(true);
  const [savedMessage, setSavedMessage] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setGranularity(bucketConfig.granularity);
    setCols(String(bucketConfig.cols));
    setLastDate(bucketConfig.last);
    setAsin(filters.asin);
  }, [bucketConfig.granularity, bucketConfig.cols, bucketConfig.last, filters.asin]);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      sessionLoadedRef.current = true;
      return;
    }
    try {
      const parsed = JSON.parse(stored) as {
        enabledMetrics?: SalesMetricKey[];
        cardSlots?: Array<SalesMetricKey | 'none'>;
        chartMetrics?: SalesMetricKey[];
      };
      if (parsed.enabledMetrics?.length) {
        setEnabledMetrics(parsed.enabledMetrics);
        setDraftMetrics(parsed.enabledMetrics);
      }
      if (parsed.cardSlots?.length) {
        setCardSlots(
          parsed.cardSlots.map((slot) =>
            slot === 'none' ? 'none' : (slot as SalesMetricKey)
          )
        );
      }
      if (parsed.chartMetrics?.length) {
        setChartMetrics(parsed.chartMetrics);
      }
    } catch (error) {
      console.warn('Failed to parse sales trend session settings', error);
    } finally {
      sessionLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem(KPI_COLLAPSE_KEY);
    if (stored === null) return;
    setKpisCollapsed(stored === 'true');
  }, []);

  useEffect(() => {
    if (!sessionLoadedRef.current) return;
    const payload = JSON.stringify({
      enabledMetrics,
      cardSlots,
      chartMetrics,
    });
    sessionStorage.setItem(SESSION_STORAGE_KEY, payload);
  }, [enabledMetrics, cardSlots, chartMetrics]);

  useEffect(() => {
    sessionStorage.setItem(KPI_COLLAPSE_KEY, String(kpisCollapsed));
  }, [kpisCollapsed]);

  const applyEnabledMetrics = (metrics: SalesMetricKey[]) => {
    const sanitized = metrics.length > 0 ? metrics : DEFAULT_ENABLED_METRICS;
    setEnabledMetrics(sanitized);
    setChartMetrics((current) => {
      const filtered = current.filter((key) => sanitized.includes(key));
      if (filtered.length > 0) return filtered;
      const fallback = DEFAULT_CHART_METRICS.filter((key) =>
        sanitized.includes(key)
      );
      return fallback.length > 0 ? fallback : sanitized.slice(0, 2);
    });
    setCardSlots((current) =>
      current.map((slot) =>
        slot === 'none' || sanitized.includes(slot) ? slot : sanitized[0]
      )
    );
  };

  const handleToggleMetric = (key: SalesMetricKey) => {
    setDraftMetrics((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  };

  const handleSaveDefaults = () => {
    const safeMetrics = draftMetrics.length > 0 ? draftMetrics : DEFAULT_ENABLED_METRICS;
    const cardSlotsForSave: SalesMetricKey[] = cardSlots.map((slot, index) => {
      if (slot !== 'none' && safeMetrics.includes(slot)) return slot;
      const fallback = DEFAULT_KPI_CARD_SLOTS[index] ?? safeMetrics[0];
      return safeMetrics.includes(fallback) ? fallback : safeMetrics[0];
    });

    setSavedMessage('');
    startTransition(async () => {
      await saveSalesTrendSettings({
        enabledMetrics: safeMetrics,
        cardSlots: cardSlotsForSave,
      });
      setSavedMessage('Saved');
    });
  };

  const { bucketTotals, summaryTotals } = useMemo(
    () => bucketAggregate(dailyRows, buckets),
    [dailyRows, buckets]
  );

  const pivotRows = useMemo<PivotRow[]>(
    () =>
      buildPivotRows(bucketTotals, summaryTotals, { enabledMetrics }),
    [bucketTotals, summaryTotals, enabledMetrics]
  );

  const chartData = useMemo(
    () =>
      buckets.map((bucket, index) => {
        const row: Record<string, number | string | null> = {
          date: bucket.end,
        };
        chartMetrics.forEach((key) => {
          row[key] = bucketTotals[key]?.[index] ?? null;
        });
        return row;
      }),
    [buckets, bucketTotals, chartMetrics]
  );

  return (
    <div className="space-y-8">
      <InlineFilters>
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Sales trend
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {filters.start} → {filters.end}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {bucketConfig.granularity} - {buckets.length} periods
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
            Granularity
            <select
              value={granularity}
              onChange={(event) =>
                setGranularity(event.target.value as SalesGranularity)
              }
              className="mt-1 min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </label>
          <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
            Columns
            <input
              type="number"
              min={1}
              max={120}
              value={cols}
              onChange={(event) => setCols(event.target.value)}
              className="mt-1 w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            />
          </label>
          <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
            Last date
            <input
              type="date"
              value={lastDate}
              onChange={(event) => setLastDate(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            />
          </label>
          <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
            Product (ASIN)
            <select
              value={asin}
              onChange={(event) => setAsin(event.target.value)}
              className="mt-1 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="all">All products</option>
              {asinOptions.map((option) => (
                <option key={option.asin} value={option.asin}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              const numericCols = clampCols(Number.parseInt(cols, 10) || 1);
              const safeLast = normalizeISODate(lastDate) ?? filters.end;
              const nextBuckets = getCalendarBuckets({
                last: safeLast,
                cols: numericCols,
                granularity,
              });
              const nextStart = nextBuckets[0]?.start ?? safeLast;
              const params = new URLSearchParams(searchParams?.toString());
              params.set('granularity', granularity);
              params.set('cols', String(numericCols));
              params.set('last', safeLast);
              params.set('start', nextStart);
              params.set('end', safeLast);
              params.set('asin', asin);
              router.push(`?${params.toString()}`);
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraftMetrics(enabledMetrics);
              setIsPickerOpen(true);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Metrics
          </button>
        </div>
      </InlineFilters>

      {isPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Metrics
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  Choose KPI metrics
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="text-sm font-semibold text-slate-500"
              >
                Close
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              {Array.from(groupedMetrics.entries()).map(([group, keys]) => (
                <div key={group} className="mb-6">
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    {group}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {keys.map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={draftMetrics.includes(key)}
                          onChange={() => handleToggleMetric(key)}
                        />
                        {METRIC_LABELS[key]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
              <div className="text-xs text-slate-500">
                {draftMetrics.length} metrics selected
              </div>
              <div className="flex items-center gap-2">
                {savedMessage ? (
                  <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {savedMessage}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    applyEnabledMetrics(draftMetrics);
                    setIsPickerOpen(false);
                  }}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Apply
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSaveDefaults}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Set as default
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              KPI cards
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              Customize each slot
            </div>
          </div>
          <button
            type="button"
            onClick={() => setKpisCollapsed((current) => !current)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
            aria-expanded={!kpisCollapsed}
          >
            <span
              className={`inline-block text-[10px] transition-transform ${
                kpisCollapsed ? 'rotate-0' : 'rotate-90'
              }`}
            >
              ▸
            </span>
            {kpisCollapsed ? 'Show KPIs' : 'Hide KPIs'}
          </button>
        </div>
        {kpisCollapsed ? null : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {cardSlots.map((slot, index) => (
              <div
                key={`slot-${index}`}
                className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    Slot {index + 1}
                  </div>
                  <select
                    value={slot}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCardSlots((current) => {
                        const updated = [...current];
                        updated[index] =
                          value === 'none' ? 'none' : (value as SalesMetricKey);
                        return updated;
                      });
                    }}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                  >
                    <option value="none">None</option>
                    {enabledMetrics.map((metric) => (
                      <option key={metric} value={metric}>
                        {METRIC_LABELS[metric]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-900">
                  {slot === 'none'
                    ? 'Hidden'
                    : formatMetricValue(
                        slot,
                        (summaryTotals[slot] as number | null | undefined) ??
                          (kpiTotals[slot] as number | null | undefined) ??
                          null
                      )}
                </div>
                {slot !== 'none' ? (
                  <div className="mt-1 text-xs text-slate-500">
                    {METRIC_LABELS[slot]}
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-slate-400">Select a metric</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Trend chart
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {chartMetrics.length} metrics selected
            </div>
          </div>
          <div className="text-xs text-slate-500">{buckets.length} periods</div>
        </div>
        {dailyRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No sales data for this range.
          </div>
        ) : (
          <SalesMultiMetricChart data={chartData} metrics={chartMetrics} />
        )}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">
            Customize chart series
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {enabledMetrics.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chartMetrics.includes(key)}
                  onChange={() => {
                    setChartMetrics((current) => {
                      if (current.includes(key)) {
                        return current.filter((item) => item !== key);
                      }
                      return [...current, key];
                    });
                  }}
                />
                {METRIC_LABELS[key]}
              </label>
            ))}
          </div>
        </details>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              KPI breakdown
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {buckets.length} periods • {enabledMetrics.length} KPIs
            </div>
          </div>
        </div>
        {pivotRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No sales data for this range.
          </div>
        ) : (
          <SalesPivotTable
            buckets={buckets}
            granularity={bucketConfig.granularity}
            rows={pivotRows}
            formatValue={formatMetricValue}
          />
        )}
      </section>
    </div>
  );
}
