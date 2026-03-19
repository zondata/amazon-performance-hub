import type { SpTargetsWorkspaceRow } from './spTargetsWorkspaceModel';
import type { SpCampaignsWorkspaceRow } from './spWorkspaceTablesModel';
import {
  buildPlacementUnitsByCampaignDate,
  resolveCampaignUnitsWithPlacementFallback,
} from './spCampaignUnitsFallback';

type NumericLike = number | string | null | undefined;

export type SpTrendLevel = 'campaigns' | 'targets';

export type SpTrendMetricKey =
  | 'spend'
  | 'sales'
  | 'orders'
  | 'units'
  | 'acos'
  | 'roas'
  | 'ctr'
  | 'cvr'
  | 'cpc'
  | 'organic_rank'
  | 'sponsored_rank'
  | 'stis'
  | 'stir'
  | 'tos_is';

export type SpTrendMetricKind =
  | 'currency'
  | 'number'
  | 'percent'
  | 'ratio'
  | 'rank';

export type SpTrendEntityOption = {
  id: string;
  label: string;
  subtitle: string | null;
  badge: string | null;
};

export type SpTrendMarkerField = {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
};

export type SpTrendMarker = {
  change_id: string;
  date: string;
  occurred_at: string;
  change_type: string;
  entity_type: string | null;
  summary: string;
  why: string | null;
  source: string;
  validation_status: string | null;
  validated_snapshot_date: string | null;
  fields: SpTrendMarkerField[];
};

export type SpTrendMetricCell = {
  date: string;
  value: number | null;
  marker_ids: string[];
};

export type SpTrendMetricRow = {
  key: SpTrendMetricKey;
  label: string;
  kind: SpTrendMetricKind;
  support_note: string | null;
  summary_value: number | null;
  cells: SpTrendMetricCell[];
};

export type SpTrendSummaryValues = Record<SpTrendMetricKey, number | null>;

export type SpWorkspaceTrendData = {
  level: SpTrendLevel;
  entityCountLabel: string;
  entities: SpTrendEntityOption[];
  selectedEntityId: string | null;
  selectedEntityLabel: string | null;
  dates: string[];
  metricRows: SpTrendMetricRow[];
  markers: SpTrendMarker[];
  markersByDate: Record<string, string[]>;
};

export type SpTrendCampaignDailyRow = {
  date: string | null;
  campaign_id: string | null;
  impressions: NumericLike;
  clicks: NumericLike;
  spend: NumericLike;
  sales: NumericLike;
  orders: NumericLike;
  units: NumericLike;
};

export type SpTrendPlacementUnitsRow = {
  campaign_id: string | null;
  date: string | null;
  units: NumericLike;
};

export type SpTrendTargetDailyRow = {
  date: string | null;
  target_id: string | null;
  impressions: NumericLike;
  clicks: NumericLike;
  spend: NumericLike;
  sales: NumericLike;
  orders: NumericLike;
  units: NumericLike;
  top_of_search_impression_share: NumericLike;
  exported_at: string | null;
};

export type SpTrendTargetStirRow = {
  date: string | null;
  target_id: string | null;
  targeting_norm: string | null;
  customer_search_term_raw: string | null;
  customer_search_term_norm: string | null;
  search_term_impression_share: NumericLike;
  search_term_impression_rank: NumericLike;
  impressions: NumericLike;
  clicks: NumericLike;
  spend: NumericLike;
  exported_at: string | null;
};

export type SpTrendTargetRankRow = {
  observed_date: string | null;
  organic_rank_value: NumericLike;
  sponsored_pos_value: NumericLike;
};

type CampaignDayAccumulator = {
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  units: number;
  units_state: 'missing' | 'known';
  has_row: boolean;
};

type TargetDayAccumulator = {
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  units: number;
  units_state: 'missing' | 'known';
  tos_is: number | null;
  has_row: boolean;
};

type TargetStirCandidate = {
  search_term_norm: string | null;
  targeting_norm: string | null;
  stis: number | null;
  stir: number | null;
  impressions: number;
  clicks: number;
  spend: number;
  exported_at: string | null;
  search_term_label: string;
};

const METADATA_AFTER_KEYS = new Set([
  'run_id',
  'generator',
  'upload_path',
  'review_path',
  'dedupe_key',
  'final_plan_pack_id',
]);

