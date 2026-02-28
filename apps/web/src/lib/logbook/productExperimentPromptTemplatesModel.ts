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
    ].join('\n'),
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
      '- Use `product.skills.resolved` and `experiment.skills.resolved` (when present) as explicit operating constraints.',
      '- Start every analysis from unit economics and profitability impact before growth ideas.',
      '- Do not conflate Scale Insights attributed `ppc_cost` with advertised-ASIN spend; treat them as different signals.',
      '- Validate SP placement spend reconciliation before placement recommendations.',
      '- If `placement_spend_reconciliation.status=scaled_to_campaign_total`, use scaled placement spend and explicitly mention that spend was scaled.',
      '- If `placement_spend_reconciliation.status` is `mismatch` or `missing_reported_spend`, avoid placement-spend KPIs for decisions.',
      '- Treat placement KPIs as campaign-level only; do not attribute placement KPI outcomes to targets in multi-target campaigns.',
      '- Focus placement actions on campaigns with `spend > 0`.',
      '- End each analysis with a grouped checklist summary: assumptions, evidence, risks, and next actions.',
      '- Keep the immediate execution set small; move lower-confidence ideas to a KIV backlog.',
      '- Treat `product.driver_campaign_intents` as campaign-level constraints; do not propose conflicting actions without explicit override rationale.',
      '- Reconsider the top 3 items from `product.kiv_backlog` on every iteration before adding net-new work.',
      '- For any deferred work, output it as KIV backlog items rather than expanding the immediate execution set.',
      '- Be cautious with driver campaigns; respect existing product intent and avoid broad changes without explicit justification.',
      '- If any computed summary section is missing/unknown, explicitly state: \"unknown due to missing data\" and stop guessing that section.',
      '- Validate feasibility against the baseline data pack IDs and fields.',
      '- Do not output final JSON yet.',
      '- ONLY output final JSON when the user explicitly says: "Generate JSON".',
      '',
      'When generating final JSON:',
      '- Output JSON only (no markdown/prose/code fences).',
      '- Follow the required schema exactly.',
    ].join('\n'),
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
      instructions_md:
        typeof row.instructions_md === 'string' ? row.instructions_md : '',
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
