'use client';

import { useActionState, useEffect, useReducer, useRef } from 'react';

import {
  INITIAL_ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_INLINE_ACTION_STATE,
  type SaveAdsOptimizerRecommendationOverrideInlineAction,
} from '@/lib/ads-optimizer/recommendationOverrideInlineState';
import type { AdsOptimizerRecommendationOverride } from '@/lib/ads-optimizer/types';
import type {
  AdsOptimizerRecommendationOverrideActionType,
  AdsOptimizerRecommendationOverrideScope,
} from '@/lib/ads-optimizer/types';

export type TargetChangePlanPlacementCode =
  | 'PLACEMENT_TOP'
  | 'PLACEMENT_REST_OF_SEARCH'
  | 'PLACEMENT_PRODUCT_PAGE';

export type TargetChangePlanProposalItem = {
  key: string;
  title: string;
  tone: 'execution' | 'cadence' | 'review';
  status: 'stageable' | 'review';
  currentValue: string;
  currentValueUnknown: boolean;
  proposedValue: string;
  footnote: string | null;
};

export type TargetChangePlanOverrideActionOption = {
  value: string;
  label: string;
};

export type TargetChangePlanOverrideHiddenField = {
  name: string;
  value: string;
};

export type TargetChangePlanOverrideActionItem = {
  rowId: string;
  actionType: AdsOptimizerRecommendationOverrideActionType;
  placementCode: TargetChangePlanPlacementCode | null;
  title: string;
  currentLine: string;
  enabledFieldName: string;
  valueFieldName: string;
  hiddenFields?: TargetChangePlanOverrideHiddenField[];
  inputType: 'number' | 'select';
  initialChecked: boolean;
  initialValue: string;
  placeholder?: string;
  min?: string;
  step?: string;
  options?: TargetChangePlanOverrideActionOption[];
};

export type TargetChangePlanHiddenInputs = {
  returnTo: string;
  productId: string | null;
  asin: string;
  targetId: string;
  runId: string;
  targetSnapshotId: string;
  recommendationSnapshotId: string | null;
  campaignId: string;
  currentState: string | null;
  currentBid: number | null;
  currentCampaignBiddingStrategy: string | null;
};

type TargetChangePlanDraftActionState = {
  checked: boolean;
  value: string;
};

export type TargetChangePlanDraftState = {
  isOverrideActive: boolean;
  scope: AdsOptimizerRecommendationOverrideScope;
  operatorNote: string;
  actions: Record<string, TargetChangePlanDraftActionState>;
};

export type TargetChangePlanDraftSeed = {
  initialScope: AdsOptimizerRecommendationOverrideScope;
  initialOperatorNote: string;
  overrideRows: TargetChangePlanOverrideActionItem[];
};

export type TargetChangePlanDraftAction =
  | {
      type: 'set_override_active';
      value: boolean;
    }
  | {
      type: 'set_scope';
      value: AdsOptimizerRecommendationOverrideScope;
    }
  | {
      type: 'set_operator_note';
      value: string;
    }
  | {
      type: 'set_action_checked';
      rowId: string;
      value: boolean;
    }
  | {
      type: 'set_action_value';
      rowId: string;
      value: string;
    };

type TargetChangePlanTabProps = {
  proposalRows: TargetChangePlanProposalItem[];
  stageableCount: number;
  reviewOnlyCount: number;
  initialScope: AdsOptimizerRecommendationOverrideScope;
  initialOperatorNote: string;
  overrideRows: TargetChangePlanOverrideActionItem[];
  hiddenInputs: TargetChangePlanHiddenInputs;
  canSave: boolean;
  formUnavailableNote?: string | null;
  saveRecommendationOverrideAction: SaveAdsOptimizerRecommendationOverrideInlineAction;
  onSavedOverride: (override: AdsOptimizerRecommendationOverride) => void;
};

const createEmptyActionState = (): TargetChangePlanDraftActionState => ({
  checked: false,
  value: '',
});

export const createTargetChangePlanDraftState = (
  seed: TargetChangePlanDraftSeed
): TargetChangePlanDraftState => {
  const actions: Record<string, TargetChangePlanDraftActionState> = {};

  for (const row of seed.overrideRows) {
    actions[row.rowId] = {
      checked: row.initialChecked,
      value: row.initialValue,
    };
  }

  return {
    isOverrideActive: false,
    scope: seed.initialScope,
    operatorNote: seed.initialOperatorNote,
    actions,
  };
};

