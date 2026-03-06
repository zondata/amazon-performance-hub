import { mapPlacementModifierKey } from '../logbook/aiPack/aiPackV3Helpers';
import type {
  SpCurrentAdGroupContext,
  SpCurrentCampaignContext,
  SpCurrentPlacementModifier,
  SpTargetFactRow,
} from './spTargetsWorkspaceModel';
import type { SpChangeComposerContext } from '../ads-workspace/spChangeComposer';

type NumericLike = number | string | null | undefined;

export type SpCampaignFactRow = {
  date: string | null;
  exported_at: string | null;
  campaign_id: string | null;
  portfolio_name_raw: string | null;
  campaign_name_raw: string | null;
  impressions: NumericLike;
  clicks: NumericLike;
  spend: NumericLike;
  sales: NumericLike;
  orders: NumericLike;
  units: NumericLike;
};

export type SpCampaignsWorkspaceRow = {
  campaign_id: string;
  ads_type: 'Sponsored Products';
  status: string | null;
  campaign_name: string;
  bidding_strategy: string | null;
  portfolio_name: string | null;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  sales: number;
  conversion: number | null;
  spend: number;
  cpc: number | null;
  ctr: number | null;
  acos: number | null;
  roas: number | null;
  pnl: null;
  coverage_label: string | null;
  coverage_note: string | null;
  composer_context: SpChangeComposerContext;
};

export type SpAdGroupsWorkspaceRow = {
  ad_group_id: string;
  campaign_id: string;
  ads_type: 'Sponsored Products';
  campaign_name: string | null;
  status: string | null;
  ad_group_name: string;
  default_bid: number | null;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  sales: number;
  conversion: number | null;
  spend: number;
  cpc: number | null;
  ctr: number | null;
  acos: number | null;
  roas: number | null;
  pnl: null;
  coverage_label: string | null;
  coverage_note: string | null;
  composer_context: SpChangeComposerContext;
};

export type SpPlacementsWorkspaceRow = {
  id: string;
  campaign_id: string;
  placement_code: string;
  ads_type: 'Sponsored Products';
  portfolio_name: string | null;
  campaign_name: string | null;
  placement_label: string;
  placement_modifier_pct: number | null;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  sales: number;
  conversion: number | null;
  spend: number;
  cpc: number | null;
  ctr: number | null;
  acos: number | null;
  roas: number | null;
  pnl: null;
  coverage_label: string | null;
  coverage_note: string | null;
  composer_context: SpChangeComposerContext;
};

export type SpWorkspaceSummaryTotals = {
  entity_count: number;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  sales: number;
  spend: number;
  conversion: number | null;
  cpc: number | null;
  ctr: number | null;
  acos: number | null;
  roas: number | null;
};

type CampaignAccumulator = {
  campaign_id: string;
  portfolio_name: string | null;
  campaign_name: string | null;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  sales: number;
  spend: number;
};

type AdGroupAccumulator = {
  ad_group_id: string;
  campaign_id: string;
  portfolio_name: string | null;
  campaign_name: string | null;
  ad_group_name: string | null;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  sales: number;
  spend: number;
};

type PlacementAccumulator = {
  id: string;
  campaign_id: string;
  placement_code: string;
  placement_label: string;
  portfolio_name: string | null;
  campaign_name: string | null;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  sales: number;
  spend: number;
};

const numberValue = (value: NumericLike): number => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeDivide = (numerator: number, denominator: number): number | null => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
};

const trimString = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const formatState = (value: string | null | undefined): string | null => {
  const normalized = trimString(value);
  if (!normalized) return null;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
};

const buildTopPlacementModifierMap = (rows: SpCurrentPlacementModifier[]) => {
  const byCampaign = new Map<string, number | null>();
  for (const row of rows) {
    const key = mapPlacementModifierKey('sp', row.placement_code, row.placement_raw);
    if (key !== 'PLACEMENT_TOP') continue;
    byCampaign.set(row.campaign_id, row.percentage);
  }
  return byCampaign;
};

const buildPlacementModifierMap = (rows: SpCurrentPlacementModifier[]) => {
  const byPlacement = new Map<string, number | null>();
  for (const row of rows) {
    byPlacement.set(`${row.campaign_id}::${row.placement_code}`, row.percentage);
  }
  return byPlacement;
};

const buildCoverage = (campaignId: string, ambiguousCampaignIds: Set<string>) => {
  if (!ambiguousCampaignIds.has(campaignId)) {
    return {
      coverage_label: null,
      coverage_note: null,
    };
  }
  return {
    coverage_label: 'Shared campaign',
    coverage_note:
      'This campaign served more than one advertised ASIN in the selected window. Metrics remain full entity totals.',
  };
};

