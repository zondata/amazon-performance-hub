import { describe, expect, it, vi } from 'vitest';

import {
  InMemoryIngestionJobRepository,
  IngestionJobRunner,
  createStubIngestionExecutor,
} from './jobRunner';
import {
  IngestionBackfillError,
  IngestionBackfillRunner,
  buildIngestionBackfillPlan,
  type IngestionBackfillRequest,
} from './backfillRunner';
import type { IngestionJobRecord } from './schemaContract';

const buildRequest = (
  overrides: Partial<IngestionBackfillRequest> = {}
): IngestionBackfillRequest => ({
  jobKey: 'sp_campaign_daily',
  sourceName: 'ads_api_sp_campaign_daily',
  accountId: 'sourbear',
  marketplace: 'US',
  rangeStart: '2026-04-10',
  rangeEnd: '2026-04-12',
  sliceUnit: 'day',
  sliceSize: 1,
  runKind: 'manual',
  scopeKey: 'account',
  baseMetadata: {
    test: true,
  },
  rerunMode: 'none',
  ...overrides,
});

const buildRunnerHarness = (
  steps: Parameters<typeof createStubIngestionExecutor>[0]
) => {
  const repository = new InMemoryIngestionJobRepository();
  const stub = createStubIngestionExecutor(steps);
  let nowIndex = 0;
  const nowValues = [
    '2026-04-18T00:00:00.000Z',
    '2026-04-18T00:00:01.000Z',
    '2026-04-18T00:00:02.000Z',
    '2026-04-18T00:00:03.000Z',
    '2026-04-18T00:00:04.000Z',
    '2026-04-18T00:00:05.000Z',
    '2026-04-18T00:00:06.000Z',
    '2026-04-18T00:00:07.000Z',
    '2026-04-18T00:00:08.000Z',
    '2026-04-18T00:00:09.000Z',
    '2026-04-18T00:00:10.000Z',
    '2026-04-18T00:00:11.000Z',
    '2026-04-18T00:00:12.000Z',
    '2026-04-18T00:00:13.000Z',
    '2026-04-18T00:00:14.000Z',
    '2026-04-18T00:00:15.000Z',
    '2026-04-18T00:00:16.000Z',
    '2026-04-18T00:00:17.000Z',
  ];
  let jobIndex = 0;

  const baseRunner = new IngestionJobRunner({
    repository,
    executor: stub.executor,
    now: () => nowValues[Math.min(nowIndex++, nowValues.length - 1)],
    createJobId: () => `job-${String(++jobIndex).padStart(3, '0')}`,
  });
  const submitJob = vi.fn(baseRunner.submitJob.bind(baseRunner));
  const retryFailedJob = vi.fn(baseRunner.retryFailedJob.bind(baseRunner));

  const backfill = new IngestionBackfillRunner({
    repository,
    jobRunner: {
      submitJob,
      retryFailedJob,
    },
  });

  return {
    repository,
    backfill,
    submitJob,
    retryFailedJob,
    getExecutorCallCount: stub.getCallCount,
  };
};

const buildExistingJob = (args: {
  id: string;
  idempotencyKey: string;
  status: IngestionJobRecord['processing_status'];
  startedAt?: string | null;
  finishedAt?: string | null;
}): IngestionJobRecord => ({
  id: args.id,
  job_key: 'sp_campaign_daily',
  source_name: 'ads_api_sp_campaign_daily',
  account_id: 'sourbear',
  marketplace: 'US',
  requested_at: '2026-04-18T00:00:00.000Z',
  source_window_start: '2026-04-10T00:00:00.000Z',
  source_window_end: '2026-04-10T23:59:59.999Z',
  retrieved_at: args.status === 'available' ? '2026-04-18T00:00:02.000Z' : null,
  started_at: args.startedAt ?? null,
  finished_at: args.finishedAt ?? null,
  processing_status: args.status,
  run_kind: 'manual',
  idempotency_key: args.idempotencyKey,
  checksum: args.status === 'available' ? 'existing-checksum' : null,
  row_count: args.status === 'available' ? 4 : null,
  error_code: args.status === 'failed' ? 'existing_failure' : null,
  error_message: args.status === 'failed' ? 'Existing failed slice' : null,
  metadata: {
    scope_key: 'account',
    lineage_root_idempotency_key: args.idempotencyKey,
    lineage_root_job_id: args.id,
    replay_count: 0,
    retry_count: 0,
    attempt_count: args.status === 'failed' ? 1 : 0,
    status_history: [],
    attempt_history: [],
  },
  created_at: '2026-04-18T00:00:00.000Z',
  updated_at: '2026-04-18T00:00:00.000Z',
});

