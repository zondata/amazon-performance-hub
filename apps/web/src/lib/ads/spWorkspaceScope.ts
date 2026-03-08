type ScopeLikeRow = {
  campaign_id?: string | null;
  ad_group_id?: string | null;
};

const trimString = (value: string | null | undefined) => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

export type SpWorkspaceScope = {
  campaignScopeId?: string | null;
  adGroupScopeId?: string | null;
};

export const normalizeWorkspaceScopeId = (value: string | null | undefined) =>
  trimString(value);

export const matchesWorkspaceScope = (
  row: ScopeLikeRow,
  scope: SpWorkspaceScope
) => {
  const campaignScopeId = normalizeWorkspaceScopeId(scope.campaignScopeId);
  const adGroupScopeId = normalizeWorkspaceScopeId(scope.adGroupScopeId);
  const campaignId = trimString(row.campaign_id);
  const adGroupId = trimString(row.ad_group_id);

  if (campaignScopeId && campaignId !== campaignScopeId) return false;
  if (adGroupScopeId && adGroupId !== adGroupScopeId) return false;
  return true;
};

export const filterRowsByWorkspaceScope = <TRow extends ScopeLikeRow>(
  rows: TRow[],
  scope: SpWorkspaceScope
) => rows.filter((row) => matchesWorkspaceScope(row, scope));

export const filterCampaignIdsByWorkspaceScope = (
  campaignIds: Set<string>,
  scope: SpWorkspaceScope
) => {
  const campaignScopeId = normalizeWorkspaceScopeId(scope.campaignScopeId);
  if (!campaignScopeId) return campaignIds;
  return new Set([...campaignIds].filter((campaignId) => campaignId === campaignScopeId));
};
