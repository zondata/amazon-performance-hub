import 'server-only';

import { fetchCurrentSpData } from '@/lib/bulksheets/fetchCurrent';
import { fetchAsinOptions } from '@/lib/products/fetchAsinOptions';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { normalizeSpAdvertisedAsin } from './spAdvertisedAsinScope';
import {
  buildSpTargetsWorkspaceModel,
  resolveSpProductScopeSummary,
  SpPlacementFactRow,
  SpScopeAdvertisedProductRow,
  SpSearchTermFactRow,
  SpTargetFactRow,
} from './spTargetsWorkspaceModel';

type GetSpTargetsWorkspaceDataArgs = {
  accountId: string;
  marketplace: string;
  start: string;
  end: string;
  asinFilter: string;
};

type CurrentSnapshotData = Awaited<ReturnType<typeof fetchCurrentSpData>>;

const ID_CHUNK_SIZE = 250;

const trimString = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const emptyTotals = {
  targets: 0,
  impressions: 0,
  clicks: 0,
  orders: 0,
  units: 0,
  sales: 0,
  spend: 0,
  conversion: null,
  cpc: null,
  ctr: null,
  acos: null,
  roas: null,
};

const chunkIds = (ids: string[], size = ID_CHUNK_SIZE) => {
  const unique = [...new Set(ids.map((value) => value.trim()).filter((value) => value.length > 0))];
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += size) {
    chunks.push(unique.slice(index, index + size));
  }
  return chunks;
};

const uniqueBy = <TRow,>(rows: TRow[], getKey: (row: TRow) => string) => {
  const deduped = new Map<string, TRow>();
  for (const row of rows) {
    deduped.set(getKey(row), row);
  }
  return Array.from(deduped.values());
};

const fetchRowsByIdChunks = async <TRow,>(params: {
  table: string;
  select: string;
  idColumn: string;
  ids: string[];
  accountId: string;
  start: string;
  end: string;
}): Promise<TRow[]> => {
  if (params.ids.length === 0) return [];
  const rows: TRow[] = [];
  for (const chunk of chunkIds(params.ids)) {
    const query = supabaseAdmin
      .from(params.table)
      .select(params.select)
      .eq('account_id', params.accountId)
      .gte('date', params.start)
      .lte('date', params.end)
      .in(params.idColumn, chunk)
      .order('date', { ascending: true });
    const chunkRows = await fetchAllRows<TRow>((from, to) => query.range(from, to));
    rows.push(...chunkRows);
  }
  return rows;
};

const fetchProductScopeRows = async (params: {
  accountId: string;
  start: string;
  end: string;
  asinNorm: string;
}) => {
  const query = supabaseAdmin
    .from('sp_advertised_product_daily_fact_latest')
    .select('campaign_id,ad_group_id,advertised_asin_norm')
    .eq('account_id', params.accountId)
    .eq('advertised_asin_norm', params.asinNorm)
    .gte('date', params.start)
    .lte('date', params.end)
    .order('date', { ascending: true });

  return fetchAllRows<SpScopeAdvertisedProductRow>((from, to) => query.range(from, to));
};

const fetchScopedAdvertisedProductRows = async (params: {
  accountId: string;
  start: string;
  end: string;
  campaignIds: string[];
}) => {
  return fetchRowsByIdChunks<SpScopeAdvertisedProductRow>({
    table: 'sp_advertised_product_daily_fact_latest',
    select: 'campaign_id,ad_group_id,advertised_asin_norm',
    idColumn: 'campaign_id',
    ids: params.campaignIds,
    accountId: params.accountId,
    start: params.start,
    end: params.end,
  });
};

