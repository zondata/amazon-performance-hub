import 'server-only';

import { env } from '@/lib/env';
import { normalizeSpAdvertisedAsin } from '@/lib/ads/spAdvertisedAsinScope';
import {
  resolveSpProductScopeSummary,
  type SpScopeAdvertisedProductRow,
} from '@/lib/ads/spTargetsWorkspaceModel';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import { getAdsOptimizerOverviewData, type AdsOptimizerOverviewData } from './overview';
import {
  createAdsOptimizerRun,
  findOptimizerProductByAsin,
  getAdsOptimizerRuntimeContext,
  insertAdsOptimizerProductSnapshots,
  insertAdsOptimizerRecommendationSnapshots,
  insertAdsOptimizerTargetSnapshots,
  listAdsOptimizerRuns,
  updateAdsOptimizerRun,
} from './repoRuntime';
import type { JsonObject } from './runtimeTypes';

type CreateAdsOptimizerManualRunInput = {
  asin: string;
  start: string;
  end: string;
};

type ProductSnapshotInput = {
  productId: string | null;
  asin: string;
  snapshotPayload: JsonObject;
};

type TargetSnapshotInput = {
  asin: string;
  campaignId: string;
  adGroupId: string;
  targetId: string;
  sourceScope: string;
  coverageNote: string;
  snapshotPayload: JsonObject;
};

type TargetSnapshotLoadResult = {
  rows: TargetSnapshotInput[];
  zeroTargetDiagnostics: JsonObject | null;
};

export type AdsOptimizerManualRunResult = {
  runId: string;
  status: 'completed' | 'failed';
  productSnapshotCount: number;
  targetSnapshotCount: number;
  recommendationSnapshotCount: number;
  diagnostics: JsonObject | null;
};

export type AdsOptimizerHistoryViewData = {
  activeVersionLabel: string;
  runs: Awaited<ReturnType<typeof listAdsOptimizerRuns>>;
};

type ExecuteManualRunDeps = {
  now: () => string;
  getRuntimeContext: typeof getAdsOptimizerRuntimeContext;
  createRun: typeof createAdsOptimizerRun;
  updateRun: typeof updateAdsOptimizerRun;
  loadProductSnapshotInput: (args: {
    asin: string;
    start: string;
    end: string;
  }) => Promise<ProductSnapshotInput>;
  loadTargetSnapshotInputs: (args: {
    asin: string;
    start: string;
    end: string;
  }) => Promise<TargetSnapshotLoadResult>;
  insertProductSnapshots: typeof insertAdsOptimizerProductSnapshots;
  insertTargetSnapshots: typeof insertAdsOptimizerTargetSnapshots;
  insertRecommendationSnapshots: typeof insertAdsOptimizerRecommendationSnapshots;
};

type SpAdvertisedProductRow = SpScopeAdvertisedProductRow & {
  date: string | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
};

type SpTargetingRow = {
  date: string | null;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  campaign_name_raw: string | null;
  ad_group_name_raw: string | null;
  targeting_raw: string | null;
  targeting_norm: string | null;
  match_type_raw: string | null;
  match_type_norm: string | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
  cpc: number | null;
  ctr: number | null;
  acos: number | null;
  roas: number | null;
  conversion_rate: number | null;
  top_of_search_impression_share: number | null;
  exported_at: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TARGET_SOURCE_SCOPE = 'asin_via_sp_advertised_product_membership';
const TARGET_COVERAGE_NOTE =
  'Target snapshots are scoped to the selected ASIN through SP advertised-product campaign/ad group membership. SP targeting facts are not ASIN-attributed, so top-of-search impression share is stored as the latest observed value only and not averaged across days.';

const numberValue = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const safeRatio = (numerator: number, denominator: number) =>
  denominator > 0 ? numerator / denominator : null;

const normalizeManualRunInput = (input: CreateAdsOptimizerManualRunInput) => {
  const asin = input.asin.trim();
  const start = input.start.trim();
  const end = input.end.trim();

  if (!asin || asin === 'all') {
    throw new Error('Manual optimizer runs require one selected ASIN in Phase 4.');
  }
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    throw new Error('start and end must be valid YYYY-MM-DD dates.');
  }
  if (start > end) {
    throw new Error('start must be on or before end.');
  }

  return {
    asin,
    start,
    end,
  };
};

