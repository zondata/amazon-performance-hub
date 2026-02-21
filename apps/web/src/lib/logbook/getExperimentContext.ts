import 'server-only';

import { env } from '@/lib/env';
import { extractBulkgenPlans } from '@/lib/logbook/productExperimentPlans';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type JsonObject = Record<string, unknown>;

export type ExperimentContextRow = {
  experiment_id: string;
  account_id: string;
  marketplace: string;
  name: string;
  objective: string;
  hypothesis: string | null;
  evaluation_lag_days: number | null;
  evaluation_window_days: number | null;
  primary_metrics: unknown | null;
  guardrails: unknown | null;
  scope: unknown | null;
  created_at: string;
};

export type ExperimentContextChangeEntity = {
  change_id: string;
  entity_type: string;
  product_id: string | null;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  keyword_id: string | null;
  note: string | null;
  extra: unknown | null;
};

export type ExperimentContextChange = {
  change_id: string;
  occurred_at: string;
  channel: string;
  change_type: string;
  summary: string;
  why: string | null;
  source: string;
  before_json: unknown | null;
  after_json: unknown | null;
  created_at: string;
  run_id: string;
  validation_status: ExperimentValidationStatus;
  entities: ExperimentContextChangeEntity[];
};

export type ExperimentValidationStatus = 'validated' | 'mismatch' | 'pending' | 'not_found';

export type ExperimentValidationSummary = {
  validated: number;
  mismatch: number;
  pending: number;
  not_found: number;
  total: number;
};

export type ExperimentChangeRunGroup = {
  run_id: string;
  changes: ExperimentContextChange[];
  validation_summary: ExperimentValidationSummary;
};

export type ExperimentEvaluationRow = {
  evaluation_id: string;
  experiment_id: string;
  evaluated_at: string;
  window_start: string | null;
  window_end: string | null;
  metrics_json: unknown | null;
  notes: string | null;
  created_at: string;
};

export type ExperimentDateWindow = {
  startDate: string | null;
  endDate: string | null;
  source: 'scope' | 'linked_changes' | 'missing';
};

export type ExperimentPlanSummary = {
  channel: 'SP' | 'SB';
  plan_count: number;
  action_count: number;
  highlights: string[];
};

export type ExperimentContext = {
  experiment: ExperimentContextRow;
  scope: JsonObject | null;
  status: string;
  product_asin: string | null;
  expected_outcome: string | null;
  outcome_summary: string | null;
  date_window: ExperimentDateWindow;
  linked_changes: ExperimentContextChange[];
  run_groups: ExperimentChangeRunGroup[];
  validation_summary: ExperimentValidationSummary;
  major_actions: ExperimentContextChange[];
  evaluations: ExperimentEvaluationRow[];
  latest_evaluation: ExperimentEvaluationRow | null;
  plan_summary: {
    sp: ExperimentPlanSummary;
    sb: ExperimentPlanSummary;
  };
};

type LinkRow = {
  change_id: string;
};

type ChangeRow = {
  change_id: string;
  occurred_at: string;
  channel: string;
  change_type: string;
  summary: string;
  why: string | null;
  source: string;
  before_json: unknown | null;
  after_json: unknown | null;
  created_at: string;
};

