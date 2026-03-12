import type { AdsOptimizerObjective } from './overview';
import type {
  AdsOptimizerOutcomeReviewSegmentFilter,
  AdsOptimizerOutcomeReviewSegmentSummary,
  AdsOptimizerOutcomeReviewMetricSummary,
  AdsOptimizerOutcomeReviewPhaseStatus,
  AdsOptimizerOutcomeReviewScore,
  AdsOptimizerOutcomeReviewScoreComponent,
  AdsOptimizerOutcomeReviewTrendPoint,
  AdsOptimizerOutcomeReviewVisibilitySignal,
  AdsOptimizerOutcomeReviewWindowSummary,
  AdsOptimizerOutcomeReviewHorizon,
} from './outcomeReviewTypes';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseDateOnly = (value: string | null | undefined) => {
  if (!value || !DATE_RE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? parsed : null;
};

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);

const addDays = (value: string, delta: number) => {
  const parsed = parseDateOnly(value);
  if (!parsed) return null;
  parsed.setUTCDate(parsed.getUTCDate() + delta);
  return toDateOnly(parsed);
};

const daysBetweenInclusive = (start: string | null, end: string | null) => {
  if (!start || !end) return 0;
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  if (!startDate || !endDate || startDate > endDate) return 0;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
};

const maxDate = (left: string, right: string) => (left > right ? left : right);
const minDate = (left: string, right: string) => (left < right ? left : right);

const emptyMetricSummary = (): AdsOptimizerOutcomeReviewMetricSummary => ({
  contribution_after_ads: null,
  tacos: null,
  ad_spend: 0,
  ad_sales: 0,
  total_sales: 0,
  orders: 0,
});

export const summarizeOutcomeTrendPoints = (
  points: AdsOptimizerOutcomeReviewTrendPoint[]
): AdsOptimizerOutcomeReviewMetricSummary => {
  let contributionAfterAds = 0;
  let contributionSeen = false;
  let adSpend = 0;
  let adSales = 0;
  let totalSales = 0;
  let orders = 0;

  points.forEach((point) => {
    if (point.contribution_after_ads !== null) {
      contributionAfterAds += point.contribution_after_ads;
      contributionSeen = true;
    }
    adSpend += point.ad_spend;
    adSales += point.ad_sales;
    totalSales += point.total_sales;
    orders += point.orders;
  });

  return {
    contribution_after_ads: contributionSeen ? contributionAfterAds : null,
    tacos: totalSales > 0 ? adSpend / totalSales : null,
    ad_spend: adSpend,
    ad_sales: adSales,
    total_sales: totalSales,
    orders,
  };
};

const buildWindowSummary = (args: {
  key: AdsOptimizerOutcomeReviewWindowSummary['key'];
  label: string;
  points: AdsOptimizerOutcomeReviewTrendPoint[];
  startDate: string | null;
  endDate: string | null;
}): AdsOptimizerOutcomeReviewWindowSummary => ({
  key: args.key,
  label: args.label,
  startDate: args.startDate,
  endDate: args.endDate,
  expectedDays: daysBetweenInclusive(args.startDate, args.endDate),
  observedDays: args.points.length,
  metrics: args.points.length > 0 ? summarizeOutcomeTrendPoints(args.points) : emptyMetricSummary(),
  hasData: args.points.length > 0,
});

