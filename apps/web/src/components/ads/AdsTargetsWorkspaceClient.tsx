'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import KpiCards from '@/components/KpiCards';
import AdsWorkspaceStateBar from '@/components/ads/AdsWorkspaceStateBar';
import SpAdGroupsTable from '@/components/ads/SpAdGroupsTable';
import SpCampaignsTable from '@/components/ads/SpCampaignsTable';
import SpChangeComposer from '@/components/ads/SpChangeComposer';
import SpPlacementsTable from '@/components/ads/SpPlacementsTable';
import type { AdsWorkspaceRowActionItem } from '@/components/ads/AdsWorkspaceRowActionsMenu';
import SpSearchTermsTable from '@/components/ads/SpSearchTermsTable';
import SpTargetsTable from '@/components/ads/SpTargetsTable';
import {
  buildAdGroupRowActions,
  buildCampaignRowActions,
  buildPlacementRowActions,
  buildSearchTermRowActions,
  buildTargetRowActions,
  type AdsWorkspaceRowActionDescriptor,
} from '@/lib/ads/adsWorkspaceRowActions';
import { buildAdsWorkspaceNavigationHref } from '@/lib/ads/adsWorkspaceNavigation';
import type {
  SpSearchTermsWorkspaceChildRow,
  SpSearchTermsWorkspaceRow,
} from '@/lib/ads/spSearchTermsWorkspaceModel';
import type {
  SpAdGroupsWorkspaceRow,
  SpCampaignsWorkspaceRow,
  SpPlacementsWorkspaceRow,
} from '@/lib/ads/spWorkspaceTablesModel';
import type { SpTargetsWorkspaceRow } from '@/lib/ads/spTargetsWorkspaceModel';
import type { SaveSpDraftActionState } from '@/lib/ads-workspace/spChangeComposerState';
import type { AdsObjectivePreset, AdsChangeSetItem, JsonObject } from '@/lib/ads-workspace/types';
import {
  type AdsWorkspaceSurfaceSettings,
  type AdsWorkspaceTableSurfaceKey,
  type AdsWorkspaceUiSettings,
  normalizeAdsWorkspaceUiSettings,
} from '@/lib/ads-workspace/adsWorkspaceUiSettings';
import { deriveSpActiveDraftHighlights } from '@/lib/ads-workspace/spActiveDraftHighlights';
import { saveAdsWorkspaceUiSettings } from '@/app/ads/performance/actions';

type SaveSpDraftAction = (
  prevState: SaveSpDraftActionState,
  formData: FormData
) => Promise<SaveSpDraftActionState>;

type KpiItem = {
  label: string;
  value: string;
  subvalue?: string;
};

type ActiveDraftSummary = {
  id: string;
  name: string;
  queueCount: number;
} | null;

type WorkspaceLevel = 'campaigns' | 'adgroups' | 'targets' | 'placements' | 'searchterms';

type SpWorkspaceDisplayRow =
  | SpCampaignsWorkspaceRow
  | SpAdGroupsWorkspaceRow
  | SpTargetsWorkspaceRow
  | SpPlacementsWorkspaceRow
  | SpSearchTermsWorkspaceRow;

type SpWorkspaceComposerRow =
  | SpCampaignsWorkspaceRow
  | SpAdGroupsWorkspaceRow
  | SpTargetsWorkspaceRow
  | SpPlacementsWorkspaceRow
  | SpSearchTermsWorkspaceChildRow;

type AdsTargetsWorkspaceClientProps = {
  level: WorkspaceLevel;
  entityCountLabel: string;
  rows: SpWorkspaceDisplayRow[];
  kpiItems: KpiItem[];
  filtersJson: JsonObject;
  objectivePresets: AdsObjectivePreset[];
  defaultUiSettings: Record<string, unknown> | null;
  initialComposerRow: SpWorkspaceComposerRow | null;
  activeDraft: ActiveDraftSummary;
  activeDraftItems: AdsChangeSetItem[];
  saveDraftAction: SaveSpDraftAction;
  showIds: boolean;
  campaignScopeId?: string | null;
  adGroupScopeId?: string | null;
  campaignScopeLabel?: string | null;
  adGroupScopeLabel?: string | null;
};

