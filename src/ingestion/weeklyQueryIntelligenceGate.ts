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

export const WEEKLY_QUERY_INTELLIGENCE_SQP_SOURCE_NAME =
  'stage3_sqp_weekly';
export const WEEKLY_QUERY_INTELLIGENCE_SEARCH_TERMS_SOURCE_NAME =
  'stage3_search_terms_weekly';
export const WEEKLY_QUERY_INTELLIGENCE_SQP_JOB_KEY =
  'stage3_weekly_sqp';
export const WEEKLY_QUERY_INTELLIGENCE_SEARCH_TERMS_JOB_KEY =
  'stage3_weekly_search_terms';

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export interface WeeklyQueryIntelligenceGateRequest {
  accountId: string;
  marketplace: string;
  startDate: string;
  endDate: string;
  asin?: string | null;
  marketplaceId?: string | null;
}

export interface WeeklyQueryIntelligenceStepResult extends JsonObject {
  name: string;
  status: 'success' | 'failed';
  summary: JsonObject;
}

export interface WeeklyQueryIntelligenceSourceExecutionSuccess {
  rowCount: number;
  checksum?: string | null;
  retrievedAt?: string | null;
  metadata: JsonObject;
  steps: WeeklyQueryIntelligenceStepResult[];
}

export type WeeklyQueryIntelligenceSourceExecutor = (
  request: WeeklyQueryIntelligenceGateRequest
) => Promise<WeeklyQueryIntelligenceSourceExecutionSuccess>;

export interface WeeklyQueryIntelligenceGateSourceResult {
  source: 'sqp' | 'search_terms';
  jobResult: IngestionJobRunResult['result'] | 'not_run';
  job: IngestionJobRunResult['job'] | null;
  watermark: IngestionJobRunResult['watermark'];
  executorInvoked: boolean;
  steps: WeeklyQueryIntelligenceStepResult[];
}

export interface WeeklyQueryIntelligenceGateResult {
  ok: boolean;
  request: WeeklyQueryIntelligenceGateRequest;
  sqp: WeeklyQueryIntelligenceGateSourceResult;
  searchTerms: WeeklyQueryIntelligenceGateSourceResult;
  error: {
    source: 'sqp' | 'search_terms';
    code: string;
    message: string;
  } | null;
}

export interface WeeklyQueryIntelligenceGateOptions {
  request: WeeklyQueryIntelligenceGateRequest;
  repository?: IngestionJobRepository;
  sqpExecutor?: WeeklyQueryIntelligenceSourceExecutor;
  searchTermsExecutor?: WeeklyQueryIntelligenceSourceExecutor;
  now?: () => string;
  createJobId?: () => string;
}

interface CommandResult {
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
}

class WeeklyQueryIntelligenceGateError extends Error {
  readonly code: string;
  readonly metadata?: JsonObject;
  readonly steps?: WeeklyQueryIntelligenceStepResult[];

  constructor(args: {
    code: string;
    message: string;
    metadata?: JsonObject;
    steps?: WeeklyQueryIntelligenceStepResult[];
  }) {
    super(args.message);
    this.name = 'WeeklyQueryIntelligenceGateError';
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

const normalizeOptional = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
};

const normalizeRequest = (
  request: WeeklyQueryIntelligenceGateRequest
): WeeklyQueryIntelligenceGateRequest => {
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
    asin: normalizeOptional(request.asin),
    marketplaceId: normalizeOptional(request.marketplaceId),
  };
};

const scopeKey = (
  sourceGroup: 'sqp' | 'search_terms',
  request: WeeklyQueryIntelligenceGateRequest
): string =>
  sourceGroup === 'sqp'
    ? `weekly:${request.marketplace}:asin:${request.asin ?? 'unspecified'}`
    : `weekly:${request.marketplace}`;

const idempotencyKey = (
  sourceGroup: 'sqp' | 'search_terms',
  sourceName: string,
  request: WeeklyQueryIntelligenceGateRequest
): string => {
  const parts = [
    'stage3',
    'weekly-query-intelligence',
    sourceName,
    request.accountId,
    request.marketplace,
    request.startDate,
    request.endDate,
  ];
  if (sourceGroup === 'sqp') {
    parts.push(request.asin ?? '');
  }
  return parts.join('/');
};

