'use client';

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import KpiCards from '@/components/KpiCards';
import type { SpTrendMarker, SpTrendMetricCell, SpWorkspaceTrendData } from '@/lib/ads/spWorkspaceTrendModel';

type KpiItem = {
  label: string;
  value: string;
  subvalue?: string;
};

type AdsWorkspaceTrendClientProps = {
  level: 'campaigns' | 'targets';
  kpiItems: KpiItem[];
  trendData: SpWorkspaceTrendData;
};

const formatDateHeader = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  return parsed.toLocaleString('en-US');
};

const formatCellValue = (value: number | null, kind: string) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (kind === 'currency') {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
    });
  }
  if (kind === 'percent') {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (kind === 'ratio') {
    return value.toFixed(2);
  }
  if (kind === 'rank') {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return value.toLocaleString('en-US', {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  });
};

const validationTone = (status: string | null) => {
  if (status === 'validated') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
  if (status === 'mismatch') return 'border-rose-500/30 bg-rose-500/10 text-rose-700';
  if (status === 'pending') return 'border-amber-500/30 bg-amber-500/10 text-amber-700';
  if (status === 'not_found') return 'border-slate-500/30 bg-slate-500/10 text-slate-700';
  return 'border-border bg-surface-2 text-muted';
};

const markerTitle = (marker: SpTrendMarker) =>
  marker.entity_type ? `${marker.entity_type} · ${marker.change_type}` : marker.change_type;

export default function AdsWorkspaceTrendClient({
  level,
  kpiItems,
  trendData,
}: AdsWorkspaceTrendClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRouting, startRouting] = useTransition();
  const [activeMarkerDate, setActiveMarkerDate] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{ metricLabel: string; kind: string; cell: SpTrendMetricCell; note: string | null } | null>(null);

  const activeMarkerIds = activeMarkerDate ? trendData.markersByDate[activeMarkerDate] ?? [] : [];
  const activeMarkers = activeMarkerIds
    .map((markerId) => trendData.markers.find((marker) => marker.change_id === markerId) ?? null)
    .filter((marker): marker is SpTrendMarker => Boolean(marker));

  const defaultHovered = useMemo(() => {
    const firstMetric = trendData.metricRows[0];
    const firstCell = firstMetric?.cells[0];
    if (!firstMetric || !firstCell) return null;
    return {
      metricLabel: firstMetric.label,
      kind: firstMetric.kind,
      cell: firstCell,
      note: firstMetric.support_note,
    };
  }, [trendData.metricRows]);

  const hoveredCell = hovered ?? defaultHovered;

  const changeEntity = (nextEntityId: string) => {
    startRouting(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('trend_entity', nextEntityId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  if (trendData.entities.length === 0 || trendData.metricRows.length === 0) {
    return (
      <section className="space-y-6">
        <KpiCards items={kpiItems} />
        <div className="rounded-2xl border border-dashed border-border bg-surface/80 px-5 py-10 text-sm text-muted">
          No {level === 'campaigns' ? 'campaign' : 'target'} trend rows matched the current workspace filters.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <KpiCards items={kpiItems} />

      <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">
              {trendData.entityCountLabel}
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {trendData.selectedEntityLabel}
            </div>
            <div className="mt-2 max-w-2xl text-sm text-muted">
              Trend mode stays diagnostic-first. Table mode remains the editing surface.
            </div>
          </div>
          <label className="flex min-w-0 flex-col text-xs uppercase tracking-[0.18em] text-muted lg:w-[320px]">
            {level === 'campaigns' ? 'Campaign' : 'Target'}
            <select
              value={trendData.selectedEntityId ?? ''}
              onChange={(event) => changeEntity(event.target.value)}
              className="mt-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm normal-case text-foreground"
            >
              {trendData.entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isRouting ? (
        <div className="rounded-2xl border border-border bg-surface/80 px-5 py-4 text-sm text-muted shadow-sm">
          Loading trend…
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-2xl border border-border bg-surface/80 shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">Daily trend</div>
            <div className="mt-1 text-sm text-muted">
              Dates stay horizontal, KPIs stay vertical, and change markers open frozen logbook details.
            </div>
          </div>
          <div className="max-h-[720px] overflow-y-auto">
            <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
              <table
                className="min-w-[calc(180px+96px*7)] w-full text-left text-sm"
                style={{ ['--metric-col-w' as string]: '180px', ['--day-col-w' as string]: '96px' }}
              >
                <thead className="sticky top-0 z-10 bg-surface text-[11px] uppercase tracking-[0.18em] text-muted">
                  <tr className="border-b border-border">
                    <th className="sticky left-0 z-20 w-[var(--metric-col-w)] border-r border-border bg-surface px-3 py-3 font-semibold">
                      KPI
                    </th>
                    {trendData.dates.map((date) => {
                      const markerIds = trendData.markersByDate[date] ?? [];
                      return (
                        <th
                          key={date}
                          className="w-[var(--day-col-w)] border-r border-border/60 px-2 py-3 text-center font-semibold"
                        >
                          <div>{formatDateHeader(date)}</div>
                          <div className="mt-1 text-[10px] normal-case tracking-normal text-muted">
                            {date}
                          </div>
                          {markerIds.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveMarkerDate((current) => (current === date ? null : date))
                              }
                              className="mt-2 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-amber-700"
                            >
                              {markerIds.length} change{markerIds.length === 1 ? '' : 's'}
                            </button>
                          ) : null}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trendData.metricRows.map((metric) => (
                    <tr key={metric.key} className="bg-surface/70">
                      <th className="sticky left-0 z-10 w-[var(--metric-col-w)] border-r border-border bg-surface px-3 py-3 text-left">
                        <div className="font-semibold text-foreground">{metric.label}</div>
                        {metric.support_note ? (
                          <div className="mt-1 text-xs font-normal normal-case tracking-normal text-muted">
                            {metric.support_note}
                          </div>
                        ) : null}
                      </th>
                      {metric.cells.map((cell) => {
                        const hasMarkers = cell.marker_ids.length > 0;
                        return (
                          <td
                            key={`${metric.key}:${cell.date}`}
                            className={`border-r border-border/60 px-2 py-3 align-top ${
                              hasMarkers ? 'border-t-2 border-t-amber-400/60' : ''
                            }`}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onMouseEnter={() =>
                                setHovered({
                                  metricLabel: metric.label,
                                  kind: metric.kind,
                                  cell,
                                  note: metric.support_note,
                                })
                              }
                              onFocus={() =>
                                setHovered({
                                  metricLabel: metric.label,
                                  kind: metric.kind,
                                  cell,
                                  note: metric.support_note,
                                })
                              }
                              className="rounded-xl border border-transparent px-2 py-2 text-right text-sm text-foreground outline-none transition hover:border-border hover:bg-surface-2/60 focus:border-primary/30 focus:bg-surface-2/60"
                            >
                              {formatCellValue(cell.value, metric.kind)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">Hover drill-in</div>
            {hoveredCell ? (
              <>
                <div className="mt-2 text-lg font-semibold text-foreground">
                  {hoveredCell.metricLabel}
                </div>
                <div className="mt-1 text-sm text-muted">{hoveredCell.cell.date}</div>
                <div className="mt-4 text-3xl font-semibold text-foreground">
                  {formatCellValue(hoveredCell.cell.value, hoveredCell.kind)}
                </div>
                <div className="mt-3 text-sm text-muted">
                  {hoveredCell.note ?? 'Daily value from the current SP facts layer for the selected entity.'}
                </div>
                <div className="mt-3 text-xs text-muted">
                  {hoveredCell.cell.marker_ids.length > 0
                    ? `${hoveredCell.cell.marker_ids.length} change marker(s) on this date.`
                    : 'No frozen change markers on this date.'}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-muted">Hover a daily KPI cell to inspect it.</div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.2em] text-muted">Change markers</div>
              {activeMarkerDate ? (
                <button
                  type="button"
                  onClick={() => setActiveMarkerDate(null)}
                  className="text-xs font-semibold text-muted"
                >
                  Close
                </button>
              ) : null}
            </div>
            {activeMarkerDate ? (
              <div className="mt-3 space-y-3">
                <div className="text-sm font-semibold text-foreground">{activeMarkerDate}</div>
                {activeMarkers.map((marker) => (
                  <div
                    key={marker.change_id}
                    className="rounded-2xl border border-border bg-surface-2/60 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {markerTitle(marker)}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${validationTone(marker.validation_status)}`}
                      >
                        {marker.validation_status ?? 'unvalidated'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-foreground">{marker.summary}</div>
                    {marker.why ? (
                      <div className="mt-2 text-sm text-muted">{marker.why}</div>
                    ) : null}
                    <div className="mt-2 text-xs text-muted">
                      {formatDateTime(marker.occurred_at)}
                      {marker.validated_snapshot_date
                        ? ` · validated snapshot ${marker.validated_snapshot_date}`
                        : ''}
                    </div>
                    {marker.fields.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {marker.fields.map((field) => (
                          <div key={`${marker.change_id}:${field.key}`} className="text-xs text-muted">
                            <span className="font-semibold text-foreground">{field.label}:</span>{' '}
                            {field.before ?? '—'} → {field.after ?? '—'}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted">
                Click a date chip in the trend header to inspect generated/validated change details.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
