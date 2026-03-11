import 'server-only';

import { env } from '@/lib/env';

import { getProductOptimizerSettingsByProductId } from './repoConfig';
import { getAdsOptimizerOverviewData, type AdsOptimizerOverviewData } from './overview';
import {
  buildAdsOptimizerRoleTransitionReason,
  enrichAdsOptimizerTargetSnapshotRolePayload,
  readAdsOptimizerTargetRunRole,
  type AdsOptimizerTargetRole,
} from './role';
import { buildAdsOptimizerRecommendationSnapshot } from './recommendation';
import {
  createAdsOptimizerRun,
  findOptimizerProductByAsin,
  getAdsOptimizerRuntimeContext,
  insertAdsOptimizerProductSnapshots,
  insertAdsOptimizerRecommendationSnapshots,
  insertAdsOptimizerRoleTransitionLogs,
  insertAdsOptimizerTargetSnapshots,
  listAdsOptimizerProductSnapshotsByRun,
  listAdsOptimizerRuns,
  listAdsOptimizerTargetSnapshotsByRun,
  updateAdsOptimizerRun,
} from './repoRuntime';
import {
  enrichAdsOptimizerProductSnapshotPayload,
  enrichAdsOptimizerTargetSnapshotPayload,
  readAdsOptimizerProductRunState,
  type AdsOptimizerProductRunState,
} from './state';
import type { AdsOptimizerRun, JsonObject } from './runtimeTypes';
import {
  loadAdsOptimizerTargetProfiles,
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
  runs: Awaited<ReturnType<typeof listAdsOptimizerRuns>>;
};

export type AdsOptimizerTargetsViewData = {
  run: AdsOptimizerRun | null;
  latestCompletedRun: AdsOptimizerRun | null;
  productState: AdsOptimizerProductRunState | null;
  rows: AdsOptimizerTargetProfileSnapshotView[];
};

type ExecuteManualRunDeps = {
  now: () => string;
  getRuntimeContext: typeof getAdsOptimizerRuntimeContext;
  createRun: typeof createAdsOptimizerRun;
  updateRun: typeof updateAdsOptimizerRun;
  getProductSettings: typeof getProductOptimizerSettingsByProductId;
  loadPreviousRoleMap: (args: {
    asin: string;
    currentRunId: string;
  }) => Promise<Map<string, AdsOptimizerTargetRole>>;
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

const defaultDeps: ExecuteManualRunDeps = {
  now: () => new Date().toISOString(),
  getRuntimeContext: getAdsOptimizerRuntimeContext,
  createRun: createAdsOptimizerRun,
  updateRun: updateAdsOptimizerRun,
  getProductSettings: getProductOptimizerSettingsByProductId,
  loadPreviousRoleMap,
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
  const runtimeContext = await deps.getRuntimeContext();
  const run = await deps.createRun({
    selectedAsin: args.asin,
    dateStart: args.start,
    dateEnd: args.end,
    rulePackVersionId: runtimeContext.activeVersion.rule_pack_version_id,
    rulePackVersionLabel: runtimeContext.activeVersion.version_label,
    inputSummary: {
      phase: 8,
      requested_scope: {
        asin: args.asin,
        start: args.start,
        end: args.end,
        channel: 'sp',
        run_kind: 'manual',
      },
      rule_pack_version: {
        rule_pack_version_id: runtimeContext.activeVersion.rule_pack_version_id,
        version_label: runtimeContext.activeVersion.version_label,
      },
      snapshot_boundaries: {
        product_snapshot_source: 'phase3_product_command_center',
        target_snapshot_source: TARGET_SOURCE_SCOPE,
        target_profile_engine: 'phase5_target_profile_engine',
        state_engine: 'phase6_state_engine',
        role_engine: 'phase7_role_guardrail_engine',
        recommendation_snapshot_behavior:
          'Phase 8 persists deterministic read-only recommendation sets inside optimizer-owned snapshot storage only. No Ads Workspace handoff or execution writes occur here.',
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
    const productSettings = productSnapshot.productId
      ? await deps.getProductSettings(productSnapshot.productId)
      : null;
    const productSnapshotPayload = enrichAdsOptimizerProductSnapshotPayload({
      payload: productSnapshot.snapshotPayload,
      overview: productSnapshot.overview,
    });
    const previousRoleMap = await deps.loadPreviousRoleMap({
      asin: args.asin,
      currentRunId: run.run_id,
    });
    const targetSnapshotLoad = await deps.loadTargetSnapshotInputs({
      ...args,
      overviewData: readSnapshotOverview(productSnapshotPayload),
    });
    const targetSnapshotRows = targetSnapshotLoad.rows.map((row) => ({
      ...row,
      snapshotPayload: enrichAdsOptimizerTargetSnapshotRolePayload({
        payload: enrichAdsOptimizerTargetSnapshotPayload({
          payload: row.snapshotPayload,
          rulePackPayload: runtimeContext.activeVersion.change_payload_json,
        }),
        rulePackPayload: runtimeContext.activeVersion.change_payload_json,
        previousRole: previousRoleMap.get(row.targetId) ?? null,
        archetype: productSettings?.archetype ?? null,
        productOverrides: productSettings?.guardrail_overrides_json ?? null,
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

    const insertedRecommendationSnapshots = await deps.insertRecommendationSnapshots(
      insertedTargetSnapshots.map((snapshot, index) => {
        const recommendation = buildAdsOptimizerRecommendationSnapshot({
          targetSnapshotId: snapshot.target_snapshot_id,
          targetId: snapshot.target_id,
          payload: targetSnapshotRows[index]?.snapshotPayload ?? {},
          rulePackPayload: runtimeContext.activeVersion.change_payload_json,
        });

        return {
          runId: run.run_id,
          targetSnapshotId: snapshot.target_snapshot_id,
          asin: snapshot.asin,
          status: recommendation.status,
          actionType: recommendation.actionType,
          reasonCodes: recommendation.reasonCodes,
          snapshotPayload: recommendation.snapshotPayload,
        };
      })
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
  const runtimeContext = await getAdsOptimizerRuntimeContext();
  const runs = await listAdsOptimizerRuns({
    asin: asin === 'all' ? undefined : asin,
    limit: 30,
  });

  return {
    activeVersionLabel: runtimeContext.activeVersion.version_label,
    runs,
  };
};

export const getAdsOptimizerTargetsViewData = async (args: {
  asin: string;
  start: string;
  end: string;
}): Promise<AdsOptimizerTargetsViewData> => {
  const runs = await listAdsOptimizerRuns({
    asin: args.asin,
    limit: 30,
  });
  const completedRuns = runs.filter((run) => run.status === 'completed');
  const exactRun =
    completedRuns.find(
      (run) => run.selected_asin === args.asin && run.date_start === args.start && run.date_end === args.end
    ) ?? null;
  const latestCompletedRun = completedRuns[0] ?? null;

  if (!exactRun) {
    return {
      run: null,
      latestCompletedRun,
      productState: null,
      rows: [],
    };
  }

  const [productSnapshots, snapshots] = await Promise.all([
    listAdsOptimizerProductSnapshotsByRun(exactRun.run_id),
    listAdsOptimizerTargetSnapshotsByRun(exactRun.run_id),
  ]);
  return {
    run: exactRun,
    latestCompletedRun,
    productState: productSnapshots[0]
      ? readAdsOptimizerProductRunState(productSnapshots[0].snapshot_payload_json)
      : null,
    rows: snapshots.map(mapTargetSnapshotToProfileView),
  };
};