const METRIC_DEFS: Array<{
  key: SpTrendMetricKey;
  label: string;
  kind: SpTrendMetricKind;
}> = [
  { key: 'spend', label: 'Spend', kind: 'currency' },
  { key: 'sales', label: 'Sales', kind: 'currency' },
  { key: 'orders', label: 'Orders', kind: 'number' },
  { key: 'units', label: 'Units', kind: 'number' },
  { key: 'acos', label: 'ACOS', kind: 'percent' },
  { key: 'roas', label: 'ROAS', kind: 'ratio' },
  { key: 'ctr', label: 'CTR', kind: 'percent' },
  { key: 'cvr', label: 'CVR', kind: 'percent' },
  { key: 'cpc', label: 'CPC', kind: 'currency' },
  { key: 'organic_rank', label: 'Organic Rank', kind: 'rank' },
  { key: 'sponsored_rank', label: 'Sponsored Rank', kind: 'rank' },
  { key: 'stis', label: 'STIS', kind: 'percent' },
  { key: 'stir', label: 'STIR', kind: 'rank' },
  { key: 'tos_is', label: 'TOS IS', kind: 'percent' },
];

export const buildEmptySpTrendSummaryValues = (): SpTrendSummaryValues =>
  Object.fromEntries(METRIC_DEFS.map((metric) => [metric.key, null])) as SpTrendSummaryValues;

export const buildCampaignTrendSummaryValues = (
  selectedCampaign: SpCampaignsWorkspaceRow | null
): SpTrendSummaryValues => {
  if (!selectedCampaign) return buildEmptySpTrendSummaryValues();
  return {
    ...buildEmptySpTrendSummaryValues(),
    spend: selectedCampaign.spend,
    sales: selectedCampaign.sales,
    orders: selectedCampaign.orders,
    units: selectedCampaign.units,
    acos: selectedCampaign.acos,
    roas: selectedCampaign.roas,
    ctr: selectedCampaign.ctr,
    cvr: selectedCampaign.conversion,
    cpc: selectedCampaign.cpc,
  };
};

export const buildTargetTrendSummaryValues = (
  selectedTarget: SpTargetsWorkspaceRow | null
): SpTrendSummaryValues => {
  if (!selectedTarget) return buildEmptySpTrendSummaryValues();
  return {
    ...buildEmptySpTrendSummaryValues(),
    spend: selectedTarget.spend,
    sales: selectedTarget.sales,
    orders: selectedTarget.orders,
    units: selectedTarget.units,
    acos: selectedTarget.acos,
    roas: selectedTarget.roas,
    ctr: selectedTarget.ctr,
    cvr: selectedTarget.conversion,
    cpc: selectedTarget.cpc,
    organic_rank: selectedTarget.rank_context?.organic_rank ?? null,
    sponsored_rank: selectedTarget.rank_context?.sponsored_rank ?? null,
    stis: selectedTarget.stis,
    stir: selectedTarget.stir,
    tos_is: selectedTarget.tos_is,
  };
};

const safeDivide = (numerator: number | null, denominator: number | null) => {
  if (
    numerator === null ||
    denominator === null ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null;
  }
  return numerator / denominator;
};

const trimString = (value: string | null | undefined) => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeText = (value: string | null | undefined) => trimString(value)?.toLowerCase() ?? null;

const toFiniteNumberOrNull = (value: NumericLike): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const numberValue = (value: NumericLike) => toFiniteNumberOrNull(value) ?? 0;

const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const buildDateColumns = (start: string, end: string) => {
  const dates: string[] = [];
  for (let current = start; current <= end; current = addDays(current, 1)) {
    dates.push(current);
  }
  return dates;
};

const toDisplayString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return JSON.stringify(value);
};

const titleCaseKey = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildMarkerFields = (before: Record<string, unknown>, after: Record<string, unknown>) => {
  const keys = new Set<string>();
  Object.keys(before).forEach((key) => keys.add(key));
  Object.keys(after)
    .filter((key) => !METADATA_AFTER_KEYS.has(key))
    .forEach((key) => keys.add(key));

  return Array.from(keys)
    .map((key) => ({
      key,
      label: titleCaseKey(key),
      before: toDisplayString(before[key]),
      after: toDisplayString(after[key]),
    }))
    .filter((field) => field.before !== null || field.after !== null);
};

