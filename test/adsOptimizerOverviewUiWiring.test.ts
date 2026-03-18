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
const overviewFolder = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/overview'
);

describe('ads optimizer phase 4 overview wiring', () => {
  it('loads overview data only for the overview view and renders the overview panel', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain("view === 'overview' && utility === null && asin !== 'all'");
    expect(source).toContain('await getAdsOptimizerOverviewData({');
    expect(source).toContain('trendEnabled: overviewTrendEnabled');
    expect(source).toContain('trendMode: overviewTrendMode');
    expect(source).toContain('<OptimizerOverviewPanel');
    expect(source).toContain('trendEnabled={overviewTrendEnabled}');
    expect(source).toContain('saveHeroQueryAction={saveAdsOptimizerHeroQueryAction}');
    expect(source).toContain('resetHeroQueryAction={resetAdsOptimizerHeroQueryAction}');
  });

  it('defines deterministic product-state and objective helpers', () => {
    const source = fs.readFileSync(overviewPath, 'utf-8');

    expect(source).toContain('export const classifyAdsOptimizerProductState =');
    expect(source).toContain('export const recommendAdsOptimizerObjective =');
    expect(source).toContain('heroQueryDemand');
    expect(source).toContain('heroQuerySelection');
    expect(source).toContain('formatSqpWeekEndingLabel');
    expect(source).toContain("value: 'structurally_weak'");
    expect(source).toContain("value: 'Rank Growth'");
  });

  it('keeps OptimizerOverviewPanel as the stable wrapper over the new overview subcomponents', () => {
    const source = fs.readFileSync(managerPath, 'utf-8');

    expect(source).toContain("import OverviewEmptyState from './overview/OverviewEmptyState';");
    expect(source).toContain("import OverviewHeaderSummary from './overview/OverviewHeaderSummary';");
    expect(source).toContain("import OverviewKpiGrid from './overview/OverviewKpiGrid';");
    expect(source).toContain("import OverviewRankingLadder from './overview/OverviewRankingLadder';");
    expect(source).toContain("import OverviewTrafficSection from './overview/OverviewTrafficSection';");
    expect(source).toContain("import OverviewConversionSection from './overview/OverviewConversionSection';");
    expect(source).toContain("import OverviewNotesSection from './overview/OverviewNotesSection';");
    expect(source).toContain('<OverviewHeaderSummary');
    expect(source).toContain('<OverviewKpiGrid');
    expect(source).toContain('<OverviewRankingLadder');
    expect(source).toContain('saveHeroQueryAction={props.saveHeroQueryAction}');
    expect(source).toContain('resetHeroQueryAction={props.resetHeroQueryAction}');
    expect(source).toContain('<OverviewTrafficSection');
    expect(source).toContain('<OverviewConversionSection');
    expect(source).toContain('<OverviewNotesSection');
  });

  it('defines dedicated Phase 4 overview section components with the operator-facing hierarchy', () => {
    const emptyStateSource = fs.readFileSync(
      path.join(overviewFolder, 'OverviewEmptyState.tsx'),
      'utf-8'
    );
    const headerSource = fs.readFileSync(
      path.join(overviewFolder, 'OverviewHeaderSummary.tsx'),
      'utf-8'
    );
    const kpiSource = fs.readFileSync(path.join(overviewFolder, 'OverviewKpiGrid.tsx'), 'utf-8');
    const rankingSource = fs.readFileSync(
      path.join(overviewFolder, 'OverviewRankingLadder.tsx'),
      'utf-8'
    );
    const trafficSource = fs.readFileSync(
      path.join(overviewFolder, 'OverviewTrafficSection.tsx'),
      'utf-8'
    );
    const conversionSource = fs.readFileSync(
      path.join(overviewFolder, 'OverviewConversionSection.tsx'),
      'utf-8'
    );
    const notesSource = fs.readFileSync(
      path.join(overviewFolder, 'OverviewNotesSection.tsx'),
      'utf-8'
    );

    expect(emptyStateSource).toContain('Select one ASIN to load the Phase 3 product command-center.');
    expect(emptyStateSource).toContain('The optimizer overview computes product inputs, product state, and objective');

    expect(headerSource).toContain('Product command-center');
    expect(headerSource).toContain('Trend mode');
    expect(headerSource).toContain('Ads Workspace remains the only staging and execution boundary.');

    expect(kpiSource).toContain('KPI cards');
    expect(kpiSource).toContain('Economics snapshot');
    expect(kpiSource).toContain('Profit after ads');
    expect(kpiSource).toContain('Selected period');
    expect(kpiSource).toContain('contribution-after-ads metric');

    expect(rankingSource).toContain('Ranking ladder');
    expect(rankingSource).toContain('Current bucket counts');
    expect(rankingSource).toContain('Current');
    expect(rankingSource).toContain('Previous');
    expect(rankingSource).toContain('Change');
    expect(rankingSource).toContain('Save default hero query for this ASIN');
    expect(rankingSource).toContain('Save as default');
    expect(rankingSource).toContain('Reset to auto');
    expect(rankingSource).toContain('Saved manual query is not present in the current ranking candidates');
    expect(rankingSource).toContain('band.currentCount');
    expect(rankingSource).toContain('band.deltaCount');

    expect(trafficSource).toContain('Traffic');
    expect(trafficSource).toContain('Reach and demand inputs');
    expect(trafficSource).toContain('Hero query demand');
    expect(trafficSource).toContain('Hero query demand unavailable');
    expect(trafficSource).toContain('Tracked total SQP demand');
    expect(trafficSource).toContain('Hero query');
    expect(trafficSource).not.toContain('Traffic block');

    expect(conversionSource).toContain('Conversion');
    expect(conversionSource).toContain('How traffic is turning into orders');
    expect(conversionSource).not.toContain('Conversion block');

    expect(notesSource).toContain('Notes / coverage / warnings');
    expect(notesSource).toContain('formatSqpWeekEndingLabel');
    expect(notesSource).toContain('Coverage notes');
    expect(notesSource).toContain('Warnings');
  });
});
