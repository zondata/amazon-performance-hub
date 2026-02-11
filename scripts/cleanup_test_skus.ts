import { Pool } from "pg";

const ACCOUNT_ID = "A10515NC1ZVACY";
const MARKETPLACE = "US";
const TARGET_SKUS = ["SB-FRAME-WHT-VER-2", "SB-FRAME-WHT-VER-3"];
const KEEP_SKU = "SB-FRAME-WHT-VER";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in environment.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    console.log("Pre-check: target SKUs");
    const preSkus = await client.query(
      `select sku_id, sku, created_at
       from product_skus
       where account_id = $1
         and marketplace = $2
         and sku = any($3::text[])
       order by sku`,
      [ACCOUNT_ID, MARKETPLACE, TARGET_SKUS]
    );
    console.table(preSkus.rows);

    const preCost = await client.query(
      `select sku_id, count(*)::int as cost_rows
       from product_cost_history
       where sku_id = any(
         select sku_id
         from product_skus
         where account_id = $1
           and marketplace = $2
           and sku = any($3::text[])
       )
       group by sku_id
       order by sku_id`,
      [ACCOUNT_ID, MARKETPLACE, TARGET_SKUS]
    );
    console.log("Pre-check: cost rows by sku_id");
    console.table(preCost.rows);

    const delRes = await client.query(
      `delete from product_skus
       where account_id = $1
         and marketplace = $2
         and sku = any($3::text[])
       returning sku_id, sku`,
      [ACCOUNT_ID, MARKETPLACE, TARGET_SKUS]
    );
    console.log("Deleted SKUs:");
    console.table(delRes.rows);

    console.log("Post-check: target SKUs should be gone");
    const postSkus = await client.query(
      `select sku_id, sku, created_at
       from product_skus
       where account_id = $1
         and marketplace = $2
         and sku = any($3::text[])
       order by sku`,
      [ACCOUNT_ID, MARKETPLACE, TARGET_SKUS]
    );
    console.table(postSkus.rows);

    console.log("Post-check: keep SKU should exist");
    const keepSku = await client.query(
      `select sku_id, sku, created_at
       from product_skus
       where account_id = $1
         and marketplace = $2
         and sku = $3
       limit 1`,
      [ACCOUNT_ID, MARKETPLACE, KEEP_SKU]
    );
    console.table(keepSku.rows);

    console.log("Post-check: v_product_sku_cost_current for account/marketplace");
    const viewRows = await client.query(
      `select sku_id, sku, effective_sku_id, currency, landed_cost_per_unit, valid_from, valid_to
       from v_product_sku_cost_current
       where account_id = $1
         and marketplace = $2
       order by sku`,
      [ACCOUNT_ID, MARKETPLACE]
    );
    console.table(viewRows.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
