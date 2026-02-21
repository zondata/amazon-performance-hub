import { extractOutcomeScore } from '../logbook/aiPack/parseLogbookAiPack';

export type ProductLogbookChangeRow = {
  change_id: string;
  occurred_at: string;
  channel: string;
  change_type: string;
  summary: string;
  why: string | null;
  source: string;
  before_json: unknown | null;
  after_json: unknown | null;
  created_at: string;
};

export type ProductLogbookValidationRow = {
  change_id: string;
  status: 'pending' | 'validated' | 'mismatch' | 'not_found';
  expected_json: unknown | null;
  actual_json: unknown | null;
  diff_json: unknown | null;
  validated_upload_id: string | null;
  validated_snapshot_date: string | null;
  checked_at: string;
  created_at: string;
};

export type ProductLogbookEntityRow = {
  change_entity_id: string;
  change_id: string;
  entity_type: string;
  product_id: string | null;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  keyword_id: string | null;
  note: string | null;
  extra: unknown | null;
  created_at: string;
};

export type ProductLogbookExperimentLinkRow = {
  experiment_change_id: string;
  experiment_id: string;
  change_id: string;
  created_at: string;
};

export type ProductLogbookExperimentRow = {
  experiment_id: string;
  name: string;
  objective: string;
  hypothesis: string | null;
  evaluation_lag_days: number | null;
  evaluation_window_days: number | null;
  primary_metrics: unknown | null;
  guardrails: unknown | null;
  scope: unknown | null;
  created_at: string;
};

export type ProductLogbookEvaluationRow = {
  evaluation_id: string;
  experiment_id: string;
  evaluated_at: string;
  window_start: string | null;
  window_end: string | null;
  metrics_json: unknown | null;
  notes: string | null;
  created_at: string;
};

export type ProductLogbookChangeWithEntities = {
  change: ProductLogbookChangeRow;
  entities: ProductLogbookEntityRow[];
  validation: ProductLogbookValidationRow | null;
};

export type ProductLogbookExperimentView = {
  experiment: ProductLogbookExperimentRow;
  status: string;
  start_date: string | null;
  end_date: string | null;
  outcome_score: number | null;
  latest_evaluation_notes: string | null;
  latest_evaluation: ProductLogbookEvaluationRow | null;
  changes: ProductLogbookChangeWithEntities[];
};

export type ProductLogbookDataViewModel = {
  experiments: ProductLogbookExperimentView[];
  unassigned_changes: ProductLogbookChangeWithEntities[];
};

type BuildProductLogbookViewModelInput = {
  changes: ProductLogbookChangeRow[];
  entities: ProductLogbookEntityRow[];
  experimentLinks: ProductLogbookExperimentLinkRow[];
  experiments: ProductLogbookExperimentRow[];
  evaluations: ProductLogbookEvaluationRow[];
  validations: ProductLogbookValidationRow[];
};

