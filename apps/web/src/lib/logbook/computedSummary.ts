export type ComputedSummary = {
  generated_at: string;
  data_quality: { warnings_count: number; missing_sections: string[] };
  profitability: { state: 'profit' | 'loss' | 'unknown'; evidence: string[] };
  waste: { high_spend_no_sales_count: number; top_targets: Array<{ id: string; spend: number }> };
  opportunity: { high_cvr_count: number; top_targets: Array<{ id: string; cvr: number }> };
  ranking: { stable_terms_count: number; falling_terms_count: number };
  intent_alignment: { driver_campaigns_classified_count: number; suggestions_count: number };
  kiv: { items_count: number };
};

export type ComputedEvaluationSummary = {
  generated_at: string;
  data_quality: { warnings_count: number; missing_sections: string[] };
  comparison: {
    state: 'improved' | 'declined' | 'mixed' | 'unknown';
    sales_delta: number | null;
    orders_delta: number | null;
    profit_delta: number | null;
    evidence: string[];
  };
  interruptions: {
    events_count: number;
    types: string[];
    has_manual_intervention: boolean;
    has_guardrail_breach: boolean;
    has_stop_loss: boolean;
    has_rollback: boolean;
  };
};

type TargetMetrics = {
  id: string;
  spend: number;
  sales: number;
  clicks: number;
  conversions: number;
  cvr: number | null;
};

// Conservative thresholds keep the summary deterministic and low-noise.
const HIGH_SPEND_NO_SALES_THRESHOLD = 25;
const HIGH_CVR_THRESHOLD = 0.2;
const HIGH_CVR_MIN_CLICKS = 20;
const STABLE_RANK_DELTA_MAX = 3;
const FALLING_RANK_DELTA_MIN = 8;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) return [];
  return value;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toRounded = (value: number, digits: number): number =>
  Number(value.toFixed(digits));

const uniqueStrings = (values: string[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = asString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

const readWarnings = (packRecord: Record<string, unknown>) => {
  const metadata = asRecord(packRecord.metadata);
  const warningsFromRoot = asArray(packRecord.warnings)
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
  const warningsFromMetadata = asArray(metadata?.warnings)
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));

  return {
    warnings: uniqueStrings([...warningsFromRoot, ...warningsFromMetadata]),
    hasSection: Array.isArray(packRecord.warnings) || Array.isArray(metadata?.warnings),
  };
};

const collectTargetMetrics = (packRecord: Record<string, unknown>) => {
  const adsBaseline = asRecord(packRecord.ads_baseline);
  const channels = ['sp', 'sb', 'sd'];
  const out: TargetMetrics[] = [];
  let hasSection = false;

  for (const channel of channels) {
    const channelRecord = asRecord(adsBaseline?.[channel]);
    const targetRows = channelRecord?.targets;
    if (!Array.isArray(targetRows)) continue;
    hasSection = true;

    for (const targetRaw of targetRows) {
      const target = asRecord(targetRaw);
      if (!target) continue;

      const targetId =
        asString(target.target_id) ??
        asString(target.target_key) ??
        asString(target.id);
      if (!targetId) continue;

      const spend = asFiniteNumber(target.spend) ?? 0;
      const sales = asFiniteNumber(target.sales) ?? 0;
      const clicks = asFiniteNumber(target.clicks) ?? 0;
      const orders = asFiniteNumber(target.orders);
      const units = asFiniteNumber(target.units);
      const conversions = orders ?? units ?? 0;
      const cvr = clicks > 0 ? conversions / clicks : null;

      out.push({
        id: targetId,
        spend,
        sales,
        clicks,
        conversions,
        cvr,
      });
    }
  }

  return { rows: out, hasSection };
};

const computeProfitability = (packRecord: Record<string, unknown>) => {
  const kpis = asRecord(packRecord.kpis);
  const baseline = asRecord(kpis?.baseline);
  const totals = asRecord(baseline?.totals);
  const profitValue = asFiniteNumber(totals?.profits ?? totals?.profit);

  if (profitValue === null) {
    return {
      state: 'unknown' as const,
      evidence: ['unknown due to missing data: kpis.baseline.totals.profits'],
      hasProfitField: false,
    };
  }

  if (profitValue > 0) {
    return {
      state: 'profit' as const,
      evidence: [`kpis.baseline.totals.profits=${toRounded(profitValue, 2)}`],
      hasProfitField: true,
    };
  }

  if (profitValue < 0) {
    return {
      state: 'loss' as const,
      evidence: [`kpis.baseline.totals.profits=${toRounded(profitValue, 2)}`],
      hasProfitField: true,
    };
  }

  return {
    state: 'unknown' as const,
    evidence: ['kpis.baseline.totals.profits=0 (neutral baseline)'],
    hasProfitField: true,
  };
};

