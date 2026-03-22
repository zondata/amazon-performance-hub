import 'server-only';

import { env } from '@/lib/env';
import { listChangeSetItems } from '@/lib/ads-workspace/repoChangeSetItems';
import { listChangeSets } from '@/lib/ads-workspace/repoChangeSets';

import {
  toAdsOptimizerEffectiveVersionContextJson,
  type AdsOptimizerEffectiveVersionContext,
} from './effectiveVersion';
import { getProductOptimizerSettingsByProductId, getRulePackVersion } from './repoConfig';
import { listActiveAdsOptimizerRecommendationOverrides } from './repoOverrides';
import {
  buildAdsOptimizerRunComparison,
  type AdsOptimizerComparisonRow,
  type AdsOptimizerComparisonRunRef,
  type AdsOptimizerRunComparisonView,
} from './comparison';
import {
  buildAdsOptimizerOverviewComparisonWindow,
  getAdsOptimizerOverviewData,
  recommendAdsOptimizerObjective,
  type AdsOptimizerOverviewData,
} from './overview';
import {
  buildAdsOptimizerRoleTransitionReason,
  enrichAdsOptimizerTargetSnapshotRolePayload,
  readAdsOptimizerTargetRunRole,
  type AdsOptimizerTargetRole,
} from './role';
import {
  createEmptyAdsOptimizerLastDetectedChange,
  loadAdsOptimizerLastDetectedChangesForTargets,
  type AdsOptimizerLastDetectedChange,
} from './lastDetectedChange';
import { buildAdsOptimizerRecommendationSnapshots } from './recommendation';
import {
  createAdsOptimizerRun,
  findOptimizerProductByAsin,
  getAdsOptimizerRunById,
  getAdsOptimizerRuntimeContext,
  resolveAdsOptimizerRuntimeContextForAsin,
  insertAdsOptimizerProductSnapshots,
  insertAdsOptimizerRecommendationSnapshots,
  insertAdsOptimizerRoleTransitionLogs,
  insertAdsOptimizerTargetSnapshots,
  listAdsOptimizerProductSnapshotsByRun,
  listAdsOptimizerRecommendationSnapshotsByRun,
  listAdsOptimizerRoleTransitionLogsByAsin,
  listAdsOptimizerRuns,
  listAdsOptimizerTargetSnapshotsByRun,
  updateAdsOptimizerRun,
} from './repoRuntime';
import {
  readAdsOptimizerRecommendationSnapshotView,
  type AdsOptimizerRecommendationSnapshotView,
} from './recommendation';
import {
  enrichAdsOptimizerProductSnapshotPayload,
  enrichAdsOptimizerTargetSnapshotPayload,
  readAdsOptimizerProductRunState,
  type AdsOptimizerProductRunState,
} from './state';
import type { AdsOptimizerRun, JsonObject } from './runtimeTypes';
import type { AdsOptimizerRecommendationOverride } from './types';
import {
  loadAdsOptimizerTargetProfiles,
  mapTargetProfileRowToSnapshotView,
  mapTargetSnapshotToProfileView,
  type AdsOptimizerTargetProfileSnapshotView,
} from './targetProfile';

type CreateAdsOptimizerManualRunInput = {
  asin: string;
  start: string;
  end: string;
};

type ProductSnapshotInput = {
  productId: string | null;
  asin: string;
  overview: AdsOptimizerOverviewData;
  snapshotPayload: JsonObject;
};

type TargetSnapshotInput = {
  asin: string;
  campaignId: string;
  adGroupId: string;
  targetId: string;
  sourceScope: string;
  coverageNote: string;
  snapshotPayload: JsonObject;
};

type TargetSnapshotLoadArgs = {
  asin: string;
  start: string;
  end: string;
  overviewData?: AdsOptimizerOverviewData;
};

type TargetSnapshotLoadResult = {
  rows: TargetSnapshotInput[];
  zeroTargetDiagnostics: JsonObject | null;
};

export type AdsOptimizerManualRunResult = {
  runId: string;
  status: 'completed' | 'failed';
  productSnapshotCount: number;
  targetSnapshotCount: number;
  recommendationSnapshotCount: number;
  diagnostics: JsonObject | null;
};

export type AdsOptimizerHistoryViewData = {
  activeVersionLabel: string;
  runNowVersionContext: AdsOptimizerEffectiveVersionContext | null;
  runs: Awaited<ReturnType<typeof listAdsOptimizerRuns>>;
};

export type AdsOptimizerHeaderRunContext = {
  requestedRunId: string | null;
  requestedRun: AdsOptimizerRun | null;
  requestedRunError: string | null;
  matchingWindowRun: AdsOptimizerRun | null;
  latestCompletedRun: AdsOptimizerRun | null;
};

export type AdsOptimizerTargetsViewData = {
  run: AdsOptimizerRun | null;
  latestCompletedRun: AdsOptimizerRun | null;
  productId: string | null;
  productState: AdsOptimizerProductRunState | null;
  comparison: AdsOptimizerRunComparisonView | null;
  rows: AdsOptimizerTargetReviewRow[];
  requestedRunId: string | null;
  resolvedContextSource: 'run_id' | 'window' | null;
  runLookupError: string | null;
};

