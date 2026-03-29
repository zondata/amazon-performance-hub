import { beforeEach, describe, expect, it, vi } from 'vitest';

const repoState = vi.hoisted(() => ({
  getRunById: vi.fn(),
  listRuns: vi.fn(),
  listProductSnapshotsByRun: vi.fn(),
  listTargetSnapshotsByRun: vi.fn(),
  listRecommendationSnapshotsByRun: vi.fn(),
  listRoleTransitionLogsByAsin: vi.fn(),
}));

const overviewState = vi.hoisted(() => ({
  buildComparisonWindow: vi.fn(),
}));

const targetProfileState = vi.hoisted(() => ({
  loadTargetProfiles: vi.fn(),
  mapTargetSnapshotToProfileView: vi.fn(),
  mapTargetProfileRowToSnapshotView: vi.fn(),
}));

const lastDetectedChangeState = vi.hoisted(() => ({
  load: vi.fn(),
}));

const manualOverrideCurrentState = vi.hoisted(() => ({
  load: vi.fn(),
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
  buildAdsOptimizerOverviewComparisonWindow: overviewState.buildComparisonWindow,
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
  loadAdsOptimizerTargetProfiles: targetProfileState.loadTargetProfiles,
  mapTargetSnapshotToProfileView: targetProfileState.mapTargetSnapshotToProfileView,
  mapTargetProfileRowToSnapshotView: targetProfileState.mapTargetProfileRowToSnapshotView,
}));

vi.mock('../apps/web/src/lib/ads-optimizer/lastDetectedChange', () => ({
  createEmptyAdsOptimizerLastDetectedChange: vi.fn(() => ({
    detectedDate: null,
    items: [],
    overflowCount: 0,
    emptyMessage: 'No detected tracked change',
  })),
  loadAdsOptimizerLastDetectedChangesForTargets: lastDetectedChangeState.load,
}));

vi.mock('../apps/web/src/lib/ads-optimizer/manualOverrideCurrent', () => ({
  loadAdsOptimizerManualOverrideCurrentContextForTargets: manualOverrideCurrentState.load,
}));

vi.mock('../apps/web/src/lib/ads-workspace/repoChangeSets', () => ({
  listChangeSets: vi.fn(async () => []),
}));

vi.mock('../apps/web/src/lib/ads-workspace/repoChangeSetItems', () => ({
  listChangeSetItems: vi.fn(async () => []),
}));

import {
  getAdsOptimizerHeaderRunContext,
  getAdsOptimizerTargetsViewData,
} from '../apps/web/src/lib/ads-optimizer/runtime';

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

