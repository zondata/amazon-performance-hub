import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import ExperimentSkillsOverrideManager from '@/components/logbook/ExperimentSkillsOverrideManager';
import ExperimentEvaluationOutputPackImport from '@/components/logbook/ExperimentEvaluationOutputPackImport';
import ExperimentEventsTimeline from '@/components/logbook/ExperimentEventsTimeline';
import ExperimentPhaseActions from '@/components/logbook/ExperimentPhaseActions';
import ExperimentQuickLogEventPanel from '@/components/logbook/ExperimentQuickLogEventPanel';
import InlineFilters from '@/components/InlineFilters';
import PageHeader from '@/components/PageHeader';
import Table from '@/components/Table';
import { getChanges } from '@/lib/logbook/getChanges';
import { getExperimentContext } from '@/lib/logbook/getExperimentContext';
import { linkChangesToExperiment } from '@/lib/logbook/linkChangesToExperiment';
import { getOutcomePillClassName, normalizeOutcomeScorePercent } from '@/lib/logbook/outcomePill';
import { listResolvedSkills } from '@/lib/skills/resolveSkills';

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

const parseSkillIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const skillId = asString(entry);
    if (!skillId || seen.has(skillId)) continue;
    seen.add(skillId);
    out.push(skillId);
  }

  return out;
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

