import type { AdsOptimizerTargetReviewRow } from './runtime';
import type { AdsOptimizerRecommendationOverride } from './types';

export type AdsOptimizerRecommendationOverrideOverlay = Record<
  string,
  AdsOptimizerRecommendationOverride
>;

export const applyAdsOptimizerRecommendationOverrideOverlay = (
  rows: AdsOptimizerTargetReviewRow[],
  overlay: AdsOptimizerRecommendationOverrideOverlay
) =>
  rows.map((row) => {
    const override = overlay[row.targetSnapshotId];
    if (!override) {
      return row;
    }

    return {
      ...row,
      manualOverride: override,
    };
  });
