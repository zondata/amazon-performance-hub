import { getExperimentContext } from '@/lib/logbook/getExperimentContext';
import { buildRollbackOutputPack } from '@/lib/logbook/rollbackPlan';

export const dynamic = 'force-dynamic';

const sanitizeFileSegment = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'experiment';
};

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const experimentId = id?.trim();

  if (!experimentId) {
    return new Response('Missing experiment id.', { status: 400 });
  }

  let context;
  try {
    context = await getExperimentContext(experimentId);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Failed to load experiment.', {
      status: 500,
    });
  }

  const url = new URL(request.url);
  const runIdParam = url.searchParams.get('run_id');
  const targetRunId = runIdParam && runIdParam.trim().length > 0 ? runIdParam.trim() : null;

  const output = buildRollbackOutputPack({
    experiment: {
      experiment_id: context.experiment.experiment_id,
      asin: context.product_asin ?? 'UNKNOWN_ASIN',
      marketplace: context.experiment.marketplace,
    },
    changes: context.linked_changes.map((change) => ({
      change_id: change.change_id,
      run_id: change.run_id ?? null,
      before_json: change.before_json,
      after_json: change.after_json,
      channel: change.channel,
      summary: change.summary,
    })),
    targetRunId,
  });

  const runSuffix = targetRunId ? `_run_${sanitizeFileSegment(targetRunId)}` : '';
  const filename = `${sanitizeFileSegment(context.experiment.name)}_${context.experiment.experiment_id}${runSuffix}_rollback_pack.json`;

  return new Response(`${JSON.stringify(output, null, 2)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
