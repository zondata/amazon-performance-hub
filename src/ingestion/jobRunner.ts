import { randomUUID } from 'node:crypto';

import type {
  IngestionJobRecord,
  IngestionProcessingStatus,
  IngestionRunKind,
  SourceWatermarkRecord,
} from './schemaContract';
import {
  deriveIngestionStateEnvelope,
  getIngestionStateEnvelopeFromJob,
  persistIngestionStateEnvelope,
} from './stateEnvelope';

export const INGESTION_RUN_RESULT_FLAGS = [
  'created',
  'reused_existing',
  'retried',
  'replayed',
] as const;

export type IngestionJobRunResultFlag =
  (typeof INGESTION_RUN_RESULT_FLAGS)[number];

export interface IngestionJobRunRequest {
  jobKey: string;
  sourceName: string;
  accountId: string | null;
  marketplace: string | null;
  sourceWindowStart: string | null;
  sourceWindowEnd: string | null;
  idempotencyKey: string;
  runKind: IngestionRunKind;
  scopeKey?: string;
  metadata?: IngestionJobRecord['metadata'];
}

export type IngestionExecutorResult =
  | {
      outcome: 'success';
      rowCount?: number | null;
      checksum?: string | null;
      retrievedAt?: string | null;
      metadata?: IngestionJobRecord['metadata'];
    }
  | {
      outcome: 'failure';
      errorCode: string;
      errorMessage: string;
      metadata?: IngestionJobRecord['metadata'];
    };

export interface IngestionExecutorContext {
  job: IngestionJobRecord;
  attemptNumber: number;
  operation: Exclude<IngestionJobRunResultFlag, 'reused_existing'>;
}

export type IngestionExecutor = (
  context: IngestionExecutorContext
) => Promise<IngestionExecutorResult>;

export interface IngestionJobRunResult {
  result: IngestionJobRunResultFlag;
  job: IngestionJobRecord;
  watermark: SourceWatermarkRecord | null;
  executorInvoked: boolean;
}

export interface IngestionJobRepository {
  findJobByIdempotencyKey(idempotencyKey: string): Promise<IngestionJobRecord | null>;
  findJobById(jobId: string): Promise<IngestionJobRecord | null>;
  insertJob(job: IngestionJobRecord): Promise<IngestionJobRecord>;
  updateJob(
    jobId: string,
    updater: (job: IngestionJobRecord) => IngestionJobRecord
  ): Promise<IngestionJobRecord>;
  listJobsByLineageRootIdempotencyKey(
    lineageRootIdempotencyKey: string
  ): Promise<IngestionJobRecord[]>;
  findWatermarkByScope(scope: IngestionWatermarkScope): Promise<SourceWatermarkRecord | null>;
  upsertWatermark(watermark: SourceWatermarkRecord): Promise<SourceWatermarkRecord>;
}

export interface IngestionWatermarkScope {
  sourceName: string;
  accountId: string | null;
  marketplace: string | null;
  scopeKey: string;
}

export class IngestionJobRunnerError extends Error {
  readonly code:
    | 'invalid_request'
    | 'job_not_found'
    | 'invalid_transition'
    | 'explicit_retry_required'
    | 'invalid_retry'
    | 'invalid_replay'
    | 'duplicate_job';

  constructor(
    code:
      | 'invalid_request'
      | 'job_not_found'
      | 'invalid_transition'
      | 'explicit_retry_required'
      | 'invalid_retry'
      | 'invalid_replay'
      | 'duplicate_job',
    message: string
  ) {
    super(message);
    this.name = 'IngestionJobRunnerError';
    this.code = code;
  }
}

export const INGESTION_STATUS_TRANSITIONS: Record<
  IngestionProcessingStatus,
  readonly IngestionProcessingStatus[]
> = {
  requested: ['processing'],
  processing: ['available', 'failed'],
  available: [],
  failed: ['processing'],
};

export const canTransitionIngestionJobStatus = (
  from: IngestionProcessingStatus,
  to: IngestionProcessingStatus
): boolean => INGESTION_STATUS_TRANSITIONS[from].includes(to);

export const assertIngestionJobStatusTransition = (
  from: IngestionProcessingStatus,
  to: IngestionProcessingStatus
): void => {
  if (!canTransitionIngestionJobStatus(from, to)) {
    throw new IngestionJobRunnerError(
      'invalid_transition',
      `Invalid ingestion job status transition: ${from} -> ${to}`
    );
  }
};

