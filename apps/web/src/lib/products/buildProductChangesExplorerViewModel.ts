type JsonObject = Record<string, unknown>;

export type ProductChangesExplorerChangeRow = {
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

export type ProductChangesExplorerEntityRow = {
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

export type ProductChangesExplorerValidationRow = {
  change_id: string;
  status: 'pending' | 'validated' | 'mismatch' | 'not_found';
  checked_at: string;
  created_at: string;
};

export type ProductChangesExplorerLinkRow = {
  experiment_id: string;
  change_id: string;
  created_at: string;
};

export type ProductChangesExplorerExperimentRow = {
  experiment_id: string;
  name: string;
};

export type ProductChangesExplorerFilters = {
  channel?: 'all' | 'sp' | 'sb' | 'sd' | 'non_ads' | null;
  source?: 'all' | 'bulkgen' | 'manual' | null;
  validation?: 'all' | 'pending' | 'validated' | 'mismatch' | 'not_found' | 'none' | null;
  q?: string | null;
};

export type ProductChangesExplorerValidationStatus =
  | 'pending'
  | 'validated'
  | 'mismatch'
  | 'not_found'
  | 'none';

export type ProductChangesExplorerRow = {
  change: ProductChangesExplorerChangeRow;
  entities: ProductChangesExplorerEntityRow[];
  validation: ProductChangesExplorerValidationRow | null;
  validation_status: ProductChangesExplorerValidationStatus;
  experiment: ProductChangesExplorerExperimentRow | null;
  run_id: string | null;
};

type BuildInput = {
  changes: ProductChangesExplorerChangeRow[];
  entities: ProductChangesExplorerEntityRow[];
  validations: ProductChangesExplorerValidationRow[];
  links: ProductChangesExplorerLinkRow[];
  experiments: ProductChangesExplorerExperimentRow[];
  filters?: ProductChangesExplorerFilters;
};

const compareDesc = (left: string, right: string) => right.localeCompare(left);

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractRunId = (
  change: Pick<ProductChangesExplorerChangeRow, 'before_json' | 'after_json'>,
  entities: ProductChangesExplorerEntityRow[]
): string | null => {
  const after = asObject(change.after_json);
  const before = asObject(change.before_json);
  const direct = asString(after?.run_id) ?? asString(before?.run_id);
  if (direct) return direct;

  for (const entity of entities) {
    const extra = asObject(entity.extra);
    const fromExtra = asString(extra?.run_id);
    if (fromExtra) return fromExtra;
  }

  return null;
};

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

const validationStatusFor = (
  validation: ProductChangesExplorerValidationRow | null
): ProductChangesExplorerValidationStatus => {
  if (!validation) return 'none';
  if (validation.status === 'validated') return 'validated';
  if (validation.status === 'mismatch') return 'mismatch';
  if (validation.status === 'not_found') return 'not_found';
  return 'pending';
};

const channelMatches = (channel: string, selected: ProductChangesExplorerFilters['channel']) => {
  if (!selected || selected === 'all') return true;
  const normalized = normalize(channel);
  if (selected === 'non_ads') {
    return normalized !== 'sp' && normalized !== 'sb' && normalized !== 'sd';
  }
  return normalized === selected;
};

const sourceMatches = (source: string, selected: ProductChangesExplorerFilters['source']) => {
  if (!selected || selected === 'all') return true;
  return normalize(source) === selected;
};

const validationMatches = (
  status: ProductChangesExplorerValidationStatus,
  selected: ProductChangesExplorerFilters['validation']
) => {
  if (!selected || selected === 'all') return true;
  return status === selected;
};

const searchText = (row: ProductChangesExplorerRow) => {
  const entityTokens = row.entities.flatMap((entity) =>
    [
      entity.product_id,
      entity.campaign_id,
      entity.ad_group_id,
      entity.target_id,
      entity.keyword_id,
      entity.note,
      entity.entity_type,
    ].filter((value): value is string => Boolean(value && value.trim()))
  );

  return normalize(
    [
      row.change.summary,
      row.change.why ?? '',
      row.experiment?.name ?? '',
      row.run_id ?? '',
      ...entityTokens,
    ].join(' ')
  );
};

const queryMatches = (row: ProductChangesExplorerRow, q: string | null | undefined) => {
  const term = normalize(q);
  if (!term) return true;
  return searchText(row).includes(term);
};

export const buildProductChangesExplorerViewModel = ({
  changes,
  entities,
  validations,
  links,
  experiments,
  filters = {},
}: BuildInput): ProductChangesExplorerRow[] => {
  const entitiesByChangeId = new Map<string, ProductChangesExplorerEntityRow[]>();
  for (const entity of entities) {
    const rows = entitiesByChangeId.get(entity.change_id) ?? [];
    rows.push(entity);
    entitiesByChangeId.set(entity.change_id, rows);
  }
  for (const rows of entitiesByChangeId.values()) {
    rows.sort((a, b) => {
      const createdCompare = compareDesc(a.created_at, b.created_at);
      if (createdCompare !== 0) return createdCompare;
      return a.change_entity_id.localeCompare(b.change_entity_id);
    });
  }

  const validationByChangeId = new Map<string, ProductChangesExplorerValidationRow>();
  for (const validation of validations) {
    if (!validationByChangeId.has(validation.change_id)) {
      validationByChangeId.set(validation.change_id, validation);
    }
  }

  const experimentById = new Map<string, ProductChangesExplorerExperimentRow>();
  for (const experiment of experiments) {
    if (!experimentById.has(experiment.experiment_id)) {
      experimentById.set(experiment.experiment_id, experiment);
    }
  }

  const experimentIdByChangeId = new Map<string, string>();
  for (const link of links) {
    if (!experimentIdByChangeId.has(link.change_id)) {
      experimentIdByChangeId.set(link.change_id, link.experiment_id);
    }
  }

  return changes
    .map((change) => {
      const groupedEntities = entitiesByChangeId.get(change.change_id) ?? [];
      const validation = validationByChangeId.get(change.change_id) ?? null;
      const validationStatus = validationStatusFor(validation);
      const linkedExperimentId = experimentIdByChangeId.get(change.change_id);
      const experiment = linkedExperimentId ? experimentById.get(linkedExperimentId) ?? null : null;
      const runId = extractRunId(change, groupedEntities);

      return {
        change,
        entities: groupedEntities,
        validation,
        validation_status: validationStatus,
        experiment,
        run_id: runId,
      };
    })
    .filter(
      (row) =>
        channelMatches(row.change.channel, filters.channel) &&
        sourceMatches(row.change.source, filters.source) &&
        validationMatches(row.validation_status, filters.validation) &&
        queryMatches(row, filters.q)
    )
    .sort((a, b) => {
      const occurredCompare = compareDesc(a.change.occurred_at, b.change.occurred_at);
      if (occurredCompare !== 0) return occurredCompare;
      return a.change.change_id.localeCompare(b.change.change_id);
    });
};
