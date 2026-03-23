import 'server-only';

import { getAdsOptimizerOverviewData, type AdsOptimizerObjective } from '@/lib/ads-optimizer/overview';
import { getProductOptimizerSettingsByProductId } from '@/lib/ads-optimizer/repoConfig';
import {
  findOptimizerProductByAsin,
  getAdsOptimizerRunById,
  listAdsOptimizerProductSnapshotsByRun,
  listAdsOptimizerRuns,
} from '@/lib/ads-optimizer/repoRuntime';
import {
  buildAdsOptimizerOutcomeReviewVisibilitySignal,
  buildAdsOptimizerOutcomeReviewWindowSummaries,
  getAdsOptimizerOutcomeReviewSegmentFilterKey,
  scoreAdsOptimizerOutcomeReview,
  summarizeOutcomeTrendPoints,
} from '@/lib/ads-optimizer/outcomeReviewScoring';
import {
  ADS_OPTIMIZER_PHASE10_HANDOFF_SOURCE as HANDOFF_SOURCE,
  readAdsWorkspaceHandoffMeta,
} from '@/lib/ads-workspace/generatedArtifact';
import { buildAdsOptimizerHref } from '@/lib/ads-optimizer/shell';
import { readAdsOptimizerProductRunState } from '@/lib/ads-optimizer/state';
import type { JsonObject as OptimizerJsonObject } from '@/lib/ads-optimizer/types';
import { env } from '@/lib/env';
import { getSalesDaily } from '@/lib/sales/getSalesDaily';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import type {
  AdsOptimizerOutcomeReviewData,
  AdsOptimizerOutcomeReviewDetailReadyData,
  AdsOptimizerOutcomeReviewDetailData,
  AdsOptimizerOutcomeReviewHorizon,
  AdsOptimizerOutcomeReviewMetric,
  AdsOptimizerOutcomeReviewPhaseStatus,
  AdsOptimizerOutcomeReviewPhaseSummary,
  AdsOptimizerOutcomeReviewSegmentCaution,
  AdsOptimizerOutcomeReviewSegmentSummary,
  AdsOptimizerOutcomeReviewStagedChange,
  AdsOptimizerOutcomeReviewTrendPoint,
  AdsOptimizerOutcomeReviewValidationSummary,
} from './outcomeReviewTypes';

type JsonObject = Record<string, unknown>;

type OutcomeReviewChangeSetRow = {
  id: string;
  name: string;
  objective: string | null;
  filters_json: unknown;
  generated_run_id: string | null;
  generated_artifact_json: unknown | null;
  created_at: string;
};

type OutcomeReviewChangeSetItemRow = {
  id: string;
  change_set_id: string;
  channel: string;
  entity_level: string;
  entity_key: string;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  target_key: string | null;
  placement_code: string | null;
  action_type: string;
  before_json: unknown;
  after_json: unknown;
  objective: string | null;
  hypothesis: string | null;
  notes: string | null;
  ui_context_json: unknown | null;
};

type OutcomeReviewLinkedChangeRow = {
  change_id: string;
  occurred_at: string;
  source: string;
  after_json: unknown | null;
};

type OutcomeReviewValidationRow = {
  change_id: string;
  status: string | null;
  validated_snapshot_date: string | null;
  checked_at: string;
};

type BuildPhaseSummariesArgs = {
  changeSets: OutcomeReviewChangeSetRow[];
  changeSetItems: OutcomeReviewChangeSetItemRow[];
  linkedChanges: OutcomeReviewLinkedChangeRow[];
  validations: OutcomeReviewValidationRow[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TODAY = '2026-03-12';

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asString(entry)).filter((entry): entry is string => Boolean(entry));
};

const emptyValidationSummary = (): AdsOptimizerOutcomeReviewValidationSummary => ({
  validated: 0,
  mismatch: 0,
  pending: 0,
  notFound: 0,
  total: 0,
});

const addValidationStatus = (
  summary: AdsOptimizerOutcomeReviewValidationSummary,
  status: 'validated' | 'mismatch' | 'pending' | 'not_found'
) => {
  if (status === 'not_found') {
    summary.notFound += 1;
  } else {
    summary[status] += 1;
  }
  summary.total += 1;
};

const resolvePhaseStatus = (
  summary: AdsOptimizerOutcomeReviewValidationSummary
): AdsOptimizerOutcomeReviewPhaseStatus => {
  if (summary.mismatch > 0 || summary.notFound > 0) {
    return 'mixed_validation';
  }
  if (summary.validated > 0 && summary.pending === 0) {
    return 'validated';
  }
  if (summary.validated > 0 && summary.pending > 0) {
    return 'partial';
  }
  return 'pending';
};

