import 'server-only';

import { fetchCurrentSpData } from '@/lib/bulksheets/fetchCurrent';
import {
  buildSpTargetsWorkspaceModel,
  resolveSpProductScopeSummary,
  type SpPlacementFactRow,
  type SpScopeAdvertisedProductRow,
  type SpSearchTermFactRow,
  type SpTargetFactRow,
  type SpTargetsWorkspaceChildRow,
  type SpTargetsWorkspaceRow,
} from '@/lib/ads/spTargetsWorkspaceModel';
import { normalizeSpAdvertisedAsin } from '@/lib/ads/spAdvertisedAsinScope';
import { env } from '@/lib/env';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import { getAdsOptimizerOverviewData, type AdsOptimizerOverviewData } from './overview';
import type { JsonObject } from './runtimeTypes';
import {
  normalizeAdsOptimizerCoverageStatus,
  type AdsOptimizerTargetCoverageStatus,
  type AdsOptimizerTargetCoverageStoredStatus,
} from './coverage';
import {
  readAdsOptimizerTargetRunRole,
  type AdsOptimizerTargetRole,
  type AdsOptimizerTargetRoleRunState,
} from './role';
import {
  readAdsOptimizerTargetRunState,
  type AdsOptimizerStateCoverageStatus,
  type AdsOptimizerTargetConfidenceState,
  type AdsOptimizerTargetEfficiencyState,
  type AdsOptimizerTargetImportanceTier,
} from './state';

const TARGET_SOURCE_SCOPE = 'asin_via_sp_advertised_product_membership';
const PLACEMENT_CONTEXT_NOTE =
  'Placement context remains campaign-level context only. It is not flattened into target-owned facts.';
const SEARCH_TERM_DIAGNOSTICS_NOTE =
  'Search-term diagnostics are contextual only and do not imply direct attribution beyond the existing SP STIS facts.';
const TARGET_PROFILE_VERSION = 'phase5_v1';
const UNRESOLVED_AD_GROUP_PREFIX = '__ads_optimizer_unresolved_ad_group__';

type SpAdvertisedProductRow = SpScopeAdvertisedProductRow & {
  date: string | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
};

type TargetCoverageWindow = {
  observedStart: string | null;
  observedEnd: string | null;
  daysObserved: number;
  latestExportedAt: string | null;
};

type NonAdditiveObservation = {
  value: number;
  observedDate: string | null;
  exportedAt: string | null;
};

type NonAdditiveTrend = {
  latestValue: number | null;
  previousValue: number | null;
  delta: number | null;
  direction: 'up' | 'down' | 'flat' | null;
  observedDays: number;
  latestObservedDate: string | null;
};
type RankingObservation = {
  observedDate: string | null;
  rank: number | null;
};
type CurrentSnapshotData = Awaited<ReturnType<typeof fetchCurrentSpData>>;

export type AdsOptimizerTargetProfileRow = {
  asin: string;
  campaignId: string;
  adGroupId: string;
  targetId: string;
  sourceScope: string;
  coverageNote: string | null;
  snapshotPayload: JsonObject;
};

export type AdsOptimizerTargetProfileLoadResult = {
  rows: AdsOptimizerTargetProfileRow[];
  zeroTargetDiagnostics: JsonObject | null;
};

export type AdsOptimizerTargetProfileSnapshotView = {
  targetSnapshotId: string;
  runId: string;
  createdAt: string;
  asin: string;
  campaignId: string;
  campaignName: string | null;
  adGroupId: string;
  adGroupName: string | null;
  targetId: string;
  targetText: string;
  matchType: string | null;
  typeLabel: string | null;
  raw: {
    impressions: number;
    clicks: number;
    spend: number;
    orders: number;
    sales: number;
    cpc: number | null;
    ctr: number | null;
    cvr: number | null;
    acos: number | null;
    roas: number | null;
    tosIs: number | null;
    stis: number | null;
    stir: number | null;
  };
  derived: {
    contributionAfterAds: number | null;
    breakEvenGap: number | null;
    maxCpcSupportGap: number | null;
    lossDollars: number | null;
    profitDollars: number | null;
    clickVelocity: number | null;
    impressionVelocity: number | null;
    organicLeverageProxy: number | null;
    organicContextSignal: string | null;
  };
  nonAdditiveDiagnostics: {
    note: string | null;
    representativeSearchTerm: string | null;
    tosIs: NonAdditiveTrend;
    stis: NonAdditiveTrend;
    stir: NonAdditiveTrend;
  };
  rankingContext?: {
    note: string | null;
    organicObservedRanks: RankingObservation[];
    sponsoredObservedRanks: RankingObservation[];
  };
  demandProxies: {
    searchTermCount: number;
    sameTextSearchTermCount: number;
    totalSearchTermImpressions: number;
    totalSearchTermClicks: number;
    representativeSearchTerm: string | null;
    representativeClickShare: number | null;
  };
  placementContext: {
    topOfSearchModifierPct: number | null;
    impressions: number | null;
    clicks: number | null;
    orders: number | null;
    units: number | null;
    sales: number | null;
    spend: number | null;
    note: string | null;
  };
  searchTermDiagnostics: {
    representativeSearchTerm: string | null;
    representativeSameText: boolean | null;
    note: string | null;
    topTerms: Array<{
      searchTerm: string;
      sameText: boolean;
      impressions: number;
      clicks: number;
      orders: number;
      spend: number;
      sales: number;
      stis: number | null;
      stir: number | null;
    }>;
  };
  coverage: {
    observedStart: string | null;
    observedEnd: string | null;
    daysObserved: number;
    statuses: {
      tosIs: AdsOptimizerTargetCoverageStatus;
      stis: AdsOptimizerTargetCoverageStatus;
      stir: AdsOptimizerTargetCoverageStatus;
      placementContext: AdsOptimizerTargetCoverageStatus;
      searchTerms: AdsOptimizerTargetCoverageStatus;
      breakEvenInputs: AdsOptimizerTargetCoverageStatus;
    };
    notes: string[];
    criticalWarnings: string[];
  };
  state: {
    efficiency: {
      value: AdsOptimizerTargetEfficiencyState | null;
      label: string;
      detail: string;
      coverageStatus: AdsOptimizerStateCoverageStatus;
      reasonCodes: string[];
    };
    confidence: {
      value: AdsOptimizerTargetConfidenceState | null;
      label: string;
      detail: string;
      coverageStatus: AdsOptimizerStateCoverageStatus;
      reasonCodes: string[];
    };
    importance: {
      value: AdsOptimizerTargetImportanceTier | null;
      label: string;
      detail: string;
      coverageStatus: AdsOptimizerStateCoverageStatus;
      reasonCodes: string[];
    };
    opportunityScore: number | null;
    riskScore: number | null;
    opportunityReasonCodes: string[];
    riskReasonCodes: string[];
    summaryReasonCodes: string[];
  };
  role: {
    desiredRole: {
      value: AdsOptimizerTargetRole | null;
      label: string;
      detail: string;
      coverageStatus: AdsOptimizerStateCoverageStatus;
      reasonCodes: string[];
    };
    currentRole: {
      value: AdsOptimizerTargetRole | null;
      label: string;
      detail: string;
      coverageStatus: AdsOptimizerStateCoverageStatus;
      reasonCodes: string[];
    };
    previousRole: AdsOptimizerTargetRole | null;
    transitionRule: string;
    transitionReasonCodes: string[];
    summaryReasonCodes: string[];
    guardrails: AdsOptimizerTargetRoleRunState['guardrails'];
  };
};

const numberValue = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const safeRatio = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? numerator / denominator : null;

const trimString = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeIdentityToken = (value: string | null | undefined) =>
  trimString(value)?.toLowerCase().replace(/\s+/g, ' ') ?? null;

const isWeakIdentityToken = (value: string | null | undefined) => {
  const normalized = normalizeIdentityToken(value);
  if (!normalized) return true;
  return (
    normalized === 'unknown' ||
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === '--' ||
    normalized === 'null'
  );
};

const encodeIdentityPart = (value: string | null | undefined) =>
  (normalizeIdentityToken(value) ?? 'missing').replace(/[^a-z0-9]+/g, '_');

