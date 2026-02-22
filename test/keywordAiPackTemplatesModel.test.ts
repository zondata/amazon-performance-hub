import { describe, expect, it } from 'vitest';

import {
  KEYWORD_AI_PACK_DEFAULT_TEMPLATES,
  normalizeKeywordAiPackTemplates,
} from '../apps/web/src/lib/keywords/keywordAiPackTemplatesModel';

describe('normalizeKeywordAiPackTemplates', () => {
  it('returns defaults for null input with exactly one default', () => {
    const normalized = normalizeKeywordAiPackTemplates(null);
    const defaultCount = normalized.filter((template) => template.is_default).length;

    expect(normalized).toEqual(KEYWORD_AI_PACK_DEFAULT_TEMPLATES);
    expect(defaultCount).toBe(1);
  });

  it('enforces only one default when multiple defaults are marked', () => {
    const normalized = normalizeKeywordAiPackTemplates({
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
    const normalized = normalizeKeywordAiPackTemplates({
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
