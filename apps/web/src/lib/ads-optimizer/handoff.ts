import 'server-only';

import {
  createChangeSet,
} from '@/lib/ads-workspace/repoChangeSets';
import {
  createChangeSetItems,
  listChangeSetItems,
} from '@/lib/ads-workspace/repoChangeSetItems';
import type { ChangeSetItemPayload, ChangeSetPayload, JsonObject } from '@/lib/ads-workspace/types';

import {
  getAdsOptimizerTargetsViewData,
  type AdsOptimizerTargetReviewRow,
} from './runtime';

export const ADS_OPTIMIZER_WORKSPACE_HANDOFF_ACTION_TYPES = [
  'update_target_bid',
  'update_target_state',
  'update_placement_modifier',
] as const;

type AdsOptimizerWorkspaceHandoffActionType =
  (typeof ADS_OPTIMIZER_WORKSPACE_HANDOFF_ACTION_TYPES)[number];

type ExecuteAdsOptimizerWorkspaceHandoffInput = {
  asin: string;
  start: string;
  end: string;
  targetSnapshotIds: string[];
};

type AdsOptimizerWorkspaceHandoffPlan = {
  changeSetPayload: ChangeSetPayload;
  itemPayloads: ChangeSetItemPayload[];
  selectedRowCount: number;
  stagedActionCount: number;
  dedupedActionCount: number;
  skippedUnsupportedActionCount: number;
  skippedUnsupportedActionTypes: string[];
  recommendationSnapshotIds: string[];
};

export type AdsOptimizerWorkspaceHandoffResult = {
  changeSetId: string;
  changeSetName: string;
  selectedRowCount: number;
  stagedActionCount: number;
  dedupedActionCount: number;
  skippedUnsupportedActionCount: number;
  skippedUnsupportedActionTypes: string[];
  queueCount: number;
};