type ValidationRow = {
  change_id: string;
  status: ExperimentValidationStatus;
  checked_at: string;
};

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseDateOnly = (value: unknown): string | null => {
  const text = asString(value);
  if (!text || !DATE_RE.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return text;
};

const normalizeAsin = (value: unknown): string | null => {
  const text = asString(value);
  return text ? text.toUpperCase() : null;
};

const toDateOnlyFromIso = (value: string): string | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const compareDesc = (left: string, right: string) => right.localeCompare(left);

const emptyValidationSummary = (): ExperimentValidationSummary => ({
  validated: 0,
  mismatch: 0,
  pending: 0,
  not_found: 0,
  total: 0,
});

const addValidationStatus = (
  summary: ExperimentValidationSummary,
  status: ExperimentValidationStatus
) => {
  summary[status] += 1;
  summary.total += 1;
};

const extractRunId = (change: { after_json: unknown | null; before_json: unknown | null; source: string }) => {
  const after = asObject(change.after_json);
  const before = asObject(change.before_json);
  const runId = asString(after?.run_id) ?? asString(before?.run_id);
  if (runId) return runId;
  return change.source === 'bulkgen' ? 'bulkgen_unscoped' : 'manual';
};

const resolveValidationStatus = (
  changeId: string,
  validationByChangeId: Map<string, ValidationRow>
): ExperimentValidationStatus => {
  const status = validationByChangeId.get(changeId)?.status;
  if (status === 'validated' || status === 'mismatch' || status === 'not_found') return status;
  return 'pending';
};

const deriveDateWindow = (
  scope: JsonObject | null,
  changes: Array<{ occurred_at: string }>
): ExperimentDateWindow => {
  const scopeStart = parseDateOnly(scope?.start_date);
  const scopeEnd = parseDateOnly(scope?.end_date);
  if (scopeStart && scopeEnd) {
    return {
      startDate: scopeStart,
      endDate: scopeEnd,
      source: 'scope',
    };
  }

  if (changes.length === 0) {
    return { startDate: null, endDate: null, source: 'missing' };
  }

  const dates = changes
    .map((row) => toDateOnlyFromIso(row.occurred_at))
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b));

  if (dates.length === 0) {
    return { startDate: null, endDate: null, source: 'missing' };
  }

  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    source: 'linked_changes',
  };
};

const summarizePlans = (scope: unknown): { sp: ExperimentPlanSummary; sb: ExperimentPlanSummary } => {
  const plans = extractBulkgenPlans(scope);

  const build = (channel: 'SP' | 'SB'): ExperimentPlanSummary => {
    const selected = plans.filter((plan) => plan.channel === channel);
    const actionCounts = new Map<string, number>();
    let actionCount = 0;

    for (const plan of selected) {
      actionCount += plan.actions.length;
      for (const action of plan.actions as Array<{ type?: unknown }>) {
        const type = asString(action.type) ?? 'unknown_action';
        actionCounts.set(type, (actionCounts.get(type) ?? 0) + 1);
      }
    }

    const highlights = Array.from(actionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => `${type} (${count})`);

    return {
      channel,
      plan_count: selected.length,
      action_count: actionCount,
      highlights,
    };
  };

  return {
    sp: build('SP'),
    sb: build('SB'),
  };
};

