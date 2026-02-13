import { mapUpload } from "../mapping_sb/db";

function usage() {
  console.log("Usage: npm run map:sb:campaign:placement -- --upload-id <id>");
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const uploadId = getArg("--upload-id");
  if (!uploadId) {
    usage();
    process.exit(1);
  }

  const result = await mapUpload(uploadId, "sb_campaign_placement");
  console.log("Mapping complete.");
  console.log(result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