const computeRankingTrend = (packRecord: Record<string, unknown>) => {
  const ranking = asRecord(packRecord.ranking_baseline);
  const trendRows = ranking?.top_keyword_trends;
  if (!Array.isArray(trendRows)) {
    return {
      stable: 0,
      falling: 0,
      hasSection: false,
    };
  }

  const byKeyword = new Map<
    string,
    { earliestDate: string; earliestRank: number; latestDate: string; latestRank: number }
  >();

  for (const rowRaw of trendRows) {
    const row = asRecord(rowRaw);
    if (!row) continue;

    const keyword = asString(row.keyword_norm) ?? asString(row.keyword_raw);
    const date = asString(row.observed_date) ?? asString(row.date);
    const rank = asFiniteNumber(row.organic_rank_value);
    if (!keyword || !date || rank === null) continue;

    const existing = byKeyword.get(keyword);
    if (!existing) {
      byKeyword.set(keyword, {
        earliestDate: date,
        earliestRank: rank,
        latestDate: date,
        latestRank: rank,
      });
      continue;
    }

    if (date < existing.earliestDate) {
      existing.earliestDate = date;
      existing.earliestRank = rank;
    }
    if (date > existing.latestDate) {
      existing.latestDate = date;
      existing.latestRank = rank;
    }
  }

  let stable = 0;
  let falling = 0;

  for (const entry of byKeyword.values()) {
    const delta = entry.latestRank - entry.earliestRank;
    if (Math.abs(delta) <= STABLE_RANK_DELTA_MAX) stable += 1;
    if (delta >= FALLING_RANK_DELTA_MIN) falling += 1;
  }

  return {
    stable,
    falling,
    hasSection: true,
  };
};

const countArrayIfPresent = (value: unknown): number | null => {
  if (!Array.isArray(value)) return null;
  return value.length;
};

const countIntentAlignment = (packRecord: Record<string, unknown>) => {
  const product = asRecord(packRecord.product);
  const intent = asRecord(product?.intent);
  if (!intent) {
    return {
      driverCount: 0,
      suggestionsCount: 0,
      kivItemsCount: 0,
      hasIntent: false,
    };
  }

  const driverArrayCount =
    countArrayIfPresent(intent.driver_campaigns) ??
    countArrayIfPresent(intent.driver_campaign_ids);
  const suggestionArrayCount =
    countArrayIfPresent(intent.suggestions) ??
    countArrayIfPresent(intent.recommendations);
  const kivArrayCount =
    countArrayIfPresent(intent.kiv) ??
    countArrayIfPresent(intent.kiv_items);

  const driverCount =
    asFiniteNumber(intent.driver_campaigns_classified_count) ??
    driverArrayCount ??
    0;
  const suggestionsCount =
    asFiniteNumber(intent.suggestions_count) ??
    suggestionArrayCount ??
    0;
  const kivItemsCount =
    asFiniteNumber(intent.kiv_count) ??
    asFiniteNumber(intent.items_count) ??
    kivArrayCount ??
    0;

  return {
    driverCount: Math.max(0, Math.floor(driverCount ?? 0)),
    suggestionsCount: Math.max(0, Math.floor(suggestionsCount ?? 0)),
    kivItemsCount: Math.max(0, Math.floor(kivItemsCount ?? 0)),
    hasIntent: true,
  };
};

const computeMissingSections = (input: {
  hasWarnings: boolean;
  hasProfitField: boolean;
  hasTargets: boolean;
  hasRanking: boolean;
  hasIntent: boolean;
}): string[] => {
  const missing: string[] = [];
  if (!input.hasWarnings) missing.push('metadata.warnings');
  if (!input.hasProfitField) missing.push('kpis.baseline.totals.profits');
  if (!input.hasTargets) missing.push('ads_baseline.*.targets');
  if (!input.hasRanking) missing.push('ranking_baseline.top_keyword_trends');
  if (!input.hasIntent) missing.push('product.intent');
  return missing;
};