const buildTargetProfileKey = (row: {
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  targeting_raw?: string | null;
  targeting_norm?: string | null;
  match_type_norm?: string | null;
}) => {
  const rawTargetId = trimString(row.target_id);
  if (!isWeakIdentityToken(rawTargetId)) {
    return rawTargetId as string;
  }

  return [
    'weak',
    encodeIdentityPart(row.campaign_id),
    encodeIdentityPart(row.ad_group_id),
    encodeIdentityPart(row.targeting_norm ?? row.targeting_raw),
    encodeIdentityPart(row.match_type_norm),
  ].join('::');
};

const buildPersistedAdGroupKey = (row: {
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  targeting_raw?: string | null;
  targeting_norm?: string | null;
  match_type_norm?: string | null;
}) => {
  const adGroupId = trimString(row.ad_group_id);
  if (adGroupId) return adGroupId;

  return [
    UNRESOLVED_AD_GROUP_PREFIX,
    encodeIdentityPart(row.campaign_id),
    encodeIdentityPart(row.target_id),
    encodeIdentityPart(row.targeting_norm ?? row.targeting_raw),
    encodeIdentityPart(row.match_type_norm),
  ].join('::');
};

const buildSnapshotTargetLabel = (
  target: SpTargetsWorkspaceRow,
  rawIdentity: {
    targetingRaw: string | null;
    targetingNorm: string | null;
  } | null
) => {
  const normalizedText = normalizeIdentityToken(target.target_text);
  const looksSynthetic =
    target.target_text === target.target_id ||
    target.target_id.startsWith('weak::') ||
    target.target_id.startsWith(UNRESOLVED_AD_GROUP_PREFIX);
  if (normalizedText && normalizedText !== 'unknown' && !looksSynthetic) {
    return target.target_text;
  }

  const fallback = trimString(rawIdentity?.targetingRaw ?? rawIdentity?.targetingNorm);
  if (fallback && !isWeakIdentityToken(fallback)) {
    return fallback;
  }

  return 'Unresolved target identity';
};

const normalizeTargetingRowsForProfiles = (rows: SpTargetFactRow[]): SpTargetFactRow[] =>
  rows.map((row) => {
    const profileKey = buildTargetProfileKey(row);
    return {
      ...row,
      target_id: profileKey,
      ad_group_id: buildPersistedAdGroupKey(row),
    };
  });

const normalizeSearchTermRowsForProfiles = (rows: SpSearchTermFactRow[]): SpSearchTermFactRow[] =>
  rows.map((row) => ({
    ...row,
    target_id: buildTargetProfileKey(row),
    ad_group_id: buildPersistedAdGroupKey(row),
  }));

const chunk = <T,>(items: T[], size: number) => {
  const buckets: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    buckets.push(items.slice(index, index + size));
  }
  return buckets;
};

const loadCurrentSnapshot = async (args: {
  rawTargetIds: string[];
  campaignIds: string[];
}): Promise<{ data: CurrentSnapshotData | null; warning: string | null }> => {
  if (args.rawTargetIds.length === 0 && args.campaignIds.length === 0) {
    return { data: null, warning: null };
  }

  try {
    const actions = [
      ...args.rawTargetIds.map((targetId) => ({
        type: 'update_target_state',
        target_id: targetId,
      })),
      ...args.campaignIds.map((campaignId) => ({
        type: 'update_placement_modifier',
        campaign_id: campaignId,
      })),
    ];
    const data = await fetchCurrentSpData(actions);
    return { data, warning: null };
  } catch (error) {
    return {
      data: null,
      warning:
        error instanceof Error
          ? `Current bulk snapshot context is unavailable for optimizer recommendations: ${error.message}`
          : 'Current bulk snapshot context is unavailable for optimizer recommendations.',
    };
  }
};

const compareRepresentativeSearchTerm = (
  left: Pick<
    SpTargetsWorkspaceChildRow,
    'same_text' | 'spend' | 'clicks' | 'impressions' | 'search_term'
  >,
  right: Pick<
    SpTargetsWorkspaceChildRow,
    'same_text' | 'spend' | 'clicks' | 'impressions' | 'search_term'
  >
) => {
  if (left.same_text !== right.same_text) return left.same_text ? -1 : 1;
  if (left.spend !== right.spend) return right.spend - left.spend;
  if (left.clicks !== right.clicks) return right.clicks - left.clicks;
  if (left.impressions !== right.impressions) return right.impressions - left.impressions;
  return left.search_term.localeCompare(right.search_term);
};

const pickCoverageStatus = (args: {
  hasValue: boolean;
  fallbackPartial?: boolean;
  expectedUnavailable?: boolean;
}): AdsOptimizerTargetCoverageStatus => {
  if (args.hasValue) return 'ready';
  if (args.expectedUnavailable) return 'expected_unavailable';
  return args.fallbackPartial ? 'partial' : 'true_missing';
};

const compareObservation = (left: NonAdditiveObservation, right: NonAdditiveObservation) => {
  const dateDiff = String(right.observedDate ?? '').localeCompare(String(left.observedDate ?? ''));
  if (dateDiff !== 0) return dateDiff;
  return String(right.exportedAt ?? '').localeCompare(String(left.exportedAt ?? ''));
};

const buildNonAdditiveTrend = (
  observations: NonAdditiveObservation[],
  fallbackLatestValue: number | null
): NonAdditiveTrend => {
  const sorted = [...observations].sort(compareObservation);
  const latest = sorted[0] ?? null;
  const previous = sorted[1] ?? null;
  const latestValue = latest?.value ?? fallbackLatestValue ?? null;
  const previousValue = previous?.value ?? null;
  const delta =
    latestValue !== null && previousValue !== null ? latestValue - previousValue : null;

  return {
    latestValue,
    previousValue,
    delta,
    direction: delta === null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    observedDays: new Set(
      observations
        .map((entry) => entry.observedDate)
        .filter((entry): entry is string => Boolean(entry))
    ).size,
    latestObservedDate: latest?.observedDate ?? null,
  };
};

const buildTargetTosTrendById = (rows: SpTargetFactRow[]) => {
  const byTarget = new Map<string, NonAdditiveObservation[]>();

  rows.forEach((row) => {
    const targetId = trimString(row.target_id);
    const value = Number(row.top_of_search_impression_share);
    if (!targetId || !Number.isFinite(value)) return;
    const observations = byTarget.get(targetId) ?? [];
    observations.push({
      value,
      observedDate: trimString(row.date),
      exportedAt: trimString(row.exported_at),
    });
    byTarget.set(targetId, observations);
  });

  return byTarget;
};

const buildSearchTermDiagnosticTrendsByTarget = (rows: SpSearchTermFactRow[]) => {
  const byTarget = new Map<
    string,
    Map<string, { stis: NonAdditiveObservation[]; stir: NonAdditiveObservation[] }>
  >();

  rows.forEach((row) => {
    const targetId = trimString(row.target_id);
    const searchTermNorm = normalizeIdentityToken(
      row.customer_search_term_norm ?? row.customer_search_term_raw
    );
    if (!targetId || !searchTermNorm) return;

    const targetMap =
      byTarget.get(targetId) ??
      new Map<string, { stis: NonAdditiveObservation[]; stir: NonAdditiveObservation[] }>();
    const bucket = targetMap.get(searchTermNorm) ?? { stis: [], stir: [] };
    const observedDate = trimString(row.date);
    const exportedAt = trimString(row.exported_at);
    const stis = Number(row.search_term_impression_share);
    if (Number.isFinite(stis)) {
      bucket.stis.push({ value: stis, observedDate, exportedAt });
    }
    const stir = Number(row.search_term_impression_rank);
    if (Number.isFinite(stir)) {
      bucket.stir.push({ value: stir, observedDate, exportedAt });
    }
    targetMap.set(searchTermNorm, bucket);
    byTarget.set(targetId, targetMap);
  });

  return byTarget;
};

