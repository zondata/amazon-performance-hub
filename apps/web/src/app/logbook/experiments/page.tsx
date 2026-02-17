import Link from 'next/link';

import PageHeader from '@/components/PageHeader';
import Table from '@/components/Table';
import { getExperiments } from '@/lib/logbook/getExperiments';

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const truncate = (value: string, max = 80) =>
  value.length > max ? `${value.slice(0, max).trim()}…` : value;

export default async function ExperimentsPage() {
  const experiments = await getExperiments();

  const rows = experiments.map((experiment) => [
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
    <span key="created" className="text-slate-500">
      {formatDate(experiment.created_at)}
    </span>,
    <span key="ended" className="text-slate-400">
      —
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
          <Link
            href="/logbook/experiments/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            New experiment
          </Link>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <Table
          headers={['Status', 'Name', 'Objective', 'Started', 'Ended', 'Changes']}
          rows={rows}
          emptyMessage="No experiments created yet."
        />
      </div>
    </div>
  );
}
