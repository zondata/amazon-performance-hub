import { describe, expect, it } from 'vitest';

import {
  getIngestionStateEnvelopeFromJob,
  InMemoryIngestionJobRepository,
  WEEKLY_QUERY_INTELLIGENCE_SEARCH_TERMS_SOURCE_NAME,
  WEEKLY_QUERY_INTELLIGENCE_SQP_SOURCE_NAME,
} from './index';
import {
  buildWeeklyQueryIntelligenceJobRequest,
  createStubWeeklyQueryIntelligenceExecutor,
  runWeeklyQueryIntelligenceGate,
  summarizeWeeklyQueryIntelligenceGate,
} from './weeklyQueryIntelligenceGate';
import { parseWeeklyQueryIntelligenceGateCliArgs } from './weeklyQueryIntelligenceGateCli';

const request = {
  accountId: 'sourbear',
  marketplace: 'US',
  marketplaceId: 'ATVPDKIKX0DER',
  asin: 'B0FYPRWPN1',
  startDate: '2026-04-05',
  endDate: '2026-04-11',
};

const nowValues = [
  '2026-04-19T01:00:00.000Z',
  '2026-04-19T01:00:01.000Z',
  '2026-04-19T01:00:02.000Z',
  '2026-04-19T01:00:03.000Z',
  '2026-04-19T01:00:04.000Z',
  '2026-04-19T01:00:05.000Z',
  '2026-04-19T01:00:06.000Z',
  '2026-04-19T01:00:07.000Z',
  '2026-04-19T01:00:08.000Z',
  '2026-04-19T01:00:09.000Z',
  '2026-04-19T01:00:10.000Z',
  '2026-04-19T01:00:11.000Z',
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
  const sqp = createStubWeeklyQueryIntelligenceExecutor({
    sourceGroup: 'sqp',
    rowCount: 11,
    checksum: 'sqp-checksum',
  });
  const searchTerms = createStubWeeklyQueryIntelligenceExecutor({
    sourceGroup: 'search_terms',
    rowCount: 13,
    checksum: 'search-terms-checksum',
  });

  return {
    sqp,
    searchTerms,
    options: {
      sqpExecutor: sqp.executor,
      searchTermsExecutor: searchTerms.executor,
    },
  };
}