type ExecuteAdsOptimizerWorkspaceHandoffDeps = {
  now: () => string;
  loadTargetsViewData: typeof getAdsOptimizerTargetsViewData;
  createChangeSet: typeof createChangeSet;
  createChangeSetItems: typeof createChangeSetItems;
  listChangeSetItems: typeof listChangeSetItems;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const defaultDeps: ExecuteAdsOptimizerWorkspaceHandoffDeps = {
  now: () => new Date().toISOString(),
  loadTargetsViewData: getAdsOptimizerTargetsViewData,
  createChangeSet,
  createChangeSetItems,
  listChangeSetItems,
};

const isWorkspaceSupportedActionType = (
  value: string | null
): value is AdsOptimizerWorkspaceHandoffActionType =>
  value !== null &&
  ADS_OPTIMIZER_WORKSPACE_HANDOFF_ACTION_TYPES.includes(
    value as AdsOptimizerWorkspaceHandoffActionType
  );

const getUnsupportedReviewOnlyActions = (row: AdsOptimizerTargetReviewRow) =>
  (row.recommendation?.actions ?? []).filter(
    (action) => !isWorkspaceSupportedActionType(action.actionType)
  );

const trimToNull = (value: unknown) => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readString = (value: JsonObject | null, key: string) =>
  typeof value?.[key] === 'string' ? (value[key] as string) : null;

const readNumber = (value: JsonObject | null, key: string) => {
  const raw = value?.[key];
  if (raw === null || raw === undefined || raw === '') return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeHandoffInput = (input: ExecuteAdsOptimizerWorkspaceHandoffInput) => {
  const asin = input.asin.trim();
  const start = input.start.trim();
  const end = input.end.trim();
  const targetSnapshotIds = [...new Set(input.targetSnapshotIds.map((value) => value.trim()).filter(Boolean))];

  if (!asin || asin === 'all') {
    throw new Error('Workspace handoff requires one selected ASIN.');
  }
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    throw new Error('Workspace handoff requires valid YYYY-MM-DD start/end dates.');
  }
  if (start > end) {
    throw new Error('start must be on or before end.');
  }
  if (targetSnapshotIds.length === 0) {
    throw new Error('Select at least one optimizer recommendation row before handoff.');
  }

  return {
    asin,
    start,
    end,
    targetSnapshotIds,
  };
};

const formatPlacementCode = (value: string | null | undefined) => {
  const normalized = trimToNull(value);
  if (!normalized) return 'Placement';
  if (normalized === 'PLACEMENT_TOP') return 'Top of Search';
  if (normalized === 'PLACEMENT_REST_OF_SEARCH') return 'Rest of Search';
  if (normalized === 'PLACEMENT_PRODUCT_PAGE') return 'Product Pages';
  return normalized;
};

const readReviewAfterDays = (row: AdsOptimizerTargetReviewRow) => {
  const cadenceAction =
    row.recommendation?.actions.find(
      (action) => action.actionType === 'change_review_cadence'
    ) ?? null;
  const cadence = readString(cadenceAction?.proposedChange ?? null, 'recommended_cadence');

  if (cadence === 'daily') return 1;
  if (cadence === 'every_3_days') return 3;
  if (cadence === 'weekly') return 7;
  if (cadence === 'every_14_days') return 14;
  return null;
};

const buildSharedReasoning = (args: {
  asin: string;
  start: string;
  end: string;
  runId: string;
  objective: string | null;
  selectedRowCount: number;
  skippedUnsupportedActionTypes: string[];
  stagedActionCount: number;
}) => {
  const objective = args.objective ?? 'Optimizer handoff';
  const skippedUnsupportedLabel =
    args.skippedUnsupportedActionTypes.length > 0
      ? ` Unsupported review-only action types skipped: ${args.skippedUnsupportedActionTypes.join(', ')}.`
      : '';

  return {
    objective,
    hypothesis: `Stage persisted optimizer recommendations from run ${args.runId} into Ads Workspace for manual review and execution.`,
    notes:
      `Created from /ads/optimizer for ${args.asin} over ${args.start} to ${args.end}. ` +
      `${args.selectedRowCount} target row(s) selected and ${args.stagedActionCount} workspace action(s) staged.` +
      skippedUnsupportedLabel,
  };
};

const buildChangeSetName = (args: {
  asin: string;
  start: string;
  end: string;
  createdAt: string;
}) =>
  `Optimizer handoff ${args.asin} ${args.start} to ${args.end} ${args.createdAt.slice(11, 16)}`;

const buildTargetItemPayload = (args: {
  row: AdsOptimizerTargetReviewRow;
  actionType: 'update_target_bid' | 'update_target_state';
  entityContext: JsonObject | null;
  proposedChange: JsonObject | null;
  objective: string;
  hypothesis: string;
  notes: string;
  reviewAfterDays: number | null;
}) => {
  if (args.actionType === 'update_target_bid') {
    const nextBid = readNumber(args.proposedChange, 'next_bid');
    if (nextBid === null) {
      throw new Error(`Target ${args.row.targetText} is missing next_bid in the persisted recommendation action.`);
    }

    return {
      channel: 'sp',
      entity_level: 'target',
      entity_key: args.row.persistedTargetKey,
      campaign_id: args.row.campaignId,
      ad_group_id: args.row.adGroupId,
      target_id: args.row.targetId,
      target_key:
        args.row.persistedTargetKey !== args.row.targetId ? args.row.persistedTargetKey : null,
      placement_code: null,
      action_type: 'update_target_bid',
      before_json: {
        bid: readNumber(args.entityContext, 'current_bid') ?? args.row.raw.cpc,
      },
      after_json: {
        bid: nextBid,
      },
      objective: args.objective,
      hypothesis: args.hypothesis,
      forecast_json: null,
      review_after_days: args.reviewAfterDays,
      notes: args.notes,
      objective_preset_id: null,
      ui_context_json: null,
    } satisfies ChangeSetItemPayload;
  }

  const nextState = readString(args.proposedChange, 'next_state');
  if (!nextState) {
    throw new Error(`Target ${args.row.targetText} is missing next_state in the persisted recommendation action.`);
  }

  return {
    channel: 'sp',
    entity_level: 'target',
    entity_key: args.row.persistedTargetKey,
    campaign_id: args.row.campaignId,
    ad_group_id: args.row.adGroupId,
    target_id: args.row.targetId,
    target_key:
      args.row.persistedTargetKey !== args.row.targetId ? args.row.persistedTargetKey : null,
    placement_code: null,
    action_type: 'update_target_state',
    before_json: {
      state: readString(args.entityContext, 'current_state'),
    },
    after_json: {
      state: nextState,
    },
    objective: args.objective,
    hypothesis: args.hypothesis,
    forecast_json: null,
    review_after_days: args.reviewAfterDays,
    notes: args.notes,
    objective_preset_id: null,
    ui_context_json: null,
  } satisfies ChangeSetItemPayload;
};

const buildPlacementItemPayload = (args: {
  row: AdsOptimizerTargetReviewRow;
  entityContext: JsonObject | null;
  proposedChange: JsonObject | null;
  objective: string;
  hypothesis: string;
  notes: string;
  reviewAfterDays: number | null;
}) => {
  const placementCode = trimToNull(
    readString(args.entityContext, 'placement_code') ??
      readString(args.proposedChange, 'placement_code')
  );
  const nextPercentage = readNumber(args.proposedChange, 'next_percentage');

  if (!placementCode) {
    throw new Error(
      `Target ${args.row.targetText} is missing placement_code in the persisted placement recommendation action.`
    );
  }
  if (nextPercentage === null) {
    throw new Error(
      `Target ${args.row.targetText} is missing next_percentage in the persisted placement recommendation action.`
    );
  }

  return {
    channel: 'sp',
    entity_level: 'placement',
    entity_key: `${args.row.campaignId}::${placementCode}`,
    campaign_id: args.row.campaignId,
    ad_group_id: null,
    target_id: null,
    target_key: null,
    placement_code: placementCode,
    action_type: 'update_placement_modifier',
    before_json: {
      placement_code: placementCode,
      percentage: readNumber(args.entityContext, 'current_percentage'),
    },
    after_json: {
      placement_code: placementCode,
      percentage: nextPercentage,
    },
    objective: args.objective,
    hypothesis: args.hypothesis,
    forecast_json: null,
    review_after_days: args.reviewAfterDays,
    notes: args.notes,
    objective_preset_id: null,
    ui_context_json: null,
  } satisfies ChangeSetItemPayload;
};

const buildUiContextJson = (args: {
  row: AdsOptimizerTargetReviewRow;
  actionType: AdsOptimizerWorkspaceHandoffActionType;
  runId: string;
  asin: string;
  start: string;
  end: string;
  recommendationReasonCodes: string[];
  actionReasonCodes: string[];
}) => ({
  surface: 'ads_optimizer_handoff',
  row_surface: 'targets',
  campaign_name: args.row.campaignName,
  ad_group_name: args.row.adGroupName,
  target_text: args.row.targetText,
  match_type: args.row.matchType,
  placement_label:
    args.actionType === 'update_placement_modifier'
      ? formatPlacementCode(
          args.row.recommendation?.actions.find(
            (action) => action.actionType === 'update_placement_modifier'
          )?.entityContext?.placement_code as string | null | undefined
        )
      : null,
  placement_modifier_pct: args.row.placementContext.topOfSearchModifierPct,
  coverage_note: args.row.coverage.notes[0] ?? null,
  optimizer_handoff: {
    phase: 10,
    source: 'ads_optimizer',
    run_id: args.runId,
    selected_asin: args.asin,
    date_start: args.start,
    date_end: args.end,
    target_snapshot_id: args.row.targetSnapshotId,
    recommendation_snapshot_id: args.row.recommendation?.recommendationSnapshotId ?? null,
    recommendation_status: args.row.recommendation?.status ?? null,
    action_type: args.actionType,
    spend_direction: args.row.recommendation?.spendDirection ?? null,
    recommendation_reason_codes: args.recommendationReasonCodes,
    action_reason_codes: args.actionReasonCodes,
    source_execution_boundary: args.row.recommendation?.executionBoundary ?? null,
    source_workspace_handoff: args.row.recommendation?.workspaceHandoff ?? null,
  },
} satisfies JsonObject);

const buildDraftPayloadsForRow = (args: {
  row: AdsOptimizerTargetReviewRow;
  runId: string;
  asin: string;
  start: string;
  end: string;
  objective: string;
  hypothesis: string;
  sharedNotes: string;
}) => {
  const recommendation = args.row.recommendation;
  if (!recommendation) {
    return {
      payloads: [] as ChangeSetItemPayload[],
      skippedUnsupportedActionTypes: [] as string[],
    };
  }

  const reviewAfterDays = readReviewAfterDays(args.row);
  const skippedUnsupportedActionTypes: string[] = [];
  const payloads: ChangeSetItemPayload[] = [];

  for (const action of recommendation.actions) {
    if (!isWorkspaceSupportedActionType(action.actionType)) {
      skippedUnsupportedActionTypes.push(action.actionType);
      continue;
    }

    const notes =
      `${args.sharedNotes} Target ${args.row.targetText}. ` +
      `Recommendation reason codes: ${recommendation.reasonCodes.join(', ') || 'none'}. ` +
      `Action reason codes: ${action.reasonCodes.join(', ') || 'none'}.`;
    const baseFields = {
      row: args.row,
      objective: args.objective,
      hypothesis: args.hypothesis,
      notes,
      reviewAfterDays,
    };

    const payload =
      action.actionType === 'update_placement_modifier'
        ? buildPlacementItemPayload({
            ...baseFields,
            entityContext: action.entityContext,
            proposedChange: action.proposedChange,
          })
        : buildTargetItemPayload({
            ...baseFields,
            actionType: action.actionType,
            entityContext: action.entityContext,
            proposedChange: action.proposedChange,
          });

    payloads.push({
      ...payload,
      ui_context_json: buildUiContextJson({
        row: args.row,
        actionType: action.actionType,
        runId: args.runId,
        asin: args.asin,
        start: args.start,
        end: args.end,
        recommendationReasonCodes: recommendation.reasonCodes,
        actionReasonCodes: action.reasonCodes,
      }),
    });
  }

  return {
    payloads,
    skippedUnsupportedActionTypes,
  };
};

const dedupeItemPayloads = (payloads: ChangeSetItemPayload[]) => {
  const deduped = new Map<
    string,
    {
      before: string;
      after: string;
      payload: ChangeSetItemPayload;
    }
  >();
  let dedupedCount = 0;

  for (const payload of payloads) {
    const key = `${payload.action_type}::${payload.entity_level}::${payload.entity_key}`;
    const before = JSON.stringify(payload.before_json ?? {});
    const after = JSON.stringify(payload.after_json ?? {});
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, { before, after, payload });
      continue;
    }

    if (existing.before !== before || existing.after !== after) {
      throw new Error(
        `Selected optimizer recommendations conflict for ${payload.action_type} on ${payload.entity_key}. Reduce the selection or hand off one recommendation at a time.`
      );
    }

    dedupedCount += 1;
  }

  return {
    itemPayloads: [...deduped.values()].map((entry) => entry.payload),
    dedupedCount,
  };
};

