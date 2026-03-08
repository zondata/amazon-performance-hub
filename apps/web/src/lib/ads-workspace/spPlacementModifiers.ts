import { mapPlacementModifierKey } from '../logbook/aiPack/aiPackV3Helpers';

export type SpEditablePlacementModifier = {
  placement_code: 'PLACEMENT_TOP' | 'PLACEMENT_REST_OF_SEARCH' | 'PLACEMENT_PRODUCT_PAGE';
  label: string;
  current_percentage: number | null;
};

type SpCurrentPlacementModifierLike = {
  campaign_id: string;
  placement_code: string | null;
  placement_raw: string | null;
  percentage: number | null;
};

const CANONICAL_SP_PLACEMENTS: SpEditablePlacementModifier[] = [
  {
    placement_code: 'PLACEMENT_TOP',
    label: 'Top of Search (first page)',
    current_percentage: null,
  },
  {
    placement_code: 'PLACEMENT_REST_OF_SEARCH',
    label: 'Rest of Search',
    current_percentage: null,
  },
  {
    placement_code: 'PLACEMENT_PRODUCT_PAGE',
    label: 'Product Pages',
    current_percentage: null,
  },
];

export const SP_BIDDING_STRATEGY_OPTIONS = [
  'Dynamic bids - down only',
  'Dynamic bids - up and down',
  'Fixed bids',
] as const;

export const buildSpPlacementModifierContexts = (params: {
  campaignId: string;
  rows: SpCurrentPlacementModifierLike[];
}) => {
  const percentageByPlacement = new Map<string, number | null>();
  const labelByPlacement = new Map<string, string>();

  for (const row of params.rows) {
    if (row.campaign_id !== params.campaignId) continue;
    const placementKey = mapPlacementModifierKey('sp', row.placement_code, row.placement_raw);
    if (
      placementKey !== 'PLACEMENT_TOP' &&
      placementKey !== 'PLACEMENT_REST_OF_SEARCH' &&
      placementKey !== 'PLACEMENT_PRODUCT_PAGE'
    ) {
      continue;
    }

    percentageByPlacement.set(placementKey, row.percentage);
    if (typeof row.placement_raw === 'string' && row.placement_raw.trim()) {
      labelByPlacement.set(placementKey, row.placement_raw.trim());
    }
  }

  return CANONICAL_SP_PLACEMENTS.map((placement) => ({
    placement_code: placement.placement_code,
    label: labelByPlacement.get(placement.placement_code) ?? placement.label,
    current_percentage: percentageByPlacement.get(placement.placement_code) ?? null,
  }));
};
