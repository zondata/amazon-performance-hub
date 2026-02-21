import type { SupabaseClient } from "@supabase/supabase-js";
import { normText } from "../bulk/parseSponsoredProductsBulk";
import { getSupabaseClient } from "../db/supabaseClient";
import { chunkArray } from "../ingest/utils";

export type BulkgenValidationStatus = "pending" | "validated" | "mismatch" | "not_found";
export type BulkgenValidationMode = "auto" | "manual";

type JsonRecord = Record<string, unknown>;

type ChangeRow = {
  change_id: string;
  account_id: string;
  occurred_at: string;
  change_type: string;
  source: string;
  after_json: unknown | null;
};

type ChangeEntityRow = {
  change_id: string;
  entity_type: string;
  product_id: string | null;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  keyword_id: string | null;
  extra: unknown | null;
};

type UploadRow = {
  upload_id: string;
  account_id: string;
  source_type: string;
  snapshot_date: string | null;
  ingested_at: string;
};

type ExistingValidationRow = {
  change_id: string;
  status: BulkgenValidationStatus;
};

type Channel = "sp" | "sb";

type ExpectedDescriptor =
  | {
      kind: "campaign";
      table: "bulk_campaigns" | "bulk_sb_campaigns";
      channel: Channel;
      campaignId: string;
      expected: JsonRecord;
    }
  | {
      kind: "ad_group";
      table: "bulk_ad_groups" | "bulk_sb_ad_groups";
      channel: Channel;
      adGroupId: string;
      expected: JsonRecord;
    }
  | {
      kind: "target";
      table: "bulk_targets" | "bulk_sb_targets";
      channel: Channel;
      targetId: string;
      expected: JsonRecord;
    }
  | {
      kind: "placement";
      table: "bulk_placements" | "bulk_sb_placements";
      channel: Channel;
      campaignId: string;
      placementCode: string | null;
      placementRawNorm: string | null;
      expected: JsonRecord;
    };

export type ValidationMismatch = {
  field: string;
  expected: unknown;
  actual: unknown;
};

export type ValidationComparisonResult = {
  status: "validated" | "mismatch" | "not_found";
  diff_json: {
    reason?: string;
    matched_fields: string[];
    mismatches: ValidationMismatch[];
    missing_actual_fields: string[];
  };
};

export type ValidateBulkgenChangesParams = {
  accountId: string;
  mode?: BulkgenValidationMode;
  uploadId?: string;
  changeIds?: string[];
  limit?: number;
  client?: SupabaseClient;
};

export type ValidateBulkgenChangesResult = {
  mode: BulkgenValidationMode;
  processed: number;
  pending: number;
  validated: number;
  mismatch: number;
  notFound: number;
};

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseChannel(after: JsonRecord): Channel | null {
  const generator = readString(after.generator);
  if (!generator) return null;
  if (generator.includes(":sp:")) return "sp";
  if (generator.includes(":sb:")) return "sb";
  return null;
}

function pickChangeEntity(changeType: string, entities: ChangeEntityRow[]): ChangeEntityRow | null {
  if (changeType === "bulk_update_campaign") {
    return entities.find((row) => !!row.campaign_id) ?? null;
  }
  if (changeType === "bulk_update_ad_group") {
    return entities.find((row) => !!row.ad_group_id) ?? null;
  }
  if (changeType === "bulk_update_target") {
    return entities.find((row) => !!row.target_id) ?? null;
  }
  if (changeType === "bulk_update_placement") {
    return entities.find((row) => row.entity_type === "placement" && !!row.campaign_id) ?? null;
  }
  return null;
}

function readPlacementIdentity(after: JsonRecord, entity: ChangeEntityRow | null): {
  placementCode: string | null;
  placementRawNorm: string | null;
} {
  const entityExtra = asRecord(entity?.extra ?? null);
  const codeFromAfter = readString(after.placement_code);
  const codeFromExtra = readString(entityExtra?.placement_code);
  const rawNormFromAfter = readString(after.placement_raw_norm);
  const rawNormFromExtra = readString(entityExtra?.placement_raw_norm);
  const rawFromAfter = readString(after.placement_raw);
  const rawFromExtra = readString(entityExtra?.placement_raw);

  const placementCode =
    codeFromAfter?.toUpperCase() ?? codeFromExtra?.toUpperCase() ?? null;
  const placementRawNorm =
    rawNormFromAfter ??
    rawNormFromExtra ??
    (rawFromAfter ? normText(rawFromAfter) : null) ??
    (rawFromExtra ? normText(rawFromExtra) : null);

  return {
    placementCode,
    placementRawNorm,
  };
}