const makeProfileView = (overrides: Record<string, unknown> = {}) => ({
  targetSnapshotId: 'snap-1',
  runId: 'run-1',
  createdAt: '2026-03-10T00:00:00Z',
  asin: 'B001TEST',
  campaignId: 'cmp-1',
  campaignName: 'Core Campaign',
  adGroupId: 'ag-1',
  adGroupName: 'Exact Group',
  targetId: 'target-1',
  targetText: 'hero exact',
  matchType: 'EXACT',
  typeLabel: 'Keyword',
  raw: {
    impressions: 500,
    clicks: 20,
    spend: 120,
    orders: 4,
    sales: 300,
    cpc: 6,
    ctr: 0.04,
    cvr: 0.2,
    acos: 0.4,
    roas: 2.5,
    tosIs: null,
    stis: null,
    stir: null,
  },
  derived: {
    contributionAfterAds: 42,
    breakEvenGap: 0.02,
    maxCpcSupportGap: null,
    lossDollars: null,
    profitDollars: 42,
    clickVelocity: null,
    impressionVelocity: null,
    organicLeverageProxy: null,
    organicContextSignal: null,
  },
  nonAdditiveDiagnostics: {
    note: null,
    representativeSearchTerm: null,
    tosIs: {
      latestValue: null,
      previousValue: null,
      delta: null,
      direction: null,
      observedDays: 0,
      latestObservedDate: null,
    },
    stis: {
      latestValue: null,
      previousValue: null,
      delta: null,
      direction: null,
      observedDays: 0,
      latestObservedDate: null,
    },
    stir: {
      latestValue: null,
      previousValue: null,
      delta: null,
      direction: null,
      observedDays: 0,
      latestObservedDate: null,
    },
  },
  rankingContext: {
    note: null,
    organicObservedRanks: [],
    sponsoredObservedRanks: [],
  },
  demandProxies: {
    searchTermCount: 0,
    sameTextSearchTermCount: 0,
    totalSearchTermImpressions: 0,
    totalSearchTermClicks: 0,
    representativeSearchTerm: null,
    representativeClickShare: null,
  },
  placementContext: {
    topOfSearchModifierPct: null,
    impressions: null,
    clicks: null,
    orders: null,
    units: null,
    sales: null,
    spend: null,
    note: null,
  },
  searchTermDiagnostics: {
    representativeSearchTerm: null,
    representativeSameText: null,
    note: null,
    topTerms: [],
  },
  coverage: {
    observedStart: '2026-03-01',
    observedEnd: '2026-03-10',
    daysObserved: 10,
    statuses: {
      tosIs: 'missing',
      stis: 'missing',
      stir: 'missing',
      placementContext: 'missing',
      searchTerms: 'missing',
      breakEvenInputs: 'ready',
    },
    notes: [],
    criticalWarnings: [],
  },
  state: {
    efficiency: {
      value: 'profitable',
      label: 'Profitable',
      detail: 'Ready',
      coverageStatus: 'ready',
      reasonCodes: [],
    },
    confidence: {
      value: 'confirmed',
      label: 'Confirmed',
      detail: 'Ready',
      coverageStatus: 'ready',
      reasonCodes: [],
    },
    importance: {
      value: 'tier_1_dominant',
      label: 'Tier 1 dominant',
      detail: 'Ready',
      coverageStatus: 'ready',
      reasonCodes: [],
    },
    opportunityScore: 10,
    riskScore: 5,
    opportunityReasonCodes: [],
    riskReasonCodes: [],
    summaryReasonCodes: [],
  },
  role: {
    desiredRole: {
      value: 'Harvest',
      label: 'Harvest',
      detail: 'Ready',
      coverageStatus: 'ready',
      reasonCodes: [],
    },
    currentRole: {
      value: 'Harvest',
      label: 'Harvest',
      detail: 'Ready',
      coverageStatus: 'ready',
      reasonCodes: [],
    },
    previousRole: 'Harvest',
    transitionRule: 'hold',
    transitionReasonCodes: [],
    summaryReasonCodes: [],
    guardrails: {
      flags: {
        requiresManualApproval: false,
        autoPauseEligible: false,
        transitionLocked: false,
      },
    },
  },
  ...overrides,
});

