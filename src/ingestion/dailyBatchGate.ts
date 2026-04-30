import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

import {
  InMemoryIngestionJobRepository,
  IngestionJobRunner,
  IngestionJobRunnerError,
  type IngestionExecutorResult,
  type IngestionJobRepository,
  type IngestionJobRunRequest,
  type IngestionJobRunResult,
} from './jobRunner';
import type { IngestionJobRecord } from './schemaContract';
import { INGESTION_STATE_HINTS_METADATA_KEY } from './stateEnvelope';

export const DAILY_BATCH_RETAIL_SOURCE_NAME = 'stage3_retail_sales_traffic_daily';
export const DAILY_BATCH_ADS_SOURCE_NAME = 'stage3_ads_sp_daily';
export const DAILY_BATCH_RETAIL_JOB_KEY = 'stage3_daily_retail_sales_traffic';
export const DAILY_BATCH_ADS_JOB_KEY = 'stage3_daily_ads_sp';

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export interface DailyBatchGateRequest {
  accountId: string;
  marketplace: string;
  startDate: string;
  endDate: string;
  resumePending?: boolean;
}

export interface DailyBatchStepResult extends JsonObject {
  name: string;
  status: 'success' | 'failed' | 'skipped';
  summary: JsonObject;
}

export interface DailyBatchSourceExecutionSuccess {
  rowCount: number;
  checksum?: string | null;
  retrievedAt?: string | null;
  metadata: JsonObject;
  steps: DailyBatchStepResult[];
}

export interface DailyBatchSourceExecutionFailure {
  errorCode: string;
  errorMessage: string;
  metadata?: JsonObject;
  steps?: DailyBatchStepResult[];
}

export type DailyBatchSourceExecutor = (
  request: DailyBatchGateRequest
) => Promise<DailyBatchSourceExecutionSuccess>;

export interface DailyBatchGateSourceResult {
  source: 'retail' | 'ads';
  jobResult: IngestionJobRunResult['result'] | 'not_run';
  job: IngestionJobRunResult['job'] | null;
  watermark: IngestionJobRunResult['watermark'];
  executorInvoked: boolean;
  steps: DailyBatchStepResult[];
}

export interface DailyBatchGateResult {
  ok: boolean;
  request: DailyBatchGateRequest;
  retail: DailyBatchGateSourceResult;
  ads: DailyBatchGateSourceResult;
  error: {
    source: 'retail' | 'ads';
    code: string;
    message: string;
  } | null;
}

export interface DailyBatchGateOptions {
  request: DailyBatchGateRequest;
  repository?: IngestionJobRepository;
  retailExecutor?: DailyBatchSourceExecutor;
  adsExecutor?: DailyBatchSourceExecutor;
  now?: () => string;
  createJobId?: () => string;
  realExecutorOptions?: {
    retailReportId?: string | null;
  };
}

interface CommandResult {
  command: string;
  args: string[];
  exitCode: number;
  status: 'failed' | 'success' | 'timed_out';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  stdout: string;
  stderr: string;
  stdoutTail: string[];
  stderrTail: string[];
  errorMessage: string | null;
}

interface CommandRunOptions {
  sourceName?: string;
  targetName?: string;
  streamOutput?: boolean;
  timeoutMs?: number;
}

export class DailyBatchGateError extends Error {
  readonly code: string;
  readonly metadata?: JsonObject;
  readonly steps?: DailyBatchStepResult[];

