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

describe('ads optimizer phase 9 target review wiring', () => {
  it('loads targets view data only for the targets view and renders the targets panel', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain("view === 'targets' && asin !== 'all'");
    expect(source).toContain('getAdsOptimizerTargetsViewData');
    expect(source).toContain('<OptimizerTargetsPanel');
    expect(source).toContain('Read-only review queue');
  });

  it('keeps the targets panel honest about phase 9 read-only review behavior', () => {
    const source = fs.readFileSync(panelPath, 'utf-8');

    expect(source).toContain("'use client';");
    expect(source).toContain('useState');
    expect(source).toContain('Optimizer command center');
    expect(source).toContain('Target queue');
    expect(source).toContain('Target detail drawer');
    expect(source).toContain('Review persisted target outputs without leaving');
    expect(source).toContain('read_only_recommendation_only');
    expect(source).toContain('Workspace handoff');
    expect(source).toContain('No persisted optimizer review run exists for this ASIN/date range yet.');
    expect(source).toContain('Coverage gaps and null states are shown explicitly');
    expect(source).toContain('Priority sorting uses the persisted recommendation action priority');
    expect(source).toContain('Recent role transitions');
    expect(source).toContain('Recommended read-only actions');
    expect(source).toContain('Query diagnostics');
    expect(source).toContain('Placement diagnostics');
    expect(source).toContain('Queue order');
    expect(source).toContain('ReasonCodeBadge');
    expect(source).toContain('JsonBlock');
    expect(source).toContain('buildPriorityLabel');
    expect(source).toContain('buildTopList');
    expect(source).toContain('filterRows');
    expect(source).toContain('aria-controls={');
    expect(source).toContain('target-detail-drawer-');
    expect(source).not.toContain('const TARGET_TABLE_COL_COUNT = 32;');
  });

  it('pulls exact-window run snapshots plus persisted recommendations and role history', () => {
    const source = fs.readFileSync(runtimePath, 'utf-8');

    expect(source).toContain('export const getAdsOptimizerTargetsViewData');
    expect(source).toContain("run.status === 'completed'");
    expect(source).toContain('run.date_start === args.start && run.date_end === args.end');
    expect(source).toContain('listAdsOptimizerProductSnapshotsByRun');
    expect(source).toContain('readAdsOptimizerProductRunState');
    expect(source).toContain('listAdsOptimizerTargetSnapshotsByRun');
    expect(source).toContain('listAdsOptimizerRecommendationSnapshotsByRun');
    expect(source).toContain('listAdsOptimizerRoleTransitionLogsByAsin');
    expect(source).toContain('readAdsOptimizerRecommendationSnapshotView');
    expect(source).toContain('mapTargetSnapshotToProfileView');
    expect(source).toContain('recommendationsByTargetSnapshotId');
    expect(source).toContain('roleHistoryByTargetId');
  });
});