export const buildAdsOptimizerWorkspaceHandoffPlan = (args: {
  asin: string;
  start: string;
  end: string;
  runId: string;
  objective: string | null;
  rows: AdsOptimizerTargetReviewRow[];
  createdAt: string;
}): AdsOptimizerWorkspaceHandoffPlan => {
  const recommendationSnapshotIds = args.rows
    .map((row) => row.recommendation?.recommendationSnapshotId ?? null)
    .filter((value): value is string => Boolean(value));
  const supportedActionPreview = args.rows.flatMap((row) =>
    (row.recommendation?.actions ?? []).filter((action) =>
      isWorkspaceSupportedActionType(action.actionType)
    )
  );
  const skippedUnsupportedActionTypes = [
    ...new Set(
      args.rows.flatMap((row) =>
        (row.recommendation?.actions ?? [])
          .filter((action) => !isWorkspaceSupportedActionType(action.actionType))
          .map((action) => action.actionType)
      )
    ),
  ];
  const skippedUnsupportedActionCount = args.rows.reduce(
    (count, row) => count + getUnsupportedReviewOnlyActions(row).length,
    0
  );
  const sharedReasoning = buildSharedReasoning({
    asin: args.asin,
    start: args.start,
    end: args.end,
    runId: args.runId,
    objective: args.objective,
    selectedRowCount: args.rows.length,
    skippedUnsupportedActionTypes,
    stagedActionCount: supportedActionPreview.length,
  });

  const rawItemPayloads = args.rows.flatMap((row) =>
    buildDraftPayloadsForRow({
      row,
      runId: args.runId,
      asin: args.asin,
      start: args.start,
      end: args.end,
      objective: sharedReasoning.objective,
      hypothesis: sharedReasoning.hypothesis,
      sharedNotes: sharedReasoning.notes,
    }).payloads
  );
  const { itemPayloads, dedupedCount } = dedupeItemPayloads(rawItemPayloads);

  if (itemPayloads.length === 0) {
    throw new Error(
      skippedUnsupportedActionTypes.length > 0
        ? `The selected recommendations only contain review-only action types: ${skippedUnsupportedActionTypes.join(', ')}. Nothing can be staged into Ads Workspace yet.`
        : 'The selected recommendations do not contain any stageable Ads Workspace actions.'
    );
  }

  const itemReviewDays = itemPayloads
    .map((payload) => payload.review_after_days)
    .filter((value): value is number => value !== null);

  return {
    changeSetPayload: {
      name: buildChangeSetName({
        asin: args.asin,
        start: args.start,
        end: args.end,
        createdAt: args.createdAt,
      }),
      status: 'draft',
      objective: sharedReasoning.objective,
      hypothesis: sharedReasoning.hypothesis,
      forecast_window_days: null,
      review_after_days: itemReviewDays.length > 0 ? Math.min(...itemReviewDays) : null,
      notes: sharedReasoning.notes,
      filters_json: {
        source: 'ads_optimizer_phase10_handoff',
        channel: 'sp',
        level: 'targets',
        asin: args.asin,
        start: args.start,
        end: args.end,
        optimizer_run_id: args.runId,
        target_snapshot_ids: args.rows.map((row) => row.targetSnapshotId),
        recommendation_snapshot_ids: recommendationSnapshotIds,
      },
      generated_run_id: null,
      generated_artifact_json: {
        source: 'ads_optimizer_phase10_handoff',
        optimizer_run_id: args.runId,
        selected_row_count: args.rows.length,
        staged_action_count: itemPayloads.length,
        deduped_action_count: dedupedCount,
        skipped_unsupported_action_types: skippedUnsupportedActionTypes,
      },
    },
    itemPayloads,
    selectedRowCount: args.rows.length,
    stagedActionCount: itemPayloads.length,
    dedupedActionCount: dedupedCount,
    skippedUnsupportedActionCount,
    skippedUnsupportedActionTypes,
    recommendationSnapshotIds,
  };
};