  constructor(args: {
    code: string;
    message: string;
    metadata?: JsonObject;
    steps?: DailyBatchStepResult[];
  }) {
    super(args.message);
    this.name = 'DailyBatchGateError';
    this.code = args.code;
    this.metadata = args.metadata;
    this.steps = args.steps;
  }
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

const normalizeRequest = (request: DailyBatchGateRequest): DailyBatchGateRequest => {
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

  return { accountId, marketplace, startDate, endDate };
};

const scopeKey = (request: DailyBatchGateRequest): string =>
  `daily:${request.marketplace}`;

const idempotencyKey = (
  sourceName: string,
  request: DailyBatchGateRequest
): string =>
  [
    'stage3',
    'daily-batch',
    sourceName,
    request.accountId,
    request.marketplace,
    request.startDate,
    request.endDate,
  ].join('/');

const requestMetadata = (
  sourceGroup: 'retail' | 'ads',
  request: DailyBatchGateRequest
): IngestionJobRecord['metadata'] => ({
  gate: 'S3-G1',
  source_group: sourceGroup,
  account_id: request.accountId,
  marketplace: request.marketplace,
  start_date: request.startDate,
  end_date: request.endDate,
  [INGESTION_STATE_HINTS_METADATA_KEY]: {
    sourceCadence: 'daily',
    finalizationState: 'revisable',
    sourceConfidence: sourceGroup === 'ads' ? 'high' : 'medium',
  },
});

export const buildDailyBatchSourceJobRequest = (args: {
  sourceGroup: 'retail' | 'ads';
  request: DailyBatchGateRequest;
}): IngestionJobRunRequest => {
  const sourceName =
    args.sourceGroup === 'retail'
      ? DAILY_BATCH_RETAIL_SOURCE_NAME
      : DAILY_BATCH_ADS_SOURCE_NAME;

  return {
    jobKey:
      args.sourceGroup === 'retail'
        ? DAILY_BATCH_RETAIL_JOB_KEY
        : DAILY_BATCH_ADS_JOB_KEY,
    sourceName,
    accountId: args.request.accountId,
    marketplace: args.request.marketplace,
    sourceWindowStart: args.request.startDate,
    sourceWindowEnd: args.request.endDate,
    idempotencyKey: idempotencyKey(sourceName, args.request),
    runKind: 'manual',
    scopeKey: scopeKey(args.request),
    metadata: requestMetadata(args.sourceGroup, args.request),
  };
};

const jsonChecksum = (value: JsonObject): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const toJsonLines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const tailLines = (value: string, count = 12): string[] => {
  const lines = toJsonLines(value);
  return lines.slice(Math.max(lines.length - count, 0));
};

const redactSensitiveText = (value: string): string =>
  value
    .replace(
      /((?:access|refresh|client|service[_-]?role)[_-]?token["'=:\s]+)([^\s'",]+)/gi,
      '$1[REDACTED]'
    )
    .replace(/(authorization:\s*bearer\s+)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/("?(?:secret|password)"?\s*[:=]\s*")([^"]+)(")/gi, '$1[REDACTED]$3');

const shouldStreamCommandOutput = (streamOutput?: boolean): boolean =>
  streamOutput === true || process.env.GITHUB_ACTIONS === 'true';

const parseLineValue = (text: string, label: string): string | null => {
  const match = text.match(new RegExp(`^${label}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim() ?? null;
};

const parseNumberLine = (text: string, label: string): number | null => {
  const raw = parseLineValue(text, label);
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) ? value : null;
};

const buildCommandStep = (
  name: string,
  result: CommandResult,
  extra: JsonObject = {}
): DailyBatchStepResult => ({
  name,
  status: 'success',
  summary: {
    command: [result.command, ...result.args].join(' '),
    duration_ms: result.durationMs,
    stdout_tail: result.stdoutTail.slice(-8),
    ...extra,
  },
});

const buildFailedCommandStep = (
  name: string,
  error: DailyBatchGateError
): DailyBatchStepResult => ({
  name,
  status: 'failed',
  summary: {
    code: error.code,
    message: error.message,
    ...(error.metadata ?? {}),
  },
});

const buildSkippedCommandStep = (
  name: string,
  summary: JsonObject
): DailyBatchStepResult => ({
  name,
  status: 'skipped',
  summary,
});

const runCommand = async (
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  options: CommandRunOptions = {}
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const startedAt = new Date().toISOString();
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let finished = false;
    const streamOutput = shouldStreamCommandOutput(options.streamOutput);
    const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
    const timer = setTimeout(() => {
      if (finished) return;
      child.kill('SIGTERM');
    }, timeoutMs);

    const appendChunk = (
      streamName: 'stderr' | 'stdout',
      chunk: string
    ): void => {
      const safeChunk = redactSensitiveText(chunk);
      if (streamName === 'stdout') {
        stdout += safeChunk;
        if (streamOutput) process.stdout.write(safeChunk);
      } else {
        stderr += safeChunk;
        if (streamOutput) process.stderr.write(safeChunk);
      }
    };

    child.stdout.on('data', (chunk) => {
      appendChunk('stdout', String(chunk));
    });
    child.stderr.on('data', (chunk) => {
      appendChunk('stderr', String(chunk));
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      finished = true;
      clearTimeout(timer);
      const finishedAt = new Date().toISOString();
      const durationMs =
        new Date(finishedAt).getTime() - new Date(startedAt).getTime();
      const timedOut = signal === 'SIGTERM' && code === null;
      const result: CommandResult = {
        command,
        args,
        exitCode: code ?? 1,
        status: timedOut ? 'timed_out' : code === 0 ? 'success' : 'failed',
        startedAt,
        finishedAt,
        durationMs,
        stdout,
        stderr,
        stdoutTail: tailLines(stdout, 200),
        stderrTail: tailLines(stderr, 200),
        errorMessage:
          timedOut
            ? `${[command, ...args].join(' ')} timed out after ${timeoutMs}ms`
            : code === 0
            ? null
            : `${[command, ...args].join(' ')} exited with code ${code}`,
      };
      if (code === 0 && !timedOut) {
        resolve(result);
        return;
      }
      reject(
        new DailyBatchGateError({
          code: timedOut ? 'command_timed_out' : 'command_failed',
          message: result.errorMessage ?? 'Command failed.',
          metadata: {
            command: [command, ...args].join(' '),
            args,
            source_name: options.sourceName ?? null,
            target_name: options.targetName ?? null,
            stdout_tail: result.stdoutTail,
            stderr_tail: result.stderrTail,
            exit_code: code,
            status: result.status,
            duration_ms: durationMs,
            started_at: startedAt,
            finished_at: finishedAt,
          },
        })
      );
    });
  });

const runNpmScript = async (
  scriptName: string,
  scriptArgs: string[],
  request: DailyBatchGateRequest,
  options: CommandRunOptions = {}
): Promise<CommandResult> => {
  const args =
    scriptArgs.length > 0
      ? ['run', scriptName, '--', ...scriptArgs]
      : ['run', scriptName];

  return runCommand('npm', args, {
    ...process.env,
    APP_ACCOUNT_ID: request.accountId,
    APP_MARKETPLACE: request.marketplace,
  }, options);
};

export const runRealRetailDailyBatch: DailyBatchSourceExecutor = async (
  request
) => {
  return runRealRetailDailyBatchWithOptions(request, {});
};

export const runRealRetailDailyBatchWithOptions = async (
  request: DailyBatchGateRequest,
  options: { retailReportId?: string | null }
): Promise<DailyBatchSourceExecutionSuccess> => {
  const steps: DailyBatchStepResult[] = [];
  let reportId = options.retailReportId?.trim() ?? '';
  const usingOperatorReportId = reportId.length > 0;

  const recordStep = (name: string, result: CommandResult, extra: JsonObject = {}) => {
    steps.push(buildCommandStep(name, result, extra));
  };

  try {
    if (!reportId) {
      const requestResult = await runNpmScript('spapi:first-report-request', [], request);
      reportId = parseLineValue(requestResult.stdout, 'Report ID') ?? '';
      if (!reportId) {
        throw new DailyBatchGateError({
          code: 'retail_report_id_missing',
          message: 'SP-API first report request did not print a Report ID.',
          steps,
        });
      }
      recordStep('spapi:first-report-request', requestResult, { report_id: reportId });
    } else {
      steps.push({
        name: 'spapi:first-report-request',
        status: 'skipped',
        summary: {
          reason: 'operator_supplied_report_id',
          report_id: reportId,
        },
      });
    }

    if (usingOperatorReportId) {
      steps.push({
        name: 'spapi:poll-first-report',
        status: 'skipped',
        summary: {
          reason: 'operator_supplied_report_id_local_artifact_reuse',
          report_id: reportId,
        },
      });
      steps.push({
        name: 'spapi:get-first-report-document',
        status: 'skipped',
        summary: {
          reason: 'operator_supplied_report_id_local_artifact_reuse',
          report_id: reportId,
        },
      });
    } else {
      const statusResult = await runNpmScript(
        'spapi:poll-first-report',
        ['--report-id', reportId],
        request
      );
      const processingStatus = parseLineValue(
        statusResult.stdout,
        'Processing status'
      );
      recordStep('spapi:poll-first-report', statusResult, {
        processing_status: processingStatus,
        report_document_id: parseLineValue(statusResult.stdout, 'Report document ID'),
      });

      if (processingStatus !== 'DONE') {
        throw new DailyBatchGateError({
          code: 'retail_report_not_done',
          message: `SP-API first report did not reach DONE. Status: ${processingStatus ?? 'unknown'}`,
          steps,
        });
      }

      const documentResult = await runNpmScript(
        'spapi:get-first-report-document',
        ['--report-id', reportId],
        request
      );
      recordStep('spapi:get-first-report-document', documentResult, {
        output_file: parseLineValue(documentResult.stdout, 'Output file'),
        stored_bytes: parseNumberLine(documentResult.stdout, 'Stored bytes'),
      });
    }

    const parseResult = await runNpmScript(
      'spapi:parse-first-report',
      ['--report-id', reportId],
      request
    );
    recordStep('spapi:parse-first-report', parseResult, {
      parsed_artifact: parseLineValue(parseResult.stdout, 'Parsed artifact'),
      total_row_count: parseNumberLine(parseResult.stdout, 'Total row count'),
    });

    const handoffResult = await runNpmScript(
      'spapi:build-first-report-handoff',
      ['--report-id', reportId],
      request
    );
    recordStep('spapi:build-first-report-handoff', handoffResult, {
      handoff_artifact: parseLineValue(handoffResult.stdout, 'Handoff artifact'),
      total_row_count: parseNumberLine(handoffResult.stdout, 'Total row count'),
    });

    const stageResult = await runNpmScript(
      'spapi:ingest-first-report-local-stage',
      ['--report-id', reportId],
      request
    );
    recordStep('spapi:ingest-first-report-local-stage', stageResult, {
      staging_artifact: parseLineValue(stageResult.stdout, 'Staging artifact'),
      total_row_count: parseNumberLine(stageResult.stdout, 'Total row count'),
    });

    const canonicalResult = await runNpmScript(
      'spapi:ingest-first-report-canonical',
      ['--report-id', reportId],
      request
    );
    recordStep('spapi:ingest-first-report-canonical', canonicalResult, {
      canonical_ingest_artifact: parseLineValue(
        canonicalResult.stdout,
        'Canonical ingest artifact'
      ),
      total_row_count: parseNumberLine(canonicalResult.stdout, 'Total row count'),
    });

    const warehouseReadyResult = await runNpmScript(
      'spapi:promote-first-report-warehouse-ready',
      ['--report-id', reportId],
      request
    );
    const rowCount =
      parseNumberLine(warehouseReadyResult.stdout, 'Total row count') ?? 0;
    const metadata: JsonObject = {
      source_group: 'retail',
      report_id: reportId,
      terminal_artifact: parseLineValue(
        warehouseReadyResult.stdout,
        'Warehouse-ready artifact'
      ),
      requested_range: {
        start_date: request.startDate,
        end_date: request.endDate,
      },
      steps,
    };
    recordStep('spapi:promote-first-report-warehouse-ready', warehouseReadyResult, {
      warehouse_ready_artifact: metadata.terminal_artifact ?? null,
      total_row_count: rowCount,
    });

    metadata.steps = steps;

    return {
      rowCount,
      checksum: jsonChecksum(metadata),
      metadata,
      steps,
    };
  } catch (error) {
    if (error instanceof DailyBatchGateError) {
      throw new DailyBatchGateError({
        code: error.code,
        message: error.message,
        metadata: error.metadata,
        steps: error.steps ?? steps,
      });
    }
    throw new DailyBatchGateError({
      code: 'retail_execution_failed',
      message: error instanceof Error ? error.message : 'Retail execution failed.',
      steps,
    });
  }
};

export const runRealAdsDailyBatch = async (
  request: DailyBatchGateRequest,
  options: { diagnose?: boolean; timeoutMs?: number } = {}
) => {
  const steps: DailyBatchStepResult[] = [];
  const commandOptions: CommandRunOptions = {
    sourceName: 'ads',
    streamOutput: options.diagnose,
    timeoutMs: options.timeoutMs,
  };

  const runStep = async (
    name: string,
    scriptName: string,
    args: string[] = [],
    extra: (result: CommandResult) => JsonObject = () => ({})
  ) => {
    try {
      const result = await runNpmScript(scriptName, args, request, {
        ...commandOptions,
        targetName: name,
      });
      const step = buildCommandStep(name, result, extra(result));
      steps.push(step);
      return result;
    } catch (error) {
      if (error instanceof DailyBatchGateError) {
        steps.push(buildFailedCommandStep(name, error));
      }
      throw error;
    }
  };

  const runOptionalStep = async (
    name: string,
    scriptName: string,
    args: string[] = [],
    extra: (result: CommandResult) => JsonObject = () => ({})
  ): Promise<
    | { ok: true; result: CommandResult }
    | { ok: false; error: DailyBatchGateError }
  > => {
    try {
      const result = await runStep(name, scriptName, args, extra);
      return { ok: true, result };
    } catch (error) {
      if (error instanceof DailyBatchGateError) {
        return { ok: false, error };
      }
      throw error;
    }
  };

  const isPendingStepError = (error: DailyBatchGateError): boolean => {
    const stdoutTail = Array.isArray(error.metadata?.stdout_tail)
      ? error.metadata.stdout_tail.filter((value): value is string => typeof value === 'string')
      : [];
    const stderrTail = Array.isArray(error.metadata?.stderr_tail)
      ? error.metadata.stderr_tail.filter((value): value is string => typeof value === 'string')
      : [];
    const combined = [error.message, ...stdoutTail, ...stderrTail].join('\n');
    return combined.includes('pending_timeout') || combined.includes('remained pending');
  };

  const extractReportId = (error: DailyBatchGateError): string | null => {
    const stdoutTail = Array.isArray(error.metadata?.stdout_tail)
      ? error.metadata.stdout_tail.filter((value): value is string => typeof value === 'string')
      : [];
    const stderrTail = Array.isArray(error.metadata?.stderr_tail)
      ? error.metadata.stderr_tail.filter((value): value is string => typeof value === 'string')
      : [];
    const combined = [error.message, ...stdoutTail, ...stderrTail].join('\n');
    return combined.match(/report_id=([0-9a-fA-F-]{8,})/)?.[1] ?? null;
  };

  try {
    await runStep('adsapi:sync-profiles', 'adsapi:sync-profiles', [], (result) => ({
      selected_profile_id: parseLineValue(result.stdout, 'Selected profile id'),
      artifact_path: parseLineValue(result.stdout, 'Artifact path'),
    }));
    const campaignPull = await runOptionalStep(
      'adsapi:pull-sp-campaign-daily',
      'adsapi:pull-sp-campaign-daily',
      [
        '--start-date',
        request.startDate,
        '--end-date',
        request.endDate,
        ...(request.resumePending ? ['--resume-pending'] : []),
      ],
      (result) => ({
        row_count: parseNumberLine(result.stdout, 'Row count'),
        normalized_artifact_path: parseLineValue(
          result.stdout,
          'Normalized artifact path'
        ),
      })
    );
    const targetPull = await runOptionalStep(
      'adsapi:pull-sp-target-daily',
      'adsapi:pull-sp-target-daily',
      [
        '--start-date',
        request.startDate,
        '--end-date',
        request.endDate,
        ...(request.resumePending ? ['--resume-pending'] : []),
      ],
      (result) => ({
        row_count: parseNumberLine(result.stdout, 'Row count'),
        normalized_artifact_path: parseLineValue(
          result.stdout,
          'Normalized artifact path'
        ),
      })
    );
    const placementPull = await runOptionalStep(
      'adsapi:pull-sp-placement-daily',
      'adsapi:pull-sp-placement-daily',
      [
        '--start-date',
        request.startDate,
        '--end-date',
        request.endDate,
        ...(request.resumePending ? ['--resume-pending'] : []),
      ],
      (result) => ({
        row_count: parseNumberLine(result.stdout, 'Row count'),
        normalized_artifact_path: parseLineValue(
          result.stdout,
          'Normalized artifact path'
        ),
      })
    );
    const advertisedProductPull = await runOptionalStep(
      'adsapi:pull-sp-advertised-product-daily',
      'adsapi:pull-sp-advertised-product-daily',
      [
        '--start-date',
        request.startDate,
        '--end-date',
        request.endDate,
        ...(request.resumePending ? ['--resume-pending'] : []),
      ],
      (result) => ({
        row_count: parseNumberLine(result.stdout, 'Row count'),
        normalized_artifact_path: parseLineValue(
          result.stdout,
          'Normalized artifact path'
        ),
      })
    );
    const allPullsReady =
      campaignPull.ok && targetPull.ok && placementPull.ok;

    const persist = allPullsReady
      ? await runOptionalStep(
          'adsapi:persist-sp-daily',
          'adsapi:persist-sp-daily',
          [],
          (result) => ({
            campaign_row_count: parseNumberLine(result.stdout, 'Campaign row count'),
            target_row_count: parseNumberLine(result.stdout, 'Target row count'),
            placement_row_count: parseNumberLine(result.stdout, 'Placement row count'),
            normalization_artifact_path: parseLineValue(
              result.stdout,
              'Normalization artifact path'
            ),
          })
        )
      : (steps.push(
          buildSkippedCommandStep('adsapi:persist-sp-daily', {
            reason: 'waiting_for_all_reports',
            message:
              'Shared SP persistence skipped because not all required SP reports are ready yet.',
          })
        ),
        null);

    const campaignArtifactPath =
      campaignPull.ok
        ? parseLineValue(campaignPull.result.stdout, 'Normalized artifact path')
        : null;
    const targetArtifactPath =
      targetPull.ok
        ? parseLineValue(targetPull.result.stdout, 'Normalized artifact path')
        : null;
    const placementArtifactPath =
      placementPull.ok
        ? parseLineValue(placementPull.result.stdout, 'Normalized artifact path')
        : null;
    const advertisedProductArtifactPath =
      advertisedProductPull.ok
        ? parseLineValue(
            advertisedProductPull.result.stdout,
            'Normalized artifact path'
          )
        : null;

    const campaignIngest = campaignPull.ok
      ? await runOptionalStep(
          'adsapi:ingest-sp-campaign-daily',
          'adsapi:ingest-sp-campaign-daily',
          campaignArtifactPath ? ['--artifact-path', campaignArtifactPath] : [],
          (result) => ({
            campaign_row_count: parseNumberLine(result.stdout, 'Campaign row count'),
            upload_id: parseLineValue(result.stdout, 'Upload id'),
          })
        )
      : (steps.push(
          buildSkippedCommandStep('adsapi:ingest-sp-campaign-daily', {
            reason: 'upstream_pull_not_ready',
            message:
              'Campaign ingest skipped because the SP campaign report is not ready yet.',
          })
        ),
        null);
    const targetIngest = targetPull.ok
      ? await runOptionalStep(
          'adsapi:ingest-sp-target-daily',
          'adsapi:ingest-sp-target-daily',
          targetArtifactPath ? ['--artifact-path', targetArtifactPath] : [],
          (result) => ({
            target_row_count: parseNumberLine(result.stdout, 'Target row count'),
            upload_id: parseLineValue(result.stdout, 'Upload id'),
          })
        )
      : (steps.push(
          buildSkippedCommandStep('adsapi:ingest-sp-target-daily', {
            reason: 'upstream_pull_not_ready',
            message:
              'Target ingest skipped because the SP target report is not ready yet.',
          })
        ),
        null);
    const placementIngest = placementPull.ok
      ? await runOptionalStep(
          'adsapi:ingest-sp-placement-daily',
          'adsapi:ingest-sp-placement-daily',
          placementArtifactPath ? ['--artifact-path', placementArtifactPath] : [],
          (result) => ({
            placement_row_count: parseNumberLine(result.stdout, 'Placement row count'),
            upload_id: parseLineValue(result.stdout, 'Upload id'),
          })
        )
      : (steps.push(
          buildSkippedCommandStep('adsapi:ingest-sp-placement-daily', {
            reason: 'upstream_pull_not_ready',
            message:
              'Placement ingest skipped because the SP placement report is not ready yet.',
          })
        ),
        null);
    const advertisedProductIngest = advertisedProductPull.ok
      ? await runOptionalStep(
          'adsapi:ingest-sp-advertised-product-daily',
          'adsapi:ingest-sp-advertised-product-daily',
          advertisedProductArtifactPath
            ? ['--artifact-path', advertisedProductArtifactPath]
            : [],
          (result) => ({
            advertised_product_row_count: parseNumberLine(
              result.stdout,
              'Advertised product row count'
            ),
            upload_id: parseLineValue(result.stdout, 'Upload id'),
          })
        )
      : (steps.push(
          buildSkippedCommandStep('adsapi:ingest-sp-advertised-product-daily', {
            reason: 'upstream_pull_not_ready',
            message:
              'Advertised product ingest skipped because the SP advertised product report is not ready yet.',
          })
        ),
        null);

    const campaignRowCount =
      (campaignIngest && campaignIngest.ok
        ? parseNumberLine(campaignIngest.result.stdout, 'Campaign row count')
        : null) ??
      (persist && persist.ok
        ? parseNumberLine(persist.result.stdout, 'Campaign row count')
        : null) ??
      (campaignPull.ok
        ? parseNumberLine(campaignPull.result.stdout, 'Row count')
        : null) ??
      0;
    const targetRowCount =
      (targetIngest && targetIngest.ok
        ? parseNumberLine(targetIngest.result.stdout, 'Target row count')
        : null) ??
      (persist && persist.ok
        ? parseNumberLine(persist.result.stdout, 'Target row count')
        : null) ??
      (targetPull.ok
        ? parseNumberLine(targetPull.result.stdout, 'Row count')
        : null) ??
      0;
    const placementRowCount =
      (placementIngest && placementIngest.ok
        ? parseNumberLine(placementIngest.result.stdout, 'Placement row count')
        : null) ??
      (persist && persist.ok
        ? parseNumberLine(persist.result.stdout, 'Placement row count')
        : null) ??
      (placementPull.ok
        ? parseNumberLine(placementPull.result.stdout, 'Row count')
        : null) ??
      0;
    const advertisedProductRowCount =
      (advertisedProductIngest && advertisedProductIngest.ok
        ? parseNumberLine(
            advertisedProductIngest.result.stdout,
            'Advertised product row count'
          )
        : null) ??
      (advertisedProductPull.ok
        ? parseNumberLine(advertisedProductPull.result.stdout, 'Row count')
        : null) ??
      0;

    const pullOutcomes = [
      {
        sourceType: 'ads_api_sp_campaign_daily',
        label: 'SP campaign daily',
        outcome: campaignPull,
      },
      {
        sourceType: 'ads_api_sp_target_daily',
        label: 'SP target daily',
        outcome: targetPull,
      },
      {
        sourceType: 'ads_api_sp_placement_daily',
        label: 'SP placement daily',
        outcome: placementPull,
      },
      {
        sourceType: 'ads_api_sp_advertised_product_daily',
        label: 'SP advertised product daily',
        outcome: advertisedProductPull,
      },
    ];
    const pendingSources = pullOutcomes
      .filter(
        (
          entry
        ): entry is {
          sourceType: string;
          label: string;
          outcome: { ok: false; error: DailyBatchGateError };
        } => !entry.outcome.ok && isPendingStepError(entry.outcome.error)
      )
      .map((entry) => ({
        source_type: entry.sourceType,
        label: entry.label,
        report_id: extractReportId(entry.outcome.error),
      }));
    const failedSources = pullOutcomes
      .filter(
        (
          entry
        ): entry is {
          sourceType: string;
          label: string;
          outcome: { ok: false; error: DailyBatchGateError };
        } => !entry.outcome.ok && !isPendingStepError(entry.outcome.error)
      )
      .map((entry) => ({
        source_type: entry.sourceType,
        label: entry.label,
        message: entry.outcome.error.message,
      }));

    const metadata: JsonObject = {
      source_group: 'ads',
      requested_range: {
        start_date: request.startDate,
        end_date: request.endDate,
      },
      profile_id:
        (campaignPull.ok
          ? parseLineValue(campaignPull.result.stdout, 'Validated profile id')
          : null) ??
        (targetPull.ok
          ? parseLineValue(targetPull.result.stdout, 'Validated profile id')
          : null) ??
        (placementPull.ok
          ? parseLineValue(placementPull.result.stdout, 'Validated profile id')
          : null) ??
        (advertisedProductPull.ok
          ? parseLineValue(
              advertisedProductPull.result.stdout,
              'Validated profile id'
            )
          : null),
      campaign_row_count: campaignRowCount,
      target_row_count: targetRowCount,
      placement_row_count: placementRowCount,
      advertised_product_row_count: advertisedProductRowCount,
      campaign_upload_id:
        campaignIngest && campaignIngest.ok
          ? parseLineValue(campaignIngest.result.stdout, 'Upload id')
          : null,
      target_upload_id:
        targetIngest && targetIngest.ok
          ? parseLineValue(targetIngest.result.stdout, 'Upload id')
          : null,
      placement_upload_id:
        placementIngest && placementIngest.ok
          ? parseLineValue(placementIngest.result.stdout, 'Upload id')
          : null,
      advertised_product_upload_id:
        advertisedProductIngest && advertisedProductIngest.ok
          ? parseLineValue(advertisedProductIngest.result.stdout, 'Upload id')
          : null,
      pending_sources: pendingSources,
      failed_sources: failedSources,
      persist_status:
        persist === null ? 'skipped' : persist.ok ? 'success' : 'failed',
      steps,
    };

    return {
      rowCount:
        (campaignIngest && campaignIngest.ok ? campaignRowCount : 0) +
        (targetIngest && targetIngest.ok ? targetRowCount : 0) +
        (placementIngest && placementIngest.ok ? placementRowCount : 0) +
        (advertisedProductIngest && advertisedProductIngest.ok
          ? advertisedProductRowCount
          : 0),
      checksum: jsonChecksum(metadata),
      metadata,
      steps,
    };
  } catch (error) {
    if (error instanceof DailyBatchGateError) {
      throw new DailyBatchGateError({
        code: error.code,
        message: error.message,
        metadata: error.metadata,
        steps,
      });
    }
    throw new DailyBatchGateError({
      code: 'ads_execution_failed',
      message: error instanceof Error ? error.message : 'Ads execution failed.',
      steps,
    });
  }
};

const sourceNotRun = (source: 'retail' | 'ads'): DailyBatchGateSourceResult => ({
  source,
  jobResult: 'not_run',
  job: null,
  watermark: null,
  executorInvoked: false,
  steps: [],
});

const buildExecutor = (
  sourceGroup: 'retail' | 'ads',
  request: DailyBatchGateRequest,
  sourceExecutor: DailyBatchSourceExecutor
) => async (): Promise<IngestionExecutorResult> => {
  try {
    const result = await sourceExecutor(request);
    return {
      outcome: 'success',
      rowCount: result.rowCount,
      checksum: result.checksum ?? jsonChecksum(result.metadata),
      retrievedAt: result.retrievedAt,
      metadata: {
        ...result.metadata,
        source_group: sourceGroup,
        gate_source_steps: result.steps,
      },
    };
  } catch (error) {
    const gateError =
      error instanceof DailyBatchGateError
        ? error
        : new DailyBatchGateError({
            code: `${sourceGroup}_execution_failed`,
            message:
              error instanceof Error
                ? error.message
                : `${sourceGroup} execution failed.`,
          });

    return {
      outcome: 'failure',
      errorCode: gateError.code,
      errorMessage: gateError.message,
      metadata: {
        ...(gateError.metadata ?? {}),
        source_group: sourceGroup,
        failure_reason: gateError.message,
        gate_source_steps: gateError.steps ?? [],
      },
    };
  }
};

const toSourceResult = (
  source: 'retail' | 'ads',
  runResult: IngestionJobRunResult
): DailyBatchGateSourceResult => ({
  source,
  jobResult: runResult.result,
  job: runResult.job,
  watermark: runResult.watermark,
  executorInvoked: runResult.executorInvoked,
  steps:
    ((runResult.job.metadata.gate_source_steps as unknown as
      | DailyBatchStepResult[]
      | undefined) ?? []),
});

export async function runDailyBatchGate(
  options: DailyBatchGateOptions
): Promise<DailyBatchGateResult> {
  const request = normalizeRequest(options.request);
  const repository = options.repository ?? new InMemoryIngestionJobRepository();
  const createJobId = options.createJobId;
  const now = options.now;

  const retailExecutor =
    options.retailExecutor ??
    ((gateRequest) =>
      runRealRetailDailyBatchWithOptions(gateRequest, {
        retailReportId: options.realExecutorOptions?.retailReportId,
      }));
  const adsExecutor = options.adsExecutor ?? runRealAdsDailyBatch;

  const retailRunner = new IngestionJobRunner({
    repository,
    now,
    createJobId,
    executor: buildExecutor('retail', request, retailExecutor),
  });

  const retailRun = await retailRunner.submitJob(
    buildDailyBatchSourceJobRequest({ sourceGroup: 'retail', request })
  );
  const retail = toSourceResult('retail', retailRun);

  if (retailRun.job.processing_status !== 'available') {
    return {
      ok: false,
      request,
      retail,
      ads: sourceNotRun('ads'),
      error: {
        source: 'retail',
        code: retailRun.job.error_code ?? 'retail_failed',
        message: retailRun.job.error_message ?? 'Retail daily batch failed.',
      },
    };
  }

  const adsRunner = new IngestionJobRunner({
    repository,
    now,
    createJobId,
    executor: buildExecutor('ads', request, adsExecutor),
  });
  const adsRun = await adsRunner.submitJob(
    buildDailyBatchSourceJobRequest({ sourceGroup: 'ads', request })
  );
  const ads = toSourceResult('ads', adsRun);

  if (adsRun.job.processing_status !== 'available') {
    return {
      ok: false,
      request,
      retail,
      ads,
      error: {
        source: 'ads',
        code: adsRun.job.error_code ?? 'ads_failed',
        message: adsRun.job.error_message ?? 'Ads daily batch failed.',
      },
    };
  }

  return {
    ok: true,
    request,
    retail,
    ads,
    error: null,
  };
}

const formatSourceSummary = (result: DailyBatchGateSourceResult): string[] => {
  const label = result.source === 'retail' ? 'retail_daily' : 'ads_daily';
  const metadata = result.job?.metadata ?? {};
  return [
    `${label}.job_result=${result.jobResult}`,
    `${label}.job_id=${result.job?.id ?? 'none'}`,
    `${label}.status=${result.job?.processing_status ?? 'not_run'}`,
    `${label}.executor_invoked=${result.executorInvoked ? 'yes' : 'no'}`,
    `${label}.row_count=${result.job?.row_count ?? 'null'}`,
    `${label}.checksum=${result.job?.checksum ?? 'null'}`,
    `${label}.watermark_status=${result.watermark?.status ?? 'none'}`,
    `${label}.watermark_last_job_id=${result.watermark?.last_job_id ?? 'none'}`,
    `${label}.error_code=${result.job?.error_code ?? 'null'}`,
    `${label}.failure_reason=${result.job?.error_message ?? 'null'}`,
    `${label}.step_count=${
      (
        (metadata.gate_source_steps as unknown as
          | DailyBatchStepResult[]
          | undefined) ?? []
      ).length
    }`,
  ];
};

export function summarizeDailyBatchGate(result: DailyBatchGateResult): string {
  return [
    'Stage 3 daily batch gate completed.',
    `ok=${result.ok ? 'yes' : 'no'}`,
    `account_id=${result.request.accountId}`,
    `marketplace=${result.request.marketplace}`,
    `start_date=${result.request.startDate}`,
    `end_date=${result.request.endDate}`,
    ...formatSourceSummary(result.retail),
    ...formatSourceSummary(result.ads),
    `error_source=${result.error?.source ?? 'none'}`,
    `error_code=${result.error?.code ?? 'none'}`,
    `error_message=${result.error?.message ?? 'none'}`,
  ].join('\n');
}

export const createStubDailyBatchSourceExecutor = (args: {
  sourceGroup: 'retail' | 'ads';
  rowCount?: number;
  checksum?: string;
  fail?: {
    code: string;
    message: string;
  };
}): { executor: DailyBatchSourceExecutor; getCallCount: () => number } => {
  let callCount = 0;
  return {
    executor: async (request) => {
      callCount += 1;
      if (args.fail) {
        throw new DailyBatchGateError({
          code: args.fail.code,
          message: args.fail.message,
          steps: [
            {
              name: `${args.sourceGroup}:stub`,
              status: 'failed',
              summary: {
                account_id: request.accountId,
                marketplace: request.marketplace,
              },
            },
          ],
        });
      }

      const rowCount = args.rowCount ?? (args.sourceGroup === 'retail' ? 3 : 5);
      const metadata: JsonObject = {
        source_group: args.sourceGroup,
        stub: true,
        requested_range: {
          start_date: request.startDate,
          end_date: request.endDate,
        },
      };
      return {
        rowCount,
        checksum:
          args.checksum ?? `${args.sourceGroup}-stub-${request.startDate}-${request.endDate}`,
        metadata,
        steps: [
          {
            name: `${args.sourceGroup}:stub`,
            status: 'success',
            summary: {
              row_count: rowCount,
              account_id: request.accountId,
              marketplace: request.marketplace,
            },
          },
        ],
      };
    },
    getCallCount: () => callCount,
  };
};
