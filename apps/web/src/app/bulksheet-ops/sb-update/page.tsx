import Link from 'next/link';

import { env } from '@/lib/env';
import { getExperimentOptions } from '@/lib/logbook/getExperimentOptions';
import SbUpdateRunner from '@/components/bulksheets/SbUpdateRunner';
import { runSbUpdateGenerator } from '@/lib/bulksheets/runGenerators';
import { downloadTemplateToLocalPath, getTemplateStatus } from '@/lib/bulksheets/templateStore';
import type { SbUpdateAction } from '../../../../../../src/bulksheet_gen_sb/types';

const formatDateTime = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US');
};

export default async function SbUpdatePage() {
  const experiments = await getExperimentOptions();
  const templateStatus = await getTemplateStatus();
  const sbTemplateStatus = templateStatus.templates.sb_update;
  const missingConfig = !env.bulkgenOutRoot;
  const spawnDisabled = !env.enableBulkgenSpawn;
  const templateMissing = sbTemplateStatus.source === 'missing';
  const templateUpdatedAt = formatDateTime(sbTemplateStatus.updatedAt);
  const templateStatusLine =
    sbTemplateStatus.source === 'storage'
      ? `Stored in system${templateUpdatedAt ? ` (updated ${templateUpdatedAt})` : ''}`
      : sbTemplateStatus.source === 'local_fallback'
        ? `Using local fallback (${sbTemplateStatus.localFallbackPath ?? 'configured env path'})`
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
      const actions = JSON.parse(actionsRaw) as SbUpdateAction[];
      const templatePath = await downloadTemplateToLocalPath('sb_update');

      const result = await runSbUpdateGenerator({
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
          Template is missing. Upload SB Update at{' '}
          <Link href="/bulksheet-ops/templates" className="underline">
            Bulksheet Ops → Templates
          </Link>
          .
        </div>
      ) : null}
      {sbTemplateStatus.error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Template storage warning: {sbTemplateStatus.error}
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
        templateStatusLine={templateStatusLine}
        defaultOutRoot={env.bulkgenOutRoot}
      />
    </div>
  );
}
