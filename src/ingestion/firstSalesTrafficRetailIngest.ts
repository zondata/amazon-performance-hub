import { createHash } from 'node:crypto';

import { runFirstSalesTrafficCanonicalIngestBoundary } from './firstSalesTrafficCanonical';
import { runFirstSalesTrafficWarehouseReadyContractPromotion } from './firstSalesTrafficWarehouseReady';
import {
  IngestionJobRunner,
  IngestionJobRunnerError,
  type IngestionExecutorResult,
  type IngestionJobRepository,
  type IngestionJobRunResult,
} from './jobRunner';
import type { IngestionJobRecord } from './schemaContract';
import { INGESTION_STATE_HINTS_METADATA_KEY } from './stateEnvelope';
import {
  parseFirstSalesAndTrafficReportContent,
  runFirstSpApiReportHandoff,
  runFirstSpApiLocalStageIngestion,
} from '../connectors/sp-api';
import {
  writeFirstSalesTrafficWarehouseRows,
  type FirstSalesTrafficWarehouseSink,
  type FirstSalesTrafficWarehouseWriteSummary,
} from '../warehouse/firstSalesTrafficWarehouseWrite';

export const FT01_RETAIL_SOURCE_NAME = 'stage3_retail_sales_traffic_daily';
export const FT01_RETAIL_JOB_KEY = 'stage3_daily_retail_sales_traffic';

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export interface FirstSalesTrafficRetailIngestRequest {
  accountId: string;
  marketplace: string;
  startDate: string;
  endDate: string;
  reportId?: string | null;
  rawFilePath?: string | null;
  warehouseReadyArtifactPath?: string | null;
  applySchema?: boolean;
}

export interface FirstSalesTrafficRetailIngestResult {
  ok: boolean;
  request: {
    accountId: string;
    marketplace: string;
    startDate: string;
    endDate: string;
    reportId: string | null;
  };
  jobResult: IngestionJobRunResult['result'];
  job: IngestionJobRunResult['job'];
  watermark: IngestionJobRunResult['watermark'];
  executorInvoked: boolean;
  writeSummary: FirstSalesTrafficWarehouseWriteSummary | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export interface FirstSalesTrafficRetailIngestOptions {
  request: FirstSalesTrafficRetailIngestRequest;
  repository: IngestionJobRepository;
  sink: FirstSalesTrafficWarehouseSink;
  now?: () => string;
  createJobId?: () => string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const trimRequired = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      `${field} must be a non-empty string`
    );
  }
  return trimmed;
};

const optionalTrimmed = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
};

const normalizeRequest = (
  request: FirstSalesTrafficRetailIngestRequest
): Required<Omit<FirstSalesTrafficRetailIngestRequest, 'reportId' | 'rawFilePath' | 'warehouseReadyArtifactPath'>> & {
  reportId: string | null;
  rawFilePath: string | null;
  warehouseReadyArtifactPath: string | null;
} => {
  const accountId = trimRequired(request.accountId, 'accountId');
  const marketplace = trimRequired(request.marketplace, 'marketplace').toUpperCase();
  const startDate = trimRequired(request.startDate, 'startDate');
  const endDate = trimRequired(request.endDate, 'endDate');

  if (!DATE_RE.test(startDate)) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      'startDate must use YYYY-MM-DD'
    );
  }
  if (!DATE_RE.test(endDate)) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      'endDate must use YYYY-MM-DD'
    );
  }
  if (startDate > endDate) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      'startDate must be on or before endDate'
    );
  }

  return {
    accountId,
    marketplace,
    startDate,
    endDate,
    reportId: optionalTrimmed(request.reportId),
    rawFilePath: optionalTrimmed(request.rawFilePath),
    warehouseReadyArtifactPath: optionalTrimmed(request.warehouseReadyArtifactPath),
    applySchema: request.applySchema ?? false,
  };
};

const scopeKey = (request: ReturnType<typeof normalizeRequest>): string =>
  `daily:${request.marketplace}`;

const idempotencyKey = (
  request: ReturnType<typeof normalizeRequest>
): string =>
  [
    'ft01-v2',
    'retail-sales-traffic',
    FT01_RETAIL_SOURCE_NAME,
    request.accountId,
    request.marketplace,
    request.startDate,
    request.endDate,
    request.reportId ?? request.rawFilePath ?? request.warehouseReadyArtifactPath ?? 'latest-artifact',
  ].join('/');

