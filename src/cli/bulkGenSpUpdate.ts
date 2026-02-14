import fs from "node:fs";
import path from "node:path";
import { fetchCurrentSpData } from "../bulksheet_gen_sp/fetchCurrent";
import { buildUploadRows, SP_SHEET_NAME } from "../bulksheet_gen_sp/buildUploadRows";
import { writeSpBulkUpdateXlsx } from "../bulksheet_gen_sp/writeXlsx";
import { SpUpdateAction, SpUpdateChangesFile } from "../bulksheet_gen_sp/types";

function usage() {
  console.log(
    "Usage: npm run bulkgen:sp:update -- --account-id <id> --marketplace <marketplace> --template <xlsx> --out-dir <dir> --file <changes.json>"
  );
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function parseChangesFile(filePath: string): SpUpdateChangesFile {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as SpUpdateChangesFile;
  if (!data || typeof data !== "object") {
    throw new Error("Invalid changes file: expected JSON object.");
  }
  if (!data.exported_at || typeof data.exported_at !== "string") {
    throw new Error("Invalid changes file: exported_at is required.");
  }
  if (!Array.isArray(data.actions) || data.actions.length === 0) {
    throw new Error("Invalid changes file: actions must be a non-empty array.");
  }
  return data;
}

function requiredHeadersForActions(actions: SpUpdateAction[]): string[] {
  const required = new Set<string>(["Entity", "Operation"]);
  for (const action of actions) {
    if (action.type === "update_campaign_budget") {
      required.add("Campaign ID");
      required.add("Daily Budget");
      continue;
    }
    if (action.type === "update_campaign_state") {
      required.add("Campaign ID");
      required.add("State");
      continue;
    }
    if (action.type === "update_target_bid") {
      required.add("Campaign ID");
      required.add("Ad Group ID");
      required.add("Keyword ID");
      required.add("Product Targeting ID");
      required.add("Keyword Text");
      required.add("Product Targeting Expression");
      required.add("Match Type");
      required.add("Bid");
      continue;
    }
    if (action.type === "update_target_state") {
      required.add("Campaign ID");
      required.add("Ad Group ID");
      required.add("Keyword ID");
      required.add("Product Targeting ID");
      required.add("Keyword Text");
      required.add("Product Targeting Expression");
      required.add("Match Type");
      required.add("State");
      continue;
    }
    if (action.type === "update_placement_modifier") {
      required.add("Campaign ID");
      required.add("Placement");
      required.add("Percentage");
      continue;
    }
    if (action.type === "update_ad_group_state") {
      required.add("Product");
      required.add("Campaign ID");
      required.add("Ad Group ID");
      required.add("State");
      continue;
    }
    const neverAction: never = action;
    throw new Error(`Unsupported action: ${JSON.stringify(neverAction)}`);
  }
  return [...required];
}

async function main() {
  const accountId = getArg("--account-id");
  const marketplace = getArg("--marketplace");
  const templatePath = getArg("--template");
  const outDir = getArg("--out-dir");
  const filePath = getArg("--file");

  if (!accountId || !marketplace || !templatePath || !outDir || !filePath) {
    usage();
    process.exit(1);
  }

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const changes = parseChangesFile(filePath);

  const current = await fetchCurrentSpData(accountId, changes.actions);
  const rows = buildUploadRows({
    actions: changes.actions,
    current,
    notes: changes.notes,
  });

  const requiredHeaders = requiredHeadersForActions(changes.actions);

  const { uploadPath, reviewPath } = writeSpBulkUpdateXlsx({
    templatePath,
    outDir: path.resolve(outDir),
    rows,
    requiredHeadersBySheet: new Map([[SP_SHEET_NAME, requiredHeaders]]),
  });

  console.log("Bulk update files written.");
  console.log({
    snapshotDate: current.snapshotDate,
    uploadPath,
    reviewPath,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
