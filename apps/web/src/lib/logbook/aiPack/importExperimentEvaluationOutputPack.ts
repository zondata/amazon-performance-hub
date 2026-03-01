'use server';

import 'server-only';

import { computeExperimentKpis } from '@/lib/logbook/computeExperimentKpis';
import {
  extractAdsOptimizationContractV1FromScope,
  snapshotAdsOptimizationContractV1,
} from '@/lib/logbook/contracts/adsOptimizationContractV1';
import { deriveExperimentDateWindow } from '@/lib/logbook/experimentDateWindow';
import { normalizeKivStatus } from '@/lib/logbook/kiv';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import {
  parseExperimentEvaluationOutputPack,
  type ParsedExperimentEvaluationOutputPack,
} from './parseExperimentEvaluationOutputPack';

type JsonObject = Record<string, unknown>;

type ImportInput = {
  fileText: string;
  currentAsin?: string;
  expectedExperimentId?: string;
};

export type ImportExperimentEvaluationOutputPackResult = {
  ok: boolean;
  evaluation_id?: string;
  experiment_id?: string;
  product_asin?: string;
  status_updated?: boolean;
  outcome_score?: number;
  outcome_label?: 'success' | 'mixed' | 'fail';
  test_window_start?: string;
  test_window_end?: string;
  applied?: {
    kiv: {
      created: number;
      updated: number;
      status_changed: number;
      matched_by_id: number;
      matched_by_title: number;
    };
    events: {
      created: number;
    };
    memory: {
      updated: boolean;
    };
  };
  warnings?: string[];
  error?: string;
};

type ExperimentRow = {
  experiment_id: string;
  evaluation_lag_days: number | null;
  scope: unknown | null;
};

type OpenKivRow = {
  kiv_id: string;
  title: string;
};

