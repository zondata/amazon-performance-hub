import { describe, expect, it } from 'vitest';

import { KEYWORD_AI_PACK_DEFAULT_TEMPLATES } from '../apps/web/src/lib/keywords/keywordAiPackTemplatesModel';
import { renderKeywordAiPackMarkdown } from '../apps/web/src/lib/keywords/renderKeywordAiPack';

describe('renderKeywordAiPackMarkdown', () => {
  it('includes assistant instructions, exclusive/set-active guidance, and CSV contract', () => {
    const keywordPartnerTemplate = KEYWORD_AI_PACK_DEFAULT_TEMPLATES.find(
      (template) => template.id === 'keyword_partner'
    );
    expect(keywordPartnerTemplate).toBeTruthy();

    const markdown = renderKeywordAiPackMarkdown({
      asin: 'B0TEST1234',
      title: 'Sample product',
      short_name: 'Sample',
      template: {
        name: keywordPartnerTemplate?.name ?? 'Keyword partner',
        instructions_md: keywordPartnerTemplate?.instructions_md ?? '',
      },
    });

    expect(markdown).toContain('## Assistant Instructions');
    expect(markdown).toContain('Exclusive mode means each keyword must belong to only one group');
    expect(markdown).toContain('Set active guidance: keep one active set only');
    expect(markdown).toContain('## Exact CSV Requirements');
    expect(markdown).toContain('D..O');
  });

  it('includes allowed group names section when group set + names are provided', () => {
    const markdown = renderKeywordAiPackMarkdown({
      asin: 'B0TEST1234',
      title: 'Sample product',
      short_name: 'Sample',
      group_set: {
        name: 'Core terms',
        is_exclusive: true,
        created_at: '2026-02-22',
      },
      allowed_group_names: ['Brand', 'Benefits'],
      template: {
        name: 'Formatting only',
        instructions_md: 'Output only CSV.',
      },
    });

    expect(markdown).toContain('## Allowed Group Names (Columns D-O)');
    expect(markdown).toContain('- Brand');
    expect(markdown).toContain('- Benefits');
  });
});
