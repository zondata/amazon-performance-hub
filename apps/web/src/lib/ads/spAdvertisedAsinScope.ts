const trimToNull = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeSpAdvertisedAsin = (value: string | null | undefined): string | null => {
  const trimmed = trimToNull(value);
  return trimmed ? trimmed.toUpperCase() : null;
};

export const resolveAdvertisedAsinSetForEntity = (params: {
  adGroupId: string | null | undefined;
  campaignId: string | null | undefined;
  asinByAdGroup: Map<string, Set<string>>;
  asinByCampaign: Map<string, Set<string>>;
}): Set<string> | undefined => {
  const adGroupId = trimToNull(params.adGroupId);
  if (adGroupId) {
    const byAdGroup = params.asinByAdGroup.get(adGroupId);
    if (byAdGroup && byAdGroup.size > 0) {
      return byAdGroup;
    }
  }

  const campaignId = trimToNull(params.campaignId);
  if (campaignId) {
    const byCampaign = params.asinByCampaign.get(campaignId);
    if (byCampaign && byCampaign.size > 0) {
      return byCampaign;
    }
  }

  return undefined;
};
