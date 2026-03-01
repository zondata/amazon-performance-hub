import fs from "node:fs";
import path from "node:path";
import { fetchCurrentSbData } from "../bulksheet_gen_sb/fetchCurrent";
import {
  buildUploadRows,
  SB_DEFAULT_SHEET_NAME,
} from "../bulksheet_gen_sb/buildUploadRows";
import { writeSbBulkUpdateXlsx } from "../bulksheet_gen_sb/writeXlsx";
import { SbUpdateAction, SbUpdateChangesFile } from "../bulksheet_gen_sb/types";
import * as XLSX from "xlsx";
import { buildSbBulkgenLogEntries, writeBulkgenLogs } from "../logbook/bulkgen";

function usage() {
  console.log(
    "Usage: npm run bulkgen:sb:update -- --account-id <id> --marketplace <marketplace> --template <xlsx> --out-dir <dir> --file <changes.json> [--sheet \"SB Multi Ad Group Campaigns\"] [--log] [--experiment-id <uuid>] [--run-id <id>]"
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

function generateRunId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

function parseChangesFile(filePath: string): SbUpdateChangesFile {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as SbUpdateChangesFile;
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

function readTemplateHeaders(templatePath: string, sheetName: string): string[] {
  const workbook = XLSX.readFile(templatePath, { dense: true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Template sheet missing: ${sheetName}`);
  }
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  const headerRow = rows[0] ?? [];
  const headers = headerRow.map((cell) => String(cell ?? "").trim());
  if (!headers.length || headers.every((h) => !h)) {
    throw new Error(`Template sheet ${sheetName} has no header row.`);
  }
  return headers;
}

function resolveBudgetHeader(headers: string[]): string | null {
  if (headers.includes("Daily Budget")) return "Daily Budget";
  if (headers.includes("Budget")) return "Budget";
  return null;
}

function requiredHeadersForActions(
  actions: SbUpdateAction[],
  currentTargetsById: Map<string, { match_type: string }>,
  budgetHeader?: string | null,
): string[] {
  const required = new Set<string>(["Entity", "Operation"]);
  for (const action of actions) {
    if (action.type === "update_campaign_budget") {
      required.add("Campaign ID");
      if (!budgetHeader) {
        throw new Error(
          "Template missing required budget column: expected 'Daily Budget' or 'Budget'."
        );
      }
      required.add(budgetHeader);
      continue;
    }
    if (action.type === "update_campaign_state") {
      required.add("Campaign ID");
      required.add("State");
      continue;
    }
    if (action.type === "update_campaign_bidding_strategy") {
      required.add("Product");
      required.add("Campaign ID");
      required.add("Bidding Strategy");
      continue;
    }
    if (action.type === "update_ad_group_state") {
      required.add("Product");
      required.add("Campaign ID");
      required.add("Ad Group ID");
      required.add("State");
      continue;
    }
    if (action.type === "update_ad_group_default_bid") {
      required.add("Product");
      required.add("Campaign ID");
      required.add("Ad Group ID");
      required.add("Ad Group Default Bid");
      continue;
    }
    if (action.type === "update_target_bid" || action.type === "update_target_state") {
      const target = currentTargetsById.get(action.target_id);
      if (!target) {
        throw new Error(`Target not found: ${action.target_id}`);
      }
      required.add("Campaign ID");
      required.add("Ad Group ID");
      required.add("Match Type");
      if (target.match_type === "TARGETING_EXPRESSION") {
        required.add("Product Targeting ID");
        required.add("Product Targeting Expression");
      } else {
        required.add("Keyword ID");
        required.add("Keyword Text");
      }
      if (action.type === "update_target_bid") {
        required.add("Bid");
      } else {
        required.add("State");
      }
      continue;
    }
    if (action.type === "update_placement_modifier") {
      required.add("Campaign ID");
      required.add("Placement");
      required.add("Percentage");
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
  const sheetName = getArg("--sheet") ?? SB_DEFAULT_SHEET_NAME;
  const shouldLog = hasFlag("--log");
  const experimentId = getArg("--experiment-id");
  const runId = getArg("--run-id") ?? (shouldLog ? generateRunId() : undefined);

  if (!accountId || !marketplace || !templatePath || !outDir || !filePath) {
    usage();
    process.exit(1);
  }

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const changes = parseChangesFile(filePath);

  const current = await fetchCurrentSbData(accountId, changes.actions);
  const templateHeaders = readTemplateHeaders(templatePath, sheetName);
  const hasBudgetAction = changes.actions.some(
    (action) => action.type === "update_campaign_budget"
  );
  const budgetHeader = hasBudgetAction ? resolveBudgetHeader(templateHeaders) : null;

  const rows = buildUploadRows({
    actions: changes.actions,
    current,
    notes: changes.notes,
    sheetName,
    budgetColumn: budgetHeader ?? undefined,
  });

  const requiredHeaders = requiredHeadersForActions(
    changes.actions,
    current.targetsById,
    budgetHeader
  );

  const { uploadPath, reviewPath } = writeSbBulkUpdateXlsx({
    templatePath,
    outDir: path.resolve(outDir),
    rows,
    requiredHeadersBySheet: new Map([[sheetName, requiredHeaders]]),
  });

  if (shouldLog && runId) {
    const entries = buildSbBulkgenLogEntries({
      rows,
      current,
      runId,
      generator: "bulkgen:sb:update",
      outputPaths: { uploadPath, reviewPath },
      productId: changes.product_id,
      finalPlanPackId: changes.final_plan_pack_id,
    });
    const { created, skipped } = await writeBulkgenLogs({
      accountId,
      marketplace,
      entries,
      experimentId,
    });
    console.log({ log_changes_created: created, log_changes_skipped: skipped, runId });
  }

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
