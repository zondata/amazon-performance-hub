type JsonRecord = Record<string, unknown>;

const WORKFLOW_MODES = new Set(['manual', 'api']);
const FORECAST_DIRECTIONS = new Set(['up', 'down', 'flat', 'uncertain']);
const PATCH_DECISIONS = new Set(['accept', 'reject', 'modify']);

export const REVIEW_PATCH_PACK_KIND_V1 = 'aph_review_patch_pack_v1';
export const REVIEW_PATCH_PACK_VERSION_V1 = 'v1';

export type WorkflowModeV1 = 'manual' | 'api';
export type ForecastDirectionV1 = 'up' | 'down' | 'flat' | 'uncertain';
export type PatchDecisionModeV1 = 'accept' | 'reject' | 'modify';

export type BaselineRefV1 = {
  data_available_through: string;
  [key: string]: unknown;
};

export type ForecastDirectionalKpiV1 = {
  kpi: string;
  direction: ForecastDirectionV1;
  note?: string;
  [key: string]: unknown;
};

export type ForecastV1 = {
  directional_kpis?: ForecastDirectionalKpiV1[];
  window_days?: number;
  confidence?: number;
  assumptions?: string[];
  [key: string]: unknown;
};

export type AiRunMetaV1 = {
  workflow_mode: WorkflowModeV1;
  model?: string;
  prompt_template_id?: string;
  started_at?: string;
  completed_at?: string;
  [key: string]: unknown;
};

export type PatchDecisionV1 = {
  change_id: string;
  decision: PatchDecisionModeV1;
  override_new_value?: number;
  note?: string;
  [key: string]: unknown;
};

export type ReviewPatchPayloadV1 = {
  decisions: PatchDecisionV1[];
  notes?: string;
  [key: string]: unknown;
};

export type ReviewPatchPackV1 = {
  kind: typeof REVIEW_PATCH_PACK_KIND_V1;
  pack_version: typeof REVIEW_PATCH_PACK_VERSION_V1;
  pack_id: string;
  created_at: string;
  links: {
    experiment_id: string;
    proposal_pack_id?: string;
    [key: string]: unknown;
  };
  trace: {
    workflow_mode: WorkflowModeV1;
    model?: string;
    prompt_template_id?: string;
    [key: string]: unknown;
  };
  patch: ReviewPatchPayloadV1;
  [key: string]: unknown;
};

export type FinalPlanBulkgenPlanV1 = {
  channel: 'SP' | 'SB';
  generator: 'bulkgen:sp:update' | 'bulkgen:sb:update';
  run_id: string;
  notes?: string;
  actions: JsonRecord[];
  [key: string]: unknown;
};

export type FinalPlanSnapshotV1 = {
  pack_id: string;
  created_at: string;
  source: 'review_patch_applied' | 'proposal_fallback';
  review_patch_pack_id?: string;
  plan_source?: 'scope.bulkgen_plans';
  summary?: {
    actions_total: number;
    accepted_actions: number;
    rejected_actions: number;
    modified_actions: number;
  };
  bulkgen_plans: FinalPlanBulkgenPlanV1[];
  [key: string]: unknown;
};

export type AdsOptimizationContractV1 = {
  baseline_ref?: BaselineRefV1;
  forecast?: ForecastV1;
  ai_run_meta?: AiRunMetaV1;
  evaluation_plan?: JsonRecord;
  review_patch?: ReviewPatchPackV1;
  final_plan?: FinalPlanSnapshotV1;
  [key: string]: unknown;
};

type ParseOptions = {
  defaultWorkflowMode?: boolean;
};

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const uniqueStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const parsed = asTrimmedString(entry);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    out.push(parsed);
  }
  return out;
};