export const computeBaselineSummary = (pack: unknown): ComputedSummary => {
  const packRecord = asRecord(pack) ?? {};

  const warnings = readWarnings(packRecord);
  const targets = collectTargetMetrics(packRecord);
  const profitability = computeProfitability(packRecord);
  const ranking = computeRankingTrend(packRecord);
  const intentCounts = countIntentAlignment(packRecord);

  const highSpendNoSales = targets.rows
    .filter((row) => row.spend > HIGH_SPEND_NO_SALES_THRESHOLD && row.sales === 0)
    .sort((a, b) => {
      const spendCompare = b.spend - a.spend;
      if (spendCompare !== 0) return spendCompare;
      return a.id.localeCompare(b.id);
    });

  const highCvrTargets = targets.rows
    .filter(
      (row) => row.cvr !== null && row.cvr > HIGH_CVR_THRESHOLD && row.clicks >= HIGH_CVR_MIN_CLICKS
    )
    .sort((a, b) => {
      const cvrCompare = (b.cvr ?? 0) - (a.cvr ?? 0);
      if (cvrCompare !== 0) return cvrCompare;
      const clicksCompare = b.clicks - a.clicks;
      if (clicksCompare !== 0) return clicksCompare;
      return a.id.localeCompare(b.id);
    });

  return {
    generated_at: new Date().toISOString(),
    data_quality: {
      warnings_count: warnings.warnings.length,
      missing_sections: computeMissingSections({
        hasWarnings: warnings.hasSection,
        hasProfitField: profitability.hasProfitField,
        hasTargets: targets.hasSection,
        hasRanking: ranking.hasSection,
        hasIntent: intentCounts.hasIntent,
      }),
    },
    profitability: {
      state: profitability.state,
      evidence: profitability.evidence,
    },
    waste: {
      high_spend_no_sales_count: highSpendNoSales.length,
      top_targets: highSpendNoSales.slice(0, 5).map((row) => ({
        id: row.id,
        spend: toRounded(row.spend, 2),
      })),
    },
    opportunity: {
      high_cvr_count: highCvrTargets.length,
      top_targets: highCvrTargets.slice(0, 5).map((row) => ({
        id: row.id,
        cvr: toRounded(row.cvr ?? 0, 6),
      })),
    },
    ranking: {
      stable_terms_count: ranking.stable,
      falling_terms_count: ranking.falling,
    },
    intent_alignment: {
      driver_campaigns_classified_count: intentCounts.driverCount,
      suggestions_count: intentCounts.suggestionsCount,
    },
    kiv: {
      items_count: intentCounts.kivItemsCount,
    },
  };
};

const computeComparisonState = (input: {
  salesDelta: number | null;
  profitDelta: number | null;
}): 'improved' | 'declined' | 'mixed' | 'unknown' => {
  const { salesDelta, profitDelta } = input;
  if (salesDelta === null && profitDelta === null) return 'unknown';
  if ((profitDelta ?? 0) > 0 && (salesDelta ?? 0) >= 0) return 'improved';
  if ((profitDelta ?? 0) < 0 && (salesDelta ?? 0) <= 0) return 'declined';
  return 'mixed';
};

export const computeEvaluationSummary = (pack: unknown): ComputedEvaluationSummary => {
  const packRecord = asRecord(pack) ?? {};
  const warnings = readWarnings(packRecord);
  const kpis = asRecord(packRecord.kpis);
  const baselineTotals = asRecord(asRecord(kpis?.baseline)?.totals);
  const testTotals = asRecord(asRecord(kpis?.test)?.totals);

  const baselineSales = asFiniteNumber(baselineTotals?.sales);
  const baselineOrders = asFiniteNumber(baselineTotals?.orders);
  const baselineProfits = asFiniteNumber(baselineTotals?.profits ?? baselineTotals?.profit);

  const testSales = asFiniteNumber(testTotals?.sales);
  const testOrders = asFiniteNumber(testTotals?.orders);
  const testProfits = asFiniteNumber(testTotals?.profits ?? testTotals?.profit);

  const salesDelta =
    baselineSales !== null && testSales !== null ? toRounded(testSales - baselineSales, 2) : null;
  const ordersDelta =
    baselineOrders !== null && testOrders !== null ? toRounded(testOrders - baselineOrders, 2) : null;
  const profitDelta =
    baselineProfits !== null && testProfits !== null
      ? toRounded(testProfits - baselineProfits, 2)
      : null;

  const experiment = asRecord(packRecord.experiment);
  const interruptionRows = asArray(experiment?.interruption_events);
  const interruptionTypes = uniqueStrings(
    interruptionRows
      .map((entry) => asRecord(entry))
      .map((entry) => asString(entry?.event_type))
      .filter((entry): entry is string => Boolean(entry))
  );

  const missingSections: string[] = [];
  if (!warnings.hasSection) missingSections.push('warnings');
  if (!baselineTotals) missingSections.push('kpis.baseline.totals');
  if (!testTotals) missingSections.push('kpis.test.totals');
  if (!Array.isArray(experiment?.interruption_events)) {
    missingSections.push('experiment.interruption_events');
  }

  const evidence: string[] = [];
  if (salesDelta === null) {
    evidence.push('unknown due to missing data: kpis baseline/test sales totals');
  } else {
    evidence.push(`sales_delta=${salesDelta}`);
  }
  if (profitDelta === null) {
    evidence.push('unknown due to missing data: kpis baseline/test profits totals');
  } else {
    evidence.push(`profit_delta=${profitDelta}`);
  }

  return {
    generated_at: new Date().toISOString(),
    data_quality: {
      warnings_count: warnings.warnings.length,
      missing_sections: missingSections,
    },
    comparison: {
      state: computeComparisonState({ salesDelta, profitDelta }),
      sales_delta: salesDelta,
      orders_delta: ordersDelta,
      profit_delta: profitDelta,
      evidence,
    },
    interruptions: {
      events_count: interruptionRows.length,
      types: interruptionTypes,
      has_manual_intervention: interruptionTypes.includes('manual_intervention'),
      has_guardrail_breach: interruptionTypes.includes('guardrail_breach'),
      has_stop_loss: interruptionTypes.includes('stop_loss'),
      has_rollback: interruptionTypes.includes('rollback'),
    },
  };
};