type RunnerMetadata = IngestionJobRecord['metadata'] & {
  request_metadata?: IngestionJobRecord['metadata'];
  lineage_root_idempotency_key?: string;
  lineage_root_job_id?: string;
  replay_of_job_id?: string | null;
  replay_sequence?: number;
  replay_count?: number;
  retry_count?: number;
  attempt_count?: number;
  status_history?: Array<{
    from: IngestionProcessingStatus | null;
    to: IngestionProcessingStatus;
    at: string;
    reason: string;
  }>;
  attempt_history?: Array<{
    attempt_number: number;
    operation: Exclude<IngestionJobRunResultFlag, 'reused_existing'>;
    at: string;
    outcome: 'success' | 'failure';
    error_code?: string;
  }>;
  last_replayed_job_id?: string;
};

interface IngestionJobRunnerOptions {
  repository: IngestionJobRepository;
  executor: IngestionExecutor;
  now?: () => string;
  createJobId?: () => string;
}

interface MutableJobFields {
  processingStatus?: IngestionProcessingStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  retrievedAt?: string | null;
  rowCount?: number | null;
  checksum?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata: RunnerMetadata;
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const asRunnerMetadata = (
  value: IngestionJobRecord['metadata'] | undefined
): RunnerMetadata => cloneJson((value ?? {}) as RunnerMetadata);

const requireTrimmed = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      `${field} must be a non-empty string`
    );
  }
  return trimmed;
};

const getAttemptCount = (job: IngestionJobRecord): number =>
  Number(asRunnerMetadata(job.metadata).attempt_count ?? 0);

const getRetryCount = (job: IngestionJobRecord): number =>
  Number(asRunnerMetadata(job.metadata).retry_count ?? 0);

const getReplayCount = (job: IngestionJobRecord): number =>
  Number(asRunnerMetadata(job.metadata).replay_count ?? 0);

const getLineageRootIdempotencyKey = (job: IngestionJobRecord): string =>
  String(
    asRunnerMetadata(job.metadata).lineage_root_idempotency_key ??
      job.idempotency_key
  );

const getLineageRootJobId = (job: IngestionJobRecord): string =>
  String(asRunnerMetadata(job.metadata).lineage_root_job_id ?? job.id);

const getScopeKey = (job: IngestionJobRecord): string =>
  String(asRunnerMetadata(job.metadata).scope_key ?? '');

const appendStatusHistory = (
  metadata: RunnerMetadata,
  entry: {
    from: IngestionProcessingStatus | null;
    to: IngestionProcessingStatus;
    at: string;
    reason: string;
  }
): RunnerMetadata => {
  const next = asRunnerMetadata(metadata);
  next.status_history = [...(next.status_history ?? []), entry];
  return next;
};

const appendAttemptHistory = (
  metadata: RunnerMetadata,
  entry: {
    attempt_number: number;
    operation: Exclude<IngestionJobRunResultFlag, 'reused_existing'>;
    at: string;
    outcome: 'success' | 'failure';
    error_code?: string;
  }
): RunnerMetadata => {
  const next = asRunnerMetadata(metadata);
  next.attempt_history = [...(next.attempt_history ?? []), entry];
  return next;
};

const mergeMetadata = (
  left: RunnerMetadata,
  right: IngestionJobRecord['metadata'] | undefined
): RunnerMetadata => ({
  ...asRunnerMetadata(left),
  ...(right ? cloneJson(right) : {}),
});

const buildInitialMetadata = (args: {
  request: IngestionJobRunRequest;
  jobId: string;
  lineageRootJobId: string;
  lineageRootIdempotencyKey: string;
  replayOfJobId: string | null;
  replaySequence: number;
  at: string;
}): RunnerMetadata => {
  const metadata: RunnerMetadata = {
    request_metadata: cloneJson(args.request.metadata ?? {}),
    scope_key: args.request.scopeKey ?? '',
    lineage_root_idempotency_key: args.lineageRootIdempotencyKey,
    lineage_root_job_id: args.lineageRootJobId,
    replay_of_job_id: args.replayOfJobId,
    replay_sequence: args.replaySequence,
    replay_count: 0,
    retry_count: 0,
    attempt_count: 0,
    status_history: [],
    attempt_history: [],
  };

  const withHistory = appendStatusHistory(metadata, {
    from: null,
    to: 'requested',
    at: args.at,
    reason: 'job_created',
  });

  return persistIngestionStateEnvelope(
    withHistory,
    deriveIngestionStateEnvelope({
      collectionState: 'requested',
      metadata: withHistory,
    })
  ) as RunnerMetadata;
};

