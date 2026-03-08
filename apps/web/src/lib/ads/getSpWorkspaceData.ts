import 'server-only';

import { fetchCurrentSpData } from '@/lib/bulksheets/fetchCurrent';
import { fetchByDateChunks } from '@/lib/logbook/aiPack/fetchByDateChunks';
import { isStatementTimeoutMessage } from '@/lib/logbook/aiPack/fetchByDateChunks';
import { fetchAsinOptions } from '@/lib/products/fetchAsinOptions';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { normalizeSpAdvertisedAsin } from './spAdvertisedAsinScope';
import {
  buildPlacementUnitsByCampaignDate,
  resolveCampaignUnitsWithPlacementFallback,
} from './spCampaignUnitsFallback';
import {
  filterCampaignIdsByWorkspaceScope,
  filterRowsByWorkspaceScope,
  normalizeWorkspaceScopeId,
} from './spWorkspaceScope';
import {
  buildSpSearchTermsWorkspaceModel,
  type SpSearchTermsWorkspaceRow,
} from './spSearchTermsWorkspaceModel';
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

export type SpWorkspaceLevel = 'campaigns' | 'adgroups' | 'targets' | 'placements' | 'searchterms';

export type SpWorkspaceData = {
  asinOptions: Awaited<ReturnType<typeof fetchAsinOptions>>;
  warnings: string[];
  entityCountLabel: string;
  rows:
    | ReturnType<typeof buildSpCampaignsWorkspaceModel>['rows']
    | ReturnType<typeof buildSpAdGroupsWorkspaceModel>['rows']
    | ReturnType<typeof buildSpTargetsWorkspaceModel>['rows']
    | ReturnType<typeof buildSpPlacementsWorkspaceModel>['rows']
    | SpSearchTermsWorkspaceRow[];
  totals: SpWorkspaceSummaryTotals;
};

type GetSpWorkspaceDataArgs = {
  accountId: string;
  marketplace: string;
  start: string;
  end: string;
  asinFilter: string;
  level: SpWorkspaceLevel;
  campaignScopeId?: string | null;
  adGroupScopeId?: string | null;
};

type CurrentSnapshotData = Awaited<ReturnType<typeof fetchCurrentSpData>>;

type SpPlacementWorkspaceFactRow = SpPlacementFactRow & {
  date: string | null;
  portfolio_name_raw: string | null;
  campaign_name_raw: string | null;
};

type SpCampaignPlacementUnitsRow = {
  campaign_id: string | null;
  date: string | null;
  units: unknown;
};

const ID_CHUNK_SIZE = 250;
const CAMPAIGN_PAGE_SIZE = 1000;
const CAMPAIGN_CHUNK_DAYS = 14;
const SEARCH_TERM_PAGE_SIZE = 1000;
const SEARCH_TERM_CHUNK_DAYS = 14;