const fetchPaged = async <TRow,>(
  queryBuilder: (from: number, to: number) => Promise<{
    data: TRow[] | null;
    error: { message: string } | null;
  }>
) =>
  fetchAllRows<TRow>(async (from, to) => {
    const result = await queryBuilder(from, to);
    if (result.error) {
      throw new Error(result.error.message);
    }
    return { data: result.data };
  });

const extractLinkedRunId = (change: OutcomeReviewLinkedChangeRow) => {
  const after = asObject(change.after_json);
  return asString(after?.run_id);
};

const normalizeDateOnly = (value: string | null | undefined) => {
  if (!value || !DATE_RE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? value : null;
};

const addDays = (value: string, delta: number) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + delta);
  return parsed.toISOString().slice(0, 10);
};

const sliceDisplayedTrend = (
  points: AdsOptimizerOutcomeReviewTrendPoint[],
  horizon: AdsOptimizerOutcomeReviewHorizon
) => {
  const count = Number(horizon);
  if (!Number.isFinite(count) || count <= 0) return points;
  return points.slice(Math.max(0, points.length - count));
};

const buildTrendPoints = (salesDaily: Awaited<ReturnType<typeof getSalesDaily>>) =>
  salesDaily.dailySeries.map((point) => ({
    date: point.date,
    contribution_after_ads: point.profits ?? null,
    tacos: point.tacos,
    ad_spend: point.ppc_cost,
    ad_sales: point.ppc_sales,
    total_sales: point.sales,
    orders: point.orders,
  })) satisfies AdsOptimizerOutcomeReviewTrendPoint[];

const fetchOutcomeReviewChangeSets = async (args: {
  asin: string;
  createdAtStart?: string | null;
  createdAtEnd?: string | null;
}) => {
  const rows = await fetchPaged<OutcomeReviewChangeSetRow>(async (from, to) => {
    let query = supabaseAdmin
      .from('ads_change_sets')
      .select('id,name,objective,filters_json,generated_run_id,generated_artifact_json,created_at')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (args.createdAtStart) {
      query = query.gte('created_at', `${args.createdAtStart}T00:00:00Z`);
    }
    if (args.createdAtEnd) {
      query = query.lte('created_at', `${args.createdAtEnd}T23:59:59Z`);
    }

    return query;
  });

  return rows.filter((changeSet) => {
    const filters = asObject(changeSet.filters_json);
    return (
      asString(filters?.source) === HANDOFF_SOURCE &&
      asString(filters?.asin)?.toUpperCase() === args.asin.toUpperCase()
    );
  });
};

const fetchOutcomeReviewChangeSetItems = async (changeSetIds: string[]) => {
  if (changeSetIds.length === 0) return [];

  return fetchPaged<OutcomeReviewChangeSetItemRow>(async (from, to) =>
    await supabaseAdmin
      .from('ads_change_set_items')
      .select(
        'id,change_set_id,channel,entity_level,entity_key,campaign_id,ad_group_id,target_id,target_key,placement_code,action_type,before_json,after_json,objective,hypothesis,notes,ui_context_json'
      )
      .in('change_set_id', changeSetIds)
      .order('created_at', { ascending: true })
      .range(from, to)
  );
};

const fetchOutcomeReviewLinkedChanges = async (generatedRunIds: string[]) => {
  const linkedChangeGroups = await Promise.all(
    generatedRunIds.map(async (runId) => ({
      runId,
      changes: await fetchPaged<OutcomeReviewLinkedChangeRow>(async (from, to) =>
        await supabaseAdmin
          .from('log_changes')
          .select('change_id,occurred_at,source,after_json')
          .eq('account_id', env.accountId)
          .eq('marketplace', env.marketplace)
          .eq('source', 'bulkgen')
          .contains('after_json', { run_id: runId })
          .order('occurred_at', { ascending: false })
          .range(from, to)
      ),
    }))
  );

  return linkedChangeGroups.flatMap((group) =>
    group.changes.filter((change) => extractLinkedRunId(change) === group.runId)
  );
};

const fetchOutcomeReviewValidations = async (linkedChanges: OutcomeReviewLinkedChangeRow[]) => {
  const linkedChangeIds = Array.from(new Set(linkedChanges.map((change) => change.change_id)));
  if (linkedChangeIds.length === 0) return [];

  return fetchPaged<OutcomeReviewValidationRow>(async (from, to) =>
    await supabaseAdmin
      .from('log_change_validations')
      .select('change_id,status,validated_snapshot_date,checked_at')
      .in('change_id', linkedChangeIds)
      .order('checked_at', { ascending: false })
      .range(from, to)
  );
};

const readObjectiveFromSnapshotPayload = (
  payload: OptimizerJsonObject
): { value: AdsOptimizerObjective | null; reason: string | null } => {
  const state = readAdsOptimizerProductRunState(payload);
  if (state) {
    return {
      value: state.objective,
      reason: state.objectiveReason,
    };
  }

  const overview = asObject(payload.overview);
  const objective = asObject(overview?.objective);
  return {
    value: (asString(objective?.value) as AdsOptimizerObjective | null) ?? null,
    reason: asString(objective?.reason),
  };
};