const requestMetadata = (
  sourceGroup: 'sqp' | 'search_terms',
  request: WeeklyQueryIntelligenceGateRequest
): IngestionJobRecord['metadata'] => ({
  gate: 'S3-G2',
  source_group: sourceGroup,
  account_id: request.accountId,
  marketplace: request.marketplace,
  marketplace_id: request.marketplaceId ?? null,
  asin: request.asin ?? null,
  start_date: request.startDate,
  end_date: request.endDate,
  [INGESTION_STATE_HINTS_METADATA_KEY]: {
    sourceCadence: 'weekly',
    finalizationState: 'revisable',
    sourceConfidence: 'high',
  },
});

export const buildWeeklyQueryIntelligenceJobRequest = (args: {
  sourceGroup: 'sqp' | 'search_terms';
  request: WeeklyQueryIntelligenceGateRequest;
}): IngestionJobRunRequest => {
  const sourceName =
    args.sourceGroup === 'sqp'
      ? WEEKLY_QUERY_INTELLIGENCE_SQP_SOURCE_NAME
      : WEEKLY_QUERY_INTELLIGENCE_SEARCH_TERMS_SOURCE_NAME;

  return {
    jobKey:
      args.sourceGroup === 'sqp'
        ? WEEKLY_QUERY_INTELLIGENCE_SQP_JOB_KEY
        : WEEKLY_QUERY_INTELLIGENCE_SEARCH_TERMS_JOB_KEY,
    sourceName,
    accountId: args.request.accountId,
    marketplace: args.request.marketplace,
    sourceWindowStart: args.request.startDate,
    sourceWindowEnd: args.request.endDate,
    idempotencyKey: idempotencyKey(args.sourceGroup, sourceName, args.request),
    runKind: 'manual',
    scopeKey: scopeKey(args.sourceGroup, args.request),
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

const runCommand = async (
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      const result = { command, args, stdout, stderr };
      if (code === 0) {
        resolve(result);
        return;
      }
      reject(
        new WeeklyQueryIntelligenceGateError({
          code: 'command_failed',
          message: `${[command, ...args].join(' ')} exited with code ${code}`,
          metadata: {
            command: [command, ...args].join(' '),
            stdout_tail: tailLines(stdout),
            stderr_tail: tailLines(stderr),
            exit_code: code,
          },
        })
      );
    });
  });

const runNpmScript = async (
  scriptName: string,
  scriptArgs: string[],
  request: WeeklyQueryIntelligenceGateRequest
): Promise<CommandResult> => {
  const args = ['run', scriptName, '--', ...scriptArgs];
  return runCommand('npm', args, {
    ...process.env,
    APP_ACCOUNT_ID: request.accountId,
    APP_MARKETPLACE: request.marketplace,
  });
};

const buildCommandStep = (
  name: string,
  result: CommandResult,
  extra: JsonObject
): WeeklyQueryIntelligenceStepResult => ({
  name,
  status: 'success',
  summary: {
    command: [result.command, ...result.args].join(' '),
    stdout_tail: tailLines(result.stdout, 8),
    ...extra,
  },
});

export const runRealSqpWeeklyQueryIntelligence: WeeklyQueryIntelligenceSourceExecutor =
  async (request) => {
    const asin = request.asin?.trim();
    if (!asin) {
      throw new WeeklyQueryIntelligenceGateError({
        code: 'missing_sqp_asin',
        message:
          'SQP weekly execution requires --asin because the existing Stage 2A SQP path is ASIN-scoped.',
      });
    }

    const result = await runNpmScript(
      'spapi:sqp-first-real-pull-ingest',
      [
        '--asin',
        asin,
        '--start-date',
        request.startDate,
        '--end-date',
        request.endDate,
      ],
      request
    );
    const rowCount = parseNumberLine(result.stdout, 'Row count') ?? 0;
    const metadata: JsonObject = {
      source_group: 'sqp',
      report_id: parseLineValue(result.stdout, 'Report ID'),
      report_document_id: parseLineValue(result.stdout, 'Report document ID'),
      raw_artifact: parseLineValue(result.stdout, 'Raw artifact'),
      scope_type: parseLineValue(result.stdout, 'Scope type'),
      scope_value: parseLineValue(result.stdout, 'Scope value'),
      coverage_window: parseLineValue(result.stdout, 'Coverage window'),
      upload_id: parseLineValue(result.stdout, 'Upload ID'),
      warnings_count: parseNumberLine(result.stdout, 'Warnings'),
      row_count: rowCount,
    };

    const steps = [
      buildCommandStep('spapi:sqp-first-real-pull-ingest', result, metadata),
    ];

    return {
      rowCount,
      checksum: jsonChecksum(metadata),
      metadata: {
        ...metadata,
        steps,
      },
      steps,
    };
  };

