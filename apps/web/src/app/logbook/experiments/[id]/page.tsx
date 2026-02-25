import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import ExperimentEvaluationOutputPackImport from '@/components/logbook/ExperimentEvaluationOutputPackImport';
import ExperimentPhaseActions from '@/components/logbook/ExperimentPhaseActions';
import InlineFilters from '@/components/InlineFilters';
import PageHeader from '@/components/PageHeader';
import Table from '@/components/Table';
import { importExperimentEvaluationOutputPack } from '@/lib/logbook/aiPack/importExperimentEvaluationOutputPack';
import { getChanges } from '@/lib/logbook/getChanges';
import { getExperimentContext } from '@/lib/logbook/getExperimentContext';
import { linkChangesToExperiment } from '@/lib/logbook/linkChangesToExperiment';
import { getOutcomePillClassName, normalizeOutcomeScorePercent } from '@/lib/logbook/outcomePill';

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
};

const formatJson = (value: unknown) => (value ? JSON.stringify(value, null, 2) : '—');

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractOutcome = (metricsJson: unknown) => {
  const metrics = asObject(metricsJson);
  const outcome = asObject(metrics?.outcome);
  if (!outcome) return null;
  const scoreRaw = outcome.score;
  const scoreNum =
    typeof scoreRaw === 'number'
      ? scoreRaw
      : typeof scoreRaw === 'string'
        ? Number(scoreRaw)
        : NaN;
  const score = Number.isFinite(scoreNum) ? normalizeOutcomeScorePercent(scoreNum) : null;
  const label = asString(outcome.label);
  const confidenceRaw = outcome.confidence;
  const confidenceNum =
    typeof confidenceRaw === 'number'
      ? confidenceRaw
      : typeof confidenceRaw === 'string'
        ? Number(confidenceRaw)
        : NaN;
  const confidence = Number.isFinite(confidenceNum) ? confidenceNum : null;

  return {
    score,
    label,
    confidence,
  };
};

