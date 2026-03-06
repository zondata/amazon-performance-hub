import { mapPlacementModifierKey } from '../logbook/aiPack/aiPackV3Helpers';

type NumericLike = number | string | null | undefined;

export type SpScopeAdvertisedProductRow = {
  campaign_id: string | null;
  ad_group_id: string | null;
  advertised_asin_norm: string | null;
};

export type SpScopeSummary = {
  campaignIds: string[];
  adGroupIds: string[];
  ambiguousCampaignIds: Set<string>;
};

export type SpTargetFactRow = {
  date: string | null;
  exported_at: string | null;
  target_id: string | null;
  campaign_id: string | null;
  ad_group_id: string | null;
  portfolio_name_raw: string | null;
  campaign_name_raw: string | null;
  ad_group_name_raw: string | null;
  targeting_raw: string | null;
  targeting_norm: string | null;
  match_type_norm: string | null;
  impressions: NumericLike;
  clicks: NumericLike;
  spend: NumericLike;
  sales: NumericLike;
  orders: NumericLike;
  units: NumericLike;
  top_of_search_impression_share: NumericLike;
};

export type SpSearchTermFactRow = {
  date: string | null;
  exported_at: string | null;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  target_key: string | null;
  targeting_norm: string | null;
  customer_search_term_raw: string | null;
  customer_search_term_norm: string | null;
  search_term_impression_share: NumericLike;
  search_term_impression_rank: NumericLike;
  impressions: NumericLike;
  clicks: NumericLike;
  spend: NumericLike;
  sales: NumericLike;
  orders: NumericLike;
  units: NumericLike;
};

export type SpPlacementFactRow = {
  campaign_id: string | null;
  placement_code: string | null;
  placement_raw: string | null;
  placement_raw_norm: string | null;
  impressions: NumericLike;
  clicks: NumericLike;
  spend: NumericLike;
  sales: NumericLike;
  orders: NumericLike;
  units: NumericLike;
};

export type SpCurrentTargetContext = {
  target_id: string;
  ad_group_id: string | null;
  campaign_id: string | null;
  expression_raw: string;
  match_type: string;
  is_negative: boolean;
  state: string | null;
};

export type SpCurrentAdGroupContext = {
  ad_group_id: string;
  campaign_id: string;
  ad_group_name_raw: string;
};

export type SpCurrentCampaignContext = {
  campaign_id: string;
  campaign_name_raw: string;
};

export type SpCurrentPlacementModifier = {
  campaign_id: string;
  placement_code: string;
  placement_raw: string;
  percentage: number;
};

export type SpTargetsWorkspaceChildRow = {
  id: string;
  search_term: string;
  search_term_norm: string | null;
  same_text: boolean;
  stis: number | null;
  stir: number | null;
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
  last_activity: string | null;
};

export type SpTargetsPlacementContext = {
  top_of_search_modifier_pct: number | null;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  sales: number;
  spend: number;
};

export type SpTargetsWorkspaceRow = {
  target_id: string;
  campaign_id: string;
  ad_group_id: string | null;
  status: string | null;
  target_text: string;
  type_label: string;
  portfolio_name: string | null;
  campaign_name: string | null;
  ad_group_name: string | null;
  match_type: string | null;
  stis: number | null;
  stir: number | null;
  tos_is: number | null;
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
  break_even_bid: null;
  last_activity: string | null;
  coverage_label: string | null;
  coverage_note: string | null;
  search_terms: SpTargetsWorkspaceChildRow[];
  placement_context: SpTargetsPlacementContext | null;
};