export const runRealSearchTermsWeeklyQueryIntelligence: WeeklyQueryIntelligenceSourceExecutor =
  async (request) => {
    const args = [
      '--start-date',
      request.startDate,
      '--end-date',
      request.endDate,
    ];
    if (request.marketplaceId) {
      args.unshift('--marketplace-id', request.marketplaceId);
    }

    const result = await runNpmScript(
      'spapi:search-terms-first-real-pull-ingest',
      args,
      request
    );
    const rowCount = parseNumberLine(result.stdout, 'Row count') ?? 0;
    const metadata: JsonObject = {
      source_group: 'search_terms',
      report_id: parseLineValue(result.stdout, 'Report ID'),
      report_document_id: parseLineValue(result.stdout, 'Report document ID'),
      raw_artifact: parseLineValue(result.stdout, 'Raw artifact'),
      marketplace: parseLineValue(result.stdout, 'Marketplace'),
      marketplace_id: parseLineValue(result.stdout, 'Marketplace ID'),
      coverage_window: parseLineValue(result.stdout, 'Coverage window'),
      upload_id: parseLineValue(result.stdout, 'Upload ID'),
      warnings_count: parseNumberLine(result.stdout, 'Warnings'),
      row_count: rowCount,
    };

    const steps = [
      buildCommandStep('spapi:search-terms-first-real-pull-ingest', result, metadata),
    ];

    return {
      rowCount,
      checksum: jsonChecksum(metadata),
      metadata: {
        ...metadata,
        steps,
      },
      steps,
    };
  };

const sourceNotRun = (
  source: 'sqp' | 'search_terms'
): WeeklyQueryIntelligenceGateSourceResult => ({
  source,
  jobResult: 'not_run',
  job: null,
  watermark: null,
  executorInvoked: false,
  steps: [],
});

