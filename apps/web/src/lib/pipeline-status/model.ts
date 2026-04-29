export type PipelineImplementationStatus = 'implemented' | 'not_implemented';

export type PipelineStatusSpec = {
  sourceGroup: string;
  sourceType: string;
  targetTable: string;
  implementationStatus: PipelineImplementationStatus;
  pendingSourceType?: string;
};

export type PipelineCoverageRow = {
  tableName: string;
  lastStatus: string;
  freshnessStatus: string;
  latestPeriodEnd: string | null;
  lastSuccessfulRunAt: string | null;
  notes: string | null;
};

export type PipelinePendingRow = {
  sourceType: string;
  status: string;
  createdAt: string | null;
  retryAfterAt: string | null;
};

export type PipelineStatusRow = {
  sourceGroup: string;
  sourceType: string;
  targetTable: string;
  implementationStatus: PipelineImplementationStatus;
  latestPeriodEnd: string | null;
  lastSuccessfulImportTime: string | null;
  currentCoverageStatus: string;
  activePendingCount: number;
  oldestPendingAge: string;
  failedOrStaleCount: number;
  retryAfterAt: string | null;
  nextAction: string;
  notes: string;
};

export const PIPELINE_STATUS_SPECS: PipelineStatusSpec[] = [
  {
    sourceGroup: 'Sales & Traffic',
    sourceType: 'sp_api_sales_traffic_daily',
    targetTable: 'sales_traffic_daily_fact',
    implementationStatus: 'implemented',
  },
  {
    sourceGroup: 'SP campaign daily',
    sourceType: 'ads_api_sp_campaign_daily',
    targetTable: 'sp_campaign_hourly_fact_gold',
    implementationStatus: 'implemented',
    pendingSourceType: 'ads_api_sp_campaign_daily',
  },
  {
    sourceGroup: 'SP target daily',
    sourceType: 'ads_api_sp_target_daily',
    targetTable: 'sp_targeting_daily_fact',
    implementationStatus: 'implemented',
    pendingSourceType: 'ads_api_sp_target_daily',
  },
  {
    sourceGroup: 'SP placement daily',
    sourceType: 'ads_api_sp_placement_daily',
    targetTable: 'sp_placement_daily_fact',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SP STIS daily',
    sourceType: 'ads_api_sp_stis_daily',
    targetTable: 'sp_search_term_impression_share_daily_fact',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SP advertised product daily',
    sourceType: 'ads_api_sp_advertised_product_daily',
    targetTable: 'sp_advertised_product_daily_fact',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SB campaign daily',
    sourceType: 'ads_api_sb_campaign_daily',
    targetTable: 'sb_campaign_daily_fact_gold',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SB placement/keyword/STIS/attributed purchases',
    sourceType: 'ads_api_sb_campaign_placement_daily',
    targetTable: 'sb_campaign_placement_daily_fact',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SB placement/keyword/STIS/attributed purchases',
    sourceType: 'ads_api_sb_keyword_daily',
    targetTable: 'sb_keyword_daily_fact',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SB placement/keyword/STIS/attributed purchases',
    sourceType: 'ads_api_sb_stis_daily',
    targetTable: 'sb_search_term_impression_share_daily_fact',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SB placement/keyword/STIS/attributed purchases',
    sourceType: 'ads_api_sb_attributed_purchases_daily',
    targetTable: 'sb_attributed_purchases_daily_fact',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SD campaign/advertised/targeting/matched/purchased',
    sourceType: 'ads_api_sd_campaign_daily',
    targetTable: 'sd_campaign_daily_fact_gold',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SD campaign/advertised/targeting/matched/purchased',
    sourceType: 'ads_api_sd_advertised_product_daily',
    targetTable: 'sd_advertised_product_daily_fact',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SD campaign/advertised/targeting/matched/purchased',
    sourceType: 'ads_api_sd_targeting_daily',
    targetTable: 'sd_targeting_daily_fact',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SD campaign/advertised/targeting/matched/purchased',
    sourceType: 'ads_api_sd_matched_target_daily',
    targetTable: 'sd_matched_target_daily_fact',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SD campaign/advertised/targeting/matched/purchased',
    sourceType: 'ads_api_sd_purchased_product_daily',
    targetTable: 'sd_purchased_product_daily_fact',
    implementationStatus: 'not_implemented',
  },
  {
    sourceGroup: 'SQP',
    sourceType: 'sp_api_sqp_weekly',
    targetTable: 'sqp_weekly_latest',
    implementationStatus: 'implemented',
  },
];

