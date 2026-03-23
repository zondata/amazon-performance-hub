import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const redirect = vi.fn((url: string) => {
    const error = new Error('NEXT_REDIRECT');
    (error as Error & { digest?: string; url?: string }).digest = 'NEXT_REDIRECT';
    (error as Error & { digest?: string; url?: string }).url = url;
    throw error;
  });

  return {
    redirect,
    revalidatePath: vi.fn(),
    downloadTemplateToLocalPath: vi.fn(),
    runSpUpdateGenerator: vi.fn(),
    getChangeSet: vi.fn(),
    updateChangeSet: vi.fn(),
    listChangeSetItems: vi.fn(),
    mapChangeSetItemsToSpUpdateActions: vi.fn(),
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('../apps/web/src/lib/env', () => ({
  env: {
    accountId: 'acct',
    marketplace: 'US',
    bulkgenOutRoot: '/tmp/out',
    enableBulkgenSpawn: true,
  },
}));

vi.mock('../apps/web/src/lib/bulksheets/runGenerators', () => ({
  runSpUpdateGenerator: mocks.runSpUpdateGenerator,
}));

vi.mock('../apps/web/src/lib/bulksheets/templateStore', () => ({
  downloadTemplateToLocalPath: mocks.downloadTemplateToLocalPath,
}));

vi.mock('../apps/web/src/lib/ads-workspace/repoChangeSetItems', () => ({
  createChangeSetItems: vi.fn(),
  deleteChangeSetItem: vi.fn(),
  getChangeSetItem: vi.fn(),
  listChangeSetItems: mocks.listChangeSetItems,
  updateChangeSetItem: vi.fn(),
}));

vi.mock('../apps/web/src/lib/ads-workspace/repoChangeSets', () => ({
  createChangeSet: vi.fn(),
  getChangeSet: mocks.getChangeSet,
  updateChangeSet: mocks.updateChangeSet,
}));

vi.mock('../apps/web/src/lib/ads-workspace/repoObjectivePresets', () => ({
  createObjectivePreset: vi.fn(),
  getObjectivePreset: vi.fn(),
}));

vi.mock('../apps/web/src/lib/ads-workspace/spChangeComposer', () => ({
  buildForecastJson: vi.fn(),
  buildSpDraftMutationPlan: vi.fn(),
}));

vi.mock('../apps/web/src/lib/ads-workspace/spDraftReview', () => ({
  buildSpDraftItemPatch: vi.fn(),
  mapChangeSetItemsToSpUpdateActions: mocks.mapChangeSetItemsToSpUpdateActions,
}));

vi.mock('../apps/web/src/lib/uiSettings/savePageSettings', () => ({
  savePageSettings: vi.fn(),
}));

import { generateQueueChangeSetAction } from '../apps/web/src/app/ads/performance/actions';

const makeChangeSet = (overrides: Record<string, unknown> = {}) => ({
  id: 'change-set-1',
  account_id: 'acct',
  marketplace: 'US',
  experiment_id: null,
  name: 'Queue review set',
  status: 'review_ready',
  objective: null,
  hypothesis: null,
  forecast_window_days: null,
  review_after_days: null,
  notes: 'Queue notes',
  filters_json: {
    source: 'ads_optimizer_phase10_handoff',
    channel: 'sp',
    level: 'targets',
    asin: 'B001TEST',
    start: '2026-03-01',
    end: '2026-03-10',
  },
  generated_run_id: null,
  generated_artifact_json: null,
  created_at: '2026-03-12T10:00:00Z',
  updated_at: '2026-03-12T10:00:00Z',
  ...overrides,
});

const makeFormData = () => {
  const formData = new FormData();
  formData.set('return_to', '/ads/performance?panel=queue');
  formData.set('change_set_id', 'change-set-1');
  return formData;
};

const runActionAndReadRedirect = async (formData: FormData) => {
  try {
    await generateQueueChangeSetAction(formData);
    throw new Error('Expected redirect.');
  } catch (error) {
    const redirectError = error as Error & { digest?: string; url?: string };
    const digest = redirectError.digest;
    if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT;')) {
      throw error;
    }
    const url = redirectError.url ?? digest.split(';').slice(2, -2).join(';');
    return new URL(url, 'http://localhost');
  }
};

describe('generateQueueChangeSetAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.downloadTemplateToLocalPath.mockResolvedValue('/tmp/template.xlsx');
    mocks.listChangeSetItems.mockResolvedValue([{ id: 'item-1' }]);
    mocks.mapChangeSetItemsToSpUpdateActions.mockReturnValue([{ type: 'update_target_bid' }]);
    mocks.runSpUpdateGenerator.mockResolvedValue({
      run_id: 'bulk-run-1',
      out_dir: '/tmp/out/bulk-run-1',
      upload_strict_path: 'bulk-run-1/upload_strict.xlsx',
      review_path: 'bulk-run-1/review.xlsx',
      log_created: 2,
      log_skipped: 1,
      spawn_cwd: '/tmp/out',
    });
    mocks.updateChangeSet.mockResolvedValue({
      id: 'change-set-1',
    });
  });

  it('allows generation for legacy handoff metadata and overwrites it with a real generated artifact', async () => {
    mocks.getChangeSet.mockResolvedValue(
      makeChangeSet({
        generated_artifact_json: {
          source: 'ads_optimizer_phase10_handoff',
          optimizer_run_id: 'opt-run-1',
          selected_row_count: 2,
          staged_action_count: 3,
          deduped_action_count: 3,
          skipped_unsupported_action_types: ['change_review_cadence'],
        },
      })
    );

    await runActionAndReadRedirect(makeFormData());

    expect(mocks.runSpUpdateGenerator).toHaveBeenCalledTimes(1);
    expect(mocks.updateChangeSet).toHaveBeenCalledWith(
      'change-set-1',
      expect.objectContaining({
        status: 'generated',
        generated_run_id: 'bulk-run-1',
        generated_artifact_json: expect.objectContaining({
          generator: 'bulkgen:sp:update',
          generated_at: expect.any(String),
          action_count: 1,
          out_dir: '/tmp/out/bulk-run-1',
          upload_strict_path: 'bulk-run-1/upload_strict.xlsx',
          review_path: 'bulk-run-1/review.xlsx',
          log_created: 2,
          log_skipped: 1,
          spawn_cwd: '/tmp/out',
        }),
      })
    );
  });

  it.each([
    [
      'generated_run_id is already present',
      {
        generated_run_id: 'bulk-run-1',
        generated_artifact_json: null,
      },
    ],
    [
      'a real generated artifact is already present',
      {
        generated_run_id: null,
        generated_artifact_json: {
          generator: 'bulkgen:sp:update',
          generated_at: '2026-03-12T10:30:00Z',
          review_path: 'bulk-run-1/review.xlsx',
        },
      },
    ],
  ])('blocks duplicate generation when %s', async (_label, overrides) => {
    mocks.getChangeSet.mockResolvedValue(makeChangeSet(overrides));

    const url = await runActionAndReadRedirect(makeFormData());

    expect(mocks.listChangeSetItems).not.toHaveBeenCalled();
    expect(mocks.runSpUpdateGenerator).not.toHaveBeenCalled();
    expect(mocks.updateChangeSet).not.toHaveBeenCalled();
    expect(url.searchParams.get('queue_notice')).toBeNull();
    expect(url.searchParams.get('queue_error')).toBe(
      'This change set has already been generated.'
    );
  });
});
