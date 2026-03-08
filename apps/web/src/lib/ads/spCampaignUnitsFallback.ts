type NumericLike = number | string | null | undefined;

export type SpCampaignPlacementUnitsRowLike = {
  campaign_id: string | null;
  date: string | null;
  units: unknown;
};

const trimString = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toFiniteNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const buildPlacementUnitsByCampaignDate = (
  rows: SpCampaignPlacementUnitsRowLike[]
) => {
  const placementUnitsByCampaignDate = new Map<string, number>();

  for (const row of rows) {
    const campaignId = trimString(row.campaign_id);
    const date = trimString(row.date);
    const units = toFiniteNumberOrNull(row.units);
    if (!campaignId || !date || units === null) continue;

    const key = `${campaignId}::${date}`;
    placementUnitsByCampaignDate.set(key, (placementUnitsByCampaignDate.get(key) ?? 0) + units);
  }

  return placementUnitsByCampaignDate;
};

export const resolveCampaignUnitsWithPlacementFallback = (params: {
  campaignId: string | null | undefined;
  date: string | null | undefined;
  primaryUnits: NumericLike;
  placementUnitsByCampaignDate: Map<string, number>;
}) => {
  const primaryUnits = toFiniteNumberOrNull(params.primaryUnits);
  if (primaryUnits !== null) return primaryUnits;

  const campaignId = trimString(params.campaignId);
  const date = trimString(params.date);
  if (!campaignId || !date) return null;

  return params.placementUnitsByCampaignDate.get(`${campaignId}::${date}`) ?? null;
};