const requestMetadata = (
  request: ReturnType<typeof normalizeRequest>
): IngestionJobRecord['metadata'] => ({
  gate: 'FT-01',
  source_group: 'retail',
  account_id: request.accountId,
  marketplace: request.marketplace,
  start_date: request.startDate,
  end_date: request.endDate,
  report_id: request.reportId,
  raw_file_path: request.rawFilePath,
  warehouse_ready_artifact_path: request.warehouseReadyArtifactPath,
  legacy_sales_trend_fallback: false,
  [INGESTION_STATE_HINTS_METADATA_KEY]: {
    sourceCadence: 'daily',
    finalizationState: 'revisable',
    sourceConfidence: 'high',
  },
});

const checksum = (value: JsonObject): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const runArtifactPipeline = async (
  request: ReturnType<typeof normalizeRequest>
): Promise<{
  reportId: string;
  warehouseReadyArtifactPath?: string;
  steps: JsonObject[];
}> => {
  const steps: JsonObject[] = [];

  if (request.warehouseReadyArtifactPath) {
    steps.push({
      name: 'spapi:promote-first-report-warehouse-ready',
      status: 'skipped',
      reason: 'operator_supplied_warehouse_ready_artifact',
      warehouse_ready_artifact_path: request.warehouseReadyArtifactPath,
    });
    return {
      reportId: request.reportId ?? 'from-warehouse-ready-artifact',
      warehouseReadyArtifactPath: request.warehouseReadyArtifactPath,
      steps,
    };
  }

  const parseSummary = await parseFirstSalesAndTrafficReportContent({
    reportId: request.reportId ?? undefined,
    rawFilePath: request.rawFilePath ?? undefined,
  });
  steps.push({
    name: 'spapi:parse-first-report',
    status: 'success',
    report_id: parseSummary.reportId,
    parsed_artifact_path: parseSummary.parsedArtifactPath,
    row_count: parseSummary.totalRowCount,
  });

  const handoffSummary = await runFirstSpApiReportHandoff({
    reportId: parseSummary.reportId,
  });
  steps.push({
    name: 'spapi:build-first-report-handoff',
    status: 'success',
    handoff_artifact_path: handoffSummary.handoffArtifactPath,
    row_count: handoffSummary.totalRowCount,
  });

  const stageSummary = await runFirstSpApiLocalStageIngestion({
    reportId: parseSummary.reportId,
  });
  steps.push({
    name: 'spapi:ingest-first-report-local-stage',
    status: 'success',
    staging_artifact_path: stageSummary.stagingArtifactPath,
    row_count: stageSummary.totalRowCount,
  });

  const canonicalSummary = await runFirstSalesTrafficCanonicalIngestBoundary({
    reportId: parseSummary.reportId,
  });
  steps.push({
    name: 'spapi:ingest-first-report-canonical',
    status: 'success',
    canonical_ingest_artifact_path: canonicalSummary.canonicalIngestArtifactPath,
    row_count: canonicalSummary.totalRowCount,
  });

  const warehouseReadySummary =
    await runFirstSalesTrafficWarehouseReadyContractPromotion({
      reportId: parseSummary.reportId,
    });
  steps.push({
    name: 'spapi:promote-first-report-warehouse-ready',
    status: 'success',
    warehouse_ready_artifact_path:
      warehouseReadySummary.warehouseReadyArtifactPath,
    row_count: warehouseReadySummary.totalRowCount,
  });

  return {
    reportId: parseSummary.reportId,
    warehouseReadyArtifactPath: warehouseReadySummary.warehouseReadyArtifactPath,
    steps,
  };
};

