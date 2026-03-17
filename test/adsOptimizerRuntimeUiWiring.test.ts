import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(process.cwd(), 'apps/web/src/app/ads/optimizer/page.tsx');
const actionsPath = path.join(process.cwd(), 'apps/web/src/app/ads/optimizer/actions.ts');
const panelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerHistoryPanel.tsx'
);
const targetsPanelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerTargetsPanel.tsx'
);
const runtimePath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/runtime.ts'
);
const recommendationPath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/recommendation.ts'
);

describe('ads optimizer phase 4 runtime wiring', () => {
  it('loads history data only for the history utility and renders the history panel', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain("utility === 'history' ? await getAdsOptimizerHistoryViewData(asin) : null");
    expect(source).toContain('<OptimizerHistoryPanel');
    expect(source).toContain('<OptimizerUtilityNav');
    expect(source).toContain("utility: 'history'");
    expect(source).toContain('runAdsOptimizerNowAction');
    expect(source).toContain("const requestedRunId = paramValue('runId')?.trim() || null");
    expect(source).toContain('buildAdsOptimizerHref');
  });

  it('wires a manual run server action through the runtime service', () => {
    const source = fs.readFileSync(actionsPath, 'utf-8');

    expect(source).toContain('executeAdsOptimizerManualRun');
    expect(source).toContain('executeAdsOptimizerWorkspaceHandoff');
    expect(source).toContain('export async function runAdsOptimizerNowAction');
    expect(source).toContain('export async function handoffAdsOptimizerToWorkspaceAction');
    expect(source).toContain("revalidatePath('/ads/optimizer')");
    expect(source).toContain("revalidatePath('/ads/performance')");
    expect(source).toContain('Optimizer run ${result.runId} completed');
    expect(source).toContain('Optimizer handoff created draft ${result.changeSetName}');
    expect(source).toContain('Diagnostics were saved to history.');
  });

  it('keeps the history panel honest about snapshot-only behavior', () => {
    const source = fs.readFileSync(panelPath, 'utf-8');

    expect(source).toContain('Manual runs capture auditable snapshots only');
    expect(source).toContain('Phase 8 now persists deterministic read-only recommendation sets');
    expect(source).toContain('handoff still happens later from the Targets view');
    expect(source).toContain('optimizer-owned tables here');
    expect(source).toContain('resolved effective optimizer rule-pack version');
    expect(source).toContain('Effective rule pack');
    expect(source).toContain('Strategy profile');
    expect(source).toContain('Product archetype');
    expect(source).toContain('Run optimizer now');
    expect(source).toContain('Phase 4 manual runs support one ASIN at a time.');
    expect(source).toContain('Open in Targets');
    expect(source).toContain('runId: run.run_id');
  });

  it('keeps the targets panel explicit about persisted archetype and strategy-profile context', () => {
    const source = fs.readFileSync(targetsPanelPath, 'utf-8');

    expect(source).toContain('using ${formatStrategyProfile(');
    expect(source).toContain('Product archetype');
    expect(source).toContain('Strategy profile');
    expect(source).toContain('Persisted from the effective rule-pack version used for this run.');
  });

  it('stores recommendation snapshots as read-only Phase 11 recommendation sets', () => {
    const runtimeSource = fs.readFileSync(runtimePath, 'utf-8');
    const recommendationSource = fs.readFileSync(recommendationPath, 'utf-8');

    expect(runtimeSource).toContain('buildAdsOptimizerRecommendationSnapshots');
    expect(recommendationSource).toContain("phase: 11");
    expect(recommendationSource).toContain('portfolio_controls');
    expect(recommendationSource).toContain('exception_signals');
    expect(recommendationSource).toContain('read_only_recommendation_only');
  });

  it('loads prior comparable runs and handoff audit into the targets trust layer', () => {
    const runtimeSource = fs.readFileSync(runtimePath, 'utf-8');

    expect(runtimeSource).toContain('previousComparableRun');
    expect(runtimeSource).toContain('buildAdsOptimizerRunComparison');
    expect(runtimeSource).toContain('getRulePackVersion');
    expect(runtimeSource).toContain('resolveAdsOptimizerRuntimeContextForAsin');
    expect(runtimeSource).toContain('loadOptimizerWorkspaceHandoffAudit');
    expect(runtimeSource).toContain('comparison');
    expect(runtimeSource).toContain('getAdsOptimizerRunById');
    expect(runtimeSource).toContain('resolvedContextSource');
    expect(runtimeSource).toContain('runLookupError');
  });
});
