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
import { formatUiDateTime } from '@/lib/time/formatUiDate';

type KpiItem = {
  label: string;
  value: string;
  subvalue?: string;
};

type HoveredTrendMetric = {
  metricLabel: string;
  kind: string;
  cell: SpTrendMetricCell;
  note: string | null;
};

type TrendInspectorState =
  | {
      kind: 'marker';
      activeDate: string;
      markers: SpTrendMarker[];
    }
  | {
      kind: 'cell';
      hovered: HoveredTrendMetric;
    }
  | {
      kind: 'empty';
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
  return formatUiDateTime(value);
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
const KPI_COLUMN_LABEL = 'KPI';
const SUMMARY_COLUMN_LABEL = 'Summary';
const TREND_COLUMN_LABEL = 'Trend';
const KPI_HEADER_CELL_CLASS =
  'sticky z-50 w-[var(--metric-col-w)] min-w-[var(--metric-col-w)] max-w-[var(--metric-col-w)] border-r border-border bg-surface px-3 py-3 font-semibold shadow-[2px_0_0_rgba(0,0,0,0.04)]';
const SUMMARY_HEADER_CELL_CLASS =
  'sticky z-40 w-[var(--summary-col-w)] min-w-[var(--summary-col-w)] max-w-[var(--summary-col-w)] border-r border-border bg-surface px-3 py-3 font-semibold';
const TREND_HEADER_CELL_CLASS =
  'sticky z-30 w-[var(--trend-col-w)] min-w-[var(--trend-col-w)] max-w-[var(--trend-col-w)] border-r border-border bg-surface px-3 py-3 font-semibold';
const DATE_HEADER_CELL_CLASS =
  'sticky z-20 w-[var(--day-col-w)] min-w-[var(--day-col-w)] max-w-[var(--day-col-w)] border-r border-border/60 bg-surface px-2 py-3 text-center font-semibold';
const KPI_BODY_CELL_CLASS =
  'sticky z-10 w-[var(--metric-col-w)] min-w-[var(--metric-col-w)] max-w-[var(--metric-col-w)] border-r border-border bg-surface px-3 py-3 text-left shadow-[2px_0_0_rgba(0,0,0,0.04)]';
const SUMMARY_BODY_CELL_CLASS =
  'sticky z-[9] w-[var(--summary-col-w)] min-w-[var(--summary-col-w)] max-w-[var(--summary-col-w)] border-r border-border bg-surface px-3 py-3 text-right text-foreground';
const TREND_BODY_CELL_CLASS =
  'sticky z-[8] w-[var(--trend-col-w)] min-w-[var(--trend-col-w)] max-w-[var(--trend-col-w)] border-r border-border bg-surface px-3 py-2';
const DATE_BODY_CELL_CLASS =
  'relative z-0 border-r border-border/60 px-2 py-3 align-top';

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

type TrendInspectorPanelProps = {
  state: TrendInspectorState;
  onClearMarkerSelection: () => void;
  className?: string;
};

function TrendInspectorPanel({
  state,
  onClearMarkerSelection,
  className,
}: TrendInspectorPanelProps) {
  return (
    <section
      className={`rounded-2xl border border-border bg-surface/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface/85 ${className ?? ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.2em] text-muted">Inspector</div>
          <div className="mt-1 text-sm text-muted">
            {state.kind === 'marker'
              ? 'Selected change detail takes priority over KPI hover.'
              : state.kind === 'cell'
                ? 'Hovered or focused KPI detail from the current SP facts layer.'
                : 'Click a change chip or hover, focus, or tap a KPI cell to inspect it here.'}
          </div>
        </div>
        {state.kind === 'marker' ? (
          <button
            type="button"
            onClick={onClearMarkerSelection}
            className="shrink-0 text-xs font-semibold text-muted"
          >
            Clear
          </button>
        ) : null}
      </div>

      {state.kind === 'marker' ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
              Change detail
            </span>
            <span className="text-sm font-semibold text-foreground">{state.activeDate}</span>
            <span className="text-xs text-muted">
              {state.markers.length} marker{state.markers.length === 1 ? '' : 's'}
            </span>
          </div>
          {state.markers.length > 0 ? (
            <div className="space-y-3">
              {state.markers.map((marker) => (
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
            <div className="rounded-2xl border border-dashed border-border bg-background/30 px-4 py-5 text-sm text-muted">
              No frozen change details were found for this date.
            </div>
          )}
        </div>
      ) : null}

      {state.kind === 'cell' ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              KPI detail
            </span>
            <span className="text-sm font-semibold text-foreground">
              {state.hovered.metricLabel}
            </span>
          </div>
          <div className="mt-2 text-sm text-muted">{state.hovered.cell.date}</div>
          <div className="mt-4 text-3xl font-semibold text-foreground">
            {formatCellValue(state.hovered.cell.value, state.hovered.kind)}
          </div>
          <div className="mt-3 text-sm text-muted">
            {state.hovered.note ?? 'Daily value from the current SP facts layer for the selected entity.'}
          </div>
          <div className="mt-3 text-xs text-muted">
            {state.hovered.cell.marker_ids.length > 0
              ? `${state.hovered.cell.marker_ids.length} change marker(s) also exist on this date. Click the date chip above to inspect the frozen change detail.`
              : 'No frozen change markers exist on this date.'}
          </div>
        </div>
      ) : null}

      {state.kind === 'empty' ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-background/30 px-4 py-5 text-sm text-muted">
          Use this inspector for two things: click a header change chip to review generated or validated intervention details, or hover, focus, or tap a KPI cell to inspect the daily value behind the trend grid.
        </div>
      ) : null}
    </section>
  );
}

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
  const [hovered, setHovered] = useState<HoveredTrendMetric | null>(null);

  const activeMarkerIds = activeMarkerDate ? trendData.markersByDate[activeMarkerDate] ?? [] : [];
  const activeMarkers = activeMarkerIds
    .map((markerId) => trendData.markers.find((marker) => marker.change_id === markerId) ?? null)
    .filter((marker): marker is SpTrendMarker => Boolean(marker));

  const inspectorState = useMemo<TrendInspectorState>(() => {
    if (activeMarkerDate) {
      return {
        kind: 'marker',
        activeDate: activeMarkerDate,
        markers: activeMarkers,
      };
    }
    if (hovered) {
      return {
        kind: 'cell',
        hovered,
      };
    }
    return { kind: 'empty' };
  }, [activeMarkerDate, activeMarkers, hovered]);

  const trendColWidth = useMemo(() => {
    const n = trendData.dates.length;
    const barW = Math.max(4, Math.min(12, Math.floor(140 / Math.max(n, 1))));
    const gapW = n <= 14 ? 2 : 1;
    const total = Math.max(80, Math.min(280, n * (barW + gapW) + 24));
    return {
      px: `${total}px`,
      gap: `${gapW}px`,
    };
  }, [trendData.dates.length]);

  const setHoveredMetric = (
    metric: { key: string; label: string; kind: string; support_note: string | null },
    cell: SpTrendMetricCell
  ) => {
    setHovered({
      metricLabel: metric.label,
      kind: metric.kind,
      cell,
      note: metric.support_note,
    });
  };

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

      <div className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
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
          <div
            data-aph-hscroll
            data-aph-hscroll-axis="x"
            className="max-h-[62vh] overflow-auto xl:max-h-[720px]"
          >
            <table
              className="w-full table-fixed border-separate border-spacing-0 text-left text-sm"
              style={{
                minWidth: `calc(180px + 120px + ${trendColWidth.px} + 96px * ${trendData.dates.length})`,
                ['--metric-col-w' as string]: '180px',
                ['--summary-col-w' as string]: '120px',
                ['--trend-col-w' as string]: trendColWidth.px,
                ['--day-col-w' as string]: '96px',
              }}
            >
                <thead className="bg-surface text-[11px] uppercase tracking-[0.18em] text-muted">
                  <tr className="border-b border-border">
                    <th
                      className={KPI_HEADER_CELL_CLASS}
                      style={{ top: 0, left: 0 }}
                    >
                      {KPI_COLUMN_LABEL}
                    </th>
                    <th
                      className={SUMMARY_HEADER_CELL_CLASS}
                      style={{ top: 0, left: 'var(--metric-col-w)' }}
                    >
                      {SUMMARY_COLUMN_LABEL}
                    </th>
                    <th
                      className={TREND_HEADER_CELL_CLASS}
                      style={{
                        top: 0,
                        left: 'calc(var(--metric-col-w) + var(--summary-col-w))',
                      }}
                    >
                      {TREND_COLUMN_LABEL}
                    </th>
                    {trendData.dates.map((date) => {
                      const markerIds = trendData.markersByDate[date] ?? [];
                      return (
                        <th
                          key={date}
                          className={DATE_HEADER_CELL_CLASS}
                          style={{ top: 0 }}
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
                              aria-pressed={activeMarkerDate === date}
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
                  {trendData.metricRows.map((metric) => {
                    const miniBars = buildMiniBarMetrics(metric.cells, metric.kind);
                    // CVR stays kind-based here alongside the other percent rows.
                    const renderedSummaryValue = formatCellValue(
                      metric.summary_value,
                      metric.kind
                    );
                    const showInlineSupportNote =
                      metric.key !== 'stis' &&
                      metric.key !== 'stir' &&
                      metric.key !== 'organic_rank' &&
                      metric.key !== 'sponsored_rank' &&
                      metric.key !== 'tos_is';
                    return (
                    <tr
                      key={metric.key}
                      className="bg-surface/70"
                    >
                      <th
                        className={KPI_BODY_CELL_CLASS}
                        style={{ left: 0 }}
                      >
                        <div className="font-semibold text-foreground">{metric.label}</div>
                        {showInlineSupportNote && metric.support_note ? (
                          <div className="mt-1 text-xs font-normal normal-case tracking-normal text-muted">
                            {metric.support_note}
                          </div>
                        ) : null}
                      </th>
                      <td
                        className={SUMMARY_BODY_CELL_CLASS}
                        style={{ left: 'var(--metric-col-w)' }}
                      >
                        {renderedSummaryValue}
                      </td>
                      <td
                        className={TREND_BODY_CELL_CLASS}
                        style={{
                          left: 'calc(var(--metric-col-w) + var(--summary-col-w))',
                        }}
                      >
                        {miniBars.hasData ? (
                          <div className="relative h-9 w-full">
                            {miniBars.hasNegative ? (
                              <div
                                className="absolute left-0 right-0 h-px bg-border"
                                style={{ top: `${miniBars.baseline}px` }}
                              />
                            ) : null}
                            <div className="flex h-full items-stretch" style={{ gap: trendColWidth.gap }}>
                              {metric.cells.map((cell, index) => {
                                const height = miniBars.bars[index];
                                const isNegative = (cell.value ?? 0) < 0;
                                return (
                                  <button
                                    key={`${metric.key}-mini-${cell.date}`}
                                    type="button"
                                    onClick={() => setHoveredMetric(metric, cell)}
                                    onMouseEnter={() => setHoveredMetric(metric, cell)}
                                    onFocus={() => setHoveredMetric(metric, cell)}
                                    aria-label={`Inspect ${metric.label} trend bar for ${cell.date}`}
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
                      {metric.cells.map((cell) => {
                        const hasMarkers = cell.marker_ids.length > 0;
                        return (
                          <td
                            key={`${metric.key}:${cell.date}`}
                            className={`${DATE_BODY_CELL_CLASS} ${
                              hasMarkers ? 'border-t-2 border-t-amber-400/60' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setHoveredMetric(metric, cell)}
                              onMouseEnter={() => setHoveredMetric(metric, cell)}
                              onFocus={() => setHoveredMetric(metric, cell)}
                              aria-label={`Inspect ${metric.label} on ${cell.date}`}
                              className="w-full rounded-xl border border-transparent px-2 py-2 text-right text-sm text-foreground outline-none transition hover:border-border hover:bg-surface-2/60 focus:border-primary/30 focus:bg-surface-2/60"
                            >
                              {formatCellValue(cell.value, metric.kind)}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  )})}
                </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <TrendInspectorPanel
            state={inspectorState}
            onClearMarkerSelection={() => setActiveMarkerDate(null)}
            className="max-h-[32vh] overflow-y-auto xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]"
          />

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