const buildMetricRows = (params: {
  dates: string[];
  markersByDate: Map<string, string[]>;
  valuesByDate: Map<string, Record<SpTrendMetricKey, number | null>>;
  summaryValues: SpTrendSummaryValues;
  supportNotes?: Partial<Record<SpTrendMetricKey, string | null>>;
}) =>
  METRIC_DEFS.map((metric) => ({
    key: metric.key,
    label: metric.label,
    kind: metric.kind,
    support_note: params.supportNotes?.[metric.key] ?? null,
    summary_value: params.summaryValues[metric.key] ?? null,
    cells: params.dates.map((date) => ({
      date,
      value: params.valuesByDate.get(date)?.[metric.key] ?? null,
      marker_ids: params.markersByDate.get(date) ?? [],
    })),
  }));

export const buildCampaignTrendEntityOptions = (rows: SpCampaignsWorkspaceRow[]): SpTrendEntityOption[] =>
  rows.map((row) => ({
    id: row.campaign_id,
    label: row.campaign_name,
    subtitle: row.portfolio_name ?? row.campaign_id,
    badge: row.coverage_label,
  }));

export const buildTargetTrendEntityOptions = (rows: SpTargetsWorkspaceRow[]): SpTrendEntityOption[] =>
  rows.map((row) => ({
    id: row.target_id,
    label: row.target_text,
    subtitle: [row.campaign_name, row.ad_group_name, row.match_type].filter(Boolean).join(' · ') || row.target_id,
    badge: row.coverage_label,
  }));

export const buildTrendMarkers = (rows: Array<{
  change_id: string;
  occurred_at: string;
  change_type: string;
  entity_type: string | null;
  summary: string;
  why: string | null;
  source: string;
  validation_status: string | null;
  validated_snapshot_date: string | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
}>): { markers: SpTrendMarker[]; markersByDate: Map<string, string[]> } => {
  const markers = rows.map((row) => {
    const before = row.before_json ?? {};
    const after = row.after_json ?? {};
    return {
      change_id: row.change_id,
      date: row.occurred_at.slice(0, 10),
      occurred_at: row.occurred_at,
      change_type: row.change_type,
      entity_type: row.entity_type,
      summary: row.summary,
      why: row.why,
      source: row.source,
      validation_status: row.validation_status,
      validated_snapshot_date: row.validated_snapshot_date,
      fields: buildMarkerFields(before, after),
    } satisfies SpTrendMarker;
  });

  const markersByDate = new Map<string, string[]>();
  for (const marker of markers) {
    const existing = markersByDate.get(marker.date) ?? [];
    existing.push(marker.change_id);
    markersByDate.set(marker.date, existing);
  }

  return { markers, markersByDate };
};

export const buildCampaignTrendData = (params: {
  entityCountLabel: string;
  entities: SpTrendEntityOption[];
  selectedEntityId: string;
  selectedEntityLabel: string;
  start: string;
  end: string;
  summaryValues: SpTrendSummaryValues;
  campaignRows: SpTrendCampaignDailyRow[];
  placementUnitRows: SpTrendPlacementUnitsRow[];
  markers: SpTrendMarker[];
  markersByDate: Map<string, string[]>;
}): SpWorkspaceTrendData => {
  const dates = buildDateColumns(params.start, params.end);
  const byDate = new Map<string, CampaignDayAccumulator>();
  const placementUnitsByCampaignDate = buildPlacementUnitsByCampaignDate(params.placementUnitRows);

  for (const date of dates) {
    byDate.set(date, {
      impressions: 0,
      clicks: 0,
      spend: 0,
      sales: 0,
      orders: 0,
      units: 0,
      units_state: 'missing',
      has_row: false,
    });
  }

  for (const row of params.campaignRows) {
    const date = trimString(row.date);
    if (!date || !byDate.has(date)) continue;
    const existing = byDate.get(date)!;
    existing.has_row = true;
    existing.impressions += numberValue(row.impressions);
    existing.clicks += numberValue(row.clicks);
    existing.spend += numberValue(row.spend);
    existing.sales += numberValue(row.sales);
    existing.orders += numberValue(row.orders);
    const units = resolveCampaignUnitsWithPlacementFallback({
      campaignId: row.campaign_id,
      date,
      primaryUnits: row.units,
      placementUnitsByCampaignDate,
    });
    if (units !== null) {
      existing.units += units;
      existing.units_state = 'known';
    }
  }

  const unavailableNote =
    'This diagnostic remains null-safe in the Campaigns trend slice. Current SP facts do not provide a trustworthy campaign-level daily diagnostic without unsafe rollups.';

  const valuesByDate = new Map<string, Record<SpTrendMetricKey, number | null>>();
  for (const date of dates) {
    const value = byDate.get(date)!;
    valuesByDate.set(date, {
      spend: value.has_row ? value.spend : 0,
      sales: value.has_row ? value.sales : 0,
      orders: value.has_row ? value.orders : 0,
      units: value.has_row ? (value.units_state === 'known' ? value.units : null) : 0,
      acos: value.has_row ? safeDivide(value.spend, value.sales) : 0,
      roas: value.has_row ? safeDivide(value.sales, value.spend) : 0,
      ctr: value.has_row ? safeDivide(value.clicks, value.impressions) : 0,
      cvr: value.has_row ? safeDivide(value.orders, value.clicks) : 0,
      cpc: value.has_row ? safeDivide(value.spend, value.clicks) : 0,
      organic_rank: null,
      sponsored_rank: null,
      stis: null,
      stir: null,
      tos_is: null,
    });
  }

  return {
    level: 'campaigns',
    entityCountLabel: params.entityCountLabel,
    entities: params.entities,
    selectedEntityId: params.selectedEntityId,
    selectedEntityLabel: params.selectedEntityLabel,
    dates,
    metricRows: buildMetricRows({
      dates,
      markersByDate: params.markersByDate,
      valuesByDate,
      summaryValues: params.summaryValues,
      supportNotes: {
        stis: unavailableNote,
        stir: unavailableNote,
        organic_rank: unavailableNote,
        sponsored_rank: unavailableNote,
        tos_is:
          'TOS IS remains null-safe here until a deterministic campaign-level daily source is wired.',
      },
    }),
    markers: params.markers,
    markersByDate: Object.fromEntries(params.markersByDate.entries()),
  };
};

