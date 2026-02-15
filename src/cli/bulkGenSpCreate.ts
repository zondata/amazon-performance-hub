import fs from "node:fs";
import path from "node:path";
import { buildUploadRows, resolveCreateRefs, SP_CREATE_SHEET_NAME } from "../bulksheet_gen_sp_create/buildUploadRows";
import { buildCreateManifest } from "../bulksheet_gen_sp_create/manifest";
import { writeSpBulkCreateXlsx } from "../bulksheet_gen_sp_create/writeXlsx";
import { SpCreateChangesFile, SpCreateAction } from "../bulksheet_gen_sp_create/types";
import { buildSpBulkgenCreateLogEntries, writeBulkgenLogs } from "../logbook/bulkgen";

function usage() {
  console.log(
    "Usage: npm run bulkgen:sp:create -- --account-id <id> --marketplace <marketplace> --template <xlsx> --out-dir <dir> --file <changes.json> [--confirm-create] [--allow-enabled] [--max-budget 50] [--max-bid 2] [--log] [--experiment-id <uuid>] [--run-id <id>]"
  );
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseNumberArg(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) throw new Error(`Invalid ${label}: ${value}`);
  return num;
}

function generateRunId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

function parseChangesFile(filePath: string): SpCreateChangesFile {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as SpCreateChangesFile;
  if (!data || typeof data !== "object") {
    throw new Error("Invalid changes file: expected JSON object.");
  }
  if (!Array.isArray(data.actions) || data.actions.length === 0) {
    throw new Error("Invalid changes file: actions must be a non-empty array.");
  }
  return data;
}

function requiredHeadersForActions(actions: SpCreateAction[]): string[] {
  const required = new Set<string>(["Entity", "Operation", "Product"]);
  for (const action of actions) {
    if (action.type === "create_campaign") {
      required.add("Campaign Name");
      required.add("Daily Budget");
      required.add("State");
      if (action.bidding_strategy) {
        required.add("Bidding Strategy");
      }
      continue;
    }
    if (action.type === "create_ad_group") {
      required.add("Campaign Name");
      required.add("Ad Group Name");
      required.add("State");
      if (action.default_bid !== undefined && action.default_bid !== null) {
        required.add("Bid");
      }
      continue;
    }
    if (action.type === "create_product_ad") {
      required.add("Campaign Name");
      required.add("Ad Group Name");
      if (action.sku) required.add("SKU");
      if (action.asin) required.add("ASIN");
      continue;
    }
    if (action.type === "create_keyword") {
      required.add("Campaign Name");
      required.add("Ad Group Name");
      required.add("Keyword Text");
      required.add("Match Type");
      required.add("Bid");
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
  const confirmCreate = hasFlag("--confirm-create");
  const allowEnabled = hasFlag("--allow-enabled");
  const maxBudget = parseNumberArg(getArg("--max-budget"), 50, "max-budget");
  const maxBid = parseNumberArg(getArg("--max-bid"), 2, "max-bid");
  const shouldLog = hasFlag("--log");
  const experimentId = getArg("--experiment-id");
  const runId = getArg("--run-id") ?? generateRunId();

  if (!accountId || !marketplace || !templatePath || !outDir || !filePath) {
    usage();
    process.exit(1);
  }

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const changes = parseChangesFile(filePath);
  const refs = resolveCreateRefs(changes.actions);
  const rows = buildUploadRows({
    actions: changes.actions,
    refs,
    allowEnabled,
    maxBudget,
    maxBid,
    notes: changes.notes,
  });

  const requiredHeaders = requiredHeadersForActions(changes.actions);
  const { uploadPath, reviewPath } = writeSpBulkCreateXlsx({
    templatePath,
    outDir: path.resolve(outDir),
    rows,
    requiredHeadersBySheet: new Map([[SP_CREATE_SHEET_NAME, requiredHeaders]]),
    writeUpload: confirmCreate,
  });

  const manifest = buildCreateManifest({
    actions: changes.actions,
    refs,
    runId,
    generator: "bulkgen:sp:create",
  });
  const manifestPath = path.join(path.resolve(outDir), "creation_manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  if (shouldLog) {
    const entries = buildSpBulkgenCreateLogEntries({
      manifest,
      runId,
      generator: "bulkgen:sp:create",
      outputPaths: { uploadPath: uploadPath ?? "", reviewPath },
    });
    const { created, skipped } = await writeBulkgenLogs({
      accountId,
      marketplace,
      entries,
      experimentId,
    });
    console.log({ log_changes_created: created, log_changes_skipped: skipped, runId });
  }

  console.log("Bulk create files written.");
  console.log({
    runId,
    uploadPath: uploadPath ?? null,
    reviewPath,
    manifestPath,
    confirmCreate,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
