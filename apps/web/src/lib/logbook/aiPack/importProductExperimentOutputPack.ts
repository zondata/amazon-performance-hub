'use server';

import 'server-only';

import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  parseProductExperimentOutputPack,
  ParsedProductExperimentOutputPack,
} from "./parseProductExperimentOutputPack";
import { normalizeScopeWithAdsOptimizationContractV1 } from "../contracts/adsOptimizationContractV1";
import {
  semanticValidationFailed,
  summarizeSemanticFailure,
  toSemanticErrorDetails,
  validateExperimentPackSemanticBoundaries,
} from "./semanticValidation";

type ImportInput = {
  fileText: string;
  currentAsin: string;
};

export type ImportProductExperimentOutputPackResult = {
  ok: boolean;
  created_experiment_id?: string;
  created_change_ids_count: number;
  warnings?: string[];
  error?: string;
  details?: Record<string, unknown>;
};

const normalizeKivTitle = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

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
    const warnings: string[] = [];
    const semanticValidation = await validateExperimentPackSemanticBoundaries({
      parsed: parsed.value,
      accountId: env.accountId,
      marketplace: env.marketplace,
      currentAsin,
    });
    if (semanticValidationFailed(semanticValidation)) {
      return {
        ok: false,
        created_change_ids_count: 0,
        error: summarizeSemanticFailure(
          semanticValidation,
          "Semantic validation failed for product experiment output pack."
        ),
        details: toSemanticErrorDetails(semanticValidation),
      };
    }
    warnings.push(...semanticValidation.warnings);

    const experimentPayload = parsed.value.experiment;
    const normalizedScope =
      normalizeScopeWithAdsOptimizationContractV1(experimentPayload.scope, {
        defaultWorkflowMode: true,
      }) ?? experimentPayload.scope;
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
        scope: normalizedScope,
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

    if (parsed.value.kiv_items.length > 0) {
      const asinNorm = parsed.value.product_asin;
      const { data: openKivRows, error: openKivError } = await supabaseAdmin
        .from('log_product_kiv_items')
        .select('kiv_id,title')
        .eq('account_id', env.accountId)
        .eq('marketplace', env.marketplace)
        .eq('asin_norm', asinNorm)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (openKivError) {
        throw new Error(`Failed loading existing KIV backlog: ${openKivError.message}`);
      }

      const existingOpenTitles = new Set<string>();
      for (const row of openKivRows ?? []) {
        const title = String(row.title ?? '').trim();
        if (!title) continue;
        existingOpenTitles.add(normalizeKivTitle(title));
      }

      for (const item of parsed.value.kiv_items) {
        const normalizedTitle = normalizeKivTitle(item.title);
        if (existingOpenTitles.has(normalizedTitle)) {
          warnings.push(`Skipped duplicate KIV item (already open): ${item.title}`);
          continue;
        }

        const { error: kivInsertError } = await supabaseAdmin
          .from('log_product_kiv_items')
          .insert({
            account_id: env.accountId,
            marketplace: env.marketplace,
            asin_norm: asinNorm,
            title: item.title,
            details: item.details ?? null,
            source: 'ai',
            source_experiment_id: experimentId,
            tags: item.tags ?? [],
            priority: item.priority ?? null,
            due_date: item.due_date ?? null,
          });

        if (kivInsertError) {
          throw new Error(`Failed inserting KIV item: ${kivInsertError.message}`);
        }

        existingOpenTitles.add(normalizedTitle);
      }
    }

    return {
      ok: true,
      created_experiment_id: experimentId,
      created_change_ids_count: createdChanges,
      warnings,
    };
  } catch (error) {
    return {
      ok: false,
      created_change_ids_count: 0,
      error: error instanceof Error ? error.message : "Unknown import error.",
    };
  }
};