type KivApplySummary = {
  created: number;
  updated: number;
  status_changed: number;
  matched_by_id: number;
  matched_by_title: number;
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

const normalizeAsin = (value: unknown): string | null => {
  const text = asString(value);
  return text ? text.toUpperCase() : null;
};

const normalizeKivTitle = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const loadOpenKivByTitle = async (asinNorm: string) => {
  const { data: rows, error } = await supabaseAdmin
    .from('log_product_kiv_items')
    .select('kiv_id,title')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('asin_norm', asinNorm)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(10000);

  if (error) {
    throw new Error(`Failed loading open KIV backlog: ${error.message}`);
  }

  const byTitle = new Map<string, OpenKivRow>();
  for (const row of (rows ?? []) as OpenKivRow[]) {
    const title = String(row.title ?? '').trim();
    if (!title) continue;
    const normalized = normalizeKivTitle(title);
    if (byTitle.has(normalized)) continue;
    byTitle.set(normalized, row);
  }
  return byTitle;
};

const applyKivUpdates = async (params: {
  asinNorm: string;
  experimentId: string;
  updates: ParsedExperimentEvaluationOutputPack['evaluation']['kiv_updates'];
  warnings: string[];
}): Promise<KivApplySummary> => {
  const summary: KivApplySummary = {
    created: 0,
    updated: 0,
    status_changed: 0,
    matched_by_id: 0,
    matched_by_title: 0,
  };

  const { asinNorm, experimentId, updates, warnings } = params;
  if (updates.length === 0) return summary;

  const openByTitle = await loadOpenKivByTitle(asinNorm);

  for (const update of updates) {
    const nextStatus = normalizeKivStatus(update.status);
    const nowIso = new Date().toISOString();

    const updateExisting = async (args: {
      kivId: string;
      titleForMap?: string;
      currentStatus?: string | null;
      matchedBy: 'id' | 'title';
    }) => {
      const { kivId, titleForMap, currentStatus, matchedBy } = args;
      const patch: Record<string, unknown> = {
        status: nextStatus,
        resolved_at: nextStatus === 'open' ? null : nowIso,
      };
      if (update.resolution_notes !== undefined) {
        patch.resolution_notes = update.resolution_notes;
      }

      const { error: updateError } = await supabaseAdmin
        .from('log_product_kiv_items')
        .update(patch)
        .eq('account_id', env.accountId)
        .eq('marketplace', env.marketplace)
        .eq('asin_norm', asinNorm)
        .eq('kiv_id', kivId);

      if (updateError) {
        throw new Error(`Failed updating KIV item ${kivId}: ${updateError.message}`);
      }

      summary.updated += 1;
      if (matchedBy === 'id') {
        summary.matched_by_id += 1;
      } else {
        summary.matched_by_title += 1;
      }
      if ((currentStatus ?? '') !== nextStatus) {
        summary.status_changed += 1;
      }

      if (!titleForMap) return;
      const normalizedTitle = normalizeKivTitle(titleForMap);
      if (nextStatus === 'open') {
        openByTitle.set(normalizedTitle, { kiv_id: kivId, title: titleForMap });
      } else {
        openByTitle.delete(normalizedTitle);
      }
    };

    if (update.kiv_id) {
      const { data: existingRow, error: existingError } = await supabaseAdmin
        .from('log_product_kiv_items')
        .select('kiv_id,title,status')
        .eq('account_id', env.accountId)
        .eq('marketplace', env.marketplace)
        .eq('asin_norm', asinNorm)
        .eq('kiv_id', update.kiv_id)
        .maybeSingle();

      if (existingError) {
        throw new Error(`Failed loading KIV item ${update.kiv_id}: ${existingError.message}`);
      }

      if (!existingRow?.kiv_id) {
        warnings.push(`KIV update skipped; kiv_id not found: ${update.kiv_id}`);
        continue;
      }

      await updateExisting({
        kivId: existingRow.kiv_id as string,
        titleForMap: String(existingRow.title ?? ''),
        currentStatus: asString(existingRow.status),
        matchedBy: 'id',
      });
      continue;
    }

    const title = (update.title ?? '').trim();
    if (!title) {
      warnings.push('KIV update skipped; title is required when kiv_id is not provided.');
      continue;
    }

    const normalizedTitle = normalizeKivTitle(title);
    const matched = openByTitle.get(normalizedTitle);
    if (matched?.kiv_id) {
      await updateExisting({
        kivId: matched.kiv_id,
        titleForMap: matched.title,
        currentStatus: 'open',
        matchedBy: 'title',
      });
      continue;
    }

    const { data: insertedRow, error: insertError } = await supabaseAdmin
      .from('log_product_kiv_items')
      .insert({
        account_id: env.accountId,
        marketplace: env.marketplace,
        asin_norm: asinNorm,
        title,
        source: 'ai',
        source_experiment_id: experimentId,
        status: nextStatus,
        resolution_notes: update.resolution_notes ?? null,
        resolved_at: nextStatus === 'open' ? null : nowIso,
      })
      .select('kiv_id,title')
      .single();

    if (insertError) {
      throw new Error(`Failed creating KIV item from evaluation update: ${insertError.message}`);
    }

    summary.created += 1;
    warnings.push(`Created new KIV item from evaluation update (no open title match): ${title}`);
    if (nextStatus === 'open' && insertedRow?.kiv_id) {
      openByTitle.set(normalizedTitle, {
        kiv_id: insertedRow.kiv_id as string,
        title: String(insertedRow.title ?? title),
      });
    }
  }

  return summary;
};

const deriveDateWindowFromScopeOrChanges = async (
  experimentId: string,
  scope: JsonObject | null
): Promise<{
  startDate: string;
  endDate: string;
  source: 'scope' | 'phase_effective_dates' | 'validated_snapshot_dates' | 'linked_changes';
}> => {
  const scopeWindow = deriveExperimentDateWindow({ scope, changes: [] });
  if (scopeWindow.startDate && scopeWindow.endDate && scopeWindow.source === 'scope') {
    return {
      startDate: scopeWindow.startDate,
      endDate: scopeWindow.endDate,
      source: 'scope',
    };
  }

  const { data: linkRows, error: linkError } = await supabaseAdmin
    .from('log_experiment_changes')
    .select('change_id')
    .eq('experiment_id', experimentId);

  if (linkError) {
    throw new Error(`Failed to load experiment links for window derivation: ${linkError.message}`);
  }

  const changeIds = (linkRows ?? []).map((row) => row.change_id as string);
  if (changeIds.length === 0) {
    throw new Error('Experiment is missing scope.start_date/end_date and has no linked changes to derive a KPI window.');
  }

  const [changesResult, validationsResult] = await Promise.all([
    supabaseAdmin
      .from('log_changes')
      .select('change_id,occurred_at')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .in('change_id', changeIds)
      .order('occurred_at', { ascending: true })
      .limit(5000),
    supabaseAdmin
      .from('log_change_validations')
      .select('change_id,validated_snapshot_date,checked_at')
      .in('change_id', changeIds)
      .order('checked_at', { ascending: false })
      .limit(10000),
  ]);

  if (changesResult.error) {
    throw new Error(`Failed to load linked change dates: ${changesResult.error.message}`);
  }

  if (validationsResult.error) {
    throw new Error(`Failed to load linked change validations: ${validationsResult.error.message}`);
  }

  const validationDateByChangeId = new Map<string, string | null>();
  for (const row of validationsResult.data ?? []) {
    const changeId = String(row.change_id ?? '').trim();
    if (!changeId || validationDateByChangeId.has(changeId)) continue;
    validationDateByChangeId.set(changeId, (row.validated_snapshot_date as string | null) ?? null);
  }

  const derived = deriveExperimentDateWindow({
    scope,
    changes: (changesResult.data ?? []).map((row) => ({
      occurred_at: String(row.occurred_at ?? ''),
      validated_snapshot_date: validationDateByChangeId.get(String(row.change_id ?? '')) ?? null,
    })),
  });

  if (!derived.startDate || !derived.endDate || derived.source === 'missing') {
    throw new Error('Unable to derive KPI window from linked changes.');
  }

  return {
    startDate: derived.startDate,
    endDate: derived.endDate,
    source: derived.source,
  };
};

export const importExperimentEvaluationOutputPack = async (
  input: ImportInput
): Promise<ImportExperimentEvaluationOutputPackResult> => {
  const parsed = parseExperimentEvaluationOutputPack(input.fileText, {
    expectedAsin: input.currentAsin,
    expectedExperimentId: input.expectedExperimentId,
  });

  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
    };
  }

  try {
    const warnings: string[] = [];
    const payload = parsed.value;

    const { data: experimentData, error: experimentError } = await supabaseAdmin
      .from('log_experiments')
      .select('experiment_id,evaluation_lag_days,scope')
      .eq('experiment_id', payload.experiment_id)
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .maybeSingle();

    if (experimentError || !experimentData?.experiment_id) {
      throw new Error(`Experiment not found: ${experimentError?.message ?? 'unknown error'}`);
    }

    const experiment = experimentData as ExperimentRow;
    const scope = asObject(experiment.scope);
    const proposalContract = extractAdsOptimizationContractV1FromScope(scope, {
      defaultWorkflowMode: true,
    });
    const proposalContractSnapshot = snapshotAdsOptimizationContractV1(proposalContract);
    const scopeAsin = normalizeAsin(scope?.product_id);

    if (!scopeAsin) {
      throw new Error('Experiment scope.product_id is missing; cannot validate evaluation output ASIN.');
    }

    if (scopeAsin !== payload.product_asin) {
      throw new Error(
        `Pack ASIN (${payload.product_asin}) does not match experiment scope.product_id (${scopeAsin}).`
      );
    }

    const window = await deriveDateWindowFromScopeOrChanges(payload.experiment_id, scope);
    const kpis = await computeExperimentKpis({
      accountId: env.accountId,
      marketplace: env.marketplace,
      asin: scopeAsin,
      startDate: window.startDate,
      endDate: window.endDate,
      lagDays: experiment.evaluation_lag_days ?? 0,
    });

    const metricsJson = {
      computed_kpis: kpis,
      outcome: payload.evaluation.outcome,
      summary: payload.evaluation.summary,
      why: payload.evaluation.why,
      next_steps: payload.evaluation.next_steps,
      notes: payload.evaluation.notes,
      window_source: window.source,
      proposal_contract: {
        ads_optimization_v1: proposalContract,
      },
      proposal_contract_snapshot: proposalContractSnapshot,
    };

    const { data: evaluationData, error: evaluationError } = await supabaseAdmin
      .from('log_evaluations')
      .insert({
        experiment_id: payload.experiment_id,
        account_id: env.accountId,
        marketplace: env.marketplace,
        evaluated_at: new Date().toISOString(),
        window_start: kpis.windows.test.startDate,
        window_end: kpis.windows.test.endDate,
        metrics_json: metricsJson,
        notes: payload.evaluation.summary,
      })
      .select('evaluation_id')
      .single();

    if (evaluationError || !evaluationData?.evaluation_id) {
      throw new Error(`Failed to insert evaluation: ${evaluationError?.message ?? 'unknown error'}`);
    }

    let statusUpdated = false;
    if (payload.evaluation.mark_complete !== false) {
      const currentStatus = asString(scope?.status);
      if (currentStatus !== 'complete') {
        const nextScope: JsonObject = {
          ...(scope ?? {}),
          status: 'complete',
          outcome_summary: payload.evaluation.summary,
        };

        const { error: updateError } = await supabaseAdmin
          .from('log_experiments')
          .update({ scope: nextScope })
          .eq('experiment_id', payload.experiment_id)
          .eq('account_id', env.accountId)
          .eq('marketplace', env.marketplace);

        if (updateError) {
          throw new Error(`Failed to update experiment status: ${updateError.message}`);
        }

        statusUpdated = true;
      }
    }

    const kivSummary = await applyKivUpdates({
      asinNorm: scopeAsin,
      experimentId: payload.experiment_id,
      updates: payload.evaluation.kiv_updates,
      warnings,
    });

    return {
      ok: true,
      evaluation_id: evaluationData.evaluation_id as string,
      experiment_id: payload.experiment_id,
      product_asin: scopeAsin,
      status_updated: statusUpdated,
      outcome_score: payload.evaluation.outcome.score,
      outcome_label: payload.evaluation.outcome.label,
      test_window_start: kpis.windows.test.startDate,
      test_window_end: kpis.windows.test.endDate,
      applied: {
        kiv: kivSummary,
        events: {
          created: 0,
        },
        memory: {
          updated: statusUpdated,
        },
      },
      warnings,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown import error.',
    };
  }
};
