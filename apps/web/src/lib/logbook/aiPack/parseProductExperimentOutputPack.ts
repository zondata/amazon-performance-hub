import type { SbUpdateAction } from "../../../../../../src/bulksheet_gen_sb/types";
import type { SpUpdateAction } from "../../../../../../src/bulksheet_gen_sp/types";
import { normalizeScopeWithAdsOptimizationContractV1 } from "../contracts/adsOptimizationContractV1";

const PACK_KIND = "aph_product_experiment_pack_v1";

type JsonRecord = Record<string, unknown>;

type ManualChangeEntity = {
  entity_type: string;
  product_id?: string | null;
  campaign_id?: string | null;
  ad_group_id?: string | null;
  target_id?: string | null;
  keyword_id?: string | null;
  note?: string | null;
  extra?: unknown;
};

type ManualChange = {
  channel: string;
  change_type: string;
  summary: string;
  why?: string | null;
  entities: ManualChangeEntity[];
};

type KivItem = {
  title: string;
  details?: string;
  tags?: string[];
  priority?: number;
  due_date?: string;
};

export type ProductExperimentBulkgenPlan =
  | {
      channel: "SP";
      generator: "bulkgen:sp:update";
      run_id: string;
      notes?: string;
      actions: SpUpdateAction[];
    }
  | {
      channel: "SB";
      generator: "bulkgen:sb:update";
      run_id: string;
      notes?: string;
      actions: SbUpdateAction[];
    };

export type ParsedProductExperimentOutputPack = {
  kind: typeof PACK_KIND;
  product_asin: string;
  experiment: {
    name: string;
    objective: string;
    hypothesis?: string;
    evaluation_lag_days?: number;
    evaluation_window_days?: number;
    primary_metrics?: unknown;
    guardrails?: unknown;
    scope: JsonRecord & { product_id: string; status: string; bulkgen_plans?: ProductExperimentBulkgenPlan[] };
  };
  manual_changes: ManualChange[];
  kiv_items: KivItem[];
};

export type ParseProductExperimentOutputPackResult =
  | { ok: true; value: ParsedProductExperimentOutputPack }
  | { ok: false; error: string };

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const trimString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeAsin = (value: unknown): string | null => {
  const text = trimString(value);
  if (!text) return null;
  return text.toUpperCase();
};

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const asDateOnlyString = (value: unknown): string | null => {
  const text = trimString(value);
  if (!text || !DATE_RE.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === text ? text : null;
};

const requiredString = (value: unknown, label: string, errors: string[]): string => {
  const parsed = trimString(value);
  if (!parsed) {
    errors.push(`${label} is required`);
    return "";
  }
  return parsed;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const entry of value) {
    const parsed = trimString(entry);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    out.push(parsed);
  }

  return out;
};

function parseSpAction(raw: unknown, label: string, errors: string[]): SpUpdateAction | null {
  const row = asRecord(raw);
  if (!row) {
    errors.push(`${label} must be an object`);
    return null;
  }
  const type = requiredString(row.type, `${label}.type`, errors);
  if (type === "update_campaign_budget") {
    const campaignId = requiredString(row.campaign_id, `${label}.campaign_id`, errors);
    const newBudget = asFiniteNumber(row.new_budget);
    if (newBudget === null) errors.push(`${label}.new_budget must be a number`);
    if (!campaignId || newBudget === null) return null;
    return { type, campaign_id: campaignId, new_budget: newBudget };
  }
  if (type === "update_campaign_state") {
    const campaignId = requiredString(row.campaign_id, `${label}.campaign_id`, errors);
    const newState = requiredString(row.new_state, `${label}.new_state`, errors);
    if (!campaignId || !newState) return null;
    return { type, campaign_id: campaignId, new_state: newState };
  }
  if (type === "update_campaign_bidding_strategy") {
    const campaignId = requiredString(row.campaign_id, `${label}.campaign_id`, errors);
    const newStrategy = requiredString(row.new_strategy, `${label}.new_strategy`, errors);
    if (!campaignId || !newStrategy) return null;
    return { type, campaign_id: campaignId, new_strategy: newStrategy };
  }
  if (type === "update_ad_group_state") {
    const adGroupId = requiredString(row.ad_group_id, `${label}.ad_group_id`, errors);
    const newState = requiredString(row.new_state, `${label}.new_state`, errors);
    if (!adGroupId || !newState) return null;
    return { type, ad_group_id: adGroupId, new_state: newState };
  }
  if (type === "update_ad_group_default_bid") {
    const adGroupId = requiredString(row.ad_group_id, `${label}.ad_group_id`, errors);
    const newBid = asFiniteNumber(row.new_bid);
    if (newBid === null) errors.push(`${label}.new_bid must be a number`);
    if (!adGroupId || newBid === null) return null;
    return { type, ad_group_id: adGroupId, new_bid: newBid };
  }
  if (type === "update_target_bid") {
    const targetId = requiredString(row.target_id, `${label}.target_id`, errors);
    const newBid = asFiniteNumber(row.new_bid);
    if (newBid === null) errors.push(`${label}.new_bid must be a number`);
    if (!targetId || newBid === null) return null;
    return { type, target_id: targetId, new_bid: newBid };
  }
  if (type === "update_target_state") {
    const targetId = requiredString(row.target_id, `${label}.target_id`, errors);
    const newState = requiredString(row.new_state, `${label}.new_state`, errors);
    if (!targetId || !newState) return null;
    return { type, target_id: targetId, new_state: newState };
  }
  if (type === "update_placement_modifier") {
    const campaignId = requiredString(row.campaign_id, `${label}.campaign_id`, errors);
    const placementCode = requiredString(row.placement_code, `${label}.placement_code`, errors);
    const newPct = asFiniteNumber(row.new_pct);
    if (newPct === null) errors.push(`${label}.new_pct must be a number`);
    if (!campaignId || !placementCode || newPct === null) return null;
    return { type, campaign_id: campaignId, placement_code: placementCode, new_pct: newPct };
  }

  errors.push(`${label}.type is unsupported for SP: ${type}`);
  return null;
}

