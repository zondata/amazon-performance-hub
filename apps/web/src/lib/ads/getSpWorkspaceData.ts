import 'server-only';

import { fetchCurrentSpData } from '@/lib/bulksheets/fetchCurrent';
import { isStatementTimeoutMessage } from '@/lib/logbook/aiPack/fetchByDateChunks';
import { fetchAsinOptions } from '@/lib/products/fetchAsinOptions';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import {
  buildSpAdGroupsWorkspaceModel,
  buildSpCampaignsWorkspaceModel,
  buildSpPlacementsWorkspaceModel,
  type SpCampaignFactRow,
  type SpWorkspaceSummaryTotals,
} from './spWorkspaceTablesModel';
import {
  buildSpTargetsWorkspaceModel,
  resolveSpProductScopeSummary,
  type SpPlacementFactRow,
  type SpScopeAdvertisedProductRow,
  type SpSearchTermFactRow,
  type SpTargetFactRow,
} from './spTargetsWorkspaceModel';

export type SpWorkspaceLevel = 'campaigns' | 'adgroups' | 'targets' | 'placements';

export type SpWorkspaceData = {
  asinOptions: Awaited<ReturnType<typeof fetchAsinOptions>>;
  warnings: string[];
  entityCountLabel: string;
  rows:
    | ReturnType<typeof buildSpCampaignsWorkspaceModel>['rows']
    | ReturnType<typeof buildSpAdGroupsWorkspaceModel>['rows']
    | ReturnType<typeof buildSpTargetsWorkspaceModel>['rows']
    | ReturnType<typeof buildSpPlacementsWorkspaceModel>['rows'];
  totals: SpWorkspaceSummaryTotals;
};

type GetSpWorkspaceDataArgs = {
  accountId: string;
  marketplace: string;
  start: string;
  end: string;
  asinFilter: string;
  level: SpWorkspaceLevel;
};

type CurrentSnapshotData = Awaited<ReturnType<typeof fetchCurrentSpData>>;

type SpPlacementWorkspaceFactRow = SpPlacementFactRow & {
  date: string | null;
  portfolio_name_raw: string | null;
  campaign_name_raw: string | null;
};

const ID_CHUNK_SIZE = 250;
const CAMPAIGN_PAGE_SIZE = 1000;
const CAMPAIGN_CHUNK_DAYS = 14;

const trimString = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeAsin = (value: string) => value.trim().toLowerCase();

const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const minDate = (left: string, right: string) => (left <= right ? left : right);

