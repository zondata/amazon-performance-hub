import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const shellPath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/shell.ts'
);
const pagePath = path.join(
  process.cwd(),
  'apps/web/src/app/ads/optimizer/page.tsx'
);
const panelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerOutcomeReviewPanel.tsx'
);
const loaderPath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/outcomeReview.ts'
);

describe('ads optimizer outcome review wiring', () => {
  it('adds the new outcomes shell view and safe search-param helpers', () => {
    const source = fs.readFileSync(shellPath, 'utf-8');

    expect(source).toContain("{ label: 'Outcome Review', value: 'outcomes' }");
    expect(source).toContain('normalizeAdsOptimizerOutcomeHorizon');
    expect(source).toContain('normalizeAdsOptimizerOutcomeMetric');
    expect(source).toContain(": '7';");
    expect(source).toContain(": 'contribution_after_ads';");
    expect(source).toContain("usp.set('horizon', params.horizon)");
    expect(source).toContain("usp.set('metric', params.metric)");
  });

  it('loads and renders the outcomes view with honest product-scoped empty state copy', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain("outcomes: {");
    expect(source).toContain('Outcome review scope');
    expect(source).toContain('Select one ASIN to review validated optimizer outcome lineage.');
    expect(source).toContain('normalizeAdsOptimizerOutcomeHorizon');
    expect(source).toContain('normalizeAdsOptimizerOutcomeMetric');
    expect(source).toContain("view === 'outcomes' && asin !== 'all'");
    expect(source).toContain('getAdsOptimizerOutcomeReviewData');
    expect(source).toContain('<OptimizerOutcomeReviewPanel');
    expect(source).toContain('Outcome review lineage');
    expect(source).toContain("name=\"horizon\"");
    expect(source).toContain("name=\"metric\"");
  });

  it('keeps the panel and loader read-only, lineage-first, and marker-driven', () => {
    const panelSource = fs.readFileSync(panelPath, 'utf-8');
    const loaderSource = fs.readFileSync(loaderPath, 'utf-8');

    expect(panelSource).toContain("'use client';");
    expect(panelSource).toContain('Review validated optimizer lineage');
    expect(panelSource).toContain('How to read this page');
    expect(panelSource).toContain('Score filter');
    expect(panelSource).toContain('Segment review');
    expect(panelSource).toContain('Validated phase markers sit on the');
    expect(panelSource).toContain('effective validated date only.');
    expect(panelSource).toContain('Open phase detail');
    expect(panelSource).toContain('selectedSegment');
    expect(panelSource).toContain('setSelectedPhaseId(segment.phaseChangeSetId)');
    expect(panelSource).toContain('Linked to validated marker');
    expect(panelSource).toContain('No caution');
    expect(panelSource).toContain('Phase list');
    expect(panelSource).toContain('Select a validated phase marker or phase row below');
    expect(panelSource).toContain('No optimizer-originated handoff phases were found');

    expect(loaderSource).toContain("const HANDOFF_SOURCE = 'ads_optimizer_phase10_handoff';");
    expect(loaderSource).toContain(".from('ads_change_sets')");
    expect(loaderSource).toContain('generated_run_id');
    expect(loaderSource).toContain(".contains('after_json', { run_id: runId })");
    expect(loaderSource).toContain(".from('log_change_validations')");
    expect(loaderSource).toContain('validated_snapshot_date');
    expect(loaderSource).toContain('buildAdsOptimizerOutcomeReviewPhaseSummaries');
    expect(loaderSource).toContain('buildAdsOptimizerOutcomeReviewSegments');
    expect(loaderSource).toContain("status: resolvePhaseStatus(validationSummary)");
    expect(loaderSource).toContain("contribution_after_ads: point.profits ?? null");
  });
});
