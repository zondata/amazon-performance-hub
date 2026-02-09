import { resolveDateFolder, getSpCampaignCsv, getSpPlacementXlsx, getSpTargetingXlsx, getSpStisCsv } from "../fs/reportLocator";
import { hashFileSha256 } from "../ingest/utils";
import { findUploadIdByFileHash, mapUpload } from "../mapping/db";

function usage() {
  console.log(
    "Usage: npm run map:sp:all:date -- --account-id <id> <date-folder-or-date>"
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

async function mapByFile(accountId: string, filePath: string, reportType: "sp_campaign" | "sp_placement" | "sp_targeting" | "sp_stis") {
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

  const campaignCsv = getSpCampaignCsv(dateFolder);
  const placementXlsx = getSpPlacementXlsx(dateFolder);
  const targetingXlsx = getSpTargetingXlsx(dateFolder);
  const stisCsv = getSpStisCsv(dateFolder);

  await mapByFile(accountId, campaignCsv, "sp_campaign");
  await mapByFile(accountId, placementXlsx, "sp_placement");
  await mapByFile(accountId, targetingXlsx, "sp_targeting");
  await mapByFile(accountId, stisCsv, "sp_stis");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
