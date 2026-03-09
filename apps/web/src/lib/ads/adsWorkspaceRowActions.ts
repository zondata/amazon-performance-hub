import type { SpSearchTermsWorkspaceRow } from './spSearchTermsWorkspaceModel';
import type {
  SpAdGroupsWorkspaceRow,
  SpCampaignsWorkspaceRow,
  SpPlacementsWorkspaceRow,
} from './spWorkspaceTablesModel';
import type { SpTargetsWorkspaceRow } from './spTargetsWorkspaceModel';

export type AdsWorkspaceLevel = 'campaigns' | 'placements' | 'adgroups' | 'targets' | 'searchterms';

export type AdsWorkspaceNavigationScope = {
  campaignScopeId: string | null;
  campaignScopeLabel: string | null;
  adGroupScopeId: string | null;
  adGroupScopeLabel: string | null;
};

export type AdsWorkspaceRowActionDescriptor =
  | {
      key: 'stage_change';
      label: 'Stage change';
      type: 'action';
    }
  | {
      key: 'campaign' | 'placement' | 'adgroup' | 'target' | 'searchterm' | 'trend';
      label: 'Campaign' | 'Placement' | 'Ad group' | 'Target' | 'Search term' | 'Trend';
      type: 'navigate';
      level: AdsWorkspaceLevel;
      view?: 'table' | 'trend';
      scope: AdsWorkspaceNavigationScope;
      trendEntityId?: string | null;
    };

const buildScope = (params: {
  campaignScopeId?: string | null;
  campaignScopeLabel?: string | null;
  adGroupScopeId?: string | null;
  adGroupScopeLabel?: string | null;
}): AdsWorkspaceNavigationScope => ({
  campaignScopeId: params.campaignScopeId ?? null,
  campaignScopeLabel: params.campaignScopeLabel ?? null,
  adGroupScopeId: params.adGroupScopeId ?? null,
  adGroupScopeLabel: params.adGroupScopeLabel ?? null,
});

const uniqueNonEmptyValue = (values: Array<string | null | undefined>) => {
  const unique = new Set(
    values.map((value) => String(value ?? '').trim()).filter((value) => value.length > 0)
  );
  if (unique.size !== 1) return null;
  return [...unique][0] ?? null;
};