export const buildAdsOptimizerOutcomeReviewWindowSummaries = (args: {
  trendPoints: AdsOptimizerOutcomeReviewTrendPoint[];
  validatedEffectiveDate: string | null;
  horizon: AdsOptimizerOutcomeReviewHorizon;
  selectedEndDate: string;
  nextPhaseValidatedEffectiveDate: string | null;
}) => {
  const count = Number(args.horizon);
  const validatedDate = args.validatedEffectiveDate;
  if (!validatedDate || !Number.isFinite(count) || count <= 0) {
    return {
      windows: [
        buildWindowSummary({
          key: 'before',
          label: 'Before',
          points: [],
          startDate: null,
          endDate: null,
        }),
        buildWindowSummary({
          key: 'after',
          label: 'After',
          points: [],
          startDate: null,
          endDate: null,
        }),
        buildWindowSummary({
          key: 'latest',
          label: 'Latest',
          points: [],
          startDate: null,
          endDate: null,
        }),
      ],
      postWindowCappedByNextPhase: false,
    };
  }

  const baselineStart = addDays(validatedDate, -count);
  const baselineEnd = addDays(validatedDate, -1);
  const nextPhaseBoundary =
    args.nextPhaseValidatedEffectiveDate && args.nextPhaseValidatedEffectiveDate > validatedDate
      ? addDays(args.nextPhaseValidatedEffectiveDate, -1)
      : null;
  const naturalPostEnd = addDays(validatedDate, count - 1);
  const postEndCandidates = [args.selectedEndDate, naturalPostEnd, nextPhaseBoundary].filter(
    (value): value is string => Boolean(value)
  );
  const postEnd = postEndCandidates.reduce((current, value) => minDate(current, value));
  const postStart = validatedDate;
  const latestEnd = maxDate(args.selectedEndDate, validatedDate);
  const latestStart = addDays(latestEnd, -(count - 1));

  const pickPoints = (startDate: string | null, endDate: string | null) =>
    startDate && endDate
      ? args.trendPoints.filter((point) => point.date >= startDate && point.date <= endDate)
      : [];

  return {
    windows: [
      buildWindowSummary({
        key: 'before',
        label: 'Before',
        points: pickPoints(baselineStart, baselineEnd),
        startDate: baselineStart,
        endDate: baselineEnd,
      }),
      buildWindowSummary({
        key: 'after',
        label: 'After',
        points: pickPoints(postStart, postEnd),
        startDate: postStart,
        endDate: postEnd,
      }),
      buildWindowSummary({
        key: 'latest',
        label: 'Latest',
        points: pickPoints(latestStart, latestEnd),
        startDate: latestStart,
        endDate: latestEnd,
      }),
    ],
    postWindowCappedByNextPhase: Boolean(
      nextPhaseBoundary && naturalPostEnd && nextPhaseBoundary < naturalPostEnd
    ),
  };
};

const metricDirectionScore = (args: {
  before: number | null;
  after: number | null;
  latest: number | null;
  denominatorFloor: number;
  higherIsBetter: boolean;
}) => {
  const compare = (baseline: number | null, observed: number | null) => {
    if (baseline === null || observed === null || !Number.isFinite(baseline) || !Number.isFinite(observed)) {
      return null;
    }
    const denominator = Math.max(Math.abs(baseline), args.denominatorFloor);
    const rawDelta = clamp((observed - baseline) / denominator, -1, 1);
    return clamp(50 + rawDelta * (args.higherIsBetter ? 50 : -50), 0, 100);
  };

  const afterScore = compare(args.before, args.after);
  const latestScore = compare(args.before, args.latest);
  const weighted = [
    { weight: 0.6, value: afterScore },
    { weight: 0.4, value: latestScore },
  ].filter((entry): entry is { weight: number; value: number } => entry.value !== null);

  if (weighted.length === 0) return null;
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  return weighted.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight;
};

const isRankObjective = (value: AdsOptimizerObjective | null) =>
  value === 'Rank Growth' || value === 'Rank Defense';

const downgradeConfidence = (value: 'low' | 'medium' | 'high') => {
  if (value === 'high') return 'medium';
  return 'low';
};

export const buildAdsOptimizerOutcomeReviewVisibilitySignal = (args: {
  beforeKeyword: string | null;
  afterKeyword: string | null;
  latestKeyword: string | null;
  beforeRank: number | null;
  afterRank: number | null;
  latestRank: number | null;
  beforeDetail: string;
  afterDetail: string;
  latestDetail: string;
}): AdsOptimizerOutcomeReviewVisibilitySignal => {
  const sameKeyword =
    args.beforeKeyword &&
    args.afterKeyword &&
    args.latestKeyword &&
    args.beforeKeyword === args.afterKeyword &&
    args.beforeKeyword === args.latestKeyword;

  const available = Boolean(
    sameKeyword &&
      args.beforeRank !== null &&
      args.afterRank !== null &&
      args.latestRank !== null
  );

  return {
    available,
    keyword: sameKeyword ? args.beforeKeyword : null,
    beforeRank: available ? args.beforeRank : null,
    afterRank: available ? args.afterRank : null,
    latestRank: available ? args.latestRank : null,
    detail: available
      ? `Hero query ${args.beforeKeyword} moved from rank ${args.beforeRank} to ${args.afterRank}, latest ${args.latestRank}.`
      : `${args.beforeDetail} ${args.afterDetail} ${args.latestDetail}`.trim(),
  };
};

