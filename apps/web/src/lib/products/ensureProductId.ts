import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type EnsureProductIdArgs = {
  accountId: string;
  marketplace: string;
  asin: string;
  title?: string | null;
  brand?: string | null;
};

export async function ensureProductId({
  accountId,
  marketplace,
  asin,
  title,
  brand,
}: EnsureProductIdArgs): Promise<{ productId: string; created: boolean }> {
  const normalizedAsin = (asin ?? '').trim().toUpperCase();
  if (!normalizedAsin) {
    throw new Error('ASIN is required to ensure product.');
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('products')
    .select('product_id')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .eq('asin', normalizedAsin)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load product: ${existingError.message}`);
  }

  if (existing?.product_id) {
    return { productId: existing.product_id as string, created: false };
  }

  const payload: Record<string, unknown> = {
    account_id: accountId,
    marketplace,
    asin: normalizedAsin,
    status: 'active',
  };

  if (title && title.trim().length > 0) payload.title = title.trim();
  if (brand && brand.trim().length > 0) payload.brand = brand.trim();

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('products')
    .insert(payload)
    .select('product_id')
    .single();

  if (!insertError && inserted?.product_id) {
    return { productId: inserted.product_id as string, created: true };
  }

  const { data: retry, error: retryError } = await supabaseAdmin
    .from('products')
    .select('product_id')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .eq('asin', normalizedAsin)
    .maybeSingle();

  if (retryError || !retry?.product_id) {
    const msg = retryError?.message ?? insertError?.message ?? 'unknown error';
    throw new Error(`Failed to ensure product: ${msg}`);
  }

  return { productId: retry.product_id as string, created: false };
}
