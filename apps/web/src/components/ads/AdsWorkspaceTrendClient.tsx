'use client';

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import KpiCards from '@/components/KpiCards';
import AdsWorkspaceStateBar from '@/components/ads/AdsWorkspaceStateBar';
import SpChangeComposer from '@/components/ads/SpChangeComposer';
import type { SpCampaignsWorkspaceRow } from '@/lib/ads/spWorkspaceTablesModel';
import type { SpTargetsWorkspaceRow } from '@/lib/ads/spTargetsWorkspaceModel';
import type { SaveSpDraftActionState } from '@/lib/ads-workspace/spChangeComposerState';
import type { AdsObjectivePreset, JsonObject } from '@/lib/ads-workspace/types';
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
  filtersJson: JsonObject;
  objectivePresets: AdsObjectivePreset[];
  activeDraft: {
    id: string;
    name: string;
    queueCount: number;
  } | null;
  saveDraftAction: (
    prevState: SaveSpDraftActionState,
    formData: FormData
  ) => Promise<SaveSpDraftActionState>;
  initialComposerRow: SpCampaignsWorkspaceRow | SpTargetsWorkspaceRow | null;
  showIds: boolean;
  campaignScopeId?: string | null;
  adGroupScopeId?: string | null;
  campaignScopeLabel?: string | null;
  adGroupScopeLabel?: string | null;
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

const MINI_BAR_HEIGHT = 32;
const MINI_BAR_MIN_VISIBLE_HEIGHT = 6;

const buildMiniBarMetrics = (cells: SpTrendMetricCell[], kind: string) => {
  const values = cells.map((cell) => cell.value);
  const finiteValues = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (finiteValues.length === 0) {
    return {
      hasData: false,
      bars: [] as Array<number | null>,
      baseline: MINI_BAR_HEIGHT,
      hasNegative: false,
    };
  }

  const max = Math.max(...finiteValues);
  const min = Math.min(...finiteValues);
  const hasNegative = min < 0;
  const positiveMax = Math.max(max, 0);
  const negativeMax = Math.max(Math.abs(min), 0);
  const baseline = hasNegative
    ? (positiveMax / Math.max(positiveMax + negativeMax, 1)) * MINI_BAR_HEIGHT
    : MINI_BAR_HEIGHT;
  const positiveHeight = Math.max(baseline, 1);
  const negativeHeight = Math.max(MINI_BAR_HEIGHT - baseline, 1);
  const useLocalContrastScaling = kind === 'percent';

  const withVisibleFloor = (scaledHeight: number, availableHeight: number, value: number) => {
    if (value === 0) return 0;
    return Math.min(
      availableHeight,
      Math.max(MINI_BAR_MIN_VISIBLE_HEIGHT, scaledHeight)
    );
  };
  const positiveNonZeroValues = finiteValues.filter((value) => value > 0);
  const negativeAbsValues = finiteValues.filter((value) => value < 0).map((value) => Math.abs(value));
  const positiveMin = positiveNonZeroValues.length > 0 ? Math.min(...positiveNonZeroValues) : null;
  const negativeMin = negativeAbsValues.length > 0 ? Math.min(...negativeAbsValues) : null;
  const scaleWithLocalContrast = (
    magnitude: number,
    minMagnitude: number | null,
    maxMagnitude: number,
    availableHeight: number
  ) => {
    if (magnitude === 0) return 0;
    if (!useLocalContrastScaling || minMagnitude === null || maxMagnitude <= 0) {
      return withVisibleFloor((magnitude / Math.max(maxMagnitude, 1)) * availableHeight, availableHeight, magnitude);
    }
    if (maxMagnitude === minMagnitude) {
      return withVisibleFloor(availableHeight * 0.72, availableHeight, magnitude);
    }
    const normalized = (magnitude - minMagnitude) / (maxMagnitude - minMagnitude);
    return withVisibleFloor(
      MINI_BAR_MIN_VISIBLE_HEIGHT + normalized * (availableHeight - MINI_BAR_MIN_VISIBLE_HEIGHT),
      availableHeight,
      magnitude
    );
  };

  return {
    hasData: true,
    bars: values.map((value) => {
      if (value === null || !Number.isFinite(value)) return null;
      if (value < 0) {
        return scaleWithLocalContrast(Math.abs(value), negativeMin, negativeMax, negativeHeight);
      }
      return scaleWithLocalContrast(value, positiveMin, positiveMax, positiveHeight);
    }),
    baseline,
    hasNegative,
  };
};

