import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('KeywordAiPackDownload hydration safety', () => {
  it('uses localStorage external store with render-time fallback logic', () => {
    const filePath = join(
      process.cwd(),
      'apps/web/src/components/keywords/KeywordAiPackDownload.tsx'
    );
    const src = readFileSync(filePath, 'utf8');

    expect(src).toMatch(/useLocalStorageString/);
    expect(src).toMatch(/useLocalStorageString\(STORAGE_KEY,\s*''\)/);
    expect(src).toMatch(/effectiveSelectedTemplateId/);
    expect(src).not.toMatch(/setHydrated/);
    expect(src).not.toMatch(/useEffect\(/);
  });
});
