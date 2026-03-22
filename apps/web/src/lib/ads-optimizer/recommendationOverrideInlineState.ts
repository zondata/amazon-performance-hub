import type { AdsOptimizerRecommendationOverride } from './types';

export type AdsOptimizerRecommendationOverrideInlineActionState = {
  ok: boolean;
  notice: string | null;
  error: string | null;
  targetSnapshotId: string | null;
  targetId: string | null;
  override: AdsOptimizerRecommendationOverride | null;
};

export const INITIAL_ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_INLINE_ACTION_STATE: AdsOptimizerRecommendationOverrideInlineActionState =
  {
    ok: false,
    notice: null,
    error: null,
    targetSnapshotId: null,
    targetId: null,
    override: null,
  };

export type SaveAdsOptimizerRecommendationOverrideInlineAction = (
  prevState: AdsOptimizerRecommendationOverrideInlineActionState,
  formData: FormData
) => Promise<AdsOptimizerRecommendationOverrideInlineActionState>;
