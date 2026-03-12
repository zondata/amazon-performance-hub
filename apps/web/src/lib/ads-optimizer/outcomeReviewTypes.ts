import type { AdsOptimizerObjective } from './overview';
import type { AdsOptimizerArchetype, JsonObject } from './types';

export const ADS_OPTIMIZER_OUTCOME_REVIEW_HORIZONS = ['3', '7', '14', '30'] as const;

export const ADS_OPTIMIZER_OUTCOME_REVIEW_METRICS = [
  'contribution_after_ads',
  'tacos',
  'ad_spend',
  'ad_sales',
  'total_sales',
  'orders',
] as const;

export type AdsOptimizerOutcomeReviewHorizon =
  (typeof ADS_OPTIMIZER_OUTCOME_REVIEW_HORIZONS)[number];

export type AdsOptimizerOutcomeReviewMetric =
  (typeof ADS_OPTIMIZER_OUTCOME_REVIEW_METRICS)[number];

export type AdsOptimizerOutcomeReviewValidationSummary = {
  validated: number;
  mismatch: number;
  pending: number;
  notFound: number;
  total: number;
};

export type AdsOptimizerOutcomeReviewPhaseStatus =
  | 'pending'
  | 'partial'
  | 'validated'
  | 'mixed_validation';

export type AdsOptimizerOutcomeReviewPhaseSummary = {
  changeSetId: string;
  changeSetName: string;
  optimizerRunId: string | null;
  selectedAsin: string | null;
  stagedActionCount: number;
  targetCount: number;
  validationSummary: AdsOptimizerOutcomeReviewValidationSummary;
  firstValidatedDate: string | null;
  validatedEffectiveDate: string | null;
  status: AdsOptimizerOutcomeReviewPhaseStatus;
  createdAt: string;
  generatedRunId: string | null;
};

export type AdsOptimizerOutcomeReviewTrendPoint = {
  date: string;
  contribution_after_ads: number | null;
  tacos: number | null;
  ad_spend: number;
  ad_sales: number;
  total_sales: number;
  orders: number;
};

export type AdsOptimizerOutcomeReviewMetricSummary = {
  contribution_after_ads: number | null;
  tacos: number | null;
  ad_spend: number;
  ad_sales: number;
  total_sales: number;
  orders: number;
};

export type AdsOptimizerOutcomeReviewData = {
  asin: string;
  start: string;
  end: string;
  horizon: AdsOptimizerOutcomeReviewHorizon;
  metric: AdsOptimizerOutcomeReviewMetric;
  trendPoints: AdsOptimizerOutcomeReviewTrendPoint[];
  displayedTrendPoints: AdsOptimizerOutcomeReviewTrendPoint[];
  displayedSummary: AdsOptimizerOutcomeReviewMetricSummary;
  phases: AdsOptimizerOutcomeReviewPhaseSummary[];
  phaseCount: number;
  validatedPhaseCount: number;
  pendingPhaseCount: number;
  stagedActionCount: number;
  segments: AdsOptimizerOutcomeReviewSegmentSummary[];
};

export type AdsOptimizerOutcomeReviewScoreLabel =
  | 'too_early'
  | 'improving'
  | 'mixed'
  | 'confirmed_win'
  | 'confirmed_loss';

export type AdsOptimizerOutcomeReviewScoreConfidence = 'low' | 'medium' | 'high';

export type AdsOptimizerOutcomeReviewSegmentFilter =
  | 'all'
  | 'pending'
  | 'improving'
  | 'mixed'
  | 'confirmed_win'
  | 'confirmed_loss';

export type AdsOptimizerOutcomeReviewWindowKey = 'before' | 'after' | 'latest';

export type AdsOptimizerOutcomeReviewWindowSummary = {
  key: AdsOptimizerOutcomeReviewWindowKey;
  label: string;
  startDate: string | null;
  endDate: string | null;
  expectedDays: number;
  observedDays: number;
  metrics: AdsOptimizerOutcomeReviewMetricSummary;
  hasData: boolean;
};

export type AdsOptimizerOutcomeReviewStagedChange = {
  itemId: string;
  actionType: string;
  entityLevel: string;
  entityKey: string;
  campaignId: string | null;
  adGroupId: string | null;
  targetId: string | null;
  targetKey: string | null;
  placementCode: string | null;
  summary: string;
  beforeLabel: string;
  afterLabel: string;
  objective: string | null;
  hypothesis: string | null;
  notes: string | null;
  uiContextJson: JsonObject | null;
  beforeJson: JsonObject;
  afterJson: JsonObject;
};

