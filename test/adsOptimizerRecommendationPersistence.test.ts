import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
  insertCalled: false,
};

const resetState = () => {
  state.insertCalled = false;
};

const createQuery = (table: string) => {
  let pendingInsert: Record<string, unknown>[] | null = null;

  const query: any = {
    insert: (value: Record<string, unknown>[]) => {
      pendingInsert = value;
      state.insertCalled = true;
      return query;
    },
    select: async () => {
      if (table !== 'ads_optimizer_recommendation_snapshot' || !pendingInsert) {
        throw new Error(`Unsupported select() usage for table ${table}`);
      }
      return {
        data: pendingInsert.map((row, index) => ({
          recommendation_snapshot_id: `rec-${index + 1}`,
          run_id: row.run_id,
          target_snapshot_id: row.target_snapshot_id,
          account_id: row.account_id,
          marketplace: row.marketplace,
          asin: row.asin,
          status: row.status,
          action_type: row.action_type,
          reason_codes_json: row.reason_codes_json,
          snapshot_payload_json: row.snapshot_payload_json,
          created_at: '2026-03-11T00:00:00Z',
        })),
        error: null,
      };
    },
  };

  return query;
};

vi.mock('../apps/web/src/lib/env', () => ({
  env: {
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-role-key',
    accountId: 'acct',
    marketplace: 'US',
  },
}));

vi.mock('../apps/web/src/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: (table: string) => createQuery(table),
  },
}));

import { insertAdsOptimizerRecommendationSnapshots } from '../apps/web/src/lib/ads-optimizer/repoRuntime';

describe('ads optimizer phase 8 recommendation persistence guard', () => {
  beforeEach(() => {
    resetState();
  });

  it('rejects legacy placeholder recommendation rows before insert', async () => {
    await expect(
      insertAdsOptimizerRecommendationSnapshots([
        {
          runId: 'run-1',
          targetSnapshotId: 'target-snapshot-1',
          asin: 'B001TEST',
          status: 'pending_phase5',
          actionType: null,
          reasonCodes: ['PHASE4_BACKBONE_ONLY', 'NO_RECOMMENDATION_ENGINE_ACTIVE'],
          snapshotPayload: {
            phase: 4,
            execution_boundary: 'snapshot_only',
          },
        },
      ])
    ).rejects.toThrow('pending_phase5');

    expect(state.insertCalled).toBe(false);
  });

  it('persists only read-only Phase 8 recommendation rows', async () => {
    const rows = await insertAdsOptimizerRecommendationSnapshots([
      {
        runId: 'run-1',
        targetSnapshotId: 'target-snapshot-1',
        asin: 'B001TEST',
        status: 'generated',
        actionType: 'update_target_bid',
        reasonCodes: ['SPEND_DIRECTION_INCREASE_SCALE_HEADROOM', 'ACTION_UPDATE_TARGET_BID_INCREASE'],
        snapshotPayload: {
          phase: 8,
          execution_boundary: 'read_only_recommendation_only',
          workspace_handoff: 'not_started',
          writes_execution_tables: false,
        },
      },
    ]);

    expect(state.insertCalled).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('generated');
    expect(rows[0]?.action_type).toBe('update_target_bid');
    expect(rows[0]?.snapshot_payload_json.execution_boundary).toBe(
      'read_only_recommendation_only'
    );
    expect(rows[0]?.snapshot_payload_json.workspace_handoff).toBe('not_started');
    expect(rows[0]?.snapshot_payload_json.writes_execution_tables).toBe(false);
  });
});
