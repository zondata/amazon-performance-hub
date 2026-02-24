type SpendRow = {
  spend: number;
};

type CampaignSpendRow = SpendRow & {
  campaign_id: string;
};

type TargetSpendRow = SpendRow & {
  campaign_id: string;
};

export type SpCoverageSelectionInput<TCampaign extends CampaignSpendRow, TTarget extends TargetSpendRow> = {
  mappedSpendTotal: number;
  campaignRows: TCampaign[];
  targetRows: TTarget[];
  campaignLimit?: number;
  targetLimit?: number;
  coverageThreshold?: number;
};

export type SpCoverageSelectionResult<TCampaign extends CampaignSpendRow, TTarget extends TargetSpendRow> = {
  campaigns: TCampaign[];
  targets: TTarget[];
  campaignIncludedSpend: number;
  targetIncludedSpend: number;
  includedSpendTotal: number;
  coveragePct: number | null;
};

const sortBySpendDesc = <T extends SpendRow>(rows: T[]): T[] =>
  [...rows].sort((left, right) => right.spend - left.spend);

const sumSpend = <T extends SpendRow>(rows: T[]): number =>
  rows.reduce((total, row) => total + row.spend, 0);

const selectUntilCoverage = <T extends SpendRow>(
  rows: T[],
  limit: number,
  requiredSpend: number
): { rows: T[]; spend: number } => {
  const selected: T[] = [];
  let spend = 0;
  for (const row of rows) {
    if (selected.length >= limit) break;
    selected.push(row);
    spend += row.spend;
    if (requiredSpend > 0 && spend >= requiredSpend) break;
  }
  return { rows: selected, spend };
};

export const selectSpRowsForCoverage = <
  TCampaign extends CampaignSpendRow,
  TTarget extends TargetSpendRow,
>(
  input: SpCoverageSelectionInput<TCampaign, TTarget>
): SpCoverageSelectionResult<TCampaign, TTarget> => {
  const campaignLimit = input.campaignLimit ?? 50;
  const targetLimit = input.targetLimit ?? 500;
  const coverageThreshold = input.coverageThreshold ?? 0.95;

  const mappedSpendTotal = Number.isFinite(input.mappedSpendTotal) ? Math.max(0, input.mappedSpendTotal) : 0;
  const requiredSpend = mappedSpendTotal * coverageThreshold;

  const campaignRowsSorted = sortBySpendDesc(input.campaignRows);
  const targetRowsSorted = sortBySpendDesc(input.targetRows);

  const selectedCampaigns = selectUntilCoverage(campaignRowsSorted, campaignLimit, requiredSpend);
  const selectedCampaignIds = new Set(selectedCampaigns.rows.map((row) => row.campaign_id));

  const targetRowsWithinCampaigns =
    selectedCampaignIds.size > 0
      ? targetRowsSorted.filter((row) => selectedCampaignIds.has(row.campaign_id))
      : targetRowsSorted;
  const selectedTargets = selectUntilCoverage(targetRowsWithinCampaigns, targetLimit, requiredSpend);

  const includedSpendTotal =
    selectedTargets.rows.length > 0 ? selectedTargets.spend : selectedCampaigns.spend;
  const coveragePct = mappedSpendTotal > 0 ? includedSpendTotal / mappedSpendTotal : null;

  return {
    campaigns: selectedCampaigns.rows,
    targets: selectedTargets.rows,
    campaignIncludedSpend: selectedCampaigns.spend,
    targetIncludedSpend: selectedTargets.spend,
    includedSpendTotal,
    coveragePct,
  };
};

export const sumSpSpend = sumSpend;
