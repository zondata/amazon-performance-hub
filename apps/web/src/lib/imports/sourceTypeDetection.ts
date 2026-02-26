import path from "node:path";
import type { ImportSourceType } from "@/lib/imports/sourceTypes";

export const detectImportSourceTypeFromFilename = (
  filename: string
): ImportSourceType | null => {
  const base = path.basename(filename).trim();
  const lower = base.toLowerCase();

  if (/^bulk-.*\.xlsx$/i.test(base)) return "bulk";

  if (lower === "sponsored_products_campaign_report.csv") return "sp_campaign";
  if (lower === "sponsored_products_placement_report.xlsx") return "sp_placement";
  if (lower === "sponsored_products_targeting_report.xlsx") return "sp_targeting";
  if (lower === "sponsored_products_search_term_impression_share_report.csv") return "sp_stis";
  if (lower === "sponsored_products_advertised_product_report.xlsx") return "sp_advertised_product";

  if (lower === "sponsored_brands_campaign_report.xlsx") return "sb_campaign";
  if (lower === "sponsored_brands_campaign_placement_report.xlsx") return "sb_campaign_placement";
  if (lower === "sponsored_brands_keyword_report.xlsx") return "sb_keyword";
  if (lower === "sponsored_brands_search_term_impression_share_report.csv") return "sb_stis";
  if (lower === "sponsored_brands_attributed_purchases_report.csv") return "sb_attributed_purchases";

  if (lower === "sponsored_display_campaign_report.xlsx") return "sd_campaign";
  if (lower === "sponsored_display_advertised_product_report.xlsx") return "sd_advertised_product";
  if (lower === "sponsored_display_targeting_report.xlsx") return "sd_targeting";
  if (lower === "sponsored_display_matched_target_report.xlsx") return "sd_matched_target";
  if (lower === "sponsored_display_purchased_product_report.xlsx") return "sd_purchased_product";

  if (/^helium10-kt-.*\.csv$/i.test(base)) return "h10_keyword_tracker";
  if (/search_query_performance/i.test(base) && lower.endsWith(".csv")) return "sqp";
  if (/sales\s*trend/i.test(base) && lower.endsWith(".csv")) return "si_sales_trend";

  return null;
};
