import 'server-only';

import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { getProductRankingDaily } from '@/lib/ranking/getProductRankingDaily';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSpWorkspaceData, type SpWorkspaceLevel } from './getSpWorkspaceData';
import type { SpTargetsWorkspaceRow } from './spTargetsWorkspaceModel';
import {
  resolveTargetRankingContract,
  type TargetRankingUnsupportedReasonCode,
} from './targetRankingContract';
import type { SpCampaignsWorkspaceRow } from './spWorkspaceTablesModel';
import {
  buildCampaignTrendData,
  buildCampaignTrendEntityOptions,
  buildTargetTrendData,
  buildTargetTrendEntityOptions,
  buildTrendMarkers,
  type SpTrendCampaignDailyRow,
  type SpTrendLevel,
  type SpTrendPlacementUnitsRow,
  type SpTrendTargetRankRow,
  type SpTrendTargetDailyRow,
  type SpTrendTargetStirRow,
  type SpWorkspaceTrendData,
} from './spWorkspaceTrendModel';

type GetSpWorkspaceTrendDataArgs = {
  accountId: string;
  marketplace: string;
  start: string;
  end: string;
  asinFilter: string;
  level: SpWorkspaceLevel;
  selectedEntityId?: string | null;
  campaignScopeId?: string | null;
  adGroupScopeId?: string | null;
};

type LogChangeEntityRow = {
  change_id: string;
  entity_type: string | null;
};

type LogChangeRow = {
  change_id: string;
  occurred_at: string;
  change_type: string;
  summary: string;
  why: string | null;
  source: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
};

type LogChangeValidationRow = {
  change_id: string;
  status: string | null;
  validated_snapshot_date: string | null;
  checked_at: string;
};

const trimString = (value: string | null | undefined) => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeText = (value: string | null | undefined) =>
  trimString(value)?.toLowerCase().replace(/\s+/g, ' ') ?? null;

const buildTargetRankSupportNote = (reasonCode: TargetRankingUnsupportedReasonCode) => {
  if (reasonCode === 'scope_not_trustworthy') {
    return 'Rank stays null-safe here until a single ASIN is selected.';
  }
  if (reasonCode === 'no_mapping') {
    return 'Rank context is unavailable because no deterministic keyword mapping was resolved for this target.';
  }
  return 'Rank context is keyword-only and remains hidden for non-keyword targets.';
};

const fetchPaged = async <TRow,>(queryBuilder: (from: number, to: number) => Promise<{
  data: TRow[] | null;
  error: { message: string } | null;
}>) => {
  return fetchAllRows<TRow>(async (from, to) => {
    const result = await queryBuilder(from, to);
    if (result.error) {
      throw new Error(result.error.message);
    }
    return { data: result.data };
  });
};

const loadCampaignTrendRows = async (params: {
  accountId: string;
  campaignId: string;
  start: string;
  end: string;
}) => {
  const [campaignRows, placementUnitRows] = await Promise.all([
    fetchPaged<SpTrendCampaignDailyRow>(async (from, to) =>
      await supabaseAdmin
        .from('sp_campaign_daily_fact_latest_gold')
        .select('date,campaign_id,impressions,clicks,spend,sales,orders,units')
        .eq('account_id', params.accountId)
        .eq('campaign_id', params.campaignId)
        .gte('date', params.start)
        .lte('date', params.end)
        .order('date', { ascending: true })
        .range(from, to)
    ),
    fetchPaged<SpTrendPlacementUnitsRow>(async (from, to) =>
      await supabaseAdmin
        .from('sp_placement_daily_fact_latest')
        .select('campaign_id,date,units')
        .eq('account_id', params.accountId)
        .eq('campaign_id', params.campaignId)
        .gte('date', params.start)
        .lte('date', params.end)
        .order('date', { ascending: true })
        .range(from, to)
    ),
  ]);

  return {
    campaignRows,
    placementUnitRows,
  };
};

const loadTargetTrendRows = async (params: {
  accountId: string;
  targetId: string;
  start: string;
  end: string;
}) => {
  const [targetRows, stirRows] = await Promise.all([
    fetchPaged<SpTrendTargetDailyRow>(async (from, to) =>
      await supabaseAdmin
        .from('sp_targeting_daily_fact_latest')
        .select('date,target_id,impressions,clicks,spend,sales,orders,units,top_of_search_impression_share,exported_at')
        .eq('account_id', params.accountId)
        .eq('target_id', params.targetId)
        .gte('date', params.start)
        .lte('date', params.end)
        .order('date', { ascending: true })
        .range(from, to)
    ),
    fetchPaged<SpTrendTargetStirRow>(async (from, to) =>
      await supabaseAdmin
        .from('sp_stis_daily_fact_latest')
        .select(
          'date,target_id,targeting_norm,customer_search_term_raw,customer_search_term_norm,search_term_impression_share,search_term_impression_rank,impressions,clicks,spend,exported_at'
        )
        .eq('account_id', params.accountId)
        .eq('target_id', params.targetId)
        .gte('date', params.start)
        .lte('date', params.end)
        .order('date', { ascending: true })
        .range(from, to)
    ),
  ]);

  return {
    targetRows,
    stirRows,
  };
};