const buildMetricComponent = (args: {
  id: string;
  label: string;
  weight: number;
  before: number | null;
  after: number | null;
  latest: number | null;
  denominatorFloor: number;
  higherIsBetter: boolean;
}): AdsOptimizerOutcomeReviewScoreComponent => {
  const score = metricDirectionScore({
    before: args.before,
    after: args.after,
    latest: args.latest,
    denominatorFloor: args.denominatorFloor,
    higherIsBetter: args.higherIsBetter,
  });

  return {
    id: args.id,
    label: args.label,
    weight: args.weight,
    score,
    available: score !== null,
    direction: args.higherIsBetter ? 'higher_is_better' : 'lower_is_better',
    detail:
      score === null
        ? `${args.label} was unavailable for at least one required window.`
        : `${args.label} is scored from the before-to-after delta (60%) and before-to-latest delta (40%).`,
  };
};

const buildVisibilityComponent = (args: {
  objective: AdsOptimizerObjective;
  signal: AdsOptimizerOutcomeReviewVisibilitySignal;
  weight: number;
}): AdsOptimizerOutcomeReviewScoreComponent => {
  if (!args.signal.available) {
    return {
      id: 'visibility',
      label: 'Visibility / rank',
      weight: args.weight,
      score: null,
      available: false,
      direction: 'higher_is_better',
      detail: 'Comparable hero-query rank data was unavailable across before, after, and latest windows.',
    };
  }

  const baseline = Math.max(args.signal.beforeRank ?? 0, 1);
  const afterImprovement = clamp(
    ((args.signal.beforeRank ?? baseline) - (args.signal.afterRank ?? baseline)) / baseline,
    -1,
    1
  );
  const latestImprovement = clamp(
    ((args.signal.beforeRank ?? baseline) - (args.signal.latestRank ?? baseline)) / baseline,
    -1,
    1
  );
  let score = clamp(50 + (afterImprovement * 0.6 + latestImprovement * 0.4) * 50, 0, 100);

  if (
    args.objective === 'Rank Defense' &&
    (args.signal.beforeRank ?? 999) <= 16 &&
    (args.signal.afterRank ?? 999) <= 16 &&
    (args.signal.latestRank ?? 999) <= 16
  ) {
    score = Math.max(score, 70);
  }

  return {
    id: 'visibility',
    label: 'Visibility / rank',
    weight: args.weight,
    score,
    available: true,
    direction: 'higher_is_better',
    detail: args.signal.detail,
  };
};

const COMPONENT_WEIGHTS: Record<
  AdsOptimizerObjective,
  Array<{
    id: string;
    label: string;
    weight: number;
    metric?: keyof AdsOptimizerOutcomeReviewMetricSummary;
    higherIsBetter?: boolean;
    denominatorFloor?: number;
    visibility?: boolean;
  }>