const emptyTotals: SpWorkspaceSummaryTotals = {
  entity_count: 0,
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

const fetchCampaignRowsChunked = async (params: {
  accountId: string;
  start: string;
  end: string;
  campaignIds?: string[];
}): Promise<SpCampaignFactRow[]> => {
  if (Array.isArray(params.campaignIds) && params.campaignIds.length === 0) {
    return [];
  }
  const aggregated = new Map<string, SpCampaignFactRow>();
  const campaignIdChunks =
    params.campaignIds && params.campaignIds.length > 0 ? chunkIds(params.campaignIds) : [null];

  for (let chunkStart = params.start; chunkStart <= params.end; ) {
    const chunkEnd = minDate(addDays(chunkStart, CAMPAIGN_CHUNK_DAYS - 1), params.end);

    for (const campaignIdChunk of campaignIdChunks) {
      let from = 0;
      while (true) {
        let query = supabaseAdmin
          .from('sp_campaign_daily_fact_latest_gold')
          .select(
            'campaign_id,portfolio_name_raw,campaign_name_raw,impressions,clicks,spend,sales,orders,units'
          )
          .eq('account_id', params.accountId)
          .gte('date', chunkStart)
          .lte('date', chunkEnd)
          .order('date', { ascending: true })
          .range(from, from + CAMPAIGN_PAGE_SIZE - 1);

        if (campaignIdChunk) {
          query = query.in('campaign_id', campaignIdChunk);
        }

        const { data, error } = await query;
        if (error) {
          const prefix = isStatementTimeoutMessage(error.message)
            ? `Timed out loading SP campaign chunk ${chunkStart}..${chunkEnd}`
            : `Failed loading SP campaign chunk ${chunkStart}..${chunkEnd}`;
          throw new Error(`${prefix}: ${error.message}`);
        }

        if (!data || data.length === 0) {
          break;
        }

        for (const row of data as SpCampaignFactRow[]) {
          const campaignId = trimString(row.campaign_id);
          if (!campaignId) continue;

          const existing = aggregated.get(campaignId) ?? {
            date: null,
            exported_at: null,
            campaign_id: campaignId,
            portfolio_name_raw: trimString(row.portfolio_name_raw),
            campaign_name_raw: trimString(row.campaign_name_raw),
            impressions: 0,
            clicks: 0,
            spend: 0,
            sales: 0,
            orders: 0,
            units: 0,
          };

          existing.impressions = Number(existing.impressions ?? 0) + Number(row.impressions ?? 0);
          existing.clicks = Number(existing.clicks ?? 0) + Number(row.clicks ?? 0);
          existing.spend = Number(existing.spend ?? 0) + Number(row.spend ?? 0);
          existing.sales = Number(existing.sales ?? 0) + Number(row.sales ?? 0);
          existing.orders = Number(existing.orders ?? 0) + Number(row.orders ?? 0);
          existing.units = Number(existing.units ?? 0) + Number(row.units ?? 0);

          aggregated.set(campaignId, existing);
        }

        if (data.length < CAMPAIGN_PAGE_SIZE) {
          break;
        }
        from += CAMPAIGN_PAGE_SIZE;
      }
    }

    if (chunkEnd >= params.end) {
      break;
    }
    chunkStart = addDays(chunkEnd, 1);
  }

  return Array.from(aggregated.values());
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

const loadCurrentSnapshot = async (params: {
  campaignIds: string[];
  adGroupIds?: string[];
  targetIds?: string[];
  placementCampaignIds?: string[];
}): Promise<{ data: CurrentSnapshotData | null; warning: string | null }> => {
  const campaignIds = params.campaignIds ?? [];
  const adGroupIds = params.adGroupIds ?? [];
  const targetIds = params.targetIds ?? [];
  const placementCampaignIds = params.placementCampaignIds ?? campaignIds;

  if (
    campaignIds.length === 0 &&
    adGroupIds.length === 0 &&
    targetIds.length === 0 &&
    placementCampaignIds.length === 0
  ) {
    return { data: null, warning: null };
  }

  try {
    const actions = [
      ...campaignIds.map((campaignId) => ({ type: 'update_campaign_budget', campaign_id: campaignId })),
      ...adGroupIds.map((adGroupId) => ({ type: 'update_ad_group_default_bid', ad_group_id: adGroupId })),
      ...targetIds.map((targetId) => ({ type: 'update_target_bid', target_id: targetId })),
      ...placementCampaignIds.map((campaignId) => ({
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

const levelEmptyMessage: Record<SpWorkspaceLevel, string> = {
  campaigns: 'No SP campaign rows were found for the selected workspace filters.',
  adgroups: 'No SP ad group rows were found for the selected workspace filters.',
  targets: 'No SP target rows were found for the selected workspace filters.',
  placements: 'No SP placement rows were found for the selected workspace filters.',
};

const levelEntityLabel: Record<SpWorkspaceLevel, string> = {
  campaigns: 'Campaigns',
  adgroups: 'Ad groups',
  targets: 'Targets',
  placements: 'Placements',
};

export const getSpWorkspaceData = async ({
  accountId,
  marketplace,
  start,
  end,
  asinFilter,
  level,
}: GetSpWorkspaceDataArgs): Promise<SpWorkspaceData> => {
  const asinOptions = await fetchAsinOptions(accountId, marketplace);
  const warnings: string[] = [
    'Ads reports can finalize with delay (48h+).',
    'P&L remains hidden until deterministic economics allocation exists for SP entity rows.',
  ];

  if (level === 'targets') {
    warnings.push('Campaign placement context is shown separately; it is not flattened into target facts.');
  }
  if (level === 'placements') {
    warnings.push('Placement rows remain campaign-level facts. They are never flattened into target-owned metrics.');
  }
  if (level === 'adgroups') {
    warnings.push(
      'Ad group totals are aggregated from SP targeting facts because the current facts layer does not expose a dedicated SP ad-group daily view.'
    );
  }

  let scopeCampaignIds: string[] = [];
  let scopeAdGroupIds: string[] = [];
  let ambiguousCampaignIds = new Set<string>();

  if (asinFilter !== 'all') {
    const asinNorm = normalizeAsin(asinFilter);
    const selectedRows = await fetchProductScopeRows({
      accountId,
      start,
      end,
      asinNorm,
    });

    if (selectedRows.length === 0) {
      warnings.push(
        `No SP advertised-product rows matched ASIN ${asinFilter} in ${start}..${end}. This table is empty until that ASIN appears in SP advertised-product facts for the selected window.`
      );
      return {
        asinOptions,
        warnings,
        entityCountLabel: levelEntityLabel[level],
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

    if (ambiguousCampaignIds.size > 0) {
      warnings.push(
        `${asinFilter} is included via advertised-ASIN scope, but ${ambiguousCampaignIds.size} campaign(s) also served other ASINs in this window. Metrics remain full entity totals, not ASIN-only slices.`
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
  const placementSelect = [
    'date',
    'campaign_id',
    'portfolio_name_raw',
    'campaign_name_raw',
    'placement_code',
    'placement_raw',
    'placement_raw_norm',
    'impressions',
    'clicks',
    'spend',
    'sales',
    'orders',
    'units',
  ].join(',');

  let campaignRows: SpCampaignFactRow[] = [];
  let targetRows: SpTargetFactRow[] = [];
  let placementRows: SpPlacementWorkspaceFactRow[] = [];

  if (level === 'campaigns') {
    campaignRows = await fetchCampaignRowsChunked({
      accountId,
      start,
      end,
      campaignIds: asinFilter === 'all' ? undefined : scopeCampaignIds,
    });
  }

  if (level === 'adgroups' || level === 'targets') {
    if (asinFilter === 'all') {
      const query = supabaseAdmin
        .from('sp_targeting_daily_fact_latest')
        .select(targetingSelect)
        .eq('account_id', accountId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });
      targetRows = await fetchAllRows<SpTargetFactRow>((from, to) => query.range(from, to));
    } else if (scopeAdGroupIds.length > 0) {
      targetRows = await fetchRowsByIdChunks<SpTargetFactRow>({
        table: 'sp_targeting_daily_fact_latest',
        select: targetingSelect,
        idColumn: 'ad_group_id',
        ids: scopeAdGroupIds,
        accountId,
        start,
        end,
      });
    } else if (scopeCampaignIds.length > 0) {
      targetRows = await fetchRowsByIdChunks<SpTargetFactRow>({
        table: 'sp_targeting_daily_fact_latest',
        select: targetingSelect,
        idColumn: 'campaign_id',
        ids: scopeCampaignIds,
        accountId,
        start,
        end,
      });
    }
  }

  if (level === 'placements') {
    if (asinFilter === 'all') {
      const query = supabaseAdmin
        .from('sp_placement_daily_fact_latest')
        .select(placementSelect)
        .eq('account_id', accountId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });
      placementRows = await fetchAllRows<SpPlacementWorkspaceFactRow>((from, to) =>
        query.range(from, to)
      );
    } else {
      placementRows = await fetchRowsByIdChunks<SpPlacementWorkspaceFactRow>({
        table: 'sp_placement_daily_fact_latest',
        select: placementSelect,
        idColumn: 'campaign_id',
        ids: scopeCampaignIds,
        accountId,
        start,
        end,
      });
    }
  }

  const primaryRows =
    level === 'campaigns'
      ? campaignRows
      : level === 'placements'
        ? placementRows
        : targetRows;

  if (primaryRows.length === 0) {
    warnings.push(levelEmptyMessage[level]);
    return {
      asinOptions,
      warnings,
      entityCountLabel: levelEntityLabel[level],
      rows: [],
      totals: emptyTotals,
    };
  }

  const campaignIds = [
    ...new Set(
      primaryRows
        .map((row) => trimString(row.campaign_id))
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const adGroupIds =
    level === 'adgroups' || level === 'targets'
      ? [
          ...new Set(
            targetRows
              .map((row) => trimString(row.ad_group_id))
              .filter((value): value is string => Boolean(value))
          ),
        ]
      : [];
  const targetIds =
    level === 'targets'
      ? [
          ...new Set(
            targetRows
              .map((row) => trimString(row.target_id))
              .filter((value): value is string => Boolean(value))
          ),
        ]
      : [];

  const [searchTermRows, targetPlacementRows, currentSnapshotResult] = await Promise.all([
    level === 'targets' && targetIds.length > 0
      ? fetchRowsByIdChunks<SpSearchTermFactRow>({
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
        })
      : Promise.resolve([] as SpSearchTermFactRow[]),
    level === 'targets' && campaignIds.length > 0
      ? fetchRowsByIdChunks<SpPlacementWorkspaceFactRow>({
          table: 'sp_placement_daily_fact_latest',
          select: placementSelect,
          idColumn: 'campaign_id',
          ids: campaignIds,
          accountId,
          start,
          end,
        })
      : Promise.resolve([] as SpPlacementWorkspaceFactRow[]),
    loadCurrentSnapshot({
      campaignIds,
      adGroupIds,
      targetIds,
      placementCampaignIds: campaignIds,
    }),
  ]);

  if (currentSnapshotResult.warning) {
    warnings.push(currentSnapshotResult.warning);
  }

  const currentCampaignsById = currentSnapshotResult.data?.campaignsById;
  const currentAdGroupsById = currentSnapshotResult.data?.adGroupsById;
  const currentTargetsById = currentSnapshotResult.data?.targetsById;
  const currentPlacementModifiers = currentSnapshotResult.data
    ? Array.from(currentSnapshotResult.data.placementsByKey.values())
    : [];

  if (level === 'campaigns') {
    const model = buildSpCampaignsWorkspaceModel({
      campaignRows,
      currentCampaignsById,
      currentPlacementModifiers,
      ambiguousCampaignIds,
    });
    return {
      asinOptions,
      warnings,
      entityCountLabel: levelEntityLabel[level],
      rows: model.rows,
      totals: model.totals,
    };
  }

  if (level === 'adgroups') {
    const model = buildSpAdGroupsWorkspaceModel({
      targetRows,
      currentAdGroupsById,
      currentCampaignsById,
      currentPlacementModifiers,
      ambiguousCampaignIds,
    });
    return {
      asinOptions,
      warnings,
      entityCountLabel: levelEntityLabel[level],
      rows: model.rows,
      totals: model.totals,
    };
  }

  if (level === 'placements') {
    const model = buildSpPlacementsWorkspaceModel({
      placementRows,
      currentCampaignsById,
      currentPlacementModifiers,
      ambiguousCampaignIds,
    });
    return {
      asinOptions,
      warnings,
      entityCountLabel: levelEntityLabel[level],
      rows: model.rows,
      totals: model.totals,
    };
  }

  const targetsModel = buildSpTargetsWorkspaceModel({
    targetRows,
    searchTermRows,
    placementRows: targetPlacementRows,
    currentTargetsById,
    currentAdGroupsById,
    currentCampaignsById,
    currentPlacementModifiers,
    ambiguousCampaignIds,
  });

  return {
    asinOptions,
    warnings,
    entityCountLabel: levelEntityLabel[level],
    rows: targetsModel.rows,
    totals: {
      entity_count: targetsModel.totals.targets,
      impressions: targetsModel.totals.impressions,
      clicks: targetsModel.totals.clicks,
      orders: targetsModel.totals.orders,
      units: targetsModel.totals.units,
      sales: targetsModel.totals.sales,
      spend: targetsModel.totals.spend,
      conversion: targetsModel.totals.conversion,
      cpc: targetsModel.totals.cpc,
      ctr: targetsModel.totals.ctr,
      acos: targetsModel.totals.acos,
      roas: targetsModel.totals.roas,
    },
  };
};
