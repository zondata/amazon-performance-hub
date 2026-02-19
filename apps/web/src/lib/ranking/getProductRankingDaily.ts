import 'server-only';

import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type ProductRankingRow = {
  observed_date: string | null;
  keyword_raw: string | null;
  keyword_norm: string | null;
  keyword_id: string | null;
  organic_rank_value: number | null;
  organic_rank_kind: string | null;
  organic_rank_raw: string | null;
  sponsored_pos_value: number | null;
  sponsored_pos_kind: string | null;
  sponsored_pos_raw: string | null;
  search_volume: number | null;
};

export const getProductRankingDaily = async ({
  accountId,
  marketplace,
  asin,
  start,
  end,
}: {
  accountId: string;
  marketplace: string;
  asin: string;
  start: string;
  end: string;
}): Promise<ProductRankingRow[]> => {
  const query = supabaseAdmin
    .from('h10_keyword_rank_daily_with_dims')
    .select(
      'observed_date,keyword_raw,keyword_norm,keyword_id,organic_rank_value,organic_rank_kind,organic_rank_raw,sponsored_pos_value,sponsored_pos_kind,sponsored_pos_raw,search_volume'
    )
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .eq('asin', asin)
    .eq('rn_daily', 1)
    .gte('observed_date', start)
    .lte('observed_date', end)
    .order('observed_date', { ascending: false });

  const rows = await fetchAllRows<ProductRankingRow>((from, to) =>
    query.range(from, to)
  );

  return rows;
};

export type { ProductRankingRow };
