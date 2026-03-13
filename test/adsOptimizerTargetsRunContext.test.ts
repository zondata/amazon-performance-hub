import { beforeEach, describe, expect, it, vi } from 'vitest';

const repoState = vi.hoisted(() => ({
  getRunById: vi.fn(),
  listRuns: vi.fn(),
  listProductSnapshotsByRun: vi.fn(),
  listTargetSnapshotsByRun: vi.fn(),
  listRecommendationSnapshotsByRun: vi.fn(),
  listRoleTransitionLogsByAsin: vi.fn(),
}));

vi.mock('../apps/web/src/lib/env', () => ({
  env: {
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-role-key',
    accountId: 'acct',
    marketplace: 'US',
  },
}));

vi.mock('../apps/web/src/lib/ads-optimizer/repoRuntime', () => ({
  createAdsOptimizerRun: vi.fn(),
  findOptimizerProductByAsin: vi.fn(),
  getAdsOptimizerRunById: repoState.getRunById,
  getAdsOptimizerRuntimeContext: vi.fn(),
  resolveAdsOptimizerRuntimeContextForAsin: vi.fn(),
  insertAdsOptimizerProductSnapshots: vi.fn(),
  insertAdsOptimizerRecommendationSnapshots: vi.fn(),
  insertAdsOptimizerRoleTransitionLogs: vi.fn(),
  insertAdsOptimizerTargetSnapshots: vi.fn(),
  listAdsOptimizerProductSnapshotsByRun: repoState.listProductSnapshotsByRun,
  listAdsOptimizerRecommendationSnapshotsByRun: repoState.listRecommendationSnapshotsByRun,
  listAdsOptimizerRoleTransitionLogsByAsin: repoState.listRoleTransitionLogsByAsin,
  listAdsOptimizerRuns: repoState.listRuns,
  listAdsOptimizerTargetSnapshotsByRun: repoState.listTargetSnapshotsByRun,
  updateAdsOptimizerRun: vi.fn(),
}));

vi.mock('../apps/web/src/lib/ads-optimizer/repoConfig', () => ({
  getProductOptimizerSettingsByProductId: vi.fn(),
  getRulePackVersion: vi.fn(async () => null),
}));

vi.mock('../apps/web/src/lib/ads-optimizer/comparison', () => ({
  buildAdsOptimizerRunComparison: vi.fn(),
}));

vi.mock('../apps/web/src/lib/ads-optimizer/overview', () => ({
  getAdsOptimizerOverviewData: vi.fn(),
}));

vi.mock('../apps/web/src/lib/ads-optimizer/role', () => ({
  buildAdsOptimizerRoleTransitionReason: vi.fn(),
  enrichAdsOptimizerTargetSnapshotRolePayload: vi.fn(),
  readAdsOptimizerTargetRunRole: vi.fn(),
}));

vi.mock('../apps/web/src/lib/ads-optimizer/recommendation', () => ({
  buildAdsOptimizerRecommendationSnapshots: vi.fn(),
  readAdsOptimizerRecommendationSnapshotView: vi.fn(),
}));

vi.mock('../apps/web/src/lib/ads-optimizer/state', () => ({
  enrichAdsOptimizerProductSnapshotPayload: vi.fn(),
  enrichAdsOptimizerTargetSnapshotPayload: vi.fn(),
  readAdsOptimizerProductRunState: vi.fn(() => null),
}));

vi.mock('../apps/web/src/lib/ads-optimizer/targetProfile', () => ({
  loadAdsOptimizerTargetProfiles: vi.fn(),
  mapTargetSnapshotToProfileView: vi.fn(),
}));

vi.mock('../apps/web/src/lib/ads-workspace/repoChangeSets', () => ({
  listChangeSets: vi.fn(async () => []),
}));

vi.mock('../apps/web/src/lib/ads-workspace/repoChangeSetItems', () => ({
  listChangeSetItems: vi.fn(async () => []),
}));

import { getAdsOptimizerTargetsViewData } from '../apps/web/src/lib/ads-optimizer/runtime';

const makeRun = () => ({
  run_id: 'run-1',
  account_id: 'acct',
  marketplace: 'US',
  channel: 'sp' as const,
  scope_type: 'product' as const,
  selected_asin: 'B001TEST',
  run_kind: 'manual' as const,
  date_start: '2026-03-01',
  date_end: '2026-03-10',
  rule_pack_version_id: 'version-1',
  rule_pack_version_label: 'sp_v1_seed',
  status: 'completed' as const,
  input_summary_json: {},
  diagnostics_json: null,
  product_snapshot_count: 1,
  target_snapshot_count: 0,
  recommendation_snapshot_count: 0,
  role_transition_count: 0,
  created_at: '2026-03-10T00:00:00Z',
  started_at: '2026-03-10T00:00:00Z',
  completed_at: '2026-03-10T00:05:00Z',
});

describe('ads optimizer targets run context', () => {
  beforeEach(() => {
    repoState.getRunById.mockReset();
    repoState.listRuns.mockReset();
    repoState.listProductSnapshotsByRun.mockReset();
    repoState.listTargetSnapshotsByRun.mockReset();
    repoState.listRecommendationSnapshotsByRun.mockReset();
    repoState.listRoleTransitionLogsByAsin.mockReset();

    repoState.listProductSnapshotsByRun.mockResolvedValue([]);
    repoState.listTargetSnapshotsByRun.mockResolvedValue([]);
    repoState.listRecommendationSnapshotsByRun.mockResolvedValue([]);
    repoState.listRoleTransitionLogsByAsin.mockResolvedValue([]);
  });

  it('prefers runId over incoming ASIN/date values and loads that persisted run', async () => {
    repoState.getRunById.mockResolvedValue(makeRun());
    repoState.listRuns.mockImplementation(async ({ asin }: { asin?: string }) => {
      if (asin === 'B001TEST') return [makeRun()];
      return [];
    });

    const result = await getAdsOptimizerTargetsViewData({
      asin: 'WRONGASIN',
      start: '2026-02-01',
      end: '2026-02-02',
      runId: 'run-1',
    });

    expect(result.run?.run_id).toBe('run-1');
    expect(result.run?.selected_asin).toBe('B001TEST');
    expect(result.resolvedContextSource).toBe('run_id');
    expect(result.runLookupError).toBeNull();
    expect(result.rows).toEqual([]);
    expect(repoState.listTargetSnapshotsByRun).toHaveBeenCalledWith('run-1');
  });

  it('fails gracefully when the requested runId is invalid', async () => {
    repoState.getRunById.mockResolvedValue(null);
    repoState.listRuns.mockResolvedValue([]);

    const result = await getAdsOptimizerTargetsViewData({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
      runId: 'missing-run',
    });

    expect(result.run).toBeNull();
    expect(result.rows).toEqual([]);
    expect(result.resolvedContextSource).toBeNull();
    expect(result.runLookupError).toContain('Persisted run missing-run was not found');
  });
});
