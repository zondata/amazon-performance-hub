export type PlacementChannel = "sp" | "sb";

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