function readExpectedFields(after: JsonRecord, fields: string[]): JsonRecord {
  const expected: JsonRecord = {};
  for (const field of fields) {
    if (!(field in after)) continue;
    expected[field] = after[field];
  }
  return expected;
}

function buildExpectedDescriptor(params: {
  change: ChangeRow;
  entities: ChangeEntityRow[];
}):
  | { ok: true; descriptor: ExpectedDescriptor }
  | { ok: false; reason: string; expected: JsonRecord | null } {
  const after = asRecord(params.change.after_json);
  if (!after) {
    return { ok: false, reason: "after_json_missing_or_invalid", expected: null };
  }

  const channel = parseChannel(after);
  if (!channel) {
    return { ok: false, reason: "generator_missing_or_unsupported", expected: null };
  }

  const entity = pickChangeEntity(params.change.change_type, params.entities);
  const changeType = params.change.change_type;

  if (changeType === "bulk_update_campaign") {
    const campaignId = readString(entity?.campaign_id);
    const expected = readExpectedFields(after, ["daily_budget", "state", "bidding_strategy"]);
    if (!campaignId) {
      return { ok: false, reason: "campaign_id_missing", expected };
    }
    return {
      ok: true,
      descriptor: {
        kind: "campaign",
        table: channel === "sp" ? "bulk_campaigns" : "bulk_sb_campaigns",
        channel,
        campaignId,
        expected,
      },
    };
  }

  if (changeType === "bulk_update_ad_group") {
    const adGroupId = readString(entity?.ad_group_id);
    const expected = readExpectedFields(after, ["default_bid", "state"]);
    if (!adGroupId) {
      return { ok: false, reason: "ad_group_id_missing", expected };
    }
    return {
      ok: true,
      descriptor: {
        kind: "ad_group",
        table: channel === "sp" ? "bulk_ad_groups" : "bulk_sb_ad_groups",
        channel,
        adGroupId,
        expected,
      },
    };
  }

  if (changeType === "bulk_update_target") {
    const targetId = readString(entity?.target_id);
    const expected = readExpectedFields(after, ["bid", "state"]);
    if (!targetId) {
      return { ok: false, reason: "target_id_missing", expected };
    }
    return {
      ok: true,
      descriptor: {
        kind: "target",
        table: channel === "sp" ? "bulk_targets" : "bulk_sb_targets",
        channel,
        targetId,
        expected,
      },
    };
  }

  if (changeType === "bulk_update_placement") {
    const campaignId = readString(entity?.campaign_id);
    const expected = readExpectedFields(after, ["percentage"]);
    const identity = readPlacementIdentity(after, entity);
    if (!campaignId) {
      return { ok: false, reason: "campaign_id_missing", expected };
    }
    if (!identity.placementCode && !identity.placementRawNorm) {
      return { ok: false, reason: "placement_identity_missing", expected };
    }
    return {
      ok: true,
      descriptor: {
        kind: "placement",
        table: channel === "sp" ? "bulk_placements" : "bulk_sb_placements",
        channel,
        campaignId,
        placementCode: identity.placementCode,
        placementRawNorm: identity.placementRawNorm,
        expected,
      },
    };
  }

  return { ok: false, reason: "unsupported_change_type", expected: null };
}

function normalizeComparable(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;
    return trimmed.toLowerCase();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function equalsNormalized(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) < 1e-9;
  }
  return left === right;
}

export function compareExpectedToActual(params: {
  expected: JsonRecord;
  actual: JsonRecord | null;
}): ValidationComparisonResult {
  if (!params.actual) {
    return {
      status: "not_found",
      diff_json: {
        reason: "entity_not_found",
        matched_fields: [],
        mismatches: [],
        missing_actual_fields: Object.keys(params.expected),
      },
    };
  }

  const mismatches: ValidationMismatch[] = [];
  const matchedFields: string[] = [];
  const missingFields: string[] = [];

  for (const field of Object.keys(params.expected)) {
    const expectedValue = params.expected[field];
    if (!(field in params.actual)) {
      missingFields.push(field);
      continue;
    }
    const actualValue = params.actual[field];
    const expectedNorm = normalizeComparable(expectedValue);
    const actualNorm = normalizeComparable(actualValue);
    if (equalsNormalized(expectedNorm, actualNorm)) {
      matchedFields.push(field);
      continue;
    }
    mismatches.push({
      field,
      expected: expectedValue,
      actual: actualValue,
    });
  }

  if (mismatches.length === 0 && missingFields.length === 0) {
    return {
      status: "validated",
      diff_json: {
        matched_fields: matchedFields,
        mismatches: [],
        missing_actual_fields: [],
      },
    };
  }

  return {
    status: "mismatch",
    diff_json: {
      matched_fields: matchedFields,
      mismatches,
      missing_actual_fields: missingFields,
    },
  };
}

