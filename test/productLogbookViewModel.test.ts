import { describe, expect, it } from 'vitest';

import {
  ProductLogbookChangeRow,
  ProductLogbookEntityRow,
  ProductLogbookEvaluationRow,
  ProductLogbookExperimentLinkRow,
  ProductLogbookExperimentRow,
  buildProductLogbookViewModel,
} from '../apps/web/src/lib/products/buildProductLogbookViewModel';

describe('product logbook view model', () => {
  it('sorts experiments newest first and changes by occurred_at desc', () => {
    const experiments: ProductLogbookExperimentRow[] = [
      {
        experiment_id: 'e-old',
        name: 'Old experiment',
        objective: 'Old objective',
        hypothesis: null,
        evaluation_lag_days: null,
        evaluation_window_days: null,
        primary_metrics: null,
        guardrails: null,
        scope: { product_id: 'B0TEST1234', status: 'active', start_date: '2026-01-05', end_date: '2026-01-12' },
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        experiment_id: 'e-new',
        name: 'New experiment',
        objective: 'New objective',
        hypothesis: null,
        evaluation_lag_days: null,
        evaluation_window_days: null,
        primary_metrics: null,
        guardrails: null,
        scope: { product_id: 'B0TEST1234', status: 'planned', start_date: '2026-02-10', end_date: '2026-02-20' },
        created_at: '2026-02-01T00:00:00Z',
      },
    ];

    const changes: ProductLogbookChangeRow[] = [
      {
        change_id: 'c1',
        occurred_at: '2026-01-08T12:00:00Z',
        channel: 'sp',
        change_type: 'budget_update',
        summary: 'Budget +10%',
        why: null,
        source: 'manual',
        before_json: null,
        after_json: null,
        created_at: '2026-01-08T12:00:00Z',
      },
      {
        change_id: 'c2',
        occurred_at: '2026-01-09T12:00:00Z',
        channel: 'sp',
        change_type: 'bid_update',
        summary: 'Bid +5%',
        why: null,
        source: 'manual',
        before_json: null,
        after_json: null,
        created_at: '2026-01-09T12:00:00Z',
      },
      {
        change_id: 'c3',
        occurred_at: '2026-02-15T12:00:00Z',
        channel: 'sb',
        change_type: 'keyword_pause',
        summary: 'Paused broad',
        why: null,
        source: 'manual',
        before_json: null,
        after_json: null,
        created_at: '2026-02-15T12:00:00Z',
      },
      {
        change_id: 'c4',
        occurred_at: '2026-02-16T12:00:00Z',
        channel: 'sd',
        change_type: 'target_add',
        summary: 'Added retargeting target',
        why: null,
        source: 'manual',
        before_json: null,
        after_json: null,
        created_at: '2026-02-16T12:00:00Z',
      },
    ];

    const entities: ProductLogbookEntityRow[] = [
      {
        change_entity_id: 'ce1',
        change_id: 'c1',
        entity_type: 'product',
        product_id: 'B0TEST1234',
        campaign_id: null,
        ad_group_id: null,
        target_id: null,
        keyword_id: null,
        note: null,
        extra: null,
        created_at: '2026-01-08T12:00:01Z',
      },
      {
        change_entity_id: 'ce2',
        change_id: 'c2',
        entity_type: 'campaign',
        product_id: 'B0TEST1234',
        campaign_id: 'cmp-2',
        ad_group_id: null,
        target_id: null,
        keyword_id: null,
        note: null,
        extra: null,
        created_at: '2026-01-09T12:00:01Z',
      },
      {
        change_entity_id: 'ce3',
        change_id: 'c3',
        entity_type: 'campaign',
        product_id: 'B0TEST1234',
        campaign_id: 'cmp-3',
        ad_group_id: null,
        target_id: null,
        keyword_id: null,
        note: null,
        extra: null,
        created_at: '2026-02-15T12:00:01Z',
      },
      {
        change_entity_id: 'ce4',
        change_id: 'c4',
        entity_type: 'product',
        product_id: 'B0TEST1234',
        campaign_id: null,
        ad_group_id: null,
        target_id: null,
        keyword_id: null,
        note: null,
        extra: null,
        created_at: '2026-02-16T12:00:01Z',
      },
    ];

    const experimentLinks: ProductLogbookExperimentLinkRow[] = [
      {
        experiment_change_id: 'l1',
        experiment_id: 'e-old',
        change_id: 'c1',
        created_at: '2026-01-08T13:00:00Z',
      },
      {
        experiment_change_id: 'l2',
        experiment_id: 'e-old',
        change_id: 'c2',
        created_at: '2026-01-09T13:00:00Z',
      },
      {
        experiment_change_id: 'l3',
        experiment_id: 'e-new',
        change_id: 'c3',
        created_at: '2026-02-15T13:00:00Z',
      },
    ];

    const evaluations: ProductLogbookEvaluationRow[] = [
      {
        evaluation_id: 'ev1',
        experiment_id: 'e-new',
        evaluated_at: '2026-02-21T00:00:00Z',
        window_start: '2026-02-10',
        window_end: '2026-02-20',
        metrics_json: { outcome: { score: 0.8 } },
        notes: 'Good result',
        created_at: '2026-02-21T00:00:00Z',
      },
    ];

    const result = buildProductLogbookViewModel({
      changes,
      entities,
      experimentLinks,
      experiments,
      evaluations,
    });

    expect(result.experiments.map((item) => item.experiment.experiment_id)).toEqual([
      'e-new',
      'e-old',
    ]);
    expect(result.experiments[1].changes.map((item) => item.change.change_id)).toEqual([
      'c2',
      'c1',
    ]);
    expect(result.experiments[0].outcome_score).toBe(0.8);
  });

  it('computes unassigned changes as product changes without any experiment link', () => {
    const changes: ProductLogbookChangeRow[] = [
      {
        change_id: 'c1',
        occurred_at: '2026-02-01T00:00:00Z',
        channel: 'sp',
        change_type: 'budget_update',
        summary: 'Linked',
        why: null,
        source: 'manual',
        before_json: null,
        after_json: null,
        created_at: '2026-02-01T00:00:00Z',
      },
      {
        change_id: 'c2',
        occurred_at: '2026-02-02T00:00:00Z',
        channel: 'sp',
        change_type: 'bid_update',
        summary: 'Also linked (to out-of-scope experiment)',
        why: null,
        source: 'manual',
        before_json: null,
        after_json: null,
        created_at: '2026-02-02T00:00:00Z',
      },
      {
        change_id: 'c3',
        occurred_at: '2026-02-03T00:00:00Z',
        channel: 'sp',
        change_type: 'target_pause',
        summary: 'Unassigned',
        why: null,
        source: 'manual',
        before_json: null,
        after_json: null,
        created_at: '2026-02-03T00:00:00Z',
      },
    ];

    const entities: ProductLogbookEntityRow[] = [];

    const experiments: ProductLogbookExperimentRow[] = [
      {
        experiment_id: 'e1',
        name: 'Scoped experiment',
        objective: 'Obj',
        hypothesis: null,
        evaluation_lag_days: null,
        evaluation_window_days: null,
        primary_metrics: null,
        guardrails: null,
        scope: { status: 'active', start_date: '2026-02-01', end_date: '2026-02-07' },
        created_at: '2026-02-01T00:00:00Z',
      },
    ];

    const experimentLinks: ProductLogbookExperimentLinkRow[] = [
      {
        experiment_change_id: 'l1',
        experiment_id: 'e1',
        change_id: 'c1',
        created_at: '2026-02-01T01:00:00Z',
      },
      {
        experiment_change_id: 'l2',
        experiment_id: 'e-outside',
        change_id: 'c2',
        created_at: '2026-02-02T01:00:00Z',
      },
    ];

    const result = buildProductLogbookViewModel({
      changes,
      entities,
      experimentLinks,
      experiments,
      evaluations: [],
    });

    expect(result.unassigned_changes.map((item) => item.change.change_id)).toEqual(['c3']);
  });
});
