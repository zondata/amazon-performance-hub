import Link from 'next/link';

import { env } from '@/lib/env';
import { getExperimentOptions } from '@/lib/logbook/getExperimentOptions';
import SpUpdateRunner from '@/components/bulksheets/SpUpdateRunner';
import { runSpUpdateGenerator } from '@/lib/bulksheets/runGenerators';
import { downloadTemplateToLocalPath, getTemplateStatus } from '@/lib/bulksheets/templateStore';
import type { SpUpdateAction } from '../../../../../../src/bulksheet_gen_sp/types';

const formatDateTime = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US');
};

export default async function SpUpdatePage() {
  const experiments = await getExperimentOptions();
  const templateStatus = await getTemplateStatus();
  const spTemplateStatus = templateStatus.templates.sp_update;
  const missingConfig = !env.bulkgenOutRoot;
  const spawnDisabled = !env.enableBulkgenSpawn;
  const templateMissing = spTemplateStatus.source === 'missing';
  const templateUpdatedAt = formatDateTime(spTemplateStatus.updatedAt);
  const templateStatusLine =
    spTemplateStatus.source === 'storage'
      ? `Stored in system${templateUpdatedAt ? ` (updated ${templateUpdatedAt})` : ''}`
      : spTemplateStatus.source === 'local_fallback'
        ? `Using local fallback (${spTemplateStatus.localFallbackPath ?? 'configured env path'})`
        : 'Missing (upload in Templates tab)';

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
      const templatePath = await downloadTemplateToLocalPath('sp_update');

      const result = await runSpUpdateGenerator({
        templatePath,
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
          Bulksheet Ops requires BULKGEN_OUT_ROOT in apps/web/.env.local.
        </div>
      ) : null}
      {templateMissing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Template is missing. Upload SP Update at{' '}
          <Link href="/bulksheet-ops/templates" className="underline">
            Bulksheet Ops → Templates
          </Link>
          .
        </div>
      ) : null}
      {spTemplateStatus.error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Template storage warning: {spTemplateStatus.error}
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
        templateStatusLine={templateStatusLine}
        defaultOutRoot={env.bulkgenOutRoot}
      />
    </div>
  );
}
