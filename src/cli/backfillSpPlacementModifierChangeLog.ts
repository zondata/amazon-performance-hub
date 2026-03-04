import { diffPlacementModifierUpdates } from "../backfill/spPlacementModifierChangeLogDiff";
import { getSupabaseClient } from "../db/supabaseClient";
import { chunkArray } from "../ingest/utils";
import { rejectDeprecatedAccountId } from "./_accountGuard";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT_SNAPSHOTS = 30;
const DEFAULT_CHUNK = 500;
const SAMPLE_ROWS_LIMIT = 20;

type BulkUploadRow = {
  upload_id: string;
  snapshot_date: string;
  exported_at: string;
};

type PlacementRow = {
  campaign_id: string;
  placement_code: string;
  placement_raw: string | null;
  percentage: number | string | null;
};

type ChangeLogInsertRow = {
  account_id: string;
  upload_id: string;
  snapshot_date: string;
  exported_at: string;
  campaign_id: string;
  placement_code: string;
  placement_raw: string | null;
  old_pct: number;
  new_pct: number;
};

type Pair = {
  prev: BulkUploadRow;
  curr: BulkUploadRow;
};

function usage() {
  console.log(
    "Usage: npm run backfill:sp:placement-modifier-change-log -- --account-id <id> [--dry-run] [--apply] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--limit-snapshots N] [--all] [--chunk N] [--max-pairs N]"
  );
}

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseDateOrThrow(label: string, value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!DATE_RE.test(value)) {
    throw new Error(`Invalid ${label} date format (expected YYYY-MM-DD): ${value}`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${label} date value: ${value}`);
  }
  return value;
}

function parsePositiveIntOrThrow(
  flag: string,
  raw: string | undefined,
  defaultValue: number
): number {
  if (!raw) return defaultValue;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${flag} value (expected positive integer): ${raw}`);
  }
  return value;
}

async function validateSchemaAssumptions() {
  const client = getSupabaseClient();
  const [uploadsProbe, placementsProbe, changeLogProbe] = await Promise.all([
    client
      .from("uploads")
      .select("upload_id,account_id,source_type,snapshot_date,exported_at")
      .limit(1),
    client
      .from("bulk_placements")
      .select("account_id,snapshot_date,campaign_id,placement_code,placement_raw,percentage")
      .limit(1),
    client
      .from("sp_placement_modifier_change_log")
      .select(
        "account_id,upload_id,snapshot_date,exported_at,campaign_id,placement_code,placement_raw,old_pct,new_pct,created_at"
      )
      .limit(1),
  ]);

  if (uploadsProbe.error) {
    throw new Error(`Schema assumption failed for uploads: ${uploadsProbe.error.message}`);
  }
  if (placementsProbe.error) {
    throw new Error(
      `Schema assumption failed for bulk_placements: ${placementsProbe.error.message}`
    );
  }
  if (changeLogProbe.error) {
    throw new Error(
      `Schema assumption failed for sp_placement_modifier_change_log: ${changeLogProbe.error.message}`
    );
  }
}

async function loadBulkUploads(params: {
  accountId: string;
  fromDate?: string;
  toDate?: string;
  all: boolean;
  limitSnapshots: number;
}): Promise<BulkUploadRow[]> {
  const client = getSupabaseClient();
  let query = client
    .from("uploads")
    .select("upload_id,snapshot_date,exported_at")
    .eq("account_id", params.accountId)
    .eq("source_type", "bulk")
    .not("snapshot_date", "is", null)
    .not("exported_at", "is", null)
    .order("snapshot_date", { ascending: true })
    .order("exported_at", { ascending: true })
    .order("upload_id", { ascending: true });

  if (params.fromDate) {
    query = query.gte("snapshot_date", params.fromDate);
  }
  if (params.toDate) {
    query = query.lte("snapshot_date", params.toDate);
  }

  const { data, error } = await query.limit(50000);
  if (error) {
    throw new Error(`Failed loading bulk uploads: ${error.message}`);
  }

  const normalized = (data ?? [])
    .map((row) => ({
      upload_id: String(row.upload_id ?? "").trim(),
      snapshot_date: String(row.snapshot_date ?? "").trim(),
      exported_at: String(row.exported_at ?? "").trim(),
    }))
    .filter((row) => row.upload_id && row.snapshot_date && row.exported_at);

  if (params.fromDate || params.toDate || params.all) {
    return normalized;
  }

  if (normalized.length <= params.limitSnapshots) return normalized;
  return normalized.slice(normalized.length - params.limitSnapshots);
}