const parsePatchDecision = (value: unknown): PatchDecisionV1 | null => {
  const record = asRecord(value);
  if (!record) return null;
  const changeId = asTrimmedString(record.change_id);
  const decisionRaw = asTrimmedString(record.decision)?.toLowerCase();
  if (!changeId || !decisionRaw || !PATCH_DECISIONS.has(decisionRaw)) return null;

  const nestedOverride = asRecord(record.override);
  const overrideCandidate = asFiniteNumber(record.override_new_value ?? nestedOverride?.new_value);
  const note = asTrimmedString(record.note) ?? undefined;

  const parsed: PatchDecisionV1 = {
    ...record,
    change_id: changeId,
    decision: decisionRaw as PatchDecisionModeV1,
  };
  if (overrideCandidate !== null) parsed.override_new_value = overrideCandidate;
  else delete parsed.override_new_value;
  if (note) parsed.note = note;
  else delete parsed.note;

  return parsed;
};

const parseReviewPatchPayload = (value: unknown): ReviewPatchPayloadV1 | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;

  const decisionsRaw = Array.isArray(record.decisions) ? record.decisions : [];
  const decisions = decisionsRaw
    .map((entry) => parsePatchDecision(entry))
    .filter((entry): entry is PatchDecisionV1 => Boolean(entry));

  if (decisions.length === 0) return undefined;

  const payload: ReviewPatchPayloadV1 = {
    ...record,
    decisions,
  };

  const notes = asTrimmedString(record.notes);
  if (notes) payload.notes = notes;
  else delete payload.notes;

  return payload;
};

const parseWorkflowMode = (
  value: unknown,
  options: ParseOptions = {}
): WorkflowModeV1 | null => {
  const workflowRaw = asTrimmedString(value)?.toLowerCase();
  if (workflowRaw && WORKFLOW_MODES.has(workflowRaw)) {
    return workflowRaw as WorkflowModeV1;
  }
  if (options.defaultWorkflowMode) return 'manual';
  return null;
};

const parseReviewPatchPack = (
  value: unknown,
  options: ParseOptions = {}
): ReviewPatchPackV1 | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;

  const patch = parseReviewPatchPayload(record.patch);
  if (!patch) return undefined;

  const packId = asTrimmedString(record.pack_id);
  const createdAt = asTrimmedString(record.created_at);
  if (!packId || !createdAt) return undefined;

  const linksRecord = asRecord(record.links) ?? {};
  const traceRecord = asRecord(record.trace) ?? {};
  const experimentId = asTrimmedString(linksRecord.experiment_id) ?? '';
  const workflowMode = parseWorkflowMode(traceRecord.workflow_mode, options);
  if (!experimentId || !workflowMode) return undefined;

  return {
    ...record,
    kind: REVIEW_PATCH_PACK_KIND_V1,
    pack_version: REVIEW_PATCH_PACK_VERSION_V1,
    pack_id: packId,
    created_at: createdAt,
    links: {
      ...linksRecord,
      experiment_id: experimentId,
      proposal_pack_id: asTrimmedString(linksRecord.proposal_pack_id) ?? undefined,
    },
    trace: {
      ...traceRecord,
      workflow_mode: workflowMode,
      model: asTrimmedString(traceRecord.model) ?? undefined,
      prompt_template_id: asTrimmedString(traceRecord.prompt_template_id) ?? undefined,
    },
    patch,
  };
};

const parseFinalPlanBulkgenPlans = (value: unknown): FinalPlanBulkgenPlanV1[] => {
  if (!Array.isArray(value)) return [];
  const plans: FinalPlanBulkgenPlanV1[] = [];

  for (const entry of value) {
    const plan = asRecord(entry);
    if (!plan) continue;
    const channel = asTrimmedString(plan.channel)?.toUpperCase();
    const generator = asTrimmedString(plan.generator);
    const runId = asTrimmedString(plan.run_id);
    const actionsRaw = Array.isArray(plan.actions) ? plan.actions : [];
    const actions = actionsRaw
      .map((action) => asRecord(action))
      .filter((action): action is JsonRecord => Boolean(action));

    if (!runId || actions.length === 0) continue;
    if (
      channel !== 'SP' &&
      channel !== 'SB'
    ) {
      continue;
    }
    if (
      generator !== 'bulkgen:sp:update' &&
      generator !== 'bulkgen:sb:update'
    ) {
      continue;
    }

    plans.push({
      ...plan,
      channel,
      generator,
      run_id: runId,
      notes: asTrimmedString(plan.notes) ?? undefined,
      actions,
    } as FinalPlanBulkgenPlanV1);
  }

  return plans;
};