const chunk = <T,>(items: T[], size: number) => {
  const buckets: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    buckets.push(items.slice(index, index + size));
  }
  return buckets;
};

const trimString = (value: string | null | undefined) => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildProductSnapshotPayload = (
  asin: string,
  start: string,
  end: string,
  overview: AdsOptimizerOverviewData
): JsonObject => ({
  phase: 4,
  capture_type: 'product_snapshot',
  source: 'phase3_product_command_center',
  execution_boundary: 'snapshot_only',
  window: {
    start,
    end,
  },
  asin,
  overview,
});

const loadProductSnapshotInput = async (args: {
  asin: string;
  start: string;
  end: string;
}): Promise<ProductSnapshotInput> => {
  const [productMeta, overview] = await Promise.all([
    findOptimizerProductByAsin(args.asin),
    getAdsOptimizerOverviewData({
      accountId: env.accountId,
      marketplace: env.marketplace,
      asin: args.asin,
      start: args.start,
      end: args.end,
    }),
  ]);

  return {
    productId: productMeta?.productId ?? null,
    asin: args.asin,
    snapshotPayload: buildProductSnapshotPayload(args.asin, args.start, args.end, overview),
  };
};

const loadTargetScopeMembership = async (args: {
  asin: string;
  start: string;
  end: string;
  asinNorm: string;
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
}): Promise<SpTargetingRow[]> => {
  const rows: SpTargetingRow[] = [];

  for (const batch of chunk(args.ids, 100)) {
    const fetched = await fetchAllRows<SpTargetingRow>((from, to) =>
      supabaseAdmin
        .from('sp_targeting_daily_fact_latest')
        .select(
          [
            'date',
            'campaign_id',
            'ad_group_id',
            'target_id',
            'campaign_name_raw',
            'ad_group_name_raw',
            'targeting_raw',
            'targeting_norm',
            'match_type_raw',
            'match_type_norm',
            'impressions',
            'clicks',
            'spend',
            'sales',
            'orders',
            'units',
            'cpc',
            'ctr',
            'acos',
            'roas',
            'conversion_rate',
            'top_of_search_impression_share',
            'exported_at',
          ].join(',')
        )
        .eq('account_id', env.accountId)
        .gte('date', args.start)
        .lte('date', args.end)
        .in(args.idColumn, batch)
        .range(from, to)
    );
    rows.push(...fetched);
  }

  return rows;
};