function buildConsecutivePairs(uploads: BulkUploadRow[], maxPairs?: number): Pair[] {
  const pairs: Pair[] = [];
  for (let index = 1; index < uploads.length; index += 1) {
    pairs.push({ prev: uploads[index - 1], curr: uploads[index] });
  }
  if (!maxPairs) return pairs;
  return pairs.slice(0, maxPairs);
}

async function loadSnapshotPlacements(params: {
  accountId: string;
  snapshotDate: string;
}): Promise<PlacementRow[]> {
  const client = getSupabaseClient();
  const pageSize = 5000;
  let from = 0;
  const rows: PlacementRow[] = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from("bulk_placements")
      .select("campaign_id,placement_code,placement_raw,percentage")
      .eq("account_id", params.accountId)
      .eq("snapshot_date", params.snapshotDate)
      .order("campaign_id", { ascending: true })
      .order("placement_code", { ascending: true })
      .range(from, to);
    if (error) {
      throw new Error(
        `Failed loading bulk_placements for snapshot ${params.snapshotDate}: ${error.message}`
      );
    }
    const page = (data ?? []) as PlacementRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function getChangeLogCount(accountId: string): Promise<number | null> {
  const client = getSupabaseClient();
  const { count, error } = await client
    .from("sp_placement_modifier_change_log")
    .select("upload_id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if (error) {
    console.warn(`Could not read change-log count: ${error.message}`);
    return null;
  }
  return typeof count === "number" ? count : null;
}

async function insertChangeRows(params: { rows: ChangeLogInsertRow[]; chunkSize: number }) {
  if (params.rows.length === 0) return;
  const client = getSupabaseClient();
  for (const chunk of chunkArray(params.rows, params.chunkSize)) {
    const { error } = await client
      .from("sp_placement_modifier_change_log")
      .upsert(chunk, {
        onConflict: "account_id,upload_id,campaign_id,placement_code",
        ignoreDuplicates: true,
      });
    if (error) {
      throw new Error(`Failed inserting change-log rows: ${error.message}`);
    }
  }
}

async function main() {
  const accountId = getArg("--account-id");
  if (!accountId) {
    usage();
    process.exit(1);
  }
  rejectDeprecatedAccountId(accountId);

  const hasApply = hasFlag("--apply");
  const hasDryRun = hasFlag("--dry-run");
  if (hasApply && hasDryRun) {
    throw new Error("Cannot pass both --apply and --dry-run.");
  }
  const dryRun = hasApply ? false : true;

  const fromDate = parseDateOrThrow("--from", getArg("--from"));
  const toDate = parseDateOrThrow("--to", getArg("--to"));
  if (fromDate && toDate && fromDate > toDate) {
    throw new Error(`Invalid date bounds: --from ${fromDate} > --to ${toDate}`);
  }

  const all = hasFlag("--all");
  const limitSnapshots = parsePositiveIntOrThrow(
    "--limit-snapshots",
    getArg("--limit-snapshots"),
    DEFAULT_LIMIT_SNAPSHOTS
  );
  const chunkSize = parsePositiveIntOrThrow("--chunk", getArg("--chunk"), DEFAULT_CHUNK);
  const maxPairsRaw = getArg("--max-pairs");
  const maxPairs = maxPairsRaw
    ? parsePositiveIntOrThrow("--max-pairs", maxPairsRaw, 1)
    : undefined;

  await validateSchemaAssumptions();

  const uploads = await loadBulkUploads({
    accountId,
    fromDate,
    toDate,
    all,
    limitSnapshots,
  });

  console.log(`[sp-placement-modifier-change-log] mode=${dryRun ? "DRY-RUN" : "APPLY"}`);
  console.log(`[sp-placement-modifier-change-log] account_id=${accountId}`);
  console.log(
    `[sp-placement-modifier-change-log] filters from=${fromDate ?? "none"} to=${toDate ?? "none"} all=${all} limit_snapshots=${limitSnapshots} chunk=${chunkSize} max_pairs=${maxPairs ?? "none"}`
  );
  console.log(
    "[sp-placement-modifier-change-log] limitation: placement diff uses snapshot_date grouping from bulk_placements; multiple exports on the same snapshot_date share that grouped snapshot state."
  );

  if (uploads.length < 2) {
    console.log(
      `[sp-placement-modifier-change-log] uploads considered=${uploads.length}; need at least 2 uploads to diff.`
    );
    return;
  }

  const pairs = buildConsecutivePairs(uploads, maxPairs);
  if (pairs.length === 0) {
    console.log("[sp-placement-modifier-change-log] no consecutive pairs to process.");
    return;
  }

  const placementsCache = new Map<string, PlacementRow[]>();
  const getPlacementsForSnapshot = async (snapshotDate: string) => {
    const cached = placementsCache.get(snapshotDate);
    if (cached) return cached;
    const rows = await loadSnapshotPlacements({ accountId, snapshotDate });
    placementsCache.set(snapshotDate, rows);
    return rows;
  };

  const countBefore = dryRun ? null : await getChangeLogCount(accountId);

  let processedPairs = 0;
  let totalChangesFound = 0;
  let attemptedInsertRows = 0;
  const sampleRows: ChangeLogInsertRow[] = [];

  for (const pair of pairs) {
    const [prevRows, currRows] = await Promise.all([
      getPlacementsForSnapshot(pair.prev.snapshot_date),
      getPlacementsForSnapshot(pair.curr.snapshot_date),
    ]);

    const diffs = diffPlacementModifierUpdates(prevRows, currRows);
    const changeRows: ChangeLogInsertRow[] = diffs.map((diff) => ({
      account_id: accountId,
      upload_id: pair.curr.upload_id,
      snapshot_date: pair.curr.snapshot_date,
      exported_at: pair.curr.exported_at,
      campaign_id: diff.campaign_id,
      placement_code: diff.placement_code,
      placement_raw: diff.placement_raw,
      old_pct: diff.old_pct,
      new_pct: diff.new_pct,
    }));

    totalChangesFound += changeRows.length;
    processedPairs += 1;
    attemptedInsertRows += changeRows.length;

    if (sampleRows.length < SAMPLE_ROWS_LIMIT && changeRows.length > 0) {
      const remaining = SAMPLE_ROWS_LIMIT - sampleRows.length;
      sampleRows.push(...changeRows.slice(0, remaining));
    }

    if (!dryRun && changeRows.length > 0) {
      await insertChangeRows({ rows: changeRows, chunkSize });
    }
  }

  console.log(`[sp-placement-modifier-change-log] uploads considered=${uploads.length}`);
  console.log(`[sp-placement-modifier-change-log] pairs processed=${processedPairs}`);
  console.log(`[sp-placement-modifier-change-log] total changes found=${totalChangesFound}`);
  const logVerificationQueries = () => {
    console.log("[sp-placement-modifier-change-log] verification queries:");
    console.log(
      `  select count(*) from sp_placement_modifier_change_log where account_id='${accountId}';`
    );
    console.log(
      `  select * from sp_placement_modifier_change_log where account_id='${accountId}' order by exported_at desc limit 20;`
    );
  };

  if (dryRun) {
    if (sampleRows.length === 0) {
      console.log("[sp-placement-modifier-change-log] sample rows: none");
    } else {
      console.log(
        `[sp-placement-modifier-change-log] sample rows (first ${sampleRows.length} of ${totalChangesFound}):`
      );
      for (const row of sampleRows) {
        console.log(
          `  - ${row.snapshot_date} ${row.exported_at} | ${row.campaign_id} ${row.placement_code} ${row.old_pct} -> ${row.new_pct}`
        );
      }
    }
    logVerificationQueries();
    return;
  }

  const countAfter = await getChangeLogCount(accountId);
  const insertedCount =
    countBefore !== null && countAfter !== null ? Math.max(0, countAfter - countBefore) : null;
  const skippedDuplicates =
    insertedCount === null ? null : Math.max(0, attemptedInsertRows - insertedCount);

  console.log(
    `[sp-placement-modifier-change-log] attempted insert rows=${attemptedInsertRows}`
  );
  if (insertedCount !== null) {
    console.log(`[sp-placement-modifier-change-log] inserted rows=${insertedCount}`);
  }
  if (skippedDuplicates !== null) {
    console.log(
      `[sp-placement-modifier-change-log] skipped duplicate rows=${skippedDuplicates}`
    );
  }
  logVerificationQueries();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
