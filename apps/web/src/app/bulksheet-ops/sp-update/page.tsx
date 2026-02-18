import { env } from '@/lib/env';
import { getExperimentOptions } from '@/lib/logbook/getExperimentOptions';
import SpUpdateRunner from '@/components/bulksheets/SpUpdateRunner';
import { runSpUpdateGenerator } from '@/lib/bulksheets/runGenerators';
import type { SpUpdateAction } from '../../../../../../src/bulksheet_gen_sp/types';

export default async function SpUpdatePage() {
  const experiments = await getExperimentOptions();
  const missingConfig = !env.bulkgenOutRoot || !env.bulkgenTemplateSpUpdate;
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
      const actions = JSON.parse(actionsRaw) as SpUpdateAction[];

      const result = await runSpUpdateGenerator({
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
          BULKGEN_TEMPLATE_SP_UPDATE in apps/web/.env.local.
        </div>
      ) : null}
      {spawnDisabled ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          ENABLE_BULKGEN_SPAWN=1 is required to run generators from the web UI in this build.
        </div>
      ) : null}
      <SpUpdateRunner
        action={action}
        experiments={experiments}
        defaultTemplatePath={env.bulkgenTemplateSpUpdate}
        defaultOutRoot={env.bulkgenOutRoot}
      />
    </div>
  );
}