const formatCurrency = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return 'Not captured';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  });
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return 'Not captured';
  return `${value.toFixed(0)}%`;
};

const formatState = (value: string | null) => (value ? value.replace(/_/g, ' ') : 'Not captured');

const summarizeChangeItem = (item: OutcomeReviewChangeSetItemRow): AdsOptimizerOutcomeReviewStagedChange => {
  const before = asObject(item.before_json) ?? {};
  const after = asObject(item.after_json) ?? {};
  const uiContext = asObject(item.ui_context_json);
  const targetText = asString(uiContext?.target_text) ?? item.target_key ?? item.target_id ?? item.entity_key;

  let summary = `Review ${item.action_type.replace(/_/g, ' ')} on ${targetText}`;
  let beforeLabel = 'Not captured';
  let afterLabel = 'Not captured';

  if (item.action_type === 'update_target_bid') {
    summary = `Update target bid for ${targetText}`;
    beforeLabel = formatCurrency(asNumber(before.bid));
    afterLabel = formatCurrency(asNumber(after.bid));
  } else if (item.action_type === 'update_target_state') {
    summary = `Update target state for ${targetText}`;
    beforeLabel = formatState(asString(before.state));
    afterLabel = formatState(asString(after.state));
  } else if (item.action_type === 'update_placement_modifier') {
    const placementLabel =
      asString(uiContext?.placement_label) ??
      asString(after.placement_code) ??
      item.placement_code ??
      'placement';
    summary = `Update ${placementLabel} modifier for ${targetText}`;
    beforeLabel = formatPercent(asNumber(before.percentage));
    afterLabel = formatPercent(asNumber(after.percentage));
  }

  return {
    itemId: item.id,
    actionType: item.action_type,
    entityLevel: item.entity_level,
    entityKey: item.entity_key,
    campaignId: item.campaign_id,
    adGroupId: item.ad_group_id,
    targetId: item.target_id,
    targetKey: item.target_key,
    placementCode: item.placement_code,
    summary,
    beforeLabel,
    afterLabel,
    objective: item.objective,
    hypothesis: item.hypothesis,
    notes: item.notes,
    uiContextJson: uiContext,
    beforeJson: before,
    afterJson: after,
  };
};

export const buildAdsOptimizerOutcomeReviewReviewOnlyNotes = (changeSet: {
  filters_json: unknown;
  generated_artifact_json: unknown | null;
}) => {
  const handoffMeta = readAdsWorkspaceHandoffMeta(
    changeSet.filters_json,
    changeSet.generated_artifact_json
  );
  const skippedTypes = handoffMeta?.skippedUnsupportedActionTypes ?? [];
  if (skippedTypes.length === 0) return [];
  return [
    `Review-only action types were present but not staged into Ads Workspace: ${skippedTypes.join(', ')}.`,
  ];
};

const formatMetricSummaryValue = (
  key: 'contribution_after_ads' | 'tacos' | 'orders',
  value: number | null
) => {
  if (value === null || !Number.isFinite(value)) return 'Not captured';
  if (key === 'contribution_after_ads') return formatCurrency(value);
  if (key === 'tacos') return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString('en-US', {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  });
};

const comparePhaseOrder = (
  left: Pick<AdsOptimizerOutcomeReviewPhaseSummary, 'validatedEffectiveDate' | 'createdAt'>,
  right: Pick<AdsOptimizerOutcomeReviewPhaseSummary, 'validatedEffectiveDate' | 'createdAt'>
) => {
  const leftKey = left.validatedEffectiveDate ?? left.createdAt.slice(0, 10);
  const rightKey = right.validatedEffectiveDate ?? right.createdAt.slice(0, 10);
  const keyDiff = leftKey.localeCompare(rightKey);
  if (keyDiff !== 0) return keyDiff;
  return left.createdAt.localeCompare(right.createdAt);
};

const buildOutcomeReviewDetailHref = (args: {
  changeSetId: string;
  asin: string;
  start: string;
  end: string;
  horizon: AdsOptimizerOutcomeReviewHorizon;
  metric: AdsOptimizerOutcomeReviewMetric;
}) =>
  `/ads/optimizer/outcomes/${args.changeSetId}?asin=${encodeURIComponent(
    args.asin
  )}&start=${encodeURIComponent(args.start)}&end=${encodeURIComponent(
    args.end
  )}&horizon=${encodeURIComponent(args.horizon)}&metric=${encodeURIComponent(args.metric)}`;

type OutcomeReviewSegmentInput = AdsOptimizerOutcomeReviewDetailReadyData & {
  detailHref: string;
};