export const buildCampaignRowActions = (
  row: SpCampaignsWorkspaceRow
): AdsWorkspaceRowActionDescriptor[] => [
  { key: 'stage_change', label: 'Stage change', type: 'action' },
  {
    key: 'trend',
    label: 'Trend',
    type: 'navigate',
    level: 'campaigns',
    view: 'trend',
    trendEntityId: row.campaign_id,
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
  {
    key: 'placement',
    label: 'Placement',
    type: 'navigate',
    level: 'placements',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
  {
    key: 'adgroup',
    label: 'Ad group',
    type: 'navigate',
    level: 'adgroups',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
  {
    key: 'target',
    label: 'Target',
    type: 'navigate',
    level: 'targets',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
  {
    key: 'searchterm',
    label: 'Search term',
    type: 'navigate',
    level: 'searchterms',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
];

export const buildPlacementRowActions = (
  row: SpPlacementsWorkspaceRow
): AdsWorkspaceRowActionDescriptor[] => [
  { key: 'stage_change', label: 'Stage change', type: 'action' },
  {
    key: 'campaign',
    label: 'Campaign',
    type: 'navigate',
    level: 'campaigns',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
  {
    key: 'adgroup',
    label: 'Ad group',
    type: 'navigate',
    level: 'adgroups',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
  {
    key: 'target',
    label: 'Target',
    type: 'navigate',
    level: 'targets',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
  {
    key: 'searchterm',
    label: 'Search term',
    type: 'navigate',
    level: 'searchterms',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
];

export const buildAdGroupRowActions = (
  row: SpAdGroupsWorkspaceRow
): AdsWorkspaceRowActionDescriptor[] => [
  { key: 'stage_change', label: 'Stage change', type: 'action' },
  {
    key: 'campaign',
    label: 'Campaign',
    type: 'navigate',
    level: 'campaigns',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
  {
    key: 'placement',
    label: 'Placement',
    type: 'navigate',
    level: 'placements',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
  {
    key: 'target',
    label: 'Target',
    type: 'navigate',
    level: 'targets',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
      adGroupScopeId: row.ad_group_id,
      adGroupScopeLabel: row.ad_group_name,
    }),
  },
  {
    key: 'searchterm',
    label: 'Search term',
    type: 'navigate',
    level: 'searchterms',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
      adGroupScopeId: row.ad_group_id,
      adGroupScopeLabel: row.ad_group_name,
    }),
  },
];

export const buildTargetRowActions = (
  row: SpTargetsWorkspaceRow
): AdsWorkspaceRowActionDescriptor[] => [
  { key: 'stage_change', label: 'Stage change', type: 'action' },
  {
    key: 'trend',
    label: 'Trend',
    type: 'navigate',
    level: 'targets',
    view: 'trend',
    trendEntityId: row.target_id,
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
      adGroupScopeId: row.ad_group_id,
      adGroupScopeLabel: row.ad_group_name,
    }),
  },
  {
    key: 'campaign',
    label: 'Campaign',
    type: 'navigate',
    level: 'campaigns',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
  {
    key: 'placement',
    label: 'Placement',
    type: 'navigate',
    level: 'placements',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
    }),
  },
  {
    key: 'adgroup',
    label: 'Ad group',
    type: 'navigate',
    level: 'adgroups',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
      adGroupScopeId: row.ad_group_id,
      adGroupScopeLabel: row.ad_group_name,
    }),
  },
  {
    key: 'searchterm',
    label: 'Search term',
    type: 'navigate',
    level: 'searchterms',
    scope: buildScope({
      campaignScopeId: row.campaign_id,
      campaignScopeLabel: row.campaign_name,
      adGroupScopeId: row.ad_group_id,
      adGroupScopeLabel: row.ad_group_name,
    }),
  },
];

export const buildSearchTermRowActions = (
  row: SpSearchTermsWorkspaceRow
): AdsWorkspaceRowActionDescriptor[] => {
  const campaignScopeId = uniqueNonEmptyValue(row.child_rows.map((child) => child.campaign_id));
  const campaignScopeLabel = uniqueNonEmptyValue(row.child_rows.map((child) => child.campaign_name));
  const adGroupScopeId = uniqueNonEmptyValue(row.child_rows.map((child) => child.ad_group_id));
  const adGroupScopeLabel = uniqueNonEmptyValue(row.child_rows.map((child) => child.ad_group_name));

  const descriptors: AdsWorkspaceRowActionDescriptor[] = [];

  if (campaignScopeId) {
    descriptors.push({
      key: 'campaign',
      label: 'Campaign',
      type: 'navigate',
      level: 'campaigns',
      scope: buildScope({
        campaignScopeId,
        campaignScopeLabel,
      }),
    });
    descriptors.push({
      key: 'placement',
      label: 'Placement',
      type: 'navigate',
      level: 'placements',
      scope: buildScope({
        campaignScopeId,
        campaignScopeLabel,
      }),
    });
  }

  if (campaignScopeId && adGroupScopeId) {
    descriptors.push({
      key: 'adgroup',
      label: 'Ad group',
      type: 'navigate',
      level: 'adgroups',
      scope: buildScope({
        campaignScopeId,
        campaignScopeLabel,
        adGroupScopeId,
        adGroupScopeLabel,
      }),
    });
    descriptors.push({
      key: 'target',
      label: 'Target',
      type: 'navigate',
      level: 'targets',
      scope: buildScope({
        campaignScopeId,
        campaignScopeLabel,
        adGroupScopeId,
        adGroupScopeLabel,
      }),
    });
  }

  return descriptors;
};
