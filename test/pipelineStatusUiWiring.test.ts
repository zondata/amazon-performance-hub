import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(
  process.cwd(),
  'apps/web/src/app/pipeline-status/page.tsx'
);

describe('pipeline status UI wiring', () => {
  it('lets redirect exceptions escape instead of flashing NEXT_REDIRECT as an error', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain(
      "import { isRedirectError } from 'next/dist/client/components/redirect-error';"
    );
    expect(source).toContain('if (isRedirectError(error)) {');
    expect(source).toContain('throw error;');
  });

  it('renders a disabled manual run state for not implemented sources', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain('Manual source run is not wired yet.');
    expect(source).toContain('Disabled');
    expect(source).toContain('row.implementationStatus === \'implemented\'');
  });
});
