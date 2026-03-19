import { getSupabaseClient } from "../db/supabaseClient";

export type ImportIngestStatus = "ok" | "already ingested" | "error";
export type ImportMapStatus = "ok" | "not_required" | "missing_snapshot" | "skipped" | "error";

export type ImportSourceStatusRow = {
  account_id: string;
  source_type: string;
  last_attempted_at: string;
  last_original_filename: string | null;
  last_upload_id: string | null;
  ingest_status: ImportIngestStatus;
  ingest_row_count: number | null;
  ingest_message: string | null;
  map_status: ImportMapStatus;
  map_fact_rows: number | null;
  map_issue_rows: number | null;
  map_message: string | null;
  unresolved: boolean;
  created_at: string;
  updated_at: string;
};

export type UpsertImportSourceStatusParams = {
  account_id: string;
  source_type: string;
  last_attempted_at?: string;
  last_original_filename?: string | null;
  last_upload_id?: string | null;
  ingest_status?: ImportIngestStatus;
  ingest_row_count?: number | null;
  ingest_message?: string | null;
  map_status?: ImportMapStatus;
  map_fact_rows?: number | null;
  map_issue_rows?: number | null;
  map_message?: string | null;
};

const DEFAULT_INGEST_STATUS: ImportIngestStatus = "ok";
const DEFAULT_MAP_STATUS: ImportMapStatus = "not_required";

const hasOwn = <T extends object>(value: T, key: keyof T) =>
  Object.prototype.hasOwnProperty.call(value, key);

const resolveUnresolved = (params: {
  ingestStatus: ImportIngestStatus;
  mapStatus: ImportMapStatus;
}) => {
  if (params.ingestStatus === "error") return true;
  if (
    params.mapStatus === "missing_snapshot"
    || params.mapStatus === "skipped"
    || params.mapStatus === "error"
  ) {
    return true;
  }
  if (
    (params.ingestStatus === "ok" || params.ingestStatus === "already ingested")
    && (params.mapStatus === "ok" || params.mapStatus === "not_required")
  ) {
    return false;
  }
  return false;
};

async function fetchExistingStatus(
  accountId: string,
  sourceType: string
): Promise<ImportSourceStatusRow | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("import_source_status")
    .select("*")
    .eq("account_id", accountId)
    .eq("source_type", sourceType)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed fetching import_source_status: ${error.message}`);
  }

  return (data as ImportSourceStatusRow | null) ?? null;
}

export async function upsertImportSourceStatus(
  params: UpsertImportSourceStatusParams
): Promise<ImportSourceStatusRow> {
  const existing = await fetchExistingStatus(params.account_id, params.source_type);
  const nowIso = new Date().toISOString();
  const ingestStatus = params.ingest_status ?? existing?.ingest_status ?? DEFAULT_INGEST_STATUS;
  const mapStatus = params.map_status ?? existing?.map_status ?? DEFAULT_MAP_STATUS;

  const ingestMessage =
    hasOwn(params, "ingest_message")
      ? params.ingest_message ?? null
      : params.ingest_status && params.ingest_status !== "error"
        ? null
        : existing?.ingest_message ?? null;

  const mapMessage =
    hasOwn(params, "map_message")
      ? params.map_message ?? null
      : params.map_status && params.map_status !== "error"
        ? null
        : existing?.map_message ?? null;

  const nextRow = {
    account_id: params.account_id,
    source_type: params.source_type,
    last_attempted_at: params.last_attempted_at ?? nowIso,
    last_original_filename: hasOwn(params, "last_original_filename")
      ? params.last_original_filename ?? null
      : existing?.last_original_filename ?? null,
    last_upload_id: hasOwn(params, "last_upload_id")
      ? params.last_upload_id ?? null
      : existing?.last_upload_id ?? null,
    ingest_status: ingestStatus,
    ingest_row_count: hasOwn(params, "ingest_row_count")
      ? params.ingest_row_count ?? null
      : existing?.ingest_row_count ?? null,
    ingest_message: ingestMessage,
    map_status: mapStatus,
    map_fact_rows: hasOwn(params, "map_fact_rows")
      ? params.map_fact_rows ?? null
      : existing?.map_fact_rows ?? null,
    map_issue_rows: hasOwn(params, "map_issue_rows")
      ? params.map_issue_rows ?? null
      : existing?.map_issue_rows ?? null,
    map_message: mapMessage,
    unresolved: resolveUnresolved({ ingestStatus, mapStatus }),
    updated_at: nowIso,
  };

  const client = getSupabaseClient();
  const { data, error } = await client
    .from("import_source_status")
    .upsert(nextRow, { onConflict: "account_id,source_type" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed upserting import_source_status: ${error.message}`);
  }

  return data as ImportSourceStatusRow;
}

export async function getImportSourceStatuses(accountId: string): Promise<ImportSourceStatusRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("import_source_status")
    .select("*")
    .eq("account_id", accountId)
    .order("source_type", { ascending: true });

  if (error) {
    throw new Error(`Failed fetching import_source_status rows: ${error.message}`);
  }

  return (data as ImportSourceStatusRow[] | null) ?? [];
}