const buildTargetCoverageById = (rows: SpTargetFactRow[]) => {
  const byTarget = new Map<
    string,
    {
      observedDates: Set<string>;
      observedStart: string | null;
      observedEnd: string | null;
      latestExportedAt: string | null;
    }
  >();

  rows.forEach((row) => {
    const targetId = trimString(row.target_id);
    if (!targetId) return;

    const bucket = byTarget.get(targetId) ?? {
      observedDates: new Set<string>(),
      observedStart: null,
      observedEnd: null,
      latestExportedAt: null,
    };
    const observedDate = trimString(row.date);
    if (observedDate) {
      bucket.observedDates.add(observedDate);
      if (!bucket.observedStart || observedDate < bucket.observedStart) {
        bucket.observedStart = observedDate;
      }
      if (!bucket.observedEnd || observedDate > bucket.observedEnd) {
        bucket.observedEnd = observedDate;
      }
    }
    const exportedAt = trimString(row.exported_at);
    if (exportedAt && (!bucket.latestExportedAt || exportedAt > bucket.latestExportedAt)) {
      bucket.latestExportedAt = exportedAt;
    }
    byTarget.set(targetId, bucket);
  });

  return new Map<string, TargetCoverageWindow>(
    [...byTarget.entries()].map(([targetId, value]) => [
      targetId,
      {
        observedStart: value.observedStart,
        observedEnd: value.observedEnd,
        daysObserved: value.observedDates.size,
        latestExportedAt: value.latestExportedAt,
      },
    ])
  );
};

const buildAsinScopeMembership = (rows: SpAdvertisedProductRow[]) => {
  if (rows.length === 0) return null;

  return rows.reduce(
    (bucket, row) => {
      const observedDate = trimString(row.date);
      if (observedDate && (!bucket.firstDate || observedDate < bucket.firstDate)) {
        bucket.firstDate = observedDate;
      }
      if (observedDate && (!bucket.lastDate || observedDate > bucket.lastDate)) {
        bucket.lastDate = observedDate;
      }
      bucket.productAdSpend += numberValue(row.spend);
      bucket.productAdSales += numberValue(row.sales);
      bucket.productOrders += numberValue(row.orders);
      bucket.productUnits += numberValue(row.units);
      return bucket;
    },
    {
      firstDate: null as string | null,
      lastDate: null as string | null,
      productAdSpend: 0,
      productAdSales: 0,
      productOrders: 0,
      productUnits: 0,
    }
  );
};

const loadTargetScopeMembership = async (args: {
  asinNorm: string;
  start: string;
  end: string;
}): Promise<SpAdvertisedProductRow[]> =>
  fetchAllRows<SpAdvertisedProductRow>((from, to) =>
    supabaseAdmin
      .from('sp_advertised_product_daily_fact_latest')
      .select(
        'date,campaign_id,ad_group_id,advertised_asin_raw,advertised_asin_norm,impressions,clicks,spend,sales,orders,units'
      )
      .eq('account_id', env.accountId)
      .gte('date', args.start)
      .lte('date', args.end)
      .eq('advertised_asin_norm', args.asinNorm)
      .range(from, to)
  );

const loadScopedAdvertisedProductRows = async (args: {
  campaignIds: string[];
  start: string;
  end: string;
}): Promise<SpAdvertisedProductRow[]> => {
  const rows: SpAdvertisedProductRow[] = [];

  for (const batch of chunk(args.campaignIds, 100)) {
    const fetched = await fetchAllRows<SpAdvertisedProductRow>((from, to) =>
      supabaseAdmin
        .from('sp_advertised_product_daily_fact_latest')
        .select(
          'date,campaign_id,ad_group_id,advertised_asin_raw,advertised_asin_norm,impressions,clicks,spend,sales,orders,units'
        )
        .eq('account_id', env.accountId)
        .gte('date', args.start)
        .lte('date', args.end)
        .in('campaign_id', batch)
        .range(from, to)
    );
    rows.push(...fetched);
  }

  return rows;
};

const loadTargetingRowsByScope = async (args: {
  idColumn: 'ad_group_id' | 'campaign_id';
  ids: string[];
  start: string;
  end: string;
  onlyNullAdGroup?: boolean;
}): Promise<SpTargetFactRow[]> => {
  const rows: SpTargetFactRow[] = [];

  for (const batch of chunk(args.ids, 100)) {
    const fetched = await fetchAllRows<SpTargetFactRow>((from, to) => {
      let query = supabaseAdmin
        .from('sp_targeting_daily_fact_latest')
        .select(
          [
            'date',
            'exported_at',
            'target_id',
            'campaign_id',
            'ad_group_id',
            'portfolio_name_raw',
            'campaign_name_raw',
            'ad_group_name_raw',
            'targeting_raw',
            'targeting_norm',
            'match_type_norm',
            'impressions',
            'clicks',
            'spend',
            'sales',
            'orders',
            'units',
            'top_of_search_impression_share',
          ].join(',')
        )
        .eq('account_id', env.accountId)
        .gte('date', args.start)
        .lte('date', args.end)
        .in(args.idColumn, batch);
      if (args.onlyNullAdGroup) {
        query = query.is('ad_group_id', null);
      }
      return query.range(from, to);
    });
    rows.push(...fetched);
  }

  return rows;
};

const loadSearchTermRowsByScope = async (args: {
  idColumn: 'ad_group_id' | 'campaign_id';
  ids: string[];
  start: string;
  end: string;
  onlyNullAdGroup?: boolean;
}): Promise<SpSearchTermFactRow[]> => {
  const rows: SpSearchTermFactRow[] = [];

  for (const batch of chunk(args.ids, 100)) {
    const fetched = await fetchAllRows<SpSearchTermFactRow>((from, to) =>
      {
        let query = supabaseAdmin
        .from('sp_stis_daily_fact_latest')
        .select(
          [
            'date',
            'exported_at',
            'campaign_id',
            'ad_group_id',
            'target_id',
            'target_key',
            'campaign_name_raw',
            'ad_group_name_raw',
            'targeting_raw',
            'targeting_norm',
            'match_type_norm',
            'customer_search_term_raw',
            'customer_search_term_norm',
            'search_term_impression_share',
            'search_term_impression_rank',
            'impressions',
            'clicks',
            'spend',
            'sales',
            'orders',
            'units',
          ].join(',')
        )
        .eq('account_id', env.accountId)
        .gte('date', args.start)
        .lte('date', args.end)
        .in(args.idColumn, batch);
        if (args.onlyNullAdGroup) {
          query = query.is('ad_group_id', null);
        }
        return query.range(from, to);
      }
    );
    rows.push(...fetched);
  }

  return rows;
};

const loadPlacementRowsByCampaignIds = async (args: {
  campaignIds: string[];
  start: string;
  end: string;
}): Promise<SpPlacementFactRow[]> => {
  const rows: SpPlacementFactRow[] = [];

  for (const batch of chunk(args.campaignIds, 100)) {
    const fetched = await fetchAllRows<SpPlacementFactRow>((from, to) =>
      supabaseAdmin
        .from('sp_placement_daily_fact_latest')
        .select(
          'campaign_id,placement_code,placement_raw,placement_raw_norm,impressions,clicks,spend,sales,orders,units'
        )
        .eq('account_id', env.accountId)
        .gte('date', args.start)
        .lte('date', args.end)
        .in('campaign_id', batch)
        .range(from, to)
    );
    rows.push(...fetched);
  }

  return rows;
};

const getRepresentativeSearchTerm = (searchTerms: SpTargetsWorkspaceChildRow[]) =>
  [...searchTerms].sort(compareRepresentativeSearchTerm)[0] ?? null;