const buildExecutor = (
  sourceGroup: 'sqp' | 'search_terms',
  request: WeeklyQueryIntelligenceGateRequest,
  sourceExecutor: WeeklyQueryIntelligenceSourceExecutor
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
      error instanceof WeeklyQueryIntelligenceGateError
        ? error
        : new WeeklyQueryIntelligenceGateError({
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
  source: 'sqp' | 'search_terms',
  runResult: IngestionJobRunResult
): WeeklyQueryIntelligenceGateSourceResult => ({
  source,
  jobResult: runResult.result,
  job: runResult.job,
  watermark: runResult.watermark,
  executorInvoked: runResult.executorInvoked,
  steps:
    ((runResult.job.metadata.gate_source_steps as unknown as
      | WeeklyQueryIntelligenceStepResult[]
      | undefined) ?? []),
});

export async function runWeeklyQueryIntelligenceGate(
  options: WeeklyQueryIntelligenceGateOptions
): Promise<WeeklyQueryIntelligenceGateResult> {
  const request = normalizeRequest(options.request);
  const repository = options.repository ?? new InMemoryIngestionJobRepository();
  const now = options.now;
  const createJobId = options.createJobId;
  const sqpExecutor = options.sqpExecutor ?? runRealSqpWeeklyQueryIntelligence;
  const searchTermsExecutor =
    options.searchTermsExecutor ?? runRealSearchTermsWeeklyQueryIntelligence;

  const sqpRunner = new IngestionJobRunner({
    repository,
    now,
    createJobId,
    executor: buildExecutor('sqp', request, sqpExecutor),
  });
  const sqpRun = await sqpRunner.submitJob(
    buildWeeklyQueryIntelligenceJobRequest({ sourceGroup: 'sqp', request })
  );
  const sqp = toSourceResult('sqp', sqpRun);

  if (sqpRun.job.processing_status !== 'available') {
    return {
      ok: false,
      request,
      sqp,
      searchTerms: sourceNotRun('search_terms'),
      error: {
        source: 'sqp',
        code: sqpRun.job.error_code ?? 'sqp_failed',
        message: sqpRun.job.error_message ?? 'SQP weekly gate failed.',
      },
    };
  }

  const searchTermsRunner = new IngestionJobRunner({
    repository,
    now,
    createJobId,
    executor: buildExecutor('search_terms', request, searchTermsExecutor),
  });
  const searchTermsRun = await searchTermsRunner.submitJob(
    buildWeeklyQueryIntelligenceJobRequest({
      sourceGroup: 'search_terms',
      request,
    })
  );
  const searchTerms = toSourceResult('search_terms', searchTermsRun);

  if (searchTermsRun.job.processing_status !== 'available') {
    return {
      ok: false,
      request,
      sqp,
      searchTerms,
      error: {
        source: 'search_terms',
        code: searchTermsRun.job.error_code ?? 'search_terms_failed',
        message:
          searchTermsRun.job.error_message ?? 'Search Terms weekly gate failed.',
      },
    };
  }

  return {
    ok: true,
    request,
    sqp,
    searchTerms,
    error: null,
  };
}

const formatSourceSummary = (
  result: WeeklyQueryIntelligenceGateSourceResult
): string[] => {
  const label = result.source === 'sqp' ? 'sqp_weekly' : 'search_terms_weekly';
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
    `${label}.upload_id=${String(metadata.upload_id ?? 'none')}`,
    `${label}.raw_artifact=${String(metadata.raw_artifact ?? 'none')}`,
    `${label}.error_code=${result.job?.error_code ?? 'null'}`,
    `${label}.failure_reason=${result.job?.error_message ?? 'null'}`,
    `${label}.step_count=${
      (
        (metadata.gate_source_steps as unknown as
          | WeeklyQueryIntelligenceStepResult[]
          | undefined) ?? []
      ).length
    }`,
  ];
};

export function summarizeWeeklyQueryIntelligenceGate(
  result: WeeklyQueryIntelligenceGateResult
): string {
  return [
    'Stage 3 weekly query-intelligence gate completed.',
    `ok=${result.ok ? 'yes' : 'no'}`,
    `account_id=${result.request.accountId}`,
    `marketplace=${result.request.marketplace}`,
    `marketplace_id=${result.request.marketplaceId ?? 'none'}`,
    `asin=${result.request.asin ?? 'none'}`,
    `start_date=${result.request.startDate}`,
    `end_date=${result.request.endDate}`,
    ...formatSourceSummary(result.sqp),
    ...formatSourceSummary(result.searchTerms),
    `error_source=${result.error?.source ?? 'none'}`,
    `error_code=${result.error?.code ?? 'none'}`,
    `error_message=${result.error?.message ?? 'none'}`,
  ].join('\n');
}

export const createStubWeeklyQueryIntelligenceExecutor = (args: {
  sourceGroup: 'sqp' | 'search_terms';
  rowCount?: number;
  checksum?: string;
  fail?: {
    code: string;
    message: string;
  };
}): {
  executor: WeeklyQueryIntelligenceSourceExecutor;
  getCallCount: () => number;
} => {
  let callCount = 0;
  return {
    executor: async (request) => {
      callCount += 1;
      if (args.fail) {
        throw new WeeklyQueryIntelligenceGateError({
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

      const rowCount = args.rowCount ?? (args.sourceGroup === 'sqp' ? 11 : 13);
      const metadata: JsonObject = {
        source_group: args.sourceGroup,
        stub: true,
        upload_id: `${args.sourceGroup}-stub-upload`,
        raw_artifact: `out/stub/${args.sourceGroup}.json`,
        requested_range: {
          start_date: request.startDate,
          end_date: request.endDate,
        },
      };
      return {
        rowCount,
        checksum:
          args.checksum ??
          `${args.sourceGroup}-stub-${request.startDate}-${request.endDate}`,
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
