import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const detailPagePath = path.join(
  process.cwd(),
  'apps/web/src/app/ads/optimizer/outcomes/[changeSetId]/page.tsx'
);
const detailComponentPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerOutcomeReviewDetail.tsx'
);
const loaderPath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/outcomeReview.ts'
);
const scoringPath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/outcomeReviewScoring.ts'
);
const panelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerOutcomeReviewPanel.tsx'
);

describe('ads optimizer outcome review detail wiring', () => {
  it('adds a dedicated detail route that normalizes horizon context and rejects non-optimizer change sets honestly', () => {
    const source = fs.readFileSync(detailPagePath, 'utf-8');

    expect(source).toContain('getAdsOptimizerOutcomeReviewDetailData');
    expect(source).toContain('normalizeAdsOptimizerOutcomeHorizon');
    expect(source).toContain('normalizeAdsOptimizerOutcomeMetric');
    expect(source).toContain('This change set is not optimizer-originated.');
    expect(source).toContain('<OptimizerOutcomeReviewDetail');
  });

  it('renders the required detail sections in the operator-facing order', () => {
    const source = fs.readFileSync(detailComponentPath, 'utf-8');

    expect(source).toContain('What changed');
    expect(source).toContain('Objective context');
    expect(source).toContain('Before vs after vs latest');
    expect(source).toContain('Outcome score');
    expect(source).toContain('Expandable details');
    expect(source).toContain('Validation summary');
    expect(source).toContain('Score calculation inputs');
    expect(source).toContain('Raw staged change payloads');
  });

  it('keeps detail loading deterministic, objective-aware, and linked to validated effective dates', () => {
    const loaderSource = fs.readFileSync(loaderPath, 'utf-8');
    const scoringSource = fs.readFileSync(scoringPath, 'utf-8');
    const panelSource = fs.readFileSync(panelPath, 'utf-8');

    expect(loaderSource).toContain('getAdsOptimizerOutcomeReviewDetailData');
    expect(loaderSource).toContain('buildAdsOptimizerOutcomeReviewWindowSummaries');
    expect(loaderSource).toContain('buildAdsOptimizerOutcomeReviewVisibilitySignal');
    expect(loaderSource).toContain('scoreAdsOptimizerOutcomeReview');
    expect(loaderSource).toContain('validatedEffectiveDate');
    expect(loaderSource).toContain('source !== HANDOFF_SOURCE');
    expect(scoringSource).toContain("label = 'too_early'");
    expect(scoringSource).toContain("label = 'confirmed_win'");
    expect(scoringSource).toContain("label = 'confirmed_loss'");
    expect(scoringSource).toContain('Rank Defense');
    expect(scoringSource).toContain('Rank-oriented scoring could not use comparable visibility data');
    expect(panelSource).toContain('Open phase detail');
    expect(panelSource).toContain('/ads/optimizer/outcomes/');
  });
});
