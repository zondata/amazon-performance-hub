import type { AdsWorkspaceLevel, AdsWorkspaceNavigationScope } from './adsWorkspaceRowActions';

export const buildAdsWorkspaceNavigationHref = (params: {
  pathname: string;
  search: string;
  level: AdsWorkspaceLevel;
  scope: AdsWorkspaceNavigationScope;
  view?: 'table' | 'trend';
  trendEntityId?: string | null;
}) => {
  const usp = new URLSearchParams(params.search);
  usp.set('panel', 'workspace');
  usp.set('view', params.view ?? 'table');
  usp.set('level', params.level);
  usp.delete('compose_level');
  usp.delete('compose_row');
  usp.delete('compose_child');

  if ((params.view ?? 'table') === 'trend' && params.trendEntityId) {
    usp.set('trend_entity', params.trendEntityId);
  } else {
    usp.delete('trend_entity');
  }

  if (params.scope.campaignScopeId) {
    usp.set('campaign_scope', params.scope.campaignScopeId);
  } else {
    usp.delete('campaign_scope');
  }
  if (params.scope.campaignScopeLabel) {
    usp.set('campaign_scope_name', params.scope.campaignScopeLabel);
  } else {
    usp.delete('campaign_scope_name');
  }
  if (params.scope.adGroupScopeId) {
    usp.set('ad_group_scope', params.scope.adGroupScopeId);
  } else {
    usp.delete('ad_group_scope');
  }
  if (params.scope.adGroupScopeLabel) {
    usp.set('ad_group_scope_name', params.scope.adGroupScopeLabel);
  } else {
    usp.delete('ad_group_scope_name');
  }

  const query = usp.toString();
  return query ? `${params.pathname}?${query}` : params.pathname;
};
