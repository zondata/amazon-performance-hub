import {
  deleteQueueItemAction,
  generateQueueChangeSetAction,
  saveQueueChangeSetMetaAction,
  saveQueueItemAction,
  updateQueueChangeSetStatusAction,
} from '@/app/ads/performance/actions';
import {
  describeSpDraftItem,
  getSpDraftItemFieldSpec,
} from '@/lib/ads-workspace/spDraftReview';
import { readAdsWorkspaceGeneratedArtifact } from '@/lib/ads-workspace/generatedArtifact';
import type {
  AdsChangeSet,
  AdsChangeSetItem,
} from '@/lib/ads-workspace/types';
import type { ExperimentOption } from '@/lib/logbook/getExperimentOptions';
import { formatUiDateTime as formatDateTime } from '@/lib/time/formatUiDate';

type ChangeSetLink = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  href: string;
};

type AdsWorkspaceQueueReviewProps = {
  changeSetLinks: ChangeSetLink[];
  selectedChangeSet: AdsChangeSet | null;
  selectedItems: AdsChangeSetItem[];
  experimentOptions: ExperimentOption[];
  templateStatusLine: string;
  missingOutRoot: boolean;
  spawnDisabled: boolean;
  templateMissing: boolean;
  returnTo: string;
  notice: string | null;
  error: string | null;
};

const formatValue = (value: string | number | null) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  return value;
};

const statusClassName = (status: string) => {
  if (status === 'draft') return 'border-border bg-surface-2 text-foreground';
  if (status === 'review_ready') return 'border-amber-400/40 bg-amber-500/10 text-amber-800';
  if (status === 'generated') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800';
  if (status === 'cancelled') return 'border-rose-500/30 bg-rose-500/10 text-rose-800';
  return 'border-border bg-surface-2 text-foreground';
};

const fileLink = (relativePath: string | null) => {
  if (!relativePath) return null;
  return `/api/files?path=${encodeURIComponent(relativePath)}`;
};

type QueueItemGroup = {
  key: string;
  title: string;
  items: AdsChangeSetItem[];
};

