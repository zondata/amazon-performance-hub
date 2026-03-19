import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(process.cwd(), 'apps/web/src/app/ads/performance/page.tsx');
const clientPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/AdsTargetsWorkspaceClient.tsx'
);
const actionsPath = path.join(
  process.cwd(),
  'apps/web/src/app/ads/performance/actions.ts'
);
const campaignsTablePath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/SpCampaignsTable.tsx'
);
const adGroupsTablePath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/SpAdGroupsTable.tsx'
);
const targetsTablePath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/SpTargetsTable.tsx'
);
const placementsTablePath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/SpPlacementsTable.tsx'
);
const trendPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/AdsWorkspaceTrendClient.tsx'
);
const stateBarPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/AdsWorkspaceStateBar.tsx'
);
const searchTermsTablePath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/SpSearchTermsTable.tsx'
);
const gridTablePath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/AdsWorkspaceGridTable.tsx'
);
const queueReviewPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/AdsWorkspaceQueueReview.tsx'
);
const rowActionsMenuPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/AdsWorkspaceRowActionsMenu.tsx'
);
const rowActionsLibPath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads/adsWorkspaceRowActions.ts'
);

describe('ads workspace 7B-B UI wiring', () => {
  it('preserves global show-ids and drilldown scope params in the workspace route state', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain("const showIds = paramValue('show_ids') === '1'");
    expect(source).toContain("const campaignScopeId = paramValue('campaign_scope') ?? null");
    expect(source).toContain("const campaignScopeLabel = paramValue('campaign_scope_name') ?? null");
    expect(source).toContain("const adGroupScopeId = paramValue('ad_group_scope') ?? null");
    expect(source).toContain("const adGroupScopeLabel = paramValue('ad_group_scope_name') ?? null");
    expect(source).toContain("usp.set('show_ids', '1')");
    expect(source).toContain("usp.set('campaign_scope', params.campaignScopeId)");
    expect(source).toContain("usp.set('campaign_scope_name', params.campaignScopeLabel)");
    expect(source).toContain("usp.set('ad_group_scope', params.adGroupScopeId)");
    expect(source).toContain("usp.set('ad_group_scope_name', params.adGroupScopeLabel)");
  });

  it('wires scoped drilldown navigation and trend mini bars into the client views', () => {
    const clientSource = fs.readFileSync(clientPath, 'utf-8');
    const campaignsTableSource = fs.readFileSync(campaignsTablePath, 'utf-8');
    const adGroupsTableSource = fs.readFileSync(adGroupsTablePath, 'utf-8');
    const trendSource = fs.readFileSync(trendPath, 'utf-8');
    const stateBarSource = fs.readFileSync(stateBarPath, 'utf-8');
    const rowActionsMenuSource = fs.readFileSync(rowActionsMenuPath, 'utf-8');
    const rowActionsLibSource = fs.readFileSync(rowActionsLibPath, 'utf-8');

    expect(campaignsTableSource).toContain('AdsWorkspaceRowActionsMenu');
    expect(adGroupsTableSource).toContain('AdsWorkspaceRowActionsMenu');
    expect(clientSource).toContain('buildCampaignRowActions');
    expect(clientSource).toContain('buildAdGroupRowActions');
    expect(clientSource).toContain('buildPlacementRowActions');
    expect(clientSource).toContain('buildTargetRowActions');
    expect(clientSource).toContain('buildSearchTermRowActions');
    expect(clientSource).toContain('buildAdsWorkspaceNavigationHref');
    expect(clientSource).toContain('view: descriptor.view');
    expect(clientSource).toContain('trendEntityId: descriptor.trendEntityId');
    expect(rowActionsMenuSource).toContain('No valid actions for this row.');
    expect(rowActionsMenuSource).toContain('href={item.href}');
    expect(rowActionsMenuSource).toContain("role=\"menuitem\"");
    expect(rowActionsLibSource).toContain('buildSearchTermRowActions');
    expect(rowActionsLibSource).toContain("key: 'stage_change'");
    expect(rowActionsLibSource).toContain("key: 'trend'");
    expect(rowActionsLibSource).toContain("view: 'trend'");
    expect(rowActionsLibSource).toContain("level: 'placements'");
    expect(trendSource).toContain('Trend');
    expect(trendSource).toContain('buildMiniBarMetrics');
    expect(trendSource).toContain('useLocalContrastScaling');
    expect(trendSource).toContain('MINI_BAR_MIN_VISIBLE_HEIGHT');
    expect(trendSource).toContain('className="max-h-[62vh] overflow-auto xl:max-h-[720px]"');
    expect(trendSource).toContain("!(level === 'targets' && (metric.key === 'stis' || metric.key === 'stir')) &&");
    expect(trendSource).toContain("metric.key !== 'organic_rank' &&");
    expect(trendSource).toContain("metric.key !== 'sponsored_rank' &&");
    expect(trendSource).toContain("metric.key !== 'tos_is';");
    expect(trendSource).toContain('function TrendInspectorPanel');
    expect(trendSource).toContain("kind: 'marker'");
    expect(trendSource).toContain("kind: 'cell'");
    expect(trendSource).toContain("return { kind: 'empty' };");
    expect(trendSource).toContain('Selected change detail takes priority over KPI hover.');
    expect(trendSource).toContain('className="max-h-[32vh] overflow-y-auto xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]"');
    expect(trendSource).toContain('aria-pressed={activeMarkerDate === date}');
    expect(trendSource).toContain('onClick={() => setHoveredMetric(metric, cell)}');
    expect(trendSource).not.toContain('Hover drill-in');
    expect(trendSource).not.toContain('scheduleHoverPanelTopUpdate');
    expect(trendSource).not.toContain('updateHoverPanelTop');
    expect(trendSource).not.toContain("bottom: 'calc(16px + 0.75rem + env(safe-area-inset-bottom))'");
    expect(stateBarSource).toContain('campaignScopeLabel');
    expect(stateBarSource).toContain('adGroupScopeLabel');
  });
});

