import 'server-only';

type ImportSourceStatusClient = {
  from(table: string): any;
};

type H10ImportIngestResult = {
  status: 'ok' | 'already ingested';
  uploadId?: string;
  rowCount?: number;
};

export const H10_ALREADY_INGESTED_MESSAGE =
  'This CSV was already ingested. No new rows were imported.';
export const H10_NO_MAPPING_REQUIRED_MESSAGE =
  'No mapping step required for H10 keyword tracker.';

export async function upsertH10KeywordTrackerImportSourceStatus(params: {
  client: ImportSourceStatusClient;
  accountId: string;
  originalFilename: string;
  ingestResult: H10ImportIngestResult;
  attemptedAt?: string;
}) {
  const attemptedAt = params.attemptedAt ?? new Date().toISOString();

  const { data, error } = await params.client
    .from('import_source_status')
    .upsert(
      {
        account_id: params.accountId,
        source_type: 'h10_keyword_tracker',
        last_attempted_at: attemptedAt,
        last_original_filename: params.originalFilename,
        last_upload_id: params.ingestResult.uploadId ?? null,
        ingest_status: params.ingestResult.status,
        ingest_row_count: params.ingestResult.rowCount ?? null,
        ingest_message:
          params.ingestResult.status === 'already ingested'
            ? H10_ALREADY_INGESTED_MESSAGE
            : null,
        map_status: 'not_required',
        map_fact_rows: null,
        map_issue_rows: null,
        map_message: H10_NO_MAPPING_REQUIRED_MESSAGE,
        unresolved: false,
        updated_at: attemptedAt,
      },
      { onConflict: 'account_id,source_type' }
    )
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed upserting import_source_status: ${error.message}`);
  }

  return data;
}
