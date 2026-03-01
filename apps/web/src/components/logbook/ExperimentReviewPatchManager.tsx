'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type DecisionMode = 'accept' | 'reject' | 'modify';

type ReviewRank = {
  objective_alignment: number;
  expected_kpi_movement: number;
  risk_guardrail: number;
  magnitude: number;
};

type ReviewAction = {
  change_id: string;
  channel: 'SP' | 'SB';
  run_id: string;
  action_type: string;
  summary: string;
  entity_ref: string;
  numeric_field_key?: string;
  proposed_numeric_value?: number;
  review_rank: ReviewRank;
};

type InitialDecision = {
  change_id: string;
  decision: DecisionMode;
  override_new_value?: number;
  note?: string;
};

type SaveResponse = {
  ok: boolean;
  review_patch_pack_id?: string;
  final_plan_pack_id?: string;
  warnings?: string[];
  error?: string;
};

type FinalizeResponse = {
  ok: boolean;
  final_plan_pack_id?: string;
  warnings?: string[];
  error?: string;
};

type DecisionState = {
  decision: DecisionMode;
  override_new_value: string;
  note: string;
};

type Props = {
  experimentId: string;
  actions: ReviewAction[];
  initialDecisions: InitialDecision[];
  workflowMode: 'manual' | 'api';
  model?: string | null;
  promptTemplateId?: string | null;
  proposalPackId?: string | null;
  currentStatus: string;
  finalPlanPackId?: string | null;
  uploadUrl: string;
  downloadUrl: string;
  finalizeUrl: string;
};

const readErrorText = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.clone().json()) as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  } catch {}
  const text = await response.text();
  return text.trim().length > 0 ? text : `Request failed (${response.status})`;
};

const toDecisionStateMap = (actions: ReviewAction[], initial: InitialDecision[]) => {
  const initialById = new Map(initial.map((row) => [row.change_id, row]));
  const state: Record<string, DecisionState> = {};
  for (const action of actions) {
    const existing = initialById.get(action.change_id);
    state[action.change_id] = {
      decision: existing?.decision ?? 'accept',
      override_new_value:
        existing?.override_new_value !== undefined
          ? String(existing.override_new_value)
          : action.proposed_numeric_value !== undefined
            ? String(action.proposed_numeric_value)
            : '',
      note: existing?.note ?? '',
    };
  }
  return state;
};