const buildOutcomeReviewSegmentCautions = (args: {
  detail: OutcomeReviewSegmentInput;
  previousDetail: OutcomeReviewSegmentInput | null;
  horizon: AdsOptimizerOutcomeReviewHorizon;
}): AdsOptimizerOutcomeReviewSegmentCaution[] => {
  const cautions: AdsOptimizerOutcomeReviewSegmentCaution[] = [];

  if (args.detail.objectiveContext.changedSincePhase) {
    cautions.push({
      id: 'objective_changed_mid_segment',
      label: 'Objective changed during this segment.',
    });
  }

  if (args.detail.phase.status !== 'validated') {
    cautions.push({
      id: 'validation_incomplete',
      label: 'Validation is incomplete for this phase.',
    });
  }

  const windowsHaveCoverageGap = args.detail.windows.some(
    (window) => !window.hasData || window.observedDays < window.expectedDays
  );
  if (windowsHaveCoverageGap) {
    cautions.push({
      id: 'kpi_coverage_incomplete',
      label: 'At least one KPI window is incomplete.',
    });
  }

  const previousValidatedDate = args.previousDetail?.phase.validatedEffectiveDate ?? null;
  const currentValidatedDate = args.detail.phase.validatedEffectiveDate ?? null;
  if (previousValidatedDate && currentValidatedDate) {
    const previousDate = new Date(`${previousValidatedDate}T00:00:00Z`);
    const currentDate = new Date(`${currentValidatedDate}T00:00:00Z`);
    const spacingDays = Math.floor((currentDate.getTime() - previousDate.getTime()) / 86400000);
    if (spacingDays < Number(args.horizon)) {
      cautions.push({
        id: 'phase_landed_too_soon',
        label: `Another phase landed within ${args.horizon} days.`,
      });
    }
  }

  return cautions;
};

const buildOutcomeReviewShortKpiSummary = (detail: OutcomeReviewSegmentInput) => {
  const before = detail.windows.find((window) => window.key === 'before')?.metrics ?? null;
  const latest =
    detail.windows.find((window) => window.key === 'latest')?.metrics ??
    detail.windows.find((window) => window.key === 'after')?.metrics ??
    null;

  return [
    `Contribution ${formatMetricSummaryValue(
      'contribution_after_ads',
      before?.contribution_after_ads ?? null
    )} to ${formatMetricSummaryValue(
      'contribution_after_ads',
      latest?.contribution_after_ads ?? null
    )}`,
    `TACOS ${formatMetricSummaryValue('tacos', before?.tacos ?? null)} to ${formatMetricSummaryValue(
      'tacos',
      latest?.tacos ?? null
    )}`,
    `Orders ${formatMetricSummaryValue('orders', before?.orders ?? null)} to ${formatMetricSummaryValue(
      'orders',
      latest?.orders ?? null
    )}`,
  ].join(' · ');
};

export const buildAdsOptimizerOutcomeReviewSegments = (args: {
  phaseDetails: OutcomeReviewSegmentInput[];
  horizon: AdsOptimizerOutcomeReviewHorizon;
}): AdsOptimizerOutcomeReviewSegmentSummary[] => {
  const ordered = [...args.phaseDetails].sort((left, right) =>
    comparePhaseOrder(left.phase, right.phase)
  );

  return ordered.map((detail, index) => {
    const previousDetail = index > 0 ? ordered[index - 1] ?? null : null;
    const segmentStartLabel = previousDetail ? `Phase ${index}` : 'Baseline';
    const segmentEndLabel = `Phase ${index + 1}`;
    const afterWindow = detail.windows.find((window) => window.key === 'after') ?? null;
    const segmentStartDate = afterWindow?.startDate ?? null;
    const segmentEndDate = afterWindow?.endDate ?? null;
    const objectiveAtChange = detail.objectiveContext.atChange.value ?? null;
    const latestObjective = detail.objectiveContext.latest.value ?? null;
    const objectiveContextLabel =
      latestObjective && latestObjective !== objectiveAtChange
        ? `${objectiveAtChange ?? 'Not captured'} -> ${latestObjective}`
        : objectiveAtChange ?? latestObjective ?? 'Not captured';
    const cautions = buildOutcomeReviewSegmentCautions({
      detail,
      previousDetail,
      horizon: args.horizon,
    });

    return {
      segmentId: `segment:${detail.phase.changeSetId}`,
      phaseChangeSetId: detail.phase.changeSetId,
      segmentOrdinal: index + 1,
      segmentLabel: `${segmentStartLabel} -> ${segmentEndLabel}`,
      segmentDateWindowLabel:
        segmentStartDate && segmentEndDate
          ? `${segmentStartDate} to ${segmentEndDate}`
          : 'Awaiting validated effective date',
      segmentStartLabel,
      segmentEndLabel,
      segmentStartDate,
      segmentEndDate,
      objectiveAtChange,
      latestObjective,
      objectiveChangedMidSegment: detail.objectiveContext.changedSincePhase,
      objectiveContextLabel,
      score: detail.score.score,
      scoreLabel: detail.score.label,
      confidence: detail.score.confidence,
      shortKpiSummary: buildOutcomeReviewShortKpiSummary(detail),
      cautions,
      filterKey: getAdsOptimizerOutcomeReviewSegmentFilterKey({
        scoreLabel: detail.score.label,
        phaseStatus: detail.phase.status,
      }),
      detailHref: detail.detailHref,
      hasMarker: detail.phase.validatedEffectiveDate !== null,
      validatedEffectiveDate: detail.phase.validatedEffectiveDate,
      phaseStatus: detail.phase.status,
    };
  });
};