describe('Stage 3 ingestion backfill runner', () => {
  it('builds deterministic day-based slices', () => {
    const request = buildRequest({
      rangeStart: '2026-04-10',
      rangeEnd: '2026-04-12',
      sliceUnit: 'day',
      sliceSize: 1,
    });

    const first = buildIngestionBackfillPlan(request);
    const second = buildIngestionBackfillPlan(request);

    expect(first).toEqual(second);
    expect(first.slices.map((slice) => [slice.rangeStart, slice.rangeEnd])).toEqual([
      ['2026-04-10', '2026-04-10'],
      ['2026-04-11', '2026-04-11'],
      ['2026-04-12', '2026-04-12'],
    ]);
    expect(first.slices.map((slice) => slice.idempotencyKey)).toEqual([
      'sp_campaign_daily:ads_api_sp_campaign_daily:sourbear:US:account:2026-04-10:2026-04-10:day:1',
      'sp_campaign_daily:ads_api_sp_campaign_daily:sourbear:US:account:2026-04-11:2026-04-11:day:1',
      'sp_campaign_daily:ads_api_sp_campaign_daily:sourbear:US:account:2026-04-12:2026-04-12:day:1',
    ]);
  });

  it('builds deterministic week-based slices as contiguous seven-day windows anchored at range start', () => {
    const plan = buildIngestionBackfillPlan(
      buildRequest({
        rangeStart: '2026-04-01',
        rangeEnd: '2026-04-20',
        sliceUnit: 'week',
        sliceSize: 1,
      })
    );

    expect(plan.slices.map((slice) => [slice.rangeStart, slice.rangeEnd])).toEqual([
      ['2026-04-01', '2026-04-07'],
      ['2026-04-08', '2026-04-14'],
      ['2026-04-15', '2026-04-20'],
    ]);
  });

  it('rejects an invalid range where the end is before the start', () => {
    expect(() =>
      buildIngestionBackfillPlan(
        buildRequest({
          rangeStart: '2026-04-12',
          rangeEnd: '2026-04-10',
        })
      )
    ).toThrowError(IngestionBackfillError);
  });

  it('rejects an unsupported slice unit', () => {
    expect(() =>
      buildIngestionBackfillPlan(
        buildRequest({
          sliceUnit: 'month' as never,
        })
      )
    ).toThrowError('sliceUnit must be one of: day, week');
  });

  it('repeated identical backfill requests skip already successful slices without duplication', async () => {
    const harness = buildRunnerHarness([
      {
        outcome: 'success',
        rowCount: 7,
        checksum: 'checksum-success',
      },
    ]);

    const first = await harness.backfill.runBackfill(buildRequest());
    const second = await harness.backfill.runBackfill(buildRequest());

    expect(first.actionCounts.created).toBe(3);
    expect(second.actionCounts.skipped_available).toBe(3);
    expect(second.sliceResults.map((slice) => slice.jobId)).toEqual(
      first.sliceResults.map((slice) => slice.jobId)
    );
    expect(harness.getExecutorCallCount()).toBe(3);
  });

  it('reuses in-flight requested slices instead of duplicating them', async () => {
    const harness = buildRunnerHarness([
      {
        outcome: 'success',
        rowCount: 7,
      },
    ]);
    const plan = buildIngestionBackfillPlan(buildRequest());

    await harness.repository.insertJob(
      buildExistingJob({
        id: 'job-existing-requested',
        idempotencyKey: plan.slices[0].idempotencyKey,
        status: 'requested',
      })
    );

    const result = await harness.backfill.runBackfill(buildRequest());

    expect(result.sliceResults[0]).toMatchObject({
      action: 'reused_existing',
      jobId: 'job-existing-requested',
      finalObservedJobStatus: 'requested',
      executorInvoked: false,
    });
    expect(harness.submitJob).toHaveBeenCalledTimes(3);
    expect(harness.getExecutorCallCount()).toBe(2);
  });

  it('reruns failed slices only when explicit failed_only rerun mode is enabled', async () => {
    const harness = buildRunnerHarness([
      {
        outcome: 'failure',
        errorCode: 'stub_failure',
        errorMessage: 'first slice failed',
      },
      {
        outcome: 'success',
        rowCount: 9,
        checksum: 'checksum-rerun',
      },
      {
        outcome: 'success',
        rowCount: 4,
        checksum: 'checksum-success',
      },
      {
        outcome: 'success',
        rowCount: 4,
        checksum: 'checksum-success',
      },
    ]);

    const initial = await harness.backfill.runBackfill(buildRequest());
    const withoutRerun = await harness.backfill.runBackfill(buildRequest());
    const withRerun = await harness.backfill.runBackfill(
      buildRequest({ rerunMode: 'failed_only' })
    );

    expect(initial.sliceResults[0].finalObservedJobStatus).toBe('failed');
    expect(withoutRerun.sliceResults[0]).toMatchObject({
      action: 'reused_existing',
      finalObservedJobStatus: 'failed',
      executorInvoked: false,
    });
    expect(withRerun.sliceResults[0]).toMatchObject({
      action: 'rerun_failed',
      finalObservedJobStatus: 'available',
      executorInvoked: true,
    });
    expect(harness.retryFailedJob).toHaveBeenCalledTimes(1);
  });

  it('keeps successful slices skipped on rerun while rerunning only failed slices', async () => {
    const harness = buildRunnerHarness([
      {
        outcome: 'success',
        rowCount: 5,
      },
      {
        outcome: 'failure',
        errorCode: 'slice_failed',
        errorMessage: 'deterministic failure',
      },
      {
        outcome: 'success',
        rowCount: 8,
        checksum: 'checksum-rerun',
      },
      {
        outcome: 'success',
        rowCount: 5,
      },
    ]);

    await harness.backfill.runBackfill(
      buildRequest({
        rangeStart: '2026-04-10',
        rangeEnd: '2026-04-11',
      })
    );

    const rerun = await harness.backfill.runBackfill(
      buildRequest({
        rangeStart: '2026-04-10',
        rangeEnd: '2026-04-11',
        rerunMode: 'failed_only',
      })
    );

    expect(rerun.actionCounts.skipped_available).toBe(1);
    expect(rerun.actionCounts.rerun_failed).toBe(1);
    expect(rerun.actionCounts.created).toBe(0);
    expect(rerun.actionCounts.reused_existing).toBe(0);
  });

  it('routes mutable backfill work through the existing Stage 3 job runner', async () => {
    const harness = buildRunnerHarness([
      {
        outcome: 'success',
        rowCount: 5,
      },
      {
        outcome: 'failure',
        errorCode: 'slice_failed',
        errorMessage: 'deterministic failure',
      },
      {
        outcome: 'success',
        rowCount: 8,
      },
    ]);

    await harness.backfill.runBackfill(
      buildRequest({
        rangeStart: '2026-04-10',
        rangeEnd: '2026-04-11',
      })
    );

    await harness.backfill.runBackfill(
      buildRequest({
        rangeStart: '2026-04-10',
        rangeEnd: '2026-04-11',
        rerunMode: 'failed_only',
      })
    );

    expect(harness.submitJob).toHaveBeenCalledTimes(2);
    expect(harness.retryFailedJob).toHaveBeenCalledTimes(1);
  });
});