export type AdsOptimizerTargetRoleHistoryEntry = {
  roleTransitionLogId: string;
  runId: string;
  targetSnapshotId: string | null;
  createdAt: string;
  fromRole: string | null;
  toRole: string | null;
  desiredRole: string | null;
  transitionRule: string | null;
  transitionReasonCodes: string[];
  roleReasonCodes: string[];
  guardrailReasonCodes: string[];
};

export type AdsOptimizerTargetReviewRow = AdsOptimizerTargetProfileSnapshotView & {
  persistedTargetKey: string;
  recommendation: AdsOptimizerRecommendationSnapshotView | null;
  manualOverride?: AdsOptimizerRecommendationOverride | null;
  lastDetectedChange?: AdsOptimizerLastDetectedChange;
  previousComparable?: AdsOptimizerTargetProfileSnapshotView | null;
  roleHistory: AdsOptimizerTargetRoleHistoryEntry[];
  queue: {
    priority: number | null;
    recommendationCount: number;
    primaryActionType: string | null;
    spendDirection: string | null;
    reasonCodeBadges: string[];
    readOnlyBoundary: string | null;
    hasCoverageGaps: boolean;
  };
};

type ExecuteManualRunDeps = {
  now: () => string;
  getRuntimeContext: typeof resolveAdsOptimizerRuntimeContextForAsin;
  createRun: typeof createAdsOptimizerRun;
  updateRun: typeof updateAdsOptimizerRun;
  getProductSettings: typeof getProductOptimizerSettingsByProductId;
  loadPreviousRoleMap: (args: {
    asin: string;
    currentRunId: string;
  }) => Promise<Map<string, AdsOptimizerTargetRole>>;
  loadPreviousRecommendationContext: (args: {
    asin: string;
    start: string;
    end: string;
    currentRunId: string;
  }) => Promise<
    Map<
      string,
      {
        recommendationSnapshotId: string;
        createdAt: string;
        payload: JsonObject;
      }
    >
  >;
  loadProductSnapshotInput: (args: {
    asin: string;
    start: string;
    end: string;
  }) => Promise<ProductSnapshotInput>;
  loadTargetSnapshotInputs: (args: TargetSnapshotLoadArgs) => Promise<TargetSnapshotLoadResult>;
  insertProductSnapshots: typeof insertAdsOptimizerProductSnapshots;
  insertTargetSnapshots: typeof insertAdsOptimizerTargetSnapshots;
  insertRoleTransitionLogs: typeof insertAdsOptimizerRoleTransitionLogs;
  insertRecommendationSnapshots: typeof insertAdsOptimizerRecommendationSnapshots;
};

type OptimizerWorkspaceHandoffAudit = {
  changeSetCount: number;
  itemCount: number;
  latestChangeSetName: string | null;
  entityKeys: string[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TARGET_SOURCE_SCOPE = 'asin_via_sp_advertised_product_membership';

const normalizeManualRunInput = (input: CreateAdsOptimizerManualRunInput) => {
  const asin = input.asin.trim();
  const start = input.start.trim();
  const end = input.end.trim();

  if (!asin || asin === 'all') {
    throw new Error('Manual optimizer runs require one selected ASIN in Phase 7.');
  }
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    throw new Error('start and end must be valid YYYY-MM-DD dates.');
  }
  if (start > end) {
    throw new Error('start must be on or before end.');
  }

  return {
    asin,
    start,
    end,
  };
};

const buildProductSnapshotPayload = (
  asin: string,
  start: string,
  end: string,
  overview: AdsOptimizerOverviewData
): JsonObject => ({
  phase: 4,
  capture_type: 'product_snapshot',
  source: 'phase3_product_command_center',
  execution_boundary: 'snapshot_only',
  window: {
    start,
    end,
  },
  asin,
  overview,
});

const loadProductSnapshotInput = async (args: {
  asin: string;
  start: string;
  end: string;
}): Promise<ProductSnapshotInput> => {
  const [productMeta, overview] = await Promise.all([
    findOptimizerProductByAsin(args.asin),
    getAdsOptimizerOverviewData({
      accountId: env.accountId,
      marketplace: env.marketplace,
      asin: args.asin,
      start: args.start,
      end: args.end,
    }),
  ]);

  return {
    productId: productMeta?.productId ?? null,
    asin: args.asin,
    overview,
    snapshotPayload: buildProductSnapshotPayload(args.asin, args.start, args.end, overview),
  };
};

const readSnapshotOverview = (snapshotPayload: JsonObject): AdsOptimizerOverviewData | undefined => {
  const overview = snapshotPayload.overview;
  if (!overview || typeof overview !== 'object' || Array.isArray(overview)) {
    return undefined;
  }
  return overview as AdsOptimizerOverviewData;
};

const applyArchetypeObjectiveToOverview = (args: {
  overview: AdsOptimizerOverviewData;
  archetype: 'design_led' | 'visibility_led' | 'hybrid';
}): AdsOptimizerOverviewData => {
  const adSales = args.overview.economics.adSales;
  const adSpend = args.overview.economics.adSpend;
  const acos = adSales > 0 ? adSpend / adSales : null;

  return {
    ...args.overview,
    objective: recommendAdsOptimizerObjective({
      state: args.overview.state.value,
      acos,
      breakEvenAcos: args.overview.economics.breakEvenAcos,
      heroQueryTrend: args.overview.visibility.heroQueryTrend,
      totalSqpSearchVolume: args.overview.visibility.sqpCoverage.totalSearchVolume,
      archetype: args.archetype,
    }),
  };
};

export const loadTargetSnapshotInputs = async (
  args: TargetSnapshotLoadArgs
): Promise<TargetSnapshotLoadResult> => {
  const result = await loadAdsOptimizerTargetProfiles(args);

  return {
    rows: result.rows.map((row) => ({
      asin: row.asin,
      campaignId: row.campaignId,
      adGroupId: row.adGroupId,
      targetId: row.targetId,
      sourceScope: row.sourceScope,
      coverageNote: row.coverageNote ?? '',
      snapshotPayload: row.snapshotPayload,
    })),
    zeroTargetDiagnostics: result.zeroTargetDiagnostics,
  };
};

const buildFailureDiagnostics = (stage: string, error: unknown): JsonObject => ({
  stage,
  error_message: error instanceof Error ? error.message : 'Unknown optimizer run failure.',
  recorded_at: new Date().toISOString(),
});

const asJsonObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
};