export const buildAdsOptimizerOutcomeReviewPhaseSummaries = ({
  changeSets,
  changeSetItems,
  linkedChanges,
  validations,
}: BuildPhaseSummariesArgs): AdsOptimizerOutcomeReviewPhaseSummary[] => {
  const itemsByChangeSetId = new Map<string, OutcomeReviewChangeSetItemRow[]>();
  changeSetItems.forEach((item) => {
    const bucket = itemsByChangeSetId.get(item.change_set_id) ?? [];
    bucket.push(item);
    itemsByChangeSetId.set(item.change_set_id, bucket);
  });

  const latestValidationByChangeId = new Map<string, OutcomeReviewValidationRow>();
  validations.forEach((validation) => {
    if (!latestValidationByChangeId.has(validation.change_id)) {
      latestValidationByChangeId.set(validation.change_id, validation);
    }
  });

  const linkedChangesByRunId = new Map<string, OutcomeReviewLinkedChangeRow[]>();
  linkedChanges.forEach((change) => {
    const runId = extractLinkedRunId(change);
    if (!runId) return;
    const bucket = linkedChangesByRunId.get(runId) ?? [];
    bucket.push(change);
    linkedChangesByRunId.set(runId, bucket);
  });

  return [...changeSets]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((changeSet) => {
      const filters = asObject(changeSet.filters_json) ?? {};
      const handoffMeta = readAdsWorkspaceHandoffMeta(
        changeSet.filters_json,
        changeSet.generated_artifact_json
      );
      const runId = asString(filters.optimizer_run_id);
      const phaseChanges = changeSet.generated_run_id
        ? linkedChangesByRunId.get(changeSet.generated_run_id) ?? []
        : [];
      const validationSummary = emptyValidationSummary();
      const validatedDates: string[] = [];

      phaseChanges.forEach((change) => {
        const validation = latestValidationByChangeId.get(change.change_id) ?? null;
        const status =
          validation?.status === 'validated' ||
          validation?.status === 'mismatch' ||
          validation?.status === 'not_found'
            ? validation.status
            : 'pending';
        addValidationStatus(validationSummary, status);
        if (status === 'validated' && validation?.validated_snapshot_date) {
          validatedDates.push(validation.validated_snapshot_date);
        }
      });

      const filterTargetSnapshotIds = asStringArray(filters.target_snapshot_ids);
      const uniqueTargetIds = new Set(
        (itemsByChangeSetId.get(changeSet.id) ?? []).flatMap((item) =>
          [asString(item.target_id), asString(item.target_key)].filter(
            (value): value is string => Boolean(value)
          )
        )
      );
      const stagedActionCount =
        handoffMeta?.stagedActionCount ??
        (itemsByChangeSetId.get(changeSet.id) ?? []).length;
      const targetCount =
        filterTargetSnapshotIds.length > 0
          ? filterTargetSnapshotIds.length
          : handoffMeta?.selectedRowCount ?? uniqueTargetIds.size;

      const firstValidatedDate =
        validatedDates.length > 0 ? [...validatedDates].sort()[0] ?? null : null;
      const validatedEffectiveDate =
        validatedDates.length > 0 ? [...validatedDates].sort().at(-1) ?? null : null;

      return {
        changeSetId: changeSet.id,
        changeSetName: changeSet.name,
        optimizerRunId: runId,
        selectedAsin: asString(filters.asin),
        stagedActionCount,
        targetCount,
        validationSummary,
        firstValidatedDate,
        validatedEffectiveDate,
        status: resolvePhaseStatus(validationSummary),
        createdAt: changeSet.created_at,
        generatedRunId: changeSet.generated_run_id,
      };
    });
};

