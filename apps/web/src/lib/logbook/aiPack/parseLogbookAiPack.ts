export const LOGBOOK_AI_PACK_VERSION = 'aph_logbook_pack_v1';

type JsonObject = Record<string, unknown>;

export type LogbookAiPackKind = 'experiment' | 'change' | 'evaluation';

export type LogbookAiPackEntity = {
  entity_type: string;
  product_id: string | null;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  keyword_id: string | null;
  note: string | null;
  extra: unknown | null;
};

export type ParsedExperimentPack = {
  pack_version: typeof LOGBOOK_AI_PACK_VERSION;
  kind: 'experiment';
  product_asin: string;
  experiment: {
    dedupe_key: string | null;
    name: string;
    objective: string;
    hypothesis: string | null;
    evaluation_lag_days: number | null;
    evaluation_window_days: number | null;
    primary_metrics: unknown | null;
    guardrails: unknown | null;
    scope: JsonObject;
  };
};

export type ParsedChangePack = {
  pack_version: typeof LOGBOOK_AI_PACK_VERSION;
  kind: 'change';
  product_asin: string;
  change: {
    dedupe_key: string | null;
    occurred_at: string;
    channel: string;
    change_type: string;
    summary: string;
    why: string | null;
    source: string;
    before_json: unknown | null;
    after_json: unknown | null;
    entities: LogbookAiPackEntity[];
    experiment_id: string | null;
    experiment_dedupe_key: string | null;
  };
};

export type ParsedEvaluationPack = {
  pack_version: typeof LOGBOOK_AI_PACK_VERSION;
  kind: 'evaluation';
  product_asin: string;
  evaluation: {
    experiment_id: string | null;
    experiment_dedupe_key: string | null;
    evaluated_at: string;
    window_start: string | null;
    window_end: string | null;
    metrics_json: unknown;
    notes: string | null;
    mark_complete: boolean;
    status: string | null;
    outcome_summary: string | null;
    outcome_score: number;
  };
};

export type ParsedLogbookAiPack =
  | ParsedExperimentPack
  | ParsedChangePack
  | ParsedEvaluationPack;

export type ParseLogbookAiPackResult =
  | { ok: true; value: ParsedLogbookAiPack }
  | { ok: false; error: string };

const trimmed = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const out = value.trim();
  return out.length > 0 ? out : null;
};

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
};

