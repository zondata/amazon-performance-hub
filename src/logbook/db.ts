import { getSupabaseClient } from "../db/supabaseClient";
import { LogChangeEntityInput, LogChangeInput, LogChangeRow, LogExperimentInput, LogExperimentRow } from "./types";

export async function insertLogExperiment(params: {
  accountId: string;
  marketplace: string;
  input: LogExperimentInput;
}): Promise<LogExperimentRow> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("log_experiments")
    .insert({
      account_id: params.accountId,
      marketplace: params.marketplace,
      ...params.input,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed inserting log_experiments: ${error.message}`);
  return data as LogExperimentRow;
}

export async function insertLogChange(params: {
  accountId: string;
  marketplace: string;
  input: LogChangeInput;
}): Promise<LogChangeRow> {
  const client = getSupabaseClient();
  const payload: Record<string, unknown> = {
    account_id: params.accountId,
    marketplace: params.marketplace,
    channel: params.input.channel,
    change_type: params.input.change_type,
    summary: params.input.summary,
    why: params.input.why ?? null,
    before_json: params.input.before_json ?? null,
    after_json: params.input.after_json ?? null,
    dedupe_key: params.input.dedupe_key ?? null,
    source: params.input.source ?? "manual",
    source_upload_id: params.input.source_upload_id ?? null,
  };

  if (params.input.occurred_at) {
    payload.occurred_at = params.input.occurred_at;
  }

  const { data, error } = await client
    .from("log_changes")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(`Failed inserting log_changes: ${error.message}`);
  return data as LogChangeRow;
}

export async function upsertLogChangeWithDedupe(params: {
  accountId: string;
  marketplace: string;
  input: LogChangeInput;
}): Promise<LogChangeRow> {
  if (!params.input.dedupe_key) {
    throw new Error("upsertLogChangeWithDedupe requires input.dedupe_key");
  }
  const client = getSupabaseClient();
  const payload: Record<string, unknown> = {
    account_id: params.accountId,
    marketplace: params.marketplace,
    channel: params.input.channel,
    change_type: params.input.change_type,
    summary: params.input.summary,
    why: params.input.why ?? null,
    before_json: params.input.before_json ?? null,
    after_json: params.input.after_json ?? null,
    dedupe_key: params.input.dedupe_key,
    source: params.input.source ?? "manual",
    source_upload_id: params.input.source_upload_id ?? null,
  };

  if (params.input.occurred_at) {
    payload.occurred_at = params.input.occurred_at;
  }

  const { data, error } = await client
    .from("log_changes")
    .upsert(payload, { onConflict: "account_id,dedupe_key", ignoreDuplicates: false })
    .select("*")
    .single();

  if (error) throw new Error(`Failed upserting log_changes: ${error.message}`);
  return data as LogChangeRow;
}

export async function findLogChangeByDedupeKey(params: {
  accountId: string;
  dedupeKey: string;
}): Promise<LogChangeRow | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("log_changes")
    .select("*")
    .eq("account_id", params.accountId)
    .eq("dedupe_key", params.dedupeKey)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed fetching log_changes by dedupe_key: ${error.message}`);
  return (data as LogChangeRow | null) ?? null;
}

export async function insertLogChangeEntities(params: {
  changeId: string;
  entities: LogChangeEntityInput[];
}): Promise<void> {
  if (!params.entities.length) return;
  const client = getSupabaseClient();
  const rows = params.entities.map((entity) => ({
    change_id: params.changeId,
    entity_type: entity.entity_type,
    product_id: entity.product_id ?? null,
    campaign_id: entity.campaign_id ?? null,
    ad_group_id: entity.ad_group_id ?? null,
    target_id: entity.target_id ?? null,
    keyword_id: entity.keyword_id ?? null,
    note: entity.note ?? null,
    extra: entity.extra ?? null,
  }));

  const { error } = await client.from("log_change_entities").insert(rows);
  if (error) throw new Error(`Failed inserting log_change_entities: ${error.message}`);
}

export async function linkExperimentChange(params: {
  experimentId: string;
  changeId: string;
}): Promise<{ status: "linked" | "already linked" }> {
  const client = getSupabaseClient();
  const payload = {
    experiment_id: params.experimentId,
    change_id: params.changeId,
  };

  const { data, error } = await client
    .from("log_experiment_changes")
    .upsert(payload, { onConflict: "experiment_id,change_id", ignoreDuplicates: true })
    .select("experiment_id")
    .maybeSingle();

  if (error) throw new Error(`Failed linking experiment + change: ${error.message}`);
  if (!data) return { status: "already linked" };
  return { status: "linked" };
}

export type LogChangeListRow = {
  id: string;
  occurred_at: string;
  channel: string;
  change_type: string;
  summary: string;
  why: string | null;
  source: string;
  created_at: string;
};

export async function listLogChanges(params: {
  accountId: string;
  marketplace: string;
  limit: number;
}): Promise<LogChangeListRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("log_changes")
    .select("change_id, occurred_at, channel, change_type, summary, why, source, created_at")
    .eq("account_id", params.accountId)
    .eq("marketplace", params.marketplace)
    .order("occurred_at", { ascending: false })
    .limit(params.limit);

  if (error) throw new Error(`Failed listing log_changes: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: (row as { change_id: string }).change_id,
    occurred_at: (row as { occurred_at: string }).occurred_at,
    channel: (row as { channel: string }).channel,
    change_type: (row as { change_type: string }).change_type,
    summary: (row as { summary: string }).summary,
    why: (row as { why: string | null }).why,
    source: (row as { source: string }).source,
    created_at: (row as { created_at: string }).created_at,
  }));
}

export type LogExperimentListRow = {
  id: string;
  name: string;
  objective: string;
  hypothesis: string | null;
  evaluation_lag_days: number | null;
  evaluation_window_days: number | null;
  primary_metrics: unknown;
  guardrails: unknown;
  scope: unknown;
  created_at: string;
};

export async function listLogExperiments(params: {
  accountId: string;
  marketplace: string;
  limit: number;
}): Promise<LogExperimentListRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("log_experiments")
    .select(
      "experiment_id, name, objective, hypothesis, evaluation_lag_days, evaluation_window_days, primary_metrics, guardrails, scope, created_at"
    )
    .eq("account_id", params.accountId)
    .eq("marketplace", params.marketplace)
    .order("created_at", { ascending: false })
    .limit(params.limit);

  if (error) throw new Error(`Failed listing log_experiments: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: (row as { experiment_id: string }).experiment_id,
    name: (row as { name: string }).name,
    objective: (row as { objective: string }).objective,
    hypothesis: (row as { hypothesis: string | null }).hypothesis,
    evaluation_lag_days: (row as { evaluation_lag_days: number | null }).evaluation_lag_days,
    evaluation_window_days: (row as { evaluation_window_days: number | null }).evaluation_window_days,
    primary_metrics: (row as { primary_metrics: unknown }).primary_metrics,
    guardrails: (row as { guardrails: unknown }).guardrails,
    scope: (row as { scope: unknown }).scope,
    created_at: (row as { created_at: string }).created_at,
  }));
}