const compareNullableDesc = (left: string | null, right: string | null) => {
  if (left && right) return right.localeCompare(left);
  if (left) return -1;
  if (right) return 1;
  return 0;
};

const compareTargetStirCandidate = (left: TargetStirCandidate, right: TargetStirCandidate) => {
  const leftSameText =
    left.search_term_norm !== null &&
    left.targeting_norm !== null &&
    left.search_term_norm === left.targeting_norm;
  const rightSameText =
    right.search_term_norm !== null &&
    right.targeting_norm !== null &&
    right.search_term_norm === right.targeting_norm;
  if (leftSameText !== rightSameText) return leftSameText ? -1 : 1;
  if (left.impressions !== right.impressions) return right.impressions - left.impressions;
  if (left.clicks !== right.clicks) return right.clicks - left.clicks;
  if (left.spend !== right.spend) return right.spend - left.spend;
  const exportedAt = compareNullableDesc(left.exported_at, right.exported_at);
  if (exportedAt !== 0) return exportedAt;
  return left.search_term_label.localeCompare(right.search_term_label);
};

export const buildTargetTrendData = (params: {
  entityCountLabel: string;
  entities: SpTrendEntityOption[];
  selectedEntityId: string;
  selectedEntityLabel: string;
  start: string;
  end: string;
  summaryValues: SpTrendSummaryValues;
  targetRows: SpTrendTargetDailyRow[];
  stirRows: SpTrendTargetStirRow[];
  rankRows?: SpTrendTargetRankRow[];
  rankSupportNote?: string | null;
  markers: SpTrendMarker[];
  markersByDate: Map<string, string[]>;
}): SpWorkspaceTrendData => {
  const dates = buildDateColumns(params.start, params.end);
  const byDate = new Map<string, TargetDayAccumulator>();
  const stirByDate = new Map<string, TargetStirCandidate[]>();
  const rankByDate = new Map<
    string,
    { organic_rank: number | null; sponsored_rank: number | null }
  >();

  for (const date of dates) {
    byDate.set(date, {
      impressions: 0,
      clicks: 0,
      spend: 0,
      sales: 0,
      orders: 0,
      units: 0,
      units_state: 'missing',
      tos_is: null,
      has_row: false,
    });
  }

  for (const row of params.targetRows) {
    const date = trimString(row.date);
    if (!date || !byDate.has(date)) continue;
    const existing = byDate.get(date)!;
    existing.has_row = true;
    existing.impressions += numberValue(row.impressions);
    existing.clicks += numberValue(row.clicks);
    existing.spend += numberValue(row.spend);
    existing.sales += numberValue(row.sales);
    existing.orders += numberValue(row.orders);
    const units = toFiniteNumberOrNull(row.units);
    if (units !== null) {
      existing.units += units;
      existing.units_state = 'known';
    }
    const tosIs = toFiniteNumberOrNull(row.top_of_search_impression_share);
    if (tosIs !== null) {
      existing.tos_is = tosIs;
    }
  }

  for (const row of params.stirRows) {
    const date = trimString(row.date);
    const stis = toFiniteNumberOrNull(row.search_term_impression_share);
    const stir = toFiniteNumberOrNull(row.search_term_impression_rank);
    if (!date || (stis === null && stir === null) || !stirByDate.has(date)) {
      if (date && !stirByDate.has(date) && byDate.has(date)) {
        stirByDate.set(date, []);
      }
    }
    if (!date || (stis === null && stir === null) || !byDate.has(date)) continue;

    const existing = stirByDate.get(date) ?? [];
    existing.push({
      search_term_norm: normalizeText(row.customer_search_term_norm ?? row.customer_search_term_raw),
      targeting_norm: normalizeText(row.targeting_norm),
      stis,
      stir,
      impressions: numberValue(row.impressions),
      clicks: numberValue(row.clicks),
      spend: numberValue(row.spend),
      exported_at: trimString(row.exported_at),
      search_term_label:
        trimString(row.customer_search_term_raw) ??
        trimString(row.customer_search_term_norm) ??
        'Search term',
    });
    stirByDate.set(date, existing);
  }

  for (const row of params.rankRows ?? []) {
    const date = trimString(row.observed_date);
    if (!date || !byDate.has(date) || rankByDate.has(date)) continue;
    rankByDate.set(date, {
      organic_rank: toFiniteNumberOrNull(row.organic_rank_value),
      sponsored_rank: toFiniteNumberOrNull(row.sponsored_pos_value),
    });
  }

  const valuesByDate = new Map<string, Record<SpTrendMetricKey, number | null>>();
  for (const date of dates) {
    const daily = byDate.get(date)!;
    const representativeChild = [...(stirByDate.get(date) ?? [])].sort(compareTargetStirCandidate)[0] ?? null;
    const rank = rankByDate.get(date) ?? null;
    valuesByDate.set(date, {
      spend: daily.has_row ? daily.spend : 0,
      sales: daily.has_row ? daily.sales : 0,
      orders: daily.has_row ? daily.orders : 0,
      units: daily.has_row ? (daily.units_state === 'known' ? daily.units : null) : 0,
      acos: daily.has_row ? safeDivide(daily.spend, daily.sales) : 0,
      roas: daily.has_row ? safeDivide(daily.sales, daily.spend) : 0,
      ctr: daily.has_row ? safeDivide(daily.clicks, daily.impressions) : 0,
      cvr: daily.has_row ? safeDivide(daily.orders, daily.clicks) : 0,
      cpc: daily.has_row ? safeDivide(daily.spend, daily.clicks) : 0,
      organic_rank: rank?.organic_rank ?? null,
      sponsored_rank: rank?.sponsored_rank ?? null,
      stis: representativeChild?.stis ?? null,
      stir: representativeChild?.stir ?? null,
      tos_is: daily.tos_is,
    });
  }

  return {
    level: 'targets',
    entityCountLabel: params.entityCountLabel,
    entities: params.entities,
    selectedEntityId: params.selectedEntityId,
    selectedEntityLabel: params.selectedEntityLabel,
    dates,
    metricRows: buildMetricRows({
      dates,
      markersByDate: params.markersByDate,
      valuesByDate,
      summaryValues: params.summaryValues,
      supportNotes: {
        organic_rank:
          params.rankSupportNote ??
          'Rank is contextual visibility data for the selected ASIN and exact keyword, not a target-owned performance fact.',
        sponsored_rank:
          params.rankSupportNote ??
          'Rank is contextual visibility data for the selected ASIN and exact keyword, not a target-owned performance fact.',
        stis:
          'STIS comes from search-term impression-share coverage under the selected target. Each date shows one representative child diagnostic.',
        stir:
          'STIR comes from search-term impression-share coverage under the selected target. Each date uses the same representative child as STIS.',
        tos_is:
          'TOS IS comes from target targeting-report coverage (`top_of_search_impression_share`), not from campaign placement rollups.',
      },
    }),
    markers: params.markers,
    markersByDate: Object.fromEntries(params.markersByDate.entries()),
  };
};