const trimString = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

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
  units: null,
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
  const placementUnitRows: SpCampaignPlacementUnitsRow[] = [];
  const campaignIdChunks =
    params.campaignIds && params.campaignIds.length > 0 ? chunkIds(params.campaignIds) : [null];

  for (let chunkStart = params.start; chunkStart <= params.end; ) {
    const chunkEnd = minDate(addDays(chunkStart, CAMPAIGN_CHUNK_DAYS - 1), params.end);

    for (const campaignIdChunk of campaignIdChunks) {
      let from = 0;
      while (true) {
        let query = supabaseAdmin
          .from('sp_placement_daily_fact_latest')
          .select('campaign_id,date,units')
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
            ? `Timed out loading SP campaign placement-units chunk ${chunkStart}..${chunkEnd}`
            : `Failed loading SP campaign placement-units chunk ${chunkStart}..${chunkEnd}`;
          throw new Error(`${prefix}: ${error.message}`);
        }

        if (!data || data.length === 0) {
          break;
        }

        placementUnitRows.push(...(data as SpCampaignPlacementUnitsRow[]));

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

  const placementUnitsByCampaignDate = buildPlacementUnitsByCampaignDate(placementUnitRows);

  for (let chunkStart = params.start; chunkStart <= params.end; ) {
    const chunkEnd = minDate(addDays(chunkStart, CAMPAIGN_CHUNK_DAYS - 1), params.end);

    for (const campaignIdChunk of campaignIdChunks) {
      let from = 0;
      while (true) {
        let query = supabaseAdmin
          .from('sp_campaign_daily_fact_latest_gold')
          .select(
            'date,campaign_id,portfolio_name_raw,campaign_name_raw,impressions,clicks,spend,sales,orders,units'
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
          const date = trimString(row.date);
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
            units: null,
          };

          existing.impressions = Number(existing.impressions ?? 0) + Number(row.impressions ?? 0);
          existing.clicks = Number(existing.clicks ?? 0) + Number(row.clicks ?? 0);
          existing.spend = Number(existing.spend ?? 0) + Number(row.spend ?? 0);
          existing.sales = Number(existing.sales ?? 0) + Number(row.sales ?? 0);
          existing.orders = Number(existing.orders ?? 0) + Number(row.orders ?? 0);
          const fallbackUnits = resolveCampaignUnitsWithPlacementFallback({
            campaignId,
            date,
            primaryUnits: row.units,
            placementUnitsByCampaignDate,
          });
          if (fallbackUnits !== null) {
            existing.units = Number(existing.units ?? 0) + fallbackUnits;
          }

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

const fetchSearchTermRowsChunked = async (params: {
  accountId: string;
  start: string;
  end: string;
  adGroupIds?: string[];
  campaignIds?: string[];
}): Promise<{
  rows: SpSearchTermFactRow[];
  chunkErrors: Array<{ chunkStart: string; chunkEnd: string; message: string }>;
}> => {
  if (Array.isArray(params.adGroupIds) && params.adGroupIds.length === 0) {
    return { rows: [], chunkErrors: [] };
  }
  if (
    !params.adGroupIds &&
    Array.isArray(params.campaignIds) &&
    params.campaignIds.length === 0
  ) {
    return { rows: [], chunkErrors: [] };
  }

  const idColumn = params.adGroupIds?.length
    ? 'ad_group_id'
    : params.campaignIds?.length
      ? 'campaign_id'
      : null;
  const ids = params.adGroupIds?.length
    ? params.adGroupIds
    : params.campaignIds?.length
      ? params.campaignIds
      : null;
  const select = [
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
  ].join(',');

  const result = await fetchByDateChunks<SpSearchTermFactRow>({
    startDate: params.start,
    endDate: params.end,
    chunkDays: SEARCH_TERM_CHUNK_DAYS,
    runChunk: async (chunkStart, chunkEnd) => {
      const rows: SpSearchTermFactRow[] = [];
      const idChunks = ids ? chunkIds(ids) : [null];

      for (const idChunk of idChunks) {
        let from = 0;
        while (true) {
          let query = supabaseAdmin
            .from('sp_stis_daily_fact_latest')
            .select(select)
            .eq('account_id', params.accountId)
            .gte('date', chunkStart)
            .lte('date', chunkEnd)
            .order('date', { ascending: true })
            .range(from, from + SEARCH_TERM_PAGE_SIZE - 1);

          if (idColumn && idChunk) {
            query = query.in(idColumn, idChunk);
          }

          const { data, error } = await query;
          if (error) {
            const prefix = isStatementTimeoutMessage(error.message)
              ? `Timed out loading SP search-term chunk ${chunkStart}..${chunkEnd}`
              : `Failed loading SP search-term chunk ${chunkStart}..${chunkEnd}`;
            throw new Error(`${prefix}: ${error.message}`);
          }

          if (!data || data.length === 0) {
            break;
          }

          rows.push(...((data ?? []) as unknown as SpSearchTermFactRow[]));

          if (data.length < SEARCH_TERM_PAGE_SIZE) {
            break;
          }
          from += SEARCH_TERM_PAGE_SIZE;
        }
      }

      return rows;
    },
  });

  return {
    rows: result.rows,
    chunkErrors: result.chunkErrors.map((entry) => ({
      chunkStart: entry.chunkStart,
      chunkEnd: entry.chunkEnd,
      message: entry.message,
    })),
  };
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
  searchterms: 'No SP search-term rows were found for the selected workspace filters.',
};

const levelEntityLabel: Record<SpWorkspaceLevel, string> = {
  campaigns: 'Campaigns',
  adgroups: 'Ad groups',
  targets: 'Targets',
  placements: 'Placements',
  searchterms: 'Search terms',
};

export const getSpWorkspaceData = async ({
  accountId,
  marketplace,
  start,
  end,
  asinFilter,
  level,
  campaignScopeId: campaignScopeIdArg,
  adGroupScopeId: adGroupScopeIdArg,
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
  if (level === 'searchterms') {
    warnings.push(
      'Search Terms uses SP STIS rows. When STIS is missing for the selected window, this tab stays explicit about the gap instead of inventing search-term facts.'
    );
  }

  let scopeCampaignIds: string[] = [];
  let scopeAdGroupIds: string[] = [];
  let scopeCampaignIdsWithoutAdGroupScope: string[] = [];
  let ambiguousCampaignIds = new Set<string>();
  let scopedAdvertisedProductRows: SpScopeAdvertisedProductRow[] = [];

  if (asinFilter !== 'all') {
    const asinNorm = normalizeSpAdvertisedAsin(asinFilter);
    if (!asinNorm) {
      warnings.push(`ASIN filter ${asinFilter} is invalid after normalization.`);
      return {
        asinOptions,
        warnings,
        entityCountLabel: levelEntityLabel[level],
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

    scopedAdvertisedProductRows = await fetchScopedAdvertisedProductRows({
      accountId,
      start,
      end,
      campaignIds: selectedRows
        .map((row) => trimString(row.campaign_id))
        .filter((value): value is string => Boolean(value)),
    });
    const scopeSummary = resolveSpProductScopeSummary({
      selectedRows,
      scopedRows: scopedAdvertisedProductRows,
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
        `${asinFilter} is included via advertised-ASIN scope, but ${ambiguousCampaignIds.size} campaign(s) also served other ASINs in this window. Metrics remain full entity totals, not ASIN-only slices.`
      );
    }
    if (scopeCampaignIdsWithoutAdGroupScope.length > 0) {
      warnings.push(
        `${scopeCampaignIdsWithoutAdGroupScope.length} campaign(s) lack ad-group advertised-ASIN coverage in the selected window. Lower-level SP tabs fall back to campaign-level inclusion for those campaigns.`
      );
    }
  }

  const campaignScopeId = normalizeWorkspaceScopeId(campaignScopeIdArg);
  const adGroupScopeId = normalizeWorkspaceScopeId(adGroupScopeIdArg);
  ambiguousCampaignIds = filterCampaignIdsByWorkspaceScope(ambiguousCampaignIds, {
    campaignScopeId,
    adGroupScopeId,
  });

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
  let searchTermRows: SpSearchTermFactRow[] = [];
  let searchTermChunkErrors: Array<{ chunkStart: string; chunkEnd: string; message: string }> = [];

  if (level === 'campaigns') {
    campaignRows = await fetchCampaignRowsChunked({
      accountId,
      start,
      end,
      campaignIds: asinFilter === 'all' ? undefined : scopeCampaignIds,
    });
    campaignRows = filterRowsByWorkspaceScope(campaignRows, { campaignScopeId });
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
    targetRows = filterRowsByWorkspaceScope(targetRows, {
      campaignScopeId,
      adGroupScopeId,
    });
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
    placementRows = filterRowsByWorkspaceScope(placementRows, { campaignScopeId });
  }

  if (level === 'searchterms') {
    const searchTermResults =
      asinFilter === 'all'
        ? [
            await fetchSearchTermRowsChunked({
              accountId,
              start,
              end,
            }),
          ]
        : await Promise.all([
            scopeAdGroupIds.length > 0
              ? fetchSearchTermRowsChunked({
                  accountId,
                  start,
                  end,
                  adGroupIds: scopeAdGroupIds,
                })
              : Promise.resolve({ rows: [] as SpSearchTermFactRow[], chunkErrors: [] }),
            scopeCampaignIdsWithoutAdGroupScope.length > 0
              ? fetchSearchTermRowsChunked({
                  accountId,
                  start,
                  end,
                  campaignIds: scopeCampaignIdsWithoutAdGroupScope,
                })
              : Promise.resolve({ rows: [] as SpSearchTermFactRow[], chunkErrors: [] }),
          ]);

    searchTermRows = uniqueBy(
      searchTermResults.flatMap((result) => result.rows),
      (row) =>
        [
          trimString(row.date),
          trimString(row.exported_at),
          trimString(row.campaign_id),
          trimString(row.ad_group_id),
          trimString(row.target_id),
          trimString(row.target_key),
          trimString(row.customer_search_term_norm),
          trimString(row.customer_search_term_raw),
        ].join('::')
    );
    searchTermChunkErrors = searchTermResults.flatMap((result) => result.chunkErrors);
    searchTermRows = filterRowsByWorkspaceScope(searchTermRows, {
      campaignScopeId,
      adGroupScopeId,
    });

    if (searchTermChunkErrors.length > 0) {
      warnings.push(
        `Search-term coverage is partial. ${searchTermChunkErrors.length} STIS range(s) failed to load; showing successful chunks only.`
      );
    }
  }

  const primaryRows =
    level === 'campaigns'
      ? campaignRows
      : level === 'placements'
        ? placementRows
        : level === 'searchterms'
          ? searchTermRows
          : targetRows;

  if (primaryRows.length === 0) {
    if (level === 'searchterms') {
      warnings.push(
        'Search Terms depends on SP STIS exports. No matching STIS rows were available for this range.'
      );
    }
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
      : level === 'searchterms'
        ? [
            ...new Set(
              searchTermRows
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
      : level === 'searchterms'
        ? [
            ...new Set(
              searchTermRows
                .map((row) => trimString(row.target_id))
                .filter((value): value is string => Boolean(value))
            ),
          ]
      : [];

  const [targetSearchTermRows, targetPlacementRows, currentSnapshotResult, searchTermScopeRows] =
    await Promise.all([
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
    level === 'searchterms' && asinFilter === 'all' && campaignIds.length > 0
      ? fetchScopedAdvertisedProductRows({
          accountId,
          start,
          end,
          campaignIds,
        })
      : Promise.resolve(scopedAdvertisedProductRows),
    ]);

  const scopedTargetSearchTermRows = filterRowsByWorkspaceScope(targetSearchTermRows, {
    campaignScopeId,
    adGroupScopeId,
  });
  const scopedTargetPlacementRows = filterRowsByWorkspaceScope(targetPlacementRows, {
    campaignScopeId,
  });
  const scopedSearchTermScopeRows = filterRowsByWorkspaceScope(searchTermScopeRows, {
    campaignScopeId,
    adGroupScopeId,
  });

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

  if (level === 'searchterms') {
    const model = buildSpSearchTermsWorkspaceModel({
      searchTermRows,
      asinFilter,
      scopedAdvertisedProductRows: scopedSearchTermScopeRows,
      currentTargetsById,
      currentAdGroupsById,
      currentCampaignsById,
      currentPlacementModifiers,
      ambiguousCampaignIds,
    });

    if (model.coverage.shared_scope_count > 0) {
      warnings.push(
        `${model.coverage.shared_scope_count} search-term parent row(s) span more than one advertised ASIN in the selected window and are grouped under a shared bucket to avoid metric double counting.`
      );
    }
    if (model.coverage.unattributed_count > 0) {
      warnings.push(
        `${model.coverage.unattributed_count} search-term parent row(s) could not be matched to an advertised ASIN and are grouped under an explicit fallback bucket.`
      );
    }

    return {
      asinOptions,
      warnings,
      entityCountLabel: levelEntityLabel[level],
      rows: model.rows,
      totals: {
        entity_count: model.totals.search_terms,
        impressions: model.totals.impressions,
        clicks: model.totals.clicks,
        orders: model.totals.orders,
        units: model.totals.units,
        sales: model.totals.sales,
        spend: model.totals.spend,
        conversion: model.totals.conversion,
        cpc: model.totals.cpc,
        ctr: model.totals.ctr,
        acos: model.totals.acos,
        roas: model.totals.roas,
      },
    };
  }

  const targetsModel = buildSpTargetsWorkspaceModel({
    targetRows,
    searchTermRows: scopedTargetSearchTermRows,
    placementRows: scopedTargetPlacementRows,
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
