import Link from 'next/link';

import InlineFilters from '@/components/InlineFilters';
import PageHeader from '@/components/PageHeader';
import Table from '@/components/Table';
import { getExperimentDetail } from '@/lib/logbook/getExperimentDetail';
import { getChanges } from '@/lib/logbook/getChanges';
import { linkChangesToExperiment } from '@/lib/logbook/linkChangesToExperiment';

const formatDateTime = (value: string) => new Date(value).toLocaleString();

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const formatJson = (value: unknown) =>
  value ? JSON.stringify(value, null, 2) : '—';

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
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-300"
            >
              Back to experiments
            </Link>
          }
        />
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-500 shadow-sm">
          Please check the URL or return to the experiment list.
        </div>
      </div>
    );
  }

  let experimentData: Awaited<ReturnType<typeof getExperimentDetail>> | null = null;
  let loadError: string | null = null;

  try {
    experimentData = await getExperimentDetail(experimentId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Unknown error';
  }

  if (!experimentData) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Could not load experiment"
          subtitle="The experiment detail call failed."
          actions={
            <Link
              href="/logbook/experiments"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-300"
            >
              Back to experiments
            </Link>
          }
        />
        <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white/80 p-6 text-xs text-slate-600 shadow-sm">
          {loadError}
        </pre>
      </div>
    );
  }

  const { experiment, linkedChanges } = experimentData;
  const recentChanges = await getChanges({ limit: 50, useDefaultRange: false });

  const linkSubmit = async (formData: FormData) => {
    'use server';

    const selected = formData.getAll('change_id').map((value) => String(value));
    await linkChangesToExperiment(experimentId, selected);
  };

  const linkedRows = linkedChanges.map((change) => [
    <span key="date" className="text-slate-500">
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
    <div key="entities" className="text-xs text-slate-500">
      {change.entity_hints.product_ids.length > 0 && (
        <div>Products: {change.entity_hints.product_ids.join(', ')}</div>
      )}
      {change.entity_hints.campaign_ids.length > 0 && (
        <div>Campaigns: {change.entity_hints.campaign_ids.join(', ')}</div>
      )}
      {change.entity_hints.target_ids.length > 0 && (
        <div>Targets: {change.entity_hints.target_ids.join(', ')}</div>
      )}
    </div>,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={experiment.name}
        subtitle={experiment.objective}
        actions={
          <Link
            href={`/logbook/changes/new?experiment_id=${experiment.experiment_id}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-300"
          >
            Create change
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-400">Status</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {experiment.status}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-400">Lag / Window</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {experiment.evaluation_lag_days ?? 0} days lag ·{' '}
            {experiment.evaluation_window_days ?? 0} days window
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-400">Created</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {new Date(experiment.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400">Hypothesis</div>
            <p className="mt-2 text-sm text-slate-600">
              {experiment.hypothesis ?? '—'}
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400">Primary metrics</div>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {formatJson(experiment.primary_metrics)}
            </pre>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400">Guardrails</div>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {formatJson(experiment.guardrails)}
            </pre>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400">Linked changes</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {linkedChanges.length} changes
            </div>
          </div>
        </div>
        <Table
          headers={['Occurred', 'Channel', 'Type', 'Summary', 'Entities']}
          rows={linkedRows}
          emptyMessage="No changes linked yet."
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400">
              Link existing changes
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              Select up to 50 recent changes
            </div>
          </div>
        </div>
        <form action={linkSubmit} className="space-y-4">
          <InlineFilters>
            <div className="text-xs text-slate-500">
              Checked items will be linked to this experiment.
            </div>
          </InlineFilters>
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-200">
            <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="w-12"></th>
                    <th className="w-36 pb-2">Occurred</th>
                    <th className="w-20 pb-2">Channel</th>
                    <th className="w-32 pb-2">Type</th>
                    <th className="pb-2">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentChanges.map((change) => (
                    <tr key={change.change_id} className="hover:bg-slate-50">
                      <td className="py-3 text-center">
                        <input
                          type="checkbox"
                          name="change_id"
                          value={change.change_id}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900"
                        />
                      </td>
                      <td className="py-3 text-slate-500">
                        {formatDateTime(change.occurred_at)}
                      </td>
                      <td className="py-3 text-xs uppercase text-slate-400">
                        {change.channel}
                      </td>
                      <td className="py-3 text-slate-600">{change.change_type}</td>
                      <td className="py-3 text-slate-900">{change.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Link selected changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
