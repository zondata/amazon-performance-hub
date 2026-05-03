import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { getPipelineStatus } from '@/lib/pipeline-status/getPipelineStatus';
import {
  describePipelineManualRunBackend,
  runPipelineManualGroup,
  supportsAnyPipelineManualRun,
} from '@/lib/pipeline-status/manualRun';

const badgeClassName = (
  tone: 'positive' | 'muted' | 'warning' | 'danger' | 'neutral'
) => {
  if (tone === 'positive') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (tone === 'muted') {
    return 'border-border bg-surface-2 text-muted';
  }
  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (tone === 'danger') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-border bg-surface text-foreground';
};

const statusTone = (status: string) => {
  if (status === 'success') return 'positive';
  if (status === 'partial_success') return 'warning';
  if (status === 'warning') return 'warning';
  if (status === 'failed') return 'danger';
  if (status === 'blocked' || status === 'not_implemented' || status === 'no_coverage') {
    return 'muted';
  }
  return 'neutral';
};

const statusLabel = (status: string) => status.replace(/_/g, ' ');

const implementationLabel = (status: 'implemented' | 'not_implemented') =>
  status === 'implemented' ? 'Implemented' : 'Not implemented';

const completenessTone = (value: string) => {
  if (value === 'Complete') return 'positive';
  if (value === 'Expected Delay') return 'warning';
  if (value === 'Blocked') return 'danger';
  if (value === 'No Data') return 'muted';
  return 'neutral';
};

const amazonApiStateTone = (value: string) => {
  if (value === 'imported' || value === 'completed') return 'positive';
  if (
    value === 'polling' ||
    value === 'pending' ||
    value === 'requested' ||
    value === 'created' ||
    value === 'pending_timeout'
  ) {
    return 'warning';
  }
  if (value === 'failed' || value === 'stale_expired') {
    return 'danger';
  }
  return 'muted';
};

type PipelineStatusPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const paramValue = (
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
) => {
  const value = params?.[key];
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

export default async function PipelineStatusPage({
  searchParams,
}: PipelineStatusPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const runStatus = paramValue(params, 'run_status');
  const runSource = paramValue(params, 'run_source');
  const runWindow = paramValue(params, 'run_window');
  const runSummary = paramValue(params, 'run_summary');

  const runPipelineGroup = async (formData: FormData) => {
    'use server';

    const group = String(formData.get('run_group') ?? '').trim();
    if (group !== 'ads' && group !== 'sales') {
      redirect(
        `/pipeline-status?run_status=error&run_source=${encodeURIComponent(
          group || 'unknown'
        )}&run_summary=${encodeURIComponent('Manual run group is not supported.')}`
      );
    }

    try {
      const result = await runPipelineManualGroup(group);
      revalidatePath('/pipeline-status');
      redirect(
        `/pipeline-status?run_status=${encodeURIComponent(
          result.status
        )}&run_source=${encodeURIComponent(result.sourceLabel)}&run_window=${encodeURIComponent(
          `${result.window.from} -> ${result.window.to}`
        )}&run_summary=${encodeURIComponent(result.summary)}`
      );
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Manual run failed.';
      revalidatePath('/pipeline-status');
      redirect(
        `/pipeline-status?run_status=error&run_source=${encodeURIComponent(
          group
        )}&run_summary=${encodeURIComponent(message)}`
      );
    }
  };

  const { rows, batchSummary } = await getPipelineStatus();
  const manualRunBackend = describePipelineManualRunBackend();
  const manualRunEnabled = supportsAnyPipelineManualRun();
  const totalSources = rows.length;
  const implementedSources = rows.filter(
    (row) => row.implementationStatus === 'implemented'
  ).length;
  const notImplementedSources = totalSources - implementedSources;
  const activePendingTotal = rows.filter((row) =>
    ['created', 'requested', 'pending', 'polling', 'pending_timeout'].includes(
      row.amazonApiState
    )
  ).length;
  const blockedOrIncompleteTotal = rows.filter(
    (row) => row.dataCompleteness === 'Blocked' || row.dataCompleteness === 'Incomplete'
  ).length;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              V3 Operations
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              Pipeline Status
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Daily operator view for source coverage, pending Amazon/API state, and
              manual rerun access.
            </p>
          </div>
          <Link
            href="/imports-health"
            className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground"
          >
            Open Imports &amp; Health
          </Link>
        </div>
      </section>

      {runStatus ? (
        <section
          className={`rounded-2xl border p-4 shadow-sm ${
            runStatus === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : runStatus === 'pending'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <div className="text-sm font-semibold">
            {runStatus === 'success'
              ? 'Manual run started successfully'
              : runStatus === 'pending'
                ? 'Manual run resumed and is still pending'
                : 'Manual run failed'}
          </div>
          <div className="mt-1 text-sm">
            {runSource || 'Source group'}
            {runWindow ? ` • ${runWindow}` : ''}
          </div>
          {runSummary ? <div className="mt-2 text-sm">{runSummary}</div> : null}
        </section>
      ) : null}

      {batchSummary ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
          <div className="flex flex-wrap items-start gap-3">
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                statusTone(batchSummary.status)
              )}`}
            >
              Ads batch {statusLabel(batchSummary.status)}
            </span>
            <p className="max-w-4xl text-sm text-foreground">{batchSummary.summary}</p>
          </div>
          {batchSummary.technicalDetails ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted">
                Show technical details
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-surface px-3 py-2 text-xs whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {batchSummary.technicalDetails}
              </pre>
            </details>
          ) : null}
        </section>
      ) : null}

      {!manualRunBackend.available ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="text-sm font-semibold">Manual runs are not configured</div>
          <p className="mt-1 text-sm">
            Pipeline Summary can only launch runs when a manual-run backend is configured.
            Add GitHub dispatch env vars on Vercel, or enable local spawn for local-only
            testing.
          </p>
          <p className="mt-2 text-sm">
            Missing env vars: {manualRunBackend.missingEnvKeys.join(', ')}
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Total sources</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{totalSources}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Implemented</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {implementedSources}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Not implemented</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {notImplementedSources}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">
              Blocked or incomplete
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {blockedOrIncompleteTotal}
            </div>
            <div className="mt-1 text-xs text-muted">
              {activePendingTotal} active Amazon/API states
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-foreground">Manual runs</div>
            <p className="mt-1 text-sm text-muted">
              Run the full Sales sync or the full Ads batch for the recent 30-day window.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <form action={runPipelineGroup}>
              <input type="hidden" name="run_group" value="sales" />
              <button
                type="submit"
                disabled={!manualRunEnabled}
                title={
                  manualRunEnabled ? 'Run Sales & Traffic sync.' : 'Manual run backend is not configured.'
                }
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted"
              >
                Run sales
              </button>
            </form>
            <form action={runPipelineGroup}>
              <input type="hidden" name="run_group" value="ads" />
              <button
                type="submit"
                disabled={!manualRunEnabled}
                title={
                  manualRunEnabled ? 'Run the full Ads batch.' : 'Manual run backend is not configured.'
                }
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted"
              >
                Run ads
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        <div
          data-aph-hscroll
          data-aph-hscroll-axis="x"
          className="max-h-[70vh] overflow-auto rounded-xl border border-border"
        >
          <table className="w-full min-w-[980px] table-fixed text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="sticky top-0 z-10 w-[18rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Source group
                </th>
                <th className="sticky top-0 z-10 w-[9rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Implementation
                </th>
                <th className="sticky top-0 z-10 w-[10rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Earliest report day
                </th>
                <th className="sticky top-0 z-10 w-[10rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Latest report day
                </th>
                <th className="sticky top-0 z-10 w-[10rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Data completeness
                </th>
                <th className="sticky top-0 z-10 w-[10rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Amazon/API state
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={`${row.sourceType}:${row.targetTable}`}>
                  <td className="px-4 py-3 align-top font-medium text-foreground">
                    <div className="max-w-[18rem] whitespace-normal break-words">
                      {row.sourceGroup}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        row.implementationStatus === 'implemented' ? 'positive' : 'muted'
                      )}`}
                    >
                      {implementationLabel(row.implementationStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">{row.earliestReportDay}</td>
                  <td className="px-4 py-3 align-top text-muted">{row.latestReportDay}</td>
                  <td className="px-4 py-3 align-top text-muted">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        completenessTone(row.dataCompleteness)
                      )}`}
                    >
                      {row.dataCompleteness}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        amazonApiStateTone(row.amazonApiState)
                      )}`}
                    >
                      {row.amazonApiState}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
