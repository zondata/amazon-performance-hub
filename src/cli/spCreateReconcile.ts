import fs from "node:fs";
import { SpCreateManifest } from "../bulksheet_gen_sp_create/manifest";
import { reconcileWithSnapshot } from "../bulksheet_gen_sp_create/reconcile";

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

  const result = await reconcileWithSnapshot({
    accountId,
    snapshotDate,
    manifest,
  });

  console.log("Reconcile campaigns:");
  for (const campaign of result.campaign_matches) {
    console.log({
      campaign_name: campaign.campaign_name,
      campaign_id: campaign.campaign_id ?? null,
    });
  }

  console.log("Reconcile ad groups:");
  for (const adGroup of result.ad_group_matches) {
    console.log({
      campaign_name: adGroup.campaign_name,
      ad_group_name: adGroup.ad_group_name,
      ad_group_id: adGroup.ad_group_id ?? null,
    });
  }

  console.log("Reconcile keywords:");
  for (const keyword of result.keyword_matches) {
    console.log({
      keyword_text: keyword.keyword_text,
      match_type: keyword.match_type,
      target_id: keyword.target_id ?? null,
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
