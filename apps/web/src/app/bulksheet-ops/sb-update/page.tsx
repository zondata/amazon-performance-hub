import { env } from '@/lib/env';
import { getExperimentOptions } from '@/lib/logbook/getExperimentOptions';
import SbUpdateRunner from '@/components/bulksheets/SbUpdateRunner';
import { runSbUpdateGenerator } from '@/lib/bulksheets/runGenerators';
import type { SbUpdateAction } from '../../../../../../src/bulksheet_gen_sb/types';

export default async function SbUpdatePage() {
  const experiments = await getExperimentOptions();
  const missingConfig = !env.bulkgenOutRoot || !env.bulkgenTemplateSbUpdate;
  const spawnDisabled = !env.enableBulkgenSpawn;

  const action = async (
    _prevState: { result?: unknown; error?: string | null },
    formData: FormData
  ) => {
    'use server';

    try {
      const actionsRaw = String(formData.get('actions_json') ?? '').trim();
      if (!actionsRaw) {
        throw new Error('Actions JSON is required.');
      }
      const actions = JSON.parse(actionsRaw) as SbUpdateAction[];

      const result = await runSbUpdateGenerator({
        templatePath: String(formData.get('template_path') ?? ''),
        outRoot: String(formData.get('out_root') ?? ''),
        notes: String(formData.get('notes') ?? ''),
        runId: String(formData.get('run_id') ?? ''),
        exportedAt: String(formData.get('exported_at') ?? ''),
        experimentId: String(formData.get('experiment_id') ?? ''),
        logEnabled: formData.get('log_enabled') === 'on',
        actions,
      });

      return { result, error: null };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'Failed to generate bulksheet',
      };
    }
  };

  return (
    <div className="space-y-4">
      {missingConfig ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Bulksheet Ops requires local paths. Set BULKGEN_OUT_ROOT and
          BULKGEN_TEMPLATE_SB_UPDATE in apps/web/.env.local.
        </div>
      ) : null}
      {spawnDisabled ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          ENABLE_BULKGEN_SPAWN=1 is required to run generators from the web UI in this build.
        </div>
      ) : null}
      <SbUpdateRunner
        action={action}
        experiments={experiments}
        defaultTemplatePath={env.bulkgenTemplateSbUpdate}
        defaultOutRoot={env.bulkgenOutRoot}
      />
    </div>
  );
}
