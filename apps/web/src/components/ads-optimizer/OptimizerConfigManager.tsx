import type { ReactNode } from 'react';

import type { AdsOptimizerEffectiveVersionContext } from '@/lib/ads-optimizer/effectiveVersion';
import {
  ADS_OPTIMIZER_EDITOR_GUARDRAIL_FIELDS,
  ADS_OPTIMIZER_EDITOR_RECOMMENDATION_FIELDS,
  ADS_OPTIMIZER_EDITOR_ROLE_BIAS_FIELDS,
  ADS_OPTIMIZER_EDITOR_STATE_ENGINE_FIELDS,
  adsOptimizerDraftFieldName,
  readAdsOptimizerDraftEditorValues,
} from '@/lib/ads-optimizer/ruleEditor';
import { ADS_OPTIMIZER_TARGET_ROLES } from '@/lib/ads-optimizer/role';
import type {
  AdsOptimizerArchetype,
  AdsOptimizerProductSettings,
  AdsOptimizerRulePack,
  AdsOptimizerRulePackVersion,
  AdsOptimizerStrategyProfile,
} from '@/lib/ads-optimizer/types';
import { formatUiDateTime as formatDateTime } from '@/lib/time/formatUiDate';

type OptimizerConfigManagerProps = {
  returnTo: string;
  rulePack: AdsOptimizerRulePack | null;
  activeVersion: AdsOptimizerRulePackVersion | null;
  versions: AdsOptimizerRulePackVersion[];
  missingStarterProfiles: AdsOptimizerStrategyProfile[];
  versionStrategyProfiles: Record<string, AdsOptimizerStrategyProfile>;
  seeded: boolean;
  seedMessage: string | null;
  notice: string | null;
  error: string | null;
  selectedProductId: string | null;
  selectedProductAsin: string | null;
  selectedProductLabel: string | null;
  selectedProductTitle: string | null;
  productSettings: AdsOptimizerProductSettings | null;
  effectiveVersionContext: AdsOptimizerEffectiveVersionContext | null;
  createDraftAction: (formData: FormData) => Promise<void>;
  activateVersionAction: (formData: FormData) => Promise<void>;
  saveDraftAction: (formData: FormData) => Promise<void>;
  saveProductSettingsAction: (formData: FormData) => Promise<void>;
  seedStarterVersionsAction: (formData: FormData) => Promise<void>;
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

const fieldInputClass =
  'mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground';

const formatResolutionSource = (value: AdsOptimizerEffectiveVersionContext['resolutionSource']) =>
  value === 'product_assignment' ? 'Product assignment' : 'Account fallback';

const formatFallbackReason = (
  value: AdsOptimizerEffectiveVersionContext['fallbackReason']
) => {
  if (value === 'optimizer_disabled') {
    return 'Product-specific optimizer policy is disabled, so manual runs fall back to the account active version.';
  }
  if (value === 'no_product_settings') {
    return 'No product-specific optimizer settings are saved yet, so manual runs fall back to the account active version.';
  }
  if (value === 'assigned_version_missing') {
    return 'The saved product assignment could not be resolved, so manual runs fall back to the account active version.';
  }
  if (value === 'no_product_row') {
    return 'This ASIN is not mapped to a product row, so manual runs fall back to the account active version.';
  }
  return 'Manual runs use the saved product assignment for this ASIN.';
};

const formatStrategyProfile = (value: string | null | undefined) => {
  if (!value) return 'hybrid';
  return value.replace(/_/g, ' ');
};

const STRATEGY_LIBRARY_ORDER: AdsOptimizerStrategyProfile[] = [
  'hybrid',
  'visibility_led',
  'design_led',
];

const STRATEGY_NOTES: Record<AdsOptimizerArchetype, string> = {
  hybrid:
    'Hybrid stays balanced between profit protection and visibility support, with the active account version as the safe default when no product override is enabled.',
  visibility_led:
    'Visibility-led favors stronger protection for important contributors, more gradual phased recovery, and rank-defense bias when the row is strategically important.',
  design_led:
    'Design-led relaxes forced visibility defense and suppresses weaker long-tail traffic faster when the saved version supports that profile.',
};

const buildStrategyDisplayOrder = (
  preferred: AdsOptimizerArchetype
): AdsOptimizerStrategyProfile[] => [
  preferred,
  ...STRATEGY_LIBRARY_ORDER.filter((profile) => profile !== preferred),
];

const countVersionsByStatus = (
  versions: AdsOptimizerRulePackVersion[],
  status: AdsOptimizerRulePackVersion['status']
) => versions.filter((version) => version.status === status).length;

const renderNumberField = (
  section: string,
  field: {
    key: string;
    label: string;
    description: string;
    step: string;
    min?: string;
    max?: string;
  },
  value: number
) => (
  <label
    key={`${section}-${field.key}`}
    className="flex flex-col rounded-xl border border-border bg-surface px-4 py-3 text-xs uppercase tracking-wide text-muted"
  >
    {field.label}
    <input
      type="number"
      name={adsOptimizerDraftFieldName(section, field.key)}
      defaultValue={String(value)}
      step={field.step}
      min={field.min}
      max={field.max}
      required
      className={fieldInputClass}
    />
    <span className="mt-2 text-[11px] normal-case tracking-normal text-muted">
      {field.description}
    </span>
  </label>
);

const renderCheckboxField = (
  section: string,
  field: {
    key: string;
    label: string;
    description: string;
  },
  checked: boolean
) => (
  <label
    key={`${section}-${field.key}`}
    className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground"
  >
    <input
      type="checkbox"
      name={adsOptimizerDraftFieldName(section, field.key)}
      value="1"
      defaultChecked={checked}
      className="mt-0.5 h-4 w-4 rounded border-border"
    />
    <span>
      <span className="block font-semibold">{field.label}</span>
      <span className="mt-1 block text-xs text-muted">{field.description}</span>
    </span>
  </label>
);

const SectionCard = (props: {
  title: string;
  body: string;
  children: ReactNode;
}) => (
  <div className="rounded-2xl border border-border bg-surface-2/70 p-4">
    <div className="text-xs uppercase tracking-[0.25em] text-muted">{props.title}</div>
    <div className="mt-2 text-sm text-muted">{props.body}</div>
    <div className="mt-4 space-y-3">{props.children}</div>
  </div>
);

export default function OptimizerConfigManager(props: OptimizerConfigManagerProps) {
  const sourceVersionId =
    props.activeVersion?.rule_pack_version_id ?? props.versions[0]?.rule_pack_version_id ?? '';
  const selectedProductVersionId =
    props.productSettings?.rule_pack_version_id ??
    props.activeVersion?.rule_pack_version_id ??
    props.versions[0]?.rule_pack_version_id ??
    '';
  const selectedArchetype = props.productSettings?.archetype ?? 'hybrid';
  const selectedArchetypeDisplay = formatStrategyProfile(selectedArchetype);
  const versionDisplayOrder = buildStrategyDisplayOrder(selectedArchetype);
  const assignedVersion =
    props.versions.find((version) => version.rule_pack_version_id === selectedProductVersionId) ??
    null;
  const assignedVersionStrategyProfile = assignedVersion
    ? props.versionStrategyProfiles[assignedVersion.rule_pack_version_id] ?? 'hybrid'
    : null;
  const assignedVersionProfileDisplay = formatStrategyProfile(assignedVersionStrategyProfile);
  const effectiveVersionProfileDisplay = props.effectiveVersionContext
    ? formatStrategyProfile(props.effectiveVersionContext.strategyProfile)
    : assignedVersionProfileDisplay;
  const strategyMismatch = Boolean(
    assignedVersionStrategyProfile && assignedVersionStrategyProfile !== selectedArchetype
  );
  const matchingVersions = props.versions.filter(
    (version) =>
      (props.versionStrategyProfiles[version.rule_pack_version_id] ?? 'hybrid') === selectedArchetype
  );
  const versionGroups = versionDisplayOrder
    .map((profile) => ({
      profile,
      versions: props.versions.filter(
        (version) => (props.versionStrategyProfiles[version.rule_pack_version_id] ?? 'hybrid') === profile
      ),
    }))
    .filter((group) => group.versions.length > 0);

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
              Versioned rule-pack settings are live for manual runs. Drafts can be tuned here in a
              structured editor, then activated later. Active and archived versions stay immutable;
              edit previous version means clone to draft first, then save the draft.
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
                  {selectedArchetypeDisplay}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">Assigned version</div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {assignedVersion?.version_label ??
                    props.productSettings?.rule_pack_version_id ??
                    '—'}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">
                  Effective runtime version
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {props.effectiveVersionContext?.versionLabel ??
                    props.activeVersion?.version_label ??
                    '—'}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">Product title</div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {props.selectedProductTitle ?? 'Not captured'}
                </div>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">
                  Assigned version profile
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {assignedVersionProfileDisplay}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {assignedVersion
                    ? assignedVersion.change_summary
                    : 'No saved product assignment yet; the active account version remains the fallback.'}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">
                  Effective strategy profile
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {effectiveVersionProfileDisplay}
                </div>
                <div className="mt-1 text-xs text-muted">
                  Runtime persists the exact strategy profile used for manual runs.
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted">
                  Effective fallback behavior
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {props.effectiveVersionContext
                    ? formatResolutionSource(props.effectiveVersionContext.resolutionSource)
                    : 'Account fallback'}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {props.effectiveVersionContext
                    ? formatFallbackReason(props.effectiveVersionContext.fallbackReason)
                    : 'Manual runs fall back to the account active version until a product policy is resolved.'}
                </div>
              </div>
            </div>

            {props.effectiveVersionContext ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  props.effectiveVersionContext.resolutionSource === 'product_assignment'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <div className="font-semibold">
                  {formatResolutionSource(props.effectiveVersionContext.resolutionSource)}:{' '}
                  {props.effectiveVersionContext.versionLabel}
                </div>
                <div className="mt-1">
                  {formatFallbackReason(props.effectiveVersionContext.fallbackReason)}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wide opacity-80">
                  Account active version: {props.effectiveVersionContext.accountActiveVersionLabel}
                  {' · '}
                  strategy profile: {formatStrategyProfile(props.effectiveVersionContext.strategyProfile)}
                </div>
              </div>
            ) : null}

            {strategyMismatch ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                <div className="font-semibold">Strategy mismatch warning</div>
                <div className="mt-1">
                  The selected product archetype is {selectedArchetypeDisplay}, but the assigned
                  version profile is {assignedVersionProfileDisplay}. Manual runs will still use the
                  assigned version when enabled, so this divergence is explicit and auditable.
                </div>
              </div>
            ) : null}

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
                    className={fieldInputClass}
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
                    className={fieldInputClass}
                    required
                  >
                    {versionDisplayOrder.map((profile) => {
                      const profileVersions = props.versions.filter(
                        (version) =>
                          (props.versionStrategyProfiles[version.rule_pack_version_id] ?? 'hybrid') ===
                          profile
                      );
                      if (profileVersions.length === 0) {
                        return null;
                      }

                      return (
                        <optgroup
                          key={`product-settings-${profile}`}
                          label={
                            profile === selectedArchetype
                              ? `Recommended for ${selectedArchetypeDisplay} archetype`
                              : `${formatStrategyProfile(profile)} library`
                          }
                        >
                          {profileVersions.map((version) => (
                            <option
                              key={`product-settings-${version.rule_pack_version_id}`}
                              value={version.rule_pack_version_id}
                            >
                              {version.version_label} ({version.status}) - {version.change_summary}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
                  <div className="font-semibold text-foreground">
                    Recommended library path for {selectedArchetypeDisplay}
                  </div>
                  <div className="mt-1">
                    {matchingVersions.length > 0
                      ? `${matchingVersions.length} saved version(s) already match this archetype and are surfaced first in the selector.`
                      : `No saved version currently matches this archetype. Seed starter drafts, tune one, then assign it here.`}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
                  <div className="font-semibold text-foreground">Strategic notes</div>
                  <div className="mt-1">{STRATEGY_NOTES[selectedArchetype]}</div>
                </div>
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
                  className={fieldInputClass}
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
                <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {formatStrategyProfile(
                    readAdsOptimizerDraftEditorValues(props.activeVersion).strategyProfile
                  )}
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
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Active versions stay immutable. To tune this version, create a new draft from it and
                edit the draft instead of rewriting the active payload in place.
              </div>
              <details className="rounded-xl border border-border bg-surface px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  JSON preview (read-only)
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
              Edit previous version means clone to draft, then edit the draft. Draft creation is
              append-only; existing active and archived version payloads are not edited in place.
            </div>
          {props.rulePack ? (
            <div className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-muted">
                    Starter versions
                  </div>
                  <div className="mt-2 text-sm text-muted">
                    Seed one starter draft for hybrid, visibility_led, and design_led when the
                    library is missing them. Starter drafts clone the current active version first,
                    then stay editable only as drafts.
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-wide text-muted">
                    {props.missingStarterProfiles.length > 0
                      ? `Missing starters: ${props.missingStarterProfiles
                          .map((profile) => formatStrategyProfile(profile))
                          .join(', ')}`
                      : 'Starter drafts already exist for all strategy profiles.'}
                  </div>
                </div>
                <form action={props.seedStarterVersionsAction}>
                  <input type="hidden" name="return_to" value={props.returnTo} />
                  <input type="hidden" name="rule_pack_id" value={props.rulePack.rule_pack_id} />
                  <button
                    type="submit"
                    disabled={props.missingStarterProfiles.length === 0}
                    className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Seed missing starter drafts
                  </button>
                </form>
              </div>
            </div>
          ) : null}
          <form action={props.createDraftAction} className="mt-4 space-y-4">
            <input type="hidden" name="return_to" value={props.returnTo} />
            <input type="hidden" name="rule_pack_id" value={props.rulePack?.rule_pack_id ?? ''} />
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              Source version
              <select
                name="source_version_id"
                defaultValue={sourceVersionId}
                className={fieldInputClass}
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
                className={fieldInputClass}
              />
            </label>
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              What changed
              <textarea
                name="change_summary"
                required
                rows={4}
                placeholder="Describe what this draft is intended to change before you activate it for future manual runs."
                className={fieldInputClass}
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
          Version history is append-only. Drafts can be edited here through the structured rule
          editor. Active and archived versions remain read-only except for activation metadata.
        </div>
        {props.versions.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
            No optimizer config versions exist yet.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {versionGroups.map((group) => (
              <section key={`version-group-${group.profile}`} className="space-y-4">
                <div className="rounded-xl border border-border bg-surface-2 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.25em] text-muted">
                        Strategy profile
                      </div>
                      <div className="mt-1 text-base font-semibold text-foreground">
                        {formatStrategyProfile(group.profile)}
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        {group.profile === selectedArchetype
                          ? `Recommended for the selected product archetype (${selectedArchetypeDisplay}).`
                          : STRATEGY_NOTES[group.profile]}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-muted">
                      <span className="rounded-full border border-border bg-surface px-2.5 py-1">
                        active {countVersionsByStatus(group.versions, 'active')}
                      </span>
                      <span className="rounded-full border border-border bg-surface px-2.5 py-1">
                        draft {countVersionsByStatus(group.versions, 'draft')}
                      </span>
                      <span className="rounded-full border border-border bg-surface px-2.5 py-1">
                        archived {countVersionsByStatus(group.versions, 'archived')}
                      </span>
                    </div>
                  </div>
                </div>

                {group.versions.map((version) => {
                  const editor = readAdsOptimizerDraftEditorValues(version);
                  const isDraft = version.status === 'draft';

                  return (
                    <div
                      key={version.rule_pack_version_id}
                      className="rounded-2xl border border-border bg-surface p-4"
                    >
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
                            <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                              {formatStrategyProfile(editor.strategyProfile)}
                            </span>
                            {selectedArchetype === group.profile ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                                Matches selected archetype
                              </span>
                            ) : null}
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

                      {isDraft ? (
                        <div className="mt-4 space-y-4">
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Structured draft editor. Save the draft payload here, then activate the
                            draft when you want future manual runs to use it.
                          </div>
                          <form action={props.saveDraftAction} className="space-y-4">
                            <input type="hidden" name="return_to" value={props.returnTo} />
                            <input
                              type="hidden"
                              name="rule_pack_version_id"
                              value={version.rule_pack_version_id}
                            />

                            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                                Version label
                                <input
                                  name="version_label"
                                  defaultValue={editor.versionLabel}
                                  required
                                  className={fieldInputClass}
                                />
                              </label>
                              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                                Strategy profile
                                <select
                                  name="strategy_profile"
                                  defaultValue={editor.strategyProfile}
                                  className={fieldInputClass}
                                >
                                  <option value="hybrid">hybrid</option>
                                  <option value="visibility_led">visibility_led</option>
                                  <option value="design_led">design_led</option>
                                </select>
                              </label>
                            </div>

                            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                              Change summary
                              <textarea
                                name="change_summary"
                                rows={3}
                                defaultValue={editor.changeSummary}
                                required
                                className={fieldInputClass}
                              />
                            </label>

                            <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
                              Only drafts can be edited in place. Clone a new draft to edit an active
                              or archived version.
                            </div>

                            <div className="grid gap-4 xl:grid-cols-2">
                              <SectionCard
                                title="State engine thresholds"
                                body="Tune confidence, importance, and risk thresholds that feed deterministic state classification."
                              >
                                <div className="grid gap-3 xl:grid-cols-2">
                                  {ADS_OPTIMIZER_EDITOR_STATE_ENGINE_FIELDS.map((field) =>
                                    renderNumberField(
                                      'state',
                                      field,
                                      editor.stateEngineThresholds[field.key] as number
                                    )
                                  )}
                                </div>
                              </SectionCard>

                          <SectionCard
                            title="Guardrail thresholds"
                            body="Adjust recommendation boundaries without rewriting role transition history."
                          >
                            <div className="grid gap-3 xl:grid-cols-2">
                              {ADS_OPTIMIZER_EDITOR_GUARDRAIL_FIELDS.map((field) =>
                                'step' in field ? (
                                  renderNumberField(
                                    'guardrails',
                                    field,
                                    editor.guardrailThresholds[field.key] as number
                                  )
                                ) : (
                                  <label
                                    key={`guardrails-${field.key}`}
                                    className="flex flex-col rounded-xl border border-border bg-surface px-4 py-3 text-xs uppercase tracking-wide text-muted"
                                  >
                                    {field.label}
                                    <select
                                      name={adsOptimizerDraftFieldName('guardrails', field.key)}
                                      defaultValue={
                                        editor.guardrailThresholds[field.key] as string
                                      }
                                      className={fieldInputClass}
                                    >
                                      {field.options.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                    <span className="mt-2 text-[11px] normal-case tracking-normal text-muted">
                                      {field.description}
                                    </span>
                                  </label>
                                )
                              )}
                            </div>
                          </SectionCard>

                          <SectionCard
                            title="Loss-maker protection policy"
                            body="Control when converting-but-loss-making rows stay protected versus collapse faster."
                          >
                            <div className="grid gap-3 xl:grid-cols-2">
                              {renderNumberField(
                                'loss_maker',
                                {
                                  key: 'protected_ad_sales_share_min',
                                  label: 'Protected ad sales share minimum',
                                  description:
                                    'Ad-sales share threshold for marking a loss-maker as strategically protected.',
                                  step: '0.01',
                                  min: '0',
                                  max: '1',
                                },
                                editor.lossMakerPolicy.protected_ad_sales_share_min
                              )}
                              {renderNumberField(
                                'loss_maker',
                                {
                                  key: 'protected_order_share_min',
                                  label: 'Protected order share minimum',
                                  description:
                                    'Order-share threshold for keeping converting loss-makers inside protected treatment.',
                                  step: '0.01',
                                  min: '0',
                                  max: '1',
                                },
                                editor.lossMakerPolicy.protected_order_share_min
                              )}
                              {renderNumberField(
                                'loss_maker',
                                {
                                  key: 'protected_total_sales_share_min',
                                  label: 'Protected total sales share minimum',
                                  description:
                                    'Share of total product sales that can still justify protected treatment.',
                                  step: '0.01',
                                  min: '0',
                                  max: '1',
                                },
                                editor.lossMakerPolicy.protected_total_sales_share_min
                              )}
                              {renderNumberField(
                                'loss_maker',
                                {
                                  key: 'shallow_loss_ratio_max',
                                  label: 'Shallow loss ratio maximum',
                                  description:
                                    'Upper loss-to-ad-sales ratio for shallow loss classification.',
                                  step: '0.01',
                                  min: '0',
                                },
                                editor.lossMakerPolicy.shallow_loss_ratio_max
                              )}
                              {renderNumberField(
                                'loss_maker',
                                {
                                  key: 'moderate_loss_ratio_max',
                                  label: 'Moderate loss ratio maximum',
                                  description:
                                    'Upper loss-to-ad-sales ratio for moderate loss classification.',
                                  step: '0.01',
                                  min: '0',
                                },
                                editor.lossMakerPolicy.moderate_loss_ratio_max
                              )}
                              {renderNumberField(
                                'loss_maker',
                                {
                                  key: 'severe_loss_ratio_min',
                                  label: 'Severe loss ratio minimum',
                                  description:
                                    'Lower loss-to-ad-sales ratio where severe loss handling begins.',
                                  step: '0.01',
                                  min: '0',
                                },
                                editor.lossMakerPolicy.severe_loss_ratio_min
                              )}
                            </div>
                            {renderCheckboxField(
                              'loss_maker',
                              {
                                key: 'pause_protected_contributors',
                                label: 'Pause protected contributors',
                                description:
                                  'Switch protected converting loss-makers from phased recovery into stronger collapse behavior.',
                              },
                              editor.lossMakerPolicy.pause_protected_contributors
                            )}
                          </SectionCard>

                          <SectionCard
                            title="Phased recovery policy"
                            body="Tune bid-recovery ladder pacing without editing recommendation code."
                          >
                            <div className="grid gap-3 xl:grid-cols-2">
                              {renderNumberField(
                                'phased_recovery',
                                {
                                  key: 'default_steps',
                                  label: 'Default steps',
                                  description:
                                    'Baseline number of recovery steps for protected loss-makers.',
                                  step: '1',
                                  min: '1',
                                },
                                editor.phasedRecoveryPolicy.default_steps
                              )}
                              {renderNumberField(
                                'phased_recovery',
                                {
                                  key: 'important_target_steps',
                                  label: 'Important target steps',
                                  description:
                                    'Recovery steps used when importance or role signals say the row is strategically important.',
                                  step: '1',
                                  min: '1',
                                },
                                editor.phasedRecoveryPolicy.important_target_steps
                              )}
                              {renderNumberField(
                                'phased_recovery',
                                {
                                  key: 'visibility_led_steps',
                                  label: 'Visibility-led steps',
                                  description:
                                    'Recovery steps used when the saved strategy profile is visibility-led.',
                                  step: '1',
                                  min: '1',
                                },
                                editor.phasedRecoveryPolicy.visibility_led_steps
                              )}
                              {renderNumberField(
                                'phased_recovery',
                                {
                                  key: 'design_led_steps',
                                  label: 'Design-led steps',
                                  description:
                                    'Recovery steps used when the saved strategy profile is design-led.',
                                  step: '1',
                                  min: '1',
                                },
                                editor.phasedRecoveryPolicy.design_led_steps
                              )}
                              {renderNumberField(
                                'phased_recovery',
                                {
                                  key: 'max_step_bid_decrease_pct',
                                  label: 'Max step bid decrease %',
                                  description:
                                    'Maximum single-step bid cut while a phased recovery ladder is active.',
                                  step: '1',
                                  min: '0',
                                },
                                editor.phasedRecoveryPolicy.max_step_bid_decrease_pct
                              )}
                            </div>
                            {renderCheckboxField(
                              'phased_recovery',
                              {
                                key: 'continue_until_break_even',
                                label: 'Continue until break-even',
                                description:
                                  'Keep phased recovery ladders open across runs until the estimated break-even bid is reached.',
                              },
                              editor.phasedRecoveryPolicy.continue_until_break_even
                            )}
                          </SectionCard>

                          <SectionCard
                            title="Role bias policy"
                            body="Bias the same deterministic engine toward visibility-first or design-led behavior without changing the target payload."
                          >
                            {ADS_OPTIMIZER_EDITOR_ROLE_BIAS_FIELDS.map((field) =>
                              renderCheckboxField(
                                'role_bias',
                                field,
                                editor.roleBiasPolicy[
                                  field.key as keyof typeof editor.roleBiasPolicy
                                ] as boolean
                              )
                            )}
                          </SectionCard>

                          <SectionCard
                            title="Recommendation thresholds"
                            body="Tune contextual query, portfolio, and spend-direction thresholds that materially change recommendation behavior."
                          >
                            <div className="grid gap-3 xl:grid-cols-2">
                              {ADS_OPTIMIZER_EDITOR_RECOMMENDATION_FIELDS.map((field) =>
                                renderNumberField(
                                  'recommendation',
                                  field,
                                  editor.recommendationThresholds[field.key] as number
                                )
                              )}
                            </div>
                          </SectionCard>

                          <SectionCard
                            title="Role enable toggles"
                            body="Draft-only role switches. Disable a role here if the runtime should fall back instead of using that posture."
                          >
                            <div className="grid gap-3 xl:grid-cols-2">
                              {ADS_OPTIMIZER_TARGET_ROLES.map((role) =>
                                renderCheckboxField(
                                  'role_template',
                                  {
                                    key: role,
                                    label: role,
                                    description:
                                      'Keep this role available to the deterministic role engine for this draft version.',
                                  },
                                  editor.roleTemplates[role].enabled
                                )
                              )}
                            </div>
                          </SectionCard>
                        </div>

                            <div className="flex flex-wrap gap-3">
                              <button
                                type="submit"
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                              >
                                Save draft version
                              </button>
                              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
                                Save persists the draft payload only. Activation remains a separate step.
                              </div>
                            </div>
                          </form>

                          <details className="rounded-xl border border-border bg-surface px-4 py-3">
                            <summary className="cursor-pointer text-sm font-semibold text-foreground">
                              JSON preview (read-only)
                            </summary>
                            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted">
                              {JSON.stringify(version.change_payload_json, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-4">
                          <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
                            Immutable saved version. Clone a new draft to edit an active or archived
                            version; older saved payloads are kept readable and auditable.
                          </div>
                          <details className="rounded-xl border border-border bg-surface px-4 py-3">
                            <summary className="cursor-pointer text-sm font-semibold text-foreground">
                              JSON preview (read-only)
                            </summary>
                            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted">
                              {JSON.stringify(version.change_payload_json, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
