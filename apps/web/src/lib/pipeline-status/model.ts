export type PipelineImplementationStatus = 'implemented' | 'not_implemented';

export type PipelineSourceGroupStatus =
  | 'success'
  | 'warning'
  | 'failed'
  | 'blocked'
  | 'not_implemented'
  | 'no_coverage';

export type PipelineBatchStatus =
  | 'success'
  | 'failed'
  | 'partial_success'
  | 'running'
  | 'unknown';

export type PipelineStatusSpec = {
  sourceGroup: string;
  sourceType: string;
  targetTable: string;
  implementationStatus: PipelineImplementationStatus;
  pendingSourceType?: string;
};

export type PipelineCoverageRow = {
  tableName: string;
  sourceType: string;
  lastStatus: string;
  freshnessStatus: string;
  latestPeriodEnd: string | null;
  lastSuccessfulRunAt: string | null;
  lastSyncRunId: string | null;
  notes: string | null;
};

export type PipelinePendingRow = {
  sourceType: string;
  status: string;
  createdAt: string | null;
  retryAfterAt: string | null;
};

export type PipelineSyncRunRow = {
  syncRunId: string;
  status: string;
  dataStatus: string;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultJson: Record<string, unknown>;
  rawJson: Record<string, unknown>;
};

export type PipelineStatusRow = {
  sourceGroup: string;
  sourceType: string;
  targetTable: string;
  implementationStatus: PipelineImplementationStatus;
  sourceGroupStatus: PipelineSourceGroupStatus;
  latestPeriodEnd: string | null;
  lastSuccessfulImportTime: string | null;
  currentCoverageStatus: string;
  activePendingCount: number;
  oldestPendingAge: string;
  failedOrStaleCount: number;
  retryAfterAt: string | null;
  nextAction: string;
  friendlySummary: string;
  technicalDetails: string | null;
};

export type PipelineBatchSummary = {
  status: PipelineBatchStatus;
  summary: string;
  technicalDetails: string | null;
} | null;

