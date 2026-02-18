import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type SeedProductsResult = {
  totalFactsAsins: number;
  existingProducts: number;
  insertedCount: number;
  skippedCount: number;
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

export async function seedProductsFromSalesLatest({
  accountId,
  marketplace,
}: {
  accountId: string;
  marketplace: string;
}): Promise<SeedProductsResult> {
  const { data: factRows, error: factError } = await supabaseAdmin
    .from('si_sales_trend_daily_latest')
    .select('asin')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .not('asin', 'is', null)
    .limit(10000);

  if (factError) {
    throw new Error(`Failed to load sales ASINs: ${factError.message}`);
  }

  const asinSet = new Set<string>();
  (factRows ?? []).forEach((row) => {
    if (!row.asin) return;
    asinSet.add(String(row.asin).trim().toUpperCase());
  });

  const asins = Array.from(asinSet);

  const { data: productRows, error: productError } = await supabaseAdmin
    .from('products')
    .select('asin')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .limit(20000);

  if (productError) {
    throw new Error(`Failed to load existing products: ${productError.message}`);
  }

  const existingSet = new Set<string>();
  (productRows ?? []).forEach((row) => {
    if (!row.asin) return;
    existingSet.add(String(row.asin).trim().toUpperCase());
  });

  const missing = asins.filter((asin) => !existingSet.has(asin));
  let insertedCount = 0;

  for (const batch of chunk(missing, 200)) {
    if (batch.length === 0) continue;
    const payload = batch.map((asin) => ({
      account_id: accountId,
      marketplace,
      asin,
      status: 'active',
    }));

    const { error } = await supabaseAdmin.from('products').insert(payload);
    if (error) {
      throw new Error(`Failed to insert missing products: ${error.message}`);
    }
    insertedCount += batch.length;
  }

  return {
    totalFactsAsins: asins.length,
    existingProducts: existingSet.size,
    insertedCount,
    skippedCount: asins.length - insertedCount,
  };
}

export type { SeedProductsResult };
