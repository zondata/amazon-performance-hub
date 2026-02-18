import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type AsinOption = {
  asin: string;
  label: string;
};

type ProductRow = {
  product_id: string;
  asin: string | null;
  title: string | null;
};

type ProfileRow = {
  product_id: string;
  profile_json: unknown | null;
};

const parseShortName = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const shortName = (value as Record<string, unknown>).short_name;
  return typeof shortName === 'string' && shortName.trim().length > 0
    ? shortName.trim()
    : null;
};

export const fetchAsinOptions = async (
  accountId: string,
  marketplace: string
): Promise<AsinOption[]> => {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('product_id,asin,title')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .order('asin', { ascending: true })
    .limit(500);

  if (!error && products && products.length > 0) {
    const rows = products as ProductRow[];
    const productIds = rows.map((row) => row.product_id);
    const shortNameByProductId = new Map<string, string>();

    if (productIds.length > 0) {
      try {
        const { data: profiles, error: profileError } = await supabaseAdmin
          .from('product_profile')
          .select('product_id,profile_json')
          .in('product_id', productIds);

        if (!profileError && profiles) {
          (profiles as ProfileRow[]).forEach((profile) => {
            const shortName = parseShortName(profile.profile_json);
            if (shortName) {
              shortNameByProductId.set(profile.product_id, shortName);
            }
          });
        }
      } catch {
        // ignore
      }
    }

    return rows
      .filter((row) => row.asin)
      .map((row) => {
        const asin = row.asin as string;
        const shortName = shortNameByProductId.get(row.product_id);
        const label = shortName
          ? `${shortName} — ${asin}`
          : row.title
            ? `${asin} — ${row.title}`
            : asin;
        return { asin, label };
      })
      .sort((a, b) => a.asin.localeCompare(b.asin));
  }

  const { data: salesRows } = await supabaseAdmin
    .from('si_sales_trend_daily_latest')
    .select('asin')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .not('asin', 'is', null)
    .order('asin', { ascending: true })
    .limit(2000);

  const seen = new Set<string>();
  const options: AsinOption[] = [];
  (salesRows ?? []).forEach((row) => {
    if (!row.asin) return;
    if (seen.has(row.asin)) return;
    seen.add(row.asin);
    options.push({ asin: row.asin, label: row.asin });
  });

  return options;
};

export type { AsinOption };
