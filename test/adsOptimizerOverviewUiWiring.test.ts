import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(process.cwd(), 'apps/web/src/app/ads/optimizer/page.tsx');
const overviewPath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/overview.ts'
);
const managerPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerOverviewPanel.tsx'
);

describe('ads optimizer phase 3 overview wiring', () => {
  it('loads overview data only for the overview view and renders the overview panel', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain("view === 'overview' && utility === null && asin !== 'all'");
    expect(source).toContain('await getAdsOptimizerOverviewData({');
    expect(source).toContain('trendEnabled: overviewTrendEnabled');
    expect(source).toContain('trendMode: overviewTrendMode');
    expect(source).toContain('<OptimizerOverviewPanel');
    expect(source).toContain('trendEnabled={overviewTrendEnabled}');
  });

  it('defines deterministic product-state and objective helpers', () => {
    const source = fs.readFileSync(overviewPath, 'utf-8');

    expect(source).toContain('export const classifyAdsOptimizerProductState =');
    expect(source).toContain('export const recommendAdsOptimizerObjective =');
    expect(source).toContain("value: 'structurally_weak'");
    expect(source).toContain("value: 'Rank Growth'");
  });

  it('shows the current read-only optimizer boundary in the overview panel', () => {
    const source = fs.readFileSync(managerPath, 'utf-8');

    expect(source).toContain('Select one ASIN to load the Phase 3 product command-center.');
    expect(source).toContain('The optimizer overview computes product inputs, product state, and objective');
    expect(source).toContain('Target profiling, scoring, roles, and read-only');
    expect(source).toContain('recommendations are active in the optimizer run flow');
    expect(source).toContain('Execution handoff or staging into Ads Workspace is');
    expect(source).toContain('still not active in this phase.');
    expect(source).toContain('Traffic and conversion inputs');
    expect(source).toContain('Selected date range defines the current analysis window:');
    expect(source).toContain('The previous period is auto-derived as the equal-length range immediately before it.');
    expect(source).toContain('Trend mode only shows the trend for that selected window.');
    expect(source).toContain('Trend mode');
    expect(source).toContain('Previous window');
    expect(source).toContain('Ranking ladder');
    expect(source).toContain('Δ vs prev');
    expect(source).toContain('band.currentCount');
    expect(source).toContain('band.deltaCount');
    expect(source).not.toContain('Traffic block');
    expect(source).not.toContain('Conversion block');
  });
});
