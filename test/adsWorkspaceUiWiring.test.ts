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

    expect(campaignsTableSource).toContain("View ad groups");
    expect(campaignsTableSource).toContain("rowLinkRole={onDrilldownToAdGroups ? 'link' : undefined}");
    expect(adGroupsTableSource).toContain("View targets");
    expect(adGroupsTableSource).toContain("rowLinkRole={onDrilldownToTargets ? 'link' : undefined}");
    expect(clientSource).toContain("params.set('campaign_scope_name', scope.campaignScopeLabel)");
    expect(clientSource).toContain("params.set('ad_group_scope_name', scope.adGroupScopeLabel)");
    expect(clientSource).toContain("params.set('campaign_scope', scope.campaignScopeId)");
    expect(clientSource).toContain("params.set('ad_group_scope', scope.adGroupScopeId)");
    expect(trendSource).toContain('Trend');
    expect(trendSource).toContain('buildMiniBarMetrics');
    expect(trendSource).toContain('useLocalContrastScaling');
    expect(trendSource).toContain('MINI_BAR_MIN_VISIBLE_HEIGHT');
    expect(trendSource).toContain('className="max-h-[720px] overflow-auto"');
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
    expect(clientSource).toContain('const currentSurfaceKey = `table:${props.level}` as AdsWorkspaceTableSurfaceKey');
    expect(clientSource).toContain('await saveAdsWorkspaceUiSettings(next);');
    expect(clientSource).toContain("params.set('compose_level', props.level)");
    expect(trendSource).toContain("params.delete('compose_level')");
    expect(trendSource).toContain('<SpChangeComposer');
    expect(actionsSource).toContain('export const saveAdsWorkspaceUiSettings = async (settings: AdsWorkspaceUiSettings) => {');
    expect(actionsSource).toContain('pageKey: ADS_WORKSPACE_UI_PAGE_KEY');
  });

  it('wires shared header controls, Search Terms settings, and the docked composer layout', () => {
    const clientSource = fs.readFileSync(clientPath, 'utf-8');
    const gridTableSource = fs.readFileSync(gridTablePath, 'utf-8');
    const searchTermsSource = fs.readFileSync(searchTermsTablePath, 'utf-8');

    expect(gridTableSource).toContain('Wrap long labels');
    expect(gridTableSource).toContain('Columns');
    expect(gridTableSource).toContain('Font');
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
    expect(gridTableSource).toContain('No rows matched the current filters.');
    expect(searchTermsSource).toContain('surfaceSettings={surfaceSettings}');
    expect(searchTermsSource).toContain('settingsSaveStateLabel={settingsSaveStateLabel}');
    expect(searchTermsSource).toContain('onSurfaceSettingsChange={onSurfaceSettingsChange}');
    expect(clientSource).toContain("xl:grid-cols-[minmax(0,1fr)_430px]");
    expect(clientSource).toContain('mode="docked"');
  });
});