const buildTargetProfileViewRow = (args: {
  asin: string;
  requestedStart: string;
  requestedEnd: string;
  target: SpTargetsWorkspaceRow;
  rawIdentity: {
    rawTargetId: string | null;
    rawAdGroupId: string | null;
    targetingRaw: string | null;
    targetingNorm: string | null;
  } | null;
  coverageWindow: TargetCoverageWindow | null;
  membership: {
    firstDate: string | null;
    lastDate: string | null;
    productAdSpend: number;
    productAdSales: number;
    productOrders: number;
    productUnits: number;
  } | null;
  tosTrend: NonAdditiveTrend;
  representativeSearchTermTrends: {
    stis: NonAdditiveTrend;
    stir: NonAdditiveTrend;
  } | null;
  overview: AdsOptimizerOverviewData;
  currentSnapshotDate: string | null;
  currentSnapshotWarning: string | null;
}): AdsOptimizerTargetProfileRow => {
  const representativeSearchTerm = getRepresentativeSearchTerm(args.target.search_terms);
  const searchTermCount = args.target.search_terms.length;
  const sameTextSearchTerms = args.target.search_terms.filter((row) => row.same_text);
  const totalSearchTermImpressions = args.target.search_terms.reduce(
    (sum, row) => sum + row.impressions,
    0
  );
  const totalSearchTermClicks = args.target.search_terms.reduce((sum, row) => sum + row.clicks, 0);
  const representativeClickShare = representativeSearchTerm
    ? safeRatio(representativeSearchTerm.clicks, args.target.clicks)
    : null;
  const breakEvenAcos = args.overview.economics.breakEvenAcos;
  const supportedMaxCpc =
    breakEvenAcos !== null && args.target.clicks > 0
      ? safeRatio(args.target.sales * breakEvenAcos, args.target.clicks)
      : null;
  const contributionAfterAds =
    breakEvenAcos !== null ? args.target.sales * breakEvenAcos - args.target.spend : null;
  const breakEvenGap =
    breakEvenAcos !== null && args.target.acos !== null ? breakEvenAcos - args.target.acos : null;
  const maxCpcSupportGap =
    supportedMaxCpc !== null && args.target.cpc !== null ? supportedMaxCpc - args.target.cpc : null;
  const lossDollars =
    contributionAfterAds !== null && contributionAfterAds < 0 ? -contributionAfterAds : null;
  const adSalesShare =
    args.membership && args.membership.productAdSales > 0
      ? safeRatio(args.target.sales, args.membership.productAdSales)
      : null;
  const adOrderShare =
    args.membership && args.membership.productOrders > 0
      ? safeRatio(args.target.orders, args.membership.productOrders)
      : null;
  const totalSalesShare =
    args.overview.economics.sales > 0 ? safeRatio(args.target.sales, args.overview.economics.sales) : null;
  const lossToAdSalesRatio =
    lossDollars !== null && args.target.sales > 0 ? safeRatio(lossDollars, args.target.sales) : null;
  const lossSeverity =
    lossToAdSalesRatio === null || lossToAdSalesRatio <= 0
      ? null
      : lossToAdSalesRatio <= 0.15
        ? 'shallow'
        : lossToAdSalesRatio <= 0.35
          ? 'moderate'
          : 'severe';
  const protectedContributor =
    (adSalesShare !== null && adSalesShare >= 0.2) ||
    (adOrderShare !== null && adOrderShare >= 0.2) ||
    (totalSalesShare !== null && totalSalesShare >= 0.08);
  const organicContextSignal =
    sameTextSearchTerms.length > 0
      ? 'same_text_visibility_context'
      : representativeSearchTerm
        ? 'search_term_visibility_context'
        : args.tosTrend.latestValue !== null
          ? 'top_of_search_visibility_context'
          : null;
  const zeroClickExpectedUnavailable = args.target.clicks === 0 && searchTermCount === 0;

  const coverageNotes = new Set<string>();
  const criticalWarnings = new Set<string>();
  if (args.target.coverage_note) coverageNotes.add(args.target.coverage_note);
  if (args.tosTrend.latestValue === null) {
    criticalWarnings.add('Latest observed TOS IS is unavailable for this target in the selected window.');
  }
  if (!args.target.placement_context) {
    criticalWarnings.add('Top-of-search placement context is unavailable for this target campaign.');
  }
  if (zeroClickExpectedUnavailable) {
    coverageNotes.add(
      'Zero-click target: missing search-term diagnostics are expected availability behavior for this window.'
    );
  } else if (searchTermCount === 0) {
    criticalWarnings.add(
      'No search-term diagnostics were found for this target in the selected window.'
    );
  }
  if (args.representativeSearchTermTrends?.stis.latestValue === null && searchTermCount > 0) {
    criticalWarnings.add('Latest observed STIS is unavailable for the representative search-term diagnostic.');
  }
  if (args.representativeSearchTermTrends?.stir.latestValue === null && searchTermCount > 0) {
    criticalWarnings.add('Latest observed STIR is unavailable for the representative search-term diagnostic.');
  }
  if (breakEvenAcos === null) {
    criticalWarnings.add(
      'Break-even-derived target metrics are unavailable because product economics are missing break-even ACoS.'
    );
  }
  if (args.currentSnapshotWarning) {
    criticalWarnings.add(args.currentSnapshotWarning);
  }

  return {
    asin: args.asin,
    campaignId: args.target.campaign_id,
    adGroupId: args.target.ad_group_id ?? '',
    targetId: args.target.target_id,
    sourceScope: TARGET_SOURCE_SCOPE,
    coverageNote: [...coverageNotes, ...criticalWarnings].join(' '),
    snapshotPayload: {
      phase: 5,
      target_profile_version: TARGET_PROFILE_VERSION,
      capture_type: 'target_snapshot',
      source_scope: TARGET_SOURCE_SCOPE,
      execution_boundary: 'snapshot_only',
      window: {
        requested_start: args.requestedStart,
        requested_end: args.requestedEnd,
        observed_start: args.coverageWindow?.observedStart ?? null,
        observed_end: args.coverageWindow?.observedEnd ?? null,
      },
      identity: {
        campaign_id: args.target.campaign_id,
        campaign_name: args.target.campaign_name,
        ad_group_id: args.rawIdentity?.rawAdGroupId ?? args.target.ad_group_id,
        ad_group_name: args.target.ad_group_name,
        target_id: args.target.target_id,
        raw_target_id: args.rawIdentity?.rawTargetId ?? null,
        raw_ad_group_id: args.rawIdentity?.rawAdGroupId ?? null,
        target_identity_status:
          args.rawIdentity?.rawTargetId && !isWeakIdentityToken(args.rawIdentity.rawTargetId)
            ? 'resolved'
            : 'unresolved',
        ad_group_identity_status: args.rawIdentity?.rawAdGroupId ? 'resolved' : 'unresolved',
        target_profile_key: args.target.target_id,
        targeting_raw: args.rawIdentity?.targetingRaw ?? null,
        targeting_norm: args.rawIdentity?.targetingNorm ?? null,
        target_text: buildSnapshotTargetLabel(args.target, args.rawIdentity),
        match_type: args.target.match_type,
        type_label: args.target.type_label,
      },
      totals: {
        impressions: args.target.impressions,
        clicks: args.target.clicks,
        spend: args.target.spend,
        orders: args.target.orders,
        units: args.target.units,
        sales: args.target.sales,
        cpc: args.target.cpc,
        ctr: args.target.ctr,
        cvr: args.target.conversion,
        acos: args.target.acos,
        roas: args.target.roas,
      },
      non_additive_diagnostics: {
        latest_observed_tos_is: args.tosTrend.latestValue,
        latest_observed_tos_is_observed_date: args.tosTrend.latestObservedDate,
        tos_is_trend: {
          previous_value: args.tosTrend.previousValue,
          delta: args.tosTrend.delta,
          direction: args.tosTrend.direction,
          observed_days: args.tosTrend.observedDays,
          latest_observed_date: args.tosTrend.latestObservedDate,
        },
        latest_observed_stis: args.representativeSearchTermTrends?.stis.latestValue ?? null,
        latest_observed_stis_observed_date:
          args.representativeSearchTermTrends?.stis.latestObservedDate ?? null,
        stis_trend: args.representativeSearchTermTrends
          ? {
              previous_value: args.representativeSearchTermTrends.stis.previousValue,
              delta: args.representativeSearchTermTrends.stis.delta,
              direction: args.representativeSearchTermTrends.stis.direction,
              observed_days: args.representativeSearchTermTrends.stis.observedDays,
              latest_observed_date:
                args.representativeSearchTermTrends.stis.latestObservedDate,
            }
          : null,
        latest_observed_stir: args.representativeSearchTermTrends?.stir.latestValue ?? null,
        latest_observed_stir_observed_date:
          args.representativeSearchTermTrends?.stir.latestObservedDate ?? null,
        stir_trend: args.representativeSearchTermTrends
          ? {
              previous_value: args.representativeSearchTermTrends.stir.previousValue,
              delta: args.representativeSearchTermTrends.stir.delta,
              direction: args.representativeSearchTermTrends.stir.direction,
              observed_days: args.representativeSearchTermTrends.stir.observedDays,
              latest_observed_date:
                args.representativeSearchTermTrends.stir.latestObservedDate,
            }
          : null,
        representative_search_term: representativeSearchTerm?.search_term ?? null,
        note:
          'TOS IS, STIS, and STIR are stored only as latest observed diagnostics plus explicit trend metadata. They are never averaged or synthesized into window-level raw values.',
      },
      demand_proxies: {
        search_term_count: searchTermCount,
        same_text_search_term_count: sameTextSearchTerms.length,
        total_search_term_impressions: totalSearchTermImpressions,
        total_search_term_clicks: totalSearchTermClicks,
        representative_search_term: representativeSearchTerm?.search_term ?? null,
        representative_same_text: representativeSearchTerm?.same_text ?? null,
        representative_click_share: representativeClickShare,
      },
      placement_context: args.target.placement_context
        ? {
            top_of_search_modifier_pct:
              args.target.placement_context.top_of_search_modifier_pct ?? null,
            impressions: args.target.placement_context.impressions,
            clicks: args.target.placement_context.clicks,
            orders: args.target.placement_context.orders,
            units: args.target.placement_context.units,
            sales: args.target.placement_context.sales,
            spend: args.target.placement_context.spend,
            note: PLACEMENT_CONTEXT_NOTE,
          }
        : {
            top_of_search_modifier_pct: null,
            impressions: null,
            clicks: null,
            orders: null,
            units: null,
            sales: null,
            spend: null,
            note: PLACEMENT_CONTEXT_NOTE,
          },
      search_term_diagnostics: {
        representative_search_term: representativeSearchTerm?.search_term ?? null,
        representative_same_text: representativeSearchTerm?.same_text ?? null,
        note: SEARCH_TERM_DIAGNOSTICS_NOTE,
        top_terms: args.target.search_terms.slice(0, 3).map((row) => ({
          search_term: row.search_term,
          same_text: row.same_text,
          impressions: row.impressions,
          clicks: row.clicks,
          orders: row.orders,
          spend: row.spend,
          sales: row.sales,
          stis: row.stis,
          stir: row.stir,
        })),
      },
      derived_metrics: {
        contribution_after_ads: contributionAfterAds,
        break_even_gap: breakEvenGap,
        max_cpc_supported: supportedMaxCpc,
        max_cpc_support_gap: maxCpcSupportGap,
        loss_dollars: lossDollars,
        profit_dollars:
          contributionAfterAds !== null && contributionAfterAds > 0 ? contributionAfterAds : null,
        click_velocity:
          args.coverageWindow && args.coverageWindow.daysObserved > 0
            ? args.target.clicks / args.coverageWindow.daysObserved
            : null,
        impression_velocity:
          args.coverageWindow && args.coverageWindow.daysObserved > 0
            ? args.target.impressions / args.coverageWindow.daysObserved
            : null,
        organic_leverage_proxy: null,
        organic_context_signal: organicContextSignal,
        ad_sales_share: adSalesShare,
        ad_order_share: adOrderShare,
        total_sales_share: totalSalesShare,
        loss_to_ad_sales_ratio: lossToAdSalesRatio,
        loss_severity: lossSeverity,
        protected_contributor: protectedContributor,
        formula_notes: {
          contribution_after_ads:
            'Approximated as (target sales * product break-even ACoS) - target spend.',
          max_cpc_support_gap:
            'Approximated as ((target sales * product break-even ACoS) / target clicks) - actual CPC.',
          ad_sales_share:
            'Approximated as target attributed sales divided by ASIN-scope attributed ad sales for the selected window.',
          ad_order_share:
            'Approximated as target attributed orders divided by ASIN-scope attributed ad orders for the selected window.',
          total_sales_share:
            'Approximated as target attributed sales divided by the product total sales captured in overview economics for the selected window.',
          loss_to_ad_sales_ratio:
            'Approximated as loss dollars divided by target attributed sales when both are available.',
          organic_context_signal:
            'Qualitative context only. Non-additive diagnostics can inform review notes and reason codes, but not default V1 score math.',
        },
      },
      asin_scope_membership: args.membership
        ? {
            scope_level: 'asin',
            asin: args.asin,
            first_observed_date: args.membership.firstDate,
            last_observed_date: args.membership.lastDate,
            product_ad_spend: args.membership.productAdSpend,
            product_ad_sales: args.membership.productAdSales,
            product_orders: args.membership.productOrders,
            product_units: args.membership.productUnits,
          }
        : null,
      product_context: {
        break_even_acos: args.overview.economics.breakEvenAcos,
        contribution_before_ads_per_unit: args.overview.economics.contributionBeforeAdsPerUnit,
        average_price: args.overview.economics.averagePrice,
        product_state: args.overview.state.value,
        product_objective: args.overview.objective.value,
      },
      execution_context: {
        snapshot_date: args.currentSnapshotDate,
        target: {
          id: args.target.composer_context.target.id,
          text: args.target.composer_context.target.text,
          match_type: args.target.composer_context.target.match_type,
          is_negative: args.target.composer_context.target.is_negative,
          current_state: args.target.composer_context.target.current_state,
          current_bid: args.target.composer_context.target.current_bid,
        },
        ad_group: args.target.composer_context.ad_group
          ? {
              id: args.target.composer_context.ad_group.id,
              name: args.target.composer_context.ad_group.name,
              current_state: args.target.composer_context.ad_group.current_state,
              current_default_bid: args.target.composer_context.ad_group.current_default_bid,
            }
          : null,
        campaign: {
          id: args.target.composer_context.campaign.id,
          name: args.target.composer_context.campaign.name,
          current_state: args.target.composer_context.campaign.current_state,
          current_budget: args.target.composer_context.campaign.current_budget,
          current_bidding_strategy: args.target.composer_context.campaign.current_bidding_strategy,
        },
        placement: args.target.composer_context.placement
          ? {
              placement_code: args.target.composer_context.placement.placement_code,
              label: args.target.composer_context.placement.label,
              current_percentage: args.target.composer_context.placement.current_percentage,
            }
          : null,
        coverage_note: args.target.composer_context.coverage_note,
      },
      coverage: {
        observed_start: args.coverageWindow?.observedStart ?? null,
        observed_end: args.coverageWindow?.observedEnd ?? null,
        days_observed: args.coverageWindow?.daysObserved ?? 0,
        exported_at_latest: args.coverageWindow?.latestExportedAt ?? null,
        statuses: {
          tos_is: pickCoverageStatus({
            hasValue: args.tosTrend.latestValue !== null,
          }),
          stis: pickCoverageStatus({
            hasValue: (args.representativeSearchTermTrends?.stis.latestValue ?? null) !== null,
            fallbackPartial: searchTermCount > 0,
            expectedUnavailable: zeroClickExpectedUnavailable,
          }),
          stir: pickCoverageStatus({
            hasValue: (args.representativeSearchTermTrends?.stir.latestValue ?? null) !== null,
            fallbackPartial: searchTermCount > 0,
            expectedUnavailable: zeroClickExpectedUnavailable,
          }),
          placement_context: pickCoverageStatus({
            hasValue: Boolean(args.target.placement_context),
          }),
          search_terms: pickCoverageStatus({
            hasValue: searchTermCount > 0,
            expectedUnavailable: zeroClickExpectedUnavailable,
          }),
          break_even_inputs: pickCoverageStatus({
            hasValue: breakEvenAcos !== null,
          }),
        },
        notes: [...coverageNotes],
        critical_warnings: [...criticalWarnings],
      },
    },
  };
};

const asJsonObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
};

const readNestedNumber = (value: JsonObject | null, key: string) => {
  const next = value?.[key];
  return typeof next === 'number' && Number.isFinite(next) ? next : null;
};

const readNestedString = (value: JsonObject | null, key: string) =>
  typeof value?.[key] === 'string' ? (value[key] as string) : null;

const readNestedBoolean = (value: JsonObject | null, key: string) =>
  typeof value?.[key] === 'boolean' ? (value[key] as boolean) : null;

export const mapTargetSnapshotToProfileView = (snapshot: {
  target_snapshot_id: string;
  run_id: string;
  created_at: string;
  asin: string;
  campaign_id: string;
  ad_group_id: string;
  target_id: string;
  coverage_note: string | null;
  snapshot_payload_json: JsonObject;
}): AdsOptimizerTargetProfileSnapshotView => {
  const payload = snapshot.snapshot_payload_json;
  const identity = asJsonObject(payload.identity);
  const totals = asJsonObject(payload.totals);
  const nonAdditive = asJsonObject(payload.non_additive_diagnostics);
  const derivedMetrics = asJsonObject(payload.derived_metrics);
  const demandProxies = asJsonObject(payload.demand_proxies);
  const placementContext = asJsonObject(payload.placement_context);
  const searchTermDiagnostics = asJsonObject(payload.search_term_diagnostics);
  const rankingContext = asJsonObject(payload.ranking_context);
  const coverage = asJsonObject(payload.coverage);
  const statuses = asJsonObject(coverage?.statuses);
  const topTermsRaw = Array.isArray(searchTermDiagnostics?.top_terms)
    ? searchTermDiagnostics?.top_terms
    : [];
  const coverageNotesRaw = Array.isArray(coverage?.notes) ? coverage?.notes : [];
  const criticalWarningsRaw = Array.isArray(coverage?.critical_warnings)
    ? coverage?.critical_warnings
    : [];
  const readNonAdditiveTrend = (key: string, latestKey: string, legacyKey?: string): NonAdditiveTrend => {
    const trend = asJsonObject(nonAdditive?.[key]);
    const latestValue =
      readNestedNumber(nonAdditive, latestKey) ??
      (legacyKey ? readNestedNumber(nonAdditive, legacyKey) : null);
    return {
      latestValue,
      previousValue: readNestedNumber(trend, 'previous_value'),
      delta: readNestedNumber(trend, 'delta'),
      direction:
        (readNestedString(trend, 'direction') as NonAdditiveTrend['direction'] | null) ?? null,
      observedDays: numberValue(trend?.observed_days as number | null | undefined),
      latestObservedDate:
        readNestedString(trend, 'latest_observed_date') ??
        readNestedString(nonAdditive, `${latestKey}_observed_date`) ??
        null,
    };
  };
  const readRankingObservations = (key: string): RankingObservation[] => {
    const raw = Array.isArray(rankingContext?.[key]) ? rankingContext[key] : [];
    return raw
      .map((entry) => asJsonObject(entry))
      .filter((entry): entry is JsonObject => entry !== null)
      .map((entry) => ({
        observedDate: readNestedString(entry, 'observed_date'),
        rank: readNestedNumber(entry, 'rank'),
      }));
  };

  const coverageNotes = coverageNotesRaw.filter((entry): entry is string => typeof entry === 'string');
  const criticalWarnings = criticalWarningsRaw.filter(
    (entry): entry is string => typeof entry === 'string'
  );
  if (coverageNotes.length === 0 && snapshot.coverage_note) {
    coverageNotes.push(snapshot.coverage_note);
  }
  if (numberValue(payload.phase as number | string | null | undefined) < 5) {
    coverageNotes.push('This run predates Phase 5 target-profile enrichment, so derived fields remain null.');
  }
  const targetState = readAdsOptimizerTargetRunState(payload);
  if (!targetState) {
    coverageNotes.push(
      'This run predates Phase 6 state enrichment, so efficiency, confidence, tier, opportunity, and risk remain uncaptured.'
    );
  }
  const targetRole = readAdsOptimizerTargetRunRole(payload);
  if (!targetRole) {
    coverageNotes.push(
      'This run predates Phase 7 role enrichment, so desired role, current role, and resolved guardrails remain uncaptured.'
    );
  }

  const identityStatus = readNestedString(identity, 'target_identity_status');
  const rawTargetId = readNestedString(identity, 'raw_target_id');
  const rawAdGroupId = readNestedString(identity, 'raw_ad_group_id');
  const targetingRaw = readNestedString(identity, 'targeting_raw');
  const targetingNorm = readNestedString(identity, 'targeting_norm');
  const resolvedTargetText =
    readNestedString(identity, 'target_text') ??
    targetingRaw ??
    targetingNorm ??
    (identityStatus === 'unresolved' ? 'Unresolved target identity' : snapshot.target_id);

  return {
    targetSnapshotId: snapshot.target_snapshot_id,
    runId: snapshot.run_id,
    createdAt: snapshot.created_at,
    asin: snapshot.asin,
    campaignId: snapshot.campaign_id,
    campaignName: readNestedString(identity, 'campaign_name'),
    adGroupId: rawAdGroupId ?? 'Unresolved ad group ID',
    adGroupName: readNestedString(identity, 'ad_group_name'),
    targetId:
      rawTargetId && !isWeakIdentityToken(rawTargetId)
        ? rawTargetId
        : 'Unresolved target ID',
    targetText: resolvedTargetText,
    matchType:
      readNestedString(identity, 'match_type') ?? readNestedString(identity, 'match_type_norm'),
    typeLabel: readNestedString(identity, 'type_label'),
    raw: {
      impressions: numberValue(totals?.impressions as number | null | undefined),
      clicks: numberValue(totals?.clicks as number | null | undefined),
      spend: numberValue(totals?.spend as number | null | undefined),
      orders: numberValue(totals?.orders as number | null | undefined),
      sales: numberValue(totals?.sales as number | null | undefined),
      cpc: readNestedNumber(totals, 'cpc'),
      ctr: readNestedNumber(totals, 'ctr'),
      cvr:
        readNestedNumber(totals, 'cvr') ??
        readNestedNumber(totals, 'conversion_rate'),
      acos: readNestedNumber(totals, 'acos'),
      roas: readNestedNumber(totals, 'roas'),
      tosIs:
        readNestedNumber(nonAdditive, 'latest_observed_tos_is') ??
        readNestedNumber(nonAdditive, 'top_of_search_impression_share_latest') ??
        readNestedNumber(totals, 'tos_is'),
      stis:
        readNestedNumber(nonAdditive, 'latest_observed_stis') ??
        readNestedNumber(nonAdditive, 'representative_stis_latest'),
      stir:
        readNestedNumber(nonAdditive, 'latest_observed_stir') ??
        readNestedNumber(nonAdditive, 'representative_stir_latest'),
    },
    derived: {
      contributionAfterAds: readNestedNumber(derivedMetrics, 'contribution_after_ads'),
      breakEvenGap: readNestedNumber(derivedMetrics, 'break_even_gap'),
      maxCpcSupportGap: readNestedNumber(derivedMetrics, 'max_cpc_support_gap'),
      lossDollars: readNestedNumber(derivedMetrics, 'loss_dollars'),
      profitDollars: readNestedNumber(derivedMetrics, 'profit_dollars'),
      clickVelocity: readNestedNumber(derivedMetrics, 'click_velocity'),
      impressionVelocity: readNestedNumber(derivedMetrics, 'impression_velocity'),
      organicLeverageProxy: readNestedNumber(derivedMetrics, 'organic_leverage_proxy'),
      organicContextSignal: readNestedString(derivedMetrics, 'organic_context_signal'),
    },
    nonAdditiveDiagnostics: {
      note: readNestedString(nonAdditive, 'note'),
      representativeSearchTerm: readNestedString(nonAdditive, 'representative_search_term'),
      tosIs: readNonAdditiveTrend(
        'tos_is_trend',
        'latest_observed_tos_is',
        'top_of_search_impression_share_latest'
      ),
      stis: readNonAdditiveTrend(
        'stis_trend',
        'latest_observed_stis',
        'representative_stis_latest'
      ),
      stir: readNonAdditiveTrend(
        'stir_trend',
        'latest_observed_stir',
        'representative_stir_latest'
      ),
    },
    rankingContext: {
      note: readNestedString(rankingContext, 'note'),
      organicObservedRanks: readRankingObservations('organic_observed_ranks'),
      sponsoredObservedRanks: readRankingObservations('sponsored_observed_ranks'),
    },
    demandProxies: {
      searchTermCount: numberValue(demandProxies?.search_term_count as number | null | undefined),
      sameTextSearchTermCount: numberValue(
        demandProxies?.same_text_search_term_count as number | null | undefined
      ),
      totalSearchTermImpressions: numberValue(
        demandProxies?.total_search_term_impressions as number | null | undefined
      ),
      totalSearchTermClicks: numberValue(
        demandProxies?.total_search_term_clicks as number | null | undefined
      ),
      representativeSearchTerm: readNestedString(demandProxies, 'representative_search_term'),
      representativeClickShare: readNestedNumber(demandProxies, 'representative_click_share'),
    },
    placementContext: {
      topOfSearchModifierPct: readNestedNumber(placementContext, 'top_of_search_modifier_pct'),
      impressions: readNestedNumber(placementContext, 'impressions'),
      clicks: readNestedNumber(placementContext, 'clicks'),
      orders: readNestedNumber(placementContext, 'orders'),
      units: readNestedNumber(placementContext, 'units'),
      sales: readNestedNumber(placementContext, 'sales'),
      spend: readNestedNumber(placementContext, 'spend'),
      note: readNestedString(placementContext, 'note'),
    },
    searchTermDiagnostics: {
      representativeSearchTerm: readNestedString(
        searchTermDiagnostics,
        'representative_search_term'
      ),
      representativeSameText: readNestedBoolean(
        searchTermDiagnostics,
        'representative_same_text'
      ),
      note: readNestedString(searchTermDiagnostics, 'note'),
      topTerms: topTermsRaw
        .map((entry) => asJsonObject(entry))
        .filter((entry): entry is JsonObject => entry !== null)
        .map((entry) => ({
          searchTerm: readNestedString(entry, 'search_term') ?? '—',
          sameText: readNestedBoolean(entry, 'same_text') ?? false,
          impressions: numberValue(entry.impressions as number | null | undefined),
          clicks: numberValue(entry.clicks as number | null | undefined),
          orders: numberValue(entry.orders as number | null | undefined),
          spend: numberValue(entry.spend as number | null | undefined),
          sales: numberValue(entry.sales as number | null | undefined),
          stis: readNestedNumber(entry, 'stis'),
          stir: readNestedNumber(entry, 'stir'),
        })),
    },
    coverage: {
      observedStart: readNestedString(coverage, 'observed_start'),
      observedEnd: readNestedString(coverage, 'observed_end'),
      daysObserved: numberValue(coverage?.days_observed as number | null | undefined),
      statuses: {
        tosIs: normalizeAdsOptimizerCoverageStatus(
          readNestedString(statuses, 'tos_is') as AdsOptimizerTargetCoverageStoredStatus | null
        ),
        stis: normalizeAdsOptimizerCoverageStatus(
          readNestedString(statuses, 'stis') as AdsOptimizerTargetCoverageStoredStatus | null
        ),
        stir: normalizeAdsOptimizerCoverageStatus(
          readNestedString(statuses, 'stir') as AdsOptimizerTargetCoverageStoredStatus | null
        ),
        placementContext: normalizeAdsOptimizerCoverageStatus(
          readNestedString(
            statuses,
            'placement_context'
          ) as AdsOptimizerTargetCoverageStoredStatus | null
        ),
        searchTerms: normalizeAdsOptimizerCoverageStatus(
          readNestedString(statuses, 'search_terms') as AdsOptimizerTargetCoverageStoredStatus | null
        ),
        breakEvenInputs: normalizeAdsOptimizerCoverageStatus(
          readNestedString(
            statuses,
            'break_even_inputs'
          ) as AdsOptimizerTargetCoverageStoredStatus | null
        ),
      },
      notes: coverageNotes,
      criticalWarnings,
    },
    state: {
      efficiency: {
        value: targetState?.efficiency.value ?? null,
        label: targetState?.efficiency.label ?? 'Not captured',
        detail:
          targetState?.efficiency.detail ??
          'This run predates Phase 6 state capture.',
        coverageStatus: targetState?.efficiency.coverageStatus ?? 'missing',
        reasonCodes: targetState?.efficiency.reasonCodes ?? [],
      },
      confidence: {
        value: targetState?.confidence.value ?? null,
        label: targetState?.confidence.label ?? 'Not captured',
        detail:
          targetState?.confidence.detail ??
          'This run predates Phase 6 state capture.',
        coverageStatus: targetState?.confidence.coverageStatus ?? 'missing',
        reasonCodes: targetState?.confidence.reasonCodes ?? [],
      },
      importance: {
        value: targetState?.importance.value ?? null,
        label: targetState?.importance.label ?? 'Not captured',
        detail:
          targetState?.importance.detail ??
          'This run predates Phase 6 state capture.',
        coverageStatus: targetState?.importance.coverageStatus ?? 'missing',
        reasonCodes: targetState?.importance.reasonCodes ?? [],
      },
      opportunityScore: targetState ? targetState.opportunityScore : null,
      riskScore: targetState ? targetState.riskScore : null,
      opportunityReasonCodes: targetState?.opportunityReasonCodes ?? [],
      riskReasonCodes: targetState?.riskReasonCodes ?? [],
      summaryReasonCodes: targetState?.summaryReasonCodes ?? [],
    },
    role: {
      desiredRole: {
        value: targetRole?.desiredRole.value ?? null,
        label: targetRole?.desiredRole.label ?? 'Not captured',
        detail:
          targetRole?.desiredRole.detail ??
          'This run predates Phase 7 role capture.',
        coverageStatus: targetRole?.desiredRole.coverageStatus ?? 'missing',
        reasonCodes: targetRole?.desiredRole.reasonCodes ?? [],
      },
      currentRole: {
        value: targetRole?.currentRole.value ?? null,
        label: targetRole?.currentRole.label ?? 'Not captured',
        detail:
          targetRole?.currentRole.detail ??
          'This run predates Phase 7 role capture.',
        coverageStatus: targetRole?.currentRole.coverageStatus ?? 'missing',
        reasonCodes: targetRole?.currentRole.reasonCodes ?? [],
      },
      previousRole: targetRole?.previousRole ?? null,
      transitionRule: targetRole?.transitionRule ?? 'missing_role_engine',
      transitionReasonCodes: targetRole?.transitionReasonCodes ?? [],
      summaryReasonCodes: targetRole?.summaryReasonCodes ?? [],
      guardrails: targetRole?.guardrails ?? {
        coverageStatus: 'missing',
        categories: {
          noSaleSpendCap: null,
          noSaleClickCap: null,
          maxLossPerCycle: null,
          maxBidIncreasePerCyclePct: null,
          maxBidDecreasePerCyclePct: null,
          maxPlacementBiasIncreasePerCyclePct: null,
          rankPushTimeLimitDays: null,
          manualApprovalThreshold: 'medium',
          autoPauseThreshold: null,
          minBidFloor: null,
          maxBidCeiling: null,
        },
        flags: {
          requiresManualApproval: true,
          autoPauseEligible: false,
          bidChangesAllowed: false,
          placementChangesAllowed: false,
          transitionLocked: false,
        },
        reasonCodes: [],
        notes: [],
      },
    },
  };
};

