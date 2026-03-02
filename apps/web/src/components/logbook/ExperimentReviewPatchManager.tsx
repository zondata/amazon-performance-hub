'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import {
  generateExperimentFinalPlanBulksheet,
  saveExperimentReviewChangesSettings,
} from '@/app/logbook/experiments/actions';
import {
  RECOMMENDED_REVIEW_CHANGES_UI_SETTINGS,
  type ReviewChangesUiSettings,
  type ReviewColumnKey,
  type ReviewProposedChangesDisplayRow,
  type ReviewSortMode,
} from '@/lib/logbook/reviewProposedChangesDisplayModel';

type DecisionMode = 'accept' | 'reject' | 'modify';
type ChannelFilter = 'all' | 'SP' | 'SB';
type ActionFilter = 'all' | 'State' | 'Budget' | 'Strategy' | 'Placement' | 'Bid' | 'Other';
type DecisionFilter = 'all' | DecisionMode;

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

type FinalPlanBulkgenRow = {
  channel: 'SP' | 'SB';
  run_id: string;
  action_count: number;
  notes?: string | null;
};

type ReviewValidationSummary = {
  actual_row_count: number;
  actual_action_count: number;
  declared_action_count: number | null;
  declared_action_count_mismatch: boolean;
  per_plan_action_counts: Array<{
    plan_index: number;
    channel: 'SP' | 'SB';
    run_id: string;
    action_count: number;
  }>;
};

type Props = {
  experimentId: string;
  rows: ReviewProposedChangesDisplayRow[];
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
  finalPlanGenerationEnabled: boolean;
  finalPlanBulkgenRows: FinalPlanBulkgenRow[];
  reviewDisplayWarnings: string[];
  reviewValidationSummary: ReviewValidationSummary;
  initialUiSettings: ReviewChangesUiSettings;
};

type ColumnDefinition = {
  key: ReviewColumnKey;
  label: string;
  isId?: boolean;
};

const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { key: 'channel', label: 'Channel' },
  { key: 'campaign_name', label: 'Campaign Name' },
  { key: 'ad_group_name', label: 'Ad Group Name' },
  { key: 'target', label: 'Target' },
  { key: 'placement', label: 'Placement' },
  { key: 'objective', label: 'Objective' },
  { key: 'action_details', label: 'Change' },
  { key: 'field', label: 'Field' },
  { key: 'previous_value', label: 'Previous value' },
  { key: 'current_value', label: 'Current value' },
  { key: 'delta', label: 'Δ' },
  { key: 'delta_pct', label: 'Δ%' },
  { key: 'why', label: 'Why' },
  { key: 'decision', label: 'Decision' },
  { key: 'override', label: 'Override' },
  { key: 'note', label: 'Note' },
  { key: 'copy', label: 'Copy' },
  { key: 'change_id', label: 'change_id', isId: true },
  { key: 'run_id', label: 'run_id', isId: true },
  { key: 'campaign_id', label: 'campaign_id', isId: true },
  { key: 'ad_group_id', label: 'ad_group_id', isId: true },
  { key: 'target_id', label: 'target_id', isId: true },
  { key: 'placement_ids', label: 'Placement IDs' },
  { key: 'entity_ref', label: 'entity_ref' },
  { key: 'summary', label: 'summary' },
  { key: 'rank_objective_alignment', label: 'rank.objective_alignment' },
  { key: 'rank_expected_kpi_movement', label: 'rank.expected_kpi_movement' },
  { key: 'rank_risk_guardrail', label: 'rank.risk_guardrail' },
  { key: 'rank_magnitude', label: 'rank.magnitude' },
  { key: 'snapshot_date', label: 'snapshot_date' },
  { key: 'plan_notes', label: 'plan.notes' },
];

const ID_COLUMN_KEYS = new Set<ReviewColumnKey>(
  COLUMN_DEFINITIONS.filter((column) => column.isId).map((column) => column.key)
);

const allowedSortModes = new Set<ReviewSortMode>([
  'damage_risk_first',
  'objective_kpi_risk_high_first',
]);

