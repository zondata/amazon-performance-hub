'use server';

import 'server-only';

import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  parseProductExperimentOutputPack,
  ParsedProductExperimentOutputPack,
} from "./parseProductExperimentOutputPack";

type ImportInput = {
  fileText: string;
  currentAsin: string;
};

export type ImportProductExperimentOutputPackResult = {
  ok: boolean;
  created_experiment_id?: string;
  created_change_ids_count: number;
  error?: string;
};

const toEntityRows = (params: {
  changeId: string;
  entities: ParsedProductExperimentOutputPack["manual_changes"][number]["entities"];
}) =>
  params.entities.map((entity) => ({
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

export const importProductExperimentOutputPack = async ({
  fileText,
  currentAsin,
}: ImportInput): Promise<ImportProductExperimentOutputPackResult> => {
  const parsed = parseProductExperimentOutputPack(fileText, currentAsin);
  if (!parsed.ok) {
    return {
      ok: false,
      created_change_ids_count: 0,
      error: parsed.error,
    };
  }

  try {
    const experimentPayload = parsed.value.experiment;
    const { data: experimentRow, error: experimentError } = await supabaseAdmin
      .from("log_experiments")
      .insert({
        account_id: env.accountId,
        marketplace: env.marketplace,
        name: experimentPayload.name,
        objective: experimentPayload.objective,
        hypothesis: experimentPayload.hypothesis ?? null,
        evaluation_lag_days: experimentPayload.evaluation_lag_days ?? null,
        evaluation_window_days: experimentPayload.evaluation_window_days ?? null,
        primary_metrics: experimentPayload.primary_metrics ?? null,
        guardrails: experimentPayload.guardrails ?? null,
        scope: experimentPayload.scope,
      })
      .select("experiment_id")
      .single();

    if (experimentError || !experimentRow?.experiment_id) {
      throw new Error(`Failed creating experiment: ${experimentError?.message ?? "unknown error"}`);
    }

    let createdChanges = 0;
    const experimentId = experimentRow.experiment_id as string;

    for (const change of parsed.value.manual_changes) {
      const { data: changeRow, error: changeError } = await supabaseAdmin
        .from("log_changes")
        .insert({
          account_id: env.accountId,
          marketplace: env.marketplace,
          channel: change.channel,
          change_type: change.change_type,
          summary: change.summary,
          why: change.why ?? null,
          source: "ai_output_pack",
        })
        .select("change_id")
        .single();

      if (changeError || !changeRow?.change_id) {
        throw new Error(`Failed creating manual change: ${changeError?.message ?? "unknown error"}`);
      }

      const changeId = changeRow.change_id as string;
      createdChanges += 1;

      const entityRows = toEntityRows({
        changeId,
        entities: change.entities,
      });
      if (entityRows.length > 0) {
        const { error: entitiesError } = await supabaseAdmin.from("log_change_entities").insert(entityRows);
        if (entitiesError) {
          throw new Error(`Failed creating manual change entities: ${entitiesError.message}`);
        }
      }

      const { error: linkError } = await supabaseAdmin.from("log_experiment_changes").insert({
        experiment_id: experimentId,
        change_id: changeId,
      });
      if (linkError) {
        throw new Error(`Failed linking manual change to experiment: ${linkError.message}`);
      }
    }

    return {
      ok: true,
      created_experiment_id: experimentId,
      created_change_ids_count: createdChanges,
    };
  } catch (error) {
    return {
      ok: false,
      created_change_ids_count: 0,
      error: error instanceof Error ? error.message : "Unknown import error.",
    };
  }
};
