import { redirect } from 'next/navigation';

import PageHeader from '@/components/PageHeader';
import JSONTextarea from '@/components/JSONTextarea';
import { createExperiment } from '@/lib/logbook/createExperiment';
import { safeParseJson } from '@/lib/logbook/validation';

const DEFAULT_LAG_DAYS = 2;
const DEFAULT_WINDOW_DAYS = 7;

export default function NewExperimentPage() {
  const handleSubmit = async (formData: FormData) => {
    'use server';

    const primaryMetricsRaw = String(formData.get('primary_metrics') ?? '');
    const guardrailsRaw = String(formData.get('guardrails') ?? '');

    const parsedPrimary = safeParseJson(primaryMetricsRaw, 'Primary metrics');
    const parsedGuardrails = safeParseJson(guardrailsRaw, 'Guardrails');

    if (parsedPrimary.error || parsedGuardrails.error) {
      throw new Error(parsedPrimary.error ?? parsedGuardrails.error ?? 'Invalid JSON');
    }

    const experimentId = await createExperiment({
      name: String(formData.get('name') ?? ''),
      objective: String(formData.get('objective') ?? ''),
      hypothesis: String(formData.get('hypothesis') ?? ''),
      status: String(formData.get('status') ?? 'planned'),
      evaluation_lag_days: Number(formData.get('evaluation_lag_days') ?? DEFAULT_LAG_DAYS),
      evaluation_window_days: Number(
        formData.get('evaluation_window_days') ?? DEFAULT_WINDOW_DAYS
      ),
      primary_metrics: parsedPrimary.value ?? null,
      guardrails: parsedGuardrails.value ?? null,
    });

    if (!experimentId) {
      throw new Error('Experiment creation failed: missing experiment id.');
    }

    redirect(`/logbook/experiments/${experimentId}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New experiment"
        subtitle="Define the experiment, evaluation window, and success criteria."
      />

      <form action={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Name</label>
              <input
                name="name"
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="SP budget test week 6"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Objective</label>
              <textarea
                name="objective"
                required
                className="min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Improve ROAS without lowering volume"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">
                Hypothesis
              </label>
              <textarea
                name="hypothesis"
                className="min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Higher budgets unlock extra top-of-search volume"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Status</label>
              <select
                name="status"
                defaultValue="planned"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="planned">planned</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="complete">complete</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">
                Evaluation lag days
              </label>
              <input
                type="number"
                name="evaluation_lag_days"
                defaultValue={DEFAULT_LAG_DAYS}
                min={0}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">
                Evaluation window days
              </label>
              <input
                type="number"
                name="evaluation_window_days"
                defaultValue={DEFAULT_WINDOW_DAYS}
                min={1}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <JSONTextarea
              label="Primary metrics"
              name="primary_metrics"
              helperText="Optional JSON map of primary metrics."
              placeholder='{"roas": "sp_campaign_hourly_latest"}'
            />
            <JSONTextarea
              label="Guardrails"
              name="guardrails"
              helperText="Optional JSON guardrails."
              placeholder='{"acos": "<= 0.3"}'
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Create experiment
          </button>
        </div>
      </form>
    </div>
  );
}
