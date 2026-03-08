import type { SpChangeComposerContext } from '../ads-workspace/spChangeComposer';
import { buildSpPlacementModifierContexts } from '../ads-workspace/spPlacementModifiers';
import { mapPlacementModifierKey } from '../logbook/aiPack/aiPackV3Helpers';
import {
  normalizeSpAdvertisedAsin,
  resolveAdvertisedAsinSetForEntity,
} from './spAdvertisedAsinScope';
import type {
  SpCurrentAdGroupContext,
  SpCurrentCampaignContext,
  SpCurrentPlacementModifier,
  SpCurrentTargetContext,
  SpScopeAdvertisedProductRow,
  SpSearchTermFactRow,
} from './spTargetsWorkspaceModel';

type NumericLike = number | string | null | undefined;

type SearchTermChildAccumulator = {
  id: string;
  campaign_id: string;
  ad_group_id: string | null;
  target_id: string | null;
  target_key: string | null;
  campaign_name: string | null;
  ad_group_name: string | null;
  targeting_raw: string | null;
  targeting_norm: string | null;
  match_type_norm: string | null;
  search_term: string;
  search_term_norm: string;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  has_units: boolean;
  sales: number;
  spend: number;
  last_activity: string | null;
};

type SearchTermParentAccumulator = {
  id: string;
  asin: string | null;
  asin_label: string;
  ads_type: 'Sponsored Products';
  search_term: string;
  search_term_norm: string;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  has_units: boolean;
  sales: number;
  spend: number;
  child_rows: Map<string, SearchTermChildAccumulator>;
  coverage_label: string | null;
  coverage_note: string | null;
};

type AsinBucket = {
  key: string;
  asin: string | null;
  asin_label: string;
  coverage_label: string | null;
  coverage_note: string | null;
};

export type SpSearchTermsWorkspaceChildRow = {
  id: string;
  campaign_id: string;
  ad_group_id: string | null;
  target_id: string | null;
  target_key: string | null;
  campaign_name: string | null;
  ad_group_name: string | null;
  target_text: string;
  status: string | null;
  match_type: string | null;
  impressions: number;
  clicks: number;
  orders: number;
  units: number | null;
  sales: number;
  conversion: number | null;
  cost: number;
  current_bid: number | null;
  cpc: number | null;
  acos: number | null;
  roas: number | null;
  coverage_label: string | null;
  coverage_note: string | null;
  composer_context: SpChangeComposerContext;
};

export type SpSearchTermsWorkspaceRow = {
  id: string;
  asin: string | null;
  asin_label: string;
  ads_type: 'Sponsored Products';
  search_term: string;
  search_term_norm: string;
  impressions: number;
  clicks: number;
  orders: number;
  units: number | null;
  spend: number;
  sales: number;
  ctr: number | null;
  cpc: number | null;
  cost_per_order: number | null;
  conversion: number | null;
  acos: number | null;
  roas: number | null;
  pnl: null;
  coverage_label: string | null;
  coverage_note: string | null;
  child_rows: SpSearchTermsWorkspaceChildRow[];
};

export type SpSearchTermsWorkspaceModel = {
  rows: SpSearchTermsWorkspaceRow[];
  totals: {
    search_terms: number;
    impressions: number;
    clicks: number;
    orders: number;
    units: number | null;
    sales: number;
    spend: number;
    ctr: number | null;
    cpc: number | null;
    cost_per_order: number | null;
    conversion: number | null;
    acos: number | null;
    roas: number | null;
  };
  coverage: {
    shared_scope_count: number;
    unattributed_count: number;
  };
};

const numberValue = (value: NumericLike): number => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toFiniteNumberOrNull = (value: NumericLike): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

const normalizeText = (value: string | null | undefined): string | null => {
  const trimmed = trimString(value);
  return trimmed ? trimmed.toLowerCase().replace(/\s+/g, ' ') : null;
};