> = {
  Recover: [
    { id: 'contribution', label: 'Contribution after ads', weight: 0.4, metric: 'contribution_after_ads', higherIsBetter: true, denominatorFloor: 25 },
    { id: 'tacos', label: 'TACOS', weight: 0.25, metric: 'tacos', higherIsBetter: false, denominatorFloor: 0.02 },
    { id: 'ad_spend', label: 'Ad spend control', weight: 0.2, metric: 'ad_spend', higherIsBetter: false, denominatorFloor: 10 },
    { id: 'orders', label: 'Orders retained', weight: 0.15, metric: 'orders', higherIsBetter: true, denominatorFloor: 1 },
  ],
  'Break Even': [
    { id: 'contribution', label: 'Contribution after ads', weight: 0.4, metric: 'contribution_after_ads', higherIsBetter: true, denominatorFloor: 25 },
    { id: 'tacos', label: 'TACOS', weight: 0.25, metric: 'tacos', higherIsBetter: false, denominatorFloor: 0.02 },
    { id: 'ad_spend', label: 'Ad spend control', weight: 0.2, metric: 'ad_spend', higherIsBetter: false, denominatorFloor: 10 },
    { id: 'orders', label: 'Orders retained', weight: 0.15, metric: 'orders', higherIsBetter: true, denominatorFloor: 1 },
  ],
  'Harvest Profit': [
    { id: 'contribution', label: 'Contribution after ads', weight: 0.35, metric: 'contribution_after_ads', higherIsBetter: true, denominatorFloor: 25 },
    { id: 'total_sales', label: 'Total sales', weight: 0.2, metric: 'total_sales', higherIsBetter: true, denominatorFloor: 25 },
    { id: 'orders', label: 'Orders', weight: 0.2, metric: 'orders', higherIsBetter: true, denominatorFloor: 1 },
    { id: 'tacos', label: 'TACOS', weight: 0.15, metric: 'tacos', higherIsBetter: false, denominatorFloor: 0.02 },
    { id: 'ad_sales', label: 'Ad sales', weight: 0.1, metric: 'ad_sales', higherIsBetter: true, denominatorFloor: 10 },
  ],
  'Scale Profit': [
    { id: 'contribution', label: 'Contribution after ads', weight: 0.35, metric: 'contribution_after_ads', higherIsBetter: true, denominatorFloor: 25 },
    { id: 'total_sales', label: 'Total sales', weight: 0.2, metric: 'total_sales', higherIsBetter: true, denominatorFloor: 25 },
    { id: 'orders', label: 'Orders', weight: 0.2, metric: 'orders', higherIsBetter: true, denominatorFloor: 1 },
    { id: 'tacos', label: 'TACOS', weight: 0.15, metric: 'tacos', higherIsBetter: false, denominatorFloor: 0.02 },
    { id: 'ad_sales', label: 'Ad sales', weight: 0.1, metric: 'ad_sales', higherIsBetter: true, denominatorFloor: 10 },
  ],
  'Rank Growth': [
    { id: 'visibility', label: 'Visibility / rank', weight: 0.3, visibility: true },
    { id: 'contribution', label: 'Contribution after ads', weight: 0.2, metric: 'contribution_after_ads', higherIsBetter: true, denominatorFloor: 25 },
    { id: 'total_sales', label: 'Total sales', weight: 0.15, metric: 'total_sales', higherIsBetter: true, denominatorFloor: 25 },
    { id: 'orders', label: 'Orders', weight: 0.15, metric: 'orders', higherIsBetter: true, denominatorFloor: 1 },
    { id: 'tacos', label: 'TACOS', weight: 0.1, metric: 'tacos', higherIsBetter: false, denominatorFloor: 0.02 },
    { id: 'ad_sales', label: 'Ad sales', weight: 0.1, metric: 'ad_sales', higherIsBetter: true, denominatorFloor: 10 },
  ],
  'Rank Defense': [
    { id: 'visibility', label: 'Visibility / rank', weight: 0.3, visibility: true },
    { id: 'contribution', label: 'Contribution after ads', weight: 0.2, metric: 'contribution_after_ads', higherIsBetter: true, denominatorFloor: 25 },
    { id: 'total_sales', label: 'Total sales', weight: 0.15, metric: 'total_sales', higherIsBetter: true, denominatorFloor: 25 },
    { id: 'orders', label: 'Orders', weight: 0.15, metric: 'orders', higherIsBetter: true, denominatorFloor: 1 },
    { id: 'tacos', label: 'TACOS', weight: 0.1, metric: 'tacos', higherIsBetter: false, denominatorFloor: 0.02 },
    { id: 'ad_sales', label: 'Ad sales', weight: 0.1, metric: 'ad_sales', higherIsBetter: true, denominatorFloor: 10 },
  ],
};

