export type PlacementChannel = "sp" | "sb";
export type PlacementSpendReconciliationStatus =
  | "ok"
  | "scaled_to_campaign_total"
  | "missing_reported_spend"
  | "mismatch";

export type PlacementSpendReconciliation = {
  status: PlacementSpendReconciliationStatus;
  campaign_spend: number;
  campaign_clicks: number;
  campaign_sales: number;
  placement_spend_reported_sum: number;
  placement_clicks_sum: number;
  placement_sales_sum: number;
  spend_gap_reported: number;
  spend_ratio_reported: number | null;
  clicks_ratio: number | null;
  sales_ratio: number | null;
  spend_scale_factor: number | null;
};

const toFinite = (value: number): number => (Number.isFinite(value) ? value : 0);

export const safeDivide = (numerator: number, denominator: number): number | null => {
  const safeDenominator = toFinite(denominator);
  if (safeDenominator <= 0) return null;
  return toFinite(numerator) / safeDenominator;
};

export const calcCtr = (clicks: number, impressions: number): number | null =>
  safeDivide(clicks, impressions);

export const calcCvrOrdersPerClick = (orders: number, clicks: number): number | null =>
  safeDivide(orders, clicks);

export const calcCpc = (spend: number, clicks: number): number | null => safeDivide(spend, clicks);

export const calcAcos = (spend: number, sales: number): number | null => safeDivide(spend, sales);

export const calcRoas = (spend: number, sales: number): number | null => safeDivide(sales, spend);

const SPEND_ABS_TOLERANCE = 0.01;
const SPEND_REL_TOLERANCE = 0.01;
const RATIO_ALIGN_TOLERANCE = 0.05;

const ratiosAligned = (ratio: number | null): boolean => {
  if (ratio === null) return false;
  return Math.abs(1 - ratio) <= RATIO_ALIGN_TOLERANCE;
};

const spendMatches = (campaignSpend: number, placementSpend: number): boolean => {
  const gap = Math.abs(campaignSpend - placementSpend);
  if (gap <= SPEND_ABS_TOLERANCE) return true;
  const base = Math.max(Math.abs(campaignSpend), SPEND_ABS_TOLERANCE);
  return gap / base <= SPEND_REL_TOLERANCE;
};

export const derivePlacementSpendReconciliation = (input: {
  campaignSpend: number;
  campaignClicks: number;
  campaignSales: number;
  placementSpendReportedSum: number;
  placementClicksSum: number;
  placementSalesSum: number;
}): PlacementSpendReconciliation => {
  const campaignSpend = toFinite(input.campaignSpend);
  const campaignClicks = toFinite(input.campaignClicks);
  const campaignSales = toFinite(input.campaignSales);
  const placementSpendReportedSum = toFinite(input.placementSpendReportedSum);
  const placementClicksSum = toFinite(input.placementClicksSum);
  const placementSalesSum = toFinite(input.placementSalesSum);

  const spendGapReported = campaignSpend - placementSpendReportedSum;
  const spendRatioReported = safeDivide(placementSpendReportedSum, campaignSpend);
  const clicksRatio = safeDivide(placementClicksSum, campaignClicks);
  const salesRatio = safeDivide(placementSalesSum, campaignSales);

  let status: PlacementSpendReconciliationStatus = "mismatch";
  let spendScaleFactor: number | null = null;

  const campaignHasSpend = campaignSpend > SPEND_ABS_TOLERANCE;
  const placementHasSpend = placementSpendReportedSum > SPEND_ABS_TOLERANCE;
  const clickAligned = ratiosAligned(clicksRatio);
  const isSpendOk = spendMatches(campaignSpend, placementSpendReportedSum);

  if (isSpendOk) {
    status = "ok";
    spendScaleFactor = 1;
  } else if (campaignHasSpend && !placementHasSpend) {
    status = "missing_reported_spend";
  } else if (clickAligned && campaignHasSpend && placementHasSpend) {
    status = "scaled_to_campaign_total";
    spendScaleFactor = campaignSpend / placementSpendReportedSum;
  } else {
    status = "mismatch";
  }

  return {
    status,
    campaign_spend: campaignSpend,
    campaign_clicks: campaignClicks,
    campaign_sales: campaignSales,
    placement_spend_reported_sum: placementSpendReportedSum,
    placement_clicks_sum: placementClicksSum,
    placement_sales_sum: placementSalesSum,
    spend_gap_reported: spendGapReported,
    spend_ratio_reported: spendRatioReported,
    clicks_ratio: clicksRatio,
    sales_ratio: salesRatio,
    spend_scale_factor: spendScaleFactor,
  };
};

export const weightedAvgTosIs = (
  rows: Array<{ impressions: number; share: number | null }>
): number | null => {
  let weightedSum = 0;
  let impressionSum = 0;
  for (const row of rows) {
    if (row.share === null) continue;
    const impressions = toFinite(row.impressions);
    const share = toFinite(row.share);
    if (impressions <= 0) continue;
    weightedSum += impressions * share;
    impressionSum += impressions;
  }
  return impressionSum > 0 ? weightedSum / impressionSum : null;
};

const normalizeCode = (placementCode: string | null | undefined): string =>
  String(placementCode ?? "")
    .trim()
    .toUpperCase();

const normalizeRawNorm = (placementRawNorm: string | null | undefined): string =>
  String(placementRawNorm ?? "")
    .trim()
    .toLowerCase();

export const mapPlacementModifierKey = (
  channel: PlacementChannel,
  placementCode: string | null | undefined,
  placementRawNorm: string | null | undefined
): string | null => {
  const code = normalizeCode(placementCode);
  const rawNorm = normalizeRawNorm(placementRawNorm);

  if (channel === "sp") {
    if (rawNorm.includes("amazon business") || code === "PLACEMENT_AMAZON_BUSINESS") {
      return "PLACEMENT_AMAZON_BUSINESS";
    }
    if (code === "TOS" || code === "PLACEMENT_TOP" || rawNorm.includes("top of search")) {
      return "PLACEMENT_TOP";
    }
    if (
      code === "ROS" ||
      code === "PLACEMENT_REST_OF_SEARCH" ||
      rawNorm.includes("rest of search")
    ) {
      return "PLACEMENT_REST_OF_SEARCH";
    }
    if (code === "PP" || code === "PLACEMENT_PRODUCT_PAGE" || rawNorm.includes("product page")) {
      return "PLACEMENT_PRODUCT_PAGE";
    }
    if (code === "OA" || rawNorm.includes("off-amazon") || rawNorm.includes("off amazon")) {
      return null;
    }
    return null;
  }

  if (rawNorm.includes("top of search") || code === "TOS") {
    return "TOS";
  }
  if (
    rawNorm.includes("product pages") ||
    rawNorm.includes("detail page") ||
    code === "PP" ||
    code === "DETAIL_PAGE"
  ) {
    return "DETAIL_PAGE";
  }
  if (rawNorm.includes("home") || code === "HOME") {
    return "HOME";
  }
  return "OTHER";
};
