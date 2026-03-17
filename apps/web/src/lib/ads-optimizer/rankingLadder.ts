import type { ProductRankingRow } from '@/lib/ranking/getProductRankingDaily';

export const ADS_OPTIMIZER_RANKING_PAGE_SIZE = 45;

export const ADS_OPTIMIZER_RANKING_LADDER_BUCKETS = [
  { label: '1-2', min: 1, max: 2 },
  { label: '3-5', min: 3, max: 5 },
  { label: '6-10', min: 6, max: 10 },
  { label: '11-20', min: 11, max: 20 },
  { label: '21-45', min: 21, max: 45 },
  { label: 'Page 2', min: 46, max: 90 },
  { label: 'Page 3', min: 91, max: 135 },
  { label: 'Page 4', min: 136, max: 180 },
  { label: 'Page 5', min: 181, max: 225 },
  { label: 'Page 6', min: 226, max: 270 },
  { label: 'Page 7', min: 271, max: 306 },
  { label: 'Beyond tracked range', min: 307, max: null },
] as const;

export type AdsOptimizerRankingLadderBandLabel =
  (typeof ADS_OPTIMIZER_RANKING_LADDER_BUCKETS)[number]['label'];

type AdsOptimizerRankingLadderCoverageStatus = 'ready' | 'partial' | 'missing';

type AdsOptimizerRankingLadderCounts = {
  trackedKeywords: number;
  latestObservedDate: string | null;
  status: AdsOptimizerRankingLadderCoverageStatus;
  counts: Record<AdsOptimizerRankingLadderBandLabel, number>;
};

export const classifyAdsOptimizerRankingLadderBand = (
  rank: number | null
): AdsOptimizerRankingLadderBandLabel | null => {
  if (rank === null || !Number.isFinite(rank) || rank < 1) return null;
  const bucket = ADS_OPTIMIZER_RANKING_LADDER_BUCKETS.find(
    (entry) => rank >= entry.min && (entry.max === null || rank <= entry.max)
  );
  return bucket?.label ?? null;
};

const createEmptyCounts = (): Record<AdsOptimizerRankingLadderBandLabel, number> =>
  Object.fromEntries(
    ADS_OPTIMIZER_RANKING_LADDER_BUCKETS.map((bucket) => [bucket.label, 0])
  ) as Record<AdsOptimizerRankingLadderBandLabel, number>;

const summarizeLatestRankingBucketCounts = (
  rows: ProductRankingRow[]
): AdsOptimizerRankingLadderCounts => {
  const counts = createEmptyCounts();
  if (rows.length === 0) {
    return {
      trackedKeywords: 0,
      latestObservedDate: null,
      status: 'missing',
      counts,
    };
  }

  const latestByKeyword = new Map<string, ProductRankingRow>();
  rows.forEach((row) => {
    const keyword = row.keyword_norm ?? row.keyword_raw ?? null;
    if (!keyword) return;
    const existing = latestByKeyword.get(keyword);
    const existingDate = existing?.observed_date ?? '';
    const nextDate = row.observed_date ?? '';
    if (!existing || nextDate > existingDate) {
      latestByKeyword.set(keyword, row);
    }
  });

  let trackedKeywords = 0;
  let latestObservedDate: string | null = null;
  latestByKeyword.forEach((row) => {
    const band = classifyAdsOptimizerRankingLadderBand(row.organic_rank_value);
    if (!band) return;
    trackedKeywords += 1;
    latestObservedDate =
      latestObservedDate === null || String(row.observed_date ?? '') > latestObservedDate
        ? row.observed_date ?? latestObservedDate
        : latestObservedDate;
    counts[band] += 1;
  });

  return {
    trackedKeywords,
    latestObservedDate,
    status:
      trackedKeywords === 0 ? 'missing' : trackedKeywords >= 3 ? 'ready' : 'partial',
    counts,
  };
};

export const buildAdsOptimizerRankingLadder = (args: {
  currentRows: ProductRankingRow[];
  previousRows?: ProductRankingRow[];
}) => {
  const current = summarizeLatestRankingBucketCounts(args.currentRows);
  const previous = summarizeLatestRankingBucketCounts(args.previousRows ?? []);
  const hasPreviousComparison = previous.trackedKeywords > 0;
  const status: AdsOptimizerRankingLadderCoverageStatus =
    current.status === 'missing'
      ? 'missing'
      : current.status === 'partial' ||
          previous.status === 'partial' ||
          previous.status === 'missing'
        ? 'partial'
        : 'ready';

  return {
    status,
    trackedKeywords: current.trackedKeywords,
    latestObservedDate: current.latestObservedDate,
    detail:
      current.trackedKeywords === 0
        ? 'Ranking rows existed, but none had a latest organic rank available for ladder classification.'
        : hasPreviousComparison
          ? `Latest observed ranking ladder classified ${current.trackedKeywords} keyword(s) and compares signed bucket counts versus the equal-length previous window without averaging rank.`
          : `Latest observed ranking ladder classified ${current.trackedKeywords} keyword(s). Signed bucket deltas are unavailable because the equal-length previous window has no comparable ranking coverage.`,
    bands: ADS_OPTIMIZER_RANKING_LADDER_BUCKETS.map((bucket) => ({
      label: bucket.label,
      currentCount: current.counts[bucket.label],
      deltaCount: hasPreviousComparison
        ? current.counts[bucket.label] - previous.counts[bucket.label]
        : null,
    })),
  };
};