export default function AdsWorkspaceTrendClient({
  level,
  kpiItems,
  trendData,
  filtersJson,
  objectivePresets,
  activeDraft: initialActiveDraft,
  saveDraftAction,
  initialComposerRow,
  showIds,
  campaignScopeId,
  adGroupScopeId,
  campaignScopeLabel,
  adGroupScopeLabel,
}: AdsWorkspaceTrendClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRouting, startRouting] = useTransition();
  const [activeDraft, setActiveDraft] = useState(initialActiveDraft);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
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

  const closeComposer = () => {
    startRouting(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('compose_level');
      params.delete('compose_row');
      params.delete('compose_child');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleSaved = (state: SaveSpDraftActionState) => {
    if (!state.ok || !state.changeSetId || !state.changeSetName) return;
    const nextChangeSetId = state.changeSetId;
    const nextChangeSetName = state.changeSetName;

    setFlashMessage(state.message);
    setActiveDraft({
      id: nextChangeSetId,
      name: nextChangeSetName,
      queueCount: state.queueCount,
    });

    startRouting(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('change_set', nextChangeSetId);
      params.delete('compose_level');
      params.delete('compose_row');
      params.delete('compose_child');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      router.refresh();
    });
  };

  if (trendData.entities.length === 0 || trendData.metricRows.length === 0) {
    return (
      <section className="space-y-6">
        <KpiCards items={kpiItems} />
        <AdsWorkspaceStateBar
          showIds={showIds}
          campaignScopeId={campaignScopeId}
          adGroupScopeId={adGroupScopeId}
          campaignScopeLabel={campaignScopeLabel}
          adGroupScopeLabel={adGroupScopeLabel}
        />
        <div className="rounded-2xl border border-dashed border-border bg-surface/80 px-5 py-10 text-sm text-muted">
          No {level === 'campaigns' ? 'campaign' : 'target'} trend rows matched the current workspace filters.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <KpiCards items={kpiItems} />
      <AdsWorkspaceStateBar
        showIds={showIds}
        campaignScopeId={campaignScopeId}
        adGroupScopeId={adGroupScopeId}
        campaignScopeLabel={campaignScopeLabel}
        adGroupScopeLabel={adGroupScopeLabel}
      />

      <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">
              {trendData.entityCountLabel}
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {trendData.selectedEntityLabel}
            </div>
            {showIds && trendData.selectedEntityId ? (
              <div className="mt-1 text-xs text-muted">
                ID {trendData.selectedEntityId}
              </div>
            ) : null}
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
                  {showIds ? `${entity.label} · ${entity.id}` : entity.label}
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

      {flashMessage ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-800">
          {flashMessage}
        </div>
      ) : null}

      <div
        className={
          initialComposerRow
            ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]'
            : 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]'
        }
      >
        <div className="min-w-0 rounded-2xl border border-border bg-surface/80 shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">Daily trend</div>
            <div className="mt-1 text-sm text-muted">
              Dates stay horizontal, KPIs stay vertical, and change markers open frozen logbook details.
            </div>
          </div>
          <div data-aph-hscroll data-aph-hscroll-axis="x" className="max-h-[720px] overflow-auto">
            <table
              className="min-w-[calc(180px+96px*7+160px)] w-full text-left text-sm"
              style={{
                ['--metric-col-w' as string]: '180px',
                ['--day-col-w' as string]: '96px',
                ['--analysis-col-w' as string]: '160px',
              }}
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
                    <th className="w-[var(--analysis-col-w)] px-3 py-3 text-center font-semibold">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trendData.metricRows.map((metric) => {
                    const miniBars = buildMiniBarMetrics(metric.cells, metric.kind);
                    return (
                    <tr key={metric.key} className="bg-surface/70">
                      <th className="sticky left-0 z-10 w-[var(--metric-col-w)] border-r border-border bg-surface px-3 py-3 text-left shadow-[2px_0_0_rgba(0,0,0,0.04)]">
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
                      <td className="w-[var(--analysis-col-w)] px-3 py-2">
                        {miniBars.hasData ? (
                          <div className="relative h-9 w-[var(--analysis-col-w)]">
                            {miniBars.hasNegative ? (
                              <div
                                className="absolute left-0 right-0 h-px bg-border"
                                style={{ top: `${miniBars.baseline}px` }}
                              />
                            ) : null}
                            <div className="flex h-full items-stretch gap-[2px]">
                              {metric.cells.map((cell, index) => {
                                const height = miniBars.bars[index];
                                const isNegative = (cell.value ?? 0) < 0;
                                return (
                                  <button
                                    key={`${metric.key}-mini-${cell.date}`}
                                    type="button"
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
                                    className="relative flex-1 rounded-sm outline-none focus:ring-2 focus:ring-ring"
                                  >
                                    {height !== null ? (
                                      <div
                                        className={`absolute left-0 right-0 rounded-sm ${
                                          isNegative ? 'bg-rose-400/70' : 'bg-foreground/70'
                                        }`}
                                        style={
                                          miniBars.hasNegative
                                            ? isNegative
                                              ? { height: `${height}px`, top: `${miniBars.baseline}px` }
                                              : {
                                                  height: `${height}px`,
                                                  bottom: `${32 - miniBars.baseline}px`,
                                                }
                                            : { height: `${height}px`, bottom: '0' }
                                        }
                                      />
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
            </table>
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

          {initialComposerRow ? (
            <div className="xl:sticky xl:top-4">
              <SpChangeComposer
                row={initialComposerRow}
                filtersJson={filtersJson}
                activeChangeSetId={activeDraft?.id ?? null}
                activeChangeSetName={activeDraft?.name ?? null}
                objectivePresets={objectivePresets}
                action={saveDraftAction}
                onClose={closeComposer}
                onSaved={handleSaved}
                mode="docked"
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
