import { describe, expect, it } from 'vitest';

import {
  InMemoryIngestionJobRepository,
  IngestionJobRunner,
  IngestionJobRunnerError,
  assertIngestionJobStatusTransition,
  canTransitionIngestionJobStatus,
  createStubIngestionExecutor,
} from './jobRunner';

const buildRequest = () => ({
  jobKey: 'sp_campaign_daily',
  sourceName: 'ads_api_sp_campaign_daily',
  accountId: 'sourbear',
  marketplace: 'US',
  sourceWindowStart: '2026-04-10T00:00:00.000Z',
  sourceWindowEnd: '2026-04-16T23:59:59.999Z',
  idempotencyKey: 'sp_campaign_daily:sourbear:2026-04-10:2026-04-16',
  runKind: 'manual',
  scopeKey: 'account',
  metadata: {
    test: true,
  },
});

const buildRunner = (steps: Parameters<typeof createStubIngestionExecutor>[0]) => {
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
  ];
  let idIndex = 0;

  const runner = new IngestionJobRunner({
    repository,
    executor: stub.executor,
    now: () => nowValues[Math.min(nowIndex++, nowValues.length - 1)],
    createJobId: () => `job-${String(++idIndex).padStart(3, '0')}`,
  });

  return {
    repository,
    runner,
    getExecutorCallCount: stub.getCallCount,
  };
};

