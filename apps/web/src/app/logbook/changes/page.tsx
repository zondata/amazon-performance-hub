import Link from 'next/link';

import InlineFilters from '@/components/InlineFilters';
import PageHeader from '@/components/PageHeader';
import Table from '@/components/Table';
import { getChanges } from '@/lib/logbook/getChanges';

const formatDateTime = (value: string) => new Date(value).toLocaleString();

type ChangesPageProps = {
  searchParams?: {
    start?: string;
    end?: string;
    source?: string;
    q?: string;
    change_type?: string;
    channel?: string;
  };
};

export default async function ChangesPage({ searchParams }: ChangesPageProps) {
  const changes = await getChanges({
    start: searchParams?.start ?? null,
    end: searchParams?.end ?? null,
    source: searchParams?.source ?? 'all',
    q: searchParams?.q ?? null,
    change_type: searchParams?.change_type ?? null,
    channel: searchParams?.channel ?? null,
  });

  const rows = changes.map((change) => [
    <span key="occurred" className="text-slate-500">
      {formatDateTime(change.occurred_at)}
    </span>,
    <span key="channel" className="uppercase text-xs text-slate-400">
      {change.channel}
    </span>,
    <span key="type" className="text-slate-600">
      {change.change_type}
    </span>,
    <span key="summary" className="text-slate-900">
      {change.summary}
    </span>,
    <span key="source" className="text-xs uppercase text-slate-400">
      {change.source}
    </span>,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Changes"
        subtitle="Operational changes, experiments, and bulk edits."
        actions={
          <Link
            href="/logbook/changes/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            New change
          </Link>
        }
      />

      <form className="space-y-4">
        <InlineFilters>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-slate-400">Start</label>
            <input
              type="date"
              name="start"
              defaultValue={searchParams?.start}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-slate-400">End</label>
            <input
              type="date"
              name="end"
              defaultValue={searchParams?.end}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-slate-400">Source</label>
            <select
              name="source"
              defaultValue={searchParams?.source ?? 'all'}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">all</option>
              <option value="manual">manual</option>
              <option value="bulkgen">bulkgen</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-slate-400">Search</label>
            <input
              type="text"
              name="q"
              defaultValue={searchParams?.q}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="summary or why"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-slate-400">Change type</label>
            <input
              type="text"
              name="change_type"
              defaultValue={searchParams?.change_type}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="budget_update"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-slate-400">Channel</label>
            <input
              type="text"
              name="channel"
              defaultValue={searchParams?.channel}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="sp"
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
          headers={['Occurred', 'Channel', 'Type', 'Summary', 'Source']}
          rows={rows}
          emptyMessage="No changes logged yet."
        />
      </div>
    </div>
  );
}
