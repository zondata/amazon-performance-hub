import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const importsHealthPagePath = path.join(
  process.cwd(),
  'apps/web/src/app/imports-health/page.tsx'
);
const h10UploadPagePath = path.join(
  process.cwd(),
  'apps/web/src/app/imports/h10-keyword-ranking/page.tsx'
);
const h10UploadClientPath = path.join(
  process.cwd(),
  'apps/web/src/components/imports/H10KeywordRankingUploadForm.tsx'
);

describe('import status wiring', () => {
  it('links imports health to the H10 keyword ranking upload page', () => {
    const source = fs.readFileSync(importsHealthPagePath, 'utf8');

    expect(source).toContain("href=\"/imports/h10-keyword-ranking\"");
    expect(source).toContain('Helium 10 Keyword Ranking Upload');
    expect(source).toContain('Open H10 upload');
  });

  it('renders the dedicated H10 upload route with operator navigation', () => {
    const source = fs.readFileSync(h10UploadPagePath, 'utf8');

    expect(source).toContain('Helium 10 Keyword Ranking Upload');
    expect(source).toContain(
      'Upload a Helium 10 Keyword Tracker CSV to update keyword ranking history.'
    );
    expect(source).toContain('Back to Imports &amp; Health');
    expect(source).toContain('Open Pipeline Status');
    expect(source).toContain('Current H10 status');
  });

  it('keeps the client upload form free of service-role and root import code', () => {
    const source = fs.readFileSync(h10UploadClientPath, 'utf8');

    expect(source).not.toContain('supabaseAdmin');
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(source).not.toContain('ingestHelium10KeywordTrackerRaw');
    expect(source).not.toContain('manualHelium10RankImport');
  });
});
