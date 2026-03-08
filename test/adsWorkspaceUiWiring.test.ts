import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(process.cwd(), 'apps/web/src/app/ads/performance/page.tsx');
const clientPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/AdsTargetsWorkspaceClient.tsx'
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
    expect(campaignsTableSource).toContain("role={isDrilldownEnabled ? 'link' : undefined}");
    expect(adGroupsTableSource).toContain("View targets");
    expect(adGroupsTableSource).toContain("role={isDrilldownEnabled ? 'link' : undefined}");
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
