import type {
  IngestionJobRecord,
  IngestionProcessingStatus,
  IngestionRunKind,
} from './schemaContract';
import type {
  IngestionJobRepository,
  IngestionJobRunResult,
  IngestionJobRunRequest,
} from './jobRunner';

export const INGESTION_BACKFILL_SLICE_UNITS = ['day', 'week'] as const;
export type IngestionBackfillSliceUnit =
  (typeof INGESTION_BACKFILL_SLICE_UNITS)[number];

export const INGESTION_BACKFILL_RERUN_MODES = ['none', 'failed_only'] as const;
export type IngestionBackfillRerunMode =
  (typeof INGESTION_BACKFILL_RERUN_MODES)[number];

export const INGESTION_BACKFILL_ACTIONS = [
  'created',
  'reused_existing',
  'rerun_failed',
  'skipped_available',
] as const;
export type IngestionBackfillAction =
  (typeof INGESTION_BACKFILL_ACTIONS)[number];

export interface IngestionBackfillRequest {
  jobKey: string;
  sourceName: string;
  accountId: string | null;
  marketplace: string | null;
  rangeStart: string;
  rangeEnd: string;
  sliceUnit: IngestionBackfillSliceUnit;
  sliceSize: number;
  runKind: IngestionRunKind;
  scopeKey?: string;
  baseMetadata?: IngestionJobRecord['metadata'];
  rerunMode?: IngestionBackfillRerunMode;
}

export interface IngestionBackfillSlice {
  sliceIndex: number;
  sliceUnit: IngestionBackfillSliceUnit;
  sliceSize: number;
  rangeStart: string;
  rangeEnd: string;
  sourceWindowStart: string;
  sourceWindowEnd: string;
  idempotencyKey: string;
}

export interface IngestionBackfillPlan {
  jobKey: string;
  sourceName: string;
  accountId: string | null;
  marketplace: string | null;
  rangeStart: string;
  rangeEnd: string;
  sliceUnit: IngestionBackfillSliceUnit;
  sliceSize: number;
  runKind: IngestionRunKind;
  rerunMode: IngestionBackfillRerunMode;
  inclusiveRangeEnd: true;
  slices: IngestionBackfillSlice[];
}

export interface IngestionBackfillSliceResult {
  slice: IngestionBackfillSlice;
  action: IngestionBackfillAction;
  jobId: string;
  finalObservedJobStatus: IngestionProcessingStatus;
  executorInvoked: boolean;
}

export interface IngestionBackfillRunResult {
  plan: IngestionBackfillPlan;
  sliceResults: IngestionBackfillSliceResult[];
  actionCounts: Record<IngestionBackfillAction, number>;
}

export interface IngestionBackfillJobRunner {
  submitJob(request: IngestionJobRunRequest): Promise<IngestionJobRunResult>;
  retryFailedJob(jobId: string): Promise<IngestionJobRunResult>;
}

export class IngestionBackfillError extends Error {
  readonly code: 'invalid_request';

  constructor(message: string) {
    super(message);
    this.name = 'IngestionBackfillError';
    this.code = 'invalid_request';
  }
}

interface ParsedDateOnly {
  year: number;
  month: number;
  day: number;
  utc: Date;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const requireTrimmed = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new IngestionBackfillError(`${field} must be a non-empty string`);
  }
  return trimmed;
};

const parseDateOnly = (value: string, field: string): ParsedDateOnly => {
  const trimmed = requireTrimmed(value, field);
  if (!DATE_ONLY_PATTERN.test(trimmed)) {
    throw new IngestionBackfillError(`${field} must use YYYY-MM-DD format`);
  }

  const [yearText, monthText, dayText] = trimmed.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utc = new Date(Date.UTC(year, month - 1, day));

  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new IngestionBackfillError(`${field} must be a valid calendar date`);
  }

  return { year, month, day, utc };
};

