import fs from "fs";
import { Pool } from "pg";

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function getArgs(flag: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === flag && process.argv[i + 1]) {
      values.push(process.argv[i + 1]);
    }
  }
  return values;
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

function parseNumber(value: string, flag: string): number {
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid number for ${flag}: ${value}`);
  }
  return num;
}

function validateDate(value: string, flag: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date format for ${flag}: ${value}`);
  }
  return value;
}

async function main(): Promise<void> {
  const accountId = requireArg("--account_id");
  const marketplace = requireArg("--marketplace");
  const asin = requireArg("--asin");
  const status = (getArg("--status") ?? "active").toLowerCase();
  const brand = getArg("--brand");
  const title = getArg("--title");

  const skuList = getArgs("--sku");
  const isBundle = getArg("--is_bundle");
  const bundleNote = getArg("--bundle_note");

  const costSku = getArg("--cost_sku");
  const currency = getArg("--currency");
  const landedCostPerUnit = getArg("--landed_cost_per_unit");
  const validFrom = getArg("--valid_from");
  const supplierCost = getArg("--supplier_cost");
  const packagingCost = getArg("--packaging_cost");
  const domesticShipCost = getArg("--domestic_ship_cost");
  const intlShipCost = getArg("--intl_ship_cost");
  const dutyTaxCost = getArg("--duty_tax_cost");
  const prepCost = getArg("--prep_cost");
  const assemblyCost = getArg("--assembly_cost");
  const otherCost = getArg("--other_cost");
  const costNotes = getArg("--cost_notes");
  const breakdownJsonPath = getArg("--breakdown_json_path");

  const profileJsonPath = getArg("--profile_json_path");

  if (!['active', 'paused', 'discontinued'].includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const costArgsProvided =
    costSku ||
    currency ||
    landedCostPerUnit ||
    validFrom ||
    supplierCost ||
    packagingCost ||
    domesticShipCost ||
    intlShipCost ||
    dutyTaxCost ||
    prepCost ||
    assemblyCost ||
    otherCost ||
    costNotes ||
    breakdownJsonPath;

  if (costArgsProvided) {
    if (!costSku) throw new Error("--cost_sku is required when providing cost args.");
    if (!currency) throw new Error("--currency is required when providing cost args.");
    if (!landedCostPerUnit) {
      throw new Error("--landed_cost_per_unit is required when providing cost args.");
    }
  }

  if (currency && !["CNY", "USD", "MYR"].includes(currency)) {
    throw new Error(`Invalid currency: ${currency}`);
  }

  if (validFrom) {
    validateDate(validFrom, "--valid_from");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in environment.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    const productRes = await client.query(
      `insert into products (account_id, marketplace, asin, status, brand, title)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (account_id, marketplace, asin)
       do update set status = excluded.status, brand = excluded.brand, title = excluded.title
       returning product_id`,
      [accountId, marketplace, asin, status, brand ?? null, title ?? null]
    );

    if (productRes.rowCount === 0) {
      throw new Error("Product not found after upsert.");
    }

    const productId = productRes.rows[0].product_id as string;

    const skuIdBySku = new Map<string, string>();
    const bundleValue = isBundle ? parseBoolean(isBundle, "--is_bundle") : false;

    for (const sku of skuList) {
      const skuRes = await client.query(
        `insert into product_skus (product_id, account_id, marketplace, sku, status, is_bundle, bundle_note)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (account_id, marketplace, sku)
         do update set product_id = excluded.product_id,
                      status = excluded.status,
                      is_bundle = excluded.is_bundle,
                      bundle_note = excluded.bundle_note
         returning sku_id`,
        [productId, accountId, marketplace, sku, status, bundleValue, bundleNote ?? null]
      );
      skuIdBySku.set(sku, skuRes.rows[0].sku_id as string);
    }

    let costInsertedForSku: string | null = null;
    let costClosedPrevious = false;
    let costSkippedIdentical = false;
    if (costArgsProvided) {
      const targetSku = costSku as string;
      const skuId = skuIdBySku.get(targetSku);
      if (!skuId) {
        throw new Error(`--cost_sku not found among provided --sku values: ${targetSku}`);
      }

      let breakdownJson: unknown = null;
      if (breakdownJsonPath) {
        const jsonRaw = fs.readFileSync(breakdownJsonPath, "utf8");
        breakdownJson = JSON.parse(jsonRaw);
      }

      const validFromValue = validFrom ?? null;
      const landedCostValue = parseNumber(landedCostPerUnit as string, "--landed_cost_per_unit");

      await client.query("begin");
      try {
        const currentRes = await client.query(
          `select cost_id, valid_from, currency, landed_cost_per_unit
           from product_cost_history
           where sku_id = $1
             and valid_to is null
           order by valid_from desc, created_at desc
           limit 1`,
          [skuId]
        );

        if ((currentRes.rowCount ?? 0) > 0) {
          const current = currentRes.rows[0];
          const currentValidFrom = current.valid_from as string;
          const currentCurrency = current.currency as string;
          const currentLanded = Number(current.landed_cost_per_unit);
          const nextValidFrom = validFromValue ? validFromValue : null;

          if (
            nextValidFrom &&
            currentValidFrom === nextValidFrom &&
            currentCurrency === currency &&
            currentLanded === landedCostValue
          ) {
            costSkippedIdentical = true;
          } else {
            await client.query(
              `update product_cost_history
               set valid_to = (coalesce($2::date, current_date) - interval '1 day')::date
               where cost_id = $1`,
              [current.cost_id, validFromValue]
            );
            costClosedPrevious = true;
          }
        }

        if (!costSkippedIdentical) {
          await client.query(
            `insert into product_cost_history (
               sku_id,
               valid_from,
               valid_to,
               currency,
               landed_cost_per_unit,
               supplier_cost,
               packaging_cost,
               domestic_ship_cost,
               intl_ship_cost,
               duty_tax_cost,
               prep_cost,
               assembly_cost,
               other_cost,
               breakdown_lines,
               notes
             ) values (
               $1,
               coalesce($2::date, current_date),
               null,
               $3,
               $4,
               $5,
               $6,
               $7,
               $8,
               $9,
               $10,
               $11,
               $12,
               $13,
               $14
             )`,
            [
              skuId,
              validFromValue,
              currency,
              landedCostValue,
              supplierCost ? parseNumber(supplierCost, "--supplier_cost") : null,
              packagingCost ? parseNumber(packagingCost, "--packaging_cost") : null,
              domesticShipCost ? parseNumber(domesticShipCost, "--domestic_ship_cost") : null,
              intlShipCost ? parseNumber(intlShipCost, "--intl_ship_cost") : null,
              dutyTaxCost ? parseNumber(dutyTaxCost, "--duty_tax_cost") : null,
              prepCost ? parseNumber(prepCost, "--prep_cost") : null,
              assemblyCost ? parseNumber(assemblyCost, "--assembly_cost") : null,
              otherCost ? parseNumber(otherCost, "--other_cost") : null,
              breakdownJson,
              costNotes ?? null,
            ]
          );
          costInsertedForSku = targetSku;
        }

        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    let profileUpdated = false;
    if (profileJsonPath) {
      const profileRaw = fs.readFileSync(profileJsonPath, "utf8");
      const profileJson = JSON.parse(profileRaw);
      await client.query(
        `insert into product_profile (product_id, profile_json)
         values ($1, $2)
         on conflict (product_id)
         do update set profile_json = excluded.profile_json, updated_at = now()`,
        [productId, profileJson]
      );
      profileUpdated = true;
    }

    console.log("Summary:");
    console.log(`Product ID: ${productId}`);
    if (skuList.length > 0) {
      console.log("SKUs processed:");
      for (const sku of skuList) {
        const skuId = skuIdBySku.get(sku);
        console.log(`- ${sku} => ${skuId}`);
      }
    } else {
      console.log("SKUs processed: none");
    }
    console.log(
      `Cost row inserted: ${costInsertedForSku ? `yes (sku ${costInsertedForSku})` : "no"}`
    );
    console.log(`Previous current row closed: ${costClosedPrevious ? "yes" : "no"}`);
    console.log(`Skipped because identical: ${costSkippedIdentical ? "yes" : "no"}`);
    console.log(`Profile updated: ${profileUpdated ? "yes" : "no"}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
