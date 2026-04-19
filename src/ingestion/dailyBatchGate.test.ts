import { describe, expect, it } from 'vitest';

import {
  DAILY_BATCH_ADS_SOURCE_NAME,
  DAILY_BATCH_RETAIL_SOURCE_NAME,
  createStubDailyBatchSourceExecutor,
  getIngestionStateEnvelopeFromJob,
  InMemoryIngestionJobRepository,
} from './index';
import {
  buildDailyBatchSourceJobRequest,
  runDailyBatchGate,
  summarizeDailyBatchGate,
} from './dailyBatchGate';
import { parseDailyBatchGateCliArgs } from './dailyBatchGateCli';

const request = {
  accountId: 'sourbear',
  marketplace: 'US',
  startDate: '2026-04-18',
  endDate: '2026-04-18',
};

const nowValues = [
  '2026-04-19T00:00:00.000Z',
  '2026-04-19T00:00:01.000Z',
  '2026-04-19T00:00:02.000Z',
  '2026-04-19T00:00:03.000Z',
  '2026-04-19T00:00:04.000Z',
  '2026-04-19T00:00:05.000Z',
  '2026-04-19T00:00:06.000Z',
  '2026-04-19T00:00:07.000Z',
  '2026-04-19T00:00:08.000Z',
  '2026-04-19T00:00:09.000Z',
  '2026-04-19T00:00:10.000Z',
  '2026-04-19T00:00:11.000Z',
];

function buildNow() {
  let index = 0;
  return () => nowValues[Math.min(index++, nowValues.length - 1)];
}

function buildCreateJobId() {
  let index = 0;
  return () => `job-${String(++index).padStart(3, '0')}`;
}

function buildSuccessfulStubs() {
  const retail = createStubDailyBatchSourceExecutor({
    sourceGroup: 'retail',
    rowCount: 3,
    checksum: 'retail-checksum',
  });
  const ads = createStubDailyBatchSourceExecutor({
    sourceGroup: 'ads',
    rowCount: 7,
    checksum: 'ads-checksum',
  });

  return {
    retail,
    ads,
    options: {
      retailExecutor: retail.executor,
      adsExecutor: ads.executor,
    },
  };
}