const buildTotals = <TRow extends {
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  sales: number;
  spend: number;
}>(rows: TRow[]): SpWorkspaceSummaryTotals => {
  const totals = rows.reduce(
    (acc, row) => {
      acc.entity_count += 1;
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.orders += row.orders;
      acc.units += row.units;
      acc.sales += row.sales;
      acc.spend += row.spend;
      return acc;
    },
    {
      entity_count: 0,
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: 0,
      sales: 0,
      spend: 0,
      conversion: null as number | null,
      cpc: null as number | null,
      ctr: null as number | null,
      acos: null as number | null,
      roas: null as number | null,
    }
  );

  return {
    ...totals,
    conversion: safeDivide(totals.orders, totals.clicks),
    cpc: safeDivide(totals.spend, totals.clicks),
    ctr: safeDivide(totals.clicks, totals.impressions),
    acos: safeDivide(totals.spend, totals.sales),
    roas: safeDivide(totals.sales, totals.spend),
  };
};

export const buildSpCampaignsWorkspaceModel = (params: {
  campaignRows: SpCampaignFactRow[];
  currentCampaignsById?: Map<string, SpCurrentCampaignContext>;
  currentPlacementModifiers?: SpCurrentPlacementModifier[];
  ambiguousCampaignIds?: Set<string>;
}) => {
  const currentCampaignsById = params.currentCampaignsById ?? new Map<string, SpCurrentCampaignContext>();
  const ambiguousCampaignIds = params.ambiguousCampaignIds ?? new Set<string>();
  const topPlacementModifierByCampaign = buildTopPlacementModifierMap(
    params.currentPlacementModifiers ?? []
  );
  const byCampaign = new Map<string, CampaignAccumulator>();

  for (const row of params.campaignRows) {
    const campaignId = trimString(row.campaign_id);
    if (!campaignId) continue;

    const existing = byCampaign.get(campaignId) ?? {
      campaign_id: campaignId,
      portfolio_name: trimString(row.portfolio_name_raw),
      campaign_name: trimString(row.campaign_name_raw),
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: 0,
      sales: 0,
      spend: 0,
    };

    existing.impressions += numberValue(row.impressions);
    existing.clicks += numberValue(row.clicks);
    existing.orders += numberValue(row.orders);
    existing.units += numberValue(row.units);
    existing.sales += numberValue(row.sales);
    existing.spend += numberValue(row.spend);
    byCampaign.set(campaignId, existing);
  }

  const rows = Array.from(byCampaign.values())
    .map((campaign) => {
      const currentCampaign = currentCampaignsById.get(campaign.campaign_id);
      const coverage = buildCoverage(campaign.campaign_id, ambiguousCampaignIds);
      return {
        campaign_id: campaign.campaign_id,
        ads_type: 'Sponsored Products',
        status: formatState(currentCampaign?.state),
        campaign_name:
          trimString(currentCampaign?.campaign_name_raw) ??
          campaign.campaign_name ??
          campaign.campaign_id,
        bidding_strategy: trimString(currentCampaign?.bidding_strategy),
        portfolio_name: campaign.portfolio_name,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        orders: campaign.orders,
        units: campaign.units,
        sales: campaign.sales,
        conversion: safeDivide(campaign.orders, campaign.clicks),
        spend: campaign.spend,
        cpc: safeDivide(campaign.spend, campaign.clicks),
        ctr: safeDivide(campaign.clicks, campaign.impressions),
        acos: safeDivide(campaign.spend, campaign.sales),
        roas: safeDivide(campaign.sales, campaign.spend),
        pnl: null,
        ...coverage,
        composer_context: {
          channel: 'sp',
          surface: 'campaigns',
          target: null,
          ad_group: null,
          campaign: {
            id: campaign.campaign_id,
            name:
              trimString(currentCampaign?.campaign_name_raw) ?? campaign.campaign_name,
            current_state: trimString(currentCampaign?.state),
            current_budget:
              currentCampaign?.daily_budget !== undefined && currentCampaign?.daily_budget !== null
                ? currentCampaign.daily_budget
                : null,
            current_bidding_strategy: trimString(currentCampaign?.bidding_strategy),
          },
          placement: {
            placement_code: 'PLACEMENT_TOP',
            label: 'Top of Search (first page)',
            current_percentage: topPlacementModifierByCampaign.get(campaign.campaign_id) ?? null,
          },
          coverage_note: coverage.coverage_note,
        },
      } satisfies SpCampaignsWorkspaceRow;
    })
    .sort((left, right) => {
      if (left.spend !== right.spend) return right.spend - left.spend;
      return left.campaign_name.localeCompare(right.campaign_name);
    });

  return {
    rows,
    totals: buildTotals(rows),
  };
};

