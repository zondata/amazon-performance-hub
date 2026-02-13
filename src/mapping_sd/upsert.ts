import type {
  SdCampaignFactRow,
  SdAdvertisedProductFactRow,
  SdTargetingFactRow,
  SdMatchedTargetFactRow,
  SdPurchasedProductFactRow,
} from "./mappers";

export type SdReportType =
  | "sd_campaign"
  | "sd_advertised_product"
  | "sd_targeting"
  | "sd_matched_target"
  | "sd_purchased_product";

export function getOnConflictColumns(reportType: SdReportType): string {
  if (reportType === "sd_campaign") {
    return "account_id,upload_id,date,campaign_id,cost_type";
  }
  if (reportType === "sd_advertised_product") {
    return "account_id,upload_id,date,campaign_id,ad_group_id,ad_key,cost_type";
  }
  if (reportType === "sd_targeting") {
    return "account_id,upload_id,date,campaign_id,ad_group_id,target_key,cost_type";
  }
  if (reportType === "sd_matched_target") {
    return "account_id,upload_id,date,campaign_id,ad_group_id,target_key,matched_target_norm,cost_type";
  }
  return "account_id,upload_id,date,campaign_id,ad_group_id,ad_key,purchased_sku_norm,purchased_asin_norm,cost_type";
}

export function dedupeFactRows(
  reportType: SdReportType,
  rows:
    | SdCampaignFactRow[]
    | SdAdvertisedProductFactRow[]
    | SdTargetingFactRow[]
    | SdMatchedTargetFactRow[]
    | SdPurchasedProductFactRow[]
): Record<string, unknown>[] {
  const seen = new Map<string, Record<string, unknown>>();
  for (const row of rows as Record<string, unknown>[]) {
    let key = "";
    if (reportType === "sd_campaign") {
      key = `${row.account_id}::${row.upload_id}::${row.date}::${row.campaign_id}::${row.cost_type ?? ""}`;
    } else if (reportType === "sd_advertised_product") {
      key = `${row.account_id}::${row.upload_id}::${row.date}::${row.campaign_id}::${row.ad_group_id}::${row.ad_key}::${row.cost_type ?? ""}`;
    } else if (reportType === "sd_targeting") {
      key = `${row.account_id}::${row.upload_id}::${row.date}::${row.campaign_id}::${row.ad_group_id}::${row.target_key}::${row.cost_type ?? ""}`;
    } else if (reportType === "sd_matched_target") {
      key = `${row.account_id}::${row.upload_id}::${row.date}::${row.campaign_id}::${row.ad_group_id}::${row.target_key}::${row.matched_target_norm}::${row.cost_type ?? ""}`;
    } else {
      key = `${row.account_id}::${row.upload_id}::${row.date}::${row.campaign_id}::${row.ad_group_id}::${row.ad_key}::${row.purchased_sku_norm ?? ""}::${row.purchased_asin_norm ?? ""}::${row.cost_type ?? ""}`;
    }
    seen.set(key, row);
  }
  return [...seen.values()];
}
