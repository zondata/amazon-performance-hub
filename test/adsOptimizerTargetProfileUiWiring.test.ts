import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(process.cwd(), 'apps/web/src/app/ads/optimizer/page.tsx');
const panelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerTargetsPanel.tsx'
);
const shellPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetsPageShell.tsx'
);
const toolbarPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetsToolbar.tsx'
);
const summaryRowPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetSummaryRow.tsx'
);
const expandedPanelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetExpandedPanel.tsx'
);
const overrideFormPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetOverrideForm.tsx'
);
const runtimePath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/runtime.ts'
);

describe('ads optimizer phase 9 target review wiring', () => {
  it('loads targets view data only for the targets view and renders the targets panel', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain(
      "view === 'targets' && utility === null && (asin !== 'all' || requestedRunId !== null)"
    );
    expect(source).toContain('getAdsOptimizerTargetsViewData');
    expect(source).toContain('<OptimizerTargetsPanel');
    expect(source).toContain('Review + comparison queue');
    expect(source).toContain('handoffAdsOptimizerToWorkspaceAction');
    expect(source).toContain('saveAdsOptimizerRecommendationOverrideAction');
    expect(source).toContain("paramValue('override_error') === '1'");
    expect(source).toContain('runId: requestedRunId');
  });

  it('splits the targets review UI into a stable wrapper plus V2 shell/subcomponents', () => {
    const wrapperSource = fs.readFileSync(panelPath, 'utf-8');
    const shellSource = fs.readFileSync(shellPath, 'utf-8');
    const toolbarSource = fs.readFileSync(toolbarPath, 'utf-8');
    const summaryRowSource = fs.readFileSync(summaryRowPath, 'utf-8');
    const expandedPanelSource = fs.readFileSync(expandedPanelPath, 'utf-8');
    const overrideFormSource = fs.readFileSync(overrideFormPath, 'utf-8');

    expect(wrapperSource).toContain('TargetsPageShell');
    expect(shellSource).toContain('buildAdsOptimizerTargetRowSummaries');
    expect(shellSource).toContain('filterAdsOptimizerTargetRowSummaries');
    expect(shellSource).toContain('<TargetsToolbar');
    expect(shellSource).toContain('<TargetSummaryRow');
    expect(shellSource).toContain('<TargetExpandedPanel');
    expect(shellSource).toContain('<TargetOverrideForm');
    expect(shellSource).toContain('Optimizer command center');
    expect(shellSource).toContain('Target queue');
    expect(shellSource).toContain('buildWorkspaceTargetHref');
    expect(shellSource).toContain('buildWhyFlaggedNarrative');
    expect(shellSource).toContain("inspection-${section.id}");
    expect(shellSource).toContain('section.render()');
    expect(shellSource).toContain('Requested persisted optimizer run could not be loaded.');
    expect(shellSource).toContain('No persisted optimizer review run exists for this ASIN/date range yet.');
    expect(toolbarSource).toContain('Select visible stageable');
    expect(toolbarSource).toContain('Handoff selected to Ads Workspace');
    expect(summaryRowSource).toContain('data-persisted-target-key');
    expect(summaryRowSource).toContain('Review coverage buckets');
    expect(summaryRowSource).toContain('Missing (suspicious):');
    expect(expandedPanelSource).toContain('Target detail drawer');
    expect(overrideFormSource).toContain('Save override bundle');
    expect(overrideFormSource).toContain('Replacement action bundle');
  });

  it('pulls exact-window run snapshots plus persisted recommendations and role history', () => {
    const source = fs.readFileSync(runtimePath, 'utf-8');

    expect(source).toContain('export const getAdsOptimizerTargetsViewData');
    expect(source).toContain("runById.status !== 'completed'");
    expect(source).toContain('run.date_start === args.start');
    expect(source).toContain('run.date_end === args.end');
    expect(source).toContain('listAdsOptimizerProductSnapshotsByRun');
    expect(source).toContain('listActiveAdsOptimizerRecommendationOverrides');
    expect(source).toContain('readAdsOptimizerProductRunState');
    expect(source).toContain('listAdsOptimizerTargetSnapshotsByRun');
    expect(source).toContain('listAdsOptimizerRecommendationSnapshotsByRun');
    expect(source).toContain('listAdsOptimizerRoleTransitionLogsByAsin');
    expect(source).toContain('readAdsOptimizerRecommendationSnapshotView');
    expect(source).toContain('mapTargetSnapshotToProfileView');
    expect(source).toContain('recommendationsByTargetSnapshotId');
    expect(source).toContain('roleHistoryByTargetId');
    expect(source).toContain('manualOverride');
    expect(source).toContain('productId');
    expect(source).toContain('requestedRunId');
    expect(source).toContain("resolvedContextSource = 'run_id'");
  });
});
