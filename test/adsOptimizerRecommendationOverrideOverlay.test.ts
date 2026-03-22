import { describe, expect, it } from 'vitest';

import { applyAdsOptimizerRecommendationOverrideOverlay } from '../apps/web/src/lib/ads-optimizer/recommendationOverrideOverlay';
import type { AdsOptimizerTargetReviewRow } from '../apps/web/src/lib/ads-optimizer/runtime';
import type { AdsOptimizerRecommendationOverride } from '../apps/web/src/lib/ads-optimizer/types';

const makeOverride = (args: {
  id: string;
  targetSnapshotId: string;
  targetId: string;
}): AdsOptimizerRecommendationOverride => ({
  recommendation_override_id: args.id,
  account_id: 'account-1',
  marketplace: 'US',
  product_id: 'product-1',
  asin: 'B001TEST',
  target_id: args.targetId,
  run_id: 'run-1',
  target_snapshot_id: args.targetSnapshotId,
  recommendation_snapshot_id: 'recommendation-1',
  override_scope: 'persistent',
  replacement_action_bundle_json: {
    actions: [],
  },
  operator_note: 'Operator note',
  is_archived: false,
  last_applied_at: null,
  last_applied_change_set_id: null,
  apply_count: 0,
  created_at: '2026-03-22T00:00:00.000Z',
  updated_at: '2026-03-22T00:00:00.000Z',
  archived_at: null,
});

const makeRow = (args: {
  targetSnapshotId: string;
  targetId: string;
  manualOverride?: AdsOptimizerRecommendationOverride | null;
}): AdsOptimizerTargetReviewRow =>
  ({
    targetSnapshotId: args.targetSnapshotId,
    targetId: args.targetId,
    manualOverride: args.manualOverride ?? null,
  }) as AdsOptimizerTargetReviewRow;

describe('applyAdsOptimizerRecommendationOverrideOverlay', () => {
  it('replaces matching row overrides without mutating input rows and preserves non-matching identity', () => {
    const originalOverride = makeOverride({
      id: 'override-original',
      targetSnapshotId: 'target-snapshot-1',
      targetId: 'target-1',
    });
    const savedOverride = makeOverride({
      id: 'override-saved',
      targetSnapshotId: 'target-snapshot-1',
      targetId: 'target-1',
    });
    const matchingRow = makeRow({
      targetSnapshotId: 'target-snapshot-1',
      targetId: 'target-1',
      manualOverride: originalOverride,
    });
    const untouchedRow = makeRow({
      targetSnapshotId: 'target-snapshot-2',
      targetId: 'target-2',
      manualOverride: null,
    });
    const rows = [matchingRow, untouchedRow];

    const result = applyAdsOptimizerRecommendationOverrideOverlay(rows, {
      [savedOverride.target_snapshot_id]: savedOverride,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).not.toBe(matchingRow);
    expect(result[0]?.manualOverride).toBe(savedOverride);
    expect(result[1]).toBe(untouchedRow);
    expect(matchingRow.manualOverride).toBe(originalOverride);
    expect(untouchedRow.manualOverride).toBeNull();
  });
});
