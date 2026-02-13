import { resolveDateFolder, getSbStisCsv } from "../fs/reportLocator";
import { hashFileSha256 } from "../ingest/utils";
import { findUploadIdByFileHash, mapUpload } from "../mapping_sb/db";

function usage() {
  console.log("Usage: npm run map:sb:stis:date -- --account-id <id> <date-folder-or-date>");
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

async function main() {
  const accountId = getArg("--account-id");
  const positionals = getPositionalArgs();
  const dateInput = positionals[0];

  if (!accountId || !dateInput) {
    usage();
    process.exit(1);
  }

  const dateFolder = resolveDateFolder(dateInput);
  const stisCsv = getSbStisCsv(dateFolder);
  const fileHash = hashFileSha256(stisCsv);
  const uploadId = await findUploadIdByFileHash(accountId, fileHash);
  if (!uploadId) {
    throw new Error(`Upload not found for sb_stis file hash: ${stisCsv}`);
  }

  const result = await mapUpload(uploadId, "sb_stis");
  console.log("sb_stis mapping complete.");
  console.log({ uploadId, ...result });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
