import type {
  SbCampaignFactRow,
  SbCampaignPlacementFactRow,
  SbKeywordFactRow,
  SbStisFactRow,
} from "./mappers";

export type SbReportType = "sb_campaign" | "sb_campaign_placement" | "sb_keyword" | "sb_stis";

export function getOnConflictColumns(reportType: SbReportType): string {
  if (reportType === "sb_campaign") {
    return "account_id,upload_id,date,campaign_id";
  }
  if (reportType === "sb_campaign_placement") {
    return "account_id,upload_id,date,campaign_id,placement_code,placement_raw_norm";
  }
  if (reportType === "sb_keyword") {
    return "account_id,upload_id,date,campaign_id,ad_group_id,target_id";
  }
  return "account_id,upload_id,date,campaign_id,ad_group_id,target_key,customer_search_term_norm";
}

export function dedupeFactRows(
  reportType: SbReportType,
  rows:
    | SbCampaignFactRow[]
    | SbCampaignPlacementFactRow[]
    | SbKeywordFactRow[]
    | SbStisFactRow[]
): Record<string, unknown>[] {
  const seen = new Map<string, Record<string, unknown>>();
  for (const row of rows as Record<string, unknown>[]) {
    let key = "";
    if (reportType === "sb_campaign") {
      key = `${row.account_id}::${row.upload_id}::${row.date}::${row.campaign_id}`;
    } else if (reportType === "sb_campaign_placement") {
      key = `${row.account_id}::${row.upload_id}::${row.date}::${row.campaign_id}::${row.placement_code}::${row.placement_raw_norm}`;
    } else if (reportType === "sb_keyword") {
      key = `${row.account_id}::${row.upload_id}::${row.date}::${row.campaign_id}::${row.ad_group_id}::${row.target_id}`;
    } else {
      key = `${row.account_id}::${row.upload_id}::${row.date}::${row.campaign_id}::${row.ad_group_id}::${row.target_key}::${row.customer_search_term_norm}`;
    }
    // last write wins to stay deterministic
    seen.set(key, row);
  }
  return [...seen.values()];
}
