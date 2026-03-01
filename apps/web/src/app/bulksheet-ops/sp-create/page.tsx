import fs from 'node:fs';
import path from 'node:path';

import Link from 'next/link';

import { env } from '@/lib/env';
import { getExperimentOptions } from '@/lib/logbook/getExperimentOptions';
import SpCreateRunner from '@/components/bulksheets/SpCreateRunner';
import { runSpCreateGenerator } from '@/lib/bulksheets/runGenerators';
import { buildSpCreateActions } from '@/lib/bulksheets/actionBuilders';
import { ensureOutRoot, safeJoin } from '@/lib/bulksheets/fsPaths';
import { downloadTemplateToLocalPath, getTemplateStatus } from '@/lib/bulksheets/templateStore';
import type { SpCreateAction } from '../../../../../../src/bulksheet_gen_sp_create/types';

const parseKeywords = (raw: string) => {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const [text, matchType, bidRaw] = line.split(',').map((part) => part.trim());
    if (!text || !matchType || !bidRaw) {
      throw new Error(`Invalid keyword line: ${line}`);
    }
    const bid = Number(bidRaw);
    if (!Number.isFinite(bid)) {
      throw new Error(`Invalid bid for keyword: ${line}`);
    }
    return { text, match_type: matchType, bid };
  });
};

const formatDateTime = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US');
};

export default async function SpCreatePage() {
  const experiments = await getExperimentOptions();
  const templateStatus = await getTemplateStatus();
  const spCreateTemplateStatus = templateStatus.templates.sp_create;
  const missingConfig = !env.bulkgenOutRoot;
  const spawnDisabled = !env.enableBulkgenSpawn;
  const templateMissing = spCreateTemplateStatus.source === 'missing';
  const templateUpdatedAt = formatDateTime(spCreateTemplateStatus.updatedAt);
  const templateStatusLine =
    spCreateTemplateStatus.source === 'storage'
      ? `Stored in system${templateUpdatedAt ? ` (updated ${templateUpdatedAt})` : ''}`
      : spCreateTemplateStatus.source === 'local_fallback'
        ? `Using local fallback (${spCreateTemplateStatus.localFallbackPath ?? 'configured env path'})`
        : 'Missing (upload in Templates tab)';

  const action = async (
    _prevState: { result?: unknown; error?: string | null },
    formData: FormData
  ) => {
    'use server';

    try {
      const mode = String(formData.get('mode') ?? 'builder');
      let actions: SpCreateAction[] = [];

      if (mode === 'json') {
        const actionsRaw = String(formData.get('actions_json') ?? '').trim();
        if (!actionsRaw) throw new Error('Actions JSON is required.');
        actions = JSON.parse(actionsRaw) as SpCreateAction[];
      } else {
        const campaignName = String(formData.get('campaign_name') ?? '').trim();
        const targetingType = String(formData.get('targeting_type') ?? 'Auto').trim();
        const dailyBudget = Number(formData.get('daily_budget') ?? 0);
        if (!campaignName) throw new Error('Campaign name is required.');
        if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
          throw new Error('Daily budget must be positive.');
        }
        const keywordsRaw = String(formData.get('keywords') ?? '').trim();
        const keywords = keywordsRaw ? parseKeywords(keywordsRaw) : [];

        const defaultBidRaw = String(formData.get('default_bid') ?? '').trim();
        const defaultBid = defaultBidRaw ? Number(defaultBidRaw) : undefined;
        if (defaultBidRaw && !Number.isFinite(defaultBid)) {
          throw new Error('Default bid must be a number.');
        }

        actions = buildSpCreateActions({
          campaignName,
          targetingType,
          dailyBudget,
          portfolioId: String(formData.get('portfolio_id') ?? '').trim() || undefined,
          defaultBid,
          sku: String(formData.get('sku') ?? '').trim() || undefined,
          asin: String(formData.get('asin') ?? '').trim() || undefined,
          keywords,
        });
      }
      const templatePath = await downloadTemplateToLocalPath('sp_create');

      const result = await runSpCreateGenerator({
        templatePath,
        outRoot: String(formData.get('out_root') ?? ''),
        notes: String(formData.get('notes') ?? ''),
        runId: String(formData.get('run_id') ?? ''),
        exportedAt: String(formData.get('exported_at') ?? ''),
        experimentId: String(formData.get('experiment_id') ?? ''),
        logEnabled: formData.get('log_enabled') === 'on',
        actions,
        portfolioId: String(formData.get('portfolio_id') ?? '').trim() || undefined,
      });

      return { result, error: null };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'Failed to generate bulksheet',
      };
    }
  };

  const addPendingAction = async (formData: FormData) => {
    'use server';

    const relativePath = String(formData.get('manifest_path') ?? '').trim();
    if (!relativePath) return;
    if (!env.bulkgenPendingDir) {
      throw new Error('BULKGEN_PENDING_RECONCILE_DIR not configured.');
    }

    const outRoot = ensureOutRoot(env.bulkgenOutRoot);
    const sourcePath = safeJoin(outRoot, relativePath);
    const destDir = path.resolve(env.bulkgenPendingDir);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destPath = path.join(destDir, path.basename(sourcePath));
    fs.copyFileSync(sourcePath, destPath);
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
          Template is missing. Upload SP Create at{' '}
          <Link href="/bulksheet-ops/templates" className="underline">
            Bulksheet Ops → Templates
          </Link>
          .
        </div>
      ) : null}
      {spCreateTemplateStatus.error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Template storage warning: {spCreateTemplateStatus.error}
        </div>
      ) : null}
      {spawnDisabled ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          ENABLE_BULKGEN_SPAWN=1 is required to run generators from the web UI in this build.
        </div>
      ) : null}
      <SpCreateRunner
        action={action}
        addPendingAction={addPendingAction}
        experiments={experiments}
        templateStatusLine={templateStatusLine}
        defaultOutRoot={env.bulkgenOutRoot}
      />
    </div>
  );
}