const buildRequestedJobRecord = (args: {
  request: IngestionJobRunRequest;
  jobId: string;
  at: string;
  lineageRootJobId: string;
  lineageRootIdempotencyKey: string;
  replayOfJobId: string | null;
  replaySequence: number;
}): IngestionJobRecord => ({
  id: args.jobId,
  job_key: requireTrimmed(args.request.jobKey, 'jobKey'),
  source_name: requireTrimmed(args.request.sourceName, 'sourceName'),
  account_id: args.request.accountId,
  marketplace: args.request.marketplace,
  requested_at: args.at,
  source_window_start: args.request.sourceWindowStart,
  source_window_end: args.request.sourceWindowEnd,
  retrieved_at: null,
  started_at: null,
  finished_at: null,
  processing_status: 'requested',
  run_kind: args.request.runKind,
  idempotency_key: requireTrimmed(args.request.idempotencyKey, 'idempotencyKey'),
  checksum: null,
  row_count: null,
  error_code: null,
  error_message: null,
  metadata: buildInitialMetadata({
    request: args.request,
    jobId: args.jobId,
    lineageRootJobId: args.lineageRootJobId,
    lineageRootIdempotencyKey: args.lineageRootIdempotencyKey,
    replayOfJobId: args.replayOfJobId,
    replaySequence: args.replaySequence,
    at: args.at,
  }),
  created_at: args.at,
  updated_at: args.at,
});

export class InMemoryIngestionJobRepository implements IngestionJobRepository {
  private readonly jobsById = new Map<string, IngestionJobRecord>();
  private readonly jobsByIdempotencyKey = new Map<string, string>();
  private readonly watermarksByScope = new Map<string, SourceWatermarkRecord>();

  async findJobByIdempotencyKey(
    idempotencyKey: string
  ): Promise<IngestionJobRecord | null> {
    const jobId = this.jobsByIdempotencyKey.get(idempotencyKey);
    return jobId ? cloneJson(this.jobsById.get(jobId) ?? null) : null;
  }

  async findJobById(jobId: string): Promise<IngestionJobRecord | null> {
    return cloneJson(this.jobsById.get(jobId) ?? null);
  }

  async insertJob(job: IngestionJobRecord): Promise<IngestionJobRecord> {
    if (this.jobsByIdempotencyKey.has(job.idempotency_key)) {
      throw new IngestionJobRunnerError(
        'duplicate_job',
        `Job with idempotency key already exists: ${job.idempotency_key}`
      );
    }

    this.jobsById.set(job.id, cloneJson(job));
    this.jobsByIdempotencyKey.set(job.idempotency_key, job.id);
    return cloneJson(job);
  }

  async updateJob(
    jobId: string,
    updater: (job: IngestionJobRecord) => IngestionJobRecord
  ): Promise<IngestionJobRecord> {
    const current = this.jobsById.get(jobId);
    if (!current) {
      throw new IngestionJobRunnerError(
        'job_not_found',
        `Job not found: ${jobId}`
      );
    }

    const updated = cloneJson(updater(cloneJson(current)));
    this.jobsById.set(jobId, updated);
    this.jobsByIdempotencyKey.set(updated.idempotency_key, updated.id);
    return cloneJson(updated);
  }

  async listJobsByLineageRootIdempotencyKey(
    lineageRootIdempotencyKey: string
  ): Promise<IngestionJobRecord[]> {
    return [...this.jobsById.values()]
      .filter(
        (job) =>
          getLineageRootIdempotencyKey(job) === lineageRootIdempotencyKey
      )
      .map((job) => cloneJson(job));
  }

  async findWatermarkByScope(
    scope: IngestionWatermarkScope
  ): Promise<SourceWatermarkRecord | null> {
    return cloneJson(this.watermarksByScope.get(this.scopeKey(scope)) ?? null);
  }

