import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

export type DetectedSourceType =
  | "bulk"
  | "sp_campaign"
  | "sp_placement"
  | "sp_targeting"
  | "sp_stis"
  | "sp_advertised_product"
  | "sb_campaign"
  | "sb_campaign_placement"
  | "sb_keyword"
  | "sb_stis"
  | "sb_attributed_purchases"
  | "sd_campaign"
  | "sd_advertised_product"
  | "sd_targeting"
  | "sd_matched_target"
  | "sd_purchased_product"
  | "si_sales_trend"
  | "h10_keyword_tracker"
  | "sqp";

export function detectSourceTypeFromFilename(filename: string): DetectedSourceType | null {
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
  if (/salestrend/i.test(base) && lower.endsWith(".csv")) return "si_sales_trend";

  return null;
}

export function resolveDateFolder(inputPathOrDate: string): string {
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(inputPathOrDate);
  if (!isDate) {
    return inputPathOrDate;
  }

  const root = process.env.AMAZON_REPORTS_ROOT ?? "/mnt/c/Users/User/Dropbox/AmazonReports";
  return path.join(root, inputPathOrDate);
}

export function findBulkXlsx(dateFolder: string): string {
  if (!fs.existsSync(dateFolder)) {
    throw new Error(`Folder not found: ${dateFolder}`);
  }
  const entries = fs.readdirSync(dateFolder, { withFileTypes: true });
  const matches = entries
    .filter((entry) => entry.isFile() && /^bulk-.*\.xlsx$/i.test(entry.name))
    .map((entry) => path.join(dateFolder, entry.name));

  if (!matches.length) {
    throw new Error(`No bulk .xlsx found in ${dateFolder}`);
  }

  if (matches.length === 1) {
    return matches[0];
  }

  const withStats = matches.map((filePath) => ({
    filePath,
    mtimeMs: fs.statSync(filePath).mtimeMs,
  }));
  withStats.sort((a, b) => a.mtimeMs - b.mtimeMs);
  const newest = withStats[withStats.length - 1]?.filePath;

  console.warn(`Multiple bulk files found in ${dateFolder}, selecting newest by mtime:`);
  console.warn(withStats.map((entry) => entry.filePath));

  if (!newest) {
    throw new Error(`Unable to select bulk file in ${dateFolder}`);
  }

  return newest;
}

export function getSpCampaignCsv(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Products_Campaign_report.csv");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Products Campaign report: ${filePath}`);
  }
  return filePath;
}

export function getSpPlacementXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Products_Placement_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Products Placement report: ${filePath}`);
  }
  return filePath;
}

export function getSpAdvertisedProductXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Products_Advertised_product_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Products Advertised Product report: ${filePath}`);
  }
  return filePath;
}

export function getSpTargetingXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Products_Targeting_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Products Targeting report: ${filePath}`);
  }
  return filePath;
}

export function getSpStisCsv(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Products_Search_Term_Impression_Share_report.csv");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Products Search Term Impression Share report: ${filePath}`);
  }
  return filePath;
}

export function getSbCampaignXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Brands_Campaign_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Brands Campaign report: ${filePath}`);
  }
  return filePath;
}

export function getSbCampaignPlacementXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Brands_Campaign_placement_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Brands Campaign Placement report: ${filePath}`);
  }
  return filePath;
}

export function getSbKeywordXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Brands_Keyword_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Brands Keyword report: ${filePath}`);
  }
  return filePath;
}

export function getSbStisCsv(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Brands_Search_Term_Impression_Share_report.csv");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Brands Search Term Impression Share report: ${filePath}`);
  }
  return filePath;
}

export function getSbAttributedPurchasesCsv(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Brands_Attributed_Purchases_report.csv");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Brands Attributed Purchases report: ${filePath}`);
  }
  return filePath;
}

export function getSdCampaignXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Display_Campaign_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Display Campaign report: ${filePath}`);
  }
  return filePath;
}

export function getSdAdvertisedProductXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Display_Advertised_product_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Display Advertised Product report: ${filePath}`);
  }
  return filePath;
}

export function getSdTargetingXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Display_Targeting_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Display Targeting report: ${filePath}`);
  }
  return filePath;
}

export function getSdMatchedTargetXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Display_Matched_target_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Display Matched Target report: ${filePath}`);
  }
  return filePath;
}

export function getSdPurchasedProductXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Display_Purchased_product_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Display Purchased Product report: ${filePath}`);
  }
  return filePath;
}

export function getScaleInsightsSalesTrendCsvFiles(dateFolder: string): string[] {
  if (!fs.existsSync(dateFolder)) {
    throw new Error(`Folder not found: ${dateFolder}`);
  }
  const entries = fs.readdirSync(dateFolder, { withFileTypes: true });
  const matches = entries
    .filter((entry) => entry.isFile() && /salestrend/i.test(entry.name) && entry.name.toLowerCase().endsWith(".csv"))
    .map((entry) => path.join(dateFolder, entry.name));

  if (!matches.length) {
    throw new Error(`No Scale Insights SalesTrend .csv found in ${dateFolder}`);
  }

  matches.sort();
  return matches;
}

export function getSqpCsvFiles(dateFolder: string): string[] {
  if (!fs.existsSync(dateFolder)) {
    throw new Error(`Folder not found: ${dateFolder}`);
  }
  const entries = fs.readdirSync(dateFolder, { withFileTypes: true });
  const matches = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /search_query_performance/i.test(entry.name) &&
        entry.name.toLowerCase().endsWith(".csv")
    )
    .map((entry) => path.join(dateFolder, entry.name));

  if (!matches.length) {
    throw new Error(`No SQP .csv found in ${dateFolder}`);
  }

  matches.sort();
  return matches;
}

export function getHelium10KeywordTrackerCsvFiles(dateFolder: string): string[] {
  if (!fs.existsSync(dateFolder)) {
    throw new Error(`Folder not found: ${dateFolder}`);
  }
  const entries = fs.readdirSync(dateFolder, { withFileTypes: true });
  const matches = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /^helium10-kt-.*\.csv$/i.test(entry.name)
    )
    .map((entry) => path.join(dateFolder, entry.name));

  if (!matches.length) {
    throw new Error(`No Helium10 Keyword Tracker .csv found in ${dateFolder}`);
  }

  matches.sort();
  return matches;
}
