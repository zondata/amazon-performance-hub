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
