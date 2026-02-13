import { resolveDateFolder, getSbCampaignXlsx, getSbCampaignPlacementXlsx, getSbKeywordXlsx, getSbStisCsv } from "../fs/reportLocator";
import { hashFileSha256 } from "../ingest/utils";
import { findUploadIdByFileHash, mapUpload } from "../mapping_sb/db";

function usage() {
  console.log(
    "Usage: npm run map:sb:all:date -- --account-id <id> <date-folder-or-date>"
  );
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
  reportType: "sb_campaign" | "sb_campaign_placement" | "sb_keyword" | "sb_stis"
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

  const campaignXlsx = getSbCampaignXlsx(dateFolder);
  const placementXlsx = getSbCampaignPlacementXlsx(dateFolder);
  const keywordXlsx = getSbKeywordXlsx(dateFolder);
  const stisCsv = getSbStisCsv(dateFolder);

  await mapByFile(accountId, campaignXlsx, "sb_campaign");
  await mapByFile(accountId, placementXlsx, "sb_campaign_placement");
  await mapByFile(accountId, keywordXlsx, "sb_keyword");
  await mapByFile(accountId, stisCsv, "sb_stis");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
