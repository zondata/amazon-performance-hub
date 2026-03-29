import 'server-only';

import {
  fetchCurrentSpData,
  type FetchCurrentResult,
} from '@/lib/bulksheets/fetchCurrent';

import type { AdsOptimizerTargetProfileSnapshotView } from './targetProfile';

type ManualOverridePlacementCode =
  | 'PLACEMENT_TOP'
  | 'PLACEMENT_REST_OF_SEARCH'
  | 'PLACEMENT_PRODUCT_PAGE';

type AdsOptimizerManualOverrideCurrentSourceRow = Pick<
  AdsOptimizerTargetProfileSnapshotView,
  | 'targetSnapshotId'
  | 'targetId'
  | 'campaignId'
  | 'currentTargetBid'
  | 'currentTargetState'
  | 'currentCampaignBiddingStrategy'
  | 'placementBreakdown'
>;

export type AdsOptimizerManualOverrideCurrentContext = {
  snapshotDate: string | null;
  targetBid: number | null;
  targetState: string | null;
  campaignBiddingStrategy: string | null;
  placementModifiers: {
    PLACEMENT_TOP: number | null;
    PLACEMENT_REST_OF_SEARCH: number | null;
    PLACEMENT_PRODUCT_PAGE: number | null;
  };
};

const MANUAL_OVERRIDE_PLACEMENT_CODES: ManualOverridePlacementCode[] = [
  'PLACEMENT_TOP',
  'PLACEMENT_REST_OF_SEARCH',
  'PLACEMENT_PRODUCT_PAGE',
];

const trimStringToNull = (value: string | null | undefined) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeTargetLookupId = (value: string | null | undefined) => {
  const trimmed = trimStringToNull(value);
  if (!trimmed) return null;
  return trimmed.toLowerCase() === 'unresolved target id' ? null : trimmed;
};

const placementKey = (campaignId: string, placementCode: ManualOverridePlacementCode) =>
  `${campaignId}::${placementCode.trim().toLowerCase()}`;

const readSnapshotPlacementModifier = (
  row: AdsOptimizerManualOverrideCurrentSourceRow,
  placementCode: ManualOverridePlacementCode
) =>
  row.placementBreakdown.rows.find((entry) => entry.placementCode === placementCode)?.modifierPct ??
  null;

const buildEmptyPlacementModifiers = () => ({
  PLACEMENT_TOP: null,
  PLACEMENT_REST_OF_SEARCH: null,
  PLACEMENT_PRODUCT_PAGE: null,
});

export const buildAdsOptimizerManualOverrideCurrentContextMap = (args: {
  rows: AdsOptimizerManualOverrideCurrentSourceRow[];
  liveCurrentData?: FetchCurrentResult | null;
}): Map<string, AdsOptimizerManualOverrideCurrentContext> => {
  const currentData = args.liveCurrentData ?? null;

  return new Map(
    args.rows.map((row) => {
      const liveTargetId = normalizeTargetLookupId(row.targetId);
      const liveTarget = liveTargetId ? currentData?.targetsById.get(liveTargetId) ?? null : null;
      const liveCampaignId = trimStringToNull(row.campaignId);
      const liveCampaign = liveCampaignId
        ? currentData?.campaignsById.get(liveCampaignId) ?? null
        : null;
      const placementModifiers = buildEmptyPlacementModifiers();

      MANUAL_OVERRIDE_PLACEMENT_CODES.forEach((placementCode) => {
        const livePlacement =
          liveCampaignId && currentData
            ? currentData.placementsByKey.get(placementKey(liveCampaignId, placementCode)) ?? null
            : null;
        placementModifiers[placementCode] =
          livePlacement?.percentage ??
          readSnapshotPlacementModifier(row, placementCode) ??
          null;
      });

      return [
        row.targetSnapshotId,
        {
          snapshotDate: currentData?.snapshotDate ?? null,
          targetBid: liveTarget?.bid ?? row.currentTargetBid ?? null,
          targetState: liveTarget?.state ?? row.currentTargetState ?? null,
          campaignBiddingStrategy:
            liveCampaign?.bidding_strategy ?? row.currentCampaignBiddingStrategy ?? null,
          placementModifiers,
        },
      ] as const;
    })
  );
};

export const loadAdsOptimizerManualOverrideCurrentContextForTargets = async (
  rows: AdsOptimizerManualOverrideCurrentSourceRow[]
): Promise<Map<string, AdsOptimizerManualOverrideCurrentContext>> => {
  if (rows.length === 0) {
    return new Map();
  }

  const targetIds = [
    ...new Set(rows.map((row) => normalizeTargetLookupId(row.targetId)).filter(Boolean)),
  ] as string[];
  const campaignIds = [
    ...new Set(rows.map((row) => trimStringToNull(row.campaignId)).filter(Boolean)),
  ] as string[];

  let liveCurrentData: FetchCurrentResult | null = null;

  if (targetIds.length > 0 || campaignIds.length > 0) {
    try {
      liveCurrentData = await fetchCurrentSpData([
        ...targetIds.map((targetId) => ({
          type: 'update_target_state',
          target_id: targetId,
        })),
        ...campaignIds.map((campaignId) => ({
          type: 'update_placement_modifier',
          campaign_id: campaignId,
        })),
      ]);
    } catch {
      liveCurrentData = null;
    }
  }

  return buildAdsOptimizerManualOverrideCurrentContextMap({
    rows,
    liveCurrentData,
  });
};
