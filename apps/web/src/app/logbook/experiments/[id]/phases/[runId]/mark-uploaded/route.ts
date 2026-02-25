import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { toMarketplaceDate } from '@/lib/time/marketplaceDate';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string; runId: string }> };

type ExperimentRow = {
  experiment_id: string;
  marketplace: string;
};

type PhaseRow = {
  id: string;
  run_id: string;
  effective_date: string | null;
  uploaded_at: string | null;
};

export async function POST(_request: Request, { params }: Ctx) {
  const { id, runId: rawRunId } = await params;
  const experimentId = id?.trim();
  const runId = decodeURIComponent(rawRunId ?? '').trim();

  if (!experimentId || !runId) {
    return new Response('Missing experiment id or run_id.', { status: 400 });
  }

  const { data: experimentData, error: experimentError } = await supabaseAdmin
    .from('log_experiments')
    .select('experiment_id,marketplace')
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (experimentError) {
    return new Response(`Failed loading experiment: ${experimentError.message}`, { status: 500 });
  }

  if (!experimentData) {
    return new Response('Experiment not found.', { status: 404 });
  }

  const experiment = experimentData as ExperimentRow;
  const now = new Date();
  const nowIso = now.toISOString();
  const marketplaceDate = toMarketplaceDate(now, experiment.marketplace);

  const { data: phaseData, error: phaseError } = await supabaseAdmin
    .from('log_experiment_phases')
    .upsert(
      {
        experiment_id: experimentId,
        run_id: runId,
        effective_date: marketplaceDate,
        uploaded_at: nowIso,
      },
      { onConflict: 'experiment_id,run_id' }
    )
    .select('id,run_id,effective_date,uploaded_at')
    .single();

  if (phaseError || !phaseData) {
    return new Response(`Failed writing phase upload marker: ${phaseError?.message ?? 'unknown error'}`, {
      status: 500,
    });
  }

  const phase = phaseData as PhaseRow;

  const { error: eventError } = await supabaseAdmin.from('log_experiment_events').insert({
    experiment_id: experimentId,
    run_id: runId,
    phase_id: phase.id,
    event_type: 'uploaded_to_amazon',
    event_date: marketplaceDate,
    occurred_at: nowIso,
    payload_json: {
      source: 'manual_click',
    },
  });

  if (eventError) {
    return new Response(`Phase updated but event logging failed: ${eventError.message}`, { status: 500 });
  }

  return Response.json({
    ok: true,
    run_id: phase.run_id,
    effective_date: phase.effective_date,
    uploaded_at: phase.uploaded_at,
  });
}
