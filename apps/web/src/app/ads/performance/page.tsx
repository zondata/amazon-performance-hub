import AdsTargetsWorkspaceClient from '@/components/ads/AdsTargetsWorkspaceClient';
import AdsWorkspaceTrendClient from '@/components/ads/AdsWorkspaceTrendClient';
import AdsWorkspaceQueueReview from '@/components/ads/AdsWorkspaceQueueReview';
import Tabs from '@/components/Tabs';
import { saveSpDraftAction } from '@/app/ads/performance/actions';
import { getSpWorkspaceData } from '@/lib/ads/getSpWorkspaceData';
import { getSpWorkspaceTrendData } from '@/lib/ads/getSpWorkspaceTrendData';
import { ADS_WORKSPACE_UI_PAGE_KEY } from '@/lib/ads-workspace/adsWorkspaceUiSettings';
import { listChangeSetItems } from '@/lib/ads-workspace/repoChangeSetItems';
import { getChangeSet, listChangeSets } from '@/lib/ads-workspace/repoChangeSets';
import { listObjectivePresets } from '@/lib/ads-workspace/repoObjectivePresets';
import { getTemplateStatus } from '@/lib/bulksheets/templateStore';
import { env } from '@/lib/env';
import { getExperimentOptions } from '@/lib/logbook/getExperimentOptions';
import { fetchAsinOptions } from '@/lib/products/fetchAsinOptions';
import { getDefaultMarketplaceDateRange } from '@/lib/time/defaultDateRange';
import { formatUiDateRange, formatUiDateTime } from '@/lib/time/formatUiDate';
import { getPageSettings } from '@/lib/uiSettings/getPageSettings';
import type { SpSearchTermsWorkspaceChildRow } from '@/lib/ads/spSearchTermsWorkspaceModel';
import type {
  SpAdGroupsWorkspaceRow,
  SpCampaignsWorkspaceRow,
  SpPlacementsWorkspaceRow,
} from '@/lib/ads/spWorkspaceTablesModel';
import type { SpTargetsWorkspaceRow } from '@/lib/ads/spTargetsWorkspaceModel';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (!DATE_RE.test(value)) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
};

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
};

const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

type AdsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type WorkspaceLevel = 'campaigns' | 'adgroups' | 'targets' | 'placements' | 'searchterms';
type InitialComposerRow =
  | SpCampaignsWorkspaceRow
  | SpAdGroupsWorkspaceRow
  | SpTargetsWorkspaceRow
  | SpPlacementsWorkspaceRow
  | SpSearchTermsWorkspaceChildRow;

const buildHref = (params: {
  start: string;
  end: string;
  asin: string;
  channel: string;
  level: string;
  view: string;
  panel?: string | null;
  changeSetId?: string | null;
  trendEntity?: string | null;
  showIds?: boolean;
  campaignScopeId?: string | null;
  campaignScopeLabel?: string | null;
  adGroupScopeId?: string | null;
  adGroupScopeLabel?: string | null;
  composeLevel?: string | null;
  composeRowId?: string | null;
  composeChildId?: string | null;
}) => {
  const usp = new URLSearchParams({
    start: params.start,
    end: params.end,
    asin: params.asin,
    channel: params.channel,
    level: params.level,
    view: params.view,
  });
  if (params.panel && params.panel !== 'workspace') {
    usp.set('panel', params.panel);
  }
  if (params.changeSetId) {
    usp.set('change_set', params.changeSetId);
  }
  if (params.trendEntity) {
    usp.set('trend_entity', params.trendEntity);
  }
  if (params.showIds) {
    usp.set('show_ids', '1');
  }
  if (params.campaignScopeId) {
    usp.set('campaign_scope', params.campaignScopeId);
  }
  if (params.campaignScopeLabel) {
    usp.set('campaign_scope_name', params.campaignScopeLabel);
  }
  if (params.adGroupScopeId) {
    usp.set('ad_group_scope', params.adGroupScopeId);
  }
  if (params.adGroupScopeLabel) {
    usp.set('ad_group_scope_name', params.adGroupScopeLabel);
  }
  if (params.composeLevel) {
    usp.set('compose_level', params.composeLevel);
  }
  if (params.composeRowId) {
    usp.set('compose_row', params.composeRowId);
  }
  if (params.composeChildId) {
    usp.set('compose_child', params.composeChildId);
  }
  return `/ads/performance?${usp.toString()}`;
};