export type PipelineStatusPageData = {
  rows: PipelineStatusRow[];
  batchSummary: PipelineBatchSummary;
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

const coverageStatusLabel = (
  status: PipelineSourceGroupStatus,
  freshnessStatus: string | null
): string => {
  if (status === 'success') {
    if (freshnessStatus === 'fresh') return 'updated';
    if (freshnessStatus === 'delayed_expected') return 'live';
    return 'success';
  }
  if (status === 'warning') {
    if (freshnessStatus === 'stale') return 'warning/stale';
    return 'warning';
  }
  if (status === 'failed') return 'failed/blocked';
  if (status === 'blocked') return 'blocked';
  if (status === 'no_coverage') return 'no coverage';
  return 'not implemented';
};

const technicalDetailsForRun = (
  spec: PipelineStatusSpec,
  syncRun: PipelineSyncRunRow | null
): string | null => {
  if (!syncRun) {
    return null;
  }

  const lines: string[] = [
    `sync_run_id=${syncRun.syncRunId}`,
    `run_status=${syncRun.status}`,
    `data_status=${syncRun.dataStatus}`,
  ];

  if (syncRun.finishedAt) {
    lines.push(`finished_at=${syncRun.finishedAt}`);
  }
  if (syncRun.errorCode) {
    lines.push(`error_code=${syncRun.errorCode}`);
  }
  if (syncRun.errorMessage) {
    lines.push(`error_message=${syncRun.errorMessage}`);
  }

  const details = syncRun.resultJson.source_details;
  const detailObject =
    details && typeof details === 'object' && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : null;
  const steps = Array.isArray(detailObject?.steps)
    ? detailObject?.steps
    : [];

  const matchingStepName =
    spec.sourceType === 'ads_api_sp_campaign_daily'
      ? 'adsapi:ingest-sp-campaign-daily'
      : spec.sourceType === 'ads_api_sp_target_daily'
        ? 'adsapi:ingest-sp-target-daily'
        : null;

  if (matchingStepName) {
    const matchingStep = steps.find((step) => {
      if (!step || typeof step !== 'object' || Array.isArray(step)) return false;
      return (step as Record<string, unknown>).name === matchingStepName;
    }) as Record<string, unknown> | undefined;

    if (matchingStep) {
      lines.push(`step=${matchingStepName}`);
      if (typeof matchingStep.status === 'string') {
        lines.push(`step_status=${matchingStep.status}`);
      }
      const summary =
        matchingStep.summary &&
        typeof matchingStep.summary === 'object' &&
        !Array.isArray(matchingStep.summary)
          ? (matchingStep.summary as Record<string, unknown>)
          : null;
      if (summary) {
        for (const key of ['message', 'code', 'upload_id', 'campaign_row_count', 'target_row_count']) {
          const value = summary[key];
          if (typeof value === 'string' && value.trim()) {
            lines.push(`${key}=${value}`);
          } else if (typeof value === 'number' && Number.isFinite(value)) {
            lines.push(`${key}=${value}`);
          }
        }
        const stderrTail = Array.isArray(summary.stderr_tail)
          ? summary.stderr_tail.filter((value): value is string => typeof value === 'string')
          : [];
        const stdoutTail = Array.isArray(summary.stdout_tail)
          ? summary.stdout_tail.filter((value): value is string => typeof value === 'string')
          : [];
        if (stderrTail.length > 0) {
          lines.push(`stderr_tail=${stderrTail.join(' | ')}`);
        }
        if (stdoutTail.length > 0) {
          lines.push(`stdout_tail=${stdoutTail.join(' | ')}`);
        }
      }
    }
  }

  return lines.join('\n');
};

const deriveFriendlySummary = (args: {
  spec: PipelineStatusSpec;
  sourceGroupStatus: PipelineSourceGroupStatus;
  coverage: PipelineCoverageRow | undefined;
  activePendingCount: number;
  failedOrStaleCount: number;
}): string => {
  const note = args.coverage?.notes?.trim();
  if (note) {
    return note.replace(/\s+\|\s+/g, ' ');
  }

  if (args.spec.implementationStatus === 'not_implemented') {
    return 'Automation for this source group is not implemented yet. It is blocked by design, not failing unexpectedly.';
  }

  if (args.sourceGroupStatus === 'success') {
    return `${args.spec.sourceGroup} is updated for the latest successfully loaded period.`;
  }
  if (args.sourceGroupStatus === 'warning') {
    if (args.activePendingCount > 0) {
      return `${args.spec.sourceGroup} has usable data, but there are still pending refresh requests waiting for completion.`;
    }
    return `${args.spec.sourceGroup} has data available, but operator review is recommended.`;
  }
  if (args.sourceGroupStatus === 'failed') {
    return `${args.spec.sourceGroup} failed to refresh successfully. Review the technical details and rerun the source group after fixing the underlying issue.`;
  }
  if (args.sourceGroupStatus === 'blocked') {
    if (args.failedOrStaleCount > 0) {
      return `${args.spec.sourceGroup} is blocked by failed or stale pending requests.`;
    }
    return `${args.spec.sourceGroup} is blocked and does not have a completed successful refresh for the requested period.`;
  }
  return `${args.spec.sourceGroup} does not yet have coverage metadata.`;
};

const deriveSourceGroupStatus = (args: {
  spec: PipelineStatusSpec;
  coverage: PipelineCoverageRow | undefined;
  activePendingCount: number;
  failedOrStaleCount: number;
}): PipelineSourceGroupStatus => {
  if (args.spec.implementationStatus === 'not_implemented') {
    return 'not_implemented';
  }
  if (!args.coverage) {
    return 'no_coverage';
  }
  if (args.coverage.lastStatus === 'failed') {
    return 'failed';
  }
  if (args.coverage.lastStatus === 'blocked') {
    return 'blocked';
  }
  if (args.failedOrStaleCount > 0) {
    return 'failed';
  }
  if (args.coverage.lastStatus === 'partial' || args.activePendingCount > 0 || args.coverage.freshnessStatus === 'stale') {
    return 'warning';
  }
  if (args.coverage.lastStatus === 'success') {
    return 'success';
  }
  return 'no_coverage';
};

const deriveNextAction = (args: {
  spec: PipelineStatusSpec;
  sourceGroupStatus: PipelineSourceGroupStatus;
  activePendingCount: number;
  failedOrStaleCount: number;
  retryAfterAt: string | null;
}): string => {
  if (args.spec.implementationStatus === 'not_implemented') {
    return 'Wait for automation to be implemented or run this source manually outside the current Ads API loop.';
  }
  if (args.failedOrStaleCount > 0) {
    return 'Investigate the failed/stale pending request, then rerun this source group.';
  }
  if (args.activePendingCount > 0 && args.retryAfterAt) {
    return 'Wait for the saved retry_after_at time, then let the next retry resume the existing report request.';
  }
  if (args.activePendingCount > 0) {
    return 'A pending report request is still active. Let the automation continue polling before retrying manually.';
  }
  if (args.sourceGroupStatus === 'failed') {
    return 'Fix the underlying ingest or pull failure, then rerun this source group.';
  }
  if (args.sourceGroupStatus === 'blocked') {
    return 'Resolve the blocking upstream dependency, then rerun the Ads API refresh.';
  }
  if (args.sourceGroupStatus === 'warning') {
    return 'Review the warning details. A rerun may be needed if the data should already be final.';
  }
  return 'No action required.';
};

const buildBatchSummary = (batchRun: PipelineSyncRunRow | null): PipelineBatchSummary => {
  if (!batchRun) {
    return null;
  }

  if (batchRun.status === 'running') {
    return {
      status: 'running',
      summary: 'An Ads API refresh is currently running.',
      technicalDetails: technicalDetailsForRun(
        {
          sourceGroup: 'Ads batch',
          sourceType: 'ads_api_batch',
          targetTable: 'amazon_data_sync',
          implementationStatus: 'implemented',
        },
        batchRun
      ),
    };
  }

  const details = batchRun.resultJson.source_details;
  const detailObject =
    details && typeof details === 'object' && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : null;
  const steps = Array.isArray(detailObject?.steps)
    ? detailObject.steps
    : [];
  const firstFailedStep = steps.find((step) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) return false;
    return (step as Record<string, unknown>).status === 'failed';
  }) as Record<string, unknown> | undefined;
  const failedStepName =
    firstFailedStep && typeof firstFailedStep.name === 'string'
      ? firstFailedStep.name
      : null;

  if (batchRun.status === 'failed') {
    return {
      status: 'failed',
      summary: failedStepName
        ? `Overall Ads API refresh failed at ${failedStepName}. Successful source-group rows below still reflect the data that did load.`
        : 'Overall Ads API refresh failed. Successful source-group rows below still reflect the data that did load.',
      technicalDetails: technicalDetailsForRun(
        {
          sourceGroup: 'Ads batch',
          sourceType: 'ads_api_batch',
          targetTable: 'amazon_data_sync',
          implementationStatus: 'implemented',
        },
        batchRun
      ),
    };
  }

  if (batchRun.dataStatus === 'preliminary' || batchRun.dataStatus === 'manual_unknown') {
    return {
      status: 'partial_success',
      summary: 'Overall Ads API refresh completed with partial or preliminary results.',
      technicalDetails: technicalDetailsForRun(
        {
          sourceGroup: 'Ads batch',
          sourceType: 'ads_api_batch',
          targetTable: 'amazon_data_sync',
          implementationStatus: 'implemented',
        },
        batchRun
      ),
    };
  }

  return {
    status: 'success',
    summary: 'Overall Ads API refresh completed successfully.',
    technicalDetails: technicalDetailsForRun(
      {
        sourceGroup: 'Ads batch',
        sourceType: 'ads_api_batch',
        targetTable: 'amazon_data_sync',
        implementationStatus: 'implemented',
      },
      batchRun
    ),
  };
};

