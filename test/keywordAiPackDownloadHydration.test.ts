import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('KeywordAiPackDownload hydration safety', () => {
  it('uses hydration gate before switching to selected template id', () => {
    const filePath = join(
      process.cwd(),
      'apps/web/src/components/keywords/KeywordAiPackDownload.tsx'
    );
    const src = readFileSync(filePath, 'utf8');

    expect(src).toMatch(/useEffect\(\(\) => \{[\s\S]{0,120}setHydrated\(true\)[\s\S]{0,120}\}, \[\]\)/);
    expect(src).toMatch(/hydrated\s*\?\s*selectedTemplateId\s*:\s*defaultId/);
  });
});