const readString = (value: JsonObject | null, key: string) =>
  typeof value?.[key] === 'string' ? (value[key] as string) : null;

const readStringArray = (value: JsonObject | null, key: string) => {
  const raw = value?.[key];
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string') : [];
};

const assertPersistedRecommendationRows = (args: {
  targetSnapshotCount: number;
  recommendationRows: Awaited<ReturnType<typeof insertAdsOptimizerRecommendationSnapshots>>;
}) => {
  if (args.recommendationRows.length !== args.targetSnapshotCount) {
    throw new Error(
      `Persisted recommendation row count mismatch: expected ${args.targetSnapshotCount}, received ${args.recommendationRows.length}.`
    );
  }

  args.recommendationRows.forEach((row, index) => {
    const payload = row.snapshot_payload_json;
    if (row.status === 'pending_phase5') {
      throw new Error(
        `Persisted recommendation row ${index + 1} for run ${row.run_id} is still pending_phase5.`
      );
    }
    if (
      row.reason_codes_json?.includes('PHASE4_BACKBONE_ONLY') ||
      row.reason_codes_json?.includes('NO_RECOMMENDATION_ENGINE_ACTIVE')
    ) {
      throw new Error(
        `Persisted recommendation row ${index + 1} for run ${row.run_id} still contains placeholder reason codes.`
      );
    }
    if (payload.execution_boundary !== 'read_only_recommendation_only') {
      throw new Error(
        `Persisted recommendation row ${index + 1} for run ${row.run_id} is missing the Phase 8 read-only boundary.`
      );
    }
    if (payload.workspace_handoff !== 'not_started') {
      throw new Error(
        `Persisted recommendation row ${index + 1} for run ${row.run_id} is missing workspace_handoff=not_started.`
      );
    }
    if (payload.writes_execution_tables !== false) {
      throw new Error(
        `Persisted recommendation row ${index + 1} for run ${row.run_id} must persist writes_execution_tables=false.`
      );
    }
  });
};

const buildTargetReviewRows = (args: {
  snapshots: Awaited<ReturnType<typeof listAdsOptimizerTargetSnapshotsByRun>>;
  recommendationSnapshots: Awaited<ReturnType<typeof listAdsOptimizerRecommendationSnapshotsByRun>>;
  roleHistoryByTargetId: Map<string, AdsOptimizerTargetRoleHistoryEntry[]>;
  activeOverrides?: AdsOptimizerRecommendationOverride[];
}): AdsOptimizerTargetReviewRow[] => {
  const recommendationsByTargetSnapshotId = new Map(
    args.recommendationSnapshots.map((snapshot) => [
      snapshot.target_snapshot_id,
      readAdsOptimizerRecommendationSnapshotView(snapshot),
    ])
  );
  const activeOverrides = args.activeOverrides ?? [];

  return args.snapshots.map((snapshot) => {
    const baseRow = mapTargetSnapshotToProfileView(snapshot);
    const recommendation = recommendationsByTargetSnapshotId.get(snapshot.target_snapshot_id) ?? null;
    const manualOverride =
      activeOverrides.find(
        (override) =>
          override.override_scope === 'one_time' &&
          recommendation?.recommendationSnapshotId === override.recommendation_snapshot_id
      ) ??
      activeOverrides.find(
        (override) =>
          override.override_scope === 'persistent' && override.target_id === snapshot.target_id
      ) ??
      null;

    return {
      ...baseRow,
      persistedTargetKey: snapshot.target_id,
      recommendation,
      manualOverride,
      lastDetectedChange: createEmptyAdsOptimizerLastDetectedChange(),
      roleHistory: args.roleHistoryByTargetId.get(snapshot.target_id) ?? [],
      queue: {
        priority: recommendation?.actions[0]?.priority ?? null,
        recommendationCount: recommendation?.actionCount ?? 0,
        primaryActionType: recommendation?.primaryActionType ?? recommendation?.actionType ?? null,
        spendDirection: recommendation?.spendDirection ?? null,
        reasonCodeBadges:
          recommendation && recommendation.reasonCodes.length > 0
            ? recommendation.reasonCodes.slice(0, 3)
            : baseRow.state.summaryReasonCodes.slice(0, 3),
        readOnlyBoundary: recommendation?.executionBoundary ?? null,
        hasCoverageGaps:
          !recommendation ||
          baseRow.coverage.notes.length > 0 ||
          baseRow.coverage.criticalWarnings.length > 0 ||
          recommendation.coverageFlags.some(
            (flag) => flag.includes('_MISSING') || flag.includes('_PARTIAL')
          ),
      },
    };
  });
};