const parseDateOnly = (value: unknown): string | null => {
  const raw = trimmed(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return raw;
};

const parseDateTime = (value: unknown): string | null => {
  const raw = trimmed(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
};

const normalizeAsin = (value: unknown): string | null => {
  const raw = trimmed(value);
  if (!raw) return null;
  return raw.toUpperCase();
};

const normalizeEntities = (value: unknown): LogbookAiPackEntity[] => {
  if (!Array.isArray(value)) return [];
  const rows: LogbookAiPackEntity[] = [];

  for (const entry of value) {
    const row = asObject(entry);
    if (!row) continue;

    const entityType =
      trimmed(row.entity_type) ??
      (trimmed(row.product_id) ? 'product' : null) ??
      (trimmed(row.campaign_id) ? 'campaign' : null) ??
      (trimmed(row.target_id) ? 'target' : null) ??
      'generic';

    rows.push({
      entity_type: entityType,
      product_id: normalizeAsin(row.product_id),
      campaign_id: trimmed(row.campaign_id),
      ad_group_id: trimmed(row.ad_group_id),
      target_id: trimmed(row.target_id),
      keyword_id: trimmed(row.keyword_id),
      note: trimmed(row.note),
      extra: row.extra ?? null,
    });
  }

  return rows;
};

const normalizeScope = (scope: JsonObject, productAsin: string): JsonObject => {
  const normalized: JsonObject = {
    ...scope,
    product_id: productAsin,
  };

  const status = trimmed(scope.status);
  if (status) normalized.status = status;

  const startDate = parseDateOnly(scope.start_date);
  if (startDate) normalized.start_date = startDate;

  const endDate = parseDateOnly(scope.end_date);
  if (endDate) normalized.end_date = endDate;

  const dedupeKey = trimmed(scope.dedupe_key);
  if (dedupeKey) normalized.dedupe_key = dedupeKey;

  const tags = Array.isArray(scope.tags)
    ? scope.tags.map((item) => trimmed(item)).filter((item): item is string => Boolean(item))
    : [];
  if (tags.length > 0) normalized.tags = tags;

  const fiveWOneH = asObject(scope['5w1h']) ?? asObject(scope.five_w_one_h);
  if (fiveWOneH) {
    normalized.five_w_one_h = {
      who: trimmed(fiveWOneH.who),
      what: trimmed(fiveWOneH.what),
      when: trimmed(fiveWOneH.when),
      where: trimmed(fiveWOneH.where),
      why: trimmed(fiveWOneH.why),
      how: trimmed(fiveWOneH.how),
    };
  }

  const plan = scope.plan;
  if (Array.isArray(plan)) {
    const steps = plan
      .map((item) => trimmed(item))
      .filter((item): item is string => Boolean(item));
    if (steps.length > 0) normalized.plan = steps;
  } else if (trimmed(plan)) {
    normalized.plan = trimmed(plan);
  }

  const actions = Array.isArray(scope.actions)
    ? scope.actions
        .map((item) => trimmed(item))
        .filter((item): item is string => Boolean(item))
    : [];
  if (actions.length > 0) normalized.actions = actions;

  const expectedOutcome = trimmed(scope.expected_outcome);
  if (expectedOutcome) normalized.expected_outcome = expectedOutcome;

  const outcomeSummary = trimmed(scope.outcome_summary);
  if (outcomeSummary) normalized.outcome_summary = outcomeSummary;

  return normalized;
};

export const extractOutcomeScore = (metricsJson: unknown): number | null => {
  const metrics = asObject(metricsJson);
  if (!metrics) return null;
  const outcome = asObject(metrics.outcome);
  if (!outcome) return null;
  return asNumber(outcome.score);
};

export const parseLogbookAiPack = (
  rawText: string,
  pageAsin: string
): ParseLogbookAiPackResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'Invalid JSON payload.' };
  }

  const root = asObject(parsed);
  if (!root) {
    return { ok: false, error: 'Payload must be a JSON object.' };
  }

  const packVersion = trimmed(root.pack_version);
  if (!packVersion) {
    return { ok: false, error: 'Missing required field: pack_version.' };
  }
  if (packVersion !== LOGBOOK_AI_PACK_VERSION) {
    return {
      ok: false,
      error: `Unsupported pack_version. Expected ${LOGBOOK_AI_PACK_VERSION}.`,
    };
  }

  const kind = trimmed(root.kind) as LogbookAiPackKind | null;
  if (!kind) {
    return { ok: false, error: 'Missing required field: kind.' };
  }
  if (kind !== 'experiment' && kind !== 'change' && kind !== 'evaluation') {
    return { ok: false, error: 'kind must be one of: experiment, change, evaluation.' };
  }

  const product = asObject(root.product);
  const productAsin = normalizeAsin(product?.asin);
  if (!productAsin) {
    return { ok: false, error: 'Missing required field: product.asin.' };
  }

  const expectedAsin = normalizeAsin(pageAsin);
  if (!expectedAsin || productAsin !== expectedAsin) {
    return {
      ok: false,
      error: `product.asin (${productAsin}) must match page ASIN (${expectedAsin ?? 'UNKNOWN'}).`,
    };
  }

  if (kind === 'experiment') {
    const experiment = asObject(root.experiment);
    if (!experiment) {
      return { ok: false, error: 'Missing required object: experiment.' };
    }

    const name = trimmed(experiment.name);
    const objective = trimmed(experiment.objective);
    const scope = asObject(experiment.scope);
    const status = trimmed(scope?.status);
    const startDate = parseDateOnly(scope?.start_date);
    const endDate = parseDateOnly(scope?.end_date);

    if (!name) return { ok: false, error: 'Experiment requires: name.' };
    if (!objective) return { ok: false, error: 'Experiment requires: objective.' };
    if (!status) return { ok: false, error: 'Experiment requires: scope.status.' };
    if (!startDate) return { ok: false, error: 'Experiment requires: scope.start_date (YYYY-MM-DD).' };
    if (!endDate) return { ok: false, error: 'Experiment requires: scope.end_date (YYYY-MM-DD).' };

    const scopeValue = normalizeScope(
      {
        ...(scope ?? {}),
        status,
        start_date: startDate,
        end_date: endDate,
      },
      productAsin
    );

    return {
      ok: true,
      value: {
        pack_version: LOGBOOK_AI_PACK_VERSION,
        kind,
        product_asin: productAsin,
        experiment: {
          dedupe_key: trimmed(experiment.dedupe_key) ?? trimmed(scopeValue.dedupe_key),
          name,
          objective,
          hypothesis: trimmed(experiment.hypothesis),
          evaluation_lag_days: asNumber(experiment.evaluation_lag_days),
          evaluation_window_days: asNumber(experiment.evaluation_window_days),
          primary_metrics: experiment.primary_metrics ?? null,
          guardrails: experiment.guardrails ?? null,
          scope: scopeValue,
        },
      },
    };
  }

  if (kind === 'change') {
    const change = asObject(root.change);
    if (!change) {
      return { ok: false, error: 'Missing required object: change.' };
    }

    const channel = trimmed(change.channel);
    const changeType = trimmed(change.change_type);
    const summary = trimmed(change.summary);
    const occurredAt = parseDateTime(change.occurred_at);

    if (!channel) return { ok: false, error: 'Change requires: channel.' };
    if (!changeType) return { ok: false, error: 'Change requires: change_type.' };
    if (!summary) return { ok: false, error: 'Change requires: summary.' };
    if (!occurredAt) return { ok: false, error: 'Change requires: occurred_at (ISO datetime).' };

    const entities = normalizeEntities(change.entities);
    const hasProductEntity = entities.some((entity) => entity.product_id === productAsin);
    if (!hasProductEntity) {
      entities.unshift({
        entity_type: 'product',
        product_id: productAsin,
        campaign_id: null,
        ad_group_id: null,
        target_id: null,
        keyword_id: null,
        note: null,
        extra: null,
      });
    }

    return {
      ok: true,
      value: {
        pack_version: LOGBOOK_AI_PACK_VERSION,
        kind,
        product_asin: productAsin,
        change: {
          dedupe_key: trimmed(change.dedupe_key),
          occurred_at: occurredAt,
          channel,
          change_type: changeType,
          summary,
          why: trimmed(change.why),
          source: trimmed(change.source) ?? 'ai_pack',
          before_json: change.before_json ?? null,
          after_json: change.after_json ?? null,
          entities,
          experiment_id: trimmed(change.experiment_id),
          experiment_dedupe_key: trimmed(change.experiment_dedupe_key),
        },
      },
    };
  }

  const evaluation = asObject(root.evaluation);
  if (!evaluation) {
    return { ok: false, error: 'Missing required object: evaluation.' };
  }

  const experimentId = trimmed(evaluation.experiment_id);
  const experimentDedupeKey = trimmed(evaluation.experiment_dedupe_key);
  if (!experimentId && !experimentDedupeKey) {
    return {
      ok: false,
      error: 'Evaluation requires: experiment_id or experiment_dedupe_key.',
    };
  }

  const metricsJson = evaluation.metrics_json;
  const outcomeScore = extractOutcomeScore(metricsJson);
  if (outcomeScore === null) {
    return {
      ok: false,
      error: 'Evaluation requires metrics_json.outcome.score.',
    };
  }

  const evaluatedAt = parseDateTime(evaluation.evaluated_at) ?? new Date().toISOString();
  const windowStart = evaluation.window_start ? parseDateOnly(evaluation.window_start) : null;
  const windowEnd = evaluation.window_end ? parseDateOnly(evaluation.window_end) : null;

  if (evaluation.window_start && !windowStart) {
    return { ok: false, error: 'evaluation.window_start must be YYYY-MM-DD.' };
  }

  if (evaluation.window_end && !windowEnd) {
    return { ok: false, error: 'evaluation.window_end must be YYYY-MM-DD.' };
  }

  return {
    ok: true,
    value: {
      pack_version: LOGBOOK_AI_PACK_VERSION,
      kind,
      product_asin: productAsin,
      evaluation: {
        experiment_id: experimentId,
        experiment_dedupe_key: experimentDedupeKey,
        evaluated_at: evaluatedAt,
        window_start: windowStart,
        window_end: windowEnd,
        metrics_json: metricsJson,
        notes: trimmed(evaluation.notes),
        mark_complete: evaluation.mark_complete === true,
        status: trimmed(evaluation.status),
        outcome_summary: trimmed(evaluation.outcome_summary),
        outcome_score: outcomeScore,
      },
    },
  };
};