const makeTargetProfileRow = (overrides: Record<string, unknown> = {}) => ({
  asin: 'B001TEST',
  campaignId: 'cmp-1',
  adGroupId: 'ag-1',
  targetId: 'target-1',
  sourceScope: 'asin_via_sp_advertised_product_membership',
  coverageNote: null,
  snapshotPayload: {},
  ...overrides,
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
    overviewState.buildComparisonWindow.mockReset();
    overviewState.buildComparisonWindow.mockImplementation(({ start, end }) => ({
      current: { start, end, days: 10 },
      previous: {
        start: '2026-02-19',
        end: '2026-02-28',
        days: 10,
      },
    }));
    targetProfileState.loadTargetProfiles.mockReset();
    targetProfileState.loadTargetProfiles.mockResolvedValue({
      rows: [],
      zeroTargetDiagnostics: null,
    });
    targetProfileState.mapTargetSnapshotToProfileView.mockReset();
    targetProfileState.mapTargetProfileRowToSnapshotView.mockReset();
    lastDetectedChangeState.load.mockReset();
    lastDetectedChangeState.load.mockResolvedValue(new Map());
    manualOverrideCurrentState.load.mockReset();
    manualOverrideCurrentState.load.mockResolvedValue(new Map());
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

  it('returns latest and matching run context for the shared header flow', async () => {
    const run = makeRun();
    repoState.getRunById.mockResolvedValue(run);
    repoState.listRuns.mockResolvedValue([run]);

    const result = await getAdsOptimizerHeaderRunContext({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
      runId: 'run-1',
    });

    expect(result.requestedRun?.run_id).toBe('run-1');
    expect(result.matchingWindowRun?.run_id).toBe('run-1');
    expect(result.latestCompletedRun?.run_id).toBe('run-1');
    expect(result.requestedRunError).toBeNull();
  });

  it('populates displayed previous values from the Overview-aligned previous period even without a prior completed run', async () => {
    const run = makeRun();
    repoState.listRuns.mockResolvedValue([run]);
    repoState.listTargetSnapshotsByRun.mockResolvedValue([
      {
        target_snapshot_id: 'snap-1',
        run_id: 'run-1',
        created_at: '2026-03-10T00:00:00Z',
        asin: 'B001TEST',
        campaign_id: 'cmp-1',
        ad_group_id: 'ag-1',
        target_id: 'target-1',
        coverage_note: null,
        snapshot_payload_json: {},
      },
    ]);
    targetProfileState.mapTargetSnapshotToProfileView.mockReturnValue(
      makeProfileView({
        raw: {
          ...makeProfileView().raw,
          spend: 120,
          sales: 300,
          orders: 4,
          acos: 0.4,
        },
        derived: {
          ...makeProfileView().derived,
          profitDollars: 42,
          contributionAfterAds: 42,
          breakEvenGap: 0.02,
        },
      })
    );
    targetProfileState.loadTargetProfiles.mockResolvedValue({
      rows: [makeTargetProfileRow()],
      zeroTargetDiagnostics: null,
    });
    targetProfileState.mapTargetProfileRowToSnapshotView.mockReturnValue(
      makeProfileView({
        targetSnapshotId: 'previous-period:target-1',
        runId: 'previous-period:2026-02-19:2026-02-28',
        raw: {
          ...makeProfileView().raw,
          spend: 80,
          sales: 200,
          orders: 3,
          acos: 0.5,
        },
        derived: {
          ...makeProfileView().derived,
          profitDollars: 20,
          contributionAfterAds: 20,
          breakEvenGap: 0.01,
        },
        rankingContext: {
          note: null,
          organicObservedRanks: [],
          sponsoredObservedRanks: [],
        },
      })
    );

    const result = await getAdsOptimizerTargetsViewData({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(overviewState.buildComparisonWindow).toHaveBeenCalledWith({
      start: '2026-03-01',
      end: '2026-03-10',
    });
    expect(targetProfileState.loadTargetProfiles).toHaveBeenCalledWith({
      asin: 'B001TEST',
      start: '2026-02-19',
      end: '2026-02-28',
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.previousComparable?.raw.spend).toBe(80);
    expect(result.rows[0]?.previousComparable?.raw.sales).toBe(200);
    expect(result.rows[0]?.previousComparable?.raw.orders).toBe(3);
    expect(result.rows[0]?.previousComparable?.raw.acos).toBe(0.5);
    expect(result.rows[0]?.previousComparable?.derived.profitDollars).toBe(20);
  });

  it('does not use a prior completed same-window run as the displayed previous comparison for collapsed rows', async () => {
    const run = makeRun();
    const priorCompletedSameWindowRun = {
      ...makeRun(),
      run_id: 'run-0',
      created_at: '2026-03-09T00:00:00Z',
    };
    repoState.listRuns.mockResolvedValue([run, priorCompletedSameWindowRun]);
    repoState.listTargetSnapshotsByRun.mockImplementation(async (runId: string) => {
      if (runId === 'run-1') {
        return [
          {
            target_snapshot_id: 'snap-1',
            run_id: 'run-1',
            created_at: '2026-03-10T00:00:00Z',
            asin: 'B001TEST',
            campaign_id: 'cmp-1',
            ad_group_id: 'ag-1',
            target_id: 'target-1',
            coverage_note: null,
            snapshot_payload_json: {},
          },
        ];
      }
      return [
        {
          target_snapshot_id: 'snap-0',
          run_id: 'run-0',
          created_at: '2026-03-09T00:00:00Z',
          asin: 'B001TEST',
          campaign_id: 'cmp-1',
          ad_group_id: 'ag-1',
          target_id: 'target-1',
          coverage_note: null,
          snapshot_payload_json: {},
        },
      ];
    });
    targetProfileState.mapTargetSnapshotToProfileView
      .mockReturnValueOnce(
        makeProfileView({
          targetSnapshotId: 'snap-1',
          runId: 'run-1',
          raw: {
            ...makeProfileView().raw,
            spend: 120,
          },
        })
      )
      .mockReturnValueOnce(
        makeProfileView({
          targetSnapshotId: 'snap-0',
          runId: 'run-0',
          raw: {
            ...makeProfileView().raw,
            spend: 999,
          },
        })
      );
    targetProfileState.loadTargetProfiles.mockResolvedValue({
      rows: [makeTargetProfileRow()],
      zeroTargetDiagnostics: null,
    });
    targetProfileState.mapTargetProfileRowToSnapshotView.mockReturnValue(
      makeProfileView({
        targetSnapshotId: 'previous-period:target-1',
        runId: 'previous-period:2026-02-19:2026-02-28',
        raw: {
          ...makeProfileView().raw,
          spend: 80,
        },
      })
    );

    const result = await getAdsOptimizerTargetsViewData({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(repoState.listTargetSnapshotsByRun).toHaveBeenCalledWith('run-0');
    expect(result.rows[0]?.previousComparable?.raw.spend).toBe(80);
    expect(result.rows[0]?.previousComparable?.raw.spend).not.toBe(999);
  });

  it('attaches lastDetectedChange to current rows while leaving previousComparable behavior unchanged', async () => {
    const run = makeRun();
    repoState.listRuns.mockResolvedValue([run]);
    repoState.listTargetSnapshotsByRun.mockResolvedValue([
      {
        target_snapshot_id: 'snap-1',
        run_id: 'run-1',
        created_at: '2026-03-10T00:00:00Z',
        asin: 'B001TEST',
        campaign_id: 'cmp-1',
        ad_group_id: 'ag-1',
        target_id: 'target-1',
        coverage_note: null,
        snapshot_payload_json: {},
      },
      {
        target_snapshot_id: 'snap-2',
        run_id: 'run-1',
        created_at: '2026-03-10T00:00:00Z',
        asin: 'B001TEST',
        campaign_id: 'cmp-1',
        ad_group_id: 'ag-2',
        target_id: 'target-2',
        coverage_note: null,
        snapshot_payload_json: {},
      },
    ]);
    targetProfileState.mapTargetSnapshotToProfileView
      .mockReturnValueOnce(
        makeProfileView({
          targetSnapshotId: 'snap-1',
          targetId: 'target-1',
          adGroupId: 'ag-1',
          adGroupName: 'Exact Group',
        })
      )
      .mockReturnValueOnce(
        makeProfileView({
          targetSnapshotId: 'snap-2',
          targetId: 'target-2',
          adGroupId: 'ag-2',
          adGroupName: 'Phrase Group',
          targetText: 'hero phrase',
        })
      );
    targetProfileState.loadTargetProfiles.mockResolvedValue({
      rows: [makeTargetProfileRow({ targetId: 'target-1' }), makeTargetProfileRow({ targetId: 'target-2' })],
      zeroTargetDiagnostics: null,
    });
    targetProfileState.mapTargetProfileRowToSnapshotView.mockReturnValue(
      makeProfileView({
        targetSnapshotId: 'previous-period:target-1',
        runId: 'previous-period:2026-02-19:2026-02-28',
        raw: {
          ...makeProfileView().raw,
          spend: 80,
        },
      })
    );
    lastDetectedChangeState.load.mockResolvedValue(
      new Map([
        [
          'snap-1',
          {
            detectedDate: '2026-03-21',
            items: [
              {
                key: 'campaign_bidding_strategy:cmp-1:2026-03-21',
                kind: 'campaign_bidding_strategy',
                label: 'Strategy',
                previousDisplay: 'fixed bids',
                currentDisplay: 'dynamic down only',
                deltaPercentLabel: null,
                deltaDirection: null,
              },
            ],
            overflowCount: 0,
            emptyMessage: null,
          },
        ],
        [
          'snap-2',
          {
            detectedDate: '2026-03-21',
            items: [
              {
                key: 'campaign_bidding_strategy:cmp-1:2026-03-21',
                kind: 'campaign_bidding_strategy',
                label: 'Strategy',
                previousDisplay: 'fixed bids',
                currentDisplay: 'dynamic down only',
                deltaPercentLabel: null,
                deltaDirection: null,
              },
            ],
            overflowCount: 0,
            emptyMessage: null,
          },
        ],
      ])
    );

    const result = await getAdsOptimizerTargetsViewData({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(lastDetectedChangeState.load).toHaveBeenCalled();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.lastDetectedChange?.detectedDate).toBe('2026-03-21');
    expect(result.rows[1]?.lastDetectedChange?.items[0]?.label).toBe('Strategy');
    expect(result.rows[0]?.previousComparable?.raw.spend).toBe(80);
    expect(result.rows[1]?.lastDetectedChange).toEqual(result.rows[0]?.lastDetectedChange);
  });
});