export const loadTargetSnapshotInputs = async (args: {
  asin: string;
  start: string;
  end: string;
}): Promise<TargetSnapshotLoadResult> => {
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
    ...args,
    asinNorm,
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

  const membershipByAdGroup = new Map<
    string,
    {
      firstDate: string | null;
      lastDate: string | null;
      productAdSpend: number;
      productAdSales: number;
      productOrders: number;
      productUnits: number;
    }
  >();
  advertisedRows.forEach((row) => {
    const adGroupId = row.ad_group_id?.trim();
    if (!adGroupId) return;
    const bucket = membershipByAdGroup.get(adGroupId) ?? {
      firstDate: null,
      lastDate: null,
      productAdSpend: 0,
      productAdSales: 0,
      productOrders: 0,
      productUnits: 0,
    };
    const observedDate = row.date ?? null;
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
    membershipByAdGroup.set(adGroupId, bucket);
  });

  const campaignsWithAdGroupScope = new Set(
    advertisedRows
      .filter((row) => trimString(row.ad_group_id) !== null)
      .map((row) => trimString(row.campaign_id))
      .filter((value): value is string => value !== null)
  );
  const campaignIdsWithoutAdGroupScope = scopeSummary.campaignIds.filter(
    (campaignId) => !campaignsWithAdGroupScope.has(campaignId)
  );

  const targetingRows = await loadTargetingRowsByScope({
    idColumn: 'ad_group_id',
    ids: scopeSummary.adGroupIds,
    start: args.start,
    end: args.end,
  });
  const campaignFallbackRows =
    campaignIdsWithoutAdGroupScope.length > 0
      ? await loadTargetingRowsByScope({
          idColumn: 'campaign_id',
          ids: campaignIdsWithoutAdGroupScope,
          start: args.start,
          end: args.end,
        })
      : [];
  const allTargetingRows = [...targetingRows, ...campaignFallbackRows];

  const targetBuckets = new Map<
    string,
    {
      campaignId: string;
      adGroupId: string;
      targetId: string;
      campaignName: string | null;
      adGroupName: string | null;
      targetingRaw: string | null;
      targetingNorm: string | null;
      matchTypeRaw: string | null;
      matchTypeNorm: string | null;
      dateStart: string | null;
      dateEnd: string | null;
      daysObserved: number;
      impressions: number;
      clicks: number;
      spend: number;
      sales: number;
      orders: number;
      units: number;
      latestExportedAt: string | null;
      latestTopOfSearchImpressionShare: number | null;
      latestTopOfSearchImpressionShareDate: string | null;
      coverageNote: string;
    }
  >();

  allTargetingRows.forEach((row) => {
    const targetId = row.target_id?.trim();
    const campaignId = row.campaign_id?.trim();
    const adGroupId = row.ad_group_id?.trim();
    if (!targetId || !campaignId || !adGroupId) return;

    const membership = membershipByAdGroup.get(adGroupId);
    if (!membership) return;

    const existing = targetBuckets.get(targetId);
    const bucket =
      existing ??
      {
        campaignId,
        adGroupId,
        targetId,
        campaignName: row.campaign_name_raw ?? null,
        adGroupName: row.ad_group_name_raw ?? null,
        targetingRaw: row.targeting_raw ?? null,
        targetingNorm: row.targeting_norm ?? null,
        matchTypeRaw: row.match_type_raw ?? null,
        matchTypeNorm: row.match_type_norm ?? null,
        dateStart: null,
        dateEnd: null,
        daysObserved: 0,
        impressions: 0,
        clicks: 0,
        spend: 0,
        sales: 0,
        orders: 0,
        units: 0,
        latestExportedAt: null,
        latestTopOfSearchImpressionShare: null,
        latestTopOfSearchImpressionShareDate: null,
        coverageNote: TARGET_COVERAGE_NOTE,
      };

    const observedDate = row.date ?? null;
    if (observedDate && (!bucket.dateStart || observedDate < bucket.dateStart)) {
      bucket.dateStart = observedDate;
    }
    if (observedDate && (!bucket.dateEnd || observedDate > bucket.dateEnd)) {
      bucket.dateEnd = observedDate;
    }
    bucket.daysObserved += 1;
    bucket.impressions += numberValue(row.impressions);
    bucket.clicks += numberValue(row.clicks);
    bucket.spend += numberValue(row.spend);
    bucket.sales += numberValue(row.sales);
    bucket.orders += numberValue(row.orders);
    bucket.units += numberValue(row.units);

    if (row.exported_at && (!bucket.latestExportedAt || row.exported_at > bucket.latestExportedAt)) {
      bucket.latestExportedAt = row.exported_at;
    }

    if (
      row.top_of_search_impression_share !== null &&
      row.top_of_search_impression_share !== undefined &&
      observedDate &&
      (!bucket.latestTopOfSearchImpressionShareDate ||
        observedDate >= bucket.latestTopOfSearchImpressionShareDate)
    ) {
      bucket.latestTopOfSearchImpressionShare = numberValue(row.top_of_search_impression_share);
      bucket.latestTopOfSearchImpressionShareDate = observedDate;
    }

    if (existing && (existing.campaignId !== campaignId || existing.adGroupId !== adGroupId)) {
      bucket.coverageNote = `${TARGET_COVERAGE_NOTE} Target identity appeared under multiple campaign/ad group chains within the selected window; the earliest resolved chain is stored on the snapshot row.`;
    }

    targetBuckets.set(targetId, bucket);
  });

  const rows = Array.from(targetBuckets.values())
    .sort((left, right) => right.spend - left.spend || left.targetId.localeCompare(right.targetId))
    .map((bucket) => {
      const membership = membershipByAdGroup.get(bucket.adGroupId);
      return {
        asin: args.asin,
        campaignId: bucket.campaignId,
        adGroupId: bucket.adGroupId,
        targetId: bucket.targetId,
        sourceScope: TARGET_SOURCE_SCOPE,
        coverageNote: bucket.coverageNote,
        snapshotPayload: {
          phase: 4,
          capture_type: 'target_snapshot',
          source_scope: TARGET_SOURCE_SCOPE,
          execution_boundary: 'snapshot_only',
          window: {
            start: args.start,
            end: args.end,
            observed_start: bucket.dateStart,
            observed_end: bucket.dateEnd,
          },
          identity: {
            campaign_id: bucket.campaignId,
            ad_group_id: bucket.adGroupId,
            target_id: bucket.targetId,
            campaign_name: bucket.campaignName,
            ad_group_name: bucket.adGroupName,
            targeting_raw: bucket.targetingRaw,
            targeting_norm: bucket.targetingNorm,
            match_type_raw: bucket.matchTypeRaw,
            match_type_norm: bucket.matchTypeNorm,
          },
          totals: {
            impressions: bucket.impressions,
            clicks: bucket.clicks,
            spend: bucket.spend,
            sales: bucket.sales,
            orders: bucket.orders,
            units: bucket.units,
            cpc: safeRatio(bucket.spend, bucket.clicks),
            ctr: safeRatio(bucket.clicks, bucket.impressions),
            acos: safeRatio(bucket.spend, bucket.sales),
            roas: safeRatio(bucket.sales, bucket.spend),
            conversion_rate: safeRatio(bucket.orders, bucket.clicks),
          },
          non_additive_diagnostics: {
            top_of_search_impression_share_latest: bucket.latestTopOfSearchImpressionShare,
            top_of_search_impression_share_date: bucket.latestTopOfSearchImpressionShareDate,
            note: 'Stored as the latest observed value only. It is not averaged across days.',
          },
          asin_scope_membership: membership
            ? {
                ad_group_id: bucket.adGroupId,
                first_observed_date: membership.firstDate,
                last_observed_date: membership.lastDate,
                product_ad_spend: membership.productAdSpend,
                product_ad_sales: membership.productAdSales,
                product_orders: membership.productOrders,
                product_units: membership.productUnits,
              }
            : null,
          coverage: {
            days_observed: bucket.daysObserved,
            note: bucket.coverageNote,
          },
          scope_resolution: {
            advertised_product_rows: advertisedRows.length,
            ad_group_ids: scopeSummary.adGroupIds.length,
            campaign_ids: scopeSummary.campaignIds.length,
            ambiguous_campaign_ids: scopeSummary.ambiguousCampaignIds.size,
            campaign_fallback_ids: campaignIdsWithoutAdGroupScope.length,
          },
          exported_at_latest: bucket.latestExportedAt,
        },
      };
    });

  return {
    rows,
    zeroTargetDiagnostics:
      rows.length === 0
        ? {
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
              campaign_fallback_ids: campaignIdsWithoutAdGroupScope.length,
            },
          }
        : null,
  };
};

