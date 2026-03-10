import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(process.cwd(), 'apps/web/src/app/ads/optimizer/page.tsx');
const actionsPath = path.join(process.cwd(), 'apps/web/src/app/ads/optimizer/actions.ts');
const panelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerHistoryPanel.tsx'
);
const runtimePath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/runtime.ts'
);

describe('ads optimizer phase 4 runtime wiring', () => {
  it('loads history data only for the history view and renders the history panel', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain("view === 'history' ? await getAdsOptimizerHistoryViewData(asin) : null");
    expect(source).toContain('<OptimizerHistoryPanel');
    expect(source).toContain('runAdsOptimizerNowAction');
  });

  it('wires a manual run server action through the runtime service', () => {
    const source = fs.readFileSync(actionsPath, 'utf-8');

    expect(source).toContain('executeAdsOptimizerManualRun');
    expect(source).toContain('export async function runAdsOptimizerNowAction');
    expect(source).toContain("revalidatePath('/ads/optimizer')");
    expect(source).toContain('Optimizer run ${result.runId} completed');
    expect(source).toContain('Diagnostics were saved to history.');
  });

  it('keeps the history panel honest about snapshot-only behavior', () => {
    const source = fs.readFileSync(panelPath, 'utf-8');

    expect(source).toContain('Manual runs capture auditable snapshots only');
    expect(source).toContain('No recommendation engine,');
    expect(source).toContain('target-role engine, or Ads Workspace execution handoff');
    expect(source).toContain('Run optimizer now');
    expect(source).toContain('Phase 4 manual runs support one ASIN at a time.');
  });

  it('stores recommendation snapshots as explicit Phase 4 placeholders', () => {
    const source = fs.readFileSync(runtimePath, 'utf-8');

    expect(source).toContain("status: 'pending_phase5'");
    expect(source).toContain('NO_RECOMMENDATION_ENGINE_ACTIVE');
    expect(source).toContain('Recommendation snapshots remain placeholders only.');
  });
});
