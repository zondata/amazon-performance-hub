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

  it('renders top-level Run sales and Run ads controls', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain('Run sales');
    expect(source).toContain('Run ads');
    expect(source).toContain('runPipelineManualGroup');
    expect(source).toContain('Run the full Sales sync or the full Ads batch');
  });

  it('gates manual run buttons on backend availability and shows missing-config guidance', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain('describePipelineManualRunBackend');
    expect(source).toContain('supportsAnyPipelineManualRun()');
    expect(source).toContain("Manual runs are not configured");
    expect(source).toContain('Missing env vars:');
    expect(source).toContain("Manual run backend is not configured.");
  });
});
