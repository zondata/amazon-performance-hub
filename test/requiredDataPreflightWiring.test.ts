import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const evaluationImportRoutePath = path.join(
  process.cwd(),
  'apps/web/src/app/logbook/experiments/[id]/evaluation-import/route.ts'
);
const evaluationImportUiPath = path.join(
  process.cwd(),
  'apps/web/src/components/logbook/ExperimentEvaluationOutputPackImport.tsx'
);

describe('required data preflight wiring', () => {
  it('runs preflight before evaluation import execution', () => {
    const source = fs.readFileSync(evaluationImportRoutePath, 'utf-8');
    const preflightIndex = source.indexOf('const preflight = runRequiredDataPreflight');
    const gatingIndex = source.indexOf('if (!preflight.report.overall_ok)');
    const importIndex = source.indexOf('const result = await importExperimentEvaluationOutputPack');

    expect(preflightIndex).toBeGreaterThan(-1);
    expect(gatingIndex).toBeGreaterThan(-1);
    expect(importIndex).toBeGreaterThan(-1);
    expect(preflightIndex).toBeLessThan(importIndex);
    expect(gatingIndex).toBeLessThan(importIndex);
    expect(source).toContain('Required data missing or invalid. Analysis halted');
    expect(source).toContain('preflight_rendered');
  });

  it('renders required data availability before evaluation success details', () => {
    const source = fs.readFileSync(evaluationImportUiPath, 'utf-8');
    const checklistIndex = source.indexOf('Required data availability');
    const successIndex = source.indexOf('Evaluation imported.');

    expect(checklistIndex).toBeGreaterThan(-1);
    expect(successIndex).toBeGreaterThan(-1);
    expect(checklistIndex).toBeLessThan(successIndex);
  });
});
