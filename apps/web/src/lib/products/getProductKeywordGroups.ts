import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type KeywordGroupSetRow = {
  group_set_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_exclusive: boolean;
  created_at: string | null;
};

type KeywordGroupSummary = KeywordGroupSetRow & {
  group_count: number;
  keyword_count: number;
};

type KeywordGroupSummaryResult = {
  product_id?: string;
  group_sets: KeywordGroupSummary[];
  active_set?: KeywordGroupSummary;
  multiple_active: boolean;
};

export const getProductKeywordGroups = async ({
  accountId,
  marketplace,
  asin,
}: {
  accountId: string;
  marketplace: string;
  asin: string;
}): Promise<KeywordGroupSummaryResult> => {
  const result: KeywordGroupSummaryResult = {
    group_sets: [],
    multiple_active: false,
  };

  const { data: productRow, error: productError } = await supabaseAdmin
    .from('products')
    .select('product_id')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .eq('asin', asin)
    .maybeSingle();

  if (productError || !productRow?.product_id) {
    return result;
  }

  const productId = productRow.product_id as string;
  result.product_id = productId;

  const { data: sets, error: setError } = await supabaseAdmin
    .from('keyword_group_sets')
    .select('group_set_id,name,description,is_active,is_exclusive,created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (setError || !sets || sets.length === 0) {
    return result;
  }

  const setRows = sets as KeywordGroupSetRow[];
  const setIds = setRows.map((row) => row.group_set_id);

  const groupCounts = new Map<string, number>();
  const keywordCounts = new Map<string, number>();

  if (setIds.length > 0) {
    try {
      const { data: groups } = await supabaseAdmin
        .from('keyword_groups')
        .select('group_set_id')
        .in('group_set_id', setIds);

      (groups ?? []).forEach((row) => {
        if (!row.group_set_id) return;
        groupCounts.set(row.group_set_id, (groupCounts.get(row.group_set_id) ?? 0) + 1);
      });
    } catch {
      // ignore
    }

    try {
      const { data: members } = await supabaseAdmin
        .from('keyword_group_members')
        .select('group_set_id')
        .in('group_set_id', setIds);

      (members ?? []).forEach((row) => {
        if (!row.group_set_id) return;
        keywordCounts.set(
          row.group_set_id,
          (keywordCounts.get(row.group_set_id) ?? 0) + 1
        );
      });
    } catch {
      // ignore
    }
  }

  const summaries = setRows.map((row) => ({
    ...row,
    group_count: groupCounts.get(row.group_set_id) ?? 0,
    keyword_count: keywordCounts.get(row.group_set_id) ?? 0,
  }));

  result.group_sets = summaries;

  const activeSets = summaries.filter((row) => row.is_active);
  if (activeSets.length > 0) {
    result.active_set = activeSets[0];
    result.multiple_active = activeSets.length > 1;
  } else {
    result.active_set = summaries[0];
  }

  return result;
};

export type { KeywordGroupSummary, KeywordGroupSummaryResult };
