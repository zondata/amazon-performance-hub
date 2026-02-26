export const IMPORT_BATCH_SOURCE_TYPES = [
  "bulk",
  "sp_campaign",
  "sp_placement",
  "sp_targeting",
  "sp_stis",
  "sp_advertised_product",
  "sb_campaign",
  "sb_campaign_placement",
  "sb_keyword",
  "sb_stis",
  "sb_attributed_purchases",
  "sd_campaign",
  "sd_advertised_product",
  "sd_targeting",
  "sd_matched_target",
  "sd_purchased_product",
  "si_sales_trend",
  "h10_keyword_tracker",
  "sqp",
] as const;

export type ImportSourceType = (typeof IMPORT_BATCH_SOURCE_TYPES)[number];

export const DEFAULT_IGNORED_SOURCE_TYPES: ImportSourceType[] = [
  "sd_campaign",
  "sd_advertised_product",
  "sd_targeting",
  "sd_matched_target",
  "sd_purchased_product",
];

const SOURCE_SET = new Set<string>(IMPORT_BATCH_SOURCE_TYPES);

export const isImportSourceType = (value: unknown): value is ImportSourceType =>
  typeof value === "string" && SOURCE_SET.has(value);

export const sanitizeIgnoredSourceTypes = (value: unknown): ImportSourceType[] => {
  if (!Array.isArray(value)) return [...DEFAULT_IGNORED_SOURCE_TYPES];
  const deduped = new Set<ImportSourceType>();
  value.forEach((item) => {
    if (isImportSourceType(item)) deduped.add(item);
  });
  return [...deduped];
};