export type SpTargetsWorkspaceModel = {
  rows: SpTargetsWorkspaceRow[];
  totals: {
    targets: number;
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
};

type TargetAccumulator = {
  target_id: string;
  campaign_id: string;
  ad_group_id: string | null;
  portfolio_name: string | null;
  campaign_name: string | null;
  ad_group_name: string | null;
  targeting_raw: string | null;
  targeting_norm: string | null;
  match_type_norm: string | null;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  sales: number;
  spend: number;
  last_activity: string | null;
  stis: { value: number | null; date: string | null; exported_at: string | null } | null;
};

type SearchTermAccumulator = {
  id: string;
  search_term: string;
  search_term_norm: string | null;
  targeting_norm: string | null;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  sales: number;
  spend: number;
  last_activity: string | null;
  stis: { value: number | null; date: string | null; exported_at: string | null } | null;
  stir: { value: number | null; date: string | null; exported_at: string | null } | null;
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

const compareDiagnostic = (
  left: { date: string | null; exported_at: string | null } | null,
  right: { date: string | null; exported_at: string | null } | null
) => {
  if (!left) return -1;
  if (!right) return 1;
  const leftDate = left.date ?? '';
  const rightDate = right.date ?? '';
  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }
  return (left.exported_at ?? '').localeCompare(right.exported_at ?? '');
};

const updateLastActivity = (current: string | null, candidate: string | null) => {
  if (!candidate) return current;
  if (!current) return candidate;
  return candidate > current ? candidate : current;
};

const targetTypeLabel = (
  currentTarget: SpCurrentTargetContext | undefined,
  fallbackMatchType: string | null
): string => {
  const matchType = trimString(currentTarget?.match_type) ?? trimString(fallbackMatchType);
  const isProductTargeting = matchType === 'TARGETING_EXPRESSION';
  if (currentTarget?.is_negative && isProductTargeting) return 'Negative product';
  if (currentTarget?.is_negative) return 'Negative keyword';
  if (isProductTargeting) return 'Product targeting';
  return 'Keyword';
};

const formatState = (value: string | null | undefined): string | null => {
  const normalized = trimString(value);
  if (!normalized) return null;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
};

export const resolveSpProductScopeSummary = (params: {
  selectedRows: SpScopeAdvertisedProductRow[];
  scopedRows: SpScopeAdvertisedProductRow[];
}): SpScopeSummary => {
  const campaignIds = new Set<string>();
  const adGroupIds = new Set<string>();

  for (const row of params.selectedRows) {
    const campaignId = trimString(row.campaign_id);
    const adGroupId = trimString(row.ad_group_id);
    if (campaignId) campaignIds.add(campaignId);
    if (adGroupId) adGroupIds.add(adGroupId);
  }

  const asinByCampaign = new Map<string, Set<string>>();
  for (const row of params.scopedRows) {
    const campaignId = trimString(row.campaign_id);
    const asinNorm = normalizeText(row.advertised_asin_norm);
    if (!campaignId || !asinNorm) continue;
    const seen = asinByCampaign.get(campaignId) ?? new Set<string>();
    seen.add(asinNorm);
    asinByCampaign.set(campaignId, seen);
  }

  const ambiguousCampaignIds = new Set<string>();
  for (const [campaignId, asinNorms] of asinByCampaign.entries()) {
    if (asinNorms.size > 1) {
      ambiguousCampaignIds.add(campaignId);
    }
  }

  return {
    campaignIds: [...campaignIds].sort((left, right) => left.localeCompare(right)),
    adGroupIds: [...adGroupIds].sort((left, right) => left.localeCompare(right)),
    ambiguousCampaignIds,
  };
};

const buildPlacementContextByCampaign = (
  placementRows: SpPlacementFactRow[],
  modifiers: Map<string, number | null>
) => {
  const byCampaign = new Map<string, SpTargetsPlacementContext>();

  for (const row of placementRows) {
    const campaignId = trimString(row.campaign_id);
    if (!campaignId) continue;
    const key = mapPlacementModifierKey(
      'sp',
      row.placement_code,
      row.placement_raw_norm ?? row.placement_raw
    );
    if (key !== 'PLACEMENT_TOP') continue;

    const existing = byCampaign.get(campaignId) ?? {
      top_of_search_modifier_pct: modifiers.get(campaignId) ?? null,
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

  return byCampaign;
};

const buildSearchTermsByTarget = (rows: SpSearchTermFactRow[]) => {
  const byTarget = new Map<string, Map<string, SearchTermAccumulator>>();

  for (const row of rows) {
    const targetId = trimString(row.target_id);
    const searchTermNorm = normalizeText(row.customer_search_term_norm ?? row.customer_search_term_raw);
    const searchTerm = trimString(row.customer_search_term_raw) ?? trimString(row.customer_search_term_norm);
    if (!targetId || !searchTermNorm || !searchTerm) continue;

    const targetMap = byTarget.get(targetId) ?? new Map<string, SearchTermAccumulator>();
    const existing = targetMap.get(searchTermNorm) ?? {
      id: `${targetId}::${searchTermNorm}`,
      search_term: searchTerm,
      search_term_norm: searchTermNorm,
      targeting_norm: normalizeText(row.targeting_norm),
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: 0,
      sales: 0,
      spend: 0,
      last_activity: null,
      stis: null,
      stir: null,
    };

    existing.impressions += numberValue(row.impressions);
    existing.clicks += numberValue(row.clicks);
    existing.orders += numberValue(row.orders);
    existing.units += numberValue(row.units);
    existing.sales += numberValue(row.sales);
    existing.spend += numberValue(row.spend);
    existing.last_activity = updateLastActivity(existing.last_activity, trimString(row.date));

    const nextStisValue = toFiniteNumberOrNull(row.search_term_impression_share);
    if (nextStisValue !== null) {
      const nextStis = {
        value: nextStisValue,
        date: trimString(row.date),
        exported_at: trimString(row.exported_at),
      };
      if (compareDiagnostic(existing.stis, nextStis) <= 0) {
        existing.stis = nextStis;
      }
    }

    const nextStirValue = toFiniteNumberOrNull(row.search_term_impression_rank);
    if (nextStirValue !== null) {
      const nextStir = {
        value: nextStirValue,
        date: trimString(row.date),
        exported_at: trimString(row.exported_at),
      };
      if (compareDiagnostic(existing.stir, nextStir) <= 0) {
        existing.stir = nextStir;
      }
    }

    targetMap.set(searchTermNorm, existing);
    byTarget.set(targetId, targetMap);
  }

  return byTarget;
};

export const buildSpTargetsWorkspaceModel = (params: {
  targetRows: SpTargetFactRow[];
  searchTermRows: SpSearchTermFactRow[];
  placementRows: SpPlacementFactRow[];
  currentTargetsById?: Map<string, SpCurrentTargetContext>;
  currentAdGroupsById?: Map<string, SpCurrentAdGroupContext>;
  currentCampaignsById?: Map<string, SpCurrentCampaignContext>;
  currentPlacementModifiers?: SpCurrentPlacementModifier[];
  ambiguousCampaignIds?: Set<string>;
}): SpTargetsWorkspaceModel => {
  const currentTargetsById = params.currentTargetsById ?? new Map<string, SpCurrentTargetContext>();
  const currentAdGroupsById = params.currentAdGroupsById ?? new Map<string, SpCurrentAdGroupContext>();
  const currentCampaignsById = params.currentCampaignsById ?? new Map<string, SpCurrentCampaignContext>();
  const ambiguousCampaignIds = params.ambiguousCampaignIds ?? new Set<string>();

  const topPlacementModifierByCampaign = new Map<string, number | null>();
  for (const row of params.currentPlacementModifiers ?? []) {
    const key = mapPlacementModifierKey('sp', row.placement_code, row.placement_raw);
    if (key !== 'PLACEMENT_TOP') continue;
    topPlacementModifierByCampaign.set(row.campaign_id, row.percentage);
  }

  const placementContextByCampaign = buildPlacementContextByCampaign(
    params.placementRows,
    topPlacementModifierByCampaign
  );
  const searchTermsByTarget = buildSearchTermsByTarget(params.searchTermRows);
  const byTarget = new Map<string, TargetAccumulator>();

  for (const row of params.targetRows) {
    const targetId = trimString(row.target_id);
    const campaignId = trimString(row.campaign_id);
    if (!targetId || !campaignId) continue;

    const existing = byTarget.get(targetId) ?? {
      target_id: targetId,
      campaign_id: campaignId,
      ad_group_id: trimString(row.ad_group_id),
      portfolio_name: trimString(row.portfolio_name_raw),
      campaign_name: trimString(row.campaign_name_raw),
      ad_group_name: trimString(row.ad_group_name_raw),
      targeting_raw: trimString(row.targeting_raw),
      targeting_norm: normalizeText(row.targeting_norm),
      match_type_norm: trimString(row.match_type_norm),
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: 0,
      sales: 0,
      spend: 0,
      last_activity: null,
      stis: null,
    };

    existing.impressions += numberValue(row.impressions);
    existing.clicks += numberValue(row.clicks);
    existing.orders += numberValue(row.orders);
    existing.units += numberValue(row.units);
    existing.sales += numberValue(row.sales);
    existing.spend += numberValue(row.spend);
    existing.last_activity = updateLastActivity(existing.last_activity, trimString(row.date));

    const nextStisValue = toFiniteNumberOrNull(row.top_of_search_impression_share);
    if (nextStisValue !== null) {
      const nextDiagnostic = {
        value: nextStisValue,
        date: trimString(row.date),
        exported_at: trimString(row.exported_at),
      };
      if (compareDiagnostic(existing.stis, nextDiagnostic) <= 0) {
        existing.stis = nextDiagnostic;
      }
    }

    byTarget.set(targetId, existing);
  }

  const rows = Array.from(byTarget.values())
    .map((target) => {
      const currentTarget = currentTargetsById.get(target.target_id);
      const currentAdGroup = target.ad_group_id
        ? currentAdGroupsById.get(target.ad_group_id)
        : undefined;
      const currentCampaign = currentCampaignsById.get(target.campaign_id);
      const searchTerms = [...(searchTermsByTarget.get(target.target_id)?.values() ?? [])]
        .map((searchTerm) => {
          const sameText =
            searchTerm.search_term_norm !== null &&
            searchTerm.search_term_norm === normalizeText(searchTerm.targeting_norm ?? target.targeting_norm);
          return {
            id: searchTerm.id,
            search_term: searchTerm.search_term,
            search_term_norm: searchTerm.search_term_norm,
            same_text: sameText,
            stis: searchTerm.stis?.value ?? null,
            stir: searchTerm.stir?.value ?? null,
            impressions: searchTerm.impressions,
            clicks: searchTerm.clicks,
            orders: searchTerm.orders,
            units: searchTerm.units,
            sales: searchTerm.sales,
            spend: searchTerm.spend,
            conversion: safeDivide(searchTerm.orders, searchTerm.clicks),
            cpc: safeDivide(searchTerm.spend, searchTerm.clicks),
            ctr: safeDivide(searchTerm.clicks, searchTerm.impressions),
            acos: safeDivide(searchTerm.spend, searchTerm.sales),
            roas: safeDivide(searchTerm.sales, searchTerm.spend),
            last_activity: searchTerm.last_activity,
          } satisfies SpTargetsWorkspaceChildRow;
        })
        .sort((left, right) => {
          if (left.same_text !== right.same_text) return left.same_text ? -1 : 1;
          if (left.spend !== right.spend) return right.spend - left.spend;
          return left.search_term.localeCompare(right.search_term);
        });

      const sameTextSearchTerm = searchTerms.find((row) => row.same_text) ?? null;

      return {
        target_id: target.target_id,
        campaign_id: target.campaign_id,
        ad_group_id: currentTarget?.ad_group_id ?? currentAdGroup?.ad_group_id ?? target.ad_group_id,
        status: formatState(currentTarget?.state),
        target_text:
          trimString(currentTarget?.expression_raw) ??
          trimString(target.targeting_raw) ??
          target.targeting_norm ??
          target.target_id,
        type_label: targetTypeLabel(currentTarget, target.match_type_norm),
        portfolio_name: target.portfolio_name,
        campaign_name:
          trimString(currentCampaign?.campaign_name_raw) ?? target.campaign_name,
        ad_group_name:
          trimString(currentAdGroup?.ad_group_name_raw) ?? target.ad_group_name,
        match_type:
          trimString(currentTarget?.match_type) ?? target.match_type_norm,
        stis: target.stis?.value ?? null,
        stir: sameTextSearchTerm?.stir ?? null,
        tos_is: null,
        impressions: target.impressions,
        clicks: target.clicks,
        orders: target.orders,
        units: target.units,
        sales: target.sales,
        conversion: safeDivide(target.orders, target.clicks),
        spend: target.spend,
        cpc: safeDivide(target.spend, target.clicks),
        ctr: safeDivide(target.clicks, target.impressions),
        acos: safeDivide(target.spend, target.sales),
        roas: safeDivide(target.sales, target.spend),
        pnl: null,
        break_even_bid: null,
        last_activity: target.last_activity,
        coverage_label: ambiguousCampaignIds.has(target.campaign_id) ? 'Shared campaign' : null,
        coverage_note: ambiguousCampaignIds.has(target.campaign_id)
          ? 'This campaign served more than one advertised ASIN in the selected window. Metrics remain full entity totals.'
          : null,
        search_terms: searchTerms,
        placement_context: placementContextByCampaign.get(target.campaign_id) ?? null,
      } satisfies SpTargetsWorkspaceRow;
    })
    .sort((left, right) => {
      if (left.spend !== right.spend) return right.spend - left.spend;
      return left.target_text.localeCompare(right.target_text);
    });

  const totals = rows.reduce(
    (acc, row) => {
      acc.targets += 1;
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.orders += row.orders;
      acc.units += row.units;
      acc.sales += row.sales;
      acc.spend += row.spend;
      return acc;
    },
    {
      targets: 0,
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
    rows,
    totals: {
      ...totals,
      conversion: safeDivide(totals.orders, totals.clicks),
      cpc: safeDivide(totals.spend, totals.clicks),
      ctr: safeDivide(totals.clicks, totals.impressions),
      acos: safeDivide(totals.spend, totals.sales),
      roas: safeDivide(totals.sales, totals.spend),
    },
  };
};