const truncateText = (value?: string | null, max = 120): string => {
  if (!value) return '—';
  const normalized = value.trim();
  if (!normalized) return '—';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}…`;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

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
  let recentChanges: Awaited<ReturnType<typeof getChanges>> = [];
  let loadError: string | null = null;
  const pageWarnings: string[] = [];

  const [contextResult, recentChangesResult] = await Promise.allSettled([
    getExperimentContext(experimentId),
    getChanges({ limit: 50, useDefaultRange: false }),
  ]);

  if (contextResult.status === 'fulfilled') {
    context = contextResult.value;
  } else {
    loadError =
      contextResult.reason instanceof Error
        ? contextResult.reason.message
        : 'Unknown error';
  }

  if (recentChangesResult.status === 'fulfilled') {
    recentChanges = recentChangesResult.value;
  } else {
    const recentChangesError =
      recentChangesResult.reason instanceof Error
        ? recentChangesResult.reason.message
        : 'Unknown error';
    console.error('experiment_detail:recent_changes_load_error', {
      experimentId,
      error: recentChangesError,
    });
    pageWarnings.push(`Recent changes picker is unavailable: ${recentChangesError}`);
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

  const linkSubmit = async (formData: FormData) => {
    'use server';

    const selected = formData.getAll('change_id').map((value) => String(value));
    await linkChangesToExperiment(experimentId, selected);
    revalidatePath(`/logbook/experiments/${experimentId}`);
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
  const phaseRunIds = Array.from(new Set(context.phases.map((phase) => phase.run_id)));
  const phaseActionRunIds = Array.from(
    new Set([
      ...context.run_groups.map((group) => group.run_id),
      ...context.phases.map((phase) => phase.run_id),
    ])
  );
  const sortedPhases = [...context.phases].sort((left, right) => {
    const leftSortKey = left.uploaded_at ?? left.created_at;
    const rightSortKey = right.uploaded_at ?? right.created_at;
    const compareByUpload = rightSortKey.localeCompare(leftSortKey);
    if (compareByUpload !== 0) return compareByUpload;
    return right.created_at.localeCompare(left.created_at);
  });
  const phaseRows = sortedPhases.map((phase) => [
    <code key="run" className="text-xs text-foreground">
      {phase.run_id}
    </code>,
    <span key="title" className="text-foreground">
      {phase.title ?? '—'}
    </span>,
    <span key="effective" className="text-muted">
      {formatDateOnly(phase.effective_date)}
    </span>,
    <span key="uploaded" className="text-muted">
      {formatDateTime(phase.uploaded_at)}
    </span>,
    <span key="notes" className="text-muted" title={phase.notes ?? undefined}>
      {truncateText(phase.notes, 96)}
    </span>,
    <span key="created" className="text-muted">
      {formatDateTime(phase.created_at)}
    </span>,
  ]);
  const scope = asObject(context.scope);
  const experimentSkillIds = parseSkillIds(scope?.skills);
  const availableSkillOptions = listResolvedSkills().map((skill) => ({
    id: skill.id,
    title: skill.title,
  }));
  const proposalContract = context.contract_ads_optimization_v1;
  const baselineDataAvailableThrough = proposalContract?.baseline_ref?.data_available_through ?? null;
  const forecastWindowDays = proposalContract?.forecast?.window_days;
  const forecastDirectionalKpis = proposalContract?.forecast?.directional_kpis ?? [];
  const workflowMode = proposalContract?.ai_run_meta?.workflow_mode ?? null;
  const workflowModel = proposalContract?.ai_run_meta?.model ?? null;
  const majorActionSignals = context.major_actions.slice(0, 12);
  const interruptionSignals = context.interruptions.slice(0, 12);

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

      {pageWarnings.length > 0 ? (
        <section className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
          <div className="font-semibold">Page warning</div>
          <ul className="mt-2 list-disc pl-5 text-muted">
            {pageWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

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
          experimentId={context.experiment.experiment_id}
          uploadUrl={`/logbook/experiments/${context.experiment.experiment_id}/evaluation-import`}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold text-foreground">Output Contract V1</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Baseline cutoff</div>
            <div className="mt-2 text-sm text-foreground">
              {baselineDataAvailableThrough ? (
                baselineDataAvailableThrough
              ) : (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  Missing
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Forecast</div>
            <div className="mt-2 text-sm text-foreground">
              {typeof forecastWindowDays === 'number' ? (
                <>Window: {forecastWindowDays} day(s)</>
              ) : (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  Missing
                </span>
              )}
            </div>
            <div className="mt-2">
              {forecastDirectionalKpis.length === 0 ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  Missing KPI directions
                </span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {forecastDirectionalKpis.map((row, index) => (
                    <span
                      key={`${row.kpi}-${row.direction}-${index}`}
                      className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-foreground"
                    >
                      {row.kpi}: {row.direction}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">AI run metadata</div>
            <div className="mt-2 text-sm text-foreground">
              {workflowMode ? (
                <>workflow_mode: {workflowMode}</>
              ) : (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  Missing
                </span>
              )}
            </div>
            <div className="mt-2 text-sm text-muted">
              model:{' '}
              {workflowModel ? (
                workflowModel
              ) : (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  Missing
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <ExperimentSkillsOverrideManager
        experimentId={context.experiment.experiment_id}
        initialSkills={experimentSkillIds}
        availableSkills={availableSkillOptions}
      />

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-foreground">Phases</div>
          <div className="text-xs text-muted">{sortedPhases.length} rows</div>
        </div>
        <Table
          headers={['run_id', 'Title', 'effective_date', 'uploaded_at', 'Notes', 'created_at']}
          rows={phaseRows}
          emptyMessage="No phase rows yet."
        />
      </div>

      <ExperimentPhaseActions
        experimentId={context.experiment.experiment_id}
        runIds={phaseActionRunIds}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <ExperimentQuickLogEventPanel
          experimentId={context.experiment.experiment_id}
          runIds={phaseRunIds}
        />
        <ExperimentEventsTimeline
          events={context.events.map((event) => ({
            id: event.id,
            run_id: event.run_id,
            event_type: event.event_type,
            event_date: event.event_date,
            occurred_at: event.occurred_at,
            payload_json: event.payload_json,
          }))}
          interruptionEventIds={context.interruption_events.map((event) => event.id)}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold text-foreground">Timeline signals</div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted">
              Major actions ({majorActionSignals.length})
            </div>
            {majorActionSignals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
                No major actions yet.
              </div>
            ) : (
              <div className="space-y-2">
                {majorActionSignals.map((change) => (
                  <div key={`major-${change.change_id}`} className="rounded-lg border border-border bg-surface-2 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{formatDateTime(change.occurred_at)}</span>
                      <span className="rounded-full border border-border px-2 py-0.5 uppercase">
                        {change.channel}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5">
                        {change.change_type}
                      </span>
                      <code className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-foreground">
                        {change.run_id}
                      </code>
                    </div>
                    <div className="mt-2 text-sm text-foreground">{change.summary}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted">
              Interruptions ({interruptionSignals.length})
            </div>
            {interruptionSignals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
                No interruption-linked changes.
              </div>
            ) : (
              <div className="space-y-2">
                {interruptionSignals.map((change) => (
                  <div key={`interruption-${change.change_id}`} className="rounded-lg border border-primary/50 bg-primary/10 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{formatDateTime(change.occurred_at)}</span>
                      <span className="rounded-full border border-primary/50 px-2 py-0.5 uppercase">
                        {change.channel}
                      </span>
                      <span className="rounded-full border border-primary/50 px-2 py-0.5">
                        {change.change_type}
                      </span>
                      <code className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-foreground">
                        {change.run_id}
                      </code>
                    </div>
                    <div className="mt-2 text-sm text-foreground">{change.summary}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
                  id={`evaluation-${evaluation.evaluation_id}`}
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