const ACTIVE_PENDING_STATUSES = new Set([
  'created',
  'requested',
  'pending',
  'polling',
  'pending_timeout',
]);

const UNHEALTHY_PENDING_STATUSES = new Set(['failed', 'stale_expired']);

const formatPendingAgeHours = (createdAt: string | null, nowIso: string): string => {
  if (!createdAt) return '—';
  const createdAtMs = new Date(createdAt).getTime();
  const nowMs = new Date(nowIso).getTime();
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(nowMs)) return '—';
  const hours = (nowMs - createdAtMs) / (1000 * 60 * 60);
  return `${hours.toFixed(1)}h`;
};

export const buildPipelineStatusRows = (args: {
  specs?: PipelineStatusSpec[];
  coverageRows: PipelineCoverageRow[];
  pendingRows: PipelinePendingRow[];
  nowIso?: string;
}): PipelineStatusRow[] => {
  const specs = args.specs ?? PIPELINE_STATUS_SPECS;
  const nowIso = args.nowIso ?? new Date().toISOString();
  const coverageByTable = new Map(
    args.coverageRows.map((row) => [row.tableName, row] as const)
  );

  return specs.map((spec) => {
    const coverage = coverageByTable.get(spec.targetTable);
    const relatedPending = spec.pendingSourceType
      ? args.pendingRows.filter((row) => row.sourceType === spec.pendingSourceType)
      : [];
    const activePending = relatedPending.filter((row) =>
      ACTIVE_PENDING_STATUSES.has(row.status)
    );
    const unhealthyPending = relatedPending.filter((row) =>
      UNHEALTHY_PENDING_STATUSES.has(row.status)
    );
    const retryAfterAt = activePending
      .map((row) => row.retryAfterAt)
      .find((value) => typeof value === 'string' && value.length > 0) ?? null;
    const oldestPending = [...activePending].sort((left, right) => {
      const leftMs = left.createdAt ? new Date(left.createdAt).getTime() : Number.POSITIVE_INFINITY;
      const rightMs = right.createdAt ? new Date(right.createdAt).getTime() : Number.POSITIVE_INFINITY;
      return leftMs - rightMs;
    })[0] ?? null;

    let currentCoverageStatus = 'not_implemented';
    let nextAction = 'Not implemented yet. Do not treat this source as failed.';
    let notes = coverage?.notes ?? 'Not implemented yet.';

    if (spec.implementationStatus === 'implemented') {
      currentCoverageStatus = coverage
        ? `${coverage.lastStatus}/${coverage.freshnessStatus}`
        : 'no_coverage_row';
      notes = coverage?.notes ?? '';

      if (unhealthyPending.length > 0) {
        nextAction = 'Investigate failed or stale pending requests before the next automated retry.';
      } else if (activePending.length > 0 && retryAfterAt) {
        nextAction = 'Waiting for retry_after_at. The next scheduled retry should reuse the saved report id.';
      } else if (activePending.length > 0) {
        nextAction = 'Pending recovery is active. The next scheduled retry should poll the saved report id again.';
      } else if (!coverage || coverage.freshnessStatus === 'stale' || coverage.lastStatus !== 'success') {
        nextAction = 'Run the Ads loop verifier and inspect recent sync runs for this source.';
      } else {
        nextAction = 'No action required.';
      }
    }

    return {
      sourceGroup: spec.sourceGroup,
      sourceType: spec.sourceType,
      targetTable: spec.targetTable,
      implementationStatus: spec.implementationStatus,
      latestPeriodEnd: coverage?.latestPeriodEnd ?? null,
      lastSuccessfulImportTime: coverage?.lastSuccessfulRunAt ?? null,
      currentCoverageStatus,
      activePendingCount: activePending.length,
      oldestPendingAge: oldestPending
        ? formatPendingAgeHours(oldestPending.createdAt, nowIso)
        : '—',
      failedOrStaleCount: unhealthyPending.length,
      retryAfterAt,
      nextAction,
      notes,
    };
  });
};
