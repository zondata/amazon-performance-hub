import Link from 'next/link';

import InlineFilters from '@/components/InlineFilters';
import PageHeader from '@/components/PageHeader';
import Table from '@/components/Table';
import { getExperiments } from '@/lib/logbook/getExperiments';
import { getOutcomePillClassName } from '@/lib/logbook/outcomePill';

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const truncate = (value: string, max = 80) =>
  value.length > max ? `${value.slice(0, max).trim()}…` : value;

const normalizeOutcomeBand = (value: string | undefined) => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (
    normalized === 'all' ||
    normalized === 'win' ||
    normalized === 'mixed' ||
    normalized === 'loss' ||
    normalized === 'none'
  ) {
    return normalized;
  }
  return 'all';
};

const outcomeBandMatches = (
  score: number | null,
  outcomeBand: 'all' | 'win' | 'mixed' | 'loss' | 'none'
) => {
  if (outcomeBand === 'all') return true;
  if (score === null || !Number.isFinite(score)) return outcomeBand === 'none';
  if (outcomeBand === 'win') return score >= 70;
  if (outcomeBand === 'mixed') return score >= 40 && score < 70;
  if (outcomeBand === 'loss') return score < 40;
  return false;
};

type ExperimentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExperimentsPage({ searchParams }: ExperimentsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const paramValue = (key: string): string | undefined => {
    const value = params?.[key];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  };

  const experiments = await getExperiments();
  const statusOptions = Array.from(
    new Set(experiments.map((experiment) => experiment.status))
  ).sort((left, right) => left.localeCompare(right));

  const statusFilterRaw = (paramValue('status') ?? 'all').trim().toLowerCase();
  const statusFilter =
    statusFilterRaw === 'all' || statusOptions.includes(statusFilterRaw)
      ? statusFilterRaw
      : 'all';
  const outcomeBand = normalizeOutcomeBand(paramValue('outcome')) as
    | 'all'
    | 'win'
    | 'mixed'
    | 'loss'
    | 'none';
  const q = (paramValue('q') ?? '').trim().toLowerCase();

  const filtered = experiments.filter((experiment) => {
    if (statusFilter !== 'all' && experiment.status !== statusFilter) return false;
    if (!outcomeBandMatches(experiment.outcome_score, outcomeBand)) return false;
    if (!q) return true;
    const haystack = [
      experiment.name,
      experiment.objective,
      experiment.product_id ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const rows = filtered.map((experiment) => [
    <span key="status" className="rounded-full bg-slate-100 px-2 py-1 text-xs uppercase">
      {experiment.status}
    </span>,
    <Link
      key="name"
      href={`/logbook/experiments/${experiment.experiment_id}`}
      className="font-medium text-slate-900 hover:underline"
    >
      {experiment.name}
    </Link>,
    <span key="objective" className="text-slate-500" title={experiment.objective}>
      {truncate(experiment.objective)}
    </span>,
    <span key="product" className="font-mono text-xs text-slate-500">
      {experiment.product_id ?? '—'}
    </span>,
    <span key="created" className="text-slate-500">
      {formatDate(experiment.created_at)}
    </span>,
    <span key="outcome" className="text-slate-400">
      <span
        className={`rounded-full border px-2 py-1 text-xs font-semibold ${getOutcomePillClassName(
          experiment.outcome_score
        )}`}
      >
        {experiment.outcome_score === null ? '—' : `${Math.round(experiment.outcome_score)}%`}
      </span>
    </span>,
    <span key="linked" className="text-slate-500">
      {experiment.linked_changes_count}
    </span>,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Experiments"
        subtitle="Track hypotheses, evaluation windows, and linked changes."
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href="/logbook/ai-baseline-prompt-pack"
              download
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            >
              Baseline Prompt Pack
            </a>
            <a
              href="/logbook/ai-baseline-data-pack"
              download
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            >
              Baseline Data Pack
            </a>
            <Link
              href="/logbook/experiments/new"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              New experiment
            </Link>
          </div>
        }
      />

      <form className="space-y-4">
        <InlineFilters>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-slate-400">Status</label>
            <select
              name="status"
              defaultValue={statusFilter}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">all</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-slate-400">
              Outcome band
            </label>
            <select
              name="outcome"
              defaultValue={outcomeBand}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">all</option>
              <option value="win">win (&gt;=70)</option>
              <option value="mixed">mixed (40-69)</option>
              <option value="loss">loss (&lt;40)</option>
              <option value="none">none</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-slate-400">Search</label>
            <input
              type="text"
              name="q"
              defaultValue={paramValue('q') ?? ''}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="name, objective, product"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-300"
            >
              Apply
            </button>
          </div>
        </InlineFilters>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <Table
          headers={[
            'Status',
            'Name',
            'Objective',
            'Product',
            'Started',
            'Outcome',
            'Changes',
          ]}
          rows={rows}
          emptyMessage="No experiments match these filters."
        />
      </div>
    </div>
  );
}