export default function AdsWorkspaceQueueReview(props: AdsWorkspaceQueueReviewProps) {
  const selected = props.selectedChangeSet;
  const editable = selected?.status === 'draft' || selected?.status === 'review_ready';
  const artifact = selected
    ? readAdsWorkspaceGeneratedArtifact(selected.generated_artifact_json)
    : null;
  const groupedItems = props.selectedItems.reduce<QueueItemGroup[]>((groups, item) => {
    const descriptor = describeSpDraftItem(item);
    const existing = groups.find((group) => group.key === descriptor.groupKey);
    if (existing) {
      existing.items.push(item);
      return groups;
    }
    groups.push({
      key: descriptor.groupKey,
      title: descriptor.groupTitle,
      items: [item],
    });
    return groups;
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Queue review</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              Review staged SP drafts and generate bulk output
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              Generation is the freeze boundary. Draft items remain staged-only until the SP bulksheet is generated with logbook logging enabled.
            </div>
          </div>
        </div>
      </div>

      {props.notice ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-800">
          {props.notice}
        </div>
      ) : null}

      {props.error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-800">
          {props.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.2em] text-muted">Change sets</div>
          {props.changeSetLinks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
              No Ads Workspace drafts exist yet. Stage changes from the Targets tab first.
            </div>
          ) : (
            props.changeSetLinks.map((changeSet) => {
              const active = selected?.id === changeSet.id;
              return (
                <a
                  key={changeSet.id}
                  href={changeSet.href}
                  className={`block rounded-xl border px-4 py-3 transition ${
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-surface-2 hover:bg-surface-2/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 text-sm font-semibold text-foreground">{changeSet.name}</div>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusClassName(changeSet.status)}`}
                    >
                      {changeSet.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted">Updated {formatDateTime(changeSet.updatedAt)}</div>
                </a>
              );
            })
          )}
        </aside>

        <div className="space-y-6">
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/80 px-5 py-10 text-sm text-muted shadow-sm">
              Select a change set to review queued draft items.
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusClassName(selected.status)}`}
                      >
                        {selected.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-muted">
                      {props.selectedItems.length.toLocaleString('en-US')} staged item(s) · Updated {formatDateTime(selected.updated_at)}
                    </div>
                  </div>
                </div>

                <form action={saveQueueChangeSetMetaAction} className="mt-5 grid gap-4 md:grid-cols-2">
                  <input type="hidden" name="return_to" value={props.returnTo} />
                  <input type="hidden" name="change_set_id" value={selected.id} />
                  <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
                    <span className="text-xs uppercase tracking-[0.16em]">Change set name</span>
                    <input
                      name="change_set_name"
                      defaultValue={selected.name}
                      className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                      disabled={!editable}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-muted">
                    <span className="text-xs uppercase tracking-[0.16em]">Experiment link</span>
                    <select
                      name="experiment_id"
                      defaultValue={selected.experiment_id ?? ''}
                      className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                      disabled={!editable}
                    >
                      <option value="">No experiment</option>
                      {props.experimentOptions.map((option) => (
                        <option key={option.experiment_id} value={option.experiment_id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-muted">
                    <span className="text-xs uppercase tracking-[0.16em]">Change set notes</span>
                    <textarea
                      name="change_set_notes"
                      defaultValue={selected.notes ?? ''}
                      className="min-h-[88px] rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                      disabled={!editable}
                    />
                  </label>
                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={!editable}
                      className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                    >
                      Save details
                    </button>
                  </div>
                </form>

                <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5">
                  {selected.status === 'draft' ? (
                    <form action={updateQueueChangeSetStatusAction}>
                      <input type="hidden" name="return_to" value={props.returnTo} />
                      <input type="hidden" name="change_set_id" value={selected.id} />
                      <input type="hidden" name="target_status" value="review_ready" />
                      <button
                        type="submit"
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                      >
                        Mark Review Ready
                      </button>
                    </form>
                  ) : null}

                  {selected.status === 'review_ready' ? (
                    <>
                      <form action={updateQueueChangeSetStatusAction}>
                        <input type="hidden" name="return_to" value={props.returnTo} />
                        <input type="hidden" name="change_set_id" value={selected.id} />
                        <input type="hidden" name="target_status" value="draft" />
                        <button
                          type="submit"
                          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground"
                        >
                          Return To Draft
                        </button>
                      </form>
                      <form action={updateQueueChangeSetStatusAction}>
                        <input type="hidden" name="return_to" value={props.returnTo} />
                        <input type="hidden" name="change_set_id" value={selected.id} />
                        <input type="hidden" name="target_status" value="cancelled" />
                        <button
                          type="submit"
                          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-800"
                        >
                          Cancel Change Set
                        </button>
                      </form>
                    </>
                  ) : null}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted">Queued items</div>
                    <div className="mt-1 text-sm text-foreground">
                      Review full identity chain plus before/after values before generation.
                    </div>
                  </div>
                </div>

                {props.selectedItems.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
                    This change set has no queued items.
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {groupedItems.map((group) => (
                      <section key={group.key} className="rounded-2xl border border-border bg-surface-2/40">
                        <div className="border-b border-border px-4 py-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-muted">Campaign context</div>
                          <div className="mt-1 text-sm font-semibold text-foreground">{group.title}</div>
                          <div className="mt-1 text-xs text-muted">
                            {group.items.length.toLocaleString('en-US')} atomic queued item(s)
                          </div>
                        </div>
                        <div className="space-y-4 p-4">
                          {group.items.map((item) => {
                            const fieldSpec = getSpDraftItemFieldSpec(item);
                            const descriptor = describeSpDraftItem(item);
                            const itemEditable =
                              selected.status === 'draft' || selected.status === 'review_ready';
                            const uiContext = item.ui_context_json ?? {};
                            return (
                              <details key={item.id} className="rounded-xl border border-border bg-surface/80">
                                <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-foreground">{descriptor.title}</div>
                                    <div className="mt-1 text-xs text-muted">
                                      {item.action_type} · {descriptor.subtitle || item.entity_level}
                                    </div>
                                    {descriptor.secondaryIds ? (
                                      <div className="mt-1 text-[11px] text-muted">{descriptor.secondaryIds}</div>
                                    ) : null}
                                  </div>
                                  <div className="text-right text-sm text-foreground">
                                    <div>
                                      {fieldSpec.label}: {formatValue(fieldSpec.beforeValue)} →{' '}
                                      {formatValue(fieldSpec.afterValue)}
                                    </div>
                                    <div className="mt-1 text-xs text-muted">
                                      Created {formatDateTime(item.created_at)}
                                    </div>
                                  </div>
                                </summary>

                                <div className="border-t border-border px-4 py-4">
                                  <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-xl border border-border bg-surface px-3 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Campaign</div>
                                      <div className="mt-1 text-sm font-medium text-foreground">
                                        {typeof uiContext.campaign_name === 'string' && uiContext.campaign_name
                                          ? uiContext.campaign_name
                                          : item.campaign_id ?? '—'}
                                      </div>
                                      {item.campaign_id ? (
                                        <div className="mt-1 text-[11px] text-muted">{item.campaign_id}</div>
                                      ) : null}
                                    </div>
                                    <div className="rounded-xl border border-border bg-surface px-3 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Ad group</div>
                                      <div className="mt-1 text-sm font-medium text-foreground">
                                        {typeof uiContext.ad_group_name === 'string' && uiContext.ad_group_name
                                          ? uiContext.ad_group_name
                                          : item.ad_group_id ?? '—'}
                                      </div>
                                      {item.ad_group_id ? (
                                        <div className="mt-1 text-[11px] text-muted">{item.ad_group_id}</div>
                                      ) : null}
                                    </div>
                                    <div className="rounded-xl border border-border bg-surface px-3 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Target</div>
                                      <div className="mt-1 text-sm font-medium text-foreground">
                                        {typeof uiContext.target_text === 'string' && uiContext.target_text
                                          ? uiContext.target_text
                                          : item.target_id ?? '—'}
                                      </div>
                                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted">
                                        {typeof uiContext.match_type === 'string' && uiContext.match_type ? (
                                          <span>{uiContext.match_type}</span>
                                        ) : null}
                                        {item.target_id ? <span>{item.target_id}</span> : null}
                                      </div>
                                    </div>
                                    <div className="rounded-xl border border-border bg-surface px-3 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Placement</div>
                                      <div className="mt-1 text-sm font-medium text-foreground">
                                        {typeof uiContext.placement_label === 'string' && uiContext.placement_label
                                          ? uiContext.placement_label
                                          : item.placement_code ?? '—'}
                                      </div>
                                      {item.placement_code ? (
                                        <div className="mt-1 text-[11px] text-muted">{item.placement_code}</div>
                                      ) : null}
                                    </div>
                                  </div>

                                  <form action={saveQueueItemAction} className="grid gap-4 md:grid-cols-2">
                                    <input type="hidden" name="return_to" value={props.returnTo} />
                                    <input type="hidden" name="item_id" value={item.id} />
                                    <label className="flex flex-col gap-1 text-sm text-muted">
                                      <span className="text-xs uppercase tracking-[0.16em]">{fieldSpec.label}</span>
                                      {fieldSpec.inputType === 'state' ? (
                                        <select
                                          name="next_value"
                                          defaultValue={String(fieldSpec.afterValue ?? '')}
                                          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                                          disabled={!itemEditable}
                                        >
                                          <option value="enabled">enabled</option>
                                          <option value="paused">paused</option>
                                          <option value="archived">archived</option>
                                        </select>
                                      ) : (
                                        <input
                                          type={fieldSpec.inputType === 'number' ? 'number' : 'text'}
                                          step={fieldSpec.inputType === 'number' ? '0.01' : undefined}
                                          min={fieldSpec.inputType === 'number' ? '0' : undefined}
                                          name="next_value"
                                          defaultValue={String(fieldSpec.afterValue ?? '')}
                                          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                                          disabled={!itemEditable}
                                        />
                                      )}
                                      <span className="text-xs text-muted">
                                        Before value {formatValue(fieldSpec.beforeValue)}
                                      </span>
                                    </label>
                                    <label className="flex flex-col gap-1 text-sm text-muted">
                                      <span className="text-xs uppercase tracking-[0.16em]">Objective</span>
                                      <textarea
                                        name="objective"
                                        defaultValue={item.objective ?? ''}
                                        className="min-h-[88px] rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                                        disabled={!itemEditable}
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1 text-sm text-muted">
                                      <span className="text-xs uppercase tracking-[0.16em]">Hypothesis</span>
                                      <textarea
                                        name="hypothesis"
                                        defaultValue={item.hypothesis ?? ''}
                                        className="min-h-[88px] rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                                        disabled={!itemEditable}
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1 text-sm text-muted">
                                      <span className="text-xs uppercase tracking-[0.16em]">Forecast summary</span>
                                      <textarea
                                        name="forecast_summary"
                                        defaultValue={
                                          typeof item.forecast_json?.summary === 'string'
                                            ? item.forecast_json.summary
                                            : ''
                                        }
                                        className="min-h-[88px] rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                                        disabled={!itemEditable}
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1 text-sm text-muted">
                                      <span className="text-xs uppercase tracking-[0.16em]">
                                        Forecast window days
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        name="forecast_window_days"
                                        defaultValue={
                                          typeof item.forecast_json?.window_days === 'number'
                                            ? String(item.forecast_json.window_days)
                                            : ''
                                        }
                                        className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                                        disabled={!itemEditable}
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1 text-sm text-muted">
                                      <span className="text-xs uppercase tracking-[0.16em]">Review after days</span>
                                      <input
                                        type="number"
                                        min="0"
                                        name="review_after_days"
                                        defaultValue={
                                          item.review_after_days === null
                                            ? ''
                                            : String(item.review_after_days)
                                        }
                                        className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                                        disabled={!itemEditable}
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
                                      <span className="text-xs uppercase tracking-[0.16em]">Notes</span>
                                      <textarea
                                        name="notes"
                                        defaultValue={item.notes ?? ''}
                                        className="min-h-[88px] rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                                        disabled={!itemEditable}
                                      />
                                    </label>

                                    {itemEditable ? (
                                      <div className="md:col-span-2 flex flex-wrap gap-3">
                                        <button
                                          type="submit"
                                          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground"
                                        >
                                          Save Item
                                        </button>
                                      </div>
                                    ) : null}
                                  </form>

                                  {itemEditable ? (
                                    <form action={deleteQueueItemAction} className="mt-3">
                                      <input type="hidden" name="return_to" value={props.returnTo} />
                                      <input type="hidden" name="item_id" value={item.id} />
                                      <button
                                        type="submit"
                                        className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-800"
                                      >
                                        Remove Item
                                      </button>
                                    </form>
                                  ) : null}
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.2em] text-muted">Generation</div>
                <div className="mt-1 text-sm text-foreground">
                  Use the existing SP generator stack. Successful generation freezes logbook facts exactly once.
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border bg-surface-2 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Template</div>
                    <div className="mt-1 text-sm text-foreground">{props.templateStatusLine}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-2 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Output root</div>
                    <div className="mt-1 text-sm text-foreground">{props.missingOutRoot ? 'Missing BULKGEN_OUT_ROOT' : 'Configured'}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-2 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Spawn</div>
                    <div className="mt-1 text-sm text-foreground">{props.spawnDisabled ? 'ENABLE_BULKGEN_SPAWN=1 required' : 'Enabled'}</div>
                  </div>
                </div>

                {props.templateMissing ? (
                  <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                    SP Update template is missing. Upload it in Bulksheet Ops → Templates before generating.
                  </div>
                ) : null}

                {selected.status === 'review_ready' ? (
                  <form action={generateQueueChangeSetAction} className="mt-4">
                    <input type="hidden" name="return_to" value={props.returnTo} />
                    <input type="hidden" name="change_set_id" value={selected.id} />
                    <button
                      type="submit"
                      disabled={props.templateMissing || props.missingOutRoot || props.spawnDisabled}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      Generate SP Bulksheet And Freeze To Logbook
                    </button>
                  </form>
                ) : null}

                {artifact ? (
                  <div className="mt-5 space-y-3 rounded-xl border border-border bg-surface-2 p-4">
                    <div className="text-sm font-semibold text-foreground">Generated artifact</div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Generated at</div>
                        <div className="mt-1 text-sm text-foreground">{artifact.generatedAt ? formatDateTime(artifact.generatedAt) : '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Action count</div>
                        <div className="mt-1 text-sm text-foreground">{artifact.actionCount ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Log created</div>
                        <div className="mt-1 text-sm text-foreground">{artifact.logCreated ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Log skipped</div>
                        <div className="mt-1 text-sm text-foreground">{artifact.logSkipped ?? '—'}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 pt-2">
                      {fileLink(artifact.reviewPath) ? (
                        <a
                          href={fileLink(artifact.reviewPath) ?? undefined}
                          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground"
                        >
                          Download review.xlsx
                        </a>
                      ) : null}
                      {fileLink(artifact.uploadPath) ? (
                        <a
                          href={fileLink(artifact.uploadPath) ?? undefined}
                          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground"
                        >
                          Download upload_strict.xlsx
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