export const getAdsOptimizerOutcomeReviewData = async (args: {
  asin: string;
  start: string;
  end: string;
  horizon: AdsOptimizerOutcomeReviewHorizon;
  metric: AdsOptimizerOutcomeReviewMetric;
}): Promise<AdsOptimizerOutcomeReviewData> => {
  const scopedChangeSets = await fetchOutcomeReviewChangeSets({
    asin: args.asin,
    createdAtStart: args.start,
    createdAtEnd: args.end,
  });
  const changeSetIds = scopedChangeSets.map((changeSet) => changeSet.id);
  const generatedRunIds = Array.from(
    new Set(
      scopedChangeSets
        .map((changeSet) => asString(changeSet.generated_run_id))
        .filter((value): value is string => Boolean(value))
    )
  );

  const [changeSetItems, linkedChanges, salesDaily] = await Promise.all([
    fetchOutcomeReviewChangeSetItems(changeSetIds),
    fetchOutcomeReviewLinkedChanges(generatedRunIds),
    getSalesDaily({
      accountId: env.accountId,
      marketplace: env.marketplace,
      asin: args.asin,
      start: args.start,
      end: args.end,
    }),
  ]);
  const validations = await fetchOutcomeReviewValidations(linkedChanges);

  const phases = buildAdsOptimizerOutcomeReviewPhaseSummaries({
    changeSets: scopedChangeSets,
    changeSetItems,
    linkedChanges,
    validations,
  });
  const trendPoints = buildTrendPoints(salesDaily);
  const displayedTrendPoints = sliceDisplayedTrend(trendPoints, args.horizon);
  const displayedSummary = summarizeOutcomeTrendPoints(displayedTrendPoints);
  const orderedPhases = [...phases].sort(comparePhaseOrder);
  const phaseDetails = await Promise.all(
    orderedPhases.map(async (phase, index) => {
      const nextPhase = orderedPhases[index + 1] ?? null;
      const segmentEndDate =
        nextPhase?.validatedEffectiveDate
          ? addDays(nextPhase.validatedEffectiveDate, -1) ?? args.end
          : args.end;
      const detail = await getAdsOptimizerOutcomeReviewDetailData({
        changeSetId: phase.changeSetId,
        horizon: args.horizon,
        selectedStartDate: args.start,
        selectedEndDate: segmentEndDate,
        metric: args.metric,
      });
      if (!detail || detail.kind !== 'ready') {
        return null;
      }
      return {
        ...detail,
        detailHref: buildOutcomeReviewDetailHref({
          changeSetId: phase.changeSetId,
          asin: args.asin,
          start: args.start,
          end: segmentEndDate,
          horizon: args.horizon,
          metric: args.metric,
        }),
      };
    })
  );
  const segments = buildAdsOptimizerOutcomeReviewSegments({
    phaseDetails: phaseDetails.filter((value): value is OutcomeReviewSegmentInput => value !== null),
    horizon: args.horizon,
  });

  return {
    asin: args.asin,
    start: args.start,
    end: args.end,
    horizon: args.horizon,
    metric: args.metric,
    trendPoints,
    displayedTrendPoints,
    displayedSummary,
    phases,
    phaseCount: phases.length,
    validatedPhaseCount: phases.filter((phase) => phase.status === 'validated').length,
    pendingPhaseCount: phases.filter((phase) => phase.status !== 'validated').length,
    stagedActionCount: phases.reduce((sum, phase) => sum + phase.stagedActionCount, 0),
    segments,
  };
};