export const reduceTargetChangePlanDraftState = (
  state: TargetChangePlanDraftState,
  action: TargetChangePlanDraftAction
): TargetChangePlanDraftState => {
  if (action.type === 'set_override_active') {
    return {
      ...state,
      isOverrideActive: action.value,
    };
  }

  if (action.type === 'set_scope') {
    return {
      ...state,
      scope: action.value,
    };
  }

  if (action.type === 'set_operator_note') {
    return {
      ...state,
      operatorNote: action.value,
    };
  }

  if (action.type === 'set_action_checked') {
    return {
      ...state,
      actions: {
        ...state.actions,
        [action.rowId]: {
          ...(state.actions[action.rowId] ?? createEmptyActionState()),
          checked: action.value,
        },
      },
    };
  }

  return {
    ...state,
    actions: {
      ...state.actions,
      [action.rowId]: {
        ...(state.actions[action.rowId] ?? createEmptyActionState()),
        value: action.value,
      },
    },
  };
};

const toneDotClass = (tone: TargetChangePlanProposalItem['tone']) => {
  if (tone === 'execution') return 'bg-primary';
  return 'bg-amber-500';
};

const statusPillClass = (status: TargetChangePlanProposalItem['status']) => {
  if (status === 'stageable') return 'bg-emerald-50 text-emerald-800';
  return 'bg-surface-2 text-muted';
};

const valueInputClass = (args: { hasValue: boolean; disabled: boolean }) =>
  [
    'w-full rounded-[6px] border-[0.5px] px-2 py-[5px] text-[12px] text-foreground outline-none transition-[background-color,border-color,opacity] duration-200',
    args.hasValue ? 'has-value border-primary bg-primary/10' : 'border-border bg-surface',
    args.disabled ? 'cursor-not-allowed' : '',
  ].join(' ');

