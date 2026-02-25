import { computeExperimentKpis } from '@/lib/logbook/computeExperimentKpis';
import { getExperimentContext } from '@/lib/logbook/getExperimentContext';
import { extractProductProfileContext } from '@/lib/products/productProfileContext';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const sanitizeFileSegment = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'experiment';
};

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
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

  const warnings: string[] = [];
  let kpis: Awaited<ReturnType<typeof computeExperimentKpis>> | null = null;
  let productProfile:
    | ReturnType<typeof extractProductProfileContext>
    | null = null;

  if (context.product_asin) {
    try {
      const { data: productRow, error: productError } = await supabaseAdmin
        .from('products')
        .select('product_id')
        .eq('account_id', context.experiment.account_id)
        .eq('marketplace', context.experiment.marketplace)
        .eq('asin', context.product_asin)
        .maybeSingle();

      if (productError) {
        warnings.push(`Failed loading product row for profile context: ${productError.message}`);
      } else if (!productRow?.product_id) {
        warnings.push('Product row not found for experiment ASIN; product profile context unavailable.');
      } else {
        const { data: profileRow, error: profileError } = await supabaseAdmin
          .from('product_profile')
          .select('profile_json')
          .eq('product_id', productRow.product_id)
          .maybeSingle();

        if (profileError) {
          warnings.push(`Failed loading product profile context: ${profileError.message}`);
        } else {
          productProfile = extractProductProfileContext(profileRow?.profile_json ?? null);
        }
      }
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Failed loading product profile context: ${error.message}`
          : 'Failed loading product profile context.'
      );
    }
  }

  if (!context.product_asin) {
    warnings.push('scope.product_id missing; KPI comparison unavailable.');
  }

  if (!context.date_window.startDate || !context.date_window.endDate) {
    warnings.push('Experiment window missing; KPI comparison unavailable.');
  }

  if (context.product_asin && context.date_window.startDate && context.date_window.endDate) {
    try {
      kpis = await computeExperimentKpis({
        accountId: context.experiment.account_id ?? '',
        marketplace: context.experiment.marketplace ?? '',
        asin: context.product_asin,
        startDate: context.date_window.startDate,
        endDate: context.date_window.endDate,
        lagDays: context.experiment.evaluation_lag_days ?? 0,
      });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'KPI query failed.');
    }
  }

  const payload = {
    kind: 'aph_experiment_evaluation_data_pack_v1',
    generated_at: new Date().toISOString(),
    experiment: {
      experiment_id: context.experiment.experiment_id,
      name: context.experiment.name,
      objective: context.experiment.objective,
      status: context.status,
      asin: context.product_asin,
      expected_outcome: context.expected_outcome,
      product_profile: productProfile,
      date_window: context.date_window,
      evaluation_lag_days: context.experiment.evaluation_lag_days ?? 0,
    },
    kpis,
    validation_summary: context.validation_summary,
    major_actions: context.major_actions.slice(0, 12).map((change) => ({
      change_id: change.change_id,
      occurred_at: change.occurred_at,
      run_id: change.run_id,
      channel: change.channel,
      change_type: change.change_type,
      summary: change.summary,
      validation_status: change.validation_status,
    })),
    warnings,
  };

  const filename = `${sanitizeFileSegment(context.experiment.name)}_${context.experiment.experiment_id}_ai_eval_data.json`;

  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