const loadTrendMarkers = async (params: {
  accountId: string;
  marketplace: string;
  start: string;
  end: string;
  level: SpTrendLevel;
  selectedEntityId: string;
}) => {
  const entitiesQuery =
    params.level === 'campaigns'
      ? supabaseAdmin
          .from('log_change_entities')
          .select('change_id,entity_type')
          .eq('campaign_id', params.selectedEntityId)
      : supabaseAdmin
          .from('log_change_entities')
          .select('change_id,entity_type')
          .eq('target_id', params.selectedEntityId);

  const entityRows = await fetchPaged<LogChangeEntityRow>(async (from, to) =>
    await entitiesQuery.order('created_at', { ascending: false }).range(from, to)
  );
  const entityTypeByChangeId = new Map<string, string | null>();
  const changeIds = Array.from(
    new Set(
      entityRows
        .map((row) => {
          const changeId = trimString(row.change_id);
          if (!changeId) return null;
          if (!entityTypeByChangeId.has(changeId)) {
            entityTypeByChangeId.set(changeId, trimString(row.entity_type));
          }
          return changeId;
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  if (changeIds.length === 0) {
    return buildTrendMarkers([]);
  }

  const changeRows = await fetchPaged<LogChangeRow>(async (from, to) =>
    await supabaseAdmin
      .from('log_changes')
      .select('change_id,occurred_at,change_type,summary,why,source,before_json,after_json')
      .eq('account_id', params.accountId)
      .eq('marketplace', params.marketplace)
      .eq('channel', 'ads')
      .in('change_id', changeIds)
      .gte('occurred_at', `${params.start}T00:00:00Z`)
      .lte('occurred_at', `${params.end}T23:59:59Z`)
      .order('occurred_at', { ascending: true })
      .range(from, to)
  );

  if (changeRows.length === 0) {
    return buildTrendMarkers([]);
  }

  const validationRows = await fetchPaged<LogChangeValidationRow>(async (from, to) =>
    await supabaseAdmin
      .from('log_change_validations')
      .select('change_id,status,validated_snapshot_date,checked_at')
      .in(
        'change_id',
        changeRows.map((row) => row.change_id)
      )
      .order('checked_at', { ascending: false })
      .range(from, to)
  );

  const latestValidationByChangeId = new Map<string, LogChangeValidationRow>();
  for (const row of validationRows) {
    const changeId = trimString(row.change_id);
    if (!changeId || latestValidationByChangeId.has(changeId)) continue;
    latestValidationByChangeId.set(changeId, row);
  }

  return buildTrendMarkers(
    changeRows.map((row) => ({
      ...row,
      entity_type: entityTypeByChangeId.get(row.change_id) ?? null,
      validation_status: latestValidationByChangeId.get(row.change_id)?.status ?? null,
      validated_snapshot_date:
        latestValidationByChangeId.get(row.change_id)?.validated_snapshot_date ?? null,
    }))
  );
};

const buildUnsupportedTrendData = async (params: {
  accountId: string;
  marketplace: string;
  start: string;
  end: string;
  asinFilter: string;
  level: SpWorkspaceLevel;
  campaignScopeId?: string | null;
  adGroupScopeId?: string | null;
}) => {
  const workspaceData = await getSpWorkspaceData({
    accountId: params.accountId,
    marketplace: params.marketplace,
    start: params.start,
    end: params.end,
    asinFilter: params.asinFilter,
    level: params.level,
    campaignScopeId: params.campaignScopeId,
    adGroupScopeId: params.adGroupScopeId,
  });

  return {
    warnings: workspaceData.warnings,
    workspaceData,
    trendData: null,
  };
};

export const getSpWorkspaceTrendData = async ({
  accountId,
  marketplace,
  start,
  end,
  asinFilter,
  level,
  selectedEntityId,
  campaignScopeId,
  adGroupScopeId,
}: GetSpWorkspaceTrendDataArgs): Promise<{
  warnings: string[];
  workspaceData: Awaited<ReturnType<typeof getSpWorkspaceData>>;
  trendData: SpWorkspaceTrendData | null;
}> => {
  if (level !== 'campaigns' && level !== 'targets') {
    return buildUnsupportedTrendData({
      accountId,
      marketplace,
      start,
      end,
      asinFilter,
      level,
      campaignScopeId,
      adGroupScopeId,
    });
  }

  const workspaceData = await getSpWorkspaceData({
    accountId,
    marketplace,
    start,
    end,
    asinFilter,
    level,
    campaignScopeId,
    adGroupScopeId,
  });

  const workspaceWarnings = [...workspaceData.warnings];
  const campaignRows = level === 'campaigns' ? (workspaceData.rows as SpCampaignsWorkspaceRow[]) : [];
  const targetRows = level === 'targets' ? (workspaceData.rows as SpTargetsWorkspaceRow[]) : [];
  const entities =
    level === 'campaigns'
      ? buildCampaignTrendEntityOptions(campaignRows)
      : buildTargetTrendEntityOptions(targetRows);

  if (entities.length === 0) {
    return {
      warnings: workspaceWarnings,
      workspaceData,
      trendData: {
        level,
        entityCountLabel: workspaceData.entityCountLabel,
        entities,
        selectedEntityId: null,
        selectedEntityLabel: null,
        dates: [],
        metricRows: [],
        markers: [],
        markersByDate: {},
      },
    };
  }

  const resolvedSelectedEntityId =
    entities.find((entity) => entity.id === selectedEntityId)?.id ?? entities[0]!.id;
  const resolvedSelectedEntity = entities.find((entity) => entity.id === resolvedSelectedEntityId)!;
  const { markers, markersByDate } = await loadTrendMarkers({
    accountId,
    marketplace,
    start,
    end,
    level,
    selectedEntityId: resolvedSelectedEntityId,
  });

  let trendData: SpWorkspaceTrendData;
  if (level === 'campaigns') {
    trendData = buildCampaignTrendData({
      entityCountLabel: workspaceData.entityCountLabel,
      entities,
      selectedEntityId: resolvedSelectedEntityId,
      selectedEntityLabel: resolvedSelectedEntity.label,
      start,
      end,
      ...(await loadCampaignTrendRows({
        accountId,
        campaignId: resolvedSelectedEntityId,
        start,
        end,
      })),
      markers,
      markersByDate,
    });
  } else {
    const selectedTarget = targetRows.find((row) => row.target_id === resolvedSelectedEntityId) ?? null;
    const targetTrendRows = await loadTargetTrendRows({
      accountId,
      targetId: resolvedSelectedEntityId,
      start,
      end,
    });
    const rankContract = resolveTargetRankingContract({
      scopeTrustworthy: asinFilter !== 'all',
      currentExpressionText: selectedTarget?.target_text,
      typeLabel: selectedTarget?.type_label,
      matchType: selectedTarget?.match_type,
    });
    let rankRows: SpTrendTargetRankRow[] = [];
    let rankSupportNote = rankContract.supported
      ? 'No rank snapshot was found for this exact keyword in the selected ASIN window.'
      : buildTargetRankSupportNote(rankContract.reasonCode);

    if (rankContract.supported) {
      try {
        const rankingRows = await getProductRankingDaily({
          accountId,
          marketplace,
          asin: asinFilter,
          start,
          end,
        });
        rankRows = rankingRows
          .filter(
            (row) =>
              normalizeText(row.keyword_norm ?? row.keyword_raw) === rankContract.resolvedKeywordNorm
          )
          .map((row) => ({
            observed_date: row.observed_date,
            organic_rank_value: row.organic_rank_value,
            sponsored_pos_value: row.sponsored_pos_value,
          }));
        if (rankRows.length > 0) {
          rankSupportNote =
            'Rank is contextual to the selected ASIN and exact keyword coverage. It is not a target-owned performance fact.';
        }
      } catch (error) {
        rankSupportNote =
          error instanceof Error
            ? `Rank context is unavailable for this target trend: ${error.message}`
            : 'Rank context is unavailable for this target trend.';
      }
    }

    trendData = buildTargetTrendData({
      entityCountLabel: workspaceData.entityCountLabel,
      entities,
      selectedEntityId: resolvedSelectedEntityId,
      selectedEntityLabel: resolvedSelectedEntity.label,
      start,
      end,
      ...targetTrendRows,
      rankRows,
      rankSupportNote,
      markers,
      markersByDate,
    });
  }

  const warnings = [...workspaceWarnings];
  if (level === 'campaigns') {
    warnings.push(
      'Campaign trend is the first Phase 7 slice. STIS, STIR, and TOS IS remain explicit null-safe diagnostics here until a trustworthy campaign-level daily source is wired.'
    );
  } else {
    warnings.push(
      'Targets trend is diagnostic-first. STIS/STIR come from search-term impression-share coverage, TOS IS comes from target targeting-report coverage, and rank stays contextual to single-ASIN keyword coverage.'
    );
  }

  return {
    warnings,
    workspaceData,
    trendData,
  };
};