const buildExecutor = (
  request: ReturnType<typeof normalizeRequest>,
  sink: FirstSalesTrafficWarehouseSink
) => async ({ job }: { job: IngestionJobRecord }): Promise<IngestionExecutorResult> => {
  try {
    const pipeline = await runArtifactPipeline(request);
    const writeSummary = await writeFirstSalesTrafficWarehouseRows({
      accountId: request.accountId,
      marketplace: request.marketplace,
      ingestionJobId: job.id,
      reportWindowStart: request.startDate,
      reportWindowEnd: request.endDate,
      reportId:
        pipeline.reportId === 'from-warehouse-ready-artifact'
          ? request.reportId ?? undefined
          : pipeline.reportId,
      warehouseReadyArtifactPath: pipeline.warehouseReadyArtifactPath ?? undefined,
      sink,
      applySchema: request.applySchema,
    });

    const metadata: JsonObject = {
      source_group: 'retail',
      gate: 'FT-01',
      report_id: writeSummary.reportId,
      account_id: request.accountId,
      marketplace: request.marketplace,
      start_date: request.startDate,
      end_date: request.endDate,
      warehouse_write_summary: writeSummary as unknown as JsonObject,
      pipeline_steps: pipeline.steps,
      legacy_sales_trend_fallback: false,
    };

    return {
      outcome: 'success',
      rowCount: writeSummary.totalRowCount,
      checksum: checksum(metadata),
      retrievedAt: writeSummary.exportedAt,
      metadata,
    };
  } catch (error) {
    return {
      outcome: 'failure',
      errorCode:
        error instanceof Error && 'code' in error
          ? String((error as { code: unknown }).code)
          : 'retail_sales_traffic_ingest_failed',
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Retail Sales and Traffic ingest failed.',
      metadata: {
        source_group: 'retail',
        gate: 'FT-01',
        failure_reason:
          error instanceof Error
            ? error.message
            : 'Retail Sales and Traffic ingest failed.',
        legacy_sales_trend_fallback: false,
      },
    };
  }
};

export async function runFirstSalesTrafficRetailIngest(
  options: FirstSalesTrafficRetailIngestOptions
): Promise<FirstSalesTrafficRetailIngestResult> {
  const request = normalizeRequest(options.request);
  const runner = new IngestionJobRunner({
    repository: options.repository,
    executor: buildExecutor(request, options.sink),
    now: options.now,
    createJobId: options.createJobId,
  });
  const run = await runner.submitJob({
    jobKey: FT01_RETAIL_JOB_KEY,
    sourceName: FT01_RETAIL_SOURCE_NAME,
    accountId: request.accountId,
    marketplace: request.marketplace,
    sourceWindowStart: request.startDate,
    sourceWindowEnd: request.endDate,
    idempotencyKey: idempotencyKey(request),
    runKind: 'manual',
    scopeKey: scopeKey(request),
    metadata: requestMetadata(request),
  });
  const writeSummary =
    (run.job.metadata.warehouse_write_summary as
      | FirstSalesTrafficWarehouseWriteSummary
      | undefined) ?? null;

  return {
    ok: run.job.processing_status === 'available',
    request: {
      accountId: request.accountId,
      marketplace: request.marketplace,
      startDate: request.startDate,
      endDate: request.endDate,
      reportId: writeSummary?.reportId ?? request.reportId,
    },
    jobResult: run.result,
    job: run.job,
    watermark: run.watermark,
    executorInvoked: run.executorInvoked,
    writeSummary,
    error:
      run.job.processing_status === 'failed'
        ? {
            code: run.job.error_code ?? 'retail_sales_traffic_ingest_failed',
            message:
              run.job.error_message ?? 'Retail Sales and Traffic ingest failed.',
          }
        : null,
  };
}

export function summarizeFirstSalesTrafficRetailIngest(
  result: FirstSalesTrafficRetailIngestResult
): string {
  return [
    'FT-01 SP-API retail Sales and Traffic ingest completed.',
    `ok=${result.ok ? 'yes' : 'no'}`,
    `account_id=${result.request.accountId}`,
    `marketplace=${result.request.marketplace}`,
    `start_date=${result.request.startDate}`,
    `end_date=${result.request.endDate}`,
    `report_id=${result.request.reportId ?? 'none'}`,
    `job_result=${result.jobResult}`,
    `job_id=${result.job.id}`,
    `job_status=${result.job.processing_status}`,
    `executor_invoked=${result.executorInvoked ? 'yes' : 'no'}`,
    `row_count=${result.job.row_count ?? 'null'}`,
    `checksum=${result.job.checksum ?? 'null'}`,
    `watermark_status=${result.watermark?.status ?? 'none'}`,
    `watermark_last_job_id=${result.watermark?.last_job_id ?? 'none'}`,
    `target_tables=${result.writeSummary?.targetTableNames.join(',') ?? 'none'}`,
    `date_row_count=${result.writeSummary?.dateRowCount ?? 'null'}`,
    `asin_row_count=${result.writeSummary?.asinRowCount ?? 'null'}`,
    `legacy_sales_trend_fallback=no`,
    `error_code=${result.error?.code ?? 'none'}`,
    `error_message=${result.error?.message ?? 'none'}`,
  ].join('\n');
}
