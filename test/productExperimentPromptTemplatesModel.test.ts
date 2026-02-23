import { describe, expect, it } from 'vitest';

import {
  PRODUCT_EXPERIMENT_PROMPT_DEFAULT_TEMPLATES,
  normalizeProductExperimentPromptTemplates,
} from '../apps/web/src/lib/logbook/productExperimentPromptTemplatesModel';

describe('normalizeProductExperimentPromptTemplates', () => {
  it('returns defaults for null input with exactly one default', () => {
    const normalized = normalizeProductExperimentPromptTemplates(null);
    const defaultCount = normalized.filter((template) => template.is_default).length;

    expect(normalized).toEqual(PRODUCT_EXPERIMENT_PROMPT_DEFAULT_TEMPLATES);
    expect(defaultCount).toBe(1);
  });

  it('enforces only one default when multiple defaults are marked', () => {
    const normalized = normalizeProductExperimentPromptTemplates({
      templates: [
        {
          id: 'alpha',
          name: 'Alpha',
          description: '',
          instructions_md: '',
          is_default: true,
        },
        {
          id: 'beta',
          name: 'Beta',
          description: '',
          instructions_md: '',
          is_default: true,
        },
      ],
    });

    expect(normalized).toHaveLength(2);
    expect(normalized[0].is_default).toBe(true);
    expect(normalized[1].is_default).toBe(false);
  });

  it('fills missing strings and sets first template as default when none flagged', () => {
    const normalized = normalizeProductExperimentPromptTemplates({
      templates: [{ id: 'x', name: 'X' }],
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      id: 'x',
      name: 'X',
      description: '',
      instructions_md: '',
      is_default: true,
    });
  });
});
