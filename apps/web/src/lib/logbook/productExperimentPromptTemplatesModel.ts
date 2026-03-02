export type ProductExperimentPromptTemplate = {
  id: string;
  name: string;
  description: string;
  instructions_md: string;
  is_default: boolean;
};

export type ProductExperimentPromptTemplateOption = {
  id: string;
  name: string;
  is_default: boolean;
};

const OUTPUT_CONTRACT_V1_MARKER = 'scope.contract.ads_optimization_v1';

export const ADS_OUTPUT_CONTRACT_V1_TEMPLATE_APPENDIX = [
  '',
  'Output Contract V1 requirement:',
  '- When producing final JSON, include `experiment.scope.contract.ads_optimization_v1`.',
  '- Identity chain requirements (for review rendering):',
  '- Campaign actions: `campaign_id`',
  '- Ad group actions: `campaign_id` + `ad_group_id`',
  '- Target actions: `campaign_id` + `ad_group_id` + `target_id` (if ad_group_id exists for that channel; otherwise `campaign_id` + `target_id`)',
  '- When generating bulkgen actions, include the full parent identity chain required for rendering.',
  '- `baseline_ref` must include `data_available_through` and baseline `window` from the Product Baseline Data Pack (do not invent dates).',
  '- `forecast` must include directional KPI movement (`directional_kpis`) plus `window_days`, `lag_days`, `assumptions`, and `confidence`.',
  '- `ai_run_meta.workflow_mode` must be `manual` for web-based AI.',
  '- Include `ai_run_meta.prompt_template_id` matching the selected template id.',
  '- Include `ai_run_meta.model` and `ai_run_meta.run_at` if known; otherwise set `model` to \"unknown\" and `run_at` to null.',
].join('\n');

const appendOutputContractV1AppendixIfMissing = (
  templateId: string,
  instructionsMd: string
): string => {
  if (templateId !== 'formatting_only' && templateId !== 'experiment_partner') {
    return instructionsMd;
  }
  if (instructionsMd.includes(OUTPUT_CONTRACT_V1_MARKER)) {
    return instructionsMd;
  }
  return `${instructionsMd}${ADS_OUTPUT_CONTRACT_V1_TEMPLATE_APPENDIX}`;
};

export const PRODUCT_EXPERIMENT_PROMPT_DEFAULT_TEMPLATES: ProductExperimentPromptTemplate[] = [
  {
    id: 'formatting_only',
    name: 'Formatting only',
    description: 'Strict final JSON output',
    instructions_md: [
      'Mode: strict execution.',
      'If required inputs are missing, ask concise clarifying questions first.',
      'Keep responses minimal and focused on the schema contract.',
      'When you output your final answer, it must be JSON only.',
      'Do not output markdown, code fences, or prose in the final answer.',
    ].join('\n') + ADS_OUTPUT_CONTRACT_V1_TEMPLATE_APPENDIX,
    is_default: true,
  },
  {
    id: 'experiment_partner',
    name: 'Partner mode',
    description: 'Collaborative planning first, JSON only when asked',
    instructions_md: [
      'Role: You are an experiment planning partner for Amazon product logbook workflows.',
      '',
      'Workflow:',
      '- Ask clarifying questions when requirements or IDs are missing.',
      '- Propose a short plan before generating the final payload.',
      '- Start by restating the data-pack `computed_summary` counts (or `computed_summary_eval` when evaluating) and interpret those counts before recommendations.',
      '- Use `product.skills.resolved` and `experiment.skills.resolved` (when present) as explicit operating constraints. Read each skill\'s SOP, Why, and Risks sections and apply them throughout your analysis.',
      '- Do not conflate Scale Insights attributed `ppc_cost` with advertised-ASIN spend; treat them as different signals.',
      '- The data pack window already excludes recent unfinalised days (see `metadata.exclude_last_days`). Treat all dates within `window.start` to `window.end` as finalised.',
      '- End each analysis with a grouped checklist summary: assumptions, evidence, risks, and next actions.',
      '- Keep the immediate execution set small; move lower-confidence ideas to a KIV backlog.',
      '- Treat `product.driver_campaign_intents` as campaign-level constraints; do not propose conflicting actions without explicit override rationale.',
      '- Reconsider the top 3 items from `product.kiv_backlog` on every iteration before adding net-new work.',
      '- For any deferred work, output it as KIV backlog items rather than expanding the immediate execution set.',
      '- When no changes are warranted, output a monitoring experiment with empty `bulkgen_plans` and observations in `kiv_items`.',
      '- If recommending bid or placement changes, confirm STIS data exists for relevant targets (`top_of_search_impression_share`); otherwise note the limitation.',
      '- Validate feasibility against the baseline data pack IDs and fields.',
      '- Do not output final JSON yet.',
      '- ONLY output final JSON when the user explicitly says: "Generate JSON".',
      '',
      'When generating final JSON:',
      '- Output JSON only (no markdown/prose/code fences).',
      '- Follow the required schema exactly.',
    ].join('\n') + ADS_OUTPUT_CONTRACT_V1_TEMPLATE_APPENDIX,
    is_default: false,
  },
];

const cloneDefaults = (): ProductExperimentPromptTemplate[] =>
  PRODUCT_EXPERIMENT_PROMPT_DEFAULT_TEMPLATES.map((template) => ({ ...template }));

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export const normalizeProductExperimentPromptTemplates = (
  settings: unknown
): ProductExperimentPromptTemplate[] => {
  const settingsRecord = asRecord(settings);
  const templatesRaw = settingsRecord?.templates;
  if (!Array.isArray(templatesRaw)) {
    return cloneDefaults();
  }

  const seenIds = new Set<string>();
  const normalized: ProductExperimentPromptTemplate[] = [];

  templatesRaw.forEach((item) => {
    const row = asRecord(item);
    if (!row) return;

    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!id || !name) return;
    if (seenIds.has(id)) return;
    seenIds.add(id);

    normalized.push({
      id,
      name,
      description: typeof row.description === 'string' ? row.description : '',
      instructions_md: appendOutputContractV1AppendixIfMissing(
        id,
        typeof row.instructions_md === 'string' ? row.instructions_md : ''
      ),
      is_default: row.is_default === true,
    });
  });

  if (normalized.length === 0) {
    return cloneDefaults();
  }

  const firstDefaultIndex = normalized.findIndex((template) => template.is_default);
  if (firstDefaultIndex < 0) {
    normalized[0] = { ...normalized[0], is_default: true };
    for (let i = 1; i < normalized.length; i += 1) {
      normalized[i] = { ...normalized[i], is_default: false };
    }
    return normalized;
  }

  return normalized.map((template, index) => ({
    ...template,
    is_default: index === firstDefaultIndex,
  }));
};

export const toTemplateOptions = (
  templates: ProductExperimentPromptTemplate[]
): ProductExperimentPromptTemplateOption[] =>
  templates.map((template) => ({
    id: template.id,
    name: template.name,
    is_default: template.is_default,
  }));
