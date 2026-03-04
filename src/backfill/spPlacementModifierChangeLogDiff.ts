type PlacementRow = {
  campaign_id: string;
  placement_code: string;
  placement_raw: string | null;
  percentage: number | string | null;
};

export type PlacementModifierChangeCandidate = {
  campaign_id: string;
  placement_code: string;
  placement_raw: string | null;
  old_pct: number;
  new_pct: number;
};

const toFiniteNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const cleanText = (value: unknown): string => String(value ?? "").trim();

const toPlacementKey = (campaignId: string, placementCode: string): string =>
  `${campaignId}:${placementCode}`;

export function diffPlacementModifierUpdates(
  previousRows: PlacementRow[],
  currentRows: PlacementRow[]
): PlacementModifierChangeCandidate[] {
  const previousByKey = new Map<
    string,
    { old_pct: number; placement_raw: string | null }
  >();

  for (const row of previousRows) {
    const campaignId = cleanText(row.campaign_id);
    const placementCode = cleanText(row.placement_code);
    if (!campaignId || !placementCode) continue;
    const oldPct = toFiniteNumberOrNull(row.percentage);
    if (oldPct === null) continue;
    const placementRaw = cleanText(row.placement_raw);
    previousByKey.set(toPlacementKey(campaignId, placementCode), {
      old_pct: oldPct,
      placement_raw: placementRaw || null,
    });
  }

  const changes: PlacementModifierChangeCandidate[] = [];
  for (const row of currentRows) {
    const campaignId = cleanText(row.campaign_id);
    const placementCode = cleanText(row.placement_code);
    if (!campaignId || !placementCode) continue;

    const previous = previousByKey.get(toPlacementKey(campaignId, placementCode));
    if (!previous) continue;

    const newPct = toFiniteNumberOrNull(row.percentage);
    if (newPct === null) continue;
    if (previous.old_pct === newPct) continue;

    const currentRaw = cleanText(row.placement_raw);
    changes.push({
      campaign_id: campaignId,
      placement_code: placementCode,
      placement_raw: currentRaw || previous.placement_raw || null,
      old_pct: previous.old_pct,
      new_pct: newPct,
    });
  }

  return changes.sort((left, right) => {
    const byCampaign = left.campaign_id.localeCompare(right.campaign_id);
    if (byCampaign !== 0) return byCampaign;
    return left.placement_code.localeCompare(right.placement_code);
  });
}
