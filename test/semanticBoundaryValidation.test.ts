import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const semanticValidationPath = path.join(
  process.cwd(),
  'apps/web/src/lib/logbook/aiPack/semanticValidation.ts'
);
const importProductPath = path.join(
  process.cwd(),
  'apps/web/src/lib/logbook/aiPack/importProductExperimentOutputPack.ts'
);
const importEvaluationPath = path.join(
  process.cwd(),
  'apps/web/src/lib/logbook/aiPack/importExperimentEvaluationOutputPack.ts'
);
const importReviewPatchPath = path.join(
  process.cwd(),
  'apps/web/src/lib/logbook/aiPack/importReviewPatchPack.ts'
);

describe('semantic boundary failure contract', () => {
  it('defines actionable semantic issue payload fields', () => {
    const source = fs.readFileSync(semanticValidationPath, 'utf-8');
    expect(source).toContain('field: string;');
    expect(source).toContain('id: string;');
    expect(source).toContain('recommendation: string;');
    expect(source).toContain('entity_not_found');
    expect(source).toContain('entity_scope_mismatch');
    expect(source).toContain('kiv_id_not_found');
  });

  it('includes regenerate/correct-account recommendations for invalid IDs', () => {
    const source = fs.readFileSync(semanticValidationPath, 'utf-8');
    expect(source).toContain('Regenerate the pack from the latest baseline data');
    expect(source).toContain('switch to the correct account/marketplace');
    expect(source).toContain('Pick KIV items for the correct ASIN');
  });

  it('rejects imports using semanticValidationFailed and returns semantic details', () => {
    const productImportSource = fs.readFileSync(importProductPath, 'utf-8');
    const evaluationImportSource = fs.readFileSync(importEvaluationPath, 'utf-8');
    const reviewPatchImportSource = fs.readFileSync(importReviewPatchPath, 'utf-8');

    expect(productImportSource).toContain('semanticValidationFailed');
    expect(productImportSource).toContain('details: toSemanticErrorDetails');
    expect(evaluationImportSource).toContain('semanticValidationFailed');
    expect(evaluationImportSource).toContain('details: toSemanticErrorDetails');
    expect(reviewPatchImportSource).toContain('validateReviewPatchDecisionIds');
    expect(reviewPatchImportSource).toContain('details: toSemanticErrorDetails');
  });
});