const parseFinalPlanSnapshot = (value: unknown): FinalPlanSnapshotV1 | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;

  const packId = asTrimmedString(record.pack_id);
  const createdAt = asTrimmedString(record.created_at);
  const bulkgenPlans = parseFinalPlanBulkgenPlans(record.bulkgen_plans);
  if (!packId || !createdAt || bulkgenPlans.length === 0) return undefined;

  const sourceRaw = asTrimmedString(record.source);
  const source =
    sourceRaw === 'review_patch_applied' || sourceRaw === 'proposal_fallback'
      ? sourceRaw
      : 'review_patch_applied';
  const summaryRecord = asRecord(record.summary);

  return {
    ...record,
    pack_id: packId,
    created_at: createdAt,
    source,
    review_patch_pack_id: asTrimmedString(record.review_patch_pack_id) ?? undefined,
    plan_source: asTrimmedString(record.plan_source) === 'scope.bulkgen_plans' ? 'scope.bulkgen_plans' : undefined,
    summary: summaryRecord
      ? {
          actions_total: Math.max(0, Math.floor(asFiniteNumber(summaryRecord.actions_total) ?? 0)),
          accepted_actions: Math.max(0, Math.floor(asFiniteNumber(summaryRecord.accepted_actions) ?? 0)),
          rejected_actions: Math.max(0, Math.floor(asFiniteNumber(summaryRecord.rejected_actions) ?? 0)),
          modified_actions: Math.max(0, Math.floor(asFiniteNumber(summaryRecord.modified_actions) ?? 0)),
        }
      : undefined,
    bulkgen_plans: bulkgenPlans,
  };
};

const parseBaselineRef = (value: unknown): BaselineRefV1 | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;
  const dataAvailableThrough = asTrimmedString(record.data_available_through);
  if (!dataAvailableThrough) return undefined;

  return {
    ...record,
    data_available_through: dataAvailableThrough,
  };
};

const parseDirectionalKpis = (value: unknown): ForecastDirectionalKpiV1[] => {
  if (!Array.isArray(value)) return [];
  const rows: ForecastDirectionalKpiV1[] = [];
  for (const entry of value) {
    const row = asRecord(entry);
    if (!row) continue;
    const kpi = asTrimmedString(row.kpi);
    const directionRaw = asTrimmedString(row.direction)?.toLowerCase();
    if (!kpi || !directionRaw || !FORECAST_DIRECTIONS.has(directionRaw)) continue;

    rows.push({
      ...row,
      kpi,
      direction: directionRaw as ForecastDirectionV1,
      note: asTrimmedString(row.note) ?? undefined,
    });
  }
  return rows;
};

const parseForecast = (value: unknown): ForecastV1 | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;

  const directionalKpis = parseDirectionalKpis(record.directional_kpis);
  const windowDaysRaw = asFiniteNumber(record.window_days);
  const confidenceRaw = asFiniteNumber(record.confidence);

  const forecast: ForecastV1 = {
    ...record,
  };

  if (directionalKpis.length > 0) {
    forecast.directional_kpis = directionalKpis;
  } else {
    delete forecast.directional_kpis;
  }

  if (windowDaysRaw !== null && windowDaysRaw >= 0) {
    forecast.window_days = Math.floor(windowDaysRaw);
  } else {
    delete forecast.window_days;
  }

  if (confidenceRaw !== null && confidenceRaw >= 0 && confidenceRaw <= 1) {
    forecast.confidence = confidenceRaw;
  } else {
    delete forecast.confidence;
  }

  const assumptions = uniqueStringArray(record.assumptions);
  if (assumptions.length > 0) {
    forecast.assumptions = assumptions;
  } else {
    delete forecast.assumptions;
  }

  return Object.keys(forecast).length > 0 ? forecast : undefined;
};

