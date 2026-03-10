import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(process.cwd(), 'apps/web/src/app/ads/optimizer/page.tsx');
const panelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerTargetsPanel.tsx'
);
const runtimePath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/runtime.ts'
);

describe('ads optimizer phase 5 target profile wiring', () => {
  it('loads targets view data only for the targets view and renders the targets panel', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain("view === 'targets' && asin !== 'all'");
    expect(source).toContain('getAdsOptimizerTargetsViewData');
    expect(source).toContain('<OptimizerTargetsPanel');
  });

  it('keeps the targets panel honest about raw + derived review-only behavior', () => {
    const source = fs.readFileSync(panelPath, 'utf-8');

    expect(source).toContain('Raw + derived target profiles only');
    expect(source).toContain('No state engine, role engine, recommendation logic, or execution handoff');
    expect(source).toContain('No captured target profiles exist for this ASIN/date range yet.');
    expect(source).toContain('Coverage gaps stay explicit instead of being guessed.');
  });

  it('pulls exact-window run snapshots instead of inventing live optimizer output', () => {
    const source = fs.readFileSync(runtimePath, 'utf-8');

    expect(source).toContain('export const getAdsOptimizerTargetsViewData');
    expect(source).toContain("run.status === 'completed'");
    expect(source).toContain('run.date_start === args.start && run.date_end === args.end');
    expect(source).toContain('listAdsOptimizerTargetSnapshotsByRun');
    expect(source).toContain('mapTargetSnapshotToProfileView');
  });
});
