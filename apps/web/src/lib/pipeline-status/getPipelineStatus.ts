import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildPipelineStatusRows,
  PIPELINE_STATUS_SPECS,
  type PipelineCoverageRow,
  type PipelinePendingRow,
  type PipelineStatusPageData,
  type PipelineSyncRunRow,
} from './model';

const COVERAGE_SOURCE_TYPES = PIPELINE_STATUS_SPECS.filter(
  (spec) => spec.implementationStatus === 'implemented'
).map((spec) => spec.sourceType);

const PENDING_SOURCE_TYPES = PIPELINE_STATUS_SPECS.map((spec) => spec.pendingSourceType).filter(
  (value): value is string => Boolean(value)
);

const toObjectRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const getPipelineStatus = async (): Promise<PipelineStatusPageData> => {
  const [coverageResult, pendingResult, adsBatchResult] = await Promise.all([
    supabaseAdmin
      .from('data_coverage_status')
      .select(
        'source_type,table_name,last_status,freshness_status,oldest_period_start,latest_period_end,last_successful_run_at,last_sync_run_id,notes'
      )
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .in('source_type', COVERAGE_SOURCE_TYPES),
    supabaseAdmin
      .from('ads_api_report_requests')
      .select('source_type,status,created_at,retry_after_at')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .in('source_type', PENDING_SOURCE_TYPES),
    supabaseAdmin
      .from('api_sync_runs')
      .select(
        'sync_run_id,status,data_status,finished_at,error_code,error_message,result_json,raw_json'
      )
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .eq('source_type', 'ads_api')
      .eq('source_name', 'ads')
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (coverageResult.error) {
    throw new Error(`Failed to load data_coverage_status: ${coverageResult.error.message}`);
  }
  if (pendingResult.error) {
    throw new Error(`Failed to load ads_api_report_requests: ${pendingResult.error.message}`);
  }
  if (adsBatchResult.error) {
    throw new Error(`Failed to load latest ads batch sync run: ${adsBatchResult.error.message}`);
  }

  const coverageRows: PipelineCoverageRow[] = (coverageResult.data ?? []).map((row) => ({
    sourceType: String(row.source_type),
    tableName: String(row.table_name),
    lastStatus: String(row.last_status),
    freshnessStatus: String(row.freshness_status),
    oldestPeriodStart:
      typeof row.oldest_period_start === 'string' ? row.oldest_period_start : null,
    latestPeriodEnd:
      typeof row.latest_period_end === 'string' ? row.latest_period_end : null,
    lastSuccessfulRunAt:
      typeof row.last_successful_run_at === 'string'
        ? row.last_successful_run_at
        : null,
    lastSyncRunId:
      typeof row.last_sync_run_id === 'string' ? row.last_sync_run_id : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
  }));

  const pendingRows: PipelinePendingRow[] = (pendingResult.data ?? []).map((row) => ({
    sourceType: String(row.source_type),
    status: String(row.status),
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    retryAfterAt:
      typeof row.retry_after_at === 'string'
        ? row.retry_after_at
        : null,
  }));

  const syncRunIds = [...new Set(
    coverageRows
      .map((row) => row.lastSyncRunId)
      .filter((value): value is string => Boolean(value))
  )];

  const syncRunsById = new Map<string, PipelineSyncRunRow>();
  if (syncRunIds.length > 0) {
    const syncRunsResult = await supabaseAdmin
      .from('api_sync_runs')
      .select(
        'sync_run_id,status,data_status,finished_at,error_code,error_message,result_json,raw_json'
      )
      .in('sync_run_id', syncRunIds);

    if (syncRunsResult.error) {
      throw new Error(`Failed to load source-group sync runs: ${syncRunsResult.error.message}`);
    }

    for (const row of syncRunsResult.data ?? []) {
      const syncRunId = typeof row.sync_run_id === 'string' ? row.sync_run_id : null;
      if (!syncRunId) continue;
      syncRunsById.set(syncRunId, {
        syncRunId,
        status: String(row.status),
        dataStatus: String(row.data_status),
        finishedAt: typeof row.finished_at === 'string' ? row.finished_at : null,
        errorCode: typeof row.error_code === 'string' ? row.error_code : null,
        errorMessage: typeof row.error_message === 'string' ? row.error_message : null,
        resultJson: toObjectRecord(row.result_json),
        rawJson: toObjectRecord(row.raw_json),
      });
    }
  }

  const batchRun: PipelineSyncRunRow | null =
    adsBatchResult.data && typeof adsBatchResult.data.sync_run_id === 'string'
      ? {
          syncRunId: adsBatchResult.data.sync_run_id,
          status: String(adsBatchResult.data.status),
          dataStatus: String(adsBatchResult.data.data_status),
          finishedAt:
            typeof adsBatchResult.data.finished_at === 'string'
              ? adsBatchResult.data.finished_at
              : null,
          errorCode:
            typeof adsBatchResult.data.error_code === 'string'
              ? adsBatchResult.data.error_code
              : null,
          errorMessage:
            typeof adsBatchResult.data.error_message === 'string'
              ? adsBatchResult.data.error_message
              : null,
          resultJson: toObjectRecord(adsBatchResult.data.result_json),
          rawJson: toObjectRecord(adsBatchResult.data.raw_json),
        }
      : null;

  return buildPipelineStatusRows({
    coverageRows,
    pendingRows,
    syncRunsById,
    batchRun,
  });
};