export const getAdsOptimizerOutcomeReviewDetailData = async (args: {
  changeSetId: string;
  horizon: AdsOptimizerOutcomeReviewHorizon;
  selectedEndDate?: string | null;
  selectedStartDate?: string | null;
  metric?: AdsOptimizerOutcomeReviewMetric | null;
}): Promise<AdsOptimizerOutcomeReviewDetailData | null> => {
  const changeSet = await supabaseAdmin
    .from('ads_change_sets')
    .select('id,name,objective,filters_json,generated_run_id,generated_artifact_json,created_at')
    .eq('id', args.changeSetId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (changeSet.error) {
    throw new Error(`Failed to load outcome review phase ${args.changeSetId}: ${changeSet.error.message}`);
  }
  if (!changeSet.data) return null;

  const typedChangeSet = changeSet.data as OutcomeReviewChangeSetRow;
  const filters = asObject(typedChangeSet.filters_json) ?? {};
  const source = asString(filters.source);
  const asin = asString(filters.asin) ?? 'all';
  const selectedEndDate =
    normalizeDateOnly(args.selectedEndDate) ??
    normalizeDateOnly(asString(filters.end)) ??
    TODAY;
  const selectedStartDate =
    normalizeDateOnly(args.selectedStartDate) ??
    normalizeDateOnly(asString(filters.start)) ??
    addDays(selectedEndDate, -30) ??
    selectedEndDate;
  const metric = args.metric ?? 'contribution_after_ads';
  const returnHref = buildAdsOptimizerHref({
    start: selectedStartDate,
    end: selectedEndDate,
    asin,
    view: 'overview',
    utility: 'outcomes',
    horizon: args.horizon,
    metric,
  });

  if (source !== HANDOFF_SOURCE) {
    return {
      kind: 'not_optimizer',
      changeSetId: typedChangeSet.id,
      changeSetName: typedChangeSet.name,
      source,
      returnHref,
    };
  }

  const [scopedChangeSets, productMeta] = await Promise.all([
    fetchOutcomeReviewChangeSets({
      asin,
      createdAtEnd: selectedEndDate,
    }),
    findOptimizerProductByAsin(asin),
  ]);
  const changeSetIds = scopedChangeSets.map((row) => row.id);
  const generatedRunIds = Array.from(
    new Set(
      scopedChangeSets
        .map((row) => asString(row.generated_run_id))
        .filter((value): value is string => Boolean(value))
    )
  );

  const [changeSetItems, linkedChanges] = await Promise.all([
    fetchOutcomeReviewChangeSetItems(changeSetIds),
    fetchOutcomeReviewLinkedChanges(generatedRunIds),
  ]);
  const validations = await fetchOutcomeReviewValidations(linkedChanges);
  const phases = buildAdsOptimizerOutcomeReviewPhaseSummaries({
    changeSets: scopedChangeSets,
    changeSetItems,
    linkedChanges,
    validations,
  });
  const phase = phases.find((entry) => entry.changeSetId === args.changeSetId) ?? null;
  if (!phase) return null;

  const sortedValidatedPhases = phases
    .filter((entry) => entry.validatedEffectiveDate)
    .sort((left, right) =>
      String(left.validatedEffectiveDate).localeCompare(String(right.validatedEffectiveDate))
    );
  const nextPhase =
    phase.validatedEffectiveDate
      ? sortedValidatedPhases.find(
          (entry) =>
            entry.changeSetId !== phase.changeSetId &&
            String(entry.validatedEffectiveDate) > String(phase.validatedEffectiveDate)
        ) ?? null
      : null;

  const earliestTrendStart =
    phase.validatedEffectiveDate
      ? addDays(phase.validatedEffectiveDate, -Number(args.horizon))
      : addDays(selectedEndDate, -(Number(args.horizon) * 2 - 1));
  const salesDaily = await getSalesDaily({
    accountId: env.accountId,
    marketplace: env.marketplace,
    asin,
    start: earliestTrendStart ?? selectedStartDate,
    end: selectedEndDate,
  });
  const trendPoints = buildTrendPoints(salesDaily);
  const { windows, postWindowCappedByNextPhase } = buildAdsOptimizerOutcomeReviewWindowSummaries({
    trendPoints,
    validatedEffectiveDate: phase.validatedEffectiveDate,
    horizon: args.horizon,
    selectedEndDate,
    nextPhaseValidatedEffectiveDate: nextPhase?.validatedEffectiveDate ?? null,
  });

  const settings =
    productMeta?.productId ? await getProductOptimizerSettingsByProductId(productMeta.productId) : null;
  const archetype = settings?.archetype ?? null;
  const beforeWindow = windows.find((window) => window.key === 'before') ?? null;
  const afterWindow = windows.find((window) => window.key === 'after') ?? null;
  const latestWindow = windows.find((window) => window.key === 'latest') ?? null;

  const [atChangeRun, latestCompletedRun] = await Promise.all([
    phase.optimizerRunId ? getAdsOptimizerRunById(phase.optimizerRunId) : Promise.resolve(null),
    listAdsOptimizerRuns({ asin, limit: 50 }).then((rows) =>
      rows.find(
        (row) =>
          row.status === 'completed' &&
          row.completed_at !== null &&
          row.completed_at.slice(0, 10) <= selectedEndDate
      ) ?? null
    ),
  ]);

  const [atChangeSnapshots, latestSnapshots] = await Promise.all([
    atChangeRun ? listAdsOptimizerProductSnapshotsByRun(atChangeRun.run_id) : Promise.resolve([]),
    latestCompletedRun
      ? listAdsOptimizerProductSnapshotsByRun(latestCompletedRun.run_id)
      : Promise.resolve([]),
  ]);

  const atChangeSnapshot = atChangeSnapshots[0] ?? null;
  const latestSnapshot = latestSnapshots[0] ?? null;
  const atChangeObjectiveFromSnapshot = atChangeSnapshot
    ? readObjectiveFromSnapshotPayload(atChangeSnapshot.snapshot_payload_json)
    : { value: null, reason: null };
  const latestObjectiveFromSnapshot = latestSnapshot
    ? readObjectiveFromSnapshotPayload(latestSnapshot.snapshot_payload_json)
    : { value: null, reason: null };

  const latestOverview =
    latestWindow?.startDate && latestWindow?.endDate
      ? await getAdsOptimizerOverviewData({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
          start: latestWindow.startDate,
          end: latestWindow.endDate,
          archetype,
        })
      : null;

  const [beforeOverview, afterOverview] = await Promise.all([
    beforeWindow?.startDate && beforeWindow?.endDate
      ? getAdsOptimizerOverviewData({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
          start: beforeWindow.startDate,
          end: beforeWindow.endDate,
          archetype,
        })
      : Promise.resolve(null),
    afterWindow?.startDate && afterWindow?.endDate
      ? getAdsOptimizerOverviewData({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
          start: afterWindow.startDate,
          end: afterWindow.endDate,
          archetype,
        })
      : Promise.resolve(null),
  ]);

  const objectiveAtChange = {
    value:
      atChangeObjectiveFromSnapshot.value ??
      (typedChangeSet.objective as AdsOptimizerObjective | null) ??
      null,
    reason:
      atChangeObjectiveFromSnapshot.reason ??
      (typedChangeSet.objective
        ? 'Recovered from the persisted optimizer handoff objective on the change set.'
        : null),
    source:
      atChangeObjectiveFromSnapshot.value !== null
        ? 'optimizer_product_snapshot'
        : typedChangeSet.objective
          ? 'change_set_objective'
          : 'unavailable',
    runId: atChangeRun?.run_id ?? phase.optimizerRunId,
    windowStart: atChangeRun?.date_start ?? normalizeDateOnly(asString(filters.start)),
    windowEnd: atChangeRun?.date_end ?? normalizeDateOnly(asString(filters.end)),
  } as const;

  const latestObjective = latestObjectiveFromSnapshot.value
    ? {
        value: latestObjectiveFromSnapshot.value,
        reason: latestObjectiveFromSnapshot.reason,
        source: 'optimizer_product_snapshot' as const,
        runId: latestCompletedRun?.run_id ?? null,
        windowStart: latestCompletedRun?.date_start ?? latestWindow?.startDate ?? null,
        windowEnd: latestCompletedRun?.date_end ?? latestWindow?.endDate ?? null,
      }
    : {
        value: latestOverview?.objective.value ?? null,
        reason: latestOverview?.objective.reason ?? null,
        source: latestOverview ? ('current_overview' as const) : ('unavailable' as const),
        runId: null,
        windowStart: latestWindow?.startDate ?? null,
        windowEnd: latestWindow?.endDate ?? null,
      };

  const visibilitySignal = buildAdsOptimizerOutcomeReviewVisibilitySignal({
    beforeKeyword: beforeOverview?.visibility.heroQueryTrend.keyword ?? null,
    afterKeyword: afterOverview?.visibility.heroQueryTrend.keyword ?? null,
    latestKeyword: latestOverview?.visibility.heroQueryTrend.keyword ?? null,
    beforeRank: beforeOverview?.visibility.heroQueryTrend.latestOrganicRank ?? null,
    afterRank: afterOverview?.visibility.heroQueryTrend.latestOrganicRank ?? null,
    latestRank: latestOverview?.visibility.heroQueryTrend.latestOrganicRank ?? null,
    beforeDetail: beforeOverview?.visibility.heroQueryTrend.detail ?? 'Before-window visibility was unavailable.',
    afterDetail: afterOverview?.visibility.heroQueryTrend.detail ?? 'After-window visibility was unavailable.',
    latestDetail: latestOverview?.visibility.heroQueryTrend.detail ?? 'Latest-window visibility was unavailable.',
  });

  const score = scoreAdsOptimizerOutcomeReview({
    objective: objectiveAtChange.value ?? latestObjective.value,
    phaseStatus: phase.status,
    horizon: args.horizon,
    windows,
    visibilitySignal,
  });

  const stagedChanges = changeSetItems
    .filter((item) => item.change_set_id === typedChangeSet.id)
    .map((item) => summarizeChangeItem(item));

  return {
    kind: 'ready',
    changeSetId: typedChangeSet.id,
    changeSetName: typedChangeSet.name,
    asin,
    selectedEndDate,
    horizon: args.horizon,
    phase,
    stagedChanges,
    reviewOnlyNotes: buildAdsOptimizerOutcomeReviewReviewOnlyNotes(typedChangeSet),
    objectiveContext: {
      archetype,
      atChange: objectiveAtChange,
      latest: latestObjective,
      changedSincePhase:
        objectiveAtChange.value !== null &&
        latestObjective.value !== null &&
        objectiveAtChange.value !== latestObjective.value,
    },
    windows,
    score,
    latestValidationDate: phase.validatedEffectiveDate,
    nextPhaseValidatedEffectiveDate: nextPhase?.validatedEffectiveDate ?? null,
    postWindowCappedByNextPhase,
    runId: phase.optimizerRunId,
    returnHref,
  };
};
