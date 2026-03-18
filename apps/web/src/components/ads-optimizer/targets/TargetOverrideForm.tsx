'use client';

import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';
import type { AdsOptimizerRecommendationSnapshotView } from '@/lib/ads-optimizer/recommendation';

type ActionEditorSource = {
  source: 'override' | 'recommendation' | 'none';
};

type TargetOverrideFormProps = {
  row: AdsOptimizerTargetReviewRow;
  recommendation: AdsOptimizerRecommendationSnapshotView;
  productId: string | null;
  returnTo: string;
  saveRecommendationOverrideAction: (formData: FormData) => Promise<void>;
  bidActionEditor: ActionEditorSource;
  stateActionEditor: ActionEditorSource;
  placementActionEditor: ActionEditorSource;
  currentBid: number | null;
  nextBid: number | null;
  currentState: string | null;
  nextState: string | null;
  currentPlacementCode: string;
  currentPlacementPercentage: number | null;
  nextPlacementPercentage: number | null;
  formatCurrency: (value: number | null) => string;
  formatWholePercent: (value: number | null) => string;
  formatPlacementLabel: (value: string | null) => string;
  sentenceCase: (value: string | null) => string;
};

export default function TargetOverrideForm(props: TargetOverrideFormProps) {
  if (!props.productId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
        Product scope or recommendation context is missing, so this target cannot accept a saved
        override yet.
      </div>
    );
  }

  return (
    <form
      key={`${props.row.targetSnapshotId}:${props.recommendation.recommendationSnapshotId}:override-form`}
      action={props.saveRecommendationOverrideAction}
      className="space-y-4"
    >
      <input type="hidden" name="return_to" value={props.returnTo} />
      <input type="hidden" name="product_id" value={props.productId} />
      <input type="hidden" name="asin" value={props.row.asin} />
      <input type="hidden" name="target_id" value={props.row.targetId} />
      <input type="hidden" name="run_id" value={props.row.runId} />
      <input type="hidden" name="target_snapshot_id" value={props.row.targetSnapshotId} />
      <input
        type="hidden"
        name="recommendation_snapshot_id"
        value={props.recommendation.recommendationSnapshotId}
      />
      <input type="hidden" name="campaign_id" value={props.row.campaignId} />
      <input type="hidden" name="current_state" value={props.currentState ?? ''} />
      <input type="hidden" name="current_bid" value={props.currentBid ?? ''} />
      <input type="hidden" name="current_placement_code" value={props.currentPlacementCode} />
      <input
        type="hidden"
        name="current_placement_percentage"
        value={props.currentPlacementPercentage ?? ''}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
          Override scope
          <select
            name="override_scope"
            defaultValue={props.row.manualOverride?.override_scope ?? 'one_time'}
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            <option value="one_time">One time</option>
            <option value="persistent">Persistent</option>
          </select>
        </label>
        <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
          Operator note
          <textarea
            name="operator_note"
            required
            rows={3}
            defaultValue={props.row.manualOverride?.operator_note ?? ''}
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            placeholder="Required. Explain why the staged bundle is being replaced."
          />
        </label>
      </div>

      <div className="space-y-3">
        <div className="text-xs uppercase tracking-wide text-muted">Replacement action bundle</div>

        <label className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 px-4 py-4 text-sm text-foreground">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              name="override_bid_enabled"
              value="1"
              defaultChecked={props.bidActionEditor.source !== 'none'}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <div className="font-semibold">Update target bid</div>
              <div className="mt-1 text-xs text-muted">
                Current: {props.formatCurrency(props.currentBid)}
              </div>
            </div>
          </div>
          <input
            type="number"
            name="override_bid_next_bid"
            min="0.01"
            step="0.01"
            defaultValue={props.nextBid ?? ''}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            placeholder="Next bid"
          />
        </label>

        <label className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 px-4 py-4 text-sm text-foreground">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              name="override_state_enabled"
              value="1"
              defaultChecked={props.stateActionEditor.source !== 'none'}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <div className="font-semibold">Update target state</div>
              <div className="mt-1 text-xs text-muted">
                Current: {props.sentenceCase(props.currentState)}
              </div>
            </div>
          </div>
          <select
            name="override_state_next_state"
            defaultValue={props.nextState ?? 'paused'}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            <option value="enabled">Enabled</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        <label className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 px-4 py-4 text-sm text-foreground">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              name="override_placement_enabled"
              value="1"
              defaultChecked={props.placementActionEditor.source !== 'none'}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <div className="font-semibold">Update placement modifier</div>
              <div className="mt-1 text-xs text-muted">
                {props.formatPlacementLabel(props.currentPlacementCode)} · current{' '}
                {props.formatWholePercent(props.currentPlacementPercentage)}
              </div>
            </div>
          </div>
          <input
            type="number"
            name="override_placement_next_percentage"
            min="0"
            step="1"
            defaultValue={props.nextPlacementPercentage ?? ''}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            placeholder="Next placement percentage"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Save override bundle
        </button>
        <div className="text-xs text-muted">
          Supported override actions: bid, target state, and placement modifier only.
        </div>
      </div>
    </form>
  );
}
