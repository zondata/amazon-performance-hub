import { parseAsinFromFilename } from "../sales/parseScaleInsightsSalesTrend";

export type SalesTrendManifestItem = {
  original_filename?: string;
  asin_override?: string;
};

export function resolveSalesTrendAsinOverrideFromManifestItem(
  item: SalesTrendManifestItem
): string | undefined {
  const override = (item.asin_override ?? "").trim().toUpperCase();
  if (override) return override;
  return parseAsinFromFilename(item.original_filename ?? "") ?? undefined;
}
