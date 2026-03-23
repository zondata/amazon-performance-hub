import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../apps/web/src/app/ads/performance/actions', () => ({
  deleteQueueItemAction: async () => {},
  generateQueueChangeSetAction: async () => {},
  saveQueueChangeSetMetaAction: async () => {},
  saveQueueItemAction: async () => {},
  updateQueueChangeSetStatusAction: async () => {},
}));

import AdsWorkspaceQueueReview from '../apps/web/src/components/ads/AdsWorkspaceQueueReview';

const requireFromWeb = createRequire(path.join(process.cwd(), 'apps/web/package.json'));
const React = requireFromWeb('react') as {
  createElement: (type: unknown, props?: Record<string, unknown> | null) => unknown;
};
const { renderToStaticMarkup } = requireFromWeb('react-dom/server') as {
  renderToStaticMarkup: (element: unknown) => string;
};

const makeChangeSet = (generatedArtifactJson: Record<string, unknown> | null) => ({
  id: 'change-set-1',
  account_id: 'acct',
  marketplace: 'US',
  experiment_id: null,
  name: 'Queue review set',
  status: 'review_ready' as const,
  objective: null,
  hypothesis: null,
  forecast_window_days: null,
  review_after_days: null,
  notes: null,
  filters_json: {
    source: 'ads_optimizer_phase10_handoff',
    channel: 'sp',
    level: 'targets',
    asin: 'B001TEST',
    start: '2026-03-01',
    end: '2026-03-10',
  },
  generated_run_id: null,
  generated_artifact_json: generatedArtifactJson,
  created_at: '2026-03-12T10:00:00Z',
  updated_at: '2026-03-12T10:00:00Z',
});

const renderQueueReview = (generatedArtifactJson: Record<string, unknown> | null) =>
  renderToStaticMarkup(
    React.createElement(AdsWorkspaceQueueReview, {
      changeSetLinks: [
        {
          id: 'change-set-1',
          name: 'Queue review set',
          status: 'review_ready',
          updatedAt: '2026-03-12T10:00:00Z',
          href: '/ads/performance?panel=queue&change_set=change-set-1',
        },
      ],
      selectedChangeSet: makeChangeSet(generatedArtifactJson),
      selectedItems: [],
      experimentOptions: [],
      templateStatusLine: 'Configured',
      missingOutRoot: false,
      spawnDisabled: false,
      templateMissing: false,
      returnTo: '/ads/performance?panel=queue',
      notice: null,
      error: null,
    })
  );

describe('AdsWorkspaceQueueReview generated artifact rendering', () => {
  it('does not render the generated artifact box for legacy handoff metadata', () => {
    const markup = renderQueueReview({
      source: 'ads_optimizer_phase10_handoff',
      optimizer_run_id: 'opt-run-1',
      selected_row_count: 2,
      staged_action_count: 3,
      skipped_unsupported_action_types: ['change_review_cadence'],
    });

    expect(markup).not.toContain('Generated artifact');
    expect(markup).not.toContain('Download review.xlsx');
    expect(markup).not.toContain('Download upload_strict.xlsx');
  });

  it('renders only the review download button when only review_path exists', () => {
    const markup = renderQueueReview({
      generator: 'bulkgen:sp:update',
      generated_at: '2026-03-12T10:00:00Z',
      action_count: 3,
      review_path: 'bulk-run-1/review.xlsx',
      upload_strict_path: null,
      log_created: 2,
      log_skipped: 1,
    });

    expect(markup).toContain('Generated artifact');
    expect(markup).toContain('Download review.xlsx');
    expect(markup).not.toContain('Download upload_strict.xlsx');
  });

  it('renders both download buttons when both artifact paths exist', () => {
    const markup = renderQueueReview({
      generator: 'bulkgen:sp:update',
      generated_at: '2026-03-12T10:00:00Z',
      action_count: 3,
      review_path: 'bulk-run-1/review.xlsx',
      upload_strict_path: 'bulk-run-1/upload_strict.xlsx',
      log_created: 2,
      log_skipped: 1,
    });

    expect(markup).toContain('Generated artifact');
    expect(markup).toContain('Download review.xlsx');
    expect(markup).toContain('Download upload_strict.xlsx');
  });
});
