import { describe, expect, it } from 'vitest';

import {
  filterCampaignIdsByWorkspaceScope,
  filterRowsByWorkspaceScope,
  matchesWorkspaceScope,
} from '../apps/web/src/lib/ads/spWorkspaceScope';

describe('spWorkspaceScope', () => {
  it('matches campaign and ad-group scope only when both constraints hold', () => {
    expect(
      matchesWorkspaceScope(
        { campaign_id: 'c1', ad_group_id: 'ag1' },
        { campaignScopeId: 'c1', adGroupScopeId: 'ag1' }
      )
    ).toBe(true);
    expect(
      matchesWorkspaceScope(
        { campaign_id: 'c1', ad_group_id: 'ag2' },
        { campaignScopeId: 'c1', adGroupScopeId: 'ag1' }
      )
    ).toBe(false);
  });

  it('filters mixed row sets without requiring all rows to have an ad-group id', () => {
    const rows = filterRowsByWorkspaceScope(
      [
        { campaign_id: 'c1', ad_group_id: 'ag1' },
        { campaign_id: 'c1', ad_group_id: 'ag2' },
        { campaign_id: 'c2', ad_group_id: null },
      ],
      { campaignScopeId: 'c1', adGroupScopeId: 'ag1' }
    );

    expect(rows).toEqual([{ campaign_id: 'c1', ad_group_id: 'ag1' }]);
  });

  it('narrows ambiguous campaign ids when a drilldown campaign scope is active', () => {
    const ids = filterCampaignIdsByWorkspaceScope(new Set(['c1', 'c2']), {
      campaignScopeId: 'c2',
    });

    expect([...ids]).toEqual(['c2']);
  });
});
