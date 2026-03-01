import { describe, expect, it } from 'vitest';

import {
  extractAdsOptimizationContractV1FromScope,
  normalizeScopeWithAdsOptimizationContractV1,
  parseAdsOptimizationContractV1,
  snapshotAdsOptimizationContractV1,
} from '../apps/web/src/lib/logbook/contracts/adsOptimizationContractV1';

describe('ads optimization contract v1 helpers', () => {
  it('parses contract fields and defaults workflow_mode when requested', () => {
    const parsed = parseAdsOptimizationContractV1(
      {
        baseline_ref: {
          data_available_through: '2026-02-28',
          export_id: 'exp-1',
        },
        forecast: {
          window_days: '14',
          confidence: 0.8,
          directional_kpis: [
            { kpi: 'spend', direction: 'up' },
            { kpi: 'acos', direction: 'down' },
          ],
          assumptions: ['stable conversion', 'stable seasonality'],
        },
        ai_run_meta: {
          model: 'gpt-5',
        },
      },
      { defaultWorkflowMode: true }
    );

    expect(parsed).toBeTruthy();
    expect(parsed?.baseline_ref?.data_available_through).toBe('2026-02-28');
    expect(parsed?.forecast?.window_days).toBe(14);
    expect(parsed?.forecast?.directional_kpis).toHaveLength(2);
    expect(parsed?.ai_run_meta).toMatchObject({
      workflow_mode: 'manual',
      model: 'gpt-5',
    });
  });

  it('normalizes scope and keeps contract nested at scope.contract.ads_optimization_v1', () => {
    const normalized = normalizeScopeWithAdsOptimizationContractV1(
      {
        status: 'planned',
        contract: {
          ads_optimization_v1: {
            baseline_ref: { data_available_through: '2026-02-27' },
            forecast: {
              directional_kpis: [{ kpi: 'orders', direction: 'up' }],
            },
          },
        },
      },
      { defaultWorkflowMode: true }
    );

    const extracted = extractAdsOptimizationContractV1FromScope(normalized, {
      defaultWorkflowMode: true,
    });
    expect(extracted?.baseline_ref?.data_available_through).toBe('2026-02-27');
    expect(extracted?.forecast?.directional_kpis?.[0]).toMatchObject({
      kpi: 'orders',
      direction: 'up',
    });
    expect(extracted?.ai_run_meta?.workflow_mode).toBe('manual');
  });

  it('creates evaluation snapshots for baseline_ref + forecast + ai_run_meta', () => {
    const snapshot = snapshotAdsOptimizationContractV1({
      baseline_ref: { data_available_through: '2026-02-25' },
      forecast: {
        window_days: 7,
        directional_kpis: [{ kpi: 'sales', direction: 'up' }],
      },
      ai_run_meta: {
        workflow_mode: 'api',
        model: 'gpt-5-mini',
      },
    });

    expect(snapshot).toEqual({
      baseline_ref: { data_available_through: '2026-02-25' },
      forecast: {
        window_days: 7,
        directional_kpis: [{ kpi: 'sales', direction: 'up' }],
      },
      ai_run_meta: {
        workflow_mode: 'api',
        model: 'gpt-5-mini',
      },
    });
  });
});