const parseAiRunMeta = (
  value: unknown,
  options: ParseOptions = {}
): AiRunMetaV1 | undefined => {
  const record = asRecord(value);
  if (!record) {
    if (options.defaultWorkflowMode) {
      return { workflow_mode: 'manual' };
    }
    return undefined;
  }

  const workflowMode = parseWorkflowMode(record.workflow_mode, options);

  if (!workflowMode) return undefined;

  const aiRunMeta: AiRunMetaV1 = {
    ...record,
    workflow_mode: workflowMode,
  };

  const model = asTrimmedString(record.model);
  const promptTemplateId = asTrimmedString(record.prompt_template_id);
  const startedAt = asTrimmedString(record.started_at);
  const completedAt = asTrimmedString(record.completed_at);

  if (model) aiRunMeta.model = model;
  else delete aiRunMeta.model;
  if (promptTemplateId) aiRunMeta.prompt_template_id = promptTemplateId;
  else delete aiRunMeta.prompt_template_id;
  if (startedAt) aiRunMeta.started_at = startedAt;
  else delete aiRunMeta.started_at;
  if (completedAt) aiRunMeta.completed_at = completedAt;
  else delete aiRunMeta.completed_at;

  return aiRunMeta;
};

export const parseAdsOptimizationContractV1 = (
  value: unknown,
  options: ParseOptions = {}
): AdsOptimizationContractV1 | null => {
  const record = asRecord(value);
  if (!record) return null;

  const baselineRef = parseBaselineRef(record.baseline_ref);
  const forecast = parseForecast(record.forecast);
  const aiRunMeta = parseAiRunMeta(record.ai_run_meta, options);
  const evaluationPlan = asRecord(record.evaluation_plan) ?? undefined;
  const reviewPatch = parseReviewPatchPack(record.review_patch, options);
  const finalPlan = parseFinalPlanSnapshot(record.final_plan);

  const contract: AdsOptimizationContractV1 = {
    ...record,
  };

  if (baselineRef) contract.baseline_ref = baselineRef;
  else delete contract.baseline_ref;

  if (forecast) contract.forecast = forecast;
  else delete contract.forecast;

  if (aiRunMeta) contract.ai_run_meta = aiRunMeta;
  else delete contract.ai_run_meta;

  if (evaluationPlan) contract.evaluation_plan = evaluationPlan;
  else delete contract.evaluation_plan;

  if (reviewPatch) contract.review_patch = reviewPatch;
  else delete contract.review_patch;

  if (finalPlan) contract.final_plan = finalPlan;
  else delete contract.final_plan;

  return Object.keys(contract).length > 0 ? contract : null;
};

export const isAdsOptimizationContractV1 = (value: unknown): value is AdsOptimizationContractV1 =>
  parseAdsOptimizationContractV1(value) !== null;

export const extractAdsOptimizationContractV1FromScope = (
  scope: unknown,
  options: ParseOptions = {}
): AdsOptimizationContractV1 | null => {
  const scopeRecord = asRecord(scope);
  if (!scopeRecord) return null;
  const contractRecord = asRecord(scopeRecord.contract);
  if (!contractRecord) return null;
  return parseAdsOptimizationContractV1(contractRecord.ads_optimization_v1, options);
};

export const normalizeScopeWithAdsOptimizationContractV1 = (
  scope: unknown,
  options: ParseOptions = {}
): JsonRecord | null => {
  const scopeRecord = asRecord(scope);
  if (!scopeRecord) return null;

  const contractRecord = asRecord(scopeRecord.contract);
  const parsed = parseAdsOptimizationContractV1(contractRecord?.ads_optimization_v1, options);
  if (!parsed) return { ...scopeRecord };

  return {
    ...scopeRecord,
    contract: {
      ...(contractRecord ?? {}),
      ads_optimization_v1: parsed,
    },
  };
};

export const snapshotAdsOptimizationContractV1 = (
  contract: AdsOptimizationContractV1 | null
): {
  baseline_ref: BaselineRefV1 | null;
  forecast: ForecastV1 | null;
  ai_run_meta: AiRunMetaV1 | null;
} | null => {
  if (!contract) return null;

  const baselineRef = contract.baseline_ref ?? null;
  const forecast = contract.forecast ?? null;
  const aiRunMeta = contract.ai_run_meta ?? null;

  if (!baselineRef && !forecast && !aiRunMeta) return null;

  return {
    baseline_ref: baselineRef,
    forecast,
    ai_run_meta: aiRunMeta,
  };
};