const loadCurrentSnapshot = async (
  targetIds: string[],
  campaignIds: string[]
): Promise<{ data: CurrentSnapshotData | null; warning: string | null }> => {
  if (targetIds.length === 0 && campaignIds.length === 0) {
    return { data: null, warning: null };
  }

  try {
    const actions = [
      ...targetIds.map((targetId) => ({ type: 'update_target_bid', target_id: targetId })),
      ...campaignIds.map((campaignId) => ({
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
          ? `Current bulk snapshot context is unavailable: ${error.message}`
          : 'Current bulk snapshot context is unavailable.',
    };
  }
};

export const getSpTargetsWorkspaceData = async ({
  accountId,
  marketplace,
  start,
  end,
  asinFilter,
}: GetSpTargetsWorkspaceDataArgs) => {
  const asinOptions = await fetchAsinOptions(accountId, marketplace);
  const warnings: string[] = [
    'Ads reports can finalize with delay (48h+).',
    'P&L and break-even bid remain hidden until deterministic economics allocation exists for SP entity rows.',
    'Campaign placement context is shown separately; it is not flattened into target facts.',
  ];

  let scopeCampaignIds: string[] = [];
  let scopeAdGroupIds: string[] = [];
  let scopeCampaignIdsWithoutAdGroupScope: string[] = [];
  let ambiguousCampaignIds = new Set<string>();

  if (asinFilter !== 'all') {
    const asinNorm = normalizeSpAdvertisedAsin(asinFilter);
    if (!asinNorm) {
      warnings.push(`ASIN filter ${asinFilter} is invalid after normalization.`);
      return {
        asinOptions,
        warnings,
        rows: [],
        totals: emptyTotals,
      };
    }
    const selectedRows = await fetchProductScopeRows({
      accountId,
      start,
      end,
      asinNorm,
    });

    if (selectedRows.length === 0) {
      warnings.push(
        `No SP advertised-product rows matched ASIN ${asinFilter} in ${start}..${end}. The Targets table is empty until that ASIN appears in SP advertised-product facts for the selected window.`
      );
      return {
        asinOptions,
        warnings,
        rows: [],
        totals: emptyTotals,
      };
    }

    const scopedRows = await fetchScopedAdvertisedProductRows({
      accountId,
      start,
      end,
      campaignIds: selectedRows
        .map((row) => trimString(row.campaign_id))
        .filter((value): value is string => Boolean(value)),
    });
    const scopeSummary = resolveSpProductScopeSummary({
      selectedRows,
      scopedRows,
    });
    scopeCampaignIds = scopeSummary.campaignIds;
    scopeAdGroupIds = scopeSummary.adGroupIds;
    ambiguousCampaignIds = scopeSummary.ambiguousCampaignIds;
    const campaignsWithAdGroupScope = new Set(
      selectedRows
        .filter((row) => trimString(row.ad_group_id) !== null)
        .map((row) => trimString(row.campaign_id))
        .filter((value): value is string => Boolean(value))
    );
    scopeCampaignIdsWithoutAdGroupScope = scopeCampaignIds.filter(
      (campaignId) => !campaignsWithAdGroupScope.has(campaignId)
    );

    if (ambiguousCampaignIds.size > 0) {
      warnings.push(
        `${asinFilter} is included via advertised-ASIN scope, but ${ambiguousCampaignIds.size} campaign(s) also served other ASINs in this window. Target metrics remain full entity totals, not ASIN-only slices.`
      );
    }
    if (scopeCampaignIdsWithoutAdGroupScope.length > 0) {
      warnings.push(
        `${scopeCampaignIdsWithoutAdGroupScope.length} campaign(s) lack ad-group advertised-ASIN coverage in the selected window. Targets falls back to campaign-level inclusion for those campaigns.`
      );
    }
  }

  const targetingSelect = [
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
  ].join(',');

  let targetRows: SpTargetFactRow[] = [];
  if (asinFilter === 'all') {
    const query = supabaseAdmin
      .from('sp_targeting_daily_fact_latest')
      .select(targetingSelect)
      .eq('account_id', accountId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });
    targetRows = await fetchAllRows<SpTargetFactRow>((from, to) => query.range(from, to));
  } else {
    const [rowsByAdGroup, rowsByCampaignFallback] = await Promise.all([
      scopeAdGroupIds.length > 0
        ? fetchRowsByIdChunks<SpTargetFactRow>({
            table: 'sp_targeting_daily_fact_latest',
            select: targetingSelect,
            idColumn: 'ad_group_id',
            ids: scopeAdGroupIds,
            accountId,
            start,
            end,
          })
        : Promise.resolve([] as SpTargetFactRow[]),
      scopeCampaignIdsWithoutAdGroupScope.length > 0
        ? fetchRowsByIdChunks<SpTargetFactRow>({
            table: 'sp_targeting_daily_fact_latest',
            select: targetingSelect,
            idColumn: 'campaign_id',
            ids: scopeCampaignIdsWithoutAdGroupScope,
            accountId,
            start,
            end,
          })
        : Promise.resolve([] as SpTargetFactRow[]),
    ]);

    targetRows = uniqueBy([...rowsByAdGroup, ...rowsByCampaignFallback], (row) =>
      [
        trimString(row.date),
        trimString(row.exported_at),
        trimString(row.target_id),
        trimString(row.campaign_id),
        trimString(row.ad_group_id),
      ].join('::')
    );
  }

  if (targetRows.length === 0) {
    warnings.push('No SP target rows were found for the selected workspace filters.');
    return {
      asinOptions,
      warnings,
      rows: [],
      totals: emptyTotals,
    };
  }

  const targetIds = [
    ...new Set(
      targetRows
        .map((row) => trimString(row.target_id))
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const campaignIds = [
    ...new Set(
      targetRows
        .map((row) => trimString(row.campaign_id))
        .filter((value): value is string => Boolean(value))
    ),
  ];

  const [searchTermRows, placementRows, currentSnapshotResult] = await Promise.all([
    fetchRowsByIdChunks<SpSearchTermFactRow>({
      table: 'sp_stis_daily_fact_latest',
      select: [
        'date',
        'exported_at',
        'campaign_id',
        'ad_group_id',
        'target_id',
        'target_key',
        'targeting_norm',
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
      ].join(','),
      idColumn: 'target_id',
      ids: targetIds,
      accountId,
      start,
      end,
    }),
    fetchRowsByIdChunks<SpPlacementFactRow>({
      table: 'sp_placement_daily_fact_latest',
      select: [
        'campaign_id',
        'placement_code',
        'placement_raw',
        'placement_raw_norm',
        'impressions',
        'clicks',
        'spend',
        'sales',
        'orders',
        'units',
      ].join(','),
      idColumn: 'campaign_id',
      ids: campaignIds,
      accountId,
      start,
      end,
    }),
    loadCurrentSnapshot(targetIds, campaignIds),
  ]);

  if (currentSnapshotResult.warning) {
    warnings.push(currentSnapshotResult.warning);
  }

  const model = buildSpTargetsWorkspaceModel({
    targetRows,
    searchTermRows,
    placementRows,
    currentTargetsById: currentSnapshotResult.data?.targetsById,
    currentAdGroupsById: currentSnapshotResult.data?.adGroupsById,
    currentCampaignsById: currentSnapshotResult.data?.campaignsById,
    currentPlacementModifiers: currentSnapshotResult.data
      ? Array.from(currentSnapshotResult.data.placementsByKey.values())
      : [],
    ambiguousCampaignIds,
  });

  return {
    asinOptions,
    warnings,
    rows: model.rows,
    totals: model.totals,
  };
};