const toComparisonRow = (row: AdsOptimizerTargetReviewRow): AdsOptimizerComparisonRow => ({
  targetId: row.targetId,
  persistedTargetKey: row.persistedTargetKey,
  targetText: row.targetText,
  state: {
    efficiency: row.state.efficiency,
    confidence: row.state.confidence,
    importance: row.state.importance,
  },
  role: {
    currentRole: row.role.currentRole,
    desiredRole: row.role.desiredRole,
  },
  recommendation: row.recommendation
    ? {
        spendDirection: row.recommendation.spendDirection,
        primaryActionType: row.recommendation.primaryActionType,
        actionCount: row.recommendation.actionCount,
        actions: row.recommendation.actions.map((action) => ({
          actionType: action.actionType,
        })),
        exceptionSignals: row.recommendation.exceptionSignals.map((signal) => ({
          type: signal.type,
          severity: signal.severity,
        })),
        portfolioControls: row.recommendation.portfolioControls
          ? {
              discoverCapBlocked: row.recommendation.portfolioControls.discoverCapBlocked,
              learningBudgetExceeded: row.recommendation.portfolioControls.learningBudgetExceeded,
              stopLossCapExceeded: row.recommendation.portfolioControls.stopLossCapExceeded,
              budgetShareExceeded: row.recommendation.portfolioControls.budgetShareExceeded,
              discoverRank: row.recommendation.portfolioControls.discoverRank,
              targetSpendShare: row.recommendation.portfolioControls.targetSpendShare,
            }
          : null,
      }
    : null,
});

const loadOptimizerWorkspaceHandoffAudit = async (
  runIds: string[]
): Promise<Map<string, OptimizerWorkspaceHandoffAudit>> => {
  const normalizedRunIds = [...new Set(runIds.filter(Boolean))];
  const summaryByRunId = new Map<string, OptimizerWorkspaceHandoffAudit>();

  normalizedRunIds.forEach((runId) => {
    summaryByRunId.set(runId, {
      changeSetCount: 0,
      itemCount: 0,
      latestChangeSetName: null,
      entityKeys: [],
    });
  });

  if (normalizedRunIds.length === 0) {
    return summaryByRunId;
  }

  const changeSets = await listChangeSets({ limit: 100 });
  const relevantChangeSets = changeSets.filter((changeSet) => {
    const filters = asJsonObject(changeSet.filters_json);
    return (
      readString(filters, 'source') === 'ads_optimizer_phase10_handoff' &&
      normalizedRunIds.includes(readString(filters, 'optimizer_run_id') ?? '')
    );
  });

  const changeSetItems = await Promise.all(
    relevantChangeSets.map(async (changeSet) => ({
      changeSet,
      items: await listChangeSetItems(changeSet.id),
    }))
  );

  changeSetItems.forEach(({ changeSet, items }) => {
    const filters = asJsonObject(changeSet.filters_json);
    const runId = readString(filters, 'optimizer_run_id');
    if (!runId) return;

    const bucket = summaryByRunId.get(runId);
    if (!bucket) return;

    bucket.changeSetCount += 1;
    bucket.itemCount += items.length;
    if (!bucket.latestChangeSetName) {
      bucket.latestChangeSetName = changeSet.name;
    }
    items.forEach((item) => {
      const targetKey = item.target_key ?? item.target_id ?? item.entity_key;
      if (targetKey) {
        bucket.entityKeys.push(targetKey);
      }
    });
  });

  return new Map(
    [...summaryByRunId.entries()].map(([runId, value]) => [
      runId,
      {
        ...value,
        entityKeys: [...new Set(value.entityKeys)],
      },
    ])
  );
};

const loadPreviousRoleMap = async (args: {
  asin: string;
  currentRunId: string;
}): Promise<Map<string, AdsOptimizerTargetRole>> => {
  const runs = await listAdsOptimizerRuns({
    asin: args.asin,
    limit: 30,
  });
  const previousCompletedRun = runs.find(
    (run) => run.run_id !== args.currentRunId && run.status === 'completed'
  );

  if (!previousCompletedRun) {
    return new Map();
  }

  const snapshots = await listAdsOptimizerTargetSnapshotsByRun(previousCompletedRun.run_id);
  const roles = new Map<string, AdsOptimizerTargetRole>();

  for (const snapshot of snapshots) {
    const role = readAdsOptimizerTargetRunRole(snapshot.snapshot_payload_json);
    const currentRole = role?.currentRole.value ?? role?.desiredRole.value ?? null;
    if (currentRole) {
      roles.set(snapshot.target_id, currentRole);
    }
  }

  return roles;
};

const loadPreviousRecommendationContext = async (args: {
  asin: string;
  start: string;
  end: string;
  currentRunId: string;
}): Promise<
  Map<
    string,
    {
      recommendationSnapshotId: string;
      createdAt: string;
      payload: JsonObject;
    }
  >
