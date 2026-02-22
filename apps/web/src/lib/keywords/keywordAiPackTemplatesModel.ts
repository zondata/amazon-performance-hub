export type KeywordAiPackTemplate = {
  id: string;
  name: string;
  description: string;
  instructions_md: string;
  is_default: boolean;
};

export type KeywordAiPackTemplateOption = {
  id: string;
  name: string;
  is_default: boolean;
};

export const KEYWORD_AI_PACK_DEFAULT_TEMPLATES: KeywordAiPackTemplate[] = [
  {
    id: 'formatting_only',
    name: 'Formatting only',
    description: 'Strict CSV-only output',
    instructions_md: [
      'Output only a CSV.',
      'Do not output markdown, explanations, or prose.',
      'Follow the header contract exactly: A keyword, B group, C note, D..O group columns.',
      'Do not invent group names beyond the provided D..O headers.',
    ].join('\n'),
    is_default: true,
  },
  {
    id: 'keyword_partner',
    name: 'Keyword partner (research + grouping)',
    description: 'Helps plan groups and settings, then outputs CSV when asked',
    instructions_md: [
      'Role: You are a keyword research and grouping partner.',
      '',
      'How this system works:',
      '- Keywords are imported via a group set and grouped using columns D..O.',
      '- Keywords are normalized (lowercase, trim, collapse spaces).',
      '- Duplicate keywords are deduplicated by normalized value.',
      '- Exclusive mode means each keyword must belong to only one group; duplicates across groups cause failure.',
      '- Set active guidance: keep one active set only; set a group set active when it is the recommended live set.',
      '',
      'Workflow:',
      '- Ask clarifying questions first (up to 8) before drafting structure.',
      '- Propose 6-12 groups unless the user asks for more.',
      '- Recommend whether to use Exclusive mode and whether to Set active.',
      '- Propose a concise set name.',
      '- Do not output CSV yet.',
      '- ONLY output CSV when the user explicitly says: "Generate CSV".',
      '',
      'When generating CSV:',
      '- Output CSV only, no markdown/prose.',
      '- Follow exact headers and group-name constraints.',
    ].join('\n'),
    is_default: false,
  },
];

const cloneDefaults = (): KeywordAiPackTemplate[] =>
  KEYWORD_AI_PACK_DEFAULT_TEMPLATES.map((template) => ({ ...template }));

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export const normalizeKeywordAiPackTemplates = (
  settings: unknown
): KeywordAiPackTemplate[] => {
  const settingsRecord = asRecord(settings);
  const templatesRaw = settingsRecord?.templates;
  if (!Array.isArray(templatesRaw)) {
    return cloneDefaults();
  }

  const seenIds = new Set<string>();
  const normalized: KeywordAiPackTemplate[] = [];

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
  templates: KeywordAiPackTemplate[]
): KeywordAiPackTemplateOption[] =>
  templates.map((template) => ({
    id: template.id,
    name: template.name,
    is_default: template.is_default,
  }));
