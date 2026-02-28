import { getSupabaseClient } from "../db/supabaseClient";
import { rejectDeprecatedAccountId } from "./_accountGuard";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type DateChunk = {
  start: string;
  end: string;
};

function usage() {
  console.log(
    "Usage: npm run pipeline:backfill:ads:gold -- --account <id> --start YYYY-MM-DD --end YYYY-MM-DD [--chunk-days N]"
  );
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function parseIsoDate(value: string): Date {
  if (!DATE_RE.test(value)) {
    throw new Error(`Invalid date format (expected YYYY-MM-DD): ${value}`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return parsed;
}

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const parsed = parseIsoDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toDateString(parsed);
}

function normalizeChunkDays(raw: string | undefined): number {
  if (!raw) return 30;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --chunk-days value: ${raw}`);
  }
  return parsed;
}

function buildDateChunks(start: string, end: string, chunkDays: number): DateChunk[] {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  if (startDate.getTime() > endDate.getTime()) {
    throw new Error(`start must be <= end (${start} > ${end})`);
  }

  const chunks: DateChunk[] = [];
  let cursor = start;
  while (cursor <= end) {
    const chunkEnd = addDays(cursor, chunkDays - 1);
    const cappedEnd = chunkEnd > end ? end : chunkEnd;
    chunks.push({ start: cursor, end: cappedEnd });
    if (cappedEnd >= end) break;
    cursor = addDays(cappedEnd, 1);
  }
  return chunks;
}

async function runRebuild(params: {
  fnName:
    | "rebuild_sp_campaign_hourly_fact_gold"
    | "rebuild_sb_campaign_daily_fact_gold"
    | "rebuild_sd_campaign_daily_fact_gold";
  accountId: string;
  start: string;
  end: string;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc(params.fnName, {
    p_account_id: params.accountId,
    p_start_date: params.start,
    p_end_date: params.end,
  });
  if (error) {
    throw new Error(`Failed ${params.fnName} for ${params.start}..${params.end}: ${error.message}`);
  }
  return data;
}

async function main() {
  const accountArg = getArg("--account") ?? getArg("--account-id");
  if (!accountArg) {
    usage();
    process.exit(1);
  }
  rejectDeprecatedAccountId(accountArg);

  const start = getArg("--start");
  const end = getArg("--end");
  if (!start || !end) {
    usage();
    process.exit(1);
  }

  const chunkDays = normalizeChunkDays(getArg("--chunk-days"));
  const chunks = buildDateChunks(start, end, chunkDays);

  const output: Array<{
    chunk_start: string;
    chunk_end: string;
    sp: unknown;
    sb: unknown;
    sd: unknown;
  }> = [];

  for (const chunk of chunks) {
    console.log(
      `[ads-gold-backfill] rebuilding ${chunk.start}..${chunk.end} (${chunkDays}d chunk)`
    );

    const [sp, sb, sd] = await Promise.all([
      runRebuild({
        fnName: "rebuild_sp_campaign_hourly_fact_gold",
        accountId: accountArg,
        start: chunk.start,
        end: chunk.end,
      }),
      runRebuild({
        fnName: "rebuild_sb_campaign_daily_fact_gold",
        accountId: accountArg,
        start: chunk.start,
        end: chunk.end,
      }),
      runRebuild({
        fnName: "rebuild_sd_campaign_daily_fact_gold",
        accountId: accountArg,
        start: chunk.start,
        end: chunk.end,
      }),
    ]);

    output.push({
      chunk_start: chunk.start,
      chunk_end: chunk.end,
      sp,
      sb,
      sd,
    });
  }

  const startMs = parseIsoDate(start).getTime();
  const endMs = parseIsoDate(end).getTime();
  const totalDays = Math.floor((endMs - startMs) / MS_PER_DAY) + 1;

  console.log(
    JSON.stringify(
      {
        account_id: accountArg,
        start,
        end,
        total_days: totalDays,
        chunk_days: chunkDays,
        chunks: output,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
