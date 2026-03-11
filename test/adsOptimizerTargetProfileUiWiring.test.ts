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

describe('ads optimizer phase 7 target role wiring', () => {
  it('loads targets view data only for the targets view and renders the targets panel', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain("view === 'targets' && asin !== 'all'");
    expect(source).toContain('getAdsOptimizerTargetsViewData');
    expect(source).toContain('<OptimizerTargetsPanel');
  });

  it('keeps the targets panel honest about role-engine review-only behavior', () => {
    const source = fs.readFileSync(panelPath, 'utf-8');

    expect(source).toContain("'use client';");
    expect(source).toContain('useState');
    expect(source).toContain('Target profiles plus deterministic role + guardrail outputs');
    expect(source).toContain('desired role, current role, resolved');
    expect(source).toContain('guardrail envelopes, and read-only recommendation sets.');
    expect(source).toContain('No captured target roles exist for this ASIN/date range yet.');
    expect(source).toContain('Coverage gaps stay explicit instead of being guessed.');
    expect(source).toContain('View coverage');
    expect(source).toContain('CoverageDetailsToggle');
    expect(source).toContain('StatePill');
    expect(source).toContain('RolePill');
    expect(source).toContain('DetailSection');
    expect(source).toContain('Product state snapshot');
    expect(source).toContain('Summary reason codes');
    expect(source).toContain('Role resolution');
    expect(source).toContain('Guardrail-ready envelope');
    expect(source).toContain('Desired role');
    expect(source).toContain('Current role');
    expect(source).toContain('Top search-term diagnostics');
    expect(source).toContain('font-mono text-[11px] leading-4 text-foreground');
    expect(source).toContain('xl:grid-cols-2');
    expect(source).toContain('const TARGET_TABLE_COL_COUNT = 32;');
    expect(source).toContain('setExpandedTargetSnapshotId');
    expect(source).toContain('aria-controls={`target-detail-panel-${row.targetSnapshotId}`}');
    expect(source).toContain('colSpan={TARGET_TABLE_COL_COUNT}');
    expect(source).toContain('Target details');
    expect(source).toContain('const coverageSummary = getCoverageSummary(row);');
    expect(source).toContain('Ready {coverageSummary.ready}');
    expect(source).toContain('Missing {coverageSummary.missing}');
    expect(source).toContain('Partial {coverageSummary.partial}');
  });

  it('pulls exact-window run snapshots instead of inventing live optimizer output', () => {
    const source = fs.readFileSync(runtimePath, 'utf-8');

    expect(source).toContain('export const getAdsOptimizerTargetsViewData');
    expect(source).toContain("run.status === 'completed'");
    expect(source).toContain('run.date_start === args.start && run.date_end === args.end');
    expect(source).toContain('listAdsOptimizerProductSnapshotsByRun');
    expect(source).toContain('readAdsOptimizerProductRunState');
    expect(source).toContain('listAdsOptimizerTargetSnapshotsByRun');
    expect(source).toContain('mapTargetSnapshotToProfileView');
    expect(source).toContain('role_engine');
    expect(source).toContain('insertAdsOptimizerRoleTransitionLogs');
  });
});