function parseSbAction(raw: unknown, label: string, errors: string[]): SbUpdateAction | null {
  const row = asRecord(raw);
  if (!row) {
    errors.push(`${label} must be an object`);
    return null;
  }
  const type = requiredString(row.type, `${label}.type`, errors);
  if (type === "update_campaign_budget") {
    const campaignId = requiredString(row.campaign_id, `${label}.campaign_id`, errors);
    const newBudget = asFiniteNumber(row.new_budget);
    if (newBudget === null) errors.push(`${label}.new_budget must be a number`);
    if (!campaignId || newBudget === null) return null;
    return { type, campaign_id: campaignId, new_budget: newBudget };
  }
  if (type === "update_campaign_state") {
    const campaignId = requiredString(row.campaign_id, `${label}.campaign_id`, errors);
    const newState = requiredString(row.new_state, `${label}.new_state`, errors);
    if (!campaignId || !newState) return null;
    return { type, campaign_id: campaignId, new_state: newState };
  }
  if (type === "update_campaign_bidding_strategy") {
    const campaignId = requiredString(row.campaign_id, `${label}.campaign_id`, errors);
    const newStrategy = requiredString(row.new_strategy, `${label}.new_strategy`, errors);
    if (!campaignId || !newStrategy) return null;
    return { type, campaign_id: campaignId, new_strategy: newStrategy };
  }
  if (type === "update_ad_group_state") {
    const adGroupId = requiredString(row.ad_group_id, `${label}.ad_group_id`, errors);
    const newState = requiredString(row.new_state, `${label}.new_state`, errors);
    if (!adGroupId || !newState) return null;
    return { type, ad_group_id: adGroupId, new_state: newState };
  }
  if (type === "update_ad_group_default_bid") {
    const adGroupId = requiredString(row.ad_group_id, `${label}.ad_group_id`, errors);
    const newDefaultBid = asFiniteNumber(row.new_default_bid);
    if (newDefaultBid === null) errors.push(`${label}.new_default_bid must be a number`);
    if (!adGroupId || newDefaultBid === null) return null;
    return { type, ad_group_id: adGroupId, new_default_bid: newDefaultBid };
  }
  if (type === "update_target_bid") {
    const targetId = requiredString(row.target_id, `${label}.target_id`, errors);
    const newBid = asFiniteNumber(row.new_bid);
    if (newBid === null) errors.push(`${label}.new_bid must be a number`);
    if (!targetId || newBid === null) return null;
    return { type, target_id: targetId, new_bid: newBid };
  }
  if (type === "update_target_state") {
    const targetId = requiredString(row.target_id, `${label}.target_id`, errors);
    const newState = requiredString(row.new_state, `${label}.new_state`, errors);
    if (!targetId || !newState) return null;
    return { type, target_id: targetId, new_state: newState };
  }
  if (type === "update_placement_modifier") {
    const campaignId = requiredString(row.campaign_id, `${label}.campaign_id`, errors);
    const placementRaw = trimString(row.placement_raw) ?? undefined;
    const placementCode = trimString(row.placement_code) ?? undefined;
    const newPct = asFiniteNumber(row.new_pct);
    if (newPct === null) errors.push(`${label}.new_pct must be a number`);
    if (!campaignId || newPct === null) return null;
    return {
      type,
      campaign_id: campaignId,
      placement_raw: placementRaw,
      placement_code: placementCode,
      new_pct: newPct,
    };
  }

  errors.push(`${label}.type is unsupported for SB: ${type}`);
  return null;
}

