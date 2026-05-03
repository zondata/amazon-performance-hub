import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(
  process.cwd(),
  'apps/web/src/app/pipeline-status/page.tsx'
);
const envPath = path.join(process.cwd(), 'apps/web/src/lib/env.ts');

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

  it('shows non-secret branch and workflow diagnostics on the page', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain('Build info:');
    expect(source).toContain('branch=');
    expect(source).toContain('commit=');
    expect(source).toContain('workflow_ref=');
  });

  it('defaults the workflow ref to v3/database-only when no override is present', () => {
    const source = fs.readFileSync(envPath, 'utf-8');

    expect(source).toContain("process.env.GITHUB_ACTIONS_WORKFLOW_REF?.trim() ||");
    expect(source).toContain("process.env.VERCEL_GIT_COMMIT_REF?.trim() ||");
    expect(source).toContain("'v3/database-only'");
  });
});
