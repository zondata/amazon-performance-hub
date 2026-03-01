import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const importProductExperimentOutputPackPath = path.join(
  process.cwd(),
  'apps/web/src/lib/logbook/aiPack/importProductExperimentOutputPack.ts'
);
const evalDataPackRoutePath = path.join(
  process.cwd(),
  'apps/web/src/app/logbook/experiments/[id]/ai-eval-data-pack/route.ts'
);
const importExperimentEvaluationOutputPackPath = path.join(
  process.cwd(),
  'apps/web/src/lib/logbook/aiPack/importExperimentEvaluationOutputPack.ts'
);
const experimentDetailPagePath = path.join(
  process.cwd(),
  'apps/web/src/app/logbook/experiments/[id]/page.tsx'
);

describe('output contract v1 wiring', () => {
  it('normalizes and persists contract metadata when importing experiment output packs', () => {
    const source = fs.readFileSync(importProductExperimentOutputPackPath, 'utf-8');
    expect(source).toContain('normalizeScopeWithAdsOptimizationContractV1');
    expect(source).toContain('defaultWorkflowMode: true');
    expect(source).toContain('scope: normalizedScope');
  });

  it('includes contract metadata in evaluation data pack payloads', () => {
    const source = fs.readFileSync(evalDataPackRoutePath, 'utf-8');
    expect(source).toContain('proposal_contract');
    expect(source).toContain('ads_optimization_v1');
    expect(source).toContain('context.contract_ads_optimization_v1');
  });

  it('snapshots contract metadata into evaluation metrics_json on evaluation import', () => {
    const source = fs.readFileSync(importExperimentEvaluationOutputPackPath, 'utf-8');
    expect(source).toContain('snapshotAdsOptimizationContractV1');
    expect(source).toContain('proposal_contract_snapshot');
    expect(source).toContain('proposal_contract');
    expect(source).toContain('ads_optimization_v1');
  });

  it('renders output contract v1 panel on experiment detail page', () => {
    const source = fs.readFileSync(experimentDetailPagePath, 'utf-8');
    expect(source).toContain('Output Contract V1');
    expect(source).toContain('Baseline cutoff');
    expect(source).toContain('forecastDirectionalKpis');
    expect(source).toContain('workflow_mode');
  });
});