const formatOutcomePercent = (score: number | null): string => {
  if (score === null || !Number.isFinite(score)) return '—';
  return `${Math.round(score)}%`;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

type EvaluationImportState = {
  ok?: boolean;
  error?: string | null;
  evaluation_id?: string;
  outcome_score?: number;
  outcome_label?: string;
};

export default async function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await params;
  const experimentId = resolvedParams?.id;

  if (!experimentId || !isUuid(experimentId)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Experiment not found"
          subtitle="The experiment id is missing or invalid."
          actions={
            <Link
              href="/logbook/experiments"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            >
              Back to experiments
            </Link>
          }
        />
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted shadow-sm">
          Please check the URL or return to the experiment list.
        </div>
      </div>
    );
  }

  let context: Awaited<ReturnType<typeof getExperimentContext>> | null = null;
  let loadError: string | null = null;

  try {
    context = await getExperimentContext(experimentId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Unknown error';
  }

  if (!context) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Could not load experiment"
          subtitle="The experiment detail call failed."
          actions={
            <Link
              href="/logbook/experiments"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            >
              Back to experiments
            </Link>
          }
        />
        <pre className="whitespace-pre-wrap rounded-2xl border border-border bg-surface p-6 text-xs text-muted shadow-sm">
          {loadError}
        </pre>
      </div>
    );
  }

  const recentChanges = await getChanges({ limit: 50, useDefaultRange: false });

  const linkSubmit = async (formData: FormData) => {
    'use server';

    const selected = formData.getAll('change_id').map((value) => String(value));
    await linkChangesToExperiment(experimentId, selected);
    revalidatePath(`/logbook/experiments/${experimentId}`);
  };

  const importEvaluationPackAction = async (
    _prevState: EvaluationImportState,
    formData: FormData
  ): Promise<EvaluationImportState> => {
    'use server';

    const selectedExperimentId = String(formData.get('experiment_id') ?? '').trim();
    const file = formData.get('file');

    if (!selectedExperimentId) {
      return { ok: false, error: 'Missing experiment id.' };
    }

    if (!file || !(file instanceof File) || file.size === 0) {
      return { ok: false, error: 'JSON file is required.' };
    }

    const fileText = await file.text();
    const result = await importExperimentEvaluationOutputPack({
      fileText,
      expectedExperimentId: selectedExperimentId,
      currentAsin: context?.product_asin ?? undefined,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error ?? 'Failed to import evaluation output pack.',
      };
    }

    revalidatePath(`/logbook/experiments/${selectedExperimentId}`);
    if (context?.product_asin) {
      revalidatePath(`/products/${context.product_asin}`);
    }

    return {
      ok: true,
      evaluation_id: result.evaluation_id,
      outcome_score: result.outcome_score,
      outcome_label: result.outcome_label,
    };
  };

  const linkedRows = context.linked_changes.map((change) => [
    <span key="date" className="text-muted">
      {formatDateTime(change.occurred_at)}
    </span>,
    <span key="channel" className="uppercase text-xs text-muted">
      {change.channel}
    </span>,
    <span key="type" className="text-foreground">{change.change_type}</span>,
    <span key="summary" className="text-foreground">{change.summary}</span>,
    <span key="run" className="text-xs text-muted">
      {change.run_id}
    </span>,
    <span
      key="validation"
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${
        change.validation_status === 'validated'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : change.validation_status === 'mismatch'
            ? 'border-rose-300 bg-rose-50 text-rose-700'
            : change.validation_status === 'not_found'
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-border bg-surface-2 text-muted'
      }`}
    >
      {change.validation_status}
    </span>,
  ]);

  const latestOutcome = extractOutcome(context.latest_evaluation?.metrics_json ?? null);
  const phaseActionRunIds = Array.from(
    new Set([
      ...context.run_groups.map((group) => group.run_id),
      ...context.phases.map((phase) => phase.run_id),
    ])
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={context.experiment.name}
        subtitle={context.experiment.objective}
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href={`/logbook/experiments/${context.experiment.experiment_id}/ai-deep-dive-pack`}
              download
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            >
              Download Deep Dive Pack
            </a>
            <a
              href={`/logbook/experiments/${context.experiment.experiment_id}/ai-eval-prompt-pack`}
              download
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            >
              Download Eval Prompt Pack
            </a>
            <a
              href={`/logbook/experiments/${context.experiment.experiment_id}/ai-eval-data-pack`}
              download
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            >
              Download Eval Data Pack
            </a>
            <a
              href={`/logbook/experiments/${context.experiment.experiment_id}/rollback-pack`}
              download
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            >
              Download Rollback Pack
            </a>
            <Link
              href={`/logbook/changes/new?experiment_id=${context.experiment.experiment_id}`}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              Create change
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-muted">Status</div>
          <div className="mt-2 text-lg font-semibold text-foreground">{context.status}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-muted">Window</div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {formatDateOnly(context.date_window.startDate)} → {formatDateOnly(context.date_window.endDate)}
          </div>
          <div className="mt-1 text-xs text-muted">Source: {context.date_window.source}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-muted">Outcome</div>
          <div className="mt-2">
            <span
              className={`rounded-full border px-2 py-1 text-xs font-semibold ${getOutcomePillClassName(
                latestOutcome?.score ?? null
              )}`}
            >
              {formatOutcomePercent(latestOutcome?.score ?? null)}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted">
            {latestOutcome?.label ?? '—'}
            {latestOutcome?.confidence !== null && latestOutcome?.confidence !== undefined
              ? ` · confidence ${Math.round(latestOutcome.confidence * 100)}%`
              : ''}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-muted">Last Evaluated</div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {formatDateTime(context.latest_evaluation?.evaluated_at)}
          </div>
          <div className="mt-1 text-xs text-muted">
            {context.latest_evaluation?.window_start || context.latest_evaluation?.window_end
              ? `${context.latest_evaluation?.window_start ?? '—'} → ${context.latest_evaluation?.window_end ?? '—'}`
              : '—'}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold text-foreground">Evaluation Output Upload</div>
        <ExperimentEvaluationOutputPackImport
          action={importEvaluationPackAction}
          experimentId={context.experiment.experiment_id}
        />
      </div>

      <ExperimentPhaseActions
        experimentId={context.experiment.experiment_id}
        runIds={phaseActionRunIds}
      />

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-foreground">Evaluations</div>
        {context.evaluations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
            No evaluations yet.
          </div>
        ) : (
          <div className="space-y-3">
            {context.evaluations.slice(0, 10).map((evaluation) => {
              const outcome = extractOutcome(evaluation.metrics_json);
              const summary = asString(asObject(evaluation.metrics_json)?.summary);
              return (
                <div
                  key={evaluation.evaluation_id}
                  className="rounded-lg border border-border bg-surface-2 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-foreground">
                      {formatDateTime(evaluation.evaluated_at)}
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${getOutcomePillClassName(
                        outcome?.score ?? null
                      )}`}
                    >
                      {formatOutcomePercent(outcome?.score ?? null)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Window {evaluation.window_start ?? '—'} → {evaluation.window_end ?? '—'}
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    Summary: {summary ?? evaluation.notes ?? '—'}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Label: {outcome?.label ?? '—'}
                    {outcome?.confidence !== null && outcome?.confidence !== undefined
                      ? ` · confidence ${Math.round(outcome.confidence * 100)}%`
                      : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Hypothesis</div>
            <p className="mt-2 text-sm text-foreground">{context.experiment.hypothesis ?? '—'}</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Expected outcome</div>
            <p className="mt-2 text-sm text-foreground">{context.expected_outcome ?? '—'}</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Primary metrics</div>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted">
              {formatJson(context.experiment.primary_metrics)}
            </pre>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Guardrails</div>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted">
              {formatJson(context.experiment.guardrails)}
            </pre>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Linked changes</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {context.linked_changes.length} changes
            </div>
            <div className="mt-1 text-xs text-muted">
              validated {context.validation_summary.validated} · mismatch {context.validation_summary.mismatch}{' '}
              · pending {context.validation_summary.pending} · not_found {context.validation_summary.not_found}
            </div>
          </div>
        </div>
        <Table
          headers={['Occurred', 'Channel', 'Type', 'Summary', 'run_id', 'Validation']}
          rows={linkedRows}
          emptyMessage="No changes linked yet."
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Link existing changes</div>
            <div className="mt-1 text-lg font-semibold text-foreground">Select up to 50 recent changes</div>
          </div>
        </div>
        <form action={linkSubmit} className="space-y-4">
          <InlineFilters>
            <div className="text-xs text-muted">Checked items will be linked to this experiment.</div>
          </InlineFilters>
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border">
            <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
              <table className="w-full min-w-[960px] table-fixed text-left text-sm">
                <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="w-12"></th>
                    <th className="w-36 pb-2">Occurred</th>
                    <th className="w-20 pb-2">Channel</th>
                    <th className="w-32 pb-2">Type</th>
                    <th className="pb-2">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentChanges.map((change) => (
                    <tr key={change.change_id} className="hover:bg-surface-2">
                      <td className="py-3 text-center">
                        <input
                          type="checkbox"
                          name="change_id"
                          value={change.change_id}
                          className="h-4 w-4 rounded border-border text-foreground"
                        />
                      </td>
                      <td className="py-3 text-muted">{formatDateTime(change.occurred_at)}</td>
                      <td className="py-3 text-xs uppercase text-muted">{change.channel}</td>
                      <td className="py-3 text-foreground">{change.change_type}</td>
                      <td className="py-3 text-foreground">{change.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Link selected changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