function normalizeManualEntities(entitiesRaw: unknown, asin: string): ManualChangeEntity[] {
  const entities: ManualChangeEntity[] = [];
  if (Array.isArray(entitiesRaw)) {
    for (const raw of entitiesRaw) {
      const row = asRecord(raw);
      if (!row) continue;
      const entityType =
        trimString(row.entity_type) ??
        (trimString(row.product_id) ? "product" : null) ??
        (trimString(row.campaign_id) ? "campaign" : null) ??
        (trimString(row.target_id) ? "target" : null) ??
        "generic";
      entities.push({
        entity_type: entityType,
        product_id: normalizeAsin(row.product_id),
        campaign_id: trimString(row.campaign_id),
        ad_group_id: trimString(row.ad_group_id),
        target_id: trimString(row.target_id),
        keyword_id: trimString(row.keyword_id),
        note: trimString(row.note),
        extra: row.extra,
      });
    }
  }

  const hasProduct = entities.some((row) => row.product_id === asin);
  if (!hasProduct) {
    entities.unshift({
      entity_type: "product",
      product_id: asin,
    });
  }

  return entities;
}

export const parseProductExperimentOutputPack = (
  rawText: string,
  routeAsin: string
): ParseProductExperimentOutputPackResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "Invalid JSON payload." };
  }

  const root = asRecord(parsed);
  if (!root) return { ok: false, error: "Payload must be a JSON object." };

  const kind = trimString(root.kind);
  if (kind !== PACK_KIND) {
    return {
      ok: false,
      error: `kind must be ${PACK_KIND}.`,
    };
  }

  const expectedAsin = normalizeAsin(routeAsin);
  const product = asRecord(root.product);
  const productAsin = normalizeAsin(product?.asin);
  if (!productAsin) {
    return { ok: false, error: "Missing required field: product.asin." };
  }
  if (!expectedAsin || productAsin !== expectedAsin) {
    return {
      ok: false,
      error: `product.asin (${productAsin}) must match route ASIN (${expectedAsin ?? "UNKNOWN"}).`,
    };
  }

  const experiment = asRecord(root.experiment);
  if (!experiment) return { ok: false, error: "Missing required object: experiment." };

  const errors: string[] = [];
  const name = requiredString(experiment.name, "experiment.name", errors);
  const objective = requiredString(experiment.objective, "experiment.objective", errors);
  const hypothesis = trimString(experiment.hypothesis) ?? undefined;
  const evaluationLagDays = asFiniteNumber(experiment.evaluation_lag_days) ?? undefined;
  const evaluationWindowDays = asFiniteNumber(experiment.evaluation_window_days) ?? undefined;

  const scopeRaw = asRecord(experiment.scope) ?? {};
  const scopeNormalized =
    normalizeScopeWithAdsOptimizationContractV1(scopeRaw, {
      defaultWorkflowMode: true,
    }) ?? scopeRaw;
  const status = trimString(scopeRaw.status) ?? "planned";
  const plansRaw = scopeRaw.bulkgen_plans;
  const plans: ProductExperimentBulkgenPlan[] = [];

  if (Array.isArray(plansRaw)) {
    plansRaw.forEach((rawPlan, index) => {
      const label = `experiment.scope.bulkgen_plans[${index}]`;
      const plan = asRecord(rawPlan);
      if (!plan) {
        errors.push(`${label} must be an object`);
        return;
      }
      const channelRaw = requiredString(plan.channel, `${label}.channel`, errors).toUpperCase();
      const generator = requiredString(plan.generator, `${label}.generator`, errors);
      const runId = requiredString(plan.run_id, `${label}.run_id`, errors);
      const notes = trimString(plan.notes) ?? undefined;
      const actionsRaw = plan.actions;
      if (!Array.isArray(actionsRaw) || actionsRaw.length === 0) {
        errors.push(`${label}.actions must be a non-empty array`);
        return;
      }

      if (channelRaw === "SP") {
        if (generator !== "bulkgen:sp:update") {
          errors.push(`${label}.generator must be bulkgen:sp:update for channel SP`);
        }
        const actions: SpUpdateAction[] = [];
        actionsRaw.forEach((action, actionIndex) => {
          const parsedAction = parseSpAction(
            action,
            `${label}.actions[${actionIndex}]`,
            errors
          );
          if (parsedAction) actions.push(parsedAction);
        });
        plans.push({
          channel: "SP",
          generator: "bulkgen:sp:update",
          run_id: runId,
          notes,
          actions,
        });
        return;
      }

      if (channelRaw === "SB") {
        if (generator !== "bulkgen:sb:update") {
          errors.push(`${label}.generator must be bulkgen:sb:update for channel SB`);
        }
        const actions: SbUpdateAction[] = [];
        actionsRaw.forEach((action, actionIndex) => {
          const parsedAction = parseSbAction(
            action,
            `${label}.actions[${actionIndex}]`,
            errors
          );
          if (parsedAction) actions.push(parsedAction);
        });
        plans.push({
          channel: "SB",
          generator: "bulkgen:sb:update",
          run_id: runId,
          notes,
          actions,
        });
        return;
      }

      errors.push(`${label}.channel must be SP or SB`);
    });
  }

  const manualChangesRaw = root.manual_changes;
  const manualChanges: ManualChange[] = [];
  if (Array.isArray(manualChangesRaw)) {
    manualChangesRaw.forEach((raw, index) => {
      const label = `manual_changes[${index}]`;
      const row = asRecord(raw);
      if (!row) {
        errors.push(`${label} must be an object`);
        return;
      }
      const channel = requiredString(row.channel, `${label}.channel`, errors);
      const changeType = requiredString(row.change_type, `${label}.change_type`, errors);
      const summary = requiredString(row.summary, `${label}.summary`, errors);
      const why = trimString(row.why) ?? undefined;
      const entities = normalizeManualEntities(row.entities, productAsin);
      manualChanges.push({
        channel,
        change_type: changeType,
        summary,
        why,
        entities,
      });
    });
  }

  const kivItemsRaw = root.kiv_items;
  const kivItems: KivItem[] = [];
  if (Array.isArray(kivItemsRaw)) {
    kivItemsRaw.forEach((raw, index) => {
      const label = `kiv_items[${index}]`;
      const row = asRecord(raw);
      if (!row) {
        errors.push(`${label} must be an object`);
        return;
      }

      const title = requiredString(row.title, `${label}.title`, errors);
      const details = trimString(row.details) ?? undefined;
      const tags = asStringArray(row.tags);
      const priorityRaw = row.priority;
      let priority: number | undefined;
      if (priorityRaw !== undefined && priorityRaw !== null && priorityRaw !== '') {
        const parsedPriority = asFiniteNumber(priorityRaw);
        if (parsedPriority === null) {
          errors.push(`${label}.priority must be a number`);
        } else {
          priority = Math.floor(parsedPriority);
        }
      }

      const dueDateRaw = row.due_date;
      let dueDate: string | undefined;
      if (dueDateRaw !== undefined && dueDateRaw !== null && dueDateRaw !== '') {
        const parsedDueDate = asDateOnlyString(dueDateRaw);
        if (!parsedDueDate) {
          errors.push(`${label}.due_date must be YYYY-MM-DD`);
        } else {
          dueDate = parsedDueDate;
        }
      }

      kivItems.push({
        title,
        details,
        ...(tags.length > 0 ? { tags } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(dueDate ? { due_date: dueDate } : {}),
      });
    });
  }

  if (errors.length > 0) {
    return { ok: false, error: `Output pack validation failed:\n- ${errors.join("\n- ")}` };
  }

  const scope: JsonRecord & {
    product_id: string;
    status: string;
    bulkgen_plans?: ProductExperimentBulkgenPlan[];
  } = {
    ...scopeNormalized,
    product_id: productAsin,
    status,
  };
  if (plans.length > 0) {
    scope.bulkgen_plans = plans;
  }

  return {
    ok: true,
    value: {
      kind: PACK_KIND,
      product_asin: productAsin,
      experiment: {
        name,
        objective,
        hypothesis,
        evaluation_lag_days: evaluationLagDays,
        evaluation_window_days: evaluationWindowDays,
        primary_metrics: experiment.primary_metrics,
        guardrails: experiment.guardrails,
        scope,
      },
      manual_changes: manualChanges,
      kiv_items: kivItems,
    },
  };
};

export const PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND = PACK_KIND;