export default function TargetChangePlanTab(props: TargetChangePlanTabProps) {
  const { onSavedOverride } = props;
  const [state, formAction, isPending] = useActionState(
    props.saveRecommendationOverrideAction,
    INITIAL_ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_INLINE_ACTION_STATE
  );
  const lastHandledOverrideId = useRef<string>('');
  const [draftState, dispatch] = useReducer(
    reduceTargetChangePlanDraftState,
    {
      initialScope: props.initialScope,
      initialOperatorNote: props.initialOperatorNote,
      overrideRows: props.overrideRows,
    },
    createTargetChangePlanDraftState
  );
  const isFormEnabled = draftState.isOverrideActive && props.canSave && !isPending;

  useEffect(() => {
    if (!state.ok || !state.override) return;
    const overrideId = state.override.recommendation_override_id;
    if (lastHandledOverrideId.current === overrideId) return;
    lastHandledOverrideId.current = overrideId;
    onSavedOverride(state.override);
  }, [onSavedOverride, state.ok, state.override]);

  return (
    <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_0.5px_minmax(0,1fr)]">
      <div
        className={`min-w-0 pr-4 transition-opacity duration-200 ${
          draftState.isOverrideActive ? 'opacity-40' : 'opacity-100'
        }`}
      >
        <div className="mb-[10px] flex items-center justify-between gap-3">
          <div className="text-[11px] font-medium tracking-[0.4px] text-foreground uppercase">
            Optimizer proposal
          </div>
          <div className="rounded-full bg-primary/10 px-2 py-[2px] text-[10px] text-primary">
            Auto
          </div>
        </div>

        <div className="mb-[10px] rounded-[6px] bg-primary/10 px-2 py-[5px] text-[11px] text-primary">
          <span className="font-medium">{props.stageableCount}</span> stageable ·{' '}
          <span className="font-medium">{props.reviewOnlyCount}</span> review-only
        </div>

        {props.proposalRows.length > 0 ? (
          <div>
            {props.proposalRows.map((row, index) => (
              <div
                key={row.key}
                className={index === props.proposalRows.length - 1 ? '' : 'mb-[6px]'}
              >
                <div className="flex items-start gap-3 rounded-[8px] border-[0.5px] border-border/70 px-[10px] py-[10px]">
                  <span
                    aria-hidden="true"
                    className={`mt-[5px] h-[6px] w-[6px] flex-none rounded-full ${toneDotClass(
                      row.tone
                    )}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-foreground">{row.title}</div>
                  </div>
                  <div className="flex flex-none items-center gap-[6px]">
                    <div
                      className={`text-[12px] ${
                        row.currentValueUnknown ? 'text-muted italic' : 'text-muted'
                      }`}
                    >
                      {row.currentValue}
                    </div>
                    <div className="text-[11px] text-muted">→</div>
                    <div className="text-[12px] font-medium text-primary">{row.proposedValue}</div>
                  </div>
                  <div
                    className={`flex-none rounded-full px-[6px] py-[2px] text-[9px] ${statusPillClass(
                      row.status
                    )}`}
                  >
                    {row.status === 'stageable' ? 'Stageable' : 'Review'}
                  </div>
                </div>
                {row.footnote ? (
                  <div className="mt-1 ml-4 text-[10px] italic text-muted">{row.footnote}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[8px] border border-dashed border-border bg-surface-2 px-3 py-3 text-[12px] text-muted">
            No concrete changes were proposed for this target in the selected run.
          </div>
        )}

        {draftState.isOverrideActive ? (
          <div className="mt-[10px] rounded-[6px] bg-amber-50 px-2 py-[6px] text-[10px] text-amber-800">
            Overridden — manual override is active. This proposal remains visible for audit.
          </div>
        ) : null}
      </div>

      <div aria-hidden="true" className="w-[0.5px] self-stretch bg-border/70" />

      <div className="min-w-0 pl-4">
        <div className="mb-[10px] flex items-center justify-between gap-3">
          <div className="text-[11px] font-medium tracking-[0.4px] text-foreground uppercase">
            Manual override
          </div>
          <div className="rounded-full bg-amber-50 px-2 py-[2px] text-[10px] text-amber-800">
            {draftState.isOverrideActive ? 'Active' : 'None'}
          </div>
        </div>

        <form action={formAction}>
          <input type="hidden" name="return_to" value={props.hiddenInputs.returnTo} />
          <input type="hidden" name="product_id" value={props.hiddenInputs.productId ?? ''} />
          <input type="hidden" name="asin" value={props.hiddenInputs.asin} />
          <input type="hidden" name="target_id" value={props.hiddenInputs.targetId} />
          <input type="hidden" name="run_id" value={props.hiddenInputs.runId} />
          <input
            type="hidden"
            name="target_snapshot_id"
            value={props.hiddenInputs.targetSnapshotId}
          />
          <input
            type="hidden"
            name="recommendation_snapshot_id"
            value={props.hiddenInputs.recommendationSnapshotId ?? ''}
          />
          <input type="hidden" name="campaign_id" value={props.hiddenInputs.campaignId} />
          <input type="hidden" name="current_state" value={props.hiddenInputs.currentState ?? ''} />
          <input type="hidden" name="current_bid" value={props.hiddenInputs.currentBid ?? ''} />
          <input
            type="hidden"
            name="current_campaign_bidding_strategy"
            value={props.hiddenInputs.currentCampaignBiddingStrategy ?? ''}
          />

          <div
            className={`mb-[10px] flex items-center justify-between rounded-[8px] px-[10px] py-2 transition-[background-color,border-color] duration-200 ${
              draftState.isOverrideActive
                ? 'border-[0.5px] border-primary bg-primary/10'
                : 'bg-surface-2'
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={draftState.isOverrideActive}
                aria-label="Toggle manual override"
                disabled={!props.canSave || isPending}
                onClick={() =>
                  dispatch({
                    type: 'set_override_active',
                    value: !draftState.isOverrideActive,
                  })
                }
                className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  className={`relative block h-[18px] w-[34px] rounded-full transition-colors duration-200 ${
                    draftState.isOverrideActive ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-[2px] left-[2px] h-[14px] w-[14px] rounded-full bg-white transition-transform duration-200 ${
                      draftState.isOverrideActive ? 'translate-x-[16px]' : ''
                    }`}
                  />
                </span>
              </button>
              <div
                className={`text-[12px] ${
                  draftState.isOverrideActive ? 'text-primary' : 'text-muted'
                }`}
              >
                Override is <span className="font-medium">{draftState.isOverrideActive ? 'on' : 'off'}</span>
              </div>
            </div>
            <div className="text-[10px] text-muted">Replaces staged bundle</div>
          </div>

          <div
            className={`transition-opacity duration-200 ${
              isFormEnabled
                ? 'pointer-events-auto opacity-100'
                : 'pointer-events-none opacity-[0.35]'
            }`}
          >
            <div className="mb-[10px] grid grid-cols-[140px_minmax(0,1fr)] items-center gap-x-[10px] gap-y-[6px]">
              <label
                htmlFor={`target-change-plan-scope-${props.hiddenInputs.targetSnapshotId}`}
                className="text-[12px] text-muted"
              >
                Scope
              </label>
              <select
                id={`target-change-plan-scope-${props.hiddenInputs.targetSnapshotId}`}
                name="override_scope"
                value={draftState.scope}
                disabled={!isFormEnabled}
                onChange={(event) =>
                  dispatch({
                    type: 'set_scope',
                    value: event.target.value as AdsOptimizerRecommendationOverrideScope,
                  })
                }
                className="rounded-[4px] border-[0.5px] border-border bg-surface px-[6px] py-[3px] text-[12px] text-foreground"
              >
                <option value="one_time">One time</option>
                <option value="persistent">Persistent</option>
              </select>
            </div>

            <div className="mb-[6px] text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
              Replacement actions
            </div>

            <div>
              {props.overrideRows.map((row, index) => {
                const actionDraft = draftState.actions[row.rowId] ?? createEmptyActionState();
                const hasValue = actionDraft.value.trim().length > 0;
                const hasEnabledValue = actionDraft.checked && hasValue;
                const valueClass = valueInputClass({
                  hasValue: hasEnabledValue,
                  disabled: !isFormEnabled,
                });
                const inputId = `target-change-plan-${row.rowId}-${props.hiddenInputs.targetSnapshotId}`;
                const rowClass = hasEnabledValue ? 'border-primary' : 'border-border/70';

                return (
                  <div
                    key={row.rowId}
                    className={`flex items-start gap-2 rounded-[8px] border-[0.5px] px-[10px] py-2 ${
                      index === props.overrideRows.length - 1 ? '' : 'mb-[6px]'
                    } ${rowClass}`}
                  >
                    {row.hiddenFields?.map((field) => (
                      <input
                        key={`${row.rowId}:${field.name}`}
                        type="hidden"
                        name={field.name}
                        value={field.value}
                      />
                    ))}
                    <input
                      type="checkbox"
                      name={row.enabledFieldName}
                      value="1"
                      checked={actionDraft.checked}
                      disabled={!isFormEnabled}
                      onChange={(event) =>
                        dispatch({
                          type: 'set_action_checked',
                          rowId: row.rowId,
                          value: event.target.checked,
                        })
                      }
                      className="mt-[2px] h-[15px] w-[15px] flex-none accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-foreground">{row.title}</div>
                      <div className="text-[11px] text-muted">{row.currentLine}</div>
                      {row.inputType === 'select' ? (
                        <select
                          id={inputId}
                          name={row.valueFieldName}
                          value={actionDraft.value}
                          disabled={!isFormEnabled}
                          onChange={(event) =>
                            dispatch({
                              type: 'set_action_value',
                              rowId: row.rowId,
                              value: event.target.value,
                            })
                          }
                          className={valueClass}
                        >
                          {row.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={inputId}
                          type="number"
                          name={row.valueFieldName}
                          value={actionDraft.value}
                          disabled={!isFormEnabled}
                          min={row.min}
                          step={row.step}
                          placeholder={row.placeholder}
                          onChange={(event) =>
                            dispatch({
                              type: 'set_action_value',
                              rowId: row.rowId,
                              value: event.target.value,
                            })
                          }
                          className={valueClass}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-[14px] mb-[6px] text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
              Operator note
            </div>
            <textarea
              name="operator_note"
              required
              value={draftState.operatorNote}
              disabled={!isFormEnabled}
              onChange={(event) =>
                dispatch({
                  type: 'set_operator_note',
                  value: event.target.value,
                })
              }
              placeholder="Required. Explain why the staged bundle is being replaced."
              className="min-h-[48px] w-full resize-y rounded-[6px] border-[0.5px] border-border bg-surface px-2 py-[6px] text-[11px] text-foreground outline-none transition-colors duration-200 focus:border-primary"
            />

            {state.error ? (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-[11px] text-rose-800"
              >
                {state.error}
              </div>
            ) : null}

            {!state.error && state.ok && state.notice ? (
              <div
                aria-live="polite"
                className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-[11px] text-emerald-800"
              >
                {state.notice}
              </div>
            ) : null}
          </div>

          {props.formUnavailableNote ? (
            <div className="mt-3 rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-[11px] text-muted">
              {props.formUnavailableNote}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!isFormEnabled}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Saving…' : 'Save override bundle'}
            </button>
            <div className="text-[10px] text-muted">
              Supported override actions: bid, target state, campaign bidding strategy, and placement modifier only.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
