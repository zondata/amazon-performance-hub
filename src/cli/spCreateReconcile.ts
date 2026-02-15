import fs from "node:fs";
import { getSupabaseClient } from "../db/supabaseClient";
import { normText } from "../bulk/parseSponsoredProductsBulk";
import { SpCreateManifest } from "../bulksheet_gen_sp_create/manifest";

function usage() {
  console.log(
    "Usage: npm run sp:create:reconcile -- --account-id <id> --snapshot-date YYYY-MM-DD --manifest <json>"
  );
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

type BulkCampaignRow = {
  campaign_id: string;
  campaign_name_raw: string;
  campaign_name_norm: string;
};

type BulkAdGroupRow = {
  ad_group_id: string;
  ad_group_name_raw: string;
  ad_group_name_norm: string;
  campaign_id: string;
};

type BulkTargetRow = {
  target_id: string;
  ad_group_id: string;
  expression_norm: string;
  match_type: string;
};

async function fetchBulkRows(params: {
  accountId: string;
  snapshotDate: string;
}) {
  const client = getSupabaseClient();
  const { data: campaigns, error: campErr } = await client
    .from("bulk_campaigns")
    .select("campaign_id,campaign_name_raw,campaign_name_norm")
    .eq("account_id", params.accountId)
    .eq("snapshot_date", params.snapshotDate);
  if (campErr) throw new Error(`Failed fetching bulk_campaigns: ${campErr.message}`);

  const { data: adGroups, error: adErr } = await client
    .from("bulk_ad_groups")
    .select("ad_group_id,ad_group_name_raw,ad_group_name_norm,campaign_id")
    .eq("account_id", params.accountId)
    .eq("snapshot_date", params.snapshotDate);
  if (adErr) throw new Error(`Failed fetching bulk_ad_groups: ${adErr.message}`);

  const { data: targets, error: targetErr } = await client
    .from("bulk_targets")
    .select("target_id,ad_group_id,expression_norm,match_type")
    .eq("account_id", params.accountId)
    .eq("snapshot_date", params.snapshotDate);
  if (targetErr) throw new Error(`Failed fetching bulk_targets: ${targetErr.message}`);

  return {
    campaigns: (campaigns ?? []) as BulkCampaignRow[],
    adGroups: (adGroups ?? []) as BulkAdGroupRow[],
    targets: (targets ?? []) as BulkTargetRow[],
  };
}

async function main() {
  const accountId = getArg("--account-id");
  const snapshotDate = getArg("--snapshot-date");
  const manifestPath = getArg("--manifest");

  if (!accountId || !snapshotDate || !manifestPath) {
    usage();
    process.exit(1);
  }

  const manifestRaw = fs.readFileSync(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw) as SpCreateManifest;

  const { campaigns, adGroups, targets } = await fetchBulkRows({
    accountId,
    snapshotDate,
  });

  const campaignByNorm = new Map<string, BulkCampaignRow>();
  for (const campaign of campaigns) {
    campaignByNorm.set(campaign.campaign_name_norm, campaign);
  }

  const adGroupByKey = new Map<string, BulkAdGroupRow>();
  for (const adGroup of adGroups) {
    const key = `${adGroup.campaign_id}::${adGroup.ad_group_name_norm}`;
    adGroupByKey.set(key, adGroup);
  }

  console.log("Reconcile campaigns:");
  for (const campaign of manifest.campaigns) {
    const norm = normText(campaign.name);
    const match = campaignByNorm.get(norm);
    console.log({
      campaign_name: campaign.name,
      campaign_id: match?.campaign_id ?? null,
    });
  }

  console.log("Reconcile ad groups:");
  for (const adGroup of manifest.ad_groups) {
    const campaign = campaignByNorm.get(normText(adGroup.campaign_name));
    const key = campaign ? `${campaign.campaign_id}::${normText(adGroup.ad_group_name)}` : "";
    const match = key ? adGroupByKey.get(key) : null;
    console.log({
      campaign_name: adGroup.campaign_name,
      ad_group_name: adGroup.ad_group_name,
      ad_group_id: match?.ad_group_id ?? null,
    });
  }

  console.log("Reconcile keywords:");
  for (const keyword of manifest.keywords) {
    const campaign = campaignByNorm.get(normText(keyword.campaign_name));
    const adGroupKey = campaign
      ? `${campaign.campaign_id}::${normText(keyword.ad_group_name)}`
      : "";
    const adGroup = adGroupKey ? adGroupByKey.get(adGroupKey) : null;
    const match = adGroup
      ? targets.find(
          (target) =>
            target.ad_group_id === adGroup.ad_group_id &&
            target.expression_norm === normText(keyword.keyword_text) &&
            target.match_type === keyword.match_type
        )
      : null;
    console.log({
      keyword_text: keyword.keyword_text,
      match_type: keyword.match_type,
      target_id: match?.target_id ?? null,
    });
  }

  if (manifest.product_ads.length > 0) {
    console.log("Product ads reconciliation not implemented (no bulk product ad table).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