export const scoreAdsOptimizerOutcomeReview = (args: {
  objective: AdsOptimizerObjective | null;
  phaseStatus: AdsOptimizerOutcomeReviewPhaseStatus;
  horizon: AdsOptimizerOutcomeReviewHorizon;
  windows: AdsOptimizerOutcomeReviewWindowSummary[];
  visibilitySignal: AdsOptimizerOutcomeReviewVisibilitySignal;
}): AdsOptimizerOutcomeReviewScore => {
  const beforeWindow = args.windows.find((window) => window.key === 'before') ?? null;
  const afterWindow = args.windows.find((window) => window.key === 'after') ?? null;
  const latestWindow = args.windows.find((window) => window.key === 'latest') ?? null;
  const objective = args.objective;
  const evidenceNotes: string[] = [];

  if (!objective) {
    evidenceNotes.push('No persisted optimizer objective was available for this phase, so the score falls back to neutral handling.');
  }

  const scoringObjective = objective ?? 'Break Even';
  const componentDefs = COMPONENT_WEIGHTS[scoringObjective];
  const components = componentDefs.map((component) => {
    if (component.visibility) {
      return buildVisibilityComponent({
        objective: scoringObjective,
        signal: args.visibilitySignal,
        weight: component.weight,
      });
    }

    return buildMetricComponent({
      id: component.id,
      label: component.label,
      weight: component.weight,
      before: beforeWindow?.metrics[component.metric ?? 'orders'] ?? null,
      after: afterWindow?.metrics[component.metric ?? 'orders'] ?? null,
      latest: latestWindow?.metrics[component.metric ?? 'orders'] ?? null,
      higherIsBetter: component.higherIsBetter ?? true,
      denominatorFloor: component.denominatorFloor ?? 1,
    });
  });

  const weightedComponents = components.filter(
    (component): component is AdsOptimizerOutcomeReviewScoreComponent & { score: number } =>
      component.score !== null
  );
  const totalWeight = weightedComponents.reduce((sum, component) => sum + component.weight, 0);
  const rawScore =
    totalWeight > 0
      ? weightedComponents.reduce((sum, component) => sum + component.score * component.weight, 0) /
        totalWeight
      : 50;

  const minEvidenceDays = Math.max(3, Math.ceil(Number(args.horizon) / 2));
  let confidence: AdsOptimizerOutcomeReviewScore['confidence'] = 'high';
  if (args.phaseStatus !== 'validated') {
    confidence = 'low';
    evidenceNotes.push('Validation is incomplete, so the phase cannot be treated as confirmed yet.');
  }
  if (!beforeWindow?.hasData || !afterWindow?.hasData || !latestWindow?.hasData) {
    confidence = downgradeConfidence(confidence);
    evidenceNotes.push('At least one comparison window is missing KPI coverage.');
  }
  if ((afterWindow?.observedDays ?? 0) < minEvidenceDays || (latestWindow?.observedDays ?? 0) < minEvidenceDays) {
    confidence = 'low';
    evidenceNotes.push(`The post-change evidence window is still thin for a ${args.horizon}-day review horizon.`);
  }
  if (isRankObjective(objective) && !args.visibilitySignal.available) {
    confidence = 'low';
    evidenceNotes.push('Rank-oriented scoring could not use comparable visibility data, so confidence is reduced.');
  }

  let label: AdsOptimizerOutcomeReviewScore['label'];
  if (
    args.phaseStatus !== 'validated' ||
    (afterWindow?.observedDays ?? 0) < minEvidenceDays ||
    !beforeWindow?.hasData ||
    !afterWindow?.hasData
  ) {
    label = 'too_early';
  } else if (isRankObjective(objective) && !args.visibilitySignal.available) {
    label = rawScore >= 60 ? 'improving' : 'mixed';
  } else if (rawScore >= 75 && confidence !== 'low') {
    label = 'confirmed_win';
  } else if (rawScore <= 35 && confidence !== 'low') {
    label = 'confirmed_loss';
  } else if (rawScore >= 60) {
    label = 'improving';
  } else {
    label = 'mixed';
  }

  const roundedScore = Math.round(clamp(rawScore, 0, 100));
  const explanation =
    label === 'too_early'
      ? `This phase does not have enough validated post-change evidence to confirm an outcome yet, so the score stays provisional at ${roundedScore}/100.`
      : label === 'confirmed_win'
        ? `The ${scoringObjective.toLowerCase()} objective is tracking as a confirmed win, with the strongest weighted signals coming from ${weightedComponents
            .sort((left, right) => right.weight - left.weight)
            .slice(0, 2)
            .map((component) => component.label.toLowerCase())
            .join(' and ')}.`
        : label === 'confirmed_loss'
          ? `The weighted before/after/latest evidence points to a confirmed loss against the ${scoringObjective.toLowerCase()} objective.`
          : label === 'improving'
            ? `The weighted evidence is moving in the right direction for the ${scoringObjective.toLowerCase()} objective, but it has not crossed the confirmed threshold yet.`
            : `The evidence is mixed against the ${scoringObjective.toLowerCase()} objective, with meaningful gains and offsets still balancing out.`;

  return {
    score: roundedScore,
    label,
    confidence,
    objectiveUsed: objective,
    explanation,
    evidenceNotes,
    visibilitySignal: args.visibilitySignal,
    components,
  };
};

export const getAdsOptimizerOutcomeReviewSegmentFilterKey = (args: {
  scoreLabel: AdsOptimizerOutcomeReviewScore['label'];
  phaseStatus: AdsOptimizerOutcomeReviewPhaseStatus;
}): Exclude<AdsOptimizerOutcomeReviewSegmentFilter, 'all'> => {
  if (args.scoreLabel === 'too_early' || args.phaseStatus !== 'validated') {
    return 'pending';
  }
  return args.scoreLabel;
};

export const filterAdsOptimizerOutcomeReviewSegments = (
  segments: AdsOptimizerOutcomeReviewSegmentSummary[],
  filter: AdsOptimizerOutcomeReviewSegmentFilter
) => {
  if (filter === 'all') return segments;
  return segments.filter((segment) => segment.filterKey === filter);
};