const resolveInitialComposerRow = (params: {
  level: WorkspaceLevel;
  rows: unknown[];
  composeLevel: string | null;
  composeRowId: string | null;
  composeChildId: string | null;
}): InitialComposerRow | null => {
  if (params.composeLevel !== params.level) return null;

  if (params.level === 'campaigns' && params.composeRowId) {
    return (
      ((params.rows as SpCampaignsWorkspaceRow[]).find(
        (row) => row.campaign_id === params.composeRowId
      ) ?? null)
    );
  }

  if (params.level === 'adgroups' && params.composeRowId) {
    return (
      ((params.rows as SpAdGroupsWorkspaceRow[]).find(
        (row) => row.ad_group_id === params.composeRowId
      ) ?? null)
    );
  }

  if (params.level === 'targets' && params.composeRowId) {
    return (
      ((params.rows as SpTargetsWorkspaceRow[]).find(
        (row) => row.target_id === params.composeRowId
      ) ?? null)
    );
  }

  if (params.level === 'placements' && params.composeRowId) {
    return (
      ((params.rows as SpPlacementsWorkspaceRow[]).find(
        (row) => row.id === params.composeRowId
      ) ?? null)
    );
  }

  if (params.level !== 'searchterms' || !params.composeChildId) {
    return null;
  }

  for (const row of params.rows as Array<{ child_rows: SpSearchTermsWorkspaceChildRow[] }>) {
    const child = row.child_rows.find((entry) => entry.id === params.composeChildId) ?? null;
    if (child) return child;
  }

  return null;
};