> => {
  const runs = await listAdsOptimizerRuns({
    asin: args.asin,
    limit: 30,
  });
  const previousComparableRun =
    runs.find(
      (run) =>
        run.run_id !== args.currentRunId &&
        run.status === 'completed' &&
        run.selected_asin === args.asin &&
        run.date_start === args.start &&
        run.date_end === args.end
    ) ?? null;

  if (!previousComparableRun) {
    return new Map();
  }

  const [targetSnapshots, recommendationSnapshots] = await Promise.all([
    listAdsOptimizerTargetSnapshotsByRun(previousComparableRun.run_id),
    listAdsOptimizerRecommendationSnapshotsByRun(previousComparableRun.run_id),
  ]);
  const targetIdBySnapshotId = new Map(
    targetSnapshots.map((snapshot) => [snapshot.target_snapshot_id, snapshot.target_id])
  );
  const previousContext = new Map<
    string,
    {
      recommendationSnapshotId: string;
      createdAt: string;
      payload: JsonObject;
    }
  >();

  recommendationSnapshots.forEach((snapshot) => {
    const targetId = targetIdBySnapshotId.get(snapshot.target_snapshot_id);
    if (!targetId || previousContext.has(targetId)) {
      return;
    }
    previousContext.set(targetId, {
      recommendationSnapshotId: snapshot.recommendation_snapshot_id,
      createdAt: snapshot.created_at,
      payload: snapshot.snapshot_payload_json,
    });
  });

  return previousContext;
};

const defaultDeps: ExecuteManualRunDeps = {
  now: () => new Date().toISOString(),
  getRuntimeContext: resolveAdsOptimizerRuntimeContextForAsin,
  createRun: createAdsOptimizerRun,
  updateRun: updateAdsOptimizerRun,
  getProductSettings: getProductOptimizerSettingsByProductId,
  loadPreviousRoleMap,
  loadPreviousRecommendationContext,
  loadProductSnapshotInput,
  loadTargetSnapshotInputs,
  insertProductSnapshots: insertAdsOptimizerProductSnapshots,
  insertTargetSnapshots: insertAdsOptimizerTargetSnapshots,
  insertRoleTransitionLogs: insertAdsOptimizerRoleTransitionLogs,
  insertRecommendationSnapshots: insertAdsOptimizerRecommendationSnapshots,
};

