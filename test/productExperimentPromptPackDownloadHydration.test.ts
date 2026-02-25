import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('ProductExperimentPromptPackDownload hydration safety', () => {
  it('does not read localStorage in useState and uses external-store localStorage reader', () => {
    const filePath = join(
      process.cwd(),
      'apps/web/src/components/logbook/ProductExperimentPromptPackDownload.tsx'
    );
    const src = readFileSync(filePath, 'utf8');

    expect(src).not.toMatch(/useState\([\s\S]{0,250}localStorage/i);
    expect(src).toMatch(/useLocalStorageString/);
    expect(src).toMatch(/useLocalStorageString\(STORAGE_KEY,\s*''\)/);
    expect(src).not.toMatch(/useEffect\(/);
  });
});