async function fetchChanges(params: {
  client: SupabaseClient;
  accountId: string;
  changeIds?: string[];
  uploadIngestedAt?: string | null;
}): Promise<ChangeRow[]> {
  if (params.changeIds && params.changeIds.length > 0) {
    const rows: ChangeRow[] = [];
    for (const chunk of chunkArray(params.changeIds, 200)) {
      const { data, error } = await params.client
        .from("log_changes")
        .select("change_id,account_id,occurred_at,change_type,source,after_json")
        .eq("account_id", params.accountId)
        .eq("source", "bulkgen")
        .in("change_id", chunk);
      if (error) {
        throw new Error(`Failed loading log_changes by ids: ${error.message}`);
      }
      rows.push(...((data ?? []) as ChangeRow[]));
    }
    return rows;
  }

  let query = params.client
    .from("log_changes")
    .select("change_id,account_id,occurred_at,change_type,source,after_json")
    .eq("account_id", params.accountId)
    .eq("source", "bulkgen")
    .order("occurred_at", { ascending: true })
    .limit(5000);

  if (params.uploadIngestedAt) {
    query = query.lt("occurred_at", params.uploadIngestedAt);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed loading bulkgen log_changes: ${error.message}`);
  }
  return (data ?? []) as ChangeRow[];
}

async function fetchChangeEntities(params: {
  client: SupabaseClient;
  changeIds: string[];
}): Promise<Map<string, ChangeEntityRow[]>> {
  const out = new Map<string, ChangeEntityRow[]>();
  if (!params.changeIds.length) return out;

  for (const chunk of chunkArray(params.changeIds, 200)) {
    const { data, error } = await params.client
      .from("log_change_entities")
      .select("change_id,entity_type,product_id,campaign_id,ad_group_id,target_id,keyword_id,extra")
      .in("change_id", chunk)
      .order("created_at", { ascending: false });
    if (error) {
      throw new Error(`Failed loading log_change_entities: ${error.message}`);
    }
    for (const row of (data ?? []) as ChangeEntityRow[]) {
      const rows = out.get(row.change_id) ?? [];
      rows.push(row);
      out.set(row.change_id, rows);
    }
  }

  return out;
}

async function fetchExistingValidations(params: {
  client: SupabaseClient;
  changeIds: string[];
}): Promise<Map<string, ExistingValidationRow>> {
  const out = new Map<string, ExistingValidationRow>();
  if (!params.changeIds.length) return out;

  for (const chunk of chunkArray(params.changeIds, 200)) {
    const { data, error } = await params.client
      .from("log_change_validations")
      .select("change_id,status")
      .in("change_id", chunk);
    if (error) {
      throw new Error(`Failed loading existing validations: ${error.message}`);
    }
    for (const row of (data ?? []) as ExistingValidationRow[]) {
      out.set(row.change_id, row);
    }
  }

  return out;
}

async function fetchBulkUploads(params: {
  client: SupabaseClient;
  accountId: string;
}): Promise<UploadRow[]> {
  const { data, error } = await params.client
    .from("uploads")
    .select("upload_id,account_id,source_type,snapshot_date,ingested_at")
    .eq("account_id", params.accountId)
    .eq("source_type", "bulk")
    .not("snapshot_date", "is", null)
    .order("ingested_at", { ascending: true })
    .limit(10000);
  if (error) {
    throw new Error(`Failed loading bulk uploads: ${error.message}`);
  }
  return (data ?? []) as UploadRow[];
}

async function fetchAnchorUpload(params: {
  client: SupabaseClient;
  accountId: string;
  uploadId?: string;
}): Promise<UploadRow | null> {
  if (!params.uploadId) return null;
  const { data, error } = await params.client
    .from("uploads")
    .select("upload_id,account_id,source_type,snapshot_date,ingested_at")
    .eq("account_id", params.accountId)
    .eq("source_type", "bulk")
    .eq("upload_id", params.uploadId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed loading upload_id ${params.uploadId}: ${error.message}`);
  }
  return (data as UploadRow | null) ?? null;
}

