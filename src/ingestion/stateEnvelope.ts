import type {
  IngestionJobRecord,
  IngestionProcessingStatus,
  SourceWatermarkRecord,
} from './schemaContract';

export const FRESHNESS_STATES = ['live', 'hourly', 'daily', 'weekly'] as const;
export const COLLECTION_STATES = [
  'requested',
  'processing',
  'available',
  'failed',
] as const;
export const FINALIZATION_STATES = [
  'partial_period',
  'provisional',
  'revisable',
  'final',
] as const;
export const SOURCE_CONFIDENCE_STATES = [
  'high',
  'medium',
  'low',
  'unknown',
] as const;

export type FreshnessState = (typeof FRESHNESS_STATES)[number];
export type CollectionState = (typeof COLLECTION_STATES)[number];
export type FinalizationState = (typeof FINALIZATION_STATES)[number];
export type SourceConfidence = (typeof SOURCE_CONFIDENCE_STATES)[number];

export interface IngestionStateEnvelope {
  freshnessState: FreshnessState;
  collectionState: CollectionState;
  finalizationState: FinalizationState;
  sourceConfidence: SourceConfidence;
}

export interface IngestionStateHints {
  freshnessState?: FreshnessState;
  sourceCadence?: FreshnessState;
  finalizationState?: FinalizationState;
  sourceConfidence?: SourceConfidence;
}

export const INGESTION_STATE_ENVELOPE_METADATA_KEY = 'state_envelope';
export const INGESTION_STATE_HINTS_METADATA_KEY = 'state_hints';

type JsonObject = IngestionJobRecord['metadata'];
type JsonValue = JsonObject[string];

export class IngestionStateEnvelopeError extends Error {
  readonly code: 'invalid_state';

  constructor(message: string) {
    super(message);
    this.name = 'IngestionStateEnvelopeError';
    this.code = 'invalid_state';
  }
}

const asObject = (value: JsonValue | undefined): JsonObject | null =>
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const assertAllowed = <T extends readonly string[]>(
  value: string,
  values: T,
  field: string
): T[number] => {
  if (!(values as readonly string[]).includes(value)) {
    throw new IngestionStateEnvelopeError(
      `${field} must be one of: ${values.join(', ')}`
    );
  }

  return value as T[number];
};

export const isFreshnessState = (value: string): value is FreshnessState =>
  (FRESHNESS_STATES as readonly string[]).includes(value);

export const isCollectionState = (value: string): value is CollectionState =>
  (COLLECTION_STATES as readonly string[]).includes(value);

export const isFinalizationState = (
  value: string
): value is FinalizationState =>
  (FINALIZATION_STATES as readonly string[]).includes(value);

export const isSourceConfidence = (
  value: string
): value is SourceConfidence =>
  (SOURCE_CONFIDENCE_STATES as readonly string[]).includes(value);

export const assertFreshnessState = (value: string): FreshnessState =>
  assertAllowed(value, FRESHNESS_STATES, 'freshnessState');

export const assertCollectionState = (value: string): CollectionState =>
  assertAllowed(value, COLLECTION_STATES, 'collectionState');

export const assertFinalizationState = (value: string): FinalizationState =>
  assertAllowed(value, FINALIZATION_STATES, 'finalizationState');

export const assertSourceConfidence = (value: string): SourceConfidence =>
  assertAllowed(value, SOURCE_CONFIDENCE_STATES, 'sourceConfidence');

const readHints = (
  metadata: JsonObject | undefined
): IngestionStateHints | null => {
  if (!metadata) {
    return null;
  }

  const directHints = asObject(metadata[INGESTION_STATE_HINTS_METADATA_KEY]);
  const requestMetadata = asObject(metadata.request_metadata);
  const nestedHints = requestMetadata
    ? asObject(requestMetadata[INGESTION_STATE_HINTS_METADATA_KEY])
    : null;

  const raw = directHints ?? nestedHints;
  if (!raw) {
    return null;
  }

  const hints: IngestionStateHints = {};

  if (typeof raw.freshnessState === 'string') {
    hints.freshnessState = assertFreshnessState(raw.freshnessState);
  }

  if (typeof raw.sourceCadence === 'string') {
    hints.sourceCadence = assertFreshnessState(raw.sourceCadence);
  }

  if (typeof raw.finalizationState === 'string') {
    hints.finalizationState = assertFinalizationState(raw.finalizationState);
  }

  if (typeof raw.sourceConfidence === 'string') {
    hints.sourceConfidence = assertSourceConfidence(raw.sourceConfidence);
  }

  return hints;
};

