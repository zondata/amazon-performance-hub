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
};

export type ProductLogbookExperimentGroup = {
  experiment: ProductLogbookExperimentRow;
  changes: ProductLogbookChangeWithEntities[];
  evaluations: ProductLogbookEvaluationRow[];
};

export type ProductLogbookViewModel = {
  experiments: ProductLogbookExperimentGroup[];
  unassigned: ProductLogbookChangeWithEntities[];
};

type BuildProductLogbookViewModelInput = {
  changes: ProductLogbookChangeRow[];
  entities: ProductLogbookEntityRow[];
  experimentLinks: ProductLogbookExperimentLinkRow[];
  experiments: ProductLogbookExperimentRow[];
  evaluations: ProductLogbookEvaluationRow[];
};

const compareDesc = (left: string, right: string) => right.localeCompare(left);

export const buildProductLogbookViewModel = ({
  changes,
  entities,
  experimentLinks,
  experiments,
  evaluations,
}: BuildProductLogbookViewModelInput): ProductLogbookViewModel => {
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

  const changeItemsById = new Map<string, ProductLogbookChangeWithEntities>();
  for (const change of changeById.values()) {
    const changeEntities = (entitiesByChangeId.get(change.change_id) ?? []).slice();
    changeEntities.sort((a, b) => {
      const createdCompare = compareDesc(a.created_at, b.created_at);
      if (createdCompare !== 0) return createdCompare;
      return a.change_entity_id.localeCompare(b.change_entity_id);
    });
    changeItemsById.set(change.change_id, { change, entities: changeEntities });
  }

  const experimentById = new Map<string, ProductLogbookExperimentRow>();
  for (const experiment of experiments) {
    if (!experimentById.has(experiment.experiment_id)) {
      experimentById.set(experiment.experiment_id, experiment);
    }
  }

  const linkPairs = new Set<string>();
  const changeIdsByExperimentId = new Map<string, Set<string>>();
  for (const link of experimentLinks) {
    if (!changeItemsById.has(link.change_id)) continue;
    if (!experimentById.has(link.experiment_id)) continue;
    const pairKey = `${link.experiment_id}::${link.change_id}`;
    if (linkPairs.has(pairKey)) continue;
    linkPairs.add(pairKey);
    const changeIds = changeIdsByExperimentId.get(link.experiment_id) ?? new Set<string>();
    changeIds.add(link.change_id);
    changeIdsByExperimentId.set(link.experiment_id, changeIds);
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
      return a.evaluation_id.localeCompare(b.evaluation_id);
    });
  }

  const experimentsView = Array.from(changeIdsByExperimentId.entries())
    .map(([experimentId, linkedChangeIds]) => {
      const experiment = experimentById.get(experimentId);
      if (!experiment) return null;
      const changesView = Array.from(linkedChangeIds)
        .map((changeId) => changeItemsById.get(changeId))
        .filter(
          (
            item
          ): item is {
            change: ProductLogbookChangeRow;
            entities: ProductLogbookEntityRow[];
          } => Boolean(item)
        )
        .sort((a, b) => {
          const occurredCompare = compareDesc(a.change.occurred_at, b.change.occurred_at);
          if (occurredCompare !== 0) return occurredCompare;
          return a.change.change_id.localeCompare(b.change.change_id);
        });

      return {
        experiment,
        changes: changesView,
        evaluations: evaluationsByExperimentId.get(experimentId) ?? [],
      };
    })
    .filter((item): item is ProductLogbookExperimentGroup => Boolean(item))
    .sort((a, b) => {
      const createdCompare = compareDesc(a.experiment.created_at, b.experiment.created_at);
      if (createdCompare !== 0) return createdCompare;
      return a.experiment.experiment_id.localeCompare(b.experiment.experiment_id);
    });

  const linkedChangeIds = new Set<string>();
  for (const group of experimentsView) {
    for (const changeItem of group.changes) {
      linkedChangeIds.add(changeItem.change.change_id);
    }
  }

  const unassigned = Array.from(changeItemsById.values())
    .filter((item) => !linkedChangeIds.has(item.change.change_id))
    .sort((a, b) => {
      const occurredCompare = compareDesc(a.change.occurred_at, b.change.occurred_at);
      if (occurredCompare !== 0) return occurredCompare;
      return a.change.change_id.localeCompare(b.change.change_id);
    });

  return {
    experiments: experimentsView,
    unassigned,
  };
};
