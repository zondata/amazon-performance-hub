import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('ProductExperimentPromptPackDownload hydration safety', () => {
  it('does not read localStorage in useState initializer and reads it in useEffect', () => {
    const filePath = join(
      process.cwd(),
      'apps/web/src/components/logbook/ProductExperimentPromptPackDownload.tsx'
    );
    const src = readFileSync(filePath, 'utf8');

    expect(src).not.toMatch(/useState\([\s\S]{0,250}localStorage/i);
    expect(src).toMatch(/useEffect\([\s\S]{0,400}localStorage\.getItem/i);
  });
});