export const readPersistedIngestionStateEnvelope = (
  metadata: JsonObject | undefined
): IngestionStateEnvelope | null => {
  if (!metadata) {
    return null;
  }

  const raw = asObject(metadata[INGESTION_STATE_ENVELOPE_METADATA_KEY]);
  if (!raw) {
    return null;
  }

  return {
    freshnessState: assertFreshnessState(String(raw.freshnessState)),
    collectionState: assertCollectionState(String(raw.collectionState)),
    finalizationState: assertFinalizationState(String(raw.finalizationState)),
    sourceConfidence: assertSourceConfidence(String(raw.sourceConfidence)),
  };
};

export const persistIngestionStateEnvelope = (
  metadata: JsonObject | undefined,
  envelope: IngestionStateEnvelope
): JsonObject => ({
  ...(cloneJson(metadata ?? {}) as JsonObject),
  [INGESTION_STATE_ENVELOPE_METADATA_KEY]: {
    ...envelope,
  },
});

export const deriveCollectionState = (
  value: CollectionState | IngestionProcessingStatus
): CollectionState => assertCollectionState(String(value));

export const deriveFreshnessState = (args: {
  metadata?: JsonObject;
  sourceCadence?: string | null;
}): FreshnessState => {
  const hints = readHints(args.metadata);

  if (hints?.freshnessState) {
    return hints.freshnessState;
  }

  if (typeof args.sourceCadence === 'string' && args.sourceCadence.trim()) {
    return assertFreshnessState(args.sourceCadence);
  }

  if (hints?.sourceCadence) {
    return hints.sourceCadence;
  }

  return 'daily';
};

export const deriveFinalizationState = (args: {
  collectionState: CollectionState | IngestionProcessingStatus;
  metadata?: JsonObject;
  finalizationState?: string | null;
}): FinalizationState => {
  const collectionState = deriveCollectionState(args.collectionState);
  const hints = readHints(args.metadata);

  if (typeof args.finalizationState === 'string' && args.finalizationState.trim()) {
    return assertFinalizationState(args.finalizationState);
  }

  if (hints?.finalizationState) {
    return hints.finalizationState;
  }

  if (collectionState === 'failed') {
    return 'partial_period';
  }

  if (collectionState === 'requested' || collectionState === 'processing') {
    return 'provisional';
  }

  return 'revisable';
};

export const deriveSourceConfidence = (args: {
  metadata?: JsonObject;
  sourceConfidence?: string | null;
}): SourceConfidence => {
  const hints = readHints(args.metadata);

  if (typeof args.sourceConfidence === 'string' && args.sourceConfidence.trim()) {
    return assertSourceConfidence(args.sourceConfidence);
  }

  if (hints?.sourceConfidence) {
    return hints.sourceConfidence;
  }

  return 'unknown';
};

export const deriveIngestionStateEnvelope = (args: {
  collectionState: CollectionState | IngestionProcessingStatus;
  metadata?: JsonObject;
  sourceCadence?: string | null;
  finalizationState?: string | null;
  sourceConfidence?: string | null;
}): IngestionStateEnvelope => {
  const collectionState = deriveCollectionState(args.collectionState);

  return {
    freshnessState: deriveFreshnessState({
      metadata: args.metadata,
      sourceCadence: args.sourceCadence,
    }),
    collectionState,
    finalizationState: deriveFinalizationState({
      collectionState,
      metadata: args.metadata,
      finalizationState: args.finalizationState,
    }),
    sourceConfidence: deriveSourceConfidence({
      metadata: args.metadata,
      sourceConfidence: args.sourceConfidence,
    }),
  };
};

export const getIngestionStateEnvelopeFromJob = (
  job: Pick<IngestionJobRecord, 'processing_status' | 'metadata'>
): IngestionStateEnvelope =>
  readPersistedIngestionStateEnvelope(job.metadata) ??
  deriveIngestionStateEnvelope({
    collectionState: job.processing_status,
    metadata: job.metadata,
  });

export const getIngestionStateEnvelopeFromWatermark = (
  watermark: Pick<SourceWatermarkRecord, 'status' | 'metadata'>
): IngestionStateEnvelope | null => {
  const persisted = readPersistedIngestionStateEnvelope(watermark.metadata);
  if (persisted) {
    return persisted;
  }

  if (watermark.status === 'requested' || watermark.status === 'available' || watermark.status === 'failed') {
    return deriveIngestionStateEnvelope({
      collectionState: watermark.status,
      metadata: watermark.metadata,
    });
  }

  return null;
};

export const summarizeIngestionStateEnvelope = (
  envelope: IngestionStateEnvelope
): string =>
  JSON.stringify({
    freshnessState: envelope.freshnessState,
    collectionState: envelope.collectionState,
    finalizationState: envelope.finalizationState,
    sourceConfidence: envelope.sourceConfidence,
  });