const updateLastActivity = (current: string | null, candidate: string | null) => {
  if (!candidate) return current;
  if (!current) return candidate;
  return candidate > current ? candidate : current;
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

const buildPlacementModifierContextsByCampaign = (rows: SpCurrentPlacementModifier[]) => {
  const byCampaign = new Map<string, ReturnType<typeof buildSpPlacementModifierContexts>>();
  const campaignIds = new Set(rows.map((row) => row.campaign_id));
  for (const campaignId of campaignIds) {
    byCampaign.set(
      campaignId,
      buildSpPlacementModifierContexts({
        campaignId,
        rows,
      })
    );
  }
  return byCampaign;
};

const buildAsinMaps = (rows: SpScopeAdvertisedProductRow[]) => {
  const byAdGroup = new Map<string, Set<string>>();
  const byCampaign = new Map<string, Set<string>>();

  for (const row of rows) {
    const asin = normalizeSpAdvertisedAsin(row.advertised_asin_norm);
    const campaignId = trimString(row.campaign_id);
    const adGroupId = trimString(row.ad_group_id);
    if (!asin) continue;

    if (campaignId) {
      const seen = byCampaign.get(campaignId) ?? new Set<string>();
      seen.add(asin);
      byCampaign.set(campaignId, seen);
    }

    if (adGroupId) {
      const seen = byAdGroup.get(adGroupId) ?? new Set<string>();
      seen.add(asin);
      byAdGroup.set(adGroupId, seen);
    }
  }

  return { byAdGroup, byCampaign };
};

const resolveAsinBucket = (params: {
  asinFilter: string;
  row: SpSearchTermFactRow;
  asinByAdGroup: Map<string, Set<string>>;
  asinByCampaign: Map<string, Set<string>>;
}): AsinBucket => {
  if (params.asinFilter !== 'all') {
    const selectedAsin = normalizeSpAdvertisedAsin(params.asinFilter) ?? params.asinFilter;
    return {
      key: selectedAsin,
      asin: selectedAsin,
      asin_label: selectedAsin,
      coverage_label: null,
      coverage_note: null,
    };
  }

  const resolvedAsins = resolveAdvertisedAsinSetForEntity({
    adGroupId: params.row.ad_group_id,
    campaignId: params.row.campaign_id,
    asinByAdGroup: params.asinByAdGroup,
    asinByCampaign: params.asinByCampaign,
  });

  if (!resolvedAsins || resolvedAsins.size === 0) {
    return {
      key: '__unattributed__',
      asin: null,
      asin_label: 'Unattributed',
      coverage_label: 'ASIN fallback',
      coverage_note:
        'No advertised-ASIN mapping was found for this search-term row in the selected window. It is grouped under an explicit fallback bucket.',
    };
  }

  if (resolvedAsins.size > 1) {
    return {
      key: '__shared__',
      asin: null,
      asin_label: 'Multiple ASINs',
      coverage_label: 'Shared scope',
      coverage_note:
        'This search-term row matched more than one advertised ASIN in the selected window. It stays grouped under a shared bucket to avoid metric double counting.',
    };
  }

  const asin = [...resolvedAsins][0] ?? null;
  return {
    key: asin ?? '__unattributed__',
    asin,
    asin_label: asin ?? 'Unattributed',
    coverage_label: null,
    coverage_note: null,
  };
};

const buildCoverage = (params: {
  parentCoverageLabel: string | null;
  parentCoverageNote: string | null;
  campaignId: string;
  ambiguousCampaignIds: Set<string>;
}) => {
  if (params.parentCoverageLabel || params.parentCoverageNote) {
    return {
      coverage_label: params.parentCoverageLabel,
      coverage_note: params.parentCoverageNote,
    };
  }

  if (!params.ambiguousCampaignIds.has(params.campaignId)) {
    return {
      coverage_label: null,
      coverage_note: null,
    };
  }

  return {
    coverage_label: 'Shared campaign',
    coverage_note:
      'This campaign served more than one advertised ASIN in the selected window. Metrics remain full entity totals, not ASIN-only slices.',
  };
};

export const buildSpSearchTermsWorkspaceModel = (params: {
  searchTermRows: SpSearchTermFactRow[];
  asinFilter: string;
  scopedAdvertisedProductRows: SpScopeAdvertisedProductRow[];
  currentTargetsById?: Map<string, SpCurrentTargetContext>;
  currentAdGroupsById?: Map<string, SpCurrentAdGroupContext>;
  currentCampaignsById?: Map<string, SpCurrentCampaignContext>;
  currentPlacementModifiers?: SpCurrentPlacementModifier[];
  ambiguousCampaignIds?: Set<string>;
}): SpSearchTermsWorkspaceModel => {
  const currentTargetsById = params.currentTargetsById ?? new Map<string, SpCurrentTargetContext>();
  const currentAdGroupsById = params.currentAdGroupsById ?? new Map<string, SpCurrentAdGroupContext>();
  const currentCampaignsById = params.currentCampaignsById ?? new Map<string, SpCurrentCampaignContext>();
  const currentPlacementModifiers = params.currentPlacementModifiers ?? [];
  const ambiguousCampaignIds = params.ambiguousCampaignIds ?? new Set<string>();
  const topPlacementModifierByCampaign = buildTopPlacementModifierMap(currentPlacementModifiers);
  const placementModifierContextsByCampaign = buildPlacementModifierContextsByCampaign(
    currentPlacementModifiers
  );
  const { byAdGroup, byCampaign } = buildAsinMaps(params.scopedAdvertisedProductRows);

  const byParent = new Map<string, SearchTermParentAccumulator>();

  for (const row of params.searchTermRows) {
    const campaignId = trimString(row.campaign_id);
    const searchTermNorm = normalizeText(row.customer_search_term_norm ?? row.customer_search_term_raw);
    const searchTerm = trimString(row.customer_search_term_raw) ?? trimString(row.customer_search_term_norm);
    if (!campaignId || !searchTermNorm || !searchTerm) continue;

    const asinBucket = resolveAsinBucket({
      asinFilter: params.asinFilter,
      row,
      asinByAdGroup: byAdGroup,
      asinByCampaign: byCampaign,
    });
    const parentKey = `${asinBucket.key}::sp::${searchTermNorm}`;
    const parent = byParent.get(parentKey) ?? {
      id: parentKey,
      asin: asinBucket.asin,
      asin_label: asinBucket.asin_label,
      ads_type: 'Sponsored Products' as const,
      search_term: searchTerm,
      search_term_norm: searchTermNorm,
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: 0,
      has_units: false,
      sales: 0,
      spend: 0,
      child_rows: new Map<string, SearchTermChildAccumulator>(),
      coverage_label: asinBucket.coverage_label,
      coverage_note: asinBucket.coverage_note,
    };

    parent.impressions += numberValue(row.impressions);
    parent.clicks += numberValue(row.clicks);
    parent.orders += numberValue(row.orders);
    const nextParentUnits = toFiniteNumberOrNull(row.units);
    if (nextParentUnits !== null) {
      parent.units += nextParentUnits;
      parent.has_units = true;
    }
    parent.sales += numberValue(row.sales);
    parent.spend += numberValue(row.spend);

    const adGroupId = trimString(row.ad_group_id);
    const targetId = trimString(row.target_id);
    const targetKey = trimString(row.target_key);
    const childKey = [
      campaignId,
      adGroupId ?? '',
      targetId ?? targetKey ?? normalizeText(row.targeting_norm) ?? '__unresolved_target__',
    ].join('::');

    const child = parent.child_rows.get(childKey) ?? {
      id: `${parentKey}::${childKey}`,
      campaign_id: campaignId,
      ad_group_id: adGroupId,
      target_id: targetId,
      target_key: targetKey,
      campaign_name: trimString(row.campaign_name_raw),
      ad_group_name: trimString(row.ad_group_name_raw),
      targeting_raw: trimString(row.targeting_raw),
      targeting_norm: normalizeText(row.targeting_norm),
      match_type_norm: trimString(row.match_type_norm),
      search_term: searchTerm,
      search_term_norm: searchTermNorm,
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: 0,
      has_units: false,
      sales: 0,
      spend: 0,
      last_activity: null,
    };

    child.impressions += numberValue(row.impressions);
    child.clicks += numberValue(row.clicks);
    child.orders += numberValue(row.orders);
    const nextChildUnits = toFiniteNumberOrNull(row.units);
    if (nextChildUnits !== null) {
      child.units += nextChildUnits;
      child.has_units = true;
    }
    child.sales += numberValue(row.sales);
    child.spend += numberValue(row.spend);
    child.last_activity = updateLastActivity(child.last_activity, trimString(row.date));

    parent.child_rows.set(childKey, child);
    byParent.set(parentKey, parent);
  }

  const rows = Array.from(byParent.values())
    .map((parent) => {
      const childRows = Array.from(parent.child_rows.values())
        .map((child) => {
          const currentTarget = child.target_id
            ? currentTargetsById.get(child.target_id)
            : undefined;
          const currentAdGroup = child.ad_group_id
            ? currentAdGroupsById.get(child.ad_group_id)
            : undefined;
          const currentCampaign = currentCampaignsById.get(child.campaign_id);
          const coverage = buildCoverage({
            parentCoverageLabel: parent.coverage_label,
            parentCoverageNote: parent.coverage_note,
            campaignId: child.campaign_id,
            ambiguousCampaignIds,
          });
          const targetText =
            trimString(currentTarget?.expression_raw) ??
            child.targeting_raw ??
            child.targeting_norm ??
            child.target_id ??
            child.target_key ??
            '—';

          return {
            id: child.id,
            campaign_id: child.campaign_id,
            ad_group_id:
              currentTarget?.ad_group_id ?? currentAdGroup?.ad_group_id ?? child.ad_group_id,
            target_id: child.target_id,
            target_key: child.target_key,
            campaign_name:
              trimString(currentCampaign?.campaign_name_raw) ?? child.campaign_name,
            ad_group_name:
              trimString(currentAdGroup?.ad_group_name_raw) ?? child.ad_group_name,
            target_text: targetText,
            status: formatState(currentTarget?.state),
            match_type: trimString(currentTarget?.match_type) ?? child.match_type_norm,
            impressions: child.impressions,
            clicks: child.clicks,
            orders: child.orders,
            units: child.has_units ? child.units : null,
            sales: child.sales,
            conversion: safeDivide(child.orders, child.clicks),
            cost: child.spend,
            current_bid:
              currentTarget?.bid !== undefined && currentTarget?.bid !== null
                ? currentTarget.bid
                : null,
            cpc: safeDivide(child.spend, child.clicks),
            acos: safeDivide(child.spend, child.sales),
            roas: safeDivide(child.sales, child.spend),
            coverage_label: coverage.coverage_label,
            coverage_note: coverage.coverage_note,
            composer_context: {
              channel: 'sp',
              surface: 'searchterms',
              target: child.target_id
                ? {
                    id: child.target_id,
                    text: targetText,
                    match_type: trimString(currentTarget?.match_type) ?? child.match_type_norm,
                    is_negative: currentTarget?.is_negative ?? false,
                    current_state: trimString(currentTarget?.state),
                    current_bid:
                      currentTarget?.bid !== undefined && currentTarget?.bid !== null
                        ? currentTarget.bid
                        : null,
                  }
                : null,
              ad_group: (currentAdGroup || child.ad_group_id)
                ? {
                    id: currentAdGroup?.ad_group_id ?? child.ad_group_id ?? '',
                    name:
                      trimString(currentAdGroup?.ad_group_name_raw) ?? child.ad_group_name,
                    current_state: trimString(currentAdGroup?.state),
                    current_default_bid:
                      currentAdGroup?.default_bid !== undefined &&
                      currentAdGroup?.default_bid !== null
                        ? currentAdGroup.default_bid
                        : null,
                  }
                : null,
              campaign: {
                id: child.campaign_id,
                name:
                  trimString(currentCampaign?.campaign_name_raw) ?? child.campaign_name,
                current_state: trimString(currentCampaign?.state),
                current_budget:
                  currentCampaign?.daily_budget !== undefined &&
                  currentCampaign?.daily_budget !== null
                    ? currentCampaign.daily_budget
                    : null,
                current_bidding_strategy: trimString(currentCampaign?.bidding_strategy),
              },
              placement: {
                placement_code: 'PLACEMENT_TOP',
                label: 'Top of Search (first page)',
                current_percentage:
                  topPlacementModifierByCampaign.get(child.campaign_id) ?? null,
              },
              placements: placementModifierContextsByCampaign.get(child.campaign_id) ?? [],
              coverage_note: coverage.coverage_note,
            },
          } satisfies SpSearchTermsWorkspaceChildRow;
        })
        .sort((left, right) => {
          if (left.cost !== right.cost) return right.cost - left.cost;
          if ((left.campaign_name ?? '') !== (right.campaign_name ?? '')) {
            return (left.campaign_name ?? '').localeCompare(right.campaign_name ?? '');
          }
          return left.target_text.localeCompare(right.target_text);
        });

      const hasSharedCampaignCoverage =
        !parent.coverage_label &&
        childRows.some((row) => row.coverage_label === 'Shared campaign');

      return {
        id: parent.id,
        asin: parent.asin,
        asin_label: parent.asin_label,
        ads_type: parent.ads_type,
        search_term: parent.search_term,
        search_term_norm: parent.search_term_norm,
        impressions: parent.impressions,
        clicks: parent.clicks,
        orders: parent.orders,
        units: parent.has_units ? parent.units : null,
        spend: parent.spend,
        sales: parent.sales,
        ctr: safeDivide(parent.clicks, parent.impressions),
        cpc: safeDivide(parent.spend, parent.clicks),
        cost_per_order: safeDivide(parent.spend, parent.orders),
        conversion: safeDivide(parent.orders, parent.clicks),
        acos: safeDivide(parent.spend, parent.sales),
        roas: safeDivide(parent.sales, parent.spend),
        pnl: null,
        coverage_label: hasSharedCampaignCoverage ? 'Shared campaign' : parent.coverage_label,
        coverage_note: hasSharedCampaignCoverage
          ? 'At least one child row belongs to a campaign that served more than one advertised ASIN in the selected window. Metrics remain full entity totals.'
          : parent.coverage_note,
        child_rows: childRows,
      } satisfies SpSearchTermsWorkspaceRow;
    })
    .sort((left, right) => {
      if (left.spend !== right.spend) return right.spend - left.spend;
      if (left.asin_label !== right.asin_label) {
        return left.asin_label.localeCompare(right.asin_label);
      }
      return left.search_term.localeCompare(right.search_term);
    });

  const totals = rows.reduce(
    (acc, row) => {
      acc.search_terms += 1;
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.orders += row.orders;
      if (row.units !== null) {
        acc.units = (acc.units ?? 0) + row.units;
      }
      acc.sales += row.sales;
      acc.spend += row.spend;
      return acc;
    },
    {
      search_terms: 0,
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: null as number | null,
      sales: 0,
      spend: 0,
      ctr: null as number | null,
      cpc: null as number | null,
      cost_per_order: null as number | null,
      conversion: null as number | null,
      acos: null as number | null,
      roas: null as number | null,
    }
  );

  return {
    rows,
    totals: {
      ...totals,
      ctr: safeDivide(totals.clicks, totals.impressions),
      cpc: safeDivide(totals.spend, totals.clicks),
      cost_per_order: safeDivide(totals.spend, totals.orders),
      conversion: safeDivide(totals.orders, totals.clicks),
      acos: safeDivide(totals.spend, totals.sales),
      roas: safeDivide(totals.sales, totals.spend),
    },
    coverage: {
      shared_scope_count: rows.filter((row) => row.asin_label === 'Multiple ASINs').length,
      unattributed_count: rows.filter((row) => row.asin_label === 'Unattributed').length,
    },
  };
};