export const mapTargetProfileRowToSnapshotView = (
  row: AdsOptimizerTargetProfileRow,
  context?: {
    targetSnapshotId?: string;
    runId?: string;
    createdAt?: string;
  }
): AdsOptimizerTargetProfileSnapshotView =>
  mapTargetSnapshotToProfileView({
    target_snapshot_id:
      context?.targetSnapshotId ??
      `profile:${row.targetId}:${row.asin}:${row.campaignId}:${row.adGroupId || 'root'}`,
    run_id: context?.runId ?? '__ads_optimizer_profile_row__',
    created_at: context?.createdAt ?? '',
    asin: row.asin,
    campaign_id: row.campaignId,
    ad_group_id: row.adGroupId,
    target_id: row.targetId,
    coverage_note: row.coverageNote,
    snapshot_payload_json: row.snapshotPayload,
  });

export const loadAdsOptimizerTargetProfiles = async (args: {
  asin: string;
  start: string;
  end: string;
  overviewData?: AdsOptimizerOverviewData;
}): Promise<AdsOptimizerTargetProfileLoadResult> => {
  const asinNorm = normalizeSpAdvertisedAsin(args.asin);
  if (!asinNorm) {
    return {
      rows: [],
      zeroTargetDiagnostics: {
        code: 'INVALID_ASIN_SCOPE',
        message: `ASIN ${args.asin} is invalid after SP advertised-ASIN normalization.`,
        asin: args.asin,
        start: args.start,
        end: args.end,
      },
    };
  }

  const advertisedRows = await loadTargetScopeMembership({
    asinNorm,
    start: args.start,
    end: args.end,
  });
  if (advertisedRows.length === 0) {
    return {
      rows: [],
      zeroTargetDiagnostics: {
        code: 'NO_ADVERTISED_PRODUCT_SCOPE',
        message:
          'No SP advertised-product rows matched the selected ASIN within the selected window, so no target scope could be resolved.',
        asin: args.asin,
        asin_norm: asinNorm,
        start: args.start,
        end: args.end,
      },
    };
  }

  const campaignIds = Array.from(
    new Set(advertisedRows.map((row) => trimString(row.campaign_id)).filter(Boolean) as string[])
  );
  const scopedAdvertisedRows =
    campaignIds.length > 0
      ? await loadScopedAdvertisedProductRows({
          campaignIds,
          start: args.start,
          end: args.end,
        })
      : advertisedRows;
  const scopeSummary = resolveSpProductScopeSummary({
    selectedRows: advertisedRows,
    scopedRows: scopedAdvertisedRows,
  });

  if (scopeSummary.adGroupIds.length === 0 && scopeSummary.campaignIds.length === 0) {
    return {
      rows: [],
      zeroTargetDiagnostics: {
        code: 'NO_TARGET_SCOPE_IDS',
        message:
          'Advertised-product rows existed, but no campaign or ad group identifiers were available to resolve SP target scope.',
        asin: args.asin,
        asin_norm: asinNorm,
        start: args.start,
        end: args.end,
        advertised_product_rows: advertisedRows.length,
      },
    };
  }

  const asinScopeMembership = buildAsinScopeMembership(advertisedRows);
  const targetingRows = await loadTargetingRowsByScope({
    idColumn: 'ad_group_id',
    ids: scopeSummary.adGroupIds,
    start: args.start,
    end: args.end,
  });
  const campaignFallbackRows =
    scopeSummary.campaignIds.length > 0
      ? await loadTargetingRowsByScope({
          idColumn: 'campaign_id',
          ids: scopeSummary.campaignIds,
          start: args.start,
          end: args.end,
          onlyNullAdGroup: true,
        })
      : [];
  const allTargetingRows = [...targetingRows, ...campaignFallbackRows];
  const normalizedTargetingRows = normalizeTargetingRowsForProfiles(allTargetingRows);

  if (normalizedTargetingRows.length === 0) {
    return {
      rows: [],
      zeroTargetDiagnostics: {
        code: 'NO_TARGET_ROWS_FOUND',
        message:
          'SP target scope was resolved, but no SP targeting fact rows matched the selected ASIN/date scope.',
        asin: args.asin,
        asin_norm: asinNorm,
        start: args.start,
        end: args.end,
        scope_resolution: {
          advertised_product_rows: advertisedRows.length,
          ad_group_ids: scopeSummary.adGroupIds.length,
          campaign_ids: scopeSummary.campaignIds.length,
          ambiguous_campaign_ids: scopeSummary.ambiguousCampaignIds.size,
          campaign_fallback_ids: scopeSummary.campaignIds.length,
        },
      },
    };
  }

  const scopedCampaignIds = Array.from(
    new Set(
      normalizedTargetingRows
        .map((row) => trimString(row.campaign_id))
        .filter(Boolean) as string[]
    )
  );
  const [searchTermRowsByAdGroup, searchTermRowsByCampaignFallback, placementRows, overviewData] =
    await Promise.all([
      scopeSummary.adGroupIds.length > 0
        ? loadSearchTermRowsByScope({
            idColumn: 'ad_group_id',
            ids: scopeSummary.adGroupIds,
            start: args.start,
            end: args.end,
          })
        : Promise.resolve([] as SpSearchTermFactRow[]),
      scopeSummary.campaignIds.length > 0
        ? loadSearchTermRowsByScope({
            idColumn: 'campaign_id',
            ids: scopeSummary.campaignIds,
            start: args.start,
            end: args.end,
            onlyNullAdGroup: true,
          })
        : Promise.resolve([] as SpSearchTermFactRow[]),
      scopedCampaignIds.length > 0
        ? loadPlacementRowsByCampaignIds({
            campaignIds: scopedCampaignIds,
            start: args.start,
            end: args.end,
          })
        : Promise.resolve([] as SpPlacementFactRow[]),
      args.overviewData
        ? Promise.resolve(args.overviewData)
        : getAdsOptimizerOverviewData({
            accountId: env.accountId,
            marketplace: env.marketplace,
            asin: args.asin,
            start: args.start,
            end: args.end,
          }),
    ]);
  const searchTermRows = [...searchTermRowsByAdGroup, ...searchTermRowsByCampaignFallback];

  const normalizedSearchTermRows = normalizeSearchTermRowsForProfiles(searchTermRows);
  const coverageByTarget = buildTargetCoverageById(normalizedTargetingRows);
  const tosTrendByTarget = buildTargetTosTrendById(normalizedTargetingRows);
  const searchTermDiagnosticTrendsByTarget = buildSearchTermDiagnosticTrendsByTarget(
    normalizedSearchTermRows
  );
  const rawIdentityByProfileKey = new Map<
    string,
    {
      rawTargetId: string | null;
      rawAdGroupId: string | null;
      targetingRaw: string | null;
      targetingNorm: string | null;
    }
  >();
  allTargetingRows.forEach((row) => {
    const key = buildTargetProfileKey(row);
    if (rawIdentityByProfileKey.has(key)) return;
    rawIdentityByProfileKey.set(key, {
      rawTargetId: trimString(row.target_id),
      rawAdGroupId: trimString(row.ad_group_id),
      targetingRaw: trimString(row.targeting_raw),
      targetingNorm: trimString(row.targeting_norm),
    });
  });
  const currentSnapshotResult = await loadCurrentSnapshot({
    rawTargetIds: Array.from(
      new Set(
        Array.from(rawIdentityByProfileKey.values())
          .map((value) => value.rawTargetId)
          .filter((value): value is string => Boolean(value))
      )
    ),
    campaignIds: scopedCampaignIds,
  });
  const currentTargetsByProfileKey = new Map<
    string,
    CurrentSnapshotData['targetsById'] extends Map<string, infer TValue> ? TValue : never
  >();
  rawIdentityByProfileKey.forEach((value, profileKey) => {
    if (!value.rawTargetId) return;
    const currentTarget = currentSnapshotResult.data?.targetsById.get(value.rawTargetId);
    if (currentTarget) {
      currentTargetsByProfileKey.set(profileKey, currentTarget);
    }
  });
  const workspaceModel = buildSpTargetsWorkspaceModel({
    targetRows: normalizedTargetingRows,
    searchTermRows: normalizedSearchTermRows,
    placementRows,
    currentTargetsById: currentTargetsByProfileKey,
    currentAdGroupsById: currentSnapshotResult.data?.adGroupsById,
    currentCampaignsById: currentSnapshotResult.data?.campaignsById,
    currentPlacementModifiers: currentSnapshotResult.data
      ? Array.from(currentSnapshotResult.data.placementsByKey.values())
      : [],
    ambiguousCampaignIds: scopeSummary.ambiguousCampaignIds,
  });

  const rows = workspaceModel.rows
    .sort((left, right) => right.spend - left.spend || left.target_id.localeCompare(right.target_id))
    .map((target) =>
      buildTargetProfileViewRow({
        asin: args.asin,
        requestedStart: args.start,
        requestedEnd: args.end,
        target,
        rawIdentity: rawIdentityByProfileKey.get(target.target_id) ?? null,
        coverageWindow: coverageByTarget.get(target.target_id) ?? null,
        membership: asinScopeMembership,
        tosTrend: buildNonAdditiveTrend(
          tosTrendByTarget.get(target.target_id) ?? [],
          target.tos_is
        ),
        representativeSearchTermTrends: getRepresentativeSearchTerm(target.search_terms)?.search_term_norm
          ? (() => {
              const representative = getRepresentativeSearchTerm(target.search_terms);
              if (!representative?.search_term_norm) return null;
              const representativeBucket = searchTermDiagnosticTrendsByTarget
                .get(target.target_id)
                ?.get(representative.search_term_norm);
              if (!representativeBucket) return null;
              return {
                stis: buildNonAdditiveTrend(
                  representativeBucket.stis,
                  representative.stis
                ),
                stir: buildNonAdditiveTrend(
                  representativeBucket.stir,
                  representative.stir
                ),
              };
            })()
          : null,
        overview: overviewData,
        currentSnapshotDate: currentSnapshotResult.data?.snapshotDate ?? null,
        currentSnapshotWarning: currentSnapshotResult.warning,
      })
    );

  return {
    rows,
    zeroTargetDiagnostics:
      rows.length === 0
        ? {
            code: 'NO_TARGET_PROFILE_ROWS',
            message:
              'Target facts were loaded, but no Phase 5 target profile rows could be materialized.',
            asin: args.asin,
            start: args.start,
            end: args.end,
          }
        : null,
  };
};
