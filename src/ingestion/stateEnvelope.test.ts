import { describe, expect, it } from 'vitest';

import {
  InMemoryIngestionJobRepository,
  IngestionJobRunner,
  createStubIngestionExecutor,
} from './jobRunner';
import { IngestionBackfillRunner } from './backfillRunner';
import {
  COLLECTION_STATES,
  FINALIZATION_STATES,
  FRESHNESS_STATES,
  INGESTION_STATE_ENVELOPE_METADATA_KEY,
  IngestionStateEnvelopeError,
  SOURCE_CONFIDENCE_STATES,
  assertCollectionState,
  assertFinalizationState,
  assertFreshnessState,
  assertSourceConfidence,
  deriveCollectionState,
  deriveFinalizationState,
  deriveIngestionStateEnvelope,
  deriveSourceConfidence,
  getIngestionStateEnvelopeFromJob,
  getIngestionStateEnvelopeFromWatermark,
  persistIngestionStateEnvelope,
  readPersistedIngestionStateEnvelope,
} from './stateEnvelope';

const buildNowValues = () => [
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

const buildJobRunnerHarness = (
  steps: Parameters<typeof createStubIngestionExecutor>[0]
) => {
  const repository = new InMemoryIngestionJobRepository();
  const stub = createStubIngestionExecutor(steps);
  let nowIndex = 0;
  let jobIndex = 0;

  const runner = new IngestionJobRunner({
    repository,
    executor: stub.executor,
    now: () => buildNowValues()[Math.min(nowIndex++, buildNowValues().length - 1)],
    createJobId: () => `job-${String(++jobIndex).padStart(3, '0')}`,
  });

  return {
    repository,
    runner,
    getExecutorCallCount: stub.getCallCount,
  };
};

describe('Stage 3 ingestion state envelope', () => {
  it('defines the exact allowed values for all four canonical state families', () => {
    expect(FRESHNESS_STATES).toEqual(['live', 'hourly', 'daily', 'weekly']);
    expect(COLLECTION_STATES).toEqual([
      'requested',
      'processing',
      'available',
      'failed',
    ]);
    expect(FINALIZATION_STATES).toEqual([
      'partial_period',
      'provisional',
      'revisable',
      'final',
    ]);
    expect(SOURCE_CONFIDENCE_STATES).toEqual([
      'high',
      'medium',
      'low',
      'unknown',
    ]);
  });

  it('rejects unsupported state values', () => {
    expect(() => assertFreshnessState('monthly')).toThrowError(
      IngestionStateEnvelopeError
    );
    expect(() => assertCollectionState('queued')).toThrowError(
      IngestionStateEnvelopeError
    );
    expect(() => assertFinalizationState('draft')).toThrowError(
      IngestionStateEnvelopeError
    );
    expect(() => assertSourceConfidence('certain')).toThrowError(
      IngestionStateEnvelopeError
    );
  });

  it('derives collection_state deterministically from current job status', () => {
    expect(deriveCollectionState('requested')).toBe('requested');
    expect(deriveCollectionState('processing')).toBe('processing');
    expect(deriveCollectionState('available')).toBe('available');
    expect(deriveCollectionState('failed')).toBe('failed');
  });

  it('derives finalization_state deterministically for current Stage 3 contexts', () => {
    expect(deriveFinalizationState({ collectionState: 'requested' })).toBe(
      'provisional'
    );
    expect(deriveFinalizationState({ collectionState: 'processing' })).toBe(
      'provisional'
    );
    expect(deriveFinalizationState({ collectionState: 'failed' })).toBe(
      'partial_period'
    );
    expect(deriveFinalizationState({ collectionState: 'available' })).toBe(
      'revisable'
    );
    expect(
      deriveFinalizationState({
        collectionState: 'available',
        finalizationState: 'final',
      })
    ).toBe('final');
  });

  it('derives and defaults source_confidence deterministically', () => {
    expect(deriveSourceConfidence({})).toBe('unknown');
    expect(
      deriveSourceConfidence({
        sourceConfidence: 'high',
      })
    ).toBe('high');
    expect(
      deriveSourceConfidence({
        metadata: {
          state_hints: {
            sourceConfidence: 'medium',
          },
        },
      })
    ).toBe('medium');
  });

  it('builds a stable ingestion state envelope shape', () => {
    const envelope = deriveIngestionStateEnvelope({
      collectionState: 'available',
      sourceCadence: 'weekly',
      finalizationState: 'final',
      sourceConfidence: 'high',
    });

    expect(envelope).toEqual({
      freshnessState: 'weekly',
      collectionState: 'available',
      finalizationState: 'final',
      sourceConfidence: 'high',
    });
    expect(Object.keys(envelope)).toEqual([
      'freshnessState',
      'collectionState',
      'finalizationState',
      'sourceConfidence',
    ]);
  });

  it('persists the expected state envelope shape in metadata storage', () => {
    const envelope = deriveIngestionStateEnvelope({
      collectionState: 'available',
      sourceCadence: 'daily',
      sourceConfidence: 'unknown',
    });
    const metadata = persistIngestionStateEnvelope(
      {
        other: true,
      },
      envelope
    );

    expect(metadata[INGESTION_STATE_ENVELOPE_METADATA_KEY]).toEqual({
      freshnessState: 'daily',
      collectionState: 'available',
      finalizationState: 'revisable',
      sourceConfidence: 'unknown',
    });
    expect(readPersistedIngestionStateEnvelope(metadata)).toEqual(envelope);
  });

  it('existing Stage 3 runner outputs expose a deterministic persisted envelope', async () => {
    const { repository, runner } = buildJobRunnerHarness([
      {
        outcome: 'success',
        rowCount: 11,
        checksum: 'checksum-001',
      },
    ]);

    const result = await runner.submitJob({
      jobKey: 'sp_campaign_daily',
      sourceName: 'ads_api_sp_campaign_daily',
      accountId: 'sourbear',
      marketplace: 'US',
      sourceWindowStart: '2026-04-10T00:00:00.000Z',
      sourceWindowEnd: '2026-04-10T23:59:59.999Z',
      idempotencyKey: 'sp_campaign_daily:sourbear:2026-04-10',
      runKind: 'manual',
      scopeKey: 'account',
      metadata: {
        state_hints: {
          freshnessState: 'daily',
          finalizationState: 'final',
          sourceConfidence: 'high',
        },
      },
    });

    expect(getIngestionStateEnvelopeFromJob(result.job)).toEqual({
      freshnessState: 'daily',
      collectionState: 'available',
      finalizationState: 'final',
      sourceConfidence: 'high',
    });

    const watermark = await repository.findWatermarkByScope({
      sourceName: result.job.source_name,
      accountId: result.job.account_id,
      marketplace: result.job.marketplace,
      scopeKey: 'account',
    });
    expect(watermark).not.toBeNull();
    expect(getIngestionStateEnvelopeFromWatermark(watermark!)).toEqual({
      freshnessState: 'daily',
      collectionState: 'available',
      finalizationState: 'final',
      sourceConfidence: 'high',
    });
  });

  it('existing Stage 3 backfill outputs expose the envelope without live connectors', async () => {
    const { repository, runner, getExecutorCallCount } = buildJobRunnerHarness([
      {
        outcome: 'success',
        rowCount: 7,
        checksum: 'checksum-backfill',
      },
    ]);
    const backfill = new IngestionBackfillRunner({
      repository,
      jobRunner: runner,
    });

    const result = await backfill.runBackfill({
      jobKey: 'sp_campaign_daily',
      sourceName: 'ads_api_sp_campaign_daily',
      accountId: 'sourbear',
      marketplace: 'US',
      rangeStart: '2026-04-10',
      rangeEnd: '2026-04-16',
      sliceUnit: 'week',
      sliceSize: 1,
      runKind: 'manual',
      scopeKey: 'account',
      baseMetadata: {
        state_hints: {
          sourceConfidence: 'medium',
        },
      },
    });

    expect(result.sliceResults[0].stateEnvelope).toEqual({
      freshnessState: 'weekly',
      collectionState: 'available',
      finalizationState: 'revisable',
      sourceConfidence: 'medium',
    });
    expect(getExecutorCallCount()).toBe(1);
  });
});