const readErrorText = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.clone().json()) as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  } catch {}
  const text = await response.text();
  return text.trim().length > 0 ? text : `Request failed (${response.status})`;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeFilenameBase = (value: string): string => {
  const cleaned = value
    .replace(/[/\\]+/g, '-')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const bounded = cleaned.slice(0, 80).replace(/^[_\-.]+|[_\-.]+$/g, '');
  return bounded.length > 0 ? bounded : 'run';
};

const normalizeUiSettings = (settings: ReviewChangesUiSettings): ReviewChangesUiSettings => {
  const validColumns = new Set(COLUMN_DEFINITIONS.map((column) => column.key));
  const visibleColumns = settings.visibleColumns.filter((column): column is ReviewColumnKey =>
    validColumns.has(column)
  );

  return {
    showIds: settings.showIds === true,
    sortMode: allowedSortModes.has(settings.sortMode)
      ? settings.sortMode
      : RECOMMENDED_REVIEW_CHANGES_UI_SETTINGS.sortMode,
    visibleColumns:
      visibleColumns.length > 0
        ? visibleColumns
        : RECOMMENDED_REVIEW_CHANGES_UI_SETTINGS.visibleColumns,
  };
};

const toVisibilityMap = (visibleColumns: ReviewColumnKey[]): Record<ReviewColumnKey, boolean> => {
  const visible = new Set(visibleColumns);
  const state = {} as Record<ReviewColumnKey, boolean>;
  COLUMN_DEFINITIONS.forEach((column) => {
    state[column.key] = visible.has(column.key);
  });
  return state;
};

const toDecisionStateMap = (rows: ReviewProposedChangesDisplayRow[], initial: InitialDecision[]) => {
  const initialById = new Map(initial.map((row) => [row.change_id, row]));
  const state: Record<string, DecisionState> = {};
  for (const row of rows) {
    const existing = initialById.get(row.change_id);
    state[row.change_id] = {
      decision: existing?.decision ?? 'accept',
      override_new_value:
        existing?.override_new_value !== undefined
          ? String(existing.override_new_value)
          : row.proposed_numeric_value !== undefined
            ? String(row.proposed_numeric_value)
            : '',
      note: existing?.note ?? '',
    };
  }
  return state;
};

const formatValue = (value: string | number | null) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  return value;
};

const formatDelta = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
};

const formatDeltaPct = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
};

const groupPriority = (value: ActionFilter) => {
  if (value === 'State') return 0;
  if (value === 'Budget') return 1;
  if (value === 'Strategy') return 2;
  if (value === 'Placement') return 3;
  if (value === 'Bid') return 4;
  return 5;
};

function CopyInlineButton(props: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(props.value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-semibold text-muted hover:text-foreground"
    >
      {copied ? 'Copied' : props.label}
    </button>
  );
}

