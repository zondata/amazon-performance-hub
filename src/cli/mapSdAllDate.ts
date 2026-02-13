import {
  resolveDateFolder,
  getSdCampaignXlsx,
  getSdAdvertisedProductXlsx,
  getSdTargetingXlsx,
  getSdMatchedTargetXlsx,
  getSdPurchasedProductXlsx,
} from "../fs/reportLocator";
import { hashFileSha256 } from "../ingest/utils";
import { findUploadIdByFileHash, mapUpload } from "../mapping_sd/db";

function usage() {
  console.log("Usage: npm run map:sd:all:date -- --account-id <id> <date-folder-or-date>");
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function getPositionalArgs(): string[] {
  const args = process.argv.slice(2);
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      i += 1;
      continue;
    }
    positionals.push(arg);
  }
  return positionals;
}

async function mapByFile(
  accountId: string,
  filePath: string,
  reportType:
    | "sd_campaign"
    | "sd_advertised_product"
    | "sd_targeting"
    | "sd_matched_target"
    | "sd_purchased_product"
) {
  const fileHash = hashFileSha256(filePath);
  const uploadId = await findUploadIdByFileHash(accountId, fileHash);
  if (!uploadId) {
    throw new Error(`Upload not found for ${reportType} file hash: ${filePath}`);
  }
  const result = await mapUpload(uploadId, reportType);
  console.log(`${reportType} mapping complete.`);
  console.log({ uploadId, ...result });
}

async function main() {
  const accountId = getArg("--account-id");
  const positionals = getPositionalArgs();
  const dateInput = positionals[0];

  if (!accountId || !dateInput) {
    usage();
    process.exit(1);
  }

  const dateFolder = resolveDateFolder(dateInput);

  const campaignXlsx = getSdCampaignXlsx(dateFolder);
  const advertisedXlsx = getSdAdvertisedProductXlsx(dateFolder);
  const targetingXlsx = getSdTargetingXlsx(dateFolder);
  const matchedXlsx = getSdMatchedTargetXlsx(dateFolder);
  const purchasedXlsx = getSdPurchasedProductXlsx(dateFolder);

  await mapByFile(accountId, campaignXlsx, "sd_campaign");
  await mapByFile(accountId, advertisedXlsx, "sd_advertised_product");
  await mapByFile(accountId, targetingXlsx, "sd_targeting");
  await mapByFile(accountId, matchedXlsx, "sd_matched_target");
  await mapByFile(accountId, purchasedXlsx, "sd_purchased_product");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
