import { env } from '@/lib/env';
import ReconcileRunner from '@/components/bulksheets/ReconcileRunner';
import { listManifestFiles, processPendingManifests } from '@/lib/bulksheets/reconcilePending';

const today = () => new Date().toISOString().slice(0, 10);

export default async function ReconcilePage() {
  const pendingDir = env.bulkgenPendingDir;
  const reconciledDir = env.bulkgenReconciledDir;
  const failedDir = env.bulkgenFailedDir;

  const pendingList = listManifestFiles(pendingDir);
  const reconciledList = listManifestFiles(reconciledDir);
  const failedList = listManifestFiles(failedDir);

  const action = async (
    _prevState: { summary?: unknown; error?: string | null },
    formData: FormData
  ) => {
    'use server';

    try {
      if (!pendingDir) {
        throw new Error('BULKGEN_PENDING_RECONCILE_DIR not configured.');
      }
      const snapshotDate = String(formData.get('snapshot_date') ?? '').trim();
      if (!snapshotDate) throw new Error('Snapshot date is required.');
      const summary = await processPendingManifests({
        snapshotDate,
        pendingDir,
      });
      return { summary, error: null };
    } catch (error) {
      return {
        summary: null,
        error: error instanceof Error ? error.message : 'Failed to reconcile',
      };
    }
  };

  const missingConfig = !pendingDir || !reconciledDir || !failedDir;

  return (
    <div className="space-y-6">
      {missingConfig ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Configure BULKGEN_PENDING_RECONCILE_DIR, BULKGEN_RECONCILED_DIR, and
          BULKGEN_FAILED_DIR in apps/web/.env.local to use reconcile.
        </div>
      ) : null}

      <ReconcileRunner action={action} defaultSnapshotDate={today()} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-400">Pending</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {pendingList.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-400">Reconciled</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {reconciledList.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-400">Failed</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {failedList.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-400">Pending manifests</div>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            {pendingList.length === 0 ? (
              <div className="text-slate-400">No pending manifests.</div>
            ) : (
              pendingList.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-2">
                  <span className="truncate" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-xs text-slate-400">{item.mtime}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-400">Reconciled results</div>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            {reconciledList.length === 0 ? (
              <div className="text-slate-400">No reconciled results.</div>
            ) : (
              reconciledList.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-2">
                  <a
                    className="truncate text-slate-600 underline"
                    href={`/api/files?path=reconciled/${encodeURIComponent(item.name)}`}
                    title={item.name}
                  >
                    {item.name}
                  </a>
                  <span className="text-xs text-slate-400">{item.mtime}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-400">Failed manifests</div>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            {failedList.length === 0 ? (
              <div className="text-slate-400">No failed manifests.</div>
            ) : (
              failedList.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-2">
                  <a
                    className="truncate text-slate-600 underline"
                    href={`/api/files?path=failed/${encodeURIComponent(item.name)}`}
                    title={item.name}
                  >
                    {item.name}
                  </a>
                  <span className="text-xs text-slate-400">{item.mtime}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
