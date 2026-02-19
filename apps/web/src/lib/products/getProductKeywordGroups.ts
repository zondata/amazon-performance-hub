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

type KeywordGroupSummaryGroup = {
  group_id: string;
  name: string;
  keyword_count: number;
};

type KeywordGroupSummary = KeywordGroupSetRow & {
  group_count: number;
  keyword_count: number;
  groups: KeywordGroupSummaryGroup[];
};

type KeywordGroupSummaryResult = {
  product_id?: string;
  group_sets: KeywordGroupSummary[];
  active_set?: KeywordGroupSummary;
  latest_set?: KeywordGroupSummary;
  effective_set?: KeywordGroupSummary;
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
  const groupKeywordCounts = new Map<string, number>();
  const groupsBySet = new Map<
    string,
    Array<{ group_id: string; name: string; created_at: string | null }>
  >();

  if (setIds.length > 0) {
    try {
      const { data: groups } = await supabaseAdmin
        .from('keyword_groups')
        .select('group_id,group_set_id,name,created_at')
        .in('group_set_id', setIds);

      (groups ?? []).forEach((row) => {
        if (!row.group_set_id || !row.group_id || !row.name) return;
        const setId = row.group_set_id as string;
        groupCounts.set(setId, (groupCounts.get(setId) ?? 0) + 1);
        const existing = groupsBySet.get(setId) ?? [];
        existing.push({
          group_id: row.group_id as string,
          name: row.name as string,
          created_at: (row.created_at as string | null) ?? null,
        });
        groupsBySet.set(setId, existing);
      });
    } catch {
      // ignore
    }

    try {
      const { data: members } = await supabaseAdmin
        .from('keyword_group_members')
        .select('group_id,group_set_id')
        .in('group_set_id', setIds);

      (members ?? []).forEach((row) => {
        if (!row.group_set_id) return;
        const setId = row.group_set_id as string;
        keywordCounts.set(setId, (keywordCounts.get(setId) ?? 0) + 1);
        if (row.group_id) {
          const groupId = row.group_id as string;
          groupKeywordCounts.set(
            groupId,
            (groupKeywordCounts.get(groupId) ?? 0) + 1
          );
        }
      });
    } catch {
      // ignore
    }
  }

  const summaries = setRows.map((row) => {
    const rawGroups = groupsBySet.get(row.group_set_id) ?? [];
    const groups = [...rawGroups].sort((a, b) => {
      const aTimeRaw = a.created_at ? Date.parse(a.created_at) : 0;
      const bTimeRaw = b.created_at ? Date.parse(b.created_at) : 0;
      const aTime = Number.isNaN(aTimeRaw) ? 0 : aTimeRaw;
      const bTime = Number.isNaN(bTimeRaw) ? 0 : bTimeRaw;
      if (aTime !== bTime) return aTime - bTime;
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    });

    return {
      ...row,
      group_count: groupCounts.get(row.group_set_id) ?? rawGroups.length ?? 0,
      keyword_count: keywordCounts.get(row.group_set_id) ?? 0,
      groups: groups.map((group) => ({
        group_id: group.group_id,
        name: group.name,
        keyword_count: groupKeywordCounts.get(group.group_id) ?? 0,
      })),
    };
  });

  result.group_sets = summaries;

  const activeSets = summaries.filter((row) => row.is_active);
  if (activeSets.length > 0) {
    result.active_set = activeSets[0];
    result.multiple_active = activeSets.length > 1;
  }
  result.latest_set = summaries[0];
  result.effective_set = result.active_set ?? result.latest_set;

  return result;
};

export type { KeywordGroupSummary, KeywordGroupSummaryGroup, KeywordGroupSummaryResult };
