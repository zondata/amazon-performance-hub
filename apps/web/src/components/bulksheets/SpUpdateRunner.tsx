'use client';

import React, { useEffect, useMemo, useState } from 'react';

import type { ExperimentOption } from '@/lib/logbook/getExperimentOptions';
import type { GeneratorResult } from '@/lib/bulksheets/runGenerators';
import { buildSpUpdateActions, type SpUpdateRowInput } from '@/lib/bulksheets/actionBuilders';

const ACTION_TYPES = [
  { value: 'update_campaign_budget', label: 'Update campaign budget' },
  { value: 'update_campaign_state', label: 'Update campaign state' },
  { value: 'update_campaign_bidding_strategy', label: 'Update campaign bidding strategy' },
  { value: 'update_ad_group_state', label: 'Update ad group state' },
  { value: 'update_ad_group_default_bid', label: 'Update ad group default bid' },
  { value: 'update_target_bid', label: 'Update target bid' },
  { value: 'update_target_state', label: 'Update target state' },
  { value: 'update_placement_modifier', label: 'Update placement modifier' },
];

const defaultRow = (): SpUpdateRowInput => ({
  type: 'update_campaign_budget',
  campaign_id: '',
  ad_group_id: '',
  target_id: '',
  placement_code: '',
  new_bid: '',
  new_budget: '',
  new_state: '',
  new_pct: '',
  new_strategy: '',
});

const buildRunId = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `ui-sp-update-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

type SpUpdateState = {
  result?: GeneratorResult | null;
  error?: string | null;
};

export default function SpUpdateRunner(props: {
  action: (prevState: SpUpdateState, formData: FormData) => Promise<SpUpdateState>;
  experiments: ExperimentOption[];
  defaultTemplatePath?: string | null;
  defaultOutRoot?: string | null;
}) {
  const [state, formAction] = React.useActionState(props.action, { result: null, error: null });
  const [mode, setMode] = useState<'builder' | 'json'>('builder');
  const [rows, setRows] = useState<SpUpdateRowInput[]>([defaultRow()]);
  const [actionsJson, setActionsJson] = useState('');
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState('');
  const [logEnabled, setLogEnabled] = useState(false);

  useEffect(() => {
    if (selectedExperiment) {
      setLogEnabled(true);
    }
  }, [selectedExperiment]);

  useEffect(() => {
    if (mode !== 'builder') return;
    try {
      const actions = buildSpUpdateActions(rows);
      setActionsJson(JSON.stringify(actions, null, 2));
      setBuilderError(null);
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : 'Invalid action row');
    }
  }, [rows, mode]);

  const addRow = () => setRows((prev) => [...prev, defaultRow()]);
  const removeRow = (index: number) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));

  const updateRow = (index: number, field: keyof SpUpdateRowInput, value: string) => {
    setRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row))
    );
  };

  const downloadLink = (relativePath?: string | null) => {
    if (!relativePath) return null;
    return `/api/files?path=${encodeURIComponent(relativePath)}`;
  };

  const experimentOptions = useMemo(() => props.experiments, [props.experiments]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <form action={formAction} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Template path</label>
              <input
                name="template_path"
                defaultValue={props.defaultTemplatePath ?? ''}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="/path/to/sp-update-template.xlsx"
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
              <div className="text-xs uppercase tracking-wider text-slate-400">Actions</div>
              <div className="mt-1 text-sm text-slate-500">Build actions or paste JSON.</div>
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
            <div className="mt-4 space-y-4">
              {rows.map((row, index) => (
                <div key={`row-${index}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-slate-400">
                      Action {index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-slate-400">Type</label>
                      <select
                        value={row.type ?? ''}
                        onChange={(event) => updateRow(index, 'type', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        {ACTION_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-slate-400">
                        Campaign ID
                      </label>
                      <input
                        value={row.campaign_id ?? ''}
                        onChange={(event) => updateRow(index, 'campaign_id', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-slate-400">
                        Ad group ID
                      </label>
                      <input
                        value={row.ad_group_id ?? ''}
                        onChange={(event) => updateRow(index, 'ad_group_id', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-slate-400">
                        Target ID
                      </label>
                      <input
                        value={row.target_id ?? ''}
                        onChange={(event) => updateRow(index, 'target_id', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-slate-400">
                        Placement code
                      </label>
                      <input
                        value={row.placement_code ?? ''}
                        onChange={(event) => updateRow(index, 'placement_code', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        placeholder="TOP_OF_SEARCH"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-slate-400">
                        New budget
                      </label>
                      <input
                        value={row.new_budget ?? ''}
                        onChange={(event) => updateRow(index, 'new_budget', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        type="number"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-slate-400">
                        New bid
                      </label>
                      <input
                        value={row.new_bid ?? ''}
                        onChange={(event) => updateRow(index, 'new_bid', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        type="number"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-slate-400">
                        New state
                      </label>
                      <input
                        value={row.new_state ?? ''}
                        onChange={(event) => updateRow(index, 'new_state', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        placeholder="paused"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-slate-400">
                        New %
                      </label>
                      <input
                        value={row.new_pct ?? ''}
                        onChange={(event) => updateRow(index, 'new_pct', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        type="number"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs uppercase tracking-wider text-slate-400">
                        New strategy
                      </label>
                      <input
                        value={row.new_strategy ?? ''}
                        onChange={(event) => updateRow(index, 'new_strategy', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        placeholder="Dynamic bids - down only"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {builderError ? (
                <div className="text-sm text-red-500">{builderError}</div>
              ) : null}
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={addRow}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                >
                  Add action
                </button>
              </div>
              <input type="hidden" name="actions_json" value={actionsJson} />
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
                className="min-h-[200px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder='[{"type":"update_campaign_budget","campaign_id":"123","new_budget":25}]'
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
          Generate SP update
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
              </div>
              {state.result.log_created !== undefined ? (
                <div>
                  Logbook: {state.result.log_created} created, {state.result.log_skipped ?? 0}{' '}
                  skipped
                </div>
              ) : null}
              {state.result.warnings?.length ? (
                <ul className="list-disc pl-4 text-xs text-amber-600">
                  {state.result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              {selectedExperiment ? (
                <a
                  className="text-xs text-slate-500 underline"
                  href={`/logbook/experiments/${selectedExperiment}`}
                >
                  View experiment
                </a>
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
