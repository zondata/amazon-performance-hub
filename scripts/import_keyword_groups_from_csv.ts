import fs from "fs";
import { Pool } from "pg";

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function requireArg(flag: string): string {
  const value = getArg(flag);
  if (!value) {
    throw new Error(`Missing required arg: ${flag}`);
  }
  return value;
}

function parseBoolean(value: string, flag: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`Invalid boolean for ${flag}: ${value}`);
}

function normalizeKeyword(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === "\"") {
        const next = content[i + 1];
        if (next === "\"") {
          field += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

type Membership = {
  keywordNorm: string;
  keywordRaw: string;
  groupName: string;
};

type ExclusivityFailure = {
  keywordRaw: string;
  keywordNorm: string;
  groupSetName: string;
  attemptedGroup: string;
  existingGroup: string | null;
};

function looksLikeHeader(row: string[]): boolean {
  const c0 = (row[0] ?? "").trim().toLowerCase();
  const c1 = (row[1] ?? "").trim().toLowerCase();
  if (c0 === "keyword") return true;
  if (c1 === "group") return true;
  for (let j = 3; j <= 14; j += 1) {
    if ((row[j] ?? "").trim().length > 0) return true;
  }
  return false;
}

function looksLikeNote(row: string[]): boolean {
  return !looksLikeHeader(row);
}

async function main(): Promise<void> {
  const accountId = requireArg("--account_id");
  const marketplace = requireArg("--marketplace");
  const asin = requireArg("--asin");
  const csvPath = requireArg("--csv_path");
  const groupSetName = requireArg("--group_set_name");
  const exclusive = parseBoolean(requireArg("--exclusive"), "--exclusive");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in environment.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    const productRes = await client.query(
      `select product_id
       from products
       where account_id = $1
         and marketplace = $2
         and asin = $3
       limit 1`,
      [accountId, marketplace, asin]
    );

    if (productRes.rowCount === 0) {
      throw new Error(
        `Product not found for account_id=${accountId}, marketplace=${marketplace}, asin=${asin}`
      );
    }

    const productId = productRes.rows[0].product_id as string;

    const groupSetRes = await client.query(
      `insert into keyword_group_sets (product_id, name, is_active, is_exclusive)
       values ($1, $2, true, $3)
       on conflict (product_id, name)
       do update set is_active = excluded.is_active, is_exclusive = excluded.is_exclusive
       returning group_set_id`,
      [productId, groupSetName, exclusive]
    );

    const groupSetId = groupSetRes.rows[0].group_set_id as string;

    await client.query(
      `update keyword_group_sets
       set is_active = false
       where product_id = $1
         and group_set_id <> $2`,
      [productId, groupSetId]
    );

    const csvContent = fs.readFileSync(csvPath, "utf8");
    const rows = parseCsv(csvContent);

    if (rows.length < 1) {
      throw new Error("CSV must contain at least one header row.");
    }

    let headerIndex = 0;
    if (
      rows.length >= 2 &&
      looksLikeNote(rows[0]) &&
      looksLikeHeader(rows[1])
    ) {
      headerIndex = 1;
    }

    const headerRow = rows[headerIndex];
    const groupHeaders: string[] = [];
    for (let j = 3; j <= 14; j += 1) {
      const headerValue = headerRow[j];
      if (!headerValue) continue;
      if (headerValue.trim().length === 0) continue;
      groupHeaders.push(headerValue);
    }

    const uniqueGroupNames = Array.from(new Set(groupHeaders));

    const groupIdByName = new Map<string, string>();
    let groupsUpsertedCount = 0;
    for (const groupName of uniqueGroupNames) {
      const groupRes = await client.query(
        `insert into keyword_groups (group_set_id, name)
         values ($1, $2)
         on conflict (group_set_id, name)
         do update set name = excluded.name
         returning group_id`,
        [groupSetId, groupName]
      );
      const groupId = groupRes.rows[0].group_id as string;
      groupIdByName.set(groupName, groupId);
      groupsUpsertedCount += 1;
    }

    const memberships = new Map<string, Membership>();
    const keywordLatestRaw = new Map<string, string>();

    const addMembership = (keywordRaw: string, groupName: string) => {
      const keywordNorm = normalizeKeyword(keywordRaw);
      if (!keywordNorm) return;
      keywordLatestRaw.set(keywordNorm, keywordRaw);
      const key = `${keywordNorm}||${groupName}`;
      if (!memberships.has(key)) {
        memberships.set(key, { keywordNorm, keywordRaw, groupName });
      }
    };

    const dataStart = headerIndex + 1;
    for (let i = dataStart; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row) continue;

      const col0 = row[0] ?? "";
      const col1 = row[1] ?? "";

      if (col0.trim().length > 0 && col1.trim().length > 0) {
        addMembership(col0, col1.trim());
      }

      for (let j = 3; j <= 14; j += 1) {
        const cell = row[j] ?? "";
        if (cell.trim().length === 0) continue;
        const headerValue = headerRow[j];
        if (!headerValue || headerValue.trim().length === 0) continue;
        addMembership(cell, headerValue);
      }
    }

    const keywords = Array.from(keywordLatestRaw.entries()).map(([keywordNorm, keywordRaw]) => ({
      keywordNorm,
      keywordRaw,
    }));

    const keywordIdByNorm = new Map<string, string>();
    const keywordChunkSize = 500;
    for (let i = 0; i < keywords.length; i += keywordChunkSize) {
      const chunk = keywords.slice(i, i + keywordChunkSize);
      if (chunk.length === 0) continue;

      const values: string[] = [];
      const params: Array<string> = [];
      let paramIndex = 1;

      for (const keyword of chunk) {
        values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
        params.push(marketplace, keyword.keywordNorm, keyword.keywordRaw);
        paramIndex += 3;
      }

      const upsertRes = await client.query(
        `insert into dim_keyword (marketplace, keyword_norm, keyword_raw)
         values ${values.join(", ")}
         on conflict (marketplace, keyword_norm)
         do update set keyword_raw = excluded.keyword_raw
         returning keyword_id, keyword_norm`,
        params
      );

      for (const row of upsertRes.rows) {
        keywordIdByNorm.set(row.keyword_norm as string, row.keyword_id as string);
      }
    }

    const exclusivityFailures: ExclusivityFailure[] = [];
    let membershipsInserted = 0;
    let membershipsSkipped = 0;

    for (const membership of memberships.values()) {
      const groupId = groupIdByName.get(membership.groupName);
      if (!groupId) {
        console.warn(
          `Skipping membership: group not found for "${membership.groupName}" (keyword "${membership.keywordRaw}")`
        );
        membershipsSkipped += 1;
        continue;
      }

      const keywordId = keywordIdByNorm.get(membership.keywordNorm);
      if (!keywordId) {
        console.warn(
          `Skipping membership: keyword not found for norm "${membership.keywordNorm}" (raw "${membership.keywordRaw}")`
        );
        membershipsSkipped += 1;
        continue;
      }

      try {
        const insertRes = await client.query(
          `insert into keyword_group_members (group_id, group_set_id, keyword_id, note)
           values ($1, $2, $3, null)
           on conflict (group_id, keyword_id) do nothing`,
          [groupId, groupSetId, keywordId]
        );

        if (insertRes.rowCount === 0) {
          membershipsSkipped += 1;
        } else {
          membershipsInserted += 1;
        }
      } catch (error) {
        const message = (error as Error).message || "";
        if (message.includes("Exclusive group set")) {
          let existingGroup: string | null = null;
          try {
            const existingRes = await client.query(
              `select kg.name
               from keyword_group_members kgm
               join keyword_groups kg on kg.group_id = kgm.group_id
               where kgm.group_set_id = $1
                 and kgm.keyword_id = $2
                 and kgm.group_id <> $3
               limit 1`,
              [groupSetId, keywordId, groupId]
            );
            if ((existingRes.rowCount ?? 0) > 0) {
              existingGroup = existingRes.rows[0].name as string;
            }
          } catch (lookupError) {
            console.warn(`Failed to lookup existing group after exclusivity error: ${lookupError}`);
          }

          console.error(
            `Exclusive group set: keyword "${membership.keywordRaw}" already assigned to another group in set "${groupSetName}". ` +
              `Attempted "${membership.groupName}", existing "${existingGroup ?? "unknown"}".`
          );

          exclusivityFailures.push({
            keywordRaw: membership.keywordRaw,
            keywordNorm: membership.keywordNorm,
            groupSetName,
            attemptedGroup: membership.groupName,
            existingGroup,
          });
          continue;
        }

        throw error;
      }
    }

    console.log("Summary:");
    console.log(`Groups created count: ${groupsUpsertedCount}`);
    console.log(`Keywords upserted count: ${keywords.length}`);
    console.log(`Memberships inserted count: ${membershipsInserted}`);
    console.log(`Memberships skipped (duplicates) count: ${membershipsSkipped}`);
    console.log(`Exclusivity failures count: ${exclusivityFailures.length}`);

    if (exclusivityFailures.length > 0) {
      const examples = exclusivityFailures.slice(0, 10);
      console.log("Exclusivity failure examples (first 10):");
      for (const failure of examples) {
        console.log(
          `- keyword="${failure.keywordRaw}" (norm="${failure.keywordNorm}"), set="${failure.groupSetName}", ` +
            `attempted="${failure.attemptedGroup}", existing="${failure.existingGroup ?? "unknown"}"`
        );
      }
      process.exitCode = 1;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