  async upsertWatermark(
    watermark: SourceWatermarkRecord
  ): Promise<SourceWatermarkRecord> {
    this.watermarksByScope.set(
      this.scopeKey({
        sourceName: watermark.source_name,
        accountId: watermark.account_id,
        marketplace: watermark.marketplace,
        scopeKey: watermark.scope_key,
      }),
      cloneJson(watermark)
    );
    return cloneJson(watermark);
  }

  private scopeKey(scope: IngestionWatermarkScope): string {
    return [
      scope.sourceName,
      scope.accountId ?? '',
      scope.marketplace ?? '',
      scope.scopeKey,
    ].join('::');
  }
}

export class IngestionJobRunner {
  private readonly repository: IngestionJobRepository;
  private readonly executor: IngestionExecutor;
  private readonly now: () => string;
  private readonly createJobId: () => string;

  constructor(options: IngestionJobRunnerOptions) {
    this.repository = options.repository;
    this.executor = options.executor;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createJobId = options.createJobId ?? (() => randomUUID());
  }

  async submitJob(
    request: IngestionJobRunRequest
  ): Promise<IngestionJobRunResult> {
    this.validateRequest(request);

    const existing = await this.repository.findJobByIdempotencyKey(
      request.idempotencyKey
    );

    if (existing) {
      if (existing.processing_status === 'failed') {
        throw new IngestionJobRunnerError(
          'explicit_retry_required',
          `Job ${existing.id} failed previously and requires explicit retry or replay`
        );
      }

      return {
        result: 'reused_existing',
        job: existing,
        watermark: await this.repository.findWatermarkByScope({
          sourceName: existing.source_name,
          accountId: existing.account_id,
          marketplace: existing.marketplace,
          scopeKey: getScopeKey(existing),
        }),
        executorInvoked: false,
      };
    }

    const jobId = this.createJobId();
    const requestedAt = this.now();
    const created = await this.repository.insertJob(
      buildRequestedJobRecord({
        request,
        jobId,
        at: requestedAt,
        lineageRootJobId: jobId,
        lineageRootIdempotencyKey: request.idempotencyKey,
        replayOfJobId: null,
        replaySequence: 0,
      })
    );

    return this.executeJob(created, 'created');
  }

  async retryFailedJob(jobId: string): Promise<IngestionJobRunResult> {
    const job = await this.getJobOrThrow(jobId);
    if (job.processing_status !== 'failed') {
      throw new IngestionJobRunnerError(
        'invalid_retry',
        `Only failed jobs can be retried. Current status: ${job.processing_status}`
      );
    }

    return this.executeJob(job, 'retried');
  }

  async replayFailedJob(jobId: string): Promise<IngestionJobRunResult> {
    const sourceJob = await this.getJobOrThrow(jobId);
    if (sourceJob.processing_status !== 'failed') {
      throw new IngestionJobRunnerError(
        'invalid_replay',
        `Only failed jobs can be replayed. Current status: ${sourceJob.processing_status}`
      );
    }

    const replaySourceMetadata = asRunnerMetadata(sourceJob.metadata);
    const updatedReplaySource = await this.repository.updateJob(
      sourceJob.id,
      (current) => {
        const metadata = asRunnerMetadata(current.metadata);
        metadata.replay_count = getReplayCount(current) + 1;
        metadata.last_replayed_job_id = '';
        return {
          ...current,
          metadata,
        };
      }
    );

    const lineageRootIdempotencyKey = getLineageRootIdempotencyKey(sourceJob);
    const lineageRootJobId = getLineageRootJobId(sourceJob);
    const lineageJobs = await this.repository.listJobsByLineageRootIdempotencyKey(
      lineageRootIdempotencyKey
    );
    const replaySequence =
      lineageJobs.filter(
        (job) => asRunnerMetadata(job.metadata).replay_of_job_id != null
      ).length + 1;
    const replayIdempotencyKey = `${lineageRootIdempotencyKey}#replay:${replaySequence}`;
    const replayAt = this.now();
    const replayJobId = this.createJobId();

    const replayJob = await this.repository.insertJob(
      buildRequestedJobRecord({
        request: {
          jobKey: sourceJob.job_key,
          sourceName: sourceJob.source_name,
          accountId: sourceJob.account_id,
          marketplace: sourceJob.marketplace,
          sourceWindowStart: sourceJob.source_window_start,
          sourceWindowEnd: sourceJob.source_window_end,
          idempotencyKey: replayIdempotencyKey,
          runKind: 'replay',
          scopeKey: getScopeKey(sourceJob),
          metadata: replaySourceMetadata.request_metadata ?? {},
        },
        jobId: replayJobId,
        at: replayAt,
        lineageRootJobId,
        lineageRootIdempotencyKey,
        replayOfJobId: sourceJob.id,
        replaySequence,
      })
    );

    await this.repository.updateJob(updatedReplaySource.id, (current) => {
      const metadata = asRunnerMetadata(current.metadata);
      metadata.last_replayed_job_id = replayJob.id;
      return {
        ...current,
        metadata,
      };
    });

    return this.executeJob(replayJob, 'replayed');
  }

