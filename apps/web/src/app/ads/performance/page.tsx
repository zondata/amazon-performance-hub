import AdsTargetsWorkspaceClient from '@/components/ads/AdsTargetsWorkspaceClient';
import AdsWorkspaceQueueReview from '@/components/ads/AdsWorkspaceQueueReview';
import Tabs from '@/components/Tabs';
import { saveSpDraftAction } from '@/app/ads/performance/actions';
import { getSpWorkspaceData } from '@/lib/ads/getSpWorkspaceData';
import { listChangeSetItems } from '@/lib/ads-workspace/repoChangeSetItems';
import { getChangeSet, listChangeSets } from '@/lib/ads-workspace/repoChangeSets';
import { listObjectivePresets } from '@/lib/ads-workspace/repoObjectivePresets';
import { getTemplateStatus } from '@/lib/bulksheets/templateStore';
import { env } from '@/lib/env';
import { getExperimentOptions } from '@/lib/logbook/getExperimentOptions';
import { fetchAsinOptions } from '@/lib/products/fetchAsinOptions';
import { getDefaultMarketplaceDateRange } from '@/lib/time/defaultDateRange';

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

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US');
};

type AdsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const buildHref = (params: {
  start: string;
  end: string;
  asin: string;
  channel: string;
  level: string;
  view: string;
  panel?: string | null;
  changeSetId?: string | null;
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
  return `/ads/performance?${usp.toString()}`;
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
  const shouldLoadTable =
    panelValue === 'workspace' &&
    viewValue === 'table' &&
    (levelValue === 'campaigns' ||
      levelValue === 'adgroups' ||
      levelValue === 'targets' ||
      levelValue === 'placements');

  const workspaceData = shouldLoadTable
    ? await getSpWorkspaceData({
        accountId: env.accountId,
        marketplace: env.marketplace,
        start,
        end,
        asinFilter: asin,
        level: levelValue,
      })
    : null;
  const asinOptions =
    workspaceData?.asinOptions ??
    (await fetchAsinOptions(env.accountId, env.marketplace));
  const [spObjectivePresets, globalObjectivePresets] = shouldLoadTable
    ? await Promise.all([
        listObjectivePresets({ channel: 'sp' }),
        listObjectivePresets({ channel: null }),
      ])
    : [[], []];
  const objectivePresets = [...spObjectivePresets, ...globalObjectivePresets].filter(
    (preset, index, all) => all.findIndex((candidate) => candidate.id === preset.id) === index
  );

  const warnings = [...(workspaceData?.warnings ?? [])];
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
    } else if (changeSet.status !== 'draft') {
      warnings.unshift(
        `Active draft ${changeSet.name} is ${changeSet.status} and can no longer accept staged edits.`
      );
    } else {
      const queueItems = await listChangeSetItems(changeSet.id);
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
    const templateUpdatedAt = formatDateTime(spTemplateStatus.updatedAt);
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              Ads workspace
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {start} → {end}
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              SP-first shell. Targets is the first operational tab, while other views stay visible for workspace continuity and land in later phases.
            </div>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="panel" value={panelValue} />
            <input type="hidden" name="channel" value={channelValue} />
            <input type="hidden" name="level" value={levelValue} />
            <input type="hidden" name="view" value={viewValue} />
            <input
              type="hidden"
              name="change_set"
              value={persistedChangeSetId ?? ''}
            />
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              Start
              <input
                type="date"
                name="start"
                defaultValue={start}
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              End
              <input
                type="date"
                name="end"
                defaultValue={end}
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              Product
              <select
                name="asin"
                defaultValue={asin}
                className="mt-1 min-w-[260px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
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
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
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
          })}
          notice={queueNotice}
          error={queueError}
        />
      ) : levelValue === 'searchterms' ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-lg font-semibold text-foreground">Coming soon</div>
          <div className="mt-2 text-sm text-muted">
            Search Terms lands in Phase 6. This level stays visible for workspace continuity and is intentionally deferred.
          </div>
        </section>
      ) : viewValue !== 'table' ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-lg font-semibold text-foreground">
            Trend mode is diagnostic-only and lands later.
          </div>
          <div className="mt-2 text-sm text-muted">
            Table mode remains the default editing surface in SP v1. This phase stops at the initial Targets table.
          </div>
        </section>
      ) : (
        <AdsTargetsWorkspaceClient
          level={levelValue as 'campaigns' | 'adgroups' | 'targets' | 'placements'}
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
          activeDraft={activeDraft}
          saveDraftAction={saveSpDraftAction}
        />
      )}
    </div>
  );
}
