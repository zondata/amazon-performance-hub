'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import {
  INITIAL_SAVE_SP_DRAFT_ACTION_STATE,
  type SaveSpDraftActionState,
} from '@/lib/ads-workspace/spChangeComposerState';
import type {
  AdsObjectivePreset,
  JsonObject,
} from '@/lib/ads-workspace/types';
import type { SpChangeComposerContext } from '@/lib/ads-workspace/spChangeComposer';

type SaveSpDraftAction = (
  prevState: SaveSpDraftActionState,
  formData: FormData
) => Promise<SaveSpDraftActionState>;

type SpComposerRow = {
  composer_context: SpChangeComposerContext;
};

type SpChangeComposerProps = {
  row: SpComposerRow;
  filtersJson: JsonObject;
  activeChangeSetId: string | null;
  activeChangeSetName: string | null;
  objectivePresets: AdsObjectivePreset[];
  action: SaveSpDraftAction;
  onClose: () => void;
  onSaved: (state: SaveSpDraftActionState) => void;
};

const formatNumberInput = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? '' : String(value);

const baseDraftName = () =>
  `SP draft ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

const surfaceLabel = (surface: SpChangeComposerContext['surface']) => {
  if (surface === 'campaigns') return 'Campaign row';
  if (surface === 'adgroups') return 'Ad group row';
  if (surface === 'placements') return 'Placement row';
  if (surface === 'searchterms') return 'Search term detail row';
  return 'Target row';
};

export default function SpChangeComposer(props: SpChangeComposerProps) {
  const { objectivePresets, onSaved } = props;
  const lastHandledSuccessKey = useRef<string>('');
  const [state, formAction, isPending] = useActionState(
    props.action,
    INITIAL_SAVE_SP_DRAFT_ACTION_STATE
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [changeSetName, setChangeSetName] = useState(props.activeChangeSetName ?? baseDraftName());
  const [objective, setObjective] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [forecastSummary, setForecastSummary] = useState('');
  const [forecastWindowDays, setForecastWindowDays] = useState('');
  const [reviewAfterDays, setReviewAfterDays] = useState('');
  const [notes, setNotes] = useState('');
  const [saveObjectivePreset, setSaveObjectivePreset] = useState(false);
  const [objectivePresetName, setObjectivePresetName] = useState('');
  const current = props.row.composer_context;
  const [targetBid, setTargetBid] = useState(formatNumberInput(current.target?.current_bid));
  const [targetState, setTargetState] = useState(current.target?.current_state ?? '');
  const [adGroupDefaultBid, setAdGroupDefaultBid] = useState(
    formatNumberInput(current.ad_group?.current_default_bid)
  );
  const [adGroupState, setAdGroupState] = useState(current.ad_group?.current_state ?? '');
  const [campaignBudget, setCampaignBudget] = useState(
    formatNumberInput(current.campaign.current_budget)
  );
  const [campaignState, setCampaignState] = useState(current.campaign.current_state ?? '');
  const [campaignBiddingStrategy, setCampaignBiddingStrategy] = useState(
    current.campaign.current_bidding_strategy ?? ''
  );
  const [placementModifierPct, setPlacementModifierPct] = useState(
    formatNumberInput(current.placement?.current_percentage)
  );

  useEffect(() => {
    if (!state.ok || !state.changeSetId) return;
    const successKey = `${state.changeSetId}:${state.queueCount}:${state.createdItemCount}`;
    if (lastHandledSuccessKey.current === successKey) return;
    lastHandledSuccessKey.current = successKey;
    onSaved(state);
  }, [
    onSaved,
    state.ok,
    state.changeSetId,
    state.queueCount,
    state.createdItemCount,
    state,
  ]);

  const presetOptions = objectivePresets.map((preset) => ({
    id: preset.id,
    label:
      preset.channel === null
        ? `${preset.name} (all channels)`
        : `${preset.name} (${preset.channel.toUpperCase()})`,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-background/70 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sp-change-composer-title"
        className="flex h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-muted">Change composer</div>
            <h2 id="sp-change-composer-title" className="mt-1 text-xl font-semibold text-foreground">
              Stage SP draft actions
            </h2>
            <div className="mt-2 text-sm text-muted">
              {surfaceLabel(current.surface)}. Placement metrics stay campaign-level facts and do not become target-owned metrics.
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm font-semibold text-foreground"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {state.error ? (
            <div className="mb-4 rounded-xl border border-rose-300/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
              {state.error}
            </div>
          ) : null}

          <form action={formAction} className="space-y-6">
            <input type="hidden" name="active_change_set_id" value={props.activeChangeSetId ?? ''} />
            <input
              type="hidden"
              name="composer_context_json"
              value={JSON.stringify(props.row.composer_context)}
            />
            <input type="hidden" name="filters_json" value={JSON.stringify(props.filtersJson)} />

            <section className="rounded-2xl border border-border bg-surface-2/50 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted">Identity chain</div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border bg-surface px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Campaign</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {current.campaign.name ?? '—'}
                  </div>
                  <div className="mt-1 text-xs text-muted">{current.campaign.id}</div>
                </div>
                {current.ad_group ? (
                  <div className="rounded-xl border border-border bg-surface px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Ad group</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {current.ad_group.name ?? '—'}
                    </div>
                    <div className="mt-1 text-xs text-muted">{current.ad_group.id}</div>
                  </div>
                ) : null}
                {current.target ? (
                  <div className="rounded-xl border border-border bg-surface px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Target</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {current.target.text}
                    </div>
                    <div className="mt-1 text-xs text-muted">{current.target.id}</div>
                  </div>
                ) : null}
                {current.placement ? (
                  <div className="rounded-xl border border-border bg-surface px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Placement</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {current.placement.label}
                    </div>
                    <div className="mt-1 text-xs text-muted">{current.placement.placement_code}</div>
                  </div>
                ) : null}
              </div>
              {current.coverage_note ? (
                <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                  {current.coverage_note}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-surface-2/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted">Reasoning</div>
                  <div className="mt-1 text-sm text-foreground">
                    Saved reasoning is copied onto each atomic draft item.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.16em]">Active draft name</span>
                  <input
                    name="change_set_name"
                    value={changeSetName}
                    onChange={(event) => setChangeSetName(event.target.value)}
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.16em]">Objective preset</span>
                  <select
                    name="objective_preset_id"
                    value={selectedPresetId}
                    onChange={(event) => {
                      const nextPresetId = event.target.value;
                      setSelectedPresetId(nextPresetId);
                      const nextPreset =
                        objectivePresets.find((preset) => preset.id === nextPresetId) ?? null;
                      if (!nextPreset) return;
                      setObjective(nextPreset.objective);
                      setHypothesis(nextPreset.hypothesis ?? '');
                      setForecastSummary(
                        typeof nextPreset.forecast_json?.summary === 'string'
                          ? nextPreset.forecast_json.summary
                          : ''
                      );
                      setForecastWindowDays(
                        typeof nextPreset.forecast_json?.window_days === 'number'
                          ? String(nextPreset.forecast_json.window_days)
                          : ''
                      );
                      setReviewAfterDays(
                        nextPreset.review_after_days === null ||
                          nextPreset.review_after_days === undefined
                          ? ''
                          : String(nextPreset.review_after_days)
                      );
                      setNotes(nextPreset.notes ?? '');
                    }}
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">No preset</option>
                    {presetOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.16em]">Objective</span>
                  <textarea
                    name="objective"
                    value={objective}
                    onChange={(event) => setObjective(event.target.value)}
                    className="min-h-[84px] rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                    required
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.16em]">Hypothesis</span>
                  <textarea
                    name="hypothesis"
                    value={hypothesis}
                    onChange={(event) => setHypothesis(event.target.value)}
                    className="min-h-[72px] rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.16em]">Forecast</span>
                  <textarea
                    name="forecast_summary"
                    value={forecastSummary}
                    onChange={(event) => setForecastSummary(event.target.value)}
                    className="min-h-[72px] rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                    placeholder="Expected directional outcome or guardrail impact"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm text-muted">
                  <span className="text-xs uppercase tracking-[0.16em]">Forecast window days</span>
                  <input
                    type="number"
                    min="0"
                    name="forecast_window_days"
                    value={forecastWindowDays}
                    onChange={(event) => setForecastWindowDays(event.target.value)}
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm text-muted">
                  <span className="text-xs uppercase tracking-[0.16em]">Review after days</span>
                  <input
                    type="number"
                    min="0"
                    name="review_after_days"
                    value={reviewAfterDays}
                    onChange={(event) => setReviewAfterDays(event.target.value)}
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.16em]">Review notes</span>
                  <textarea
                    name="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="min-h-[72px] rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>

                <div className="rounded-xl border border-border bg-surface px-4 py-4 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={saveObjectivePreset}
                      onChange={(event) => setSaveObjectivePreset(event.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    Save this reasoning as a reusable SP preset
                  </label>
                  <input
                    type="hidden"
                    name="save_objective_preset"
                    value={saveObjectivePreset ? '1' : '0'}
                  />
                  {saveObjectivePreset ? (
                    <label className="mt-3 flex flex-col gap-1 text-sm text-muted">
                      <span className="text-xs uppercase tracking-[0.16em]">Preset name</span>
                      <input
                        name="objective_preset_name"
                        value={objectivePresetName}
                        onChange={(event) => setObjectivePresetName(event.target.value)}
                        className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                        required={saveObjectivePreset}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-surface-2/50 p-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted">Editable fields</div>
                <div className="mt-1 text-sm text-foreground">
                  One save can stage multiple atomic draft actions. Unchanged values are ignored.
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                {current.target ? (
                  <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
                    <div className="md:col-span-2 text-sm font-semibold text-foreground">Target</div>
                    {!current.target.is_negative ? (
                      <label className="flex flex-col gap-1 text-sm text-muted">
                        <span className="text-xs uppercase tracking-[0.16em]">Bid</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          name="target_bid"
                          value={targetBid}
                          onChange={(event) => setTargetBid(event.target.value)}
                          className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                        />
                        <span className="text-xs text-muted">
                          Current {formatNumberInput(current.target.current_bid) || '—'}
                        </span>
                      </label>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
                        Negative targets cannot stage bid updates.
                      </div>
                    )}
                    <label className="flex flex-col gap-1 text-sm text-muted">
                      <span className="text-xs uppercase tracking-[0.16em]">State</span>
                      <select
                        name="target_state"
                        value={targetState}
                        onChange={(event) => setTargetState(event.target.value)}
                        className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                      >
                        <option value="">No change</option>
                        <option value="enabled">enabled</option>
                        <option value="paused">paused</option>
                        <option value="archived">archived</option>
                      </select>
                      <span className="text-xs text-muted">
                        Current {current.target.current_state ?? '—'}
                      </span>
                    </label>
                  </div>
                ) : null}

                {current.ad_group ? (
                  <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
                    <div className="md:col-span-2 text-sm font-semibold text-foreground">Ad group</div>
                    <label className="flex flex-col gap-1 text-sm text-muted">
                      <span className="text-xs uppercase tracking-[0.16em]">Default bid</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        name="ad_group_default_bid"
                        value={adGroupDefaultBid}
                        onChange={(event) => setAdGroupDefaultBid(event.target.value)}
                        className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                      />
                      <span className="text-xs text-muted">
                        Current {formatNumberInput(current.ad_group.current_default_bid) || '—'}
                      </span>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-muted">
                      <span className="text-xs uppercase tracking-[0.16em]">State</span>
                      <select
                        name="ad_group_state"
                        value={adGroupState}
                        onChange={(event) => setAdGroupState(event.target.value)}
                        className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                      >
                        <option value="">No change</option>
                        <option value="enabled">enabled</option>
                        <option value="paused">paused</option>
                        <option value="archived">archived</option>
                      </select>
                      <span className="text-xs text-muted">
                        Current {current.ad_group.current_state ?? '—'}
                      </span>
                    </label>
                  </div>
                ) : null}

                <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
                  <div className="md:col-span-2 text-sm font-semibold text-foreground">Campaign</div>
                  <label className="flex flex-col gap-1 text-sm text-muted">
                    <span className="text-xs uppercase tracking-[0.16em]">Daily budget</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="campaign_budget"
                      value={campaignBudget}
                      onChange={(event) => setCampaignBudget(event.target.value)}
                      className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                    />
                    <span className="text-xs text-muted">
                      Current {formatNumberInput(current.campaign.current_budget) || '—'}
                    </span>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-muted">
                    <span className="text-xs uppercase tracking-[0.16em]">State</span>
                    <select
                      name="campaign_state"
                      value={campaignState}
                      onChange={(event) => setCampaignState(event.target.value)}
                      className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">No change</option>
                      <option value="enabled">enabled</option>
                      <option value="paused">paused</option>
                      <option value="archived">archived</option>
                    </select>
                    <span className="text-xs text-muted">Current {current.campaign.current_state ?? '—'}</span>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
                    <span className="text-xs uppercase tracking-[0.16em]">Bidding strategy</span>
                    <input
                      name="campaign_bidding_strategy"
                      value={campaignBiddingStrategy}
                      onChange={(event) => setCampaignBiddingStrategy(event.target.value)}
                      className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                    />
                    <span className="text-xs text-muted">
                      Current {current.campaign.current_bidding_strategy ?? '—'}
                    </span>
                  </label>
                </div>

                {current.placement ? (
                  <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
                    <div className="md:col-span-2 text-sm font-semibold text-foreground">
                      Placement (campaign context)
                    </div>
                    <label className="flex flex-col gap-1 text-sm text-muted">
                      <span className="text-xs uppercase tracking-[0.16em]">
                        {current.placement.label} modifier %
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        name="placement_modifier_pct"
                        value={placementModifierPct}
                        onChange={(event) => setPlacementModifierPct(event.target.value)}
                        className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                      />
                      <span className="text-xs text-muted">
                        Current {formatNumberInput(current.placement.current_percentage) || '—'}
                      </span>
                    </label>
                    <div className="rounded-xl border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
                      Placement metrics remain campaign-level facts. This field stages only the placement modifier.
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-2">
              <button
                type="button"
                onClick={props.onClose}
                className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-70"
              >
                {isPending ? 'Saving…' : 'Stage draft actions'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
