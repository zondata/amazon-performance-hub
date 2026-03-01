type JsonRecord = Record<string, unknown>;

const WORKFLOW_MODES = new Set(['manual', 'api']);
const FORECAST_DIRECTIONS = new Set(['up', 'down', 'flat', 'uncertain']);

export type WorkflowModeV1 = 'manual' | 'api';
export type ForecastDirectionV1 = 'up' | 'down' | 'flat' | 'uncertain';

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

export type AdsOptimizationContractV1 = {
  baseline_ref?: BaselineRefV1;
  forecast?: ForecastV1;
  ai_run_meta?: AiRunMetaV1;
  evaluation_plan?: JsonRecord;
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

  const workflowRaw = asTrimmedString(record.workflow_mode)?.toLowerCase();
  const workflowMode =
    workflowRaw && WORKFLOW_MODES.has(workflowRaw)
      ? (workflowRaw as WorkflowModeV1)
      : options.defaultWorkflowMode
        ? 'manual'
        : null;

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
