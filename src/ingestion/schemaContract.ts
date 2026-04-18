export const INGESTION_PROCESSING_STATUSES = [
  'requested',
  'processing',
  'available',
  'failed',
] as const;

export const SOURCE_WATERMARK_STATUSES = [
  'unknown',
  'requested',
  'available',
  'failed',
] as const;

export type IngestionProcessingStatus =
  (typeof INGESTION_PROCESSING_STATUSES)[number];

export type IngestionRunKind = string;

export type SourceWatermarkStatus = (typeof SOURCE_WATERMARK_STATUSES)[number];

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export const INGESTION_JOB_RECORD_FIELDS = [
  'id',
  'job_key',
  'source_name',
  'account_id',
  'marketplace',
  'requested_at',
  'source_window_start',
  'source_window_end',
  'retrieved_at',
  'started_at',
  'finished_at',
  'processing_status',
  'run_kind',
  'idempotency_key',
  'checksum',
  'row_count',
  'error_code',
  'error_message',
  'metadata',
  'created_at',
  'updated_at',
] as const;

export const SOURCE_WATERMARK_RECORD_FIELDS = [
  'id',
  'source_name',
  'account_id',
  'marketplace',
  'scope_key',
  'last_requested_at',
  'last_available_at',
  'last_success_at',
  'last_job_id',
  'watermark_start',
  'watermark_end',
  'status',
  'notes',
  'metadata',
  'created_at',
  'updated_at',
] as const;

export interface IngestionJobRecord {
  id: string;
  job_key: string;
  source_name: string;
  account_id: string | null;
  marketplace: string | null;
  requested_at: string;
  source_window_start: string | null;
  source_window_end: string | null;
  retrieved_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  processing_status: IngestionProcessingStatus;
  run_kind: IngestionRunKind;
  idempotency_key: string;
  checksum: string | null;
  row_count: number | null;
  error_code: string | null;
  error_message: string | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface SourceWatermarkRecord {
  id: string;
  source_name: string;
  account_id: string | null;
  marketplace: string | null;
  scope_key: string;
  last_requested_at: string | null;
  last_available_at: string | null;
  last_success_at: string | null;
  last_job_id: string | null;
  watermark_start: string | null;
  watermark_end: string | null;
  status: SourceWatermarkStatus;
  notes: string | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
}

export const isIngestionProcessingStatus = (
  value: string
): value is IngestionProcessingStatus =>
  (INGESTION_PROCESSING_STATUSES as readonly string[]).includes(value);

export const isSourceWatermarkStatus = (
  value: string
): value is SourceWatermarkStatus =>
  (SOURCE_WATERMARK_STATUSES as readonly string[]).includes(value);