function pickUploadForChange(params: {
  mode: BulkgenValidationMode;
  uploads: UploadRow[];
  changeOccurredAt: string;
}): UploadRow | null {
  if (params.mode === "manual") {
    if (!params.uploads.length) return null;
    return [...params.uploads].sort((left, right) => {
      const leftSnapshot = left.snapshot_date ?? "";
      const rightSnapshot = right.snapshot_date ?? "";
      if (leftSnapshot !== rightSnapshot) {
        return rightSnapshot.localeCompare(leftSnapshot);
      }
      return right.ingested_at.localeCompare(left.ingested_at);
    })[0];
  }

  const occurredAtMs = new Date(params.changeOccurredAt).getTime();
  if (!Number.isFinite(occurredAtMs)) return null;
  for (const upload of params.uploads) {
    const ingestedAtMs = new Date(upload.ingested_at).getTime();
    if (!Number.isFinite(ingestedAtMs)) continue;
    if (ingestedAtMs > occurredAtMs) return upload;
  }
  return null;
}

function upsertValidationPayload(params: {
  changeId: string;
  status: BulkgenValidationStatus;
  expectedJson: JsonRecord | null;
  actualJson: JsonRecord | null;
  diffJson: JsonRecord;
  upload: UploadRow | null;
}): Record<string, unknown> {
  return {
    change_id: params.changeId,
    status: params.status,
    expected_json: params.expectedJson,
    actual_json: params.actualJson,
    diff_json: params.diffJson,
    validated_upload_id: params.upload?.upload_id ?? null,
    validated_snapshot_date: params.upload?.snapshot_date ?? null,
    checked_at: new Date().toISOString(),
  };
}

async function upsertValidation(params: {
  client: SupabaseClient;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { error } = await params.client
    .from("log_change_validations")
    .upsert(params.payload, { onConflict: "change_id", ignoreDuplicates: false });
  if (error) {
    throw new Error(`Failed upserting log_change_validations: ${error.message}`);
  }
}

function extractActualFields(row: JsonRecord, expected: JsonRecord): JsonRecord {
  const out: JsonRecord = {};
  for (const field of Object.keys(expected)) {
    out[field] = field in row ? row[field] : null;
  }
  return out;
}

type RowLoader = (params: {
  accountId: string;
  snapshotDate: string;
  descriptor: ExpectedDescriptor;
}) => Promise<JsonRecord | null>;

function buildRowLoader(client: SupabaseClient): RowLoader {
  const cache = new Map<string, JsonRecord | null>();

  return async ({ accountId, snapshotDate, descriptor }) => {
    let cacheKey = `${descriptor.table}::${snapshotDate}`;
    if (descriptor.kind === "campaign") {
      cacheKey += `::campaign_id=${descriptor.campaignId}`;
    } else if (descriptor.kind === "ad_group") {
      cacheKey += `::ad_group_id=${descriptor.adGroupId}`;
    } else if (descriptor.kind === "target") {
      cacheKey += `::target_id=${descriptor.targetId}`;
    } else {
      cacheKey += `::campaign_id=${descriptor.campaignId}::placement_code=${
        descriptor.placementCode ?? ""
      }::placement_raw_norm=${descriptor.placementRawNorm ?? ""}`;
    }

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey) ?? null;
    }

    let query = client
      .from(descriptor.table)
      .select("*")
      .eq("account_id", accountId)
      .eq("snapshot_date", snapshotDate);

    if (descriptor.kind === "campaign") {
      query = query.eq("campaign_id", descriptor.campaignId);
    } else if (descriptor.kind === "ad_group") {
      query = query.eq("ad_group_id", descriptor.adGroupId);
    } else if (descriptor.kind === "target") {
      query = query.eq("target_id", descriptor.targetId);
    } else {
      query = query.eq("campaign_id", descriptor.campaignId);
      if (descriptor.placementCode) {
        query = query.eq("placement_code", descriptor.placementCode);
      }
      if (descriptor.placementRawNorm && descriptor.table === "bulk_sb_placements") {
        query = query.eq("placement_raw_norm", descriptor.placementRawNorm);
      }
      if (descriptor.placementRawNorm && descriptor.table === "bulk_placements") {
        query = query.ilike("placement_raw", descriptor.placementRawNorm);
      }
    }

    const { data, error } = await query.limit(5);
    if (error) {
      throw new Error(`Failed loading ${descriptor.table}: ${error.message}`);
    }

    const rows = (data ?? []) as JsonRecord[];
    let picked: JsonRecord | null = rows[0] ?? null;

    if (
      descriptor.kind === "placement" &&
      picked &&
      descriptor.placementRawNorm &&
      descriptor.table === "bulk_placements"
    ) {
      picked =
        rows.find((row) => {
          const raw = readString(row.placement_raw);
          return raw ? normText(raw) === descriptor.placementRawNorm : false;
        }) ?? null;
    }

    cache.set(cacheKey, picked);
    return picked;
  };
}

