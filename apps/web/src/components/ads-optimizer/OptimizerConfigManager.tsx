import type {
  AdsOptimizerProductSettings,
  AdsOptimizerRulePack,
  AdsOptimizerRulePackVersion,
} from '@/lib/ads-optimizer/types';
import { formatUiDateTime as formatDateTime } from '@/lib/time/formatUiDate';

type OptimizerConfigManagerProps = {
  returnTo: string;
  rulePack: AdsOptimizerRulePack | null;
  activeVersion: AdsOptimizerRulePackVersion | null;
  versions: AdsOptimizerRulePackVersion[];
  seeded: boolean;
  seedMessage: string | null;
  notice: string | null;
  error: string | null;
  selectedProductId: string | null;
  selectedProductAsin: string | null;
  selectedProductLabel: string | null;
  selectedProductTitle: string | null;
  productSettings: AdsOptimizerProductSettings | null;
  createDraftAction: (formData: FormData) => Promise<void>;
  activateVersionAction: (formData: FormData) => Promise<void>;
  saveProductSettingsAction: (formData: FormData) => Promise<void>;
};

const statusBadgeClass = (status: AdsOptimizerRulePackVersion['status']) => {
  if (status === 'active') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
  if (status === 'draft') {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }
  return 'bg-surface-2 text-muted border-border';
};