  private async executeJob(
    job: IngestionJobRecord,
    operation: Exclude<IngestionJobRunResultFlag, 'reused_existing'>
  ): Promise<IngestionJobRunResult> {
    const processingAt = this.now();
    const processingJob = await this.updateJobForExecution(job, {
      processingStatus: 'processing',
      startedAt: processingAt,
      metadata: this.buildProcessingMetadata(job, operation, processingAt),
    });

    const attemptNumber = getAttemptCount(processingJob);
    const executorResult = await this.executor({
      job: processingJob,
      attemptNumber,
      operation,
    });

    if (executorResult.outcome === 'success') {
      const finishedAt = this.now();
      const succeededJob = await this.updateJobForExecution(processingJob, {
        processingStatus: 'available',
        finishedAt,
        retrievedAt: executorResult.retrievedAt ?? finishedAt,
        rowCount: executorResult.rowCount ?? null,
        checksum: executorResult.checksum ?? null,
        errorCode: null,
        errorMessage: null,
        metadata: this.buildFinishedMetadata(
          processingJob,
          operation,
          'success',
          finishedAt,
          executorResult.metadata
        ),
      });

      const watermark = await this.updateWatermarkOnSuccess(succeededJob);

      return {
        result: operation,
        job: succeededJob,
        watermark,
        executorInvoked: true,
      };
    }

    const failedAt = this.now();
    const failedJob = await this.updateJobForExecution(processingJob, {
      processingStatus: 'failed',
      finishedAt: failedAt,
      errorCode: executorResult.errorCode,
      errorMessage: executorResult.errorMessage,
      metadata: this.buildFinishedMetadata(
        processingJob,
        operation,
        'failure',
        failedAt,
        executorResult.metadata,
        executorResult.errorCode
      ),
    });

    return {
      result: operation,
      job: failedJob,
      watermark: null,
      executorInvoked: true,
    };
  }

  private async updateJobForExecution(
    job: IngestionJobRecord,
    fields: MutableJobFields
  ): Promise<IngestionJobRecord> {
    return this.repository.updateJob(job.id, (current) => {
      if (fields.processingStatus) {
        assertIngestionJobStatusTransition(
          current.processing_status,
          fields.processingStatus
        );
      }

      return {
        ...current,
        processing_status: fields.processingStatus ?? current.processing_status,
        started_at:
          fields.startedAt === undefined ? current.started_at : fields.startedAt,
        finished_at:
          fields.finishedAt === undefined
            ? current.finished_at
            : fields.finishedAt,
        retrieved_at:
          fields.retrievedAt === undefined
            ? current.retrieved_at
            : fields.retrievedAt,
        row_count:
          fields.rowCount === undefined ? current.row_count : fields.rowCount,
        checksum:
          fields.checksum === undefined ? current.checksum : fields.checksum,
        error_code:
          fields.errorCode === undefined ? current.error_code : fields.errorCode,
        error_message:
          fields.errorMessage === undefined
            ? current.error_message
            : fields.errorMessage,
        metadata: fields.metadata,
      };
    });
  }