export type AdsOptimizerOutcomeReviewObjectiveSnapshot = {
  value: AdsOptimizerObjective | null;
  reason: string | null;
  source: 'optimizer_product_snapshot' | 'change_set_objective' | 'current_overview' | 'unavailable';
  runId: string | null;
  windowStart: string | null;
  windowEnd: string | null;
};

export type AdsOptimizerOutcomeReviewObjectiveContext = {
  archetype: AdsOptimizerArchetype | null;
  atChange: AdsOptimizerOutcomeReviewObjectiveSnapshot;
  latest: AdsOptimizerOutcomeReviewObjectiveSnapshot;
  changedSincePhase: boolean;
};

export type AdsOptimizerOutcomeReviewVisibilitySignal = {
  available: boolean;
  keyword: string | null;
  beforeRank: number | null;
  afterRank: number | null;
  latestRank: number | null;
  detail: string;
};

export type AdsOptimizerOutcomeReviewScoreComponent = {
  id: string;
  label: string;
  weight: number;
  score: number | null;
  available: boolean;
  direction: 'higher_is_better' | 'lower_is_better';
  detail: string;
};

export type AdsOptimizerOutcomeReviewScore = {
  score: number;
  label: AdsOptimizerOutcomeReviewScoreLabel;
  confidence: AdsOptimizerOutcomeReviewScoreConfidence;
  objectiveUsed: AdsOptimizerObjective | null;
  explanation: string;
  evidenceNotes: string[];
  visibilitySignal: AdsOptimizerOutcomeReviewVisibilitySignal;
  components: AdsOptimizerOutcomeReviewScoreComponent[];
};

export type AdsOptimizerOutcomeReviewSegmentCautionId =
  | 'objective_changed_mid_segment'
  | 'phase_landed_too_soon'
  | 'validation_incomplete'
  | 'kpi_coverage_incomplete';

export type AdsOptimizerOutcomeReviewSegmentCaution = {
  id: AdsOptimizerOutcomeReviewSegmentCautionId;
  label: string;
};

export type AdsOptimizerOutcomeReviewSegmentSummary = {
  segmentId: string;
  phaseChangeSetId: string;
  segmentOrdinal: number;
  segmentLabel: string;
  segmentDateWindowLabel: string;
  segmentStartLabel: string;
  segmentEndLabel: string;
  segmentStartDate: string | null;
  segmentEndDate: string | null;
  objectiveAtChange: AdsOptimizerObjective | null;
  latestObjective: AdsOptimizerObjective | null;
  objectiveChangedMidSegment: boolean;
  objectiveContextLabel: string;
  score: number;
  scoreLabel: AdsOptimizerOutcomeReviewScoreLabel;
  confidence: AdsOptimizerOutcomeReviewScoreConfidence;
  shortKpiSummary: string;
  cautions: AdsOptimizerOutcomeReviewSegmentCaution[];
  filterKey: Exclude<AdsOptimizerOutcomeReviewSegmentFilter, 'all'>;
  detailHref: string;
  hasMarker: boolean;
  validatedEffectiveDate: string | null;
  phaseStatus: AdsOptimizerOutcomeReviewPhaseStatus;
};

export type AdsOptimizerOutcomeReviewDetailReadyData = {
  kind: 'ready';
  changeSetId: string;
  changeSetName: string;
  asin: string;
  selectedEndDate: string;
  horizon: AdsOptimizerOutcomeReviewHorizon;
  phase: AdsOptimizerOutcomeReviewPhaseSummary;
  stagedChanges: AdsOptimizerOutcomeReviewStagedChange[];
  reviewOnlyNotes: string[];
  objectiveContext: AdsOptimizerOutcomeReviewObjectiveContext;
  windows: AdsOptimizerOutcomeReviewWindowSummary[];
  score: AdsOptimizerOutcomeReviewScore;
  latestValidationDate: string | null;
  nextPhaseValidatedEffectiveDate: string | null;
  postWindowCappedByNextPhase: boolean;
  runId: string | null;
  returnHref: string;
};

export type AdsOptimizerOutcomeReviewDetailData =
  | AdsOptimizerOutcomeReviewDetailReadyData
  | {
      kind: 'not_optimizer';
      changeSetId: string;
      changeSetName: string | null;
      source: string | null;
      returnHref: string;
    };

export const ADS_OPTIMIZER_OUTCOME_REVIEW_METRIC_LABELS: Record<
  AdsOptimizerOutcomeReviewMetric,
  string
> = {
  contribution_after_ads: 'Contribution after ads',
  tacos: 'TACOS',
  ad_spend: 'Ad spend',
  ad_sales: 'Ad sales',
  total_sales: 'Total sales',
  orders: 'Orders',
};