describe('Stage 3 weekly query-intelligence gate', () => {
  it('runs SQP then Search Terms through Stage 3 state and watermarks', async () => {
    const stubs = buildSuccessfulStubs();
    const result = await runWeeklyQueryIntelligenceGate({
      request,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(result.ok).toBe(true);
    expect(result.sqp.job?.source_name).toBe(
      WEEKLY_QUERY_INTELLIGENCE_SQP_SOURCE_NAME
    );
    expect(result.searchTerms.job?.source_name).toBe(
      WEEKLY_QUERY_INTELLIGENCE_SEARCH_TERMS_SOURCE_NAME
    );
    expect(result.sqp.job?.processing_status).toBe('available');
    expect(result.searchTerms.job?.processing_status).toBe('available');
    expect(result.sqp.watermark?.status).toBe('available');
    expect(result.searchTerms.watermark?.status).toBe('available');
    expect(stubs.sqp.getCallCount()).toBe(1);
    expect(stubs.searchTerms.getCallCount()).toBe(1);
    expect(result.sqp.job?.row_count).toBe(11);
    expect(result.searchTerms.job?.row_count).toBe(13);
  });

  it('reuses an existing successful SQP job without duplicate execution', async () => {
    const repository = new InMemoryIngestionJobRepository();
    const stubs = buildSuccessfulStubs();

    await runWeeklyQueryIntelligenceGate({
      request,
      repository,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });
    const second = await runWeeklyQueryIntelligenceGate({
      request,
      repository,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(second.sqp.jobResult).toBe('reused_existing');
    expect(second.sqp.executorInvoked).toBe(false);
    expect(stubs.sqp.getCallCount()).toBe(1);
  });

  it('reuses an existing successful Search Terms job without duplicate execution', async () => {
    const repository = new InMemoryIngestionJobRepository();
    const stubs = buildSuccessfulStubs();

    await runWeeklyQueryIntelligenceGate({
      request,
      repository,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });
    const second = await runWeeklyQueryIntelligenceGate({
      request,
      repository,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(second.searchTerms.jobResult).toBe('reused_existing');
    expect(second.searchTerms.executorInvoked).toBe(false);
    expect(stubs.searchTerms.getCallCount()).toBe(1);
  });

  it('marks SQP failed and does not run Search Terms when SQP fails', async () => {
    const repository = new InMemoryIngestionJobRepository();
    const sqp = createStubWeeklyQueryIntelligenceExecutor({
      sourceGroup: 'sqp',
      fail: {
        code: 'sqp_stub_failed',
        message: 'SQP stub failed',
      },
    });
    const searchTerms = createStubWeeklyQueryIntelligenceExecutor({
      sourceGroup: 'search_terms',
    });
    const result = await runWeeklyQueryIntelligenceGate({
      request,
      repository,
      sqpExecutor: sqp.executor,
      searchTermsExecutor: searchTerms.executor,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(result.ok).toBe(false);
    expect(result.error?.source).toBe('sqp');
    expect(result.sqp.job?.processing_status).toBe('failed');
    expect(result.sqp.watermark).toBeNull();
    expect(result.searchTerms.jobResult).toBe('not_run');
    expect(searchTerms.getCallCount()).toBe(0);
    expect(
      await repository.findWatermarkByScope({
        sourceName: WEEKLY_QUERY_INTELLIGENCE_SQP_SOURCE_NAME,
        accountId: request.accountId,
        marketplace: request.marketplace,
        scopeKey: `weekly:${request.marketplace}:asin:${request.asin}`,
      })
    ).toBeNull();
  });

  it('keeps successful SQP state intact when Search Terms fails', async () => {
    const sqp = createStubWeeklyQueryIntelligenceExecutor({ sourceGroup: 'sqp' });
    const searchTerms = createStubWeeklyQueryIntelligenceExecutor({
      sourceGroup: 'search_terms',
      fail: {
        code: 'search_terms_stub_failed',
        message: 'Search Terms stub failed',
      },
    });
    const result = await runWeeklyQueryIntelligenceGate({
      request,
      sqpExecutor: sqp.executor,
      searchTermsExecutor: searchTerms.executor,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(result.ok).toBe(false);
    expect(result.error?.source).toBe('search_terms');
    expect(result.sqp.job?.processing_status).toBe('available');
    expect(result.sqp.watermark?.status).toBe('available');
    expect(result.searchTerms.job?.processing_status).toBe('failed');
    expect(result.searchTerms.watermark).toBeNull();
  });

  it('persists deterministic metadata and weekly state envelopes', async () => {
    const stubs = buildSuccessfulStubs();
    const result = await runWeeklyQueryIntelligenceGate({
      request,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(result.sqp.job?.idempotency_key).toBe(
      [
        'stage3',
        'weekly-query-intelligence',
        WEEKLY_QUERY_INTELLIGENCE_SQP_SOURCE_NAME,
        'sourbear',
        'US',
        '2026-04-05',
        '2026-04-11',
        'B0FYPRWPN1',
      ].join('/')
    );
    expect(result.searchTerms.job?.idempotency_key).toBe(
      [
        'stage3',
        'weekly-query-intelligence',
        WEEKLY_QUERY_INTELLIGENCE_SEARCH_TERMS_SOURCE_NAME,
        'sourbear',
        'US',
        '2026-04-05',
        '2026-04-11',
      ].join('/')
    );
    expect(result.sqp.job?.metadata.source_group).toBe('sqp');
    expect(result.searchTerms.job?.metadata.source_group).toBe('search_terms');
    expect(result.sqp.job?.metadata.gate_source_steps).toHaveLength(1);
    expect(getIngestionStateEnvelopeFromJob(result.sqp.job!).collectionState).toBe('available');
    expect(getIngestionStateEnvelopeFromJob(result.sqp.job!).freshnessState).toBe('weekly');
    expect(getIngestionStateEnvelopeFromJob(result.searchTerms.job!).sourceConfidence).toBe('high');
  });

  it('formats a deterministic operator summary without secrets', async () => {
    const stubs = buildSuccessfulStubs();
    const result = await runWeeklyQueryIntelligenceGate({
      request,
      ...stubs.options,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });
    const summary = summarizeWeeklyQueryIntelligenceGate(result);

    expect(summary).toContain('Stage 3 weekly query-intelligence gate completed.');
    expect(summary).toContain('ok=yes');
    expect(summary).toContain('sqp_weekly.job_result=created');
    expect(summary).toContain('search_terms_weekly.job_result=created');
    expect(summary).toContain('sqp_weekly.upload_id=sqp-stub-upload');
    expect(summary).toContain('search_terms_weekly.watermark_status=available');
    expect(summary).not.toMatch(/token|secret|password/i);
  });

  it('builds deterministic source job requests', () => {
    expect(
      buildWeeklyQueryIntelligenceJobRequest({
        sourceGroup: 'sqp',
        request,
      })
    ).toMatchObject({
      sourceName: WEEKLY_QUERY_INTELLIGENCE_SQP_SOURCE_NAME,
      accountId: 'sourbear',
      marketplace: 'US',
      sourceWindowStart: '2026-04-05',
      sourceWindowEnd: '2026-04-11',
      scopeKey: 'weekly:US:asin:B0FYPRWPN1',
    });
  });

  it('parses CLI arguments for the bounded weekly gate command', () => {
    expect(
      parseWeeklyQueryIntelligenceGateCliArgs([
        '--account-id',
        'sourbear',
        '--marketplace=US',
        '--marketplace-id',
        'ATVPDKIKX0DER',
        '--asin=B0FYPRWPN1',
        '--start-date',
        '2026-04-05',
        '--end-date=2026-04-11',
        '--scenario',
        'stub-success',
      ])
    ).toEqual({
      accountId: 'sourbear',
      marketplace: 'US',
      marketplaceId: 'ATVPDKIKX0DER',
      asin: 'B0FYPRWPN1',
      startDate: '2026-04-05',
      endDate: '2026-04-11',
      scenario: 'stub-success',
    });
  });
});