export const getExperimentContext = async (experimentId: string): Promise<ExperimentContext> => {
  const { data: experimentData, error: experimentError } = await supabaseAdmin
    .from('log_experiments')
    .select(
      'experiment_id,account_id,marketplace,name,objective,hypothesis,evaluation_lag_days,evaluation_window_days,primary_metrics,guardrails,scope,created_at'
    )
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (experimentError || !experimentData) {
    throw new Error(`Experiment not found: ${experimentError?.message ?? 'unknown error'}`);
  }

  const experiment = experimentData as ExperimentContextRow;
  const scope = asObject(experiment.scope);

  const { data: linkRows, error: linkError } = await supabaseAdmin
    .from('log_experiment_changes')
    .select('change_id')
    .eq('experiment_id', experimentId);

  if (linkError) {
    throw new Error(`Failed to load experiment links: ${linkError.message}`);
  }

  const changeIds = (linkRows as LinkRow[] | null)?.map((row) => row.change_id) ?? [];

  const linkedChanges: ExperimentContextChange[] = [];
  const validationSummary = emptyValidationSummary();

  if (changeIds.length > 0) {
    const [changesResult, entitiesResult, validationsResult] = await Promise.all([
      supabaseAdmin
        .from('log_changes')
        .select('change_id,occurred_at,channel,change_type,summary,why,source,before_json,after_json,created_at')
        .eq('account_id', env.accountId)
        .eq('marketplace', env.marketplace)
        .in('change_id', changeIds)
        .order('occurred_at', { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from('log_change_entities')
        .select('change_id,entity_type,product_id,campaign_id,ad_group_id,target_id,keyword_id,note,extra')
        .in('change_id', changeIds)
        .order('created_at', { ascending: false })
        .limit(10000),
      supabaseAdmin
        .from('log_change_validations')
        .select('change_id,status,checked_at')
        .in('change_id', changeIds)
        .order('checked_at', { ascending: false })
        .limit(10000),
    ]);

    if (changesResult.error) {
      throw new Error(`Failed to load linked changes: ${changesResult.error.message}`);
    }

    if (entitiesResult.error) {
      throw new Error(`Failed to load linked change entities: ${entitiesResult.error.message}`);
    }

    if (validationsResult.error) {
      throw new Error(`Failed to load linked change validations: ${validationsResult.error.message}`);
    }

    const entitiesByChangeId = new Map<string, ExperimentContextChangeEntity[]>();
    ((entitiesResult.data ?? []) as ExperimentContextChangeEntity[]).forEach((row) => {
      const rows = entitiesByChangeId.get(row.change_id) ?? [];
      rows.push(row);
      entitiesByChangeId.set(row.change_id, rows);
    });

    const validationByChangeId = new Map<string, ValidationRow>();
    ((validationsResult.data ?? []) as ValidationRow[]).forEach((row) => {
      if (!validationByChangeId.has(row.change_id)) {
        validationByChangeId.set(row.change_id, row);
      }
    });

    linkedChanges.push(
      ...((changesResult.data ?? []) as ChangeRow[])
        .map((change) => {
          const status = resolveValidationStatus(change.change_id, validationByChangeId);
          addValidationStatus(validationSummary, status);

          return {
            ...change,
            run_id: extractRunId(change),
            validation_status: status,
            entities: entitiesByChangeId.get(change.change_id) ?? [],
          };
        })
        .sort((a, b) => {
          const occurredCompare = compareDesc(a.occurred_at, b.occurred_at);
          if (occurredCompare !== 0) return occurredCompare;
          return a.change_id.localeCompare(b.change_id);
        })
    );
  }

  const runGroupMap = new Map<string, ExperimentChangeRunGroup>();
  for (const change of linkedChanges) {
    const runId = change.run_id || 'manual';
    const existing =
      runGroupMap.get(runId) ?? {
        run_id: runId,
        changes: [],
        validation_summary: emptyValidationSummary(),
      };
    existing.changes.push(change);
    addValidationStatus(existing.validation_summary, change.validation_status);
    runGroupMap.set(runId, existing);
  }

  const runGroups = Array.from(runGroupMap.values()).sort((a, b) => {
    const left = a.changes[0]?.occurred_at ?? '';
    const right = b.changes[0]?.occurred_at ?? '';
    const compare = compareDesc(left, right);
    if (compare !== 0) return compare;
    return a.run_id.localeCompare(b.run_id);
  });

  const { data: evaluationsData, error: evaluationsError } = await supabaseAdmin
    .from('log_evaluations')
    .select('evaluation_id,experiment_id,evaluated_at,window_start,window_end,metrics_json,notes,created_at')
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .order('evaluated_at', { ascending: false })
    .limit(200);

  if (evaluationsError) {
    throw new Error(`Failed to load experiment evaluations: ${evaluationsError.message}`);
  }

  const evaluations = (evaluationsData ?? []) as ExperimentEvaluationRow[];
  const latestEvaluation = evaluations[0] ?? null;

  const status = asString(scope?.status) ?? 'planned';
  const productAsin = normalizeAsin(scope?.product_id);

  return {
    experiment,
    scope,
    status,
    product_asin: productAsin,
    expected_outcome: asString(scope?.expected_outcome),
    outcome_summary: asString(scope?.outcome_summary),
    date_window: deriveDateWindow(scope, linkedChanges),
    linked_changes: linkedChanges,
    run_groups: runGroups,
    validation_summary: validationSummary,
    major_actions: linkedChanges.slice(0, 12),
    evaluations,
    latest_evaluation: latestEvaluation,
    plan_summary: summarizePlans(scope),
  };
};
