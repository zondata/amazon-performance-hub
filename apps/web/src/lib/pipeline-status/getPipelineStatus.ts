import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildPipelineStatusRows,
  PIPELINE_STATUS_SPECS,
  type PipelineCoverageRow,
  type PipelinePendingRow,
  type PipelineStatusRow,
} from './model';

const COVERAGE_TABLES = PIPELINE_STATUS_SPECS.filter(
  (spec) => spec.implementationStatus === 'implemented'
).map((spec) => spec.targetTable);

const PENDING_SOURCE_TYPES = PIPELINE_STATUS_SPECS.map((spec) => spec.pendingSourceType).filter(
  (value): value is string => Boolean(value)
);

export const getPipelineStatus = async (): Promise<PipelineStatusRow[]> => {
  const [coverageResult, pendingResult] = await Promise.all([
    supabaseAdmin
      .from('data_coverage_status')
      .select(
        'table_name,last_status,freshness_status,latest_period_end,last_successful_run_at,notes'
      )
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .in('table_name', COVERAGE_TABLES),
    supabaseAdmin
      .from('ads_api_report_requests')
      .select('source_type,status,created_at,retry_after_at')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .in('source_type', PENDING_SOURCE_TYPES),
  ]);

  if (coverageResult.error) {
    throw new Error(`Failed to load data_coverage_status: ${coverageResult.error.message}`);
  }
  if (pendingResult.error) {
    throw new Error(`Failed to load ads_api_report_requests: ${pendingResult.error.message}`);
  }

  const coverageRows: PipelineCoverageRow[] = (coverageResult.data ?? []).map((row) => ({
    tableName: String(row.table_name),
    lastStatus: String(row.last_status),
    freshnessStatus: String(row.freshness_status),
    latestPeriodEnd:
      typeof row.latest_period_end === 'string' ? row.latest_period_end : null,
    lastSuccessfulRunAt:
      typeof row.last_successful_run_at === 'string'
        ? row.last_successful_run_at
        : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
  }));

  const pendingRows: PipelinePendingRow[] = (pendingResult.data ?? []).map((row) => ({
    sourceType: String(row.source_type),
    status: String(row.status),
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    retryAfterAt:
      typeof row.retry_after_at === 'string' ? row.retry_after_at : null,
  }));

  return buildPipelineStatusRows({
    coverageRows,
    pendingRows,
  });
};
