import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(process.cwd(), 'apps/web/src/app/ads/optimizer/page.tsx');
const actionsPath = path.join(process.cwd(), 'apps/web/src/app/ads/optimizer/actions.ts');
const headerPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerRunScopeHeader.tsx'
);
const panelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerHistoryPanel.tsx'
);
const targetsPanelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetsPageShell.tsx'
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

  it('wires the shared header to run-now and latest-run context without making Overview run-bound', () => {
    const pageSource = fs.readFileSync(pagePath, 'utf-8');
    const headerSource = fs.readFileSync(headerPath, 'utf-8');

    expect(pageSource).toContain('getAdsOptimizerHeaderRunContext');
    expect(pageSource).toContain('<OptimizerRunScopeHeader');
    expect(pageSource).toContain('runNowAction={runAdsOptimizerNowAction}');
    expect(pageSource).toContain('persistentRunId={effectiveRunId}');
    expect(pageSource).toContain('trendEnabled={overviewTrendEnabled}');
    expect(pageSource).toContain('runId: effectiveRunId');

    expect(headerSource).toContain('Overview stays ASIN + date-range driven.');
    expect(headerSource).toContain('Targets stays the persisted run-review');
    expect(headerSource).toContain('surface, and any supported handoff still stages into Ads Workspace.');
    expect(headerSource).toContain('Trend display');
    expect(headerSource).toContain('Selected date range defines the current analysis window.');
    expect(headerSource).toContain('auto-derived as the equal-length range immediately before it.');
    expect(headerSource).toContain('Trend mode only shows');
    expect(headerSource).toContain('the trend for that selected window');
    expect(headerSource).toContain('applies immediately.');
    expect(headerSource).toContain('Run context');
    expect(headerSource).toContain('Latest completed run');
    expect(headerSource).toContain('Open latest in Targets');
    expect(headerSource).toContain('Run now');
    expect(headerSource).toContain('success_view');
    expect(headerSource).toContain("label: 'On', enabled: true");
    expect(headerSource).toContain("label: 'Off', enabled: false");
    expect(headerSource).toContain("name=\"trend\" value={props.trendEnabled ? 'on' : 'off'}");
    expect(headerSource).toContain('Creates a new persisted run');
  });

  it('wires a manual run server action through the runtime service', () => {
    const source = fs.readFileSync(actionsPath, 'utf-8');

    expect(source).toContain('executeAdsOptimizerManualRun');
    expect(source).toContain('buildAdsOptimizerHref');
    expect(source).toContain('executeAdsOptimizerWorkspaceHandoff');
    expect(source).toContain('export async function runAdsOptimizerNowAction');
    expect(source).toContain('export async function handoffAdsOptimizerToWorkspaceAction');
    expect(source).toContain("revalidatePath('/ads/optimizer')");
    expect(source).toContain("revalidatePath('/ads/performance')");
    expect(source).toContain('Optimizer run ${result.runId} completed');
    expect(source).toContain("successView === 'targets'");
    expect(source).toContain('Optimizer handoff created draft ${result.changeSetName}');
    expect(source).toContain('Diagnostics were saved to history.');
  });

  it('wires inline override saves through a non-redirecting action-state server action', () => {
    const pageSource = fs.readFileSync(pagePath, 'utf-8');
    const actionsSource = fs.readFileSync(actionsPath, 'utf-8');
    const inlineActionStart = actionsSource.indexOf(
      'export async function saveAdsOptimizerRecommendationOverrideInlineAction'
    );
    const inlineActionEnd = actionsSource.indexOf(
      'export async function saveAdsOptimizerDraftVersionAction'
    );
    expect(inlineActionStart).toBeGreaterThan(-1);
    expect(inlineActionEnd).toBeGreaterThan(inlineActionStart);
    const inlineActionSource = actionsSource.slice(inlineActionStart, inlineActionEnd);

    expect(pageSource).toContain('saveAdsOptimizerRecommendationOverrideInlineAction');
    expect(pageSource).toContain(
      'saveRecommendationOverrideAction={saveAdsOptimizerRecommendationOverrideInlineAction}'
    );
    expect(actionsSource).toContain('export async function saveAdsOptimizerRecommendationOverrideInlineAction');
    expect(inlineActionSource).toContain('saveAdsOptimizerRecommendationOverride(payload)');
    expect(inlineActionSource).toContain('notice: `Saved manual override for ${override.target_id}.`');
    expect(inlineActionSource).not.toContain('redirect(');
    expect(inlineActionSource).not.toContain('redirectWithFlash');
    expect(inlineActionSource).not.toContain("revalidatePath('/ads/optimizer')");
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
    expect(source).toContain('buildAdsOptimizerTargetRowTableSummaries');
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

    expect(runtimeSource).toContain("from './lastDetectedChange'");
    expect(runtimeSource).toContain('loadAdsOptimizerLastDetectedChangesForTargets');
    expect(runtimeSource).toContain('createEmptyAdsOptimizerLastDetectedChange');
    expect(runtimeSource).toContain('const lastDetectedChangeByTargetSnapshotId =');
    expect(runtimeSource).toContain(
      'rows.length > 0 ? await loadAdsOptimizerLastDetectedChangesForTargets(rows) : new Map()'
    );
    expect(runtimeSource).toContain('const rowsWithLastDetectedChange = rows.map((row) => ({');
    expect(runtimeSource).toContain('lastDetectedChange:');
    expect(runtimeSource).toContain('row.lastDetectedChange ??');
    expect(runtimeSource).not.toContain('previousComparable: loadAdsOptimizerLastDetectedChangesForTargets');
    expect(runtimeSource).not.toContain('previousComparableRun.lastDetectedChange');

    expect(runtimeSource).toContain('previousComparableRun');
    expect(runtimeSource).toContain('buildAdsOptimizerOverviewComparisonWindow');
    expect(runtimeSource).toContain('loadAdsOptimizerTargetProfiles');
    expect(runtimeSource).toContain('mapTargetProfileRowToSnapshotView');
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
