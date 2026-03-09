import { describe, expect, it } from 'vitest';

import { buildAdsWorkspaceNavigationHref } from '../apps/web/src/lib/ads/adsWorkspaceNavigation';

describe('adsWorkspaceNavigation', () => {
  it('preserves workspace context while switching level and clearing transient drilldown state', () => {
    const href = buildAdsWorkspaceNavigationHref({
      pathname: '/ads/performance',
      search:
        'panel=workspace&view=table&level=targets&start=2026-02-01&end=2026-02-29&asin=B001&show_ids=1&trend_entity=t1&compose_level=targets&compose_row=t1',
      level: 'searchterms',
      scope: {
        campaignScopeId: 'c1',
        campaignScopeLabel: 'Campaign A',
        adGroupScopeId: 'ag1',
        adGroupScopeLabel: 'Ad Group A',
      },
    });

    expect(href).toContain('/ads/performance?');
    expect(href).toContain('panel=workspace');
    expect(href).toContain('view=table');
    expect(href).toContain('level=searchterms');
    expect(href).toContain('start=2026-02-01');
    expect(href).toContain('end=2026-02-29');
    expect(href).toContain('asin=B001');
    expect(href).toContain('show_ids=1');
    expect(href).toContain('campaign_scope=c1');
    expect(href).toContain('campaign_scope_name=Campaign+A');
    expect(href).toContain('ad_group_scope=ag1');
    expect(href).toContain('ad_group_scope_name=Ad+Group+A');
    expect(href).not.toContain('trend_entity=');
    expect(href).not.toContain('compose_level=');
    expect(href).not.toContain('compose_row=');
  });

  it('builds a trend href that preserves workspace context and selected entity scope', () => {
    const href = buildAdsWorkspaceNavigationHref({
      pathname: '/ads/performance',
      search:
        'panel=workspace&view=table&level=targets&start=2026-02-01&end=2026-02-29&asin=B001&show_ids=1&change_set=cs1&compose_level=targets&compose_row=t1',
      level: 'targets',
      view: 'trend',
      trendEntityId: 't1',
      scope: {
        campaignScopeId: 'c1',
        campaignScopeLabel: 'Campaign A',
        adGroupScopeId: 'ag1',
        adGroupScopeLabel: 'Ad Group A',
      },
    });

    expect(href).toContain('/ads/performance?');
    expect(href).toContain('panel=workspace');
    expect(href).toContain('view=trend');
    expect(href).toContain('level=targets');
    expect(href).toContain('trend_entity=t1');
    expect(href).toContain('start=2026-02-01');
    expect(href).toContain('end=2026-02-29');
    expect(href).toContain('asin=B001');
    expect(href).toContain('show_ids=1');
    expect(href).toContain('change_set=cs1');
    expect(href).toContain('campaign_scope=c1');
    expect(href).toContain('ad_group_scope=ag1');
    expect(href).not.toContain('compose_level=');
    expect(href).not.toContain('compose_row=');
  });

  it('removes empty scope params instead of leaving stale destination context behind', () => {
    const href = buildAdsWorkspaceNavigationHref({
      pathname: '/ads/performance',
      search:
        'panel=workspace&view=table&level=adgroups&campaign_scope=c1&campaign_scope_name=Campaign+A&ad_group_scope=ag1&ad_group_scope_name=Ad+Group+A',
      level: 'campaigns',
      scope: {
        campaignScopeId: 'c1',
        campaignScopeLabel: 'Campaign A',
        adGroupScopeId: null,
        adGroupScopeLabel: null,
      },
    });

    expect(href).toContain('level=campaigns');
    expect(href).toContain('campaign_scope=c1');
    expect(href).toContain('campaign_scope_name=Campaign+A');
    expect(href).not.toContain('ad_group_scope=');
    expect(href).not.toContain('ad_group_scope_name=');
  });
});