export default function OptimizerConfigManager(props: OptimizerConfigManagerProps) {
  const sourceVersionId = props.activeVersion?.rule_pack_version_id ?? props.versions[0]?.rule_pack_version_id ?? '';
  const selectedProductVersionId =
    props.productSettings?.rule_pack_version_id ??
    props.activeVersion?.rule_pack_version_id ??
    props.versions[0]?.rule_pack_version_id ??
    '';
  const selectedArchetype = props.productSettings?.archetype ?? 'hybrid';

  return (
    <div className="space-y-6">
      {props.seeded && props.seedMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          {props.seedMessage}
        </div>
      ) : null}
      {props.notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          {props.notice}
        </div>
      ) : null}
      {props.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          {props.error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Config boundary</div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              Configuration exists separately from execution
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              No optimizer engine, scoring, target state machine, or draft handoff is running in
              Phase 2. This screen only manages versioned SP configuration history.
            </div>
          </div>
          <div className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
            SP only V1
          </div>
        </div>
      </section>

      {props.rulePack ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted">Rule pack</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{props.rulePack.name}</div>
              <div className="mt-2 max-w-3xl text-sm text-muted">
                {props.rulePack.description ?? 'No description set.'}
              </div>
            </div>
            <div className="grid gap-3 text-sm text-muted sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">Scope</div>
                <div className="mt-1 font-medium text-foreground">
                  {props.rulePack.scope_type === 'account'
                    ? `${props.rulePack.account_id} · ${props.rulePack.marketplace}`
                    : props.rulePack.scope_value ?? '—'}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">Channel</div>
                <div className="mt-1 font-medium uppercase text-foreground">{props.rulePack.channel}</div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
            No optimizer rule pack exists yet for this account/marketplace.
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Product settings</div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              Strategy profile for the selected ASIN
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              Use the current product settings surface to save archetype on one selected ASIN.
              Hybrid stays the neutral default; visibility-led and design-led now materially shift
              objective, role, protection, phased-loss, and pause behavior inside the shared
              optimizer backbone.
            </div>
          </div>
          <div className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {props.selectedProductAsin ?? 'Select one ASIN'}
          </div>
        </div>

        {!props.selectedProductAsin ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
            Select one ASIN above to save optimizer product settings. Hybrid remains the default
            when no product-specific archetype has been saved.
          </div>
        ) : !props.selectedProductId ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
            The selected ASIN is not mapped to a product row in this account/marketplace, so
            optimizer product settings cannot be saved yet.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">Selected ASIN</div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {props.selectedProductLabel ?? props.selectedProductAsin}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">Product row</div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {props.selectedProductId}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">Current archetype</div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {props.productSettings?.archetype ?? 'hybrid'}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">Product title</div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {props.selectedProductTitle ?? 'Not captured'}
                </div>
              </div>
            </div>

            <form action={props.saveProductSettingsAction} className="space-y-4">
              <input type="hidden" name="return_to" value={props.returnTo} />
              <input type="hidden" name="product_id" value={props.selectedProductId} />
              <input type="hidden" name="product_asin" value={props.selectedProductAsin} />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                  Archetype
                  <select
                    name="archetype"
                    defaultValue={selectedArchetype}
                    className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  >
                    <option value="hybrid">
                      hybrid - neutral baseline across profit and visibility
                    </option>
                    <option value="visibility_led">
                      visibility_led - stronger protection and rank defense
                    </option>
                    <option value="design_led">
                      design_led - faster suppression of weaker long-tail traffic
                    </option>
                  </select>
                </label>
                <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                  Rule-pack version
                  <select
                    name="rule_pack_version_id"
                    defaultValue={selectedProductVersionId}
                    className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                    required
                  >
                    {props.versions.map((version) => (
                      <option
                        key={`product-settings-${version.rule_pack_version_id}`}
                        value={version.rule_pack_version_id}
                      >
                        {version.version_label} ({version.status})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="optimizer_enabled"
                  value="1"
                  defaultChecked={props.productSettings?.optimizer_enabled ?? true}
                  className="h-4 w-4 rounded border-border"
                />
                Enable optimizer policy for this selected ASIN
              </label>

              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Strategic notes
                <textarea
                  name="strategic_notes"
                  rows={3}
                  defaultValue={props.productSettings?.strategic_notes ?? ''}
                  placeholder="Optional operator notes about why this ASIN should lean profit-first, visibility-first, or stay hybrid."
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
              </label>

              <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
                Visibility-led protects important targets more strongly, prefers Rank Defend when
                justified, and keeps phased loss recovery more gradual. Design-led relaxes forced
                visibility defense and suppresses weaker long-tail rows more aggressively.
              </div>

              <button
                type="submit"
                disabled={props.versions.length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save product settings
              </button>
            </form>
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Active version</div>
          {props.activeVersion ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-lg font-semibold text-foreground">
                  {props.activeVersion.version_label}
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(
                    props.activeVersion.status
                  )}`}
                >
                  {props.activeVersion.status}
                </span>
              </div>
              <div className="text-sm text-muted">{props.activeVersion.change_summary}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted">Created</div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {formatDateTime(props.activeVersion.created_at)}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted">Activated</div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {formatDateTime(props.activeVersion.activated_at)}
                  </div>
                </div>
              </div>
              <details className="rounded-xl border border-border bg-surface px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  Payload preview
                </summary>
                <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted">
                  {JSON.stringify(props.activeVersion.change_payload_json, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
              No active optimizer version is set yet.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Create draft</div>
          <div className="mt-2 text-sm text-muted">
            Draft creation is append-only. The selected source version is copied into a new draft;
            existing version payloads are not edited in place.
          </div>
          <form action={props.createDraftAction} className="mt-4 space-y-4">
            <input type="hidden" name="return_to" value={props.returnTo} />
            <input type="hidden" name="rule_pack_id" value={props.rulePack?.rule_pack_id ?? ''} />
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              Source version
              <select
                name="source_version_id"
                defaultValue={sourceVersionId}
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                required
              >
                {props.versions.map((version) => (
                  <option key={version.rule_pack_version_id} value={version.rule_pack_version_id}>
                    {version.version_label} ({version.status})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              New version label
              <input
                name="version_label"
                required
                placeholder="sp_v1_tune_2026_03_10"
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              What changed
              <textarea
                name="change_summary"
                required
                rows={4}
                placeholder="Describe what this draft is intended to change. Runtime logic is not active yet."
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
            <button
              type="submit"
              disabled={!props.rulePack || props.versions.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create draft version
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Version history</div>
        <div className="mt-2 text-sm text-muted">
          Version history is append-only. Activation switches which saved version is current; it
          does not rewrite the saved payload for older versions.
        </div>
        {props.versions.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
            No optimizer config versions exist yet.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {props.versions.map((version) => (
              <div key={version.rule_pack_version_id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-base font-semibold text-foreground">
                        {version.version_label}
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(
                          version.status
                        )}`}
                      >
                        {version.status}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-muted">{version.change_summary}</div>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                      <span>Created {formatDateTime(version.created_at)}</span>
                      <span>Activated {formatDateTime(version.activated_at)}</span>
                      <span>Archived {formatDateTime(version.archived_at)}</span>
                      <span>From {version.created_from_version_id ?? 'seed'}</span>
                    </div>
                  </div>
                  {version.status !== 'active' ? (
                    <form action={props.activateVersionAction}>
                      <input type="hidden" name="return_to" value={props.returnTo} />
                      <input
                        type="hidden"
                        name="rule_pack_version_id"
                        value={version.rule_pack_version_id}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
                      >
                        Activate version
                      </button>
                    </form>
                  ) : (
                    <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                      Active now
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
