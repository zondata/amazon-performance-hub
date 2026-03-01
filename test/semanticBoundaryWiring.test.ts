import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

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
const evaluationRoutePath = path.join(
  process.cwd(),
  'apps/web/src/app/logbook/experiments/[id]/evaluation-import/route.ts'
);
const reviewPatchRoutePath = path.join(
  process.cwd(),
  'apps/web/src/app/logbook/experiments/[id]/review-patch-pack/route.ts'
);

describe('semantic boundary wiring', () => {
  it('validates product experiment output packs semantically before writes', () => {
    const source = fs.readFileSync(importProductPath, 'utf-8');
    expect(source).toContain('validateExperimentPackSemanticBoundaries');
    expect(source).toContain('semanticValidationFailed');
    expect(source).toContain('toSemanticErrorDetails');
  });

  it('validates evaluation output packs semantically before insert', () => {
    const source = fs.readFileSync(importEvaluationPath, 'utf-8');
    expect(source).toContain('validateEvaluationPackSemanticBoundaries');
    expect(source).toContain('semanticValidationFailed');
    expect(source).toContain('toSemanticErrorDetails');
  });

  it('validates review patch decisions against proposal change_ids', () => {
    const source = fs.readFileSync(importReviewPatchPath, 'utf-8');
    expect(source).toContain('validateReviewPatchDecisionIds');
    expect(source).toContain('Semantic validation failed for review patch pack.');
    expect(source).toContain('toSemanticErrorDetails');
  });

  it('propagates semantic details in normalized evaluation/patch import route failures', () => {
    const evaluationRoute = fs.readFileSync(evaluationRoutePath, 'utf-8');
    const patchRoute = fs.readFileSync(reviewPatchRoutePath, 'utf-8');
    expect(evaluationRoute).toContain('...(result.details ? result.details : {})');
    expect(patchRoute).toContain('...(result.details ? result.details : {})');
  });
});