const formatDateOnly = (value: Date): string =>
  [
    String(value.getUTCFullYear()).padStart(4, '0'),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-');

const addDays = (value: Date, days: number): Date =>
  new Date(value.getTime() + days * DAY_MS);

const minDate = (left: Date, right: Date): Date =>
  left.getTime() <= right.getTime() ? left : right;

const toSourceWindowStart = (dateOnly: string): string =>
  `${dateOnly}T00:00:00.000Z`;

const toSourceWindowEnd = (dateOnly: string): string =>
  `${dateOnly}T23:59:59.999Z`;

const isSupportedSliceUnit = (
  value: string
): value is IngestionBackfillSliceUnit =>
  INGESTION_BACKFILL_SLICE_UNITS.includes(
    value as IngestionBackfillSliceUnit
  );

const isSupportedRerunMode = (
  value: string
): value is IngestionBackfillRerunMode =>
  INGESTION_BACKFILL_RERUN_MODES.includes(
    value as IngestionBackfillRerunMode
  );

const normalizeRequest = (
  request: IngestionBackfillRequest
): IngestionBackfillPlan => {
  const sliceUnit = String(request.sliceUnit);
  if (!isSupportedSliceUnit(sliceUnit)) {
    throw new IngestionBackfillError(
      `sliceUnit must be one of: ${INGESTION_BACKFILL_SLICE_UNITS.join(', ')}`
    );
  }

  const rerunMode = String(request.rerunMode ?? 'none');
  if (!isSupportedRerunMode(rerunMode)) {
    throw new IngestionBackfillError(
      `rerunMode must be one of: ${INGESTION_BACKFILL_RERUN_MODES.join(', ')}`
    );
  }

  const rangeStart = parseDateOnly(request.rangeStart, 'rangeStart');
  const rangeEnd = parseDateOnly(request.rangeEnd, 'rangeEnd');
  if (rangeEnd.utc.getTime() < rangeStart.utc.getTime()) {
    throw new IngestionBackfillError('rangeEnd must be on or after rangeStart');
  }

  const sliceSize = Number(request.sliceSize);
  if (!Number.isInteger(sliceSize) || sliceSize <= 0) {
    throw new IngestionBackfillError('sliceSize must be a positive integer');
  }

  const sliceSpanDays = sliceUnit === 'day' ? sliceSize : sliceSize * 7;
  const slices: IngestionBackfillSlice[] = [];
  let cursor = rangeStart.utc;

  while (cursor.getTime() <= rangeEnd.utc.getTime()) {
    const sliceIndex = slices.length;
    const sliceStart = formatDateOnly(cursor);
    const sliceEnd = formatDateOnly(
      minDate(addDays(cursor, sliceSpanDays - 1), rangeEnd.utc)
    );

    slices.push({
      sliceIndex,
      sliceUnit,
      sliceSize,
      rangeStart: sliceStart,
      rangeEnd: sliceEnd,
      sourceWindowStart: toSourceWindowStart(sliceStart),
      sourceWindowEnd: toSourceWindowEnd(sliceEnd),
      idempotencyKey: buildBackfillSliceIdempotencyKey({
        jobKey: request.jobKey,
        sourceName: request.sourceName,
        accountId: request.accountId,
        marketplace: request.marketplace,
        scopeKey: request.scopeKey ?? '',
        rangeStart: sliceStart,
        rangeEnd: sliceEnd,
        sliceUnit,
        sliceSize,
      }),
    });

    cursor = addDays(cursor, sliceSpanDays);
  }

  return {
    jobKey: requireTrimmed(request.jobKey, 'jobKey'),
    sourceName: requireTrimmed(request.sourceName, 'sourceName'),
    accountId: request.accountId,
    marketplace: request.marketplace,
    rangeStart: formatDateOnly(rangeStart.utc),
    rangeEnd: formatDateOnly(rangeEnd.utc),
    sliceUnit,
    sliceSize,
    runKind: request.runKind,
    rerunMode,
    inclusiveRangeEnd: true,
    slices,
  };
};

export const buildBackfillSliceIdempotencyKey = (args: {
  jobKey: string;
  sourceName: string;
  accountId: string | null;
  marketplace: string | null;
  scopeKey: string;
  rangeStart: string;
  rangeEnd: string;
  sliceUnit: IngestionBackfillSliceUnit;
  sliceSize: number;
}): string =>
  [
    requireTrimmed(args.jobKey, 'jobKey'),
    requireTrimmed(args.sourceName, 'sourceName'),
    args.accountId ?? '_',
    args.marketplace ?? '_',
    args.scopeKey || '_',
    args.rangeStart,
    args.rangeEnd,
    args.sliceUnit,
    String(args.sliceSize),
  ].join(':');

const createActionCounts = (): Record<IngestionBackfillAction, number> => ({
  created: 0,
  reused_existing: 0,
  rerun_failed: 0,
  skipped_available: 0,
});

const toSliceJobRequest = (
  request: IngestionBackfillRequest,
  slice: IngestionBackfillSlice
): IngestionJobRunRequest => ({
  jobKey: request.jobKey,
  sourceName: request.sourceName,
  accountId: request.accountId,
  marketplace: request.marketplace,
  sourceWindowStart: slice.sourceWindowStart,
  sourceWindowEnd: slice.sourceWindowEnd,
  idempotencyKey: slice.idempotencyKey,
  runKind: request.runKind,
  scopeKey: request.scopeKey,
  metadata: {
    ...(request.baseMetadata ?? {}),
    backfill: {
      request_range_start: request.rangeStart,
      request_range_end: request.rangeEnd,
      slice_range_start: slice.rangeStart,
      slice_range_end: slice.rangeEnd,
      slice_index: slice.sliceIndex,
      slice_unit: slice.sliceUnit,
      slice_size: slice.sliceSize,
      inclusive_range_end: true,
    },
  },
});

const toSliceResult = (
  slice: IngestionBackfillSlice,
  action: IngestionBackfillAction,
  job: IngestionJobRecord,
  executorInvoked: boolean
): IngestionBackfillSliceResult => ({
  slice,
  action,
  jobId: job.id,
  finalObservedJobStatus: job.processing_status,
  executorInvoked,
});

export const buildIngestionBackfillPlan = (
  request: IngestionBackfillRequest
): IngestionBackfillPlan => normalizeRequest(request);

export class IngestionBackfillRunner {
  private readonly repository: Pick<
    IngestionJobRepository,
    'findJobByIdempotencyKey'
  >;
  private readonly jobRunner: IngestionBackfillJobRunner;

  constructor(options: {
    repository: Pick<IngestionJobRepository, 'findJobByIdempotencyKey'>;
    jobRunner: IngestionBackfillJobRunner;
  }) {
    this.repository = options.repository;
    this.jobRunner = options.jobRunner;
  }

  async runBackfill(
    request: IngestionBackfillRequest
  ): Promise<IngestionBackfillRunResult> {
    const plan = normalizeRequest(request);
    const sliceResults: IngestionBackfillSliceResult[] = [];
    const actionCounts = createActionCounts();

    for (const slice of plan.slices) {
      const existing = await this.repository.findJobByIdempotencyKey(
        slice.idempotencyKey
      );

      if (existing?.processing_status === 'available') {
        sliceResults.push(
          toSliceResult(slice, 'skipped_available', existing, false)
        );
        actionCounts.skipped_available += 1;
        continue;
      }

      if (existing?.processing_status === 'failed') {
        if (plan.rerunMode === 'failed_only') {
          const retried = await this.jobRunner.retryFailedJob(existing.id);
          sliceResults.push(
            toSliceResult(slice, 'rerun_failed', retried.job, retried.executorInvoked)
          );
          actionCounts.rerun_failed += 1;
          continue;
        }

        sliceResults.push(
          toSliceResult(slice, 'reused_existing', existing, false)
        );
        actionCounts.reused_existing += 1;
        continue;
      }

      const submitted = await this.jobRunner.submitJob(
        toSliceJobRequest(request, slice)
      );
      const action =
        submitted.result === 'created' ? 'created' : 'reused_existing';
      sliceResults.push(
        toSliceResult(slice, action, submitted.job, submitted.executorInvoked)
      );
      actionCounts[action] += 1;
    }

    return {
      plan,
      sliceResults,
      actionCounts,
    };
  }
}
