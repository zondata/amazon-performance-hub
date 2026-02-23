import { describe, expect, it } from 'vitest';

import { PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND } from '../apps/web/src/lib/logbook/aiPack/parseProductExperimentOutputPack';
import { renderProductExperimentPromptPackMarkdown } from '../apps/web/src/lib/logbook/renderProductExperimentPromptPack';

describe('renderProductExperimentPromptPackMarkdown', () => {
  it('renders template instructions and keeps schema contract markers', () => {
    const asin = 'B0TEST12345';
    const content = renderProductExperimentPromptPackMarkdown({
      asin,
      template: {
        id: 'formatting_only',
        name: 'Formatting only',
        instructions_md: 'When you output your final answer, it must be JSON only.',
      },
    });

    expect(content).toContain('## Template');
    expect(content).toContain('## Assistant Instructions');
    expect(content).toContain('When you output your final answer, it must be JSON only.');
    expect(content).toContain(`"kind": "${PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND}"`);
    expect(content).toContain(`ASIN **${asin}**`);
    expect(content).toContain(`"asin": "${asin}"`);
    expect(content).toContain(`"product_id": "${asin}"`);
  });
});