export default function ExperimentReviewPatchManager(props: Props) {
  const router = useRouter();
  const normalizedInitialSettings = normalizeUiSettings(props.initialUiSettings);

  const [stateById, setStateById] = useState<Record<string, DecisionState>>(
    () => toDecisionStateMap(props.rows, props.initialDecisions)
  );
  const [showIds, setShowIds] = useState(normalizedInitialSettings.showIds);
  const [sortMode, setSortMode] = useState<ReviewSortMode>(normalizedInitialSettings.sortMode);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [columnVisibility, setColumnVisibility] = useState<Record<ReviewColumnKey, boolean>>(
    () => toVisibilityMap(normalizedInitialSettings.visibleColumns)
  );
  const [showColumnChooser, setShowColumnChooser] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [settingsBusy, startSettingsTransition] = useTransition();
  const [generateBusy, startGenerateTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>(props.reviewDisplayWarnings);

  const totalActions = props.rows.length;

  const acceptedCount = useMemo(
    () =>
      props.rows.reduce(
        (count, action) => (stateById[action.change_id]?.decision === 'accept' ? count + 1 : count),
        0
      ),
    [props.rows, stateById]
  );
  const rejectedCount = useMemo(
    () =>
      props.rows.reduce(
        (count, action) => (stateById[action.change_id]?.decision === 'reject' ? count + 1 : count),
        0
      ),
    [props.rows, stateById]
  );
  const modifiedCount = useMemo(
    () =>
      props.rows.reduce(
        (count, action) => (stateById[action.change_id]?.decision === 'modify' ? count + 1 : count),
        0
      ),
    [props.rows, stateById]
  );

  const visibleColumns = useMemo(
    () =>
      COLUMN_DEFINITIONS.filter((column) => {
        if (ID_COLUMN_KEYS.has(column.key)) return showIds;
        if (!columnVisibility[column.key]) return false;
        return true;
      }),
    [columnVisibility, showIds]
  );

  const sortedFilteredRows = useMemo(() => {
    const filtered = props.rows.filter((row) => {
      if (channelFilter !== 'all' && row.channel !== channelFilter) return false;
      if (actionFilter !== 'all' && row.action_group !== actionFilter) return false;
      if (decisionFilter !== 'all') {
        const decision = stateById[row.change_id]?.decision ?? 'accept';
        if (decision !== decisionFilter) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((left, right) => {
      if (sortMode === 'damage_risk_first') {
        const leftPriority = groupPriority(left.action_group as ActionFilter);
        const rightPriority = groupPriority(right.action_group as ActionFilter);
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;

        const leftDeltaPct = Number.isFinite(left.delta_pct ?? NaN) ? Math.abs(left.delta_pct ?? 0) : null;
        const rightDeltaPct = Number.isFinite(right.delta_pct ?? NaN) ? Math.abs(right.delta_pct ?? 0) : null;
        if (leftDeltaPct !== null || rightDeltaPct !== null) {
          const leftValue = leftDeltaPct ?? -1;
          const rightValue = rightDeltaPct ?? -1;
          if (leftValue !== rightValue) return rightValue - leftValue;
        }

        const leftDelta = Number.isFinite(left.delta ?? NaN) ? Math.abs(left.delta ?? 0) : null;
        const rightDelta = Number.isFinite(right.delta ?? NaN) ? Math.abs(right.delta ?? 0) : null;
        if (leftDelta !== null || rightDelta !== null) {
          const leftValue = leftDelta ?? -1;
          const rightValue = rightDelta ?? -1;
          if (leftValue !== rightValue) return rightValue - leftValue;
        }

        const magnitudeCompare = right.review_rank.magnitude - left.review_rank.magnitude;
        if (magnitudeCompare !== 0) return magnitudeCompare;

        return left.original_index - right.original_index;
      }

      const objectiveCompare =
        left.review_rank.objective_alignment - right.review_rank.objective_alignment;
      if (objectiveCompare !== 0) return objectiveCompare;

      const kpiCompare =
        left.review_rank.expected_kpi_movement - right.review_rank.expected_kpi_movement;
      if (kpiCompare !== 0) return kpiCompare;

      const riskCompare = right.review_rank.risk_guardrail - left.review_rank.risk_guardrail;
      if (riskCompare !== 0) return riskCompare;

      const magnitudeCompare = right.review_rank.magnitude - left.review_rank.magnitude;
      if (magnitudeCompare !== 0) return magnitudeCompare;

      const channelCompare = left.channel.localeCompare(right.channel);
      if (channelCompare !== 0) return channelCompare;

      const runCompare = left.run_id.localeCompare(right.run_id);
      if (runCompare !== 0) return runCompare;

      return left.original_index - right.original_index;
    });

    return sorted;
  }, [actionFilter, channelFilter, decisionFilter, props.rows, sortMode, stateById]);
  const filteredActionCount = sortedFilteredRows.length;

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
    props.rows.map((row) => {
      const state = stateById[row.change_id] ?? {
        decision: 'accept' as DecisionMode,
        override_new_value: '',
        note: '',
      };
      const override =
        state.decision === 'modify' && state.override_new_value.trim().length > 0
          ? Number(state.override_new_value.trim())
          : null;
      return {
        change_id: row.change_id,
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
      setNotice(`Plan finalized${data.final_plan_pack_id ? ` (${data.final_plan_pack_id})` : ''}.`);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      router.refresh();
    } catch (finalizeError) {
      setError(finalizeError instanceof Error ? finalizeError.message : 'Failed to finalize plan.');
    } finally {
      setFinalizeBusy(false);
    }
  };

  const saveDefaultViewSettings = () => {
    setError(null);
    setNotice(null);
    const visibleColumns = COLUMN_DEFINITIONS.map((column) => column.key).filter(
      (key) => columnVisibility[key]
    );
    startSettingsTransition(async () => {
      const result = await saveExperimentReviewChangesSettings({
        showIds,
        sortMode,
        visibleColumns,
      });
      if (!result.ok) {
        setError(result.error ?? 'Failed to save review settings.');
        return;
      }
      setNotice('Saved review table defaults.');
    });
  };

  const resetRecommendedDefault = () => {
    const settings = RECOMMENDED_REVIEW_CHANGES_UI_SETTINGS;
    setShowIds(settings.showIds);
    setSortMode(settings.sortMode);
    setColumnVisibility(toVisibilityMap(settings.visibleColumns));
    setChannelFilter('all');
    setActionFilter('all');
    setDecisionFilter('all');
    setNotice('Reset to recommended default.');
    setError(null);
  };

  const generateFinalPlanBulksheet = (channel: 'SP' | 'SB', runId: string) => {
    setError(null);
    setNotice(null);
    setWarnings([]);
    startGenerateTransition(async () => {
      const result = await generateExperimentFinalPlanBulksheet({
        experimentId: props.experimentId,
        channel,
        runId,
      });
      if (!result.ok) {
        setError(result.error ?? 'Failed to generate bulksheet.');
        return;
      }
      setNotice(`Generated ${result.channel} bulksheet for run_id=${result.run_id} from final plan.`);
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-foreground">Review Proposed Changes</div>
          <div className="mt-1 text-xs text-muted">
            Human-readable defaults are on. Toggle diagnostics as needed.
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

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted md:grid-cols-4">
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
        <div>
          Rows: <span className="font-semibold text-foreground">{props.reviewValidationSummary.actual_row_count}</span>{' '}
          (after filters: <span className="font-semibold text-foreground">{filteredActionCount}</span>)
        </div>
      </div>

      {props.reviewValidationSummary.declared_action_count_mismatch ? (
        <div className="mt-3 rounded-xl border border-amber-400/80 bg-amber-100/80 p-3 text-xs text-amber-900">
          <div className="font-semibold">Review validation warning: declared action count mismatch</div>
          <div className="mt-1">
            Declared: {props.reviewValidationSummary.declared_action_count ?? '—'} · Actual:{' '}
            {props.reviewValidationSummary.actual_action_count}
          </div>
          <div className="mt-1">
            {props.reviewValidationSummary.per_plan_action_counts.length > 0
              ? props.reviewValidationSummary.per_plan_action_counts
                  .map(
                    (plan) =>
                      `plan[${plan.plan_index}] ${plan.channel} run_id=${plan.run_id} actions=${plan.action_count}`
                  )
                  .join(' ; ')
              : 'No proposal plans found.'}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={showIds}
              onChange={(event) => setShowIds(event.target.checked)}
            />
            Show IDs
          </label>
          <label className="text-xs text-muted">
            Sort
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as ReviewSortMode)}
              className="ml-2 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground"
            >
              <option value="damage_risk_first">Damage risk first</option>
              <option value="objective_kpi_risk_high_first">Objective/KPI order (risk high-first)</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            Channel
            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value as ChannelFilter)}
              className="ml-2 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground"
            >
              <option value="all">All</option>
              <option value="SP">SP</option>
              <option value="SB">SB</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            Action group
            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value as ActionFilter)}
              className="ml-2 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground"
            >
              <option value="all">All</option>
              <option value="State">State</option>
              <option value="Budget">Budget</option>
              <option value="Strategy">Strategy</option>
              <option value="Placement">Placement</option>
              <option value="Bid">Bid</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            Decision
            <select
              value={decisionFilter}
              onChange={(event) => setDecisionFilter(event.target.value as DecisionFilter)}
              className="ml-2 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground"
            >
              <option value="all">All</option>
              <option value="accept">Accept</option>
              <option value="reject">Reject</option>
              <option value="modify">Modify</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowColumnChooser((prev) => !prev)}
            className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-surface-2"
          >
            {showColumnChooser ? 'Hide columns' : 'Column settings'}
          </button>
          <button
            type="button"
            onClick={saveDefaultViewSettings}
            disabled={settingsBusy}
            className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-surface-2 disabled:opacity-60"
          >
            {settingsBusy ? 'Saving…' : 'Set default'}
          </button>
          <button
            type="button"
            onClick={resetRecommendedDefault}
            className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-surface-2"
          >
            Reset to recommended default
          </button>
        </div>
        {showColumnChooser ? (
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {COLUMN_DEFINITIONS.map((column) => (
              <label key={column.key} className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={column.isId ? showIds : columnVisibility[column.key]}
                  disabled={column.isId}
                  onChange={(event) =>
                    setColumnVisibility((prev) => ({
                      ...prev,
                      [column.key]: event.target.checked,
                    }))
                  }
                />
                <span>
                  {column.label}
                  {column.isId ? ' (ID, show via "Show IDs")' : ''}
                </span>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      {totalActions === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
          No proposal actions found. Import a product experiment output pack with `bulkgen_plans` first.
        </div>
      ) : (
        <div className="mt-4 max-h-[560px] overflow-y-auto rounded-xl border border-border">
          <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
            <table className="w-full min-w-[2600px] table-fixed text-left text-xs">
              <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-muted shadow-sm">
                <tr>
                  {visibleColumns.map((column) => (
                    <th key={column.key} className="px-2 py-2 align-bottom">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedFilteredRows.map((row) => {
                  const decisionState = stateById[row.change_id] ?? {
                    decision: 'accept' as DecisionMode,
                    override_new_value: '',
                    note: '',
                  };
                  const canOverride = typeof row.proposed_numeric_value === 'number';
                  const idsBundle = JSON.stringify(
                    {
                      change_id: row.change_id,
                      run_id: row.run_id,
                      campaign_id: row.campaign_id,
                      ad_group_id: row.ad_group_id,
                      target_id: row.target_id,
                      placement: {
                        placement_code: row.placement_code,
                        placement_raw: row.placement_raw,
                      },
                    },
                    null,
                    2
                  );

                  return (
                    <tr key={row.change_id}>
                      {visibleColumns.map((column) => {
                        if (column.key === 'channel') {
                          return <td key={column.key} className="px-2 py-2 text-muted">{row.channel}</td>;
                        }
                        if (column.key === 'campaign_name') {
                          return (
                            <td key={column.key} className="px-2 py-2 whitespace-normal break-words text-foreground">
                              {row.campaign_name}
                            </td>
                          );
                        }
                        if (column.key === 'ad_group_name') {
                          return (
                            <td key={column.key} className="px-2 py-2 whitespace-normal break-words text-foreground">
                              {row.ad_group_name}
                            </td>
                          );
                        }
                        if (column.key === 'target') {
                          return (
                            <td key={column.key} className="px-2 py-2 whitespace-normal break-words text-foreground">
                              {row.target_display}
                            </td>
                          );
                        }
                        if (column.key === 'placement') {
                          return (
                            <td key={column.key} className="px-2 py-2 whitespace-normal break-words text-foreground">
                              {row.placement_display}
                            </td>
                          );
                        }
                        if (column.key === 'objective') {
                          return (
                            <td key={column.key} className="px-2 py-2 whitespace-normal break-words text-foreground">
                              {row.objective}
                            </td>
                          );
                        }
                        if (column.key === 'action_details') {
                          return (
                            <td key={column.key} className="px-2 py-2 whitespace-normal break-words text-foreground">
                              {row.action_details}
                            </td>
                          );
                        }
                        if (column.key === 'field') {
                          return <td key={column.key} className="px-2 py-2 text-foreground">{row.field_label}</td>;
                        }
                        if (column.key === 'previous_value') {
                          return <td key={column.key} className="px-2 py-2 text-foreground">{formatValue(row.previous_value)}</td>;
                        }
                        if (column.key === 'current_value') {
                          return <td key={column.key} className="px-2 py-2 text-foreground">{formatValue(row.current_value)}</td>;
                        }
                        if (column.key === 'delta') {
                          return <td key={column.key} className="px-2 py-2 text-foreground">{formatDelta(row.delta)}</td>;
                        }
                        if (column.key === 'delta_pct') {
                          return <td key={column.key} className="px-2 py-2 text-foreground">{formatDeltaPct(row.delta_pct)}</td>;
                        }
                        if (column.key === 'why') {
                          return (
                            <td key={column.key} className="px-2 py-2 whitespace-normal break-words text-foreground">
                              {row.why}
                            </td>
                          );
                        }
                        if (column.key === 'decision') {
                          return (
                            <td key={column.key} className="px-2 py-2">
                              <select
                                value={decisionState.decision}
                                onChange={(event) =>
                                  updateDecision(row.change_id, {
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
                          );
                        }
                        if (column.key === 'override') {
                          return (
                            <td key={column.key} className="px-2 py-2">
                              {canOverride ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={decisionState.override_new_value}
                                  onChange={(event) =>
                                    updateDecision(row.change_id, {
                                      override_new_value: event.target.value,
                                    })
                                  }
                                  disabled={decisionState.decision !== 'modify'}
                                  className="w-full rounded border border-border bg-surface px-2 py-1 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                                />
                              ) : (
                                <span className="text-muted">n/a</span>
                              )}
                            </td>
                          );
                        }
                        if (column.key === 'note') {
                          return (
                            <td key={column.key} className="px-2 py-2">
                              <input
                                type="text"
                                value={decisionState.note}
                                onChange={(event) =>
                                  updateDecision(row.change_id, {
                                    note: event.target.value,
                                  })
                                }
                                className="w-full rounded border border-border bg-surface px-2 py-1 text-xs text-foreground"
                              />
                            </td>
                          );
                        }
                        if (column.key === 'copy') {
                          return (
                            <td key={column.key} className="px-2 py-2">
                              <div className="flex flex-wrap gap-1">
                                <CopyInlineButton label="Copy change_id" value={row.change_id} />
                                <CopyInlineButton label="Copy IDs bundle" value={idsBundle} />
                                <CopyInlineButton
                                  label="Copy raw action JSON"
                                  value={JSON.stringify(row.raw_action, null, 2)}
                                />
                              </div>
                            </td>
                          );
                        }
                        if (column.key === 'change_id') {
                          return <td key={column.key} className="px-2 py-2 text-muted"><code>{row.change_id}</code></td>;
                        }
                        if (column.key === 'run_id') {
                          return <td key={column.key} className="px-2 py-2 text-muted"><code>{row.run_id}</code></td>;
                        }
                        if (column.key === 'campaign_id') {
                          return <td key={column.key} className="px-2 py-2 text-muted"><code>{row.campaign_id ?? '—'}</code></td>;
                        }
                        if (column.key === 'ad_group_id') {
                          return <td key={column.key} className="px-2 py-2 text-muted"><code>{row.ad_group_id ?? '—'}</code></td>;
                        }
                        if (column.key === 'target_id') {
                          return <td key={column.key} className="px-2 py-2 text-muted"><code>{row.target_id ?? '—'}</code></td>;
                        }
                        if (column.key === 'placement_ids') {
                          return (
                            <td key={column.key} className="px-2 py-2 whitespace-normal break-words text-muted">
                              code: {row.placement_code ?? '—'}<br />
                              raw: {row.placement_raw ?? '—'}
                            </td>
                          );
                        }
                        if (column.key === 'entity_ref') {
                          return <td key={column.key} className="px-2 py-2 whitespace-normal break-words text-muted">{row.entity_ref}</td>;
                        }
                        if (column.key === 'summary') {
                          return <td key={column.key} className="px-2 py-2 whitespace-normal break-words text-muted">{row.summary}</td>;
                        }
                        if (column.key === 'rank_objective_alignment') {
                          return <td key={column.key} className="px-2 py-2 text-muted">{row.review_rank.objective_alignment}</td>;
                        }
                        if (column.key === 'rank_expected_kpi_movement') {
                          return <td key={column.key} className="px-2 py-2 text-muted">{row.review_rank.expected_kpi_movement}</td>;
                        }
                        if (column.key === 'rank_risk_guardrail') {
                          return <td key={column.key} className="px-2 py-2 text-muted">{row.review_rank.risk_guardrail}</td>;
                        }
                        if (column.key === 'rank_magnitude') {
                          return <td key={column.key} className="px-2 py-2 text-muted">{formatValue(row.review_rank.magnitude)}</td>;
                        }
                        if (column.key === 'snapshot_date') {
                          return <td key={column.key} className="px-2 py-2 text-muted">{row.snapshot_date ?? '—'}</td>;
                        }
                        if (column.key === 'plan_notes') {
                          return (
                            <td key={column.key} className="px-2 py-2 whitespace-normal break-words text-muted">
                              {row.plan_notes ?? '—'}
                            </td>
                          );
                        }
                        return <td key={column.key} className="px-2 py-2 text-muted">—</td>;
                      })}
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

      <section className="mt-6 rounded-xl border border-border bg-surface-2 p-4">
        <div className="mb-2 text-sm font-semibold text-foreground">Bulksheets</div>
        {!props.finalPlanGenerationEnabled ? (
          <div className="rounded-lg border border-dashed border-border bg-surface px-3 py-3 text-sm text-muted">
            Final plan is missing. Finalize the plan before generating bulksheets.
          </div>
        ) : props.finalPlanBulkgenRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface px-3 py-3 text-sm text-muted">
            Final plan has no executable bulkgen plans.
          </div>
        ) : (
          <div className="space-y-3">
            {props.finalPlanBulkgenRows.map((plan) => {
              const runBase = sanitizeFilenameBase(plan.run_id);
              const strictHref = `/api/files?path=${encodeURIComponent(
                `${plan.run_id}/upload_strict.xlsx`
              )}&filename=${encodeURIComponent(`${runBase}_strict.xlsx`)}`;
              const reviewHref = `/api/files?path=${encodeURIComponent(
                `${plan.run_id}/review.xlsx`
              )}&filename=${encodeURIComponent(`${runBase}_review.xlsx`)}`;

              return (
                <div key={`${plan.channel}-${plan.run_id}`} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-muted">
                      <span className="font-semibold text-foreground">{plan.channel}</span> ·{' '}
                      <code>{plan.run_id}</code> · {plan.action_count} action(s)
                    </div>
                    <button
                      type="button"
                      onClick={() => generateFinalPlanBulksheet(plan.channel, plan.run_id)}
                      disabled={generateBusy}
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 disabled:opacity-60"
                    >
                      {generateBusy ? 'Generating…' : 'Generate bulksheet (Final plan)'}
                    </button>
                  </div>
                  {asString(plan.notes) ? (
                    <div className="mt-1 text-xs text-muted">Notes: {plan.notes}</div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <a href={strictHref} className="rounded border border-border bg-surface-2 px-2 py-1 text-foreground hover:bg-surface">
                      Download strict
                    </a>
                    <a href={reviewHref} className="rounded border border-border bg-surface-2 px-2 py-1 text-foreground hover:bg-surface">
                      Download review
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

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