export const executeAdsOptimizerManualRun = async (
  input: CreateAdsOptimizerManualRunInput,
  deps: ExecuteManualRunDeps = defaultDeps
): Promise<AdsOptimizerManualRunResult> => {
  const args = normalizeManualRunInput(input);
  const runtimeContext = await deps.getRuntimeContext({
    asin: args.asin,
  });
  const run = await deps.createRun({
    selectedAsin: args.asin,
    dateStart: args.start,
    dateEnd: args.end,
    rulePackVersionId: runtimeContext.effectiveVersion.rule_pack_version_id,
    rulePackVersionLabel: runtimeContext.effectiveVersion.version_label,
    inputSummary: {
      phase: 11,
      requested_scope: {
        asin: args.asin,
        start: args.start,
        end: args.end,
        channel: 'sp',
        run_kind: 'manual',
      },
      rule_pack_version: toAdsOptimizerEffectiveVersionContextJson(
        runtimeContext.effectiveVersionContext
      ),
      snapshot_boundaries: {
        product_snapshot_source: 'phase3_product_command_center',
        target_snapshot_source: TARGET_SOURCE_SCOPE,
        target_profile_engine: 'phase5_target_profile_engine',
        state_engine: 'phase6_state_engine',
        role_engine: 'phase7_role_guardrail_engine',
        recommendation_snapshot_behavior:
          'Phase 11 persists deterministic recommendation sets with portfolio caps, query diagnostics, placement diagnostics, and exception signals inside optimizer-owned snapshot storage only. Ads Workspace remains the execution boundary.',
        execution_boundary: 'Existing Ads Workspace remains the execution path.',
      },
    },
  });

  await deps.updateRun(run.run_id, {
    status: 'running',
    diagnostics: null,
    startedAt: deps.now(),
    completedAt: null,
  });

  try {
    const productSnapshot = await deps.loadProductSnapshotInput(args);
    const productSettings =
      runtimeContext.productSettings ??
      (productSnapshot.productId
        ? await deps.getProductSettings(productSnapshot.productId)
        : null);
    const effectiveProductSettings = productSettings?.optimizer_enabled ? productSettings : null;
    const effectiveOverview = applyArchetypeObjectiveToOverview({
      overview: productSnapshot.overview,
      archetype: effectiveProductSettings?.archetype ?? 'hybrid',
    });
    const productSnapshotPayloadBase = enrichAdsOptimizerProductSnapshotPayload({
      payload: productSnapshot.snapshotPayload,
      overview: effectiveOverview,
    });
    const existingRuntimeContext = asJsonObject(productSnapshotPayloadBase.runtime_context) ?? {};
    const productSnapshotPayload = {
      ...productSnapshotPayloadBase,
      runtime_context: {
        ...existingRuntimeContext,
        effective_rule_pack_version: toAdsOptimizerEffectiveVersionContextJson(
          runtimeContext.effectiveVersionContext
        ),
      },
    };
    const [previousRoleMap, previousRecommendationContext] = await Promise.all([
      deps.loadPreviousRoleMap({
        asin: args.asin,
        currentRunId: run.run_id,
      }),
      deps.loadPreviousRecommendationContext({
        asin: args.asin,
        start: args.start,
        end: args.end,
        currentRunId: run.run_id,
      }),
    ]);
    const targetSnapshotLoad = await deps.loadTargetSnapshotInputs({
      ...args,
      overviewData: readSnapshotOverview(productSnapshotPayload),
    });
    const targetSnapshotRows = targetSnapshotLoad.rows.map((row) => ({
      ...row,
      snapshotPayload: enrichAdsOptimizerTargetSnapshotRolePayload({
        payload: enrichAdsOptimizerTargetSnapshotPayload({
          payload: row.snapshotPayload,
          rulePackPayload: runtimeContext.effectiveVersion.change_payload_json,
        }),
        rulePackPayload: runtimeContext.effectiveVersion.change_payload_json,
        previousRole: previousRoleMap.get(row.targetId) ?? null,
        archetype: effectiveProductSettings?.archetype ?? null,
        productOverrides: effectiveProductSettings?.guardrail_overrides_json ?? null,
      }),
    }));

    const insertedProductSnapshots = await deps.insertProductSnapshots([
      {
        runId: run.run_id,
        productId: productSnapshot.productId,
        asin: productSnapshot.asin,
        snapshotPayload: productSnapshotPayload,
      },
    ]);

    const insertedTargetSnapshots = await deps.insertTargetSnapshots(
      targetSnapshotRows.map((row) => ({
        runId: run.run_id,
        asin: row.asin,
        campaignId: row.campaignId,
        adGroupId: row.adGroupId,
        targetId: row.targetId,
        sourceScope: row.sourceScope,
        coverageNote: row.coverageNote,
        snapshotPayload: row.snapshotPayload,
      }))
    );

    const insertedRoleTransitions = await deps.insertRoleTransitionLogs(
      insertedTargetSnapshots.flatMap((snapshot, index) => {
        const role = readAdsOptimizerTargetRunRole(targetSnapshotRows[index]?.snapshotPayload ?? {});
        if (!role?.currentRole.value) {
          return [];
        }

        const transitionReason = buildAdsOptimizerRoleTransitionReason({
          role,
          targetSnapshotId: snapshot.target_snapshot_id,
          targetId: snapshot.target_id,
        });
        if (!transitionReason) {
          return [];
        }

        return [
          {
            runId: run.run_id,
            targetSnapshotId: snapshot.target_snapshot_id,
            asin: snapshot.asin,
            targetId: snapshot.target_id,
            fromRole: role.previousRole,
            toRole: role.currentRole.value,
            transitionReason,
          },
        ];
      })
    );

    const recommendationSnapshots = buildAdsOptimizerRecommendationSnapshots({
      rows: insertedTargetSnapshots.map((snapshot, index) => ({
        targetSnapshotId: snapshot.target_snapshot_id,
        targetId: snapshot.target_id,
        payload: targetSnapshotRows[index]?.snapshotPayload ?? {},
        previousRecommendation: previousRecommendationContext.get(snapshot.target_id) ?? null,
      })),
      rulePackPayload: runtimeContext.effectiveVersion.change_payload_json,
    });

    const insertedRecommendationSnapshots = await deps.insertRecommendationSnapshots(
      recommendationSnapshots.map((recommendation, index) => ({
        runId: run.run_id,
        targetSnapshotId: recommendation.targetSnapshotId,
        asin: insertedTargetSnapshots[index]!.asin,
        status: recommendation.status,
        actionType: recommendation.actionType,
        reasonCodes: recommendation.reasonCodes,
        snapshotPayload: recommendation.snapshotPayload,
      }))
    );
    assertPersistedRecommendationRows({
      targetSnapshotCount: insertedTargetSnapshots.length,
      recommendationRows: insertedRecommendationSnapshots,
    });

    await deps.updateRun(run.run_id, {
      status: 'completed',
      diagnostics: targetSnapshotLoad.zeroTargetDiagnostics,
      productSnapshotCount: insertedProductSnapshots.length,
      targetSnapshotCount: insertedTargetSnapshots.length,
      recommendationSnapshotCount: insertedRecommendationSnapshots.length,
      roleTransitionCount: insertedRoleTransitions.length,
      completedAt: deps.now(),
    });

    return {
      runId: run.run_id,
      status: 'completed',
      productSnapshotCount: insertedProductSnapshots.length,
      targetSnapshotCount: insertedTargetSnapshots.length,
      recommendationSnapshotCount: insertedRecommendationSnapshots.length,
      diagnostics: targetSnapshotLoad.zeroTargetDiagnostics,
    };
  } catch (error) {
    const diagnostics = buildFailureDiagnostics('manual_run', error);
    await deps.updateRun(run.run_id, {
      status: 'failed',
      diagnostics,
      completedAt: deps.now(),
    });

    return {
      runId: run.run_id,
      status: 'failed',
      productSnapshotCount: 0,
      targetSnapshotCount: 0,
      recommendationSnapshotCount: 0,
      diagnostics,
    };
  }
};

export const getAdsOptimizerHistoryViewData = async (
  asin: string
): Promise<AdsOptimizerHistoryViewData> => {
  const activeRuntimeContext =
    asin === 'all' ? await getAdsOptimizerRuntimeContext() : null;
  const resolvedRuntimeContext =
    asin === 'all' ? null : await resolveAdsOptimizerRuntimeContextForAsin({ asin });
  const runs = await listAdsOptimizerRuns({
    asin: asin === 'all' ? undefined : asin,
    limit: 30,
  });

  return {
    activeVersionLabel:
      resolvedRuntimeContext?.activeVersion.version_label ??
      activeRuntimeContext?.activeVersion.version_label ??
      '—',
    runNowVersionContext: resolvedRuntimeContext?.effectiveVersionContext ?? null,
    runs,
  };
};