  private buildProcessingMetadata(
    job: IngestionJobRecord,
    operation: Exclude<IngestionJobRunResultFlag, 'reused_existing'>,
    at: string
  ): RunnerMetadata {
    const metadata = asRunnerMetadata(job.metadata);
    metadata.attempt_count = getAttemptCount(job) + 1;
    if (operation === 'retried') {
      metadata.retry_count = getRetryCount(job) + 1;
    }
    const withHistory = appendStatusHistory(metadata, {
      from: job.processing_status,
      to: 'processing',
      at,
      reason: operation,
    });

    return persistIngestionStateEnvelope(
      withHistory,
      deriveIngestionStateEnvelope({
        collectionState: 'processing',
        metadata: withHistory,
      })
    ) as RunnerMetadata;
  }

  private buildFinishedMetadata(
    job: IngestionJobRecord,
    operation: Exclude<IngestionJobRunResultFlag, 'reused_existing'>,
    outcome: 'success' | 'failure',
    at: string,
    extraMetadata?: IngestionJobRecord['metadata'],
    errorCode?: string
  ): RunnerMetadata {
    const metadata = mergeMetadata(asRunnerMetadata(job.metadata), extraMetadata);
    const status = outcome === 'success' ? 'available' : 'failed';
    const withHistory = appendStatusHistory(metadata, {
      from: 'processing',
      to: status,
      at,
      reason: `${operation}_${outcome}`,
    });

    const withAttempt = appendAttemptHistory(withHistory, {
      attempt_number: getAttemptCount(job),
      operation,
      at,
      outcome,
      error_code: errorCode,
    });

    return persistIngestionStateEnvelope(
      withAttempt,
      deriveIngestionStateEnvelope({
        collectionState: status,
        metadata: withAttempt,
      })
    ) as RunnerMetadata;
  }

  private async updateWatermarkOnSuccess(
    job: IngestionJobRecord
  ): Promise<SourceWatermarkRecord> {
    const scope = {
      sourceName: job.source_name,
      accountId: job.account_id,
      marketplace: job.marketplace,
      scopeKey: getScopeKey(job),
    };
    const existing = await this.repository.findWatermarkByScope(scope);
    const createdAt = existing?.created_at ?? this.now();
    const updatedAt = this.now();
    const stateEnvelope = getIngestionStateEnvelopeFromJob(job);

    return this.repository.upsertWatermark({
      id: existing?.id ?? this.createJobId(),
      source_name: scope.sourceName,
      account_id: scope.accountId,
      marketplace: scope.marketplace,
      scope_key: scope.scopeKey,
      last_requested_at: job.requested_at,
      last_available_at: job.finished_at,
      last_success_at: job.finished_at,
      last_job_id: job.id,
      watermark_start: job.source_window_start,
      watermark_end: job.source_window_end,
      status: 'available',
      notes: existing?.notes ?? null,
      metadata: persistIngestionStateEnvelope(existing?.metadata ?? {}, stateEnvelope),
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  private async getJobOrThrow(jobId: string): Promise<IngestionJobRecord> {
    const job = await this.repository.findJobById(jobId);
    if (!job) {
      throw new IngestionJobRunnerError(
        'job_not_found',
        `Job not found: ${jobId}`
      );
    }
    return job;
  }

  private validateRequest(request: IngestionJobRunRequest): void {
    requireTrimmed(request.jobKey, 'jobKey');
    requireTrimmed(request.sourceName, 'sourceName');
    requireTrimmed(request.idempotencyKey, 'idempotencyKey');
  }
}

export interface StubExecutorStepSuccess {
  outcome: 'success';
  rowCount?: number | null;
  checksum?: string | null;
  retrievedAt?: string | null;
  metadata?: IngestionJobRecord['metadata'];
}

export interface StubExecutorStepFailure {
  outcome: 'failure';
  errorCode: string;
  errorMessage: string;
  metadata?: IngestionJobRecord['metadata'];
}

export type StubExecutorStep = StubExecutorStepSuccess | StubExecutorStepFailure;

export interface StubExecutorController {
  executor: IngestionExecutor;
  getCallCount: () => number;
}

export const createStubIngestionExecutor = (
  steps: StubExecutorStep[]
): StubExecutorController => {
  let callCount = 0;

  return {
    executor: async () => {
      const step =
        steps[Math.min(callCount, Math.max(steps.length - 1, 0))] ??
        ({
          outcome: 'success',
          rowCount: 0,
          checksum: null,
        } satisfies StubExecutorStepSuccess);

      callCount += 1;
      return cloneJson(step) as IngestionExecutorResult;
    },
    getCallCount: () => callCount,
  };
};