export const buildSpAdGroupsWorkspaceModel = (params: {
  targetRows: SpTargetFactRow[];
  currentAdGroupsById?: Map<string, SpCurrentAdGroupContext>;
  currentCampaignsById?: Map<string, SpCurrentCampaignContext>;
  currentPlacementModifiers?: SpCurrentPlacementModifier[];
  ambiguousCampaignIds?: Set<string>;
}) => {
  const currentAdGroupsById = params.currentAdGroupsById ?? new Map<string, SpCurrentAdGroupContext>();
  const currentCampaignsById = params.currentCampaignsById ?? new Map<string, SpCurrentCampaignContext>();
  const ambiguousCampaignIds = params.ambiguousCampaignIds ?? new Set<string>();
  const topPlacementModifierByCampaign = buildTopPlacementModifierMap(
    params.currentPlacementModifiers ?? []
  );
  const byAdGroup = new Map<string, AdGroupAccumulator>();

  for (const row of params.targetRows) {
    const adGroupId = trimString(row.ad_group_id);
    const campaignId = trimString(row.campaign_id);
    if (!adGroupId || !campaignId) continue;

    const existing = byAdGroup.get(adGroupId) ?? {
      ad_group_id: adGroupId,
      campaign_id: campaignId,
      portfolio_name: trimString(row.portfolio_name_raw),
      campaign_name: trimString(row.campaign_name_raw),
      ad_group_name: trimString(row.ad_group_name_raw),
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: 0,
      sales: 0,
      spend: 0,
    };

    existing.impressions += numberValue(row.impressions);
    existing.clicks += numberValue(row.clicks);
    existing.orders += numberValue(row.orders);
    existing.units += numberValue(row.units);
    existing.sales += numberValue(row.sales);
    existing.spend += numberValue(row.spend);
    byAdGroup.set(adGroupId, existing);
  }

  const rows = Array.from(byAdGroup.values())
    .map((adGroup) => {
      const currentAdGroup = currentAdGroupsById.get(adGroup.ad_group_id);
      const currentCampaign = currentCampaignsById.get(adGroup.campaign_id);
      const coverage = buildCoverage(adGroup.campaign_id, ambiguousCampaignIds);
      return {
        ad_group_id: adGroup.ad_group_id,
        campaign_id: adGroup.campaign_id,
        ads_type: 'Sponsored Products',
        campaign_name:
          trimString(currentCampaign?.campaign_name_raw) ?? adGroup.campaign_name,
        status: formatState(currentAdGroup?.state),
        ad_group_name:
          trimString(currentAdGroup?.ad_group_name_raw) ??
          adGroup.ad_group_name ??
          adGroup.ad_group_id,
        default_bid:
          currentAdGroup?.default_bid !== undefined && currentAdGroup?.default_bid !== null
            ? currentAdGroup.default_bid
            : null,
        impressions: adGroup.impressions,
        clicks: adGroup.clicks,
        orders: adGroup.orders,
        units: adGroup.units,
        sales: adGroup.sales,
        conversion: safeDivide(adGroup.orders, adGroup.clicks),
        spend: adGroup.spend,
        cpc: safeDivide(adGroup.spend, adGroup.clicks),
        ctr: safeDivide(adGroup.clicks, adGroup.impressions),
        acos: safeDivide(adGroup.spend, adGroup.sales),
        roas: safeDivide(adGroup.sales, adGroup.spend),
        pnl: null,
        ...coverage,
        composer_context: {
          channel: 'sp',
          surface: 'adgroups',
          target: null,
          ad_group: {
            id: adGroup.ad_group_id,
            name:
              trimString(currentAdGroup?.ad_group_name_raw) ?? adGroup.ad_group_name,
            current_state: trimString(currentAdGroup?.state),
            current_default_bid:
              currentAdGroup?.default_bid !== undefined && currentAdGroup?.default_bid !== null
                ? currentAdGroup.default_bid
                : null,
          },
          campaign: {
            id: adGroup.campaign_id,
            name:
              trimString(currentCampaign?.campaign_name_raw) ?? adGroup.campaign_name,
            current_state: trimString(currentCampaign?.state),
            current_budget:
              currentCampaign?.daily_budget !== undefined && currentCampaign?.daily_budget !== null
                ? currentCampaign.daily_budget
                : null,
            current_bidding_strategy: trimString(currentCampaign?.bidding_strategy),
          },
          placement: {
            placement_code: 'PLACEMENT_TOP',
            label: 'Top of Search (first page)',
            current_percentage: topPlacementModifierByCampaign.get(adGroup.campaign_id) ?? null,
          },
          coverage_note: coverage.coverage_note,
        },
      } satisfies SpAdGroupsWorkspaceRow;
    })
    .sort((left, right) => {
      if (left.spend !== right.spend) return right.spend - left.spend;
      return left.ad_group_name.localeCompare(right.ad_group_name);
    });

  return {
    rows,
    totals: buildTotals(rows),
  };
};