export const getAdsOptimizerHeaderRunContext = async (args: {
  asin: string;
  start: string;
  end: string;
  runId?: string | null;
}): Promise<AdsOptimizerHeaderRunContext> => {
  const requestedRunId = args.runId?.trim() ? args.runId.trim() : null;
  const runs = await listAdsOptimizerRuns({
    asin: args.asin === 'all' ? undefined : args.asin,
    limit: 30,
  });
  const completedRuns = runs.filter((run) => run.status === 'completed');
  const latestCompletedRun = completedRuns[0] ?? null;

  let requestedRun: AdsOptimizerRun | null = null;
  let requestedRunError: string | null = null;
  if (requestedRunId) {
    const runById = await getAdsOptimizerRunById(requestedRunId);
    if (!runById) {
      requestedRunError = `Persisted run ${requestedRunId} was not found for this account/marketplace.`;
    } else if (runById.status !== 'completed') {
      requestedRunError = `Persisted run ${requestedRunId} is ${runById.status} and is not reviewable in Targets yet.`;
    } else {
      requestedRun = runById;
    }
  }

  const matchingWindowRun =
    args.asin === 'all'
      ? null
      : completedRuns.find(
          (run) =>
            run.selected_asin === args.asin &&
            run.date_start === args.start &&
            run.date_end === args.end
        ) ?? null;

  return {
    requestedRunId,
    requestedRun,
    requestedRunError,
    matchingWindowRun,
    latestCompletedRun,
  };
};