const compareDesc = (left: string, right: string) => right.localeCompare(left);

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const scopeString = (scope: Record<string, unknown> | null, key: string): string | null => {
  if (!scope) return null;
  const value = scope[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const scopeDate = (scope: Record<string, unknown> | null, key: string): string | null => {
  const value = scopeString(scope, key);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
};

export const buildProductLogbookViewModel = ({
  changes,
  entities,
  experimentLinks,
  experiments,
  evaluations,
  validations = [],
}: BuildProductLogbookViewModelInput): ProductLogbookDataViewModel => {
  const changeById = new Map<string, ProductLogbookChangeRow>();
  for (const change of changes) {
    if (!changeById.has(change.change_id)) {
      changeById.set(change.change_id, change);
    }
  }

  const entitiesByChangeId = new Map<string, ProductLogbookEntityRow[]>();
  for (const entity of entities) {
    if (!changeById.has(entity.change_id)) continue;
    const rows = entitiesByChangeId.get(entity.change_id) ?? [];
    rows.push(entity);
    entitiesByChangeId.set(entity.change_id, rows);
  }

  const validationByChangeId = new Map<string, ProductLogbookValidationRow>();
  for (const validation of validations) {
    if (!validationByChangeId.has(validation.change_id)) {
      validationByChangeId.set(validation.change_id, validation);
    }
  }

  const changeItemsById = new Map<string, ProductLogbookChangeWithEntities>();
  for (const change of changeById.values()) {
    const changeEntities = (entitiesByChangeId.get(change.change_id) ?? []).slice();
    changeEntities.sort((a, b) => {
      const createdCompare = compareDesc(a.created_at, b.created_at);
      if (createdCompare !== 0) return createdCompare;
      return a.change_entity_id.localeCompare(b.change_entity_id);
    });
    changeItemsById.set(change.change_id, {
      change,
      entities: changeEntities,
      validation: validationByChangeId.get(change.change_id) ?? null,
    });
  }

  const experimentById = new Map<string, ProductLogbookExperimentRow>();
  for (const experiment of experiments) {
    if (!experimentById.has(experiment.experiment_id)) {
      experimentById.set(experiment.experiment_id, experiment);
    }
  }

  const linkedChangeIdsByExperimentId = new Map<string, Set<string>>();
  const linkPairs = new Set<string>();
  for (const link of experimentLinks) {
    if (!changeItemsById.has(link.change_id)) continue;
    const pair = `${link.experiment_id}::${link.change_id}`;
    if (linkPairs.has(pair)) continue;
    linkPairs.add(pair);

    const changeIds = linkedChangeIdsByExperimentId.get(link.experiment_id) ?? new Set();
    changeIds.add(link.change_id);
    linkedChangeIdsByExperimentId.set(link.experiment_id, changeIds);
  }

  const allLinkedChangeIds = new Set<string>();
  for (const ids of linkedChangeIdsByExperimentId.values()) {
    ids.forEach((changeId) => allLinkedChangeIds.add(changeId));
  }

  const evaluationsByExperimentId = new Map<string, ProductLogbookEvaluationRow[]>();
  for (const evaluation of evaluations) {
    if (!experimentById.has(evaluation.experiment_id)) continue;
    const rows = evaluationsByExperimentId.get(evaluation.experiment_id) ?? [];
    rows.push(evaluation);
    evaluationsByExperimentId.set(evaluation.experiment_id, rows);
  }

  for (const rows of evaluationsByExperimentId.values()) {
    rows.sort((a, b) => {
      const evaluatedCompare = compareDesc(a.evaluated_at, b.evaluated_at);
      if (evaluatedCompare !== 0) return evaluatedCompare;
      const createdCompare = compareDesc(a.created_at, b.created_at);
      if (createdCompare !== 0) return createdCompare;
      return a.evaluation_id.localeCompare(b.evaluation_id);
    });
  }

  const experimentsView = Array.from(experimentById.values())
    .map((experiment) => {
      const linkedIds = linkedChangeIdsByExperimentId.get(experiment.experiment_id) ?? new Set();
      const changesView = Array.from(linkedIds)
        .map((changeId) => changeItemsById.get(changeId))
        .filter((row): row is ProductLogbookChangeWithEntities => Boolean(row))
        .sort((a, b) => {
          const occurredCompare = compareDesc(a.change.occurred_at, b.change.occurred_at);
          if (occurredCompare !== 0) return occurredCompare;
          return a.change.change_id.localeCompare(b.change.change_id);
        });

      const scope = asObject(experiment.scope);
      const status = scopeString(scope, 'status') ?? 'planned';
      const startDate = scopeDate(scope, 'start_date');
      const endDate = scopeDate(scope, 'end_date');
      const latestEvaluation = (evaluationsByExperimentId.get(experiment.experiment_id) ?? [])[0] ?? null;
      const outcomeScore = latestEvaluation
        ? extractOutcomeScore(latestEvaluation.metrics_json)
        : null;

      return {
        experiment,
        status,
        start_date: startDate,
        end_date: endDate,
        outcome_score: outcomeScore,
        latest_evaluation_notes: latestEvaluation?.notes ?? null,
        latest_evaluation: latestEvaluation,
        changes: changesView,
      };
    })
    .sort((a, b) => {
      if (a.start_date && b.start_date) {
        const startCompare = compareDesc(a.start_date, b.start_date);
        if (startCompare !== 0) return startCompare;
      } else if (a.start_date && !b.start_date) {
        return -1;
      } else if (!a.start_date && b.start_date) {
        return 1;
      }

      const createdCompare = compareDesc(a.experiment.created_at, b.experiment.created_at);
      if (createdCompare !== 0) return createdCompare;
      return a.experiment.experiment_id.localeCompare(b.experiment.experiment_id);
    });

  const unassignedChanges = Array.from(changeItemsById.values())
    .filter((item) => !allLinkedChangeIds.has(item.change.change_id))
    .sort((a, b) => {
      const occurredCompare = compareDesc(a.change.occurred_at, b.change.occurred_at);
      if (occurredCompare !== 0) return occurredCompare;
      return a.change.change_id.localeCompare(b.change.change_id);
    });

  return {
    experiments: experimentsView,
    unassigned_changes: unassignedChanges,
  };
};