describe('ads workspace 7B-C UI wiring', () => {
  it('loads and saves per-surface workspace UI defaults', () => {
    const pageSource = fs.readFileSync(pagePath, 'utf-8');
    const clientSource = fs.readFileSync(clientPath, 'utf-8');
    const actionsSource = fs.readFileSync(actionsPath, 'utf-8');
    const trendSource = fs.readFileSync(trendPath, 'utf-8');

    expect(pageSource).toContain('const defaultUiSettings = panelValue === \'workspace\'');
    expect(pageSource).toContain('pageKey: ADS_WORKSPACE_UI_PAGE_KEY');
    expect(pageSource).toContain('defaultUiSettings={defaultUiSettings as Record<string, unknown> | null}');
    expect(pageSource).toContain("const composeLevel = paramValue('compose_level') ?? null");
    expect(pageSource).toContain("const composeRowId = paramValue('compose_row') ?? null");
    expect(pageSource).toContain("const composeChildId = paramValue('compose_child') ?? null");
    expect(pageSource).toContain('let activeDraftItems = [] as Awaited<ReturnType<typeof listChangeSetItems>>;');
    expect(pageSource).toContain('activeDraftItems = queueItems;');
    expect(pageSource).toContain("changeSet.status !== 'draft' && changeSet.status !== 'review_ready'");
    expect(clientSource).toContain('const currentSurfaceKey = `table:${props.level}` as AdsWorkspaceTableSurfaceKey');
    expect(clientSource).toContain('await saveAdsWorkspaceUiSettings(next);');
    expect(clientSource).toContain('deriveSpActiveDraftHighlights(props.activeDraftItems)');
    expect(clientSource).toContain("params.set('compose_level', props.level)");
    expect(trendSource).toContain("params.delete('compose_level')");
    expect(trendSource).toContain('<SpChangeComposer');
    expect(actionsSource).toContain('export const saveAdsWorkspaceUiSettings = async (settings: AdsWorkspaceUiSettings) => {');
    expect(actionsSource).toContain('pageKey: ADS_WORKSPACE_UI_PAGE_KEY');
  });

  it('lets queue review redirect exceptions escape instead of flashing NEXT_REDIRECT as an error', () => {
    const actionsSource = fs.readFileSync(actionsPath, 'utf-8');

    expect(actionsSource).toContain("import { isRedirectError } from 'next/dist/client/components/redirect-error';");
    expect(actionsSource).toContain('const rethrowRedirectError = (error: unknown) => {');
    expect(actionsSource).toContain('if (isRedirectError(error)) {');
    expect(actionsSource).toContain('throw error;');
    expect(actionsSource).toContain('rethrowRedirectError(error);');
  });

  it('wires shared header controls, Search Terms settings, and the docked composer layout', () => {
    const clientSource = fs.readFileSync(clientPath, 'utf-8');
    const gridTableSource = fs.readFileSync(gridTablePath, 'utf-8');
    const searchTermsSource = fs.readFileSync(searchTermsTablePath, 'utf-8');
    const campaignsTableSource = fs.readFileSync(campaignsTablePath, 'utf-8');
    const adGroupsTableSource = fs.readFileSync(adGroupsTablePath, 'utf-8');
    const targetsTableSource = fs.readFileSync(targetsTablePath, 'utf-8');
    const placementsTableSource = fs.readFileSync(placementsTablePath, 'utf-8');

    expect(gridTableSource).toContain('Wrap long labels');
    expect(gridTableSource).toContain('Columns');
    expect(gridTableSource).toContain('Font');
    expect(gridTableSource).toContain('textFilter?: AdsWorkspaceGridTextFilterConfig<TRow>;');
    expect(gridTableSource).toContain('getActiveAdsWorkspaceTextFilters');
    expect(gridTableSource).toContain('type="search"');
    expect(gridTableSource).toContain('placeholder={column.textFilter.placeholder}');
    expect(gridTableSource).toContain('aria-label={column.textFilter.ariaLabel}');
    expect(gridTableSource).toContain('<option value="gte">&gt;=</option>');
    expect(gridTableSource).toContain('<option value="lte">&lt;=</option>');
    expect(gridTableSource).toContain('<option value="gt">&gt;</option>');
    expect(gridTableSource).toContain('<option value="lt">&lt;</option>');
    expect(gridTableSource).toContain('<option value="has_value">Has value</option>');
    expect(gridTableSource).toContain('aria-label={`Filter ${column.label}`}');
    expect(gridTableSource).toContain('toggleColumnVisibility');
    expect(gridTableSource).toContain('moveColumn');
    expect(gridTableSource).toContain('toggleFrozen');
    expect(gridTableSource).toContain('group-open:rotate-90');
    expect(gridTableSource).toContain('No result');
    expect(gridTableSource).toContain("typeof rowClassName === 'function' ? rowClassName(row) ?? '' : rowClassName ?? ''");
    expect(gridTableSource).toContain('const hasCustomRowSurfaceTone =');
    expect(gridTableSource).toContain("hasCustomRowSurfaceTone ? '' : 'bg-surface/70 hover:bg-surface-2/70'");
    expect(searchTermsSource).toContain('surfaceSettings={surfaceSettings}');
    expect(searchTermsSource).toContain('settingsSaveStateLabel={settingsSaveStateLabel}');
    expect(searchTermsSource).toContain('onSurfaceSettingsChange={onSurfaceSettingsChange}');
    expect(campaignsTableSource).toContain("placeholder: 'Search campaign'");
    expect(adGroupsTableSource).toContain("placeholder: 'Search campaign'");
    expect(adGroupsTableSource).toContain("placeholder: 'Search ad group'");
    expect(targetsTableSource).toContain("placeholder: 'Search target'");
    expect(targetsTableSource).toContain("placeholder: 'Search campaign'");
    expect(targetsTableSource).toContain("placeholder: 'Search ad group'");
    expect(placementsTableSource).toContain("placeholder: 'Search campaign'");
    expect(placementsTableSource).toContain("placeholder: 'Search placement'");
    expect(searchTermsSource).toContain("placeholder: 'Search term'");
    expect(campaignsTableSource).toContain('rowHighlightTones?: Map<string, SpActiveDraftRowTone>;');
    expect(adGroupsTableSource).toContain('rowHighlightTones?: Map<string, SpActiveDraftRowTone>;');
    expect(clientSource).toContain("xl:grid-cols-[minmax(0,1fr)_430px]");
    expect(clientSource).toContain('mode="docked"');
  });

  it('groups queue review items by campaign context while keeping atomic item controls', () => {
    const queueReviewSource = fs.readFileSync(queueReviewPath, 'utf-8');

    expect(queueReviewSource).toContain('const groupedItems = props.selectedItems.reduce<QueueItemGroup[]>');
    expect(queueReviewSource).toContain('Campaign context');
    expect(queueReviewSource).toContain("atomic queued item(s)");
    expect(queueReviewSource).toContain('descriptor.secondaryIds');
    expect(queueReviewSource).toContain('Save Item');
    expect(queueReviewSource).toContain('Remove Item');
  });

  it('keeps Target Table free of rank context and row-click drilldown while Actions menus stay explicit', () => {
    const targetsTableSource = fs.readFileSync(targetsTablePath, 'utf-8');
    const placementsTableSource = fs.readFileSync(placementsTablePath, 'utf-8');
    const searchTermsSource = fs.readFileSync(searchTermsTablePath, 'utf-8');
    const campaignsTableSource = fs.readFileSync(campaignsTablePath, 'utf-8');
    const adGroupsTableSource = fs.readFileSync(adGroupsTablePath, 'utf-8');

    expect(targetsTableSource).not.toContain("key: 'rank_context'");
    expect(targetsTableSource).not.toContain("label: 'Rank context'");
    expect(targetsTableSource).toContain("key: 'actions'");
    expect(targetsTableSource).toContain('AdsWorkspaceRowActionsMenu');
    expect(targetsTableSource).not.toContain('Draft staging');
    expect(targetsTableSource).not.toContain('Stage target, ad group, campaign, and campaign placement modifier edits');
    expect(targetsTableSource).not.toContain('Organic');
    expect(targetsTableSource).not.toContain('Sponsored');
    expect(targetsTableSource).not.toContain("key: 'stis'");
    expect(targetsTableSource).not.toContain("key: 'stir'");
    expect(targetsTableSource).not.toContain("key: 'tos_is'");
    expect(placementsTableSource).toContain('AdsWorkspaceRowActionsMenu');
    expect(searchTermsSource).toContain("key: 'actions'");
    expect(searchTermsSource).toContain('AdsWorkspaceRowActionsMenu');
    expect(searchTermsSource).toContain('Stage changes from the child row with the concrete keyword or target context.');
    expect(campaignsTableSource).not.toContain('rowLinkRole=');
    expect(adGroupsTableSource).not.toContain('rowLinkRole=');
    expect(campaignsTableSource).not.toContain('onRowClick=');
    expect(adGroupsTableSource).not.toContain('onRowClick=');
  });
});