const buildFailureDiagnostics = (stage: string, error: unknown): JsonObject => ({
  stage,
  error_message: error instanceof Error ? error.message : 'Unknown optimizer run failure.',
  recorded_at: new Date().toISOString(),
});

const defaultDeps: ExecuteManualRunDeps = {
  now: () => new Date().toISOString(),
  getRuntimeContext: getAdsOptimizerRuntimeContext,
  createRun: createAdsOptimizerRun,
  updateRun: updateAdsOptimizerRun,
  loadProductSnapshotInput,
  loadTargetSnapshotInputs,
  insertProductSnapshots: insertAdsOptimizerProductSnapshots,
  insertTargetSnapshots: insertAdsOptimizerTargetSnapshots,
  insertRecommendationSnapshots: insertAdsOptimizerRecommendationSnapshots,
};

export const executeAdsOptimizerManualRun = async (
  input: CreateAdsOptimizerManualRunInput,
  deps: ExecuteManualRunDeps = defaultDeps
): Promise<AdsOptimizerManualRunResult> => {
  const args = normalizeManualRunInput(input);
  const runtimeContext = await deps.getRuntimeContext();
  const run = await deps.createRun({
    selectedAsin: args.asin,
    dateStart: args.start,
    dateEnd: args.end,
    rulePackVersionId: runtimeContext.activeVersion.rule_pack_version_id,
    rulePackVersionLabel: runtimeContext.activeVersion.version_label,
    inputSummary: {
      phase: 4,
      requested_scope: {
        asin: args.asin,
        start: args.start,
        end: args.end,
        channel: 'sp',
        run_kind: 'manual',
      },
      rule_pack_version: {
        rule_pack_version_id: runtimeContext.activeVersion.rule_pack_version_id,
        version_label: runtimeContext.activeVersion.version_label,
      },
      snapshot_boundaries: {
        product_snapshot_source: 'phase3_product_command_center',
        target_snapshot_source: TARGET_SOURCE_SCOPE,
        recommendation_snapshot_behavior:
          'Persisted as Phase 4 placeholders only. No recommendation engine is active yet.',
        execution_boundary: 'Existing Ads Workspace remains the execution path.',
      },
    },
  });

  await deps.updateRun(run.run_id, {
    status: 'running',
    diagnostics: null,
    startedAt: deps.now(),
    completedAt: null,
  });

  try {
    const [productSnapshot, targetSnapshotLoad] = await Promise.all([
      deps.loadProductSnapshotInput(args),
      deps.loadTargetSnapshotInputs(args),
    ]);

    const insertedProductSnapshots = await deps.insertProductSnapshots([
      {
        runId: run.run_id,
        productId: productSnapshot.productId,
        asin: productSnapshot.asin,
        snapshotPayload: productSnapshot.snapshotPayload,
      },
    ]);

    const insertedTargetSnapshots = await deps.insertTargetSnapshots(
      targetSnapshotLoad.rows.map((row) => ({
        runId: run.run_id,
        asin: row.asin,
        campaignId: row.campaignId,
        adGroupId: row.adGroupId,
        targetId: row.targetId,
        sourceScope: row.sourceScope,
        coverageNote: row.coverageNote,
        snapshotPayload: row.snapshotPayload,
      }))
    );

    const insertedRecommendationSnapshots = await deps.insertRecommendationSnapshots(
      insertedTargetSnapshots.map((snapshot) => ({
        runId: run.run_id,
        targetSnapshotId: snapshot.target_snapshot_id,
        asin: snapshot.asin,
        status: 'pending_phase5',
        actionType: null,
        reasonCodes: ['PHASE4_BACKBONE_ONLY', 'NO_RECOMMENDATION_ENGINE_ACTIVE'],
        snapshotPayload: {
          phase: 4,
          capture_type: 'recommendation_snapshot',
          output_state: 'pending_phase5',
          execution_boundary: 'snapshot_only',
          target_snapshot_id: snapshot.target_snapshot_id,
          target_id: snapshot.target_id,
          note: 'Phase 4 persists recommendation placeholders only. No target decision engine is active yet.',
        },
      }))
    );

    await deps.updateRun(run.run_id, {
      status: 'completed',
      diagnostics: targetSnapshotLoad.zeroTargetDiagnostics,
      productSnapshotCount: insertedProductSnapshots.length,
      targetSnapshotCount: insertedTargetSnapshots.length,
      recommendationSnapshotCount: insertedRecommendationSnapshots.length,
      roleTransitionCount: 0,
      completedAt: deps.now(),
    });

    return {
      runId: run.run_id,
      status: 'completed',
      productSnapshotCount: insertedProductSnapshots.length,
      targetSnapshotCount: insertedTargetSnapshots.length,
      recommendationSnapshotCount: insertedRecommendationSnapshots.length,
      diagnostics: targetSnapshotLoad.zeroTargetDiagnostics,
    };
  } catch (error) {
    const diagnostics = buildFailureDiagnostics('manual_run', error);
    await deps.updateRun(run.run_id, {
      status: 'failed',
      diagnostics,
      completedAt: deps.now(),
    });

    return {
      runId: run.run_id,
      status: 'failed',
      productSnapshotCount: 0,
      targetSnapshotCount: 0,
      recommendationSnapshotCount: 0,
      diagnostics,
    };
  }
};

export const getAdsOptimizerHistoryViewData = async (asin: string): Promise<AdsOptimizerHistoryViewData> => {
  const runtimeContext = await getAdsOptimizerRuntimeContext();
  const runs = await listAdsOptimizerRuns({
    asin: asin === 'all' ? undefined : asin,
    limit: 30,
  });

  return {
    activeVersionLabel: runtimeContext.activeVersion.version_label,
    runs,
  };
};
