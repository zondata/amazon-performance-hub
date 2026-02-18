'use client';

import React, { useEffect, useMemo, useState } from 'react';

import type { ExperimentOption } from '@/lib/logbook/getExperimentOptions';
import type { GeneratorResult } from '@/lib/bulksheets/runGenerators';

const buildRunId = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `ui-sp-create-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

type SpCreateState = {
  result?: GeneratorResult | null;
  error?: string | null;
};

export default function SpCreateRunner(props: {
  action: (prevState: SpCreateState, formData: FormData) => Promise<SpCreateState>;
  addPendingAction: (formData: FormData) => Promise<void>;
  experiments: ExperimentOption[];
  defaultTemplatePath?: string | null;
  defaultOutRoot?: string | null;
}) {
  const [state, formAction] = React.useActionState(props.action, { result: null, error: null });
  const [mode, setMode] = useState<'builder' | 'json'>('builder');
  const [actionsJson, setActionsJson] = useState('');
  const [selectedExperiment, setSelectedExperiment] = useState('');
  const [logEnabled, setLogEnabled] = useState(false);

  useEffect(() => {
    if (selectedExperiment) {
      setLogEnabled(true);
    }
  }, [selectedExperiment]);

  const downloadLink = (relativePath?: string | null) => {
    if (!relativePath) return null;
    return `/api/files?path=${encodeURIComponent(relativePath)}`;
  };

  const experimentOptions = useMemo(() => props.experiments, [props.experiments]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="mode" value={mode} />
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Template path</label>
              <input
                name="template_path"
                defaultValue={props.defaultTemplatePath ?? ''}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="/path/to/sp-create-template.xlsx"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Output root</label>
              <input
                name="out_root"
                defaultValue={props.defaultOutRoot ?? ''}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="/path/to/_BULKGEN_OUT"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Run ID</label>
              <input
                name="run_id"
                defaultValue={buildRunId()}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Exported at</label>
              <input
                name="exported_at"
                defaultValue={new Date().toISOString()}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Notes</label>
              <textarea
                name="notes"
                className="min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">Create inputs</div>
              <div className="mt-1 text-sm text-slate-500">Use the safe builder or paste JSON.</div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setMode('builder')}
                className={`rounded-full px-3 py-1 ${
                  mode === 'builder'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 text-slate-600'
                }`}
              >
                Builder
              </button>
              <button
                type="button"
                onClick={() => setMode('json')}
                className={`rounded-full px-3 py-1 ${
                  mode === 'json'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 text-slate-600'
                }`}
              >
                JSON
              </button>
            </div>
          </div>

          {mode === 'builder' ? (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs uppercase tracking-wider text-slate-400">Campaign name</label>
                <input
                  name="campaign_name"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-slate-400">Targeting type</label>
                <select
                  name="targeting_type"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  defaultValue="Auto"
                >
                  <option value="Auto">Auto</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-slate-400">Daily budget</label>
                <input
                  name="daily_budget"
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-slate-400">Portfolio ID</label>
                <input
                  name="portfolio_id"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-slate-400">Default bid</label>
                <input
                  name="default_bid"
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-slate-400">SKU</label>
                <input
                  name="sku"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-slate-400">ASIN</label>
                <input
                  name="asin"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs uppercase tracking-wider text-slate-400">
                  Keywords (Manual only)
                </label>
                <textarea
                  name="keywords"
                  className="min-h-[120px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="keyword,match_type,bid"
                />
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">
                Actions JSON
              </label>
              <textarea
                name="actions_json"
                value={actionsJson}
                onChange={(event) => setActionsJson(event.target.value)}
                className="min-h-[220px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder='[{"type":"create_campaign","name":"New Campaign","daily_budget":25,"targeting_type":"Auto"}]'
              />
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Experiment</label>
              <select
                name="experiment_id"
                value={selectedExperiment}
                onChange={(event) => setSelectedExperiment(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">No experiment</option>
                {experimentOptions.map((option) => (
                  <option key={option.experiment_id} value={option.experiment_id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="log_enabled"
                checked={logEnabled}
                onChange={(event) => setLogEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-600">Log to Logbook</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Generate SP create
        </button>
      </form>

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-400">Latest run</div>
          {state.error ? (
            <div className="mt-3 text-sm text-red-500">{state.error}</div>
          ) : null}
          {state.result ? (
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400">Run ID</div>
                <div className="mt-1 font-medium text-slate-900">{state.result.run_id}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400">Output dir</div>
                <div className="mt-1 break-all">{state.result.out_dir}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {downloadLink(state.result.upload_strict_path) ? (
                  <a
                    href={downloadLink(state.result.upload_strict_path) ?? '#'}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                  >
                    Download upload_strict.xlsx
                  </a>
                ) : null}
                <a
                  href={downloadLink(state.result.review_path) ?? '#'}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                >
                  Download review.xlsx
                </a>
                {downloadLink(state.result.manifest_path) ? (
                  <a
                    href={downloadLink(state.result.manifest_path) ?? '#'}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                  >
                    Download manifest.json
                  </a>
                ) : null}
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                Newly created IDs appear in bulk snapshots later. Use reconcile when the latest
                snapshot includes these entities.
              </div>
              {state.result.manifest_path ? (
                <form action={props.addPendingAction}>
                  <input type="hidden" name="manifest_path" value={state.result.manifest_path} />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                  >
                    Add manifest to pending reconcile
                  </button>
                </form>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500">No run yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