describe('Stage 3 ingestion job runner', () => {
  it('first submission creates a new job and completes successfully', async () => {
    const { repository, runner } = buildRunner([
      {
        outcome: 'success',
        rowCount: 11,
        checksum: 'checksum-001',
        retrievedAt: '2026-04-18T00:00:01.500Z',
      },
    ]);

    const result = await runner.submitJob(buildRequest());

    expect(result.result).toBe('created');
    expect(result.job).toMatchObject({
      id: 'job-001',
      processing_status: 'available',
      row_count: 11,
      checksum: 'checksum-001',
      error_code: null,
      error_message: null,
    });

    const persisted = await repository.findJobById('job-001');
    expect(persisted?.processing_status).toBe('available');
  });

  it('repeated submission with the same idempotency key reuses an existing non-failed job', async () => {
    const { runner, getExecutorCallCount } = buildRunner([
      {
        outcome: 'success',
        rowCount: 5,
      },
    ]);

    const first = await runner.submitJob(buildRequest());
    const second = await runner.submitJob(buildRequest());

    expect(first.result).toBe('created');
    expect(second.result).toBe('reused_existing');
    expect(second.job.id).toBe(first.job.id);
    expect(second.executorInvoked).toBe(false);
    expect(getExecutorCallCount()).toBe(1);
  });

  it('tracks the explicit requested -> processing -> available transition path', async () => {
    const { runner } = buildRunner([
      {
        outcome: 'success',
        rowCount: 7,
      },
    ]);

    const result = await runner.submitJob(buildRequest());
    const metadata = result.job.metadata as {
      status_history?: Array<{ from: string | null; to: string; reason: string }>;
    };

    expect(metadata.status_history).toEqual([
      {
        from: null,
        to: 'requested',
        at: '2026-04-18T00:00:00.000Z',
        reason: 'job_created',
      },
      {
        from: 'requested',
        to: 'processing',
        at: '2026-04-18T00:00:01.000Z',
        reason: 'created',
      },
      {
        from: 'processing',
        to: 'available',
        at: '2026-04-18T00:00:02.000Z',
        reason: 'created_success',
      },
    ]);
  });

  it('marks failed runs with error details and no success watermark timestamps', async () => {
    const { repository, runner } = buildRunner([
      {
        outcome: 'failure',
        errorCode: 'stub_failure',
        errorMessage: 'deterministic failure',
      },
    ]);

    const result = await runner.submitJob(buildRequest());

    expect(result.job).toMatchObject({
      processing_status: 'failed',
      error_code: 'stub_failure',
      error_message: 'deterministic failure',
    });

    const watermark = await repository.findWatermarkByScope({
      sourceName: result.job.source_name,
      accountId: result.job.account_id,
      marketplace: result.job.marketplace,
      scopeKey: 'account',
    });
    expect(watermark).toBeNull();
  });

  it('supports an explicit deterministic retry path on the same failed job', async () => {
    const { repository, runner } = buildRunner([
      {
        outcome: 'failure',
        errorCode: 'stub_failure',
        errorMessage: 'first attempt failed',
      },
      {
        outcome: 'success',
        rowCount: 17,
        checksum: 'checksum-retry',
      },
    ]);

    const first = await runner.submitJob(buildRequest());
    const retried = await runner.retryFailedJob(first.job.id);

    expect(first.job.processing_status).toBe('failed');
    expect(retried.result).toBe('retried');
    expect(retried.job.id).toBe(first.job.id);
    expect(retried.job.processing_status).toBe('available');
    expect(retried.job.row_count).toBe(17);

    const metadata = retried.job.metadata as {
      retry_count?: number;
      attempt_count?: number;
    };
    expect(metadata.retry_count).toBe(1);
    expect(metadata.attempt_count).toBe(2);

    const watermark = await repository.findWatermarkByScope({
      sourceName: retried.job.source_name,
      accountId: retried.job.account_id,
      marketplace: retried.job.marketplace,
      scopeKey: 'account',
    });
    expect(watermark?.last_job_id).toBe(retried.job.id);
  });

  it('supports an explicit replay path with a new job id and lineage audit trail', async () => {
    const { repository, runner } = buildRunner([
      {
        outcome: 'failure',
        errorCode: 'stub_failure',
        errorMessage: 'first attempt failed',
      },
      {
        outcome: 'success',
        rowCount: 23,
        checksum: 'checksum-replay',
      },
    ]);

    const first = await runner.submitJob(buildRequest());
    const replayed = await runner.replayFailedJob(first.job.id);

    expect(replayed.result).toBe('replayed');
    expect(replayed.job.id).not.toBe(first.job.id);
    expect(replayed.job.idempotency_key).toBe(
      'sp_campaign_daily:sourbear:2026-04-10:2026-04-16#replay:1'
    );
    expect(replayed.job.processing_status).toBe('available');

    const replayMetadata = replayed.job.metadata as {
      replay_of_job_id?: string;
      lineage_root_job_id?: string;
      lineage_root_idempotency_key?: string;
    };
    expect(replayMetadata.replay_of_job_id).toBe(first.job.id);
    expect(replayMetadata.lineage_root_job_id).toBe(first.job.id);
    expect(replayMetadata.lineage_root_idempotency_key).toBe(
      'sp_campaign_daily:sourbear:2026-04-10:2026-04-16'
    );

    const original = await repository.findJobById(first.job.id);
    const originalMetadata = original?.metadata as {
      replay_count?: number;
      last_replayed_job_id?: string;
    };
    expect(originalMetadata.replay_count).toBe(1);
    expect(originalMetadata.last_replayed_job_id).toBe(replayed.job.id);
  });

  it('updates source watermarks only on success', async () => {
    const { repository, runner } = buildRunner([
      {
        outcome: 'success',
        rowCount: 5,
        checksum: 'checksum-success',
      },
    ]);

    const result = await runner.submitJob(buildRequest());

    expect(result.watermark).toMatchObject({
      status: 'available',
      last_job_id: result.job.id,
      last_requested_at: result.job.requested_at,
      last_available_at: result.job.finished_at,
      last_success_at: result.job.finished_at,
    });

    const persistedWatermark = await repository.findWatermarkByScope({
      sourceName: result.job.source_name,
      accountId: result.job.account_id,
      marketplace: result.job.marketplace,
      scopeKey: 'account',
    });
    expect(persistedWatermark?.status).toBe('available');
  });

  it('rejects invalid transitions and invalid replay requests', async () => {
    expect(canTransitionIngestionJobStatus('requested', 'processing')).toBe(true);
    expect(canTransitionIngestionJobStatus('requested', 'available')).toBe(false);

    expect(() =>
      assertIngestionJobStatusTransition('requested', 'available')
    ).toThrowError(IngestionJobRunnerError);

    const { runner } = buildRunner([
      {
        outcome: 'success',
        rowCount: 5,
      },
    ]);

    const result = await runner.submitJob(buildRequest());

    await expect(runner.retryFailedJob(result.job.id)).rejects.toMatchObject({
      name: 'IngestionJobRunnerError',
      code: 'invalid_retry',
    });
    await expect(runner.replayFailedJob(result.job.id)).rejects.toMatchObject({
      name: 'IngestionJobRunnerError',
      code: 'invalid_replay',
    });
  });

  it('uses only the injected stub executor and never calls live connectors', async () => {
    const { runner, getExecutorCallCount } = buildRunner([
      {
        outcome: 'success',
        rowCount: 1,
      },
    ]);

    await runner.submitJob(buildRequest());

    expect(getExecutorCallCount()).toBe(1);
  });
});