export default function AdsTargetsWorkspaceClient(props: AdsTargetsWorkspaceClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRouting, startRouting] = useTransition();
  const [activeDraft, setActiveDraft] = useState<ActiveDraftSummary>(props.activeDraft);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const normalizedDefaultUiSettings = useMemo(
    () => normalizeAdsWorkspaceUiSettings(props.defaultUiSettings),
    [props.defaultUiSettings]
  );
  const [uiSettingsDraft, setUiSettingsDraft] = useState<AdsWorkspaceUiSettings | null>(null);
  const [isSavingUiSettings, startSavingUiSettings] = useTransition();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiSettings = uiSettingsDraft ?? normalizedDefaultUiSettings;
  const activeDraftHighlights = useMemo(
    () => deriveSpActiveDraftHighlights(props.activeDraftItems),
    [props.activeDraftItems]
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const draftBadgeText = activeDraft
    ? `${activeDraft.queueCount.toLocaleString('en-US')} staged item(s)`
    : 'No active draft';
  const composerRow = props.initialComposerRow;

  const syncComposerRouteState = (row: SpWorkspaceComposerRow | null) => {
    startRouting(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');

      if (!row) {
        params.delete('compose_level');
        params.delete('compose_row');
        params.delete('compose_child');
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        return;
      }

      params.set('compose_level', props.level);
      if (props.level === 'campaigns') {
        params.set('compose_row', (row as SpCampaignsWorkspaceRow).campaign_id);
        params.delete('compose_child');
        params.set('trend_entity', (row as SpCampaignsWorkspaceRow).campaign_id);
      } else if (props.level === 'adgroups') {
        params.set('compose_row', (row as SpAdGroupsWorkspaceRow).ad_group_id);
        params.delete('compose_child');
      } else if (props.level === 'targets') {
        params.set('compose_row', (row as SpTargetsWorkspaceRow).target_id);
        params.delete('compose_child');
        params.set('trend_entity', (row as SpTargetsWorkspaceRow).target_id);
      } else if (props.level === 'placements') {
        params.set('compose_row', (row as SpPlacementsWorkspaceRow).id);
        params.delete('compose_child');
      } else {
        params.delete('compose_row');
        params.set('compose_child', (row as SpSearchTermsWorkspaceChildRow).id);
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleSaved = (state: SaveSpDraftActionState) => {
    if (!state.ok || !state.changeSetId || !state.changeSetName) return;
    const nextChangeSetId = state.changeSetId;
    const nextChangeSetName = state.changeSetName;

    setFlashMessage(state.message);
    setActiveDraft({
      id: nextChangeSetId,
      name: nextChangeSetName,
      queueCount: state.queueCount,
    });

    startRouting(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('change_set', nextChangeSetId);
      params.delete('compose_level');
      params.delete('compose_row');
      params.delete('compose_child');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      router.refresh();
    });
  };

  const draftSummary = useMemo(() => {
    if (!activeDraft) {
      return 'Stage a first action from this table to create the draft queue.';
    }
    return `Active draft ${activeDraft.name} with ${activeDraft.queueCount.toLocaleString('en-US')} staged item(s).`;
  }, [activeDraft]);

  const buildRowActionItems = <TRow extends SpWorkspaceComposerRow | SpSearchTermsWorkspaceRow>(
    row: TRow,
    descriptors: AdsWorkspaceRowActionDescriptor[],
    composerRow?: SpWorkspaceComposerRow | null
  ): AdsWorkspaceRowActionItem[] =>
    descriptors.map((descriptor) => {
      if (descriptor.type === 'action') {
        return {
          key: descriptor.key,
          label: descriptor.label,
          onSelect: () => {
            const nextComposerRow = composerRow ?? (row as SpWorkspaceComposerRow);
            if (!nextComposerRow) return;
            setFlashMessage(null);
            syncComposerRouteState(nextComposerRow);
          },
        };
      }

      return {
        key: descriptor.key,
        label: descriptor.label,
        href: buildAdsWorkspaceNavigationHref({
          pathname,
          search: searchParams?.toString() ?? '',
          level: descriptor.level,
          scope: descriptor.scope,
          view: descriptor.view,
          trendEntityId: descriptor.trendEntityId,
        }),
      };
    });

  const updateSurfaceSettings = (
    surfaceKey: AdsWorkspaceTableSurfaceKey,
    settings: AdsWorkspaceSurfaceSettings
  ) => {
    setUiSettingsDraft((current) => {
      const base = current ?? normalizedDefaultUiSettings;
      const next: AdsWorkspaceUiSettings = {
        surfaces: {
          ...base.surfaces,
          [surfaceKey]: settings,
        },
      };

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        startSavingUiSettings(async () => {
          await saveAdsWorkspaceUiSettings(next);
        });
      }, 400);

      return next;
    });
  };

  const currentSurfaceKey = `table:${props.level}` as AdsWorkspaceTableSurfaceKey;
  const currentSurfaceSettings = uiSettings.surfaces[currentSurfaceKey] ?? null;
  const settingsSaveStateLabel = isSavingUiSettings ? 'Saving defaults…' : 'Defaults saved per tab';

  const renderTable = () => {
    if (props.level === 'campaigns') {
      return (
        <SpCampaignsTable
          rows={props.rows as SpCampaignsWorkspaceRow[]}
          getRowActions={(row) => buildRowActionItems(row, buildCampaignRowActions(row), row)}
          activeDraftName={activeDraft?.name ?? null}
          showIds={props.showIds}
          surfaceSettings={currentSurfaceSettings}
          settingsSaveStateLabel={settingsSaveStateLabel}
          onSurfaceSettingsChange={(settings) => updateSurfaceSettings(currentSurfaceKey, settings)}
          rowHighlightTones={activeDraftHighlights.campaigns}
        />
      );
    }
    if (props.level === 'adgroups') {
      return (
        <SpAdGroupsTable
          rows={props.rows as SpAdGroupsWorkspaceRow[]}
          getRowActions={(row) => buildRowActionItems(row, buildAdGroupRowActions(row), row)}
          activeDraftName={activeDraft?.name ?? null}
          showIds={props.showIds}
          surfaceSettings={currentSurfaceSettings}
          settingsSaveStateLabel={settingsSaveStateLabel}
          onSurfaceSettingsChange={(settings) => updateSurfaceSettings(currentSurfaceKey, settings)}
          rowHighlightTones={activeDraftHighlights.adGroups}
        />
      );
    }
    if (props.level === 'placements') {
      return (
        <SpPlacementsTable
          rows={props.rows as SpPlacementsWorkspaceRow[]}
          getRowActions={(row) => buildRowActionItems(row, buildPlacementRowActions(row), row)}
          activeDraftName={activeDraft?.name ?? null}
          showIds={props.showIds}
          surfaceSettings={currentSurfaceSettings}
          settingsSaveStateLabel={settingsSaveStateLabel}
          onSurfaceSettingsChange={(settings) => updateSurfaceSettings(currentSurfaceKey, settings)}
          rowHighlightTones={activeDraftHighlights.placements}
        />
      );
    }
    if (props.level === 'searchterms') {
      return (
        <SpSearchTermsTable
          rows={props.rows as SpSearchTermsWorkspaceRow[]}
          onOpenComposer={(row) => {
            setFlashMessage(null);
            syncComposerRouteState(row);
          }}
          getRowActions={(row) => buildRowActionItems(row, buildSearchTermRowActions(row), null)}
          activeDraftName={activeDraft?.name ?? null}
          showIds={props.showIds}
          surfaceSettings={currentSurfaceSettings}
          settingsSaveStateLabel={settingsSaveStateLabel}
          onSurfaceSettingsChange={(settings) => updateSurfaceSettings(currentSurfaceKey, settings)}
        />
      );
    }
    return (
      <SpTargetsTable
        rows={props.rows as SpTargetsWorkspaceRow[]}
        getRowActions={(row) => buildRowActionItems(row, buildTargetRowActions(row), row)}
        activeDraftName={activeDraft?.name ?? null}
        showIds={props.showIds}
        surfaceSettings={currentSurfaceSettings}
        settingsSaveStateLabel={settingsSaveStateLabel}
        onSurfaceSettingsChange={(settings) => updateSurfaceSettings(currentSurfaceKey, settings)}
        rowHighlightTones={activeDraftHighlights.targets}
      />
    );
  };

  return (
    <section className="space-y-6">
      <KpiCards items={props.kpiItems} />
      <AdsWorkspaceStateBar
        showIds={props.showIds}
        campaignScopeId={props.campaignScopeId}
        adGroupScopeId={props.adGroupScopeId}
        campaignScopeLabel={props.campaignScopeLabel}
        adGroupScopeLabel={props.adGroupScopeLabel}
      />

      <div className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">
              {props.entityCountLabel}
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {props.rows.length.toLocaleString('en-US')} row(s)
            </div>
            <div className="mt-2 max-w-2xl text-sm text-muted">{draftSummary}</div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-left lg:text-right">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Draft queue</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{draftBadgeText}</div>
            <div className="mt-1 text-xs text-muted">
              {activeDraft ? activeDraft.name : 'Created on first composer save'}
            </div>
          </div>
        </div>
      </div>

      {flashMessage ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-800">
          {flashMessage}
        </div>
      ) : null}

      {isRouting ? (
        <div className="rounded-2xl border border-border bg-surface/80 px-5 py-4 text-sm text-muted shadow-sm">
          Refreshing draft queue…
        </div>
      ) : null}

      <div className={composerRow ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]' : ''}>
        <div className="min-w-0">{renderTable()}</div>

        {composerRow ? (
          <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
            <SpChangeComposer
              row={composerRow}
              filtersJson={props.filtersJson}
              activeChangeSetId={activeDraft?.id ?? null}
              activeChangeSetName={activeDraft?.name ?? null}
              objectivePresets={props.objectivePresets}
              action={props.saveDraftAction}
              onClose={() => syncComposerRouteState(null)}
              onSaved={handleSaved}
              mode="docked"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
