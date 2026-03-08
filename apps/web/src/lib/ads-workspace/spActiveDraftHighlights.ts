import type { AdsChangeSetItem } from './types';

export type SpActiveDraftRowTone = 'direct' | 'context';

export type SpActiveDraftHighlights = {
  campaigns: Map<string, SpActiveDraftRowTone>;
  adGroups: Map<string, SpActiveDraftRowTone>;
  targets: Map<string, SpActiveDraftRowTone>;
  placements: Map<string, SpActiveDraftRowTone>;
};

const createEmptyHighlights = (): SpActiveDraftHighlights => ({
  campaigns: new Map<string, SpActiveDraftRowTone>(),
  adGroups: new Map<string, SpActiveDraftRowTone>(),
  targets: new Map<string, SpActiveDraftRowTone>(),
  placements: new Map<string, SpActiveDraftRowTone>(),
});

const setTone = (
  map: Map<string, SpActiveDraftRowTone>,
  key: string | null | undefined,
  tone: SpActiveDraftRowTone
) => {
  if (!key) return;
  const current = map.get(key);
  if (current === 'direct') return;
  if (tone === 'direct' || !current) {
    map.set(key, tone);
  }
};

export const deriveSpActiveDraftHighlights = (
  items?: AdsChangeSetItem[] | null
): SpActiveDraftHighlights => {
  if (!items || items.length === 0) {
    return createEmptyHighlights();
  }

  const { campaigns, adGroups, targets, placements } = createEmptyHighlights();

  for (const item of items) {
    if (item.channel !== 'sp') continue;

    if (item.entity_level === 'campaign') {
      setTone(campaigns, item.campaign_id ?? item.entity_key, 'direct');
      continue;
    }

    if (item.entity_level === 'ad_group') {
      setTone(adGroups, item.ad_group_id ?? item.entity_key, 'direct');
      setTone(campaigns, item.campaign_id, 'context');
      continue;
    }

    if (item.entity_level === 'target') {
      setTone(targets, item.target_id ?? item.entity_key, 'direct');
      setTone(adGroups, item.ad_group_id, 'context');
      setTone(campaigns, item.campaign_id, 'context');
      continue;
    }

    if (item.entity_level === 'placement') {
      const placementKey =
        item.campaign_id && item.placement_code
          ? `${item.campaign_id}::${item.placement_code}`
          : item.entity_key;
      setTone(placements, placementKey, 'direct');
      setTone(campaigns, item.campaign_id, 'context');
      continue;
    }

    if (item.entity_level === 'search_term_context') {
      setTone(adGroups, item.ad_group_id, 'context');
      setTone(campaigns, item.campaign_id, 'context');
    }
  }

  return {
    campaigns,
    adGroups,
    targets,
    placements,
  };
};