export const getAdsOptimizerTargetsViewData = async (args: {
  asin: string;
  start: string;
  end: string;
  runId?: string | null;
}): Promise<AdsOptimizerTargetsViewData> => {
  const requestedRunId = args.runId?.trim() ? args.runId.trim() : null;
  const runs = await listAdsOptimizerRuns({
    asin: args.asin === 'all' ? undefined : args.asin,
    limit: 30,
  });
  const completedRuns = runs.filter((run) => run.status === 'completed');
  const latestCompletedRun = completedRuns[0] ?? null;
  let exactRun: AdsOptimizerRun | null = null;
  let resolvedContextSource: 'run_id' | 'window' | null = null;
  const runLookupError: string | null = null;

  if (requestedRunId) {
    const runById = await getAdsOptimizerRunById(requestedRunId);
    if (!runById) {
      return {
        run: null,
        latestCompletedRun,
        productId: null,
        productState: null,
        comparison: null,
        rows: [],
        requestedRunId,
        resolvedContextSource: null,
        runLookupError: `Persisted run ${requestedRunId} was not found for this account/marketplace.`,
      };
    }
    if (runById.status !== 'completed') {
      return {
        run: null,
        latestCompletedRun,
        productId: null,
        productState: null,
        comparison: null,
        rows: [],
        requestedRunId,
        resolvedContextSource: null,
        runLookupError: `Persisted run ${requestedRunId} is ${runById.status} and is not reviewable in Targets yet.`,
      };
    }
    exactRun = runById;
    resolvedContextSource = 'run_id';
  } else {
    exactRun =
      completedRuns.find(
        (run) =>
          run.selected_asin === args.asin &&
          run.date_start === args.start &&
          run.date_end === args.end
      ) ?? null;
    resolvedContextSource = exactRun ? 'window' : null;
  }

  if (!exactRun) {
    return {
      run: null,
      latestCompletedRun,
      productId: null,
      productState: null,
      comparison: null,
      rows: [],
      requestedRunId,
      resolvedContextSource,
      runLookupError,
    };
  }

  const comparisonWindow = buildAdsOptimizerOverviewComparisonWindow({
    start: exactRun.date_start,
    end: exactRun.date_end,
  });

  const comparableRuns = (
    exactRun.selected_asin === args.asin && requestedRunId === null
      ? completedRuns
      : await listAdsOptimizerRuns({
          asin: exactRun.selected_asin,
          limit: 30,
        }).then((items) => items.filter((run) => run.status === 'completed'))
  ).filter(
    (run) =>
      run.selected_asin === exactRun.selected_asin &&
      run.date_start === exactRun.date_start &&
      run.date_end === exactRun.date_end
  );
  const previousComparableRun =
    comparableRuns.find((run) => run.run_id !== exactRun.run_id) ?? null;

  const [
    productSnapshots,
    snapshots,
    recommendationSnapshots,
    roleTransitionLogs,
    previousSnapshots,
    previousRecommendationSnapshots,
    previousPeriodTargetProfiles,
    currentVersion,
    previousVersion,
    handoffAuditByRunId,
  ] = await Promise.all([
    listAdsOptimizerProductSnapshotsByRun(exactRun.run_id),
    listAdsOptimizerTargetSnapshotsByRun(exactRun.run_id),
    listAdsOptimizerRecommendationSnapshotsByRun(exactRun.run_id),
    listAdsOptimizerRoleTransitionLogsByAsin({
      asin: exactRun.selected_asin,
      limit: 250,
    }),
    previousComparableRun
      ? listAdsOptimizerTargetSnapshotsByRun(previousComparableRun.run_id)
      : Promise.resolve([]),
    previousComparableRun
      ? listAdsOptimizerRecommendationSnapshotsByRun(previousComparableRun.run_id)
      : Promise.resolve([]),
    loadAdsOptimizerTargetProfiles({
      asin: exactRun.selected_asin,
      start: comparisonWindow.previous.start,
      end: comparisonWindow.previous.end,
    }).catch(() => ({
      rows: [],
      zeroTargetDiagnostics: null,
    })),
    getRulePackVersion(exactRun.rule_pack_version_id),
    previousComparableRun ? getRulePackVersion(previousComparableRun.rule_pack_version_id) : Promise.resolve(null),
    loadOptimizerWorkspaceHandoffAudit(
      previousComparableRun ? [exactRun.run_id, previousComparableRun.run_id] : [exactRun.run_id]
    ),
  ]);
  const productId = productSnapshots[0]?.product_id ?? null;
  const activeOverrides =
    productId && snapshots.length > 0
      ? await listActiveAdsOptimizerRecommendationOverrides({
          productId,
          targetIds: snapshots.map((snapshot) => snapshot.target_id),
          recommendationSnapshotIds: recommendationSnapshots.map(
            (snapshot) => snapshot.recommendation_snapshot_id
          ),
        })
      : [];
  const roleHistoryByTargetId = new Map<string, AdsOptimizerTargetRoleHistoryEntry[]>();
  roleTransitionLogs.forEach((log) => {
    if (!log.target_id) return;

    const transitionReason = asJsonObject(log.transition_reason_json);
    const historyEntry: AdsOptimizerTargetRoleHistoryEntry = {
      roleTransitionLogId: log.role_transition_log_id,
      runId: log.run_id,
      targetSnapshotId: log.target_snapshot_id,
      createdAt: log.created_at,
      fromRole: log.from_role,
      toRole: log.to_role,
      desiredRole: readString(transitionReason, 'desired_role'),
      transitionRule: readString(transitionReason, 'transition_rule'),
      transitionReasonCodes: readStringArray(transitionReason, 'transition_reason_codes'),
      roleReasonCodes: readStringArray(transitionReason, 'role_reason_codes'),
      guardrailReasonCodes: readStringArray(transitionReason, 'guardrail_reason_codes'),
    };
    const bucket = roleHistoryByTargetId.get(log.target_id) ?? [];
    bucket.push(historyEntry);
    roleHistoryByTargetId.set(log.target_id, bucket);
  });
  const rows = buildTargetReviewRows({
    snapshots,
    recommendationSnapshots,
    roleHistoryByTargetId,
    activeOverrides,
  });
  const lastDetectedChangeByTargetSnapshotId =
    rows.length > 0 ? await loadAdsOptimizerLastDetectedChangesForTargets(rows) : new Map();
  const rowsWithLastDetectedChange = rows.map((row) => ({
    ...row,
    lastDetectedChange:
      lastDetectedChangeByTargetSnapshotId.get(row.targetSnapshotId) ??
      row.lastDetectedChange ??
      createEmptyAdsOptimizerLastDetectedChange(),
  }));
  const previousRows = previousComparableRun
    ? buildTargetReviewRows({
        snapshots: previousSnapshots,
        recommendationSnapshots: previousRecommendationSnapshots,
        roleHistoryByTargetId: new Map(),
      })
    : [];
  const previousRowsByKey = new Map(
    previousPeriodTargetProfiles.rows.map((row) => [
      row.targetId,
      mapTargetProfileRowToSnapshotView(row, {
        targetSnapshotId: `previous-period:${row.targetId}`,
        runId: `previous-period:${comparisonWindow.previous.start}:${comparisonWindow.previous.end}`,
        createdAt: exactRun.created_at,
      }),
    ] as const)
  );
  const currentRows = rowsWithLastDetectedChange.map((row) => ({
    ...row,
    previousComparable: previousRowsByKey.get(row.persistedTargetKey) ?? null,
  }));
  const comparison = previousComparableRun
    ? buildAdsOptimizerRunComparison({
        currentRun: exactRun,
        previousRun: previousComparableRun,
        currentRows: currentRows.map(toComparisonRow),
        previousRows: previousRows.map(toComparisonRow),
        currentVersion: {
          versionLabel: exactRun.rule_pack_version_label,
          changeSummary: currentVersion?.change_summary ?? null,
        },
        previousVersion: previousComparableRun
          ? {
              versionLabel: previousComparableRun.rule_pack_version_label,
              changeSummary: previousVersion?.change_summary ?? null,
            }
          : null,
        recentComparableRuns: comparableRuns.slice(0, 5).map(
          (run): AdsOptimizerComparisonRunRef => ({
            runId: run.run_id,
            createdAt: run.created_at,
            rulePackVersionLabel: run.rule_pack_version_label,
          })
        ),
        currentHandoff: handoffAuditByRunId.get(exactRun.run_id) ?? {
          changeSetCount: 0,
          itemCount: 0,
          latestChangeSetName: null,
          entityKeys: [],
        },
        previousHandoff: handoffAuditByRunId.get(previousComparableRun.run_id) ?? {
          changeSetCount: 0,
          itemCount: 0,
          latestChangeSetName: null,
          entityKeys: [],
        },
      })
    : null;

  return {
    run: exactRun,
    latestCompletedRun,
    productId,
    productState: productSnapshots[0]
      ? readAdsOptimizerProductRunState(productSnapshots[0].snapshot_payload_json)
      : null,
    comparison,
    rows: currentRows,
    requestedRunId,
    resolvedContextSource,
    runLookupError,
  };
};