export default async function AdsPerformancePage({ searchParams }: AdsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const paramValue = (key: string): string | undefined => {
    const value = params?.[key];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  };

  const defaults = getDefaultMarketplaceDateRange({
    marketplace: env.marketplace,
    daysBack: 31,
    delayDays: 0,
  });
  let start = normalizeDate(paramValue('start')) ?? defaults.start;
  let end = normalizeDate(paramValue('end')) ?? defaults.end;
  const asin = paramValue('asin') ?? 'all';
  const requestedChannel = (paramValue('channel') ?? 'sp').toLowerCase();
  const requestedLevel = (paramValue('level') ?? 'targets').toLowerCase();
  const requestedView = (paramValue('view') ?? 'table').toLowerCase();
  const requestedPanel = (paramValue('panel') ?? 'workspace').toLowerCase();
  const activeChangeSetId = paramValue('change_set') ?? null;
  const trendEntity = paramValue('trend_entity') ?? null;
  const showIds = paramValue('show_ids') === '1';
  const campaignScopeId = paramValue('campaign_scope') ?? null;
  const campaignScopeLabel = paramValue('campaign_scope_name') ?? null;
  const adGroupScopeId = paramValue('ad_group_scope') ?? null;
  const adGroupScopeLabel = paramValue('ad_group_scope_name') ?? null;
  const composeLevel = paramValue('compose_level') ?? null;
  const composeRowId = paramValue('compose_row') ?? null;
  const composeChildId = paramValue('compose_child') ?? null;
  const queueNotice = paramValue('queue_notice') ?? null;
  const queueError = paramValue('queue_error') ?? null;

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const channelValue = 'sp';
  const levelValue =
    requestedLevel === 'campaigns' ||
    requestedLevel === 'adgroups' ||
    requestedLevel === 'targets' ||
    requestedLevel === 'placements' ||
    requestedLevel === 'searchterms'
      ? requestedLevel
      : 'targets';
  const viewValue = requestedView === 'trend' ? 'trend' : 'table';
  const panelValue = requestedPanel === 'queue' ? 'queue' : 'workspace';
  const shouldLoadWorkspaceData =
    panelValue === 'workspace' &&
    (levelValue === 'campaigns' ||
      levelValue === 'adgroups' ||
      levelValue === 'targets' ||
      levelValue === 'placements' ||
      levelValue === 'searchterms');
  const shouldLoadTable = shouldLoadWorkspaceData && viewValue === 'table';
  const shouldLoadTrend =
    shouldLoadWorkspaceData && viewValue === 'trend' && (levelValue === 'campaigns' || levelValue === 'targets');

  const trendBundle = shouldLoadTrend
    ? await getSpWorkspaceTrendData({
        accountId: env.accountId,
        marketplace: env.marketplace,
        start,
        end,
        asinFilter: asin,
        level: levelValue,
        selectedEntityId: trendEntity,
        campaignScopeId,
        adGroupScopeId,
      })
    : null;
  const workspaceData =
    trendBundle?.workspaceData ??
    (shouldLoadTable
      ? await getSpWorkspaceData({
          accountId: env.accountId,
          marketplace: env.marketplace,
          start,
          end,
          asinFilter: asin,
          level: levelValue,
          campaignScopeId,
          adGroupScopeId,
        })
      : null);
  const trendData = trendBundle?.trendData ?? null;
  const asinOptions =
    workspaceData?.asinOptions ??
    (await fetchAsinOptions(env.accountId, env.marketplace));
  const [spObjectivePresets, globalObjectivePresets] = shouldLoadWorkspaceData
    ? await Promise.all([
        listObjectivePresets({ channel: 'sp' }),
        listObjectivePresets({ channel: null }),
      ])
    : [[], []];
  const defaultUiSettings = panelValue === 'workspace'
    ? await getPageSettings({
        accountId: env.accountId,
        marketplace: env.marketplace,
        pageKey: ADS_WORKSPACE_UI_PAGE_KEY,
      })
    : null;
  const objectivePresets = [...spObjectivePresets, ...globalObjectivePresets].filter(
    (preset, index, all) => all.findIndex((candidate) => candidate.id === preset.id) === index
  );
  let activeDraftItems = [] as Awaited<ReturnType<typeof listChangeSetItems>>;
  const initialComposerRow =
    workspaceData && panelValue === 'workspace'
      ? resolveInitialComposerRow({
          level: levelValue as WorkspaceLevel,
          rows: workspaceData.rows,
          composeLevel,
          composeRowId,
          composeChildId,
        })
      : null;

  const warnings = [...(trendBundle?.warnings ?? workspaceData?.warnings ?? [])];
  let activeDraft:
    | {
        id: string;
        name: string;
        queueCount: number;
      }
    | null = null;

  if (activeChangeSetId && panelValue === 'workspace') {
    const changeSet = await getChangeSet(activeChangeSetId);
    if (!changeSet) {
      warnings.unshift('The requested active draft was not found. Start a new draft from the composer.');
    } else if (changeSet.status !== 'draft' && changeSet.status !== 'review_ready') {
      warnings.unshift(
        `Active draft ${changeSet.name} is ${changeSet.status} and can no longer accept staged edits.`
      );
    } else {
      const queueItems = await listChangeSetItems(changeSet.id);
      activeDraftItems = queueItems;
      activeDraft = {
        id: changeSet.id,
        name: changeSet.name,
        queueCount: queueItems.length,
      };
    }
  }

  let queueChangeSets = [] as Awaited<ReturnType<typeof listChangeSets>>;
  let selectedQueueChangeSet = null as Awaited<ReturnType<typeof getChangeSet>>;
  let selectedQueueItems = [] as Awaited<ReturnType<typeof listChangeSetItems>>;
  let experimentOptions = [] as Awaited<ReturnType<typeof getExperimentOptions>>;
  let templateStatusLine = 'Missing (upload in Templates tab)';
  const missingOutRoot = !env.bulkgenOutRoot;
  const spawnDisabled = !env.enableBulkgenSpawn;
  let templateMissing = true;

  if (panelValue === 'queue') {
    queueChangeSets = await listChangeSets({ limit: 100 });
    let requestedQueueChangeSetId = activeChangeSetId ?? queueChangeSets[0]?.id ?? null;

    if (requestedQueueChangeSetId) {
      selectedQueueChangeSet = await getChangeSet(requestedQueueChangeSetId);
      if (!selectedQueueChangeSet) {
        warnings.unshift('The requested change set was not found. Showing the newest available queue item instead.');
        requestedQueueChangeSetId = queueChangeSets[0]?.id ?? null;
        selectedQueueChangeSet = requestedQueueChangeSetId
          ? await getChangeSet(requestedQueueChangeSetId)
          : null;
      }
    }

    if (selectedQueueChangeSet) {
      selectedQueueItems = await listChangeSetItems(selectedQueueChangeSet.id);
    }

    experimentOptions = await getExperimentOptions();
    const spTemplateStatus = await getTemplateStatus('sp_update');
    const templateUpdatedAt = spTemplateStatus.updatedAt
      ? formatUiDateTime(spTemplateStatus.updatedAt)
      : null;
    templateMissing = spTemplateStatus.source === 'missing';
    templateStatusLine =
      spTemplateStatus.source === 'storage'
        ? `Stored in system${templateUpdatedAt ? ` (updated ${templateUpdatedAt})` : ''}`
        : spTemplateStatus.source === 'local_fallback'
          ? `Using local fallback (${spTemplateStatus.localFallbackPath ?? 'configured env path'})`
          : 'Missing (upload in Templates tab)';

    if (spTemplateStatus.error) {
      warnings.unshift(`Template storage warning: ${spTemplateStatus.error}`);
    }
  }

  if (requestedChannel !== 'sp') {
    warnings.unshift(
      'Only Sponsored Products is enabled in Ads Workspace v1. SB and SD stay visible in the shell but remain disabled.'
    );
  }

  const persistedChangeSetId =
    panelValue === 'queue'
      ? selectedQueueChangeSet?.id ?? activeChangeSetId
      : activeDraft?.id ?? activeChangeSetId;

  const workspaceTabs = [
    { label: 'Workspace', value: 'workspace' },
    { label: 'Queue Review', value: 'queue' },
  ].map((item) => ({
    ...item,
    href: buildHref({
      start,
      end,
      asin,
      channel: channelValue,
      level: levelValue,
      view: viewValue,
      panel: item.value,
      changeSetId: persistedChangeSetId,
      trendEntity,
       showIds,
       campaignScopeId,
       campaignScopeLabel,
       adGroupScopeId,
       adGroupScopeLabel,
       composeLevel,
       composeRowId,
       composeChildId,
     }),
   }));

  const channelTabs = [
    { label: 'SP', value: 'sp' },
    {
      label: 'SB',
      value: 'sb',
      disabled: true,
      title: 'Sponsored Brands arrives in a later phase.',
    },
    {
      label: 'SD',
      value: 'sd',
      disabled: true,
      title: 'Sponsored Display remains KIV in v1.',
    },
  ].map((item) => ({
    ...item,
    href: buildHref({
      start,
      end,
      asin,
      channel: item.value,
      level: levelValue,
      view: viewValue,
      panel: panelValue,
      changeSetId: persistedChangeSetId,
      trendEntity,
       showIds,
       campaignScopeId,
       campaignScopeLabel,
       adGroupScopeId,
       adGroupScopeLabel,
       composeLevel,
       composeRowId,
       composeChildId,
     }),
   }));

  const viewTabs = [
    { label: 'Table', value: 'table' },
    { label: 'Trend', value: 'trend' },
  ].map((item) => ({
    ...item,
    href: buildHref({
      start,
      end,
      asin,
      channel: channelValue,
      level: levelValue,
      view: item.value,
      panel: panelValue,
      changeSetId: persistedChangeSetId,
      trendEntity,
       showIds,
       campaignScopeId,
       campaignScopeLabel,
       adGroupScopeId,
       adGroupScopeLabel,
       composeLevel,
       composeRowId,
       composeChildId,
     }),
   }));

  const levelTabs = [
    { label: 'Campaigns', value: 'campaigns' },
    { label: 'Ad Groups', value: 'adgroups' },
    { label: 'Targets', value: 'targets' },
    { label: 'Placements', value: 'placements' },
    { label: 'Search Terms', value: 'searchterms' },
  ].map((item) => ({
    ...item,
    href: buildHref({
      start,
      end,
      asin,
      channel: channelValue,
      level: item.value,
      view: viewValue,
      panel: panelValue,
      changeSetId: persistedChangeSetId,
      trendEntity,
       showIds,
       campaignScopeId,
       campaignScopeLabel,
       adGroupScopeId,
       adGroupScopeLabel,
       composeLevel,
       composeRowId,
       composeChildId,
     }),
   }));

  const queueChangeSetLinks = queueChangeSets.map((changeSet) => ({
    id: changeSet.id,
    name: changeSet.name,
    status: changeSet.status,
    updatedAt: changeSet.updated_at,
    href: buildHref({
      start,
      end,
      asin,
      channel: channelValue,
      level: levelValue,
      view: viewValue,
      panel: 'queue',
      changeSetId: changeSet.id,
      trendEntity,
       showIds,
       campaignScopeId,
       campaignScopeLabel,
       adGroupScopeId,
       adGroupScopeLabel,
       composeLevel,
       composeRowId,
       composeChildId,
     }),
   }));

  const kpiItems = workspaceData
    ? [
        {
          label: workspaceData.entityCountLabel,
          value: formatNumber(workspaceData.totals.entity_count),
          subvalue: `Clicks ${formatNumber(workspaceData.totals.clicks)}`,
        },
        {
          label: 'Spend',
          value: formatCurrency(workspaceData.totals.spend),
          subvalue: `CPC ${formatCurrency(workspaceData.totals.cpc)}`,
        },
        {
          label: 'Sales',
          value: formatCurrency(workspaceData.totals.sales),
          subvalue: `ROAS ${formatNumber(workspaceData.totals.roas)}`,
        },
        {
          label: 'ACOS',
          value: formatPercent(workspaceData.totals.acos),
          subvalue: `Conv. ${formatPercent(workspaceData.totals.conversion)}`,
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              Ads workspace
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {formatUiDateRange(start, end)}
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              SP-first workspace shell. Table mode is operational for campaigns, ad groups, targets, placements, and search terms. Phase 7 currently ships a diagnostic-first trend slice for Campaigns and Targets.
            </div>
          </div>
          <form method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto] xl:items-end">
            <input type="hidden" name="panel" value={panelValue} />
            <input type="hidden" name="channel" value={channelValue} />
            <input type="hidden" name="level" value={levelValue} />
            <input type="hidden" name="view" value={viewValue} />
            <input
              type="hidden"
              name="change_set"
              value={persistedChangeSetId ?? ''}
            />
            <input type="hidden" name="trend_entity" value={trendData?.selectedEntityId ?? trendEntity ?? ''} />
            <input type="hidden" name="show_ids" value={showIds ? '1' : ''} />
            <input type="hidden" name="campaign_scope" value={campaignScopeId ?? ''} />
            <input type="hidden" name="campaign_scope_name" value={campaignScopeLabel ?? ''} />
            <input type="hidden" name="ad_group_scope" value={adGroupScopeId ?? ''} />
            <input type="hidden" name="ad_group_scope_name" value={adGroupScopeLabel ?? ''} />
            <label className="flex min-w-0 flex-col text-xs uppercase tracking-wide text-muted">
              Start
              <input
                type="date"
                name="start"
                defaultValue={start}
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex min-w-0 flex-col text-xs uppercase tracking-wide text-muted">
              End
              <input
                type="date"
                name="end"
                defaultValue={end}
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex min-w-0 flex-col text-xs uppercase tracking-wide text-muted sm:col-span-2 xl:col-span-1">
              Product
              <select
                name="asin"
                defaultValue={asin}
                className="mt-1 w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              >
                <option value="all">All advertised ASINs</option>
                {asinOptions.map((option) => (
                  <option key={option.asin} value={option.asin}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground xl:self-end"
            >
              Apply
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        <Tabs items={workspaceTabs} current={panelValue} />
        <Tabs items={channelTabs} current={channelValue} />
        {panelValue === 'workspace' ? <Tabs items={viewTabs} current={viewValue} /> : null}
        {panelValue === 'workspace' ? <Tabs items={levelTabs} current={levelValue} /> : null}
      </section>

      {warnings.length > 0 ? (
        <section className="space-y-3">
          {warnings.map((warning) => (
            <div
              key={warning}
              className="rounded-2xl border border-border bg-surface/80 px-5 py-4 text-sm text-muted shadow-sm"
            >
              {warning}
            </div>
          ))}
        </section>
      ) : null}

      {panelValue === 'queue' ? (
        <AdsWorkspaceQueueReview
          changeSetLinks={queueChangeSetLinks}
          selectedChangeSet={selectedQueueChangeSet}
          selectedItems={selectedQueueItems}
          experimentOptions={experimentOptions}
          templateStatusLine={templateStatusLine}
          missingOutRoot={missingOutRoot}
          spawnDisabled={spawnDisabled}
          templateMissing={templateMissing}
          returnTo={buildHref({
            start,
            end,
            asin,
            channel: channelValue,
            level: levelValue,
            view: viewValue,
            panel: 'queue',
            changeSetId: selectedQueueChangeSet?.id ?? activeChangeSetId,
            trendEntity,
             showIds,
             campaignScopeId,
             campaignScopeLabel,
             adGroupScopeId,
             adGroupScopeLabel,
             composeLevel,
             composeRowId,
             composeChildId,
           })}
           notice={queueNotice}
           error={queueError}
         />
       ) : viewValue !== 'table' ? (
         trendData ? (
           <AdsWorkspaceTrendClient
             level={levelValue as 'campaigns' | 'targets'}
             kpiItems={kpiItems}
             trendData={trendData}
             filtersJson={{
               start,
               end,
               asin,
               channel: channelValue,
               level: levelValue,
               view: viewValue,
             }}
             objectivePresets={objectivePresets}
             activeDraft={activeDraft}
             saveDraftAction={saveSpDraftAction}
             initialComposerRow={
               initialComposerRow as SpCampaignsWorkspaceRow | SpTargetsWorkspaceRow | null
             }
             showIds={showIds}
             campaignScopeId={campaignScopeId}
             campaignScopeLabel={campaignScopeLabel}
             adGroupScopeId={adGroupScopeId}
             adGroupScopeLabel={adGroupScopeLabel}
          />
        ) : (
          <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="text-lg font-semibold text-foreground">
              Trend mode is currently supported on Campaigns and Targets.
            </div>
            <div className="mt-2 text-sm text-muted">
              Table mode remains the default editing surface. Ad Groups, Placements, and Search Terms trend slices stay explicit Phase 7 follow-up work.
            </div>
          </section>
        )
      ) : (
        <AdsTargetsWorkspaceClient
          level={levelValue as 'campaigns' | 'adgroups' | 'targets' | 'placements' | 'searchterms'}
          entityCountLabel={workspaceData?.entityCountLabel ?? 'Rows'}
          rows={workspaceData?.rows ?? []}
          kpiItems={kpiItems}
           filtersJson={{
             start,
             end,
             asin,
            channel: channelValue,
            level: levelValue,
            view: viewValue,
           }}
           objectivePresets={objectivePresets}
           defaultUiSettings={defaultUiSettings as Record<string, unknown> | null}
           initialComposerRow={initialComposerRow}
           activeDraft={activeDraft}
           activeDraftItems={activeDraftItems}
           saveDraftAction={saveSpDraftAction}
           showIds={showIds}
          campaignScopeId={campaignScopeId}
          campaignScopeLabel={campaignScopeLabel}
          adGroupScopeId={adGroupScopeId}
          adGroupScopeLabel={adGroupScopeLabel}
        />
      )}
    </div>
  );
}