describe('Stage 3 daily batch gate', () => {
  it('runs retail then ads through Stage 3 state and watermarks', async () => {
    const stubs = buildSuccessfulStubs();
    const result = await runDailyBatchGate({
      request,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(result.ok).toBe(true);
    expect(result.retail.job?.source_name).toBe(DAILY_BATCH_RETAIL_SOURCE_NAME);
    expect(result.ads.job?.source_name).toBe(DAILY_BATCH_ADS_SOURCE_NAME);
    expect(result.retail.job?.processing_status).toBe('available');
    expect(result.ads.job?.processing_status).toBe('available');
    expect(result.retail.watermark?.status).toBe('available');
    expect(result.ads.watermark?.status).toBe('available');
    expect(stubs.retail.getCallCount()).toBe(1);
    expect(stubs.ads.getCallCount()).toBe(1);
    expect(result.retail.job?.row_count).toBe(3);
    expect(result.ads.job?.row_count).toBe(7);
  });

  it('reuses an existing successful retail job without duplicate execution', async () => {
    const repository = new InMemoryIngestionJobRepository();
    const stubs = buildSuccessfulStubs();

    await runDailyBatchGate({
      request,
      repository,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });
    const second = await runDailyBatchGate({
      request,
      repository,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(second.retail.jobResult).toBe('reused_existing');
    expect(second.retail.executorInvoked).toBe(false);
    expect(stubs.retail.getCallCount()).toBe(1);
  });

  it('reuses an existing successful ads job without duplicate execution', async () => {
    const repository = new InMemoryIngestionJobRepository();
    const stubs = buildSuccessfulStubs();

    await runDailyBatchGate({
      request,
      repository,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });
    const second = await runDailyBatchGate({
      request,
      repository,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(second.ads.jobResult).toBe('reused_existing');
    expect(second.ads.executorInvoked).toBe(false);
    expect(stubs.ads.getCallCount()).toBe(1);
  });

  it('marks retail failed and does not run ads when retail fails', async () => {
    const repository = new InMemoryIngestionJobRepository();
    const retail = createStubDailyBatchSourceExecutor({
      sourceGroup: 'retail',
      fail: {
        code: 'retail_stub_failed',
        message: 'Retail stub failed',
      },
    });
    const ads = createStubDailyBatchSourceExecutor({ sourceGroup: 'ads' });
    const result = await runDailyBatchGate({
      request,
      repository,
      retailExecutor: retail.executor,
      adsExecutor: ads.executor,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(result.ok).toBe(false);
    expect(result.error?.source).toBe('retail');
    expect(result.retail.job?.processing_status).toBe('failed');
    expect(result.retail.watermark).toBeNull();
    expect(result.ads.jobResult).toBe('not_run');
    expect(ads.getCallCount()).toBe(0);
    expect(
      await repository.findWatermarkByScope({
        sourceName: DAILY_BATCH_RETAIL_SOURCE_NAME,
        accountId: request.accountId,
        marketplace: request.marketplace,
        scopeKey: `daily:${request.marketplace}`,
      })
    ).toBeNull();
  });

  it('keeps successful retail state intact when ads fails', async () => {
    const retail = createStubDailyBatchSourceExecutor({ sourceGroup: 'retail' });
    const ads = createStubDailyBatchSourceExecutor({
      sourceGroup: 'ads',
      fail: {
        code: 'ads_stub_failed',
        message: 'Ads stub failed',
      },
    });
    const result = await runDailyBatchGate({
      request,
      retailExecutor: retail.executor,
      adsExecutor: ads.executor,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(result.ok).toBe(false);
    expect(result.error?.source).toBe('ads');
    expect(result.retail.job?.processing_status).toBe('available');
    expect(result.retail.watermark?.status).toBe('available');
    expect(result.ads.job?.processing_status).toBe('failed');
    expect(result.ads.watermark).toBeNull();
  });

  it('persists deterministic metadata and state envelopes on successful jobs', async () => {
    const stubs = buildSuccessfulStubs();
    const result = await runDailyBatchGate({
      request,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(result.retail.job?.idempotency_key).toBe(
      [
        'stage3',
        'daily-batch',
        DAILY_BATCH_RETAIL_SOURCE_NAME,
        'sourbear',
        'US',
        '2026-04-18',
        '2026-04-18',
      ].join('/')
    );
    expect(result.ads.job?.idempotency_key).toBe(
      [
        'stage3',
        'daily-batch',
        DAILY_BATCH_ADS_SOURCE_NAME,
        'sourbear',
        'US',
        '2026-04-18',
        '2026-04-18',
      ].join('/')
    );
    expect(result.retail.job?.metadata.source_group).toBe('retail');
    expect(result.ads.job?.metadata.source_group).toBe('ads');
    expect(result.retail.job?.metadata.gate_source_steps).toHaveLength(1);
    expect(getIngestionStateEnvelopeFromJob(result.retail.job!).collectionState).toBe('available');
    expect(getIngestionStateEnvelopeFromJob(result.ads.job!).freshnessState).toBe('daily');
  });

  it('formats a deterministic operator summary without secrets', async () => {
    const stubs = buildSuccessfulStubs();
    const result = await runDailyBatchGate({
      request,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });
    const summary = summarizeDailyBatchGate(result);

    expect(summary).toContain('Stage 3 daily batch gate completed.');
    expect(summary).toContain('ok=yes');
    expect(summary).toContain('retail_daily.job_result=created');
    expect(summary).toContain('ads_daily.job_result=created');
    expect(summary).toContain('retail_daily.watermark_status=available');
    expect(summary).toContain('ads_daily.watermark_status=available');
    expect(summary).not.toMatch(/token|secret|password/i);
  });

  it('builds deterministic source job requests', () => {
    expect(
      buildDailyBatchSourceJobRequest({ sourceGroup: 'retail', request })
    ).toMatchObject({
      sourceName: DAILY_BATCH_RETAIL_SOURCE_NAME,
      accountId: 'sourbear',
      marketplace: 'US',
      sourceWindowStart: '2026-04-18',
      sourceWindowEnd: '2026-04-18',
      scopeKey: 'daily:US',
    });
  });

  it('parses CLI arguments for the bounded gate command', () => {
    expect(
      parseDailyBatchGateCliArgs([
        '--account-id',
        'sourbear',
        '--marketplace=US',
        '--start-date',
        '2026-04-18',
        '--end-date=2026-04-18',
        '--scenario',
        'stub-success',
        '--retail-report-id=485677020556',
      ])
    ).toEqual({
      accountId: 'sourbear',
      marketplace: 'US',
      startDate: '2026-04-18',
      endDate: '2026-04-18',
      scenario: 'stub-success',
      retailReportId: '485677020556',
    });
  });
});