export const executeAdsOptimizerWorkspaceHandoff = async (
  input: ExecuteAdsOptimizerWorkspaceHandoffInput,
  deps: ExecuteAdsOptimizerWorkspaceHandoffDeps = defaultDeps
): Promise<AdsOptimizerWorkspaceHandoffResult> => {
  const args = normalizeHandoffInput(input);
  const targetsData = await deps.loadTargetsViewData({
    asin: args.asin,
    start: args.start,
    end: args.end,
  });

  if (!targetsData.run) {
    throw new Error('No completed optimizer run exists for the selected ASIN and date window.');
  }

  const selectedRows = args.targetSnapshotIds.map((targetSnapshotId) => {
    const row = targetsData.rows.find((entry) => entry.targetSnapshotId === targetSnapshotId);
    if (!row) {
      throw new Error(
        `Target snapshot ${targetSnapshotId} was not found in the exact selected optimizer run.`
      );
    }
    return row;
  });

  const plan = buildAdsOptimizerWorkspaceHandoffPlan({
    asin: args.asin,
    start: args.start,
    end: args.end,
    runId: targetsData.run.run_id,
    objective: targetsData.productState?.objective ?? null,
    rows: selectedRows,
    createdAt: deps.now(),
  });
  const changeSet = await deps.createChangeSet(plan.changeSetPayload);
  await deps.createChangeSetItems(changeSet.id, plan.itemPayloads);
  const queueCount = (await deps.listChangeSetItems(changeSet.id)).length;

  return {
    changeSetId: changeSet.id,
    changeSetName: changeSet.name,
    selectedRowCount: plan.selectedRowCount,
    stagedActionCount: plan.stagedActionCount,
    dedupedActionCount: plan.dedupedActionCount,
    skippedUnsupportedActionCount: plan.skippedUnsupportedActionCount,
    skippedUnsupportedActionTypes: plan.skippedUnsupportedActionTypes,
    queueCount,
  };
};
