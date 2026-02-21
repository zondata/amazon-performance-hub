import { describe, expect, it } from 'vitest';

import {
  ProductChangesExplorerChangeRow,
  ProductChangesExplorerEntityRow,
  ProductChangesExplorerExperimentRow,
  ProductChangesExplorerLinkRow,
  ProductChangesExplorerValidationRow,
  buildProductChangesExplorerViewModel,
} from '../apps/web/src/lib/products/buildProductChangesExplorerViewModel';

describe('product changes explorer view model', () => {
  const changes: ProductChangesExplorerChangeRow[] = [
    {
      change_id: 'c1',
      occurred_at: '2026-02-20T12:00:00Z',
      channel: 'SP',
      change_type: 'budget_update',
      summary: 'Raised budget on winner',
      why: null,
      source: 'manual',
      before_json: { daily_budget: 80 },
      after_json: { daily_budget: 110, run_id: 'run-111' },
      created_at: '2026-02-20T12:00:01Z',
    },
    {
      change_id: 'c2',
      occurred_at: '2026-02-19T09:00:00Z',
      channel: 'listing',
      change_type: 'title_update',
      summary: 'Title refreshed',
      why: null,
      source: 'manual',
      before_json: null,
      after_json: null,
      created_at: '2026-02-19T09:00:01Z',
    },
    {
      change_id: 'c3',
      occurred_at: '2026-02-18T08:00:00Z',
      channel: 'sb',
      change_type: 'bid_update',
      summary: 'Lowered SB bid',
      why: null,
      source: 'bulkgen',
      before_json: { bid: 1.2 },
      after_json: { bid: 1.1 },
      created_at: '2026-02-18T08:00:01Z',
    },
  ];

  const entities: ProductChangesExplorerEntityRow[] = [
    {
      change_entity_id: 'e1',
      change_id: 'c1',
      entity_type: 'campaign',
      product_id: 'B0TEST12345',
      campaign_id: 'cmp-1',
      ad_group_id: null,
      target_id: null,
      keyword_id: null,
      note: null,
      extra: null,
      created_at: '2026-02-20T12:00:02Z',
    },
    {
      change_entity_id: 'e2',
      change_id: 'c2',
      entity_type: 'product',
      product_id: 'B0TEST12345',
      campaign_id: null,
      ad_group_id: null,
      target_id: null,
      keyword_id: null,
      note: null,
      extra: { run_id: 'run-from-extra' },
      created_at: '2026-02-19T09:00:02Z',
    },
  ];

  const validations: ProductChangesExplorerValidationRow[] = [
    {
      change_id: 'c1',
      status: 'validated',
      checked_at: '2026-02-20T20:00:00Z',
      created_at: '2026-02-20T20:00:00Z',
    },
    {
      change_id: 'c3',
      status: 'mismatch',
      checked_at: '2026-02-19T20:00:00Z',
      created_at: '2026-02-19T20:00:00Z',
    },
  ];

  const links: ProductChangesExplorerLinkRow[] = [
    {
      experiment_id: 'exp-1',
      change_id: 'c1',
      created_at: '2026-02-20T13:00:00Z',
    },
  ];

  const experiments: ProductChangesExplorerExperimentRow[] = [
    {
      experiment_id: 'exp-1',
      name: 'Budget Ramp Test',
    },
  ];

  it('groups entities + joins validation/experiment/run_id', () => {
    const rows = buildProductChangesExplorerViewModel({
      changes,
      entities,
      validations,
      links,
      experiments,
    });

    expect(rows.map((row) => row.change.change_id)).toEqual(['c1', 'c2', 'c3']);
    expect(rows[0].entities.map((entity) => entity.change_entity_id)).toEqual(['e1']);
    expect(rows[0].validation_status).toBe('validated');
    expect(rows[0].experiment?.name).toBe('Budget Ramp Test');
    expect(rows[0].run_id).toBe('run-111');
    expect(rows[1].validation_status).toBe('none');
    expect(rows[1].run_id).toBe('run-from-extra');
  });

  it('applies channel/source/validation/search filters', () => {
    const filtered = buildProductChangesExplorerViewModel({
      changes,
      entities,
      validations,
      links,
      experiments,
      filters: {
        channel: 'sp',
        source: 'manual',
        validation: 'validated',
        q: 'ramp',
      },
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].change.change_id).toBe('c1');

    const nonAdsOnly = buildProductChangesExplorerViewModel({
      changes,
      entities,
      validations,
      links,
      experiments,
      filters: {
        channel: 'non_ads',
      },
    });

    expect(nonAdsOnly.map((row) => row.change.change_id)).toEqual(['c2']);
  });
});