export async function validateBulkgenChanges(
  params: ValidateBulkgenChangesParams
): Promise<ValidateBulkgenChangesResult> {
  const mode = params.mode ?? "auto";
  const limit = params.limit ?? 500;
  const client = params.client ?? getSupabaseClient();

  const anchorUpload = await fetchAnchorUpload({
    client,
    accountId: params.accountId,
    uploadId: params.uploadId,
  });

  const candidateChanges = await fetchChanges({
    client,
    accountId: params.accountId,
    changeIds: params.changeIds,
    uploadIngestedAt: mode === "auto" ? anchorUpload?.ingested_at ?? null : null,
  });

  if (!candidateChanges.length) {
    return {
      mode,
      processed: 0,
      pending: 0,
      validated: 0,
      mismatch: 0,
      notFound: 0,
    };
  }

  const existingValidations = await fetchExistingValidations({
    client,
    changeIds: candidateChanges.map((row) => row.change_id),
  });

  let queued = candidateChanges;
  if (mode === "auto" && !params.changeIds?.length) {
    queued = candidateChanges.filter((change) => {
      const existing = existingValidations.get(change.change_id);
      if (!existing) return true;
      return existing.status === "pending";
    });
  }

  queued = queued
    .sort((left, right) => left.occurred_at.localeCompare(right.occurred_at))
    .slice(0, Math.max(limit, 1));

  if (!queued.length) {
    return {
      mode,
      processed: 0,
      pending: 0,
      validated: 0,
      mismatch: 0,
      notFound: 0,
    };
  }

  const uploads = await fetchBulkUploads({ client, accountId: params.accountId });
  const entitiesByChangeId = await fetchChangeEntities({
    client,
    changeIds: queued.map((row) => row.change_id),
  });
  const loadRow = buildRowLoader(client);

  let pending = 0;
  let validated = 0;
  let mismatch = 0;
  let notFound = 0;

  for (const change of queued) {
    const upload = pickUploadForChange({
      mode,
      uploads,
      changeOccurredAt: change.occurred_at,
    });

    if (!upload?.snapshot_date) {
      pending += 1;
      await upsertValidation({
        client,
        payload: upsertValidationPayload({
          changeId: change.change_id,
          status: "pending",
          expectedJson: null,
          actualJson: null,
          diffJson: { reason: "no_bulk_upload_available" },
          upload: null,
        }),
      });
      continue;
    }

    const entities = entitiesByChangeId.get(change.change_id) ?? [];
    const expectedDescriptor = buildExpectedDescriptor({ change, entities });
    if (!expectedDescriptor.ok) {
      pending += 1;
      await upsertValidation({
        client,
        payload: upsertValidationPayload({
          changeId: change.change_id,
          status: "pending",
          expectedJson: expectedDescriptor.expected,
          actualJson: null,
          diffJson: { reason: expectedDescriptor.reason },
          upload,
        }),
      });
      continue;
    }

    const expected = expectedDescriptor.descriptor.expected;
    const row = await loadRow({
      accountId: params.accountId,
      snapshotDate: upload.snapshot_date,
      descriptor: expectedDescriptor.descriptor,
    });
    const actual = row ? extractActualFields(row, expected) : null;
    const compared = compareExpectedToActual({ expected, actual });

    let status: BulkgenValidationStatus = compared.status;
    if (status === "validated") validated += 1;
    if (status === "mismatch") mismatch += 1;
    if (status === "not_found") notFound += 1;

    await upsertValidation({
      client,
      payload: upsertValidationPayload({
        changeId: change.change_id,
        status,
        expectedJson: expected,
        actualJson: actual,
        diffJson: compared.diff_json as JsonRecord,
        upload,
      }),
    });
  }

  return {
    mode,
    processed: queued.length,
    pending,
    validated,
    mismatch,
    notFound,
  };
}