export const buildSpPlacementsWorkspaceModel = (params: {
  placementRows: {
    campaign_id: string | null;
    placement_code: string | null;
    placement_raw: string | null;
    portfolio_name_raw: string | null;
    campaign_name_raw: string | null;
    impressions: NumericLike;
    clicks: NumericLike;
    spend: NumericLike;
    sales: NumericLike;
    orders: NumericLike;
    units: NumericLike;
  }[];
  currentCampaignsById?: Map<string, SpCurrentCampaignContext>;
  currentPlacementModifiers?: SpCurrentPlacementModifier[];
  ambiguousCampaignIds?: Set<string>;
}) => {
  const currentCampaignsById = params.currentCampaignsById ?? new Map<string, SpCurrentCampaignContext>();
  const ambiguousCampaignIds = params.ambiguousCampaignIds ?? new Set<string>();
  const placementModifierByKey = buildPlacementModifierMap(params.currentPlacementModifiers ?? []);
  const byPlacement = new Map<string, PlacementAccumulator>();

  for (const row of params.placementRows) {
    const campaignId = trimString(row.campaign_id);
    const placementCode = trimString(row.placement_code);
    if (!campaignId || !placementCode) continue;

    const key = `${campaignId}::${placementCode}`;
    const existing = byPlacement.get(key) ?? {
      id: key,
      campaign_id: campaignId,
      placement_code: placementCode,
      placement_label: trimString(row.placement_raw) ?? placementCode,
      portfolio_name: trimString(row.portfolio_name_raw),
      campaign_name: trimString(row.campaign_name_raw),
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: 0,
      sales: 0,
      spend: 0,
    };

    existing.impressions += numberValue(row.impressions);
    existing.clicks += numberValue(row.clicks);
    existing.orders += numberValue(row.orders);
    existing.units += numberValue(row.units);
    existing.sales += numberValue(row.sales);
    existing.spend += numberValue(row.spend);
    byPlacement.set(key, existing);
  }

  const rows = Array.from(byPlacement.values())
    .map((placement) => {
      const currentCampaign = currentCampaignsById.get(placement.campaign_id);
      const coverage = buildCoverage(placement.campaign_id, ambiguousCampaignIds);
      return {
        id: placement.id,
        campaign_id: placement.campaign_id,
        placement_code: placement.placement_code,
        ads_type: 'Sponsored Products',
        portfolio_name: placement.portfolio_name,
        campaign_name:
          trimString(currentCampaign?.campaign_name_raw) ?? placement.campaign_name,
        placement_label: placement.placement_label,
        placement_modifier_pct: placementModifierByKey.get(placement.id) ?? null,
        impressions: placement.impressions,
        clicks: placement.clicks,
        orders: placement.orders,
        units: placement.units,
        sales: placement.sales,
        conversion: safeDivide(placement.orders, placement.clicks),
        spend: placement.spend,
        cpc: safeDivide(placement.spend, placement.clicks),
        ctr: safeDivide(placement.clicks, placement.impressions),
        acos: safeDivide(placement.spend, placement.sales),
        roas: safeDivide(placement.sales, placement.spend),
        pnl: null,
        ...coverage,
        composer_context: {
          channel: 'sp',
          surface: 'placements',
          target: null,
          ad_group: null,
          campaign: {
            id: placement.campaign_id,
            name:
              trimString(currentCampaign?.campaign_name_raw) ?? placement.campaign_name,
            current_state: trimString(currentCampaign?.state),
            current_budget:
              currentCampaign?.daily_budget !== undefined && currentCampaign?.daily_budget !== null
                ? currentCampaign.daily_budget
                : null,
            current_bidding_strategy: trimString(currentCampaign?.bidding_strategy),
          },
          placement: {
            placement_code: placement.placement_code,
            label: placement.placement_label,
            current_percentage: placementModifierByKey.get(placement.id) ?? null,
          },
          coverage_note: coverage.coverage_note,
        },
      } satisfies SpPlacementsWorkspaceRow;
    })
    .sort((left, right) => {
      if (left.spend !== right.spend) return right.spend - left.spend;
      if ((left.campaign_name ?? '') !== (right.campaign_name ?? '')) {
        return (left.campaign_name ?? '').localeCompare(right.campaign_name ?? '');
      }
      return left.placement_label.localeCompare(right.placement_label);
    });

  return {
    rows,
    totals: buildTotals(rows),
  };
};
