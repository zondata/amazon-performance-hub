import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

type TableRow = {
  table_name: string;
  table_type: string;
};

type ColumnRow = {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  ordinal_position: number;
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL. Set it before running schema snapshot.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const tablesResult = await client.query<TableRow>(
      `
      select table_name, table_type
      from information_schema.tables
      where table_schema='public'
      order by table_type, table_name;
      `
    );

    const columnsResult = await client.query<ColumnRow>(
      `
      select table_name, column_name, data_type, is_nullable, ordinal_position
      from information_schema.columns
      where table_schema='public'
      order by table_name, ordinal_position;
      `
    );

    const columnsByTable = new Map<string, ColumnRow[]>();
    for (const row of columnsResult.rows) {
      if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, []);
      columnsByTable.get(row.table_name)?.push(row);
    }

    const lines: string[] = [];
    lines.push("# Supabase Schema Snapshot");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("");

    for (const table of tablesResult.rows) {
      lines.push(`## ${table.table_name} (${table.table_type})`);
      lines.push("| column | type | nullable |");
      lines.push("|---|---|---|");
      const cols = columnsByTable.get(table.table_name) ?? [];
      for (const col of cols) {
        lines.push(`| ${col.column_name} | ${col.data_type} | ${col.is_nullable} |`);
      }
      lines.push("");
    }

    const docsDir = path.join(process.cwd(), "docs");
    fs.mkdirSync(docsDir, { recursive: true });
    const outPath = path.join(docsDir, "schema_snapshot.md");
    fs.writeFileSync(outPath, lines.join("\n"));
    console.log(`Wrote ${outPath}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