export const buildPipelineStatusRows = (args: {
  specs?: PipelineStatusSpec[];
  coverageRows: PipelineCoverageRow[];
  pendingRows: PipelinePendingRow[];
  syncRunsById?: Map<string, PipelineSyncRunRow>;
  batchRun?: PipelineSyncRunRow | null;
  nowIso?: string;
}): PipelineStatusPageData => {
  const specs = args.specs ?? PIPELINE_STATUS_SPECS;
  const nowIso = args.nowIso ?? new Date().toISOString();
  const coverageBySourceType = new Map(
    args.coverageRows.map((row) => [row.sourceType, row] as const)
  );

  const rows = specs.map((spec) => {
    const coverage = coverageBySourceType.get(spec.sourceType);
    const relatedPending = spec.pendingSourceType
      ? args.pendingRows.filter((row) => row.sourceType === spec.pendingSourceType)
      : [];
    const activePending = relatedPending.filter((row) =>
      ACTIVE_PENDING_STATUSES.has(row.status)
    );
    const unhealthyPending = relatedPending.filter((row) =>
      UNHEALTHY_PENDING_STATUSES.has(row.status)
    );
    const retryAfterAt =
      activePending
        .map((row) => row.retryAfterAt)
        .find((value) => typeof value === 'string' && value.length > 0) ?? null;
    const oldestPending = [...activePending].sort((left, right) => {
      const leftMs = left.createdAt ? new Date(left.createdAt).getTime() : Number.POSITIVE_INFINITY;
      const rightMs = right.createdAt ? new Date(right.createdAt).getTime() : Number.POSITIVE_INFINITY;
      return leftMs - rightMs;
    })[0] ?? null;

    const sourceGroupStatus = deriveSourceGroupStatus({
      spec,
      coverage,
      activePendingCount: activePending.length,
      failedOrStaleCount: unhealthyPending.length,
    });
    const syncRun =
      coverage?.lastSyncRunId && args.syncRunsById
        ? args.syncRunsById.get(coverage.lastSyncRunId) ?? null
        : null;

    return {
      sourceGroup: spec.sourceGroup,
      sourceType: spec.sourceType,
      targetTable: spec.targetTable,
      implementationStatus: spec.implementationStatus,
      sourceGroupStatus,
      latestPeriodEnd: coverage?.latestPeriodEnd ?? null,
      lastSuccessfulImportTime: coverage?.lastSuccessfulRunAt ?? null,
      currentCoverageStatus: coverageStatusLabel(
        sourceGroupStatus,
        coverage?.freshnessStatus ?? null
      ),
      activePendingCount: activePending.length,
      oldestPendingAge: oldestPending
        ? formatPendingAgeHours(oldestPending.createdAt, nowIso)
        : '—',
      failedOrStaleCount: unhealthyPending.length,
      retryAfterAt,
      nextAction: deriveNextAction({
        spec,
        sourceGroupStatus,
        activePendingCount: activePending.length,
        failedOrStaleCount: unhealthyPending.length,
        retryAfterAt,
      }),
      friendlySummary: deriveFriendlySummary({
        spec,
        sourceGroupStatus,
        coverage,
        activePendingCount: activePending.length,
        failedOrStaleCount: unhealthyPending.length,
      }),
      technicalDetails: technicalDetailsForRun(spec, syncRun),
    };
  });

  return {
    rows,
    batchSummary: buildBatchSummary(args.batchRun ?? null),
  };
};