export default function ExperimentReviewPatchManager(props: Props) {
  const router = useRouter();
  const [stateById, setStateById] = useState<Record<string, DecisionState>>(
    () => toDecisionStateMap(props.actions, props.initialDecisions)
  );
  const [saveBusy, setSaveBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const totalActions = props.actions.length;
  const acceptedCount = useMemo(
    () =>
      props.actions.reduce(
        (count, action) => (stateById[action.change_id]?.decision === 'accept' ? count + 1 : count),
        0
      ),
    [props.actions, stateById]
  );
  const rejectedCount = useMemo(
    () =>
      props.actions.reduce(
        (count, action) => (stateById[action.change_id]?.decision === 'reject' ? count + 1 : count),
        0
      ),
    [props.actions, stateById]
  );
  const modifiedCount = useMemo(
    () =>
      props.actions.reduce(
        (count, action) => (stateById[action.change_id]?.decision === 'modify' ? count + 1 : count),
        0
      ),
    [props.actions, stateById]
  );

  const updateDecision = (changeId: string, patch: Partial<DecisionState>) => {
    setStateById((prev) => ({
      ...prev,
      [changeId]: {
        ...(prev[changeId] ?? { decision: 'accept', override_new_value: '', note: '' }),
        ...patch,
      },
    }));
  };

  const buildDecisionsPayload = () =>
    props.actions.map((action) => {
      const state = stateById[action.change_id] ?? {
        decision: 'accept' as DecisionMode,
        override_new_value: '',
        note: '',
      };
      const override =
        state.decision === 'modify' && state.override_new_value.trim().length > 0
          ? Number(state.override_new_value.trim())
          : null;
      return {
        change_id: action.change_id,
        decision: state.decision,
        ...(override !== null && Number.isFinite(override) ? { override_new_value: override } : {}),
        ...(state.note.trim().length > 0 ? { note: state.note.trim() } : {}),
      };
    });

  const saveReviewDecisions = async () => {
    setSaveBusy(true);
    setError(null);
    setNotice(null);
    setWarnings([]);
    try {
      const response = await fetch(props.uploadUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          decisions: buildDecisionsPayload(),
          workflow_mode: props.workflowMode,
          model: props.model ?? undefined,
          prompt_template_id: props.promptTemplateId ?? undefined,
          proposal_pack_id: props.proposalPackId ?? undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }
      const data = (await response.json()) as SaveResponse;
      if (!data.ok) {
        throw new Error(data.error ?? 'Failed to save review decisions.');
      }
      setNotice(
        `Saved review patch${data.review_patch_pack_id ? ` (${data.review_patch_pack_id})` : ''}${
          data.final_plan_pack_id ? ` and updated final plan (${data.final_plan_pack_id}).` : '.'
        }`
      );
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save review decisions.');
    } finally {
      setSaveBusy(false);
    }
  };

  const handleUploadPatchPack = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploadBusy(true);
    setError(null);
    setNotice(null);
    setWarnings([]);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(props.uploadUrl, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }
      const data = (await response.json()) as SaveResponse;
      if (!data.ok) {
        throw new Error(data.error ?? 'Failed to upload review patch pack.');
      }
      setNotice(
        `Imported review patch pack${data.review_patch_pack_id ? ` (${data.review_patch_pack_id})` : ''}.`
      );
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      event.currentTarget.reset();
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload patch pack.');
    } finally {
      setUploadBusy(false);
    }
  };

  const finalizePlan = async () => {
    setFinalizeBusy(true);
    setError(null);
    setNotice(null);
    setWarnings([]);
    try {
      const response = await fetch(props.finalizeUrl, { method: 'POST' });
      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }
      const data = (await response.json()) as FinalizeResponse;
      if (!data.ok) {
        throw new Error(data.error ?? 'Failed to finalize plan.');
      }
      setNotice(
        `Plan finalized${data.final_plan_pack_id ? ` (${data.final_plan_pack_id})` : ''}.`
      );
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      router.refresh();
    } catch (finalizeError) {
      setError(finalizeError instanceof Error ? finalizeError.message : 'Failed to finalize plan.');
    } finally {
      setFinalizeBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-foreground">Review Proposed Changes</div>
          <div className="mt-1 text-xs text-muted">
            Order: objective alignment, expected KPI movement, risk/guardrails, magnitude.
          </div>
        </div>
        <a
          href={props.downloadUrl}
          download
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground hover:bg-surface-2"
        >
          Download Review Patch Pack
        </a>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted md:grid-cols-3">
        <div>
          Status: <span className="font-semibold text-foreground">{props.currentStatus}</span>
        </div>
        <div>
          Decisions: accept {acceptedCount} · reject {rejectedCount} · modify {modifiedCount}
        </div>
        <div>
          Final plan pack:{' '}
          <span className="font-semibold text-foreground">{props.finalPlanPackId ?? 'Missing'}</span>
        </div>
      </div>

      {totalActions === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
          No proposal actions found. Import a product experiment output pack with `bulkgen_plans` first.
        </div>
      ) : (
        <div className="mt-4 max-h-[520px] overflow-y-auto rounded-xl border border-border">
          <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
            <table className="w-full min-w-[1200px] table-fixed text-left text-xs">
              <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-muted shadow-sm">
                <tr>
                  <th className="w-32 pb-2">change_id</th>
                  <th className="w-20 pb-2">Channel</th>
                  <th className="w-40 pb-2">run_id</th>
                  <th className="w-44 pb-2">Action</th>
                  <th className="w-48 pb-2">Entity</th>
                  <th className="w-52 pb-2">Summary</th>
                  <th className="w-40 pb-2">Decision</th>
                  <th className="w-32 pb-2">Override</th>
                  <th className="w-40 pb-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {props.actions.map((action) => {
                  const row = stateById[action.change_id] ?? {
                    decision: 'accept' as DecisionMode,
                    override_new_value: '',
                    note: '',
                  };
                  const canOverride = typeof action.proposed_numeric_value === 'number';
                  return (
                    <tr key={action.change_id}>
                      <td className="py-2 text-muted">
                        <code>{action.change_id}</code>
                      </td>
                      <td className="py-2 text-muted">{action.channel}</td>
                      <td className="py-2 text-muted">
                        <code>{action.run_id}</code>
                      </td>
                      <td className="py-2 text-muted">{action.action_type}</td>
                      <td className="py-2 text-muted">{action.entity_ref}</td>
                      <td className="py-2 text-muted">{action.summary}</td>
                      <td className="py-2">
                        <select
                          value={row.decision}
                          onChange={(event) =>
                            updateDecision(action.change_id, {
                              decision: event.target.value as DecisionMode,
                            })
                          }
                          className="w-full rounded border border-border bg-surface px-2 py-1 text-xs text-foreground"
                        >
                          <option value="accept">Accept</option>
                          <option value="reject">Reject</option>
                          <option value="modify">Modify</option>
                        </select>
                      </td>
                      <td className="py-2">
                        {canOverride ? (
                          <input
                            type="number"
                            step="0.01"
                            value={row.override_new_value}
                            onChange={(event) =>
                              updateDecision(action.change_id, {
                                override_new_value: event.target.value,
                              })
                            }
                            disabled={row.decision !== 'modify'}
                            className="w-full rounded border border-border bg-surface px-2 py-1 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        ) : (
                          <span className="text-muted">n/a</span>
                        )}
                      </td>
                      <td className="py-2">
                        <input
                          type="text"
                          value={row.note}
                          onChange={(event) =>
                            updateDecision(action.change_id, {
                              note: event.target.value,
                            })
                          }
                          className="w-full rounded border border-border bg-surface px-2 py-1 text-xs text-foreground"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={saveReviewDecisions}
          disabled={saveBusy || uploadBusy || finalizeBusy || totalActions === 0}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveBusy ? 'Saving…' : 'Save Review Decisions'}
        </button>
        <button
          type="button"
          onClick={finalizePlan}
          disabled={saveBusy || uploadBusy || finalizeBusy || totalActions === 0}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {finalizeBusy ? 'Finalizing…' : 'Finalize Plan'}
        </button>
      </div>

      <form onSubmit={handleUploadPatchPack} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex min-w-[260px] flex-1 flex-col text-[11px] uppercase tracking-wide text-muted">
          Upload Review Patch Pack (JSON)
          <input
            type="file"
            name="file"
            accept=".json,application/json"
            required
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={saveBusy || uploadBusy || finalizeBusy}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploadBusy ? 'Uploading…' : 'Upload Review Patch Pack'}
        </button>
      </form>

      <div className="mt-3 min-h-5 text-xs">
        {notice ? <div className="text-foreground">{notice}</div> : null}
        {error ? <div className="text-rose-700">{error}</div> : null}
      </div>
      {warnings.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700">
          {warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
