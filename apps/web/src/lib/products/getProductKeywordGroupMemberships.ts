import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type KeywordGroupRow = {
  group_id: string | null;
  group_set_id: string | null;
  name: string | null;
};

type KeywordGroupMemberRow = {
  group_set_id: string | null;
  group_id: string | null;
  keyword_id: string | null;
};

type KeywordGroupMembership = {
  group_set_id: string;
  group_id: string;
  keyword_id: string;
};

type KeywordGroupSummary = {
  group_id: string;
  name: string;
};

type ProductKeywordGroupMemberships = {
  groupsBySet: Record<string, KeywordGroupSummary[]>;
  memberships: KeywordGroupMembership[];
};

export const getProductKeywordGroupMemberships = async ({
  groupSetIds,
}: {
  groupSetIds: string[];
}): Promise<ProductKeywordGroupMemberships> => {
  const result: ProductKeywordGroupMemberships = {
    groupsBySet: {},
    memberships: [],
  };

  if (!groupSetIds || groupSetIds.length === 0) {
    return result;
  }

  const { data: groups, error: groupError } = await supabaseAdmin
    .from('keyword_groups')
    .select('group_id,group_set_id,name')
    .in('group_set_id', groupSetIds);

  if (!groupError && groups) {
    (groups as KeywordGroupRow[]).forEach((row) => {
      if (!row.group_set_id || !row.group_id || !row.name) return;
      const existing = result.groupsBySet[row.group_set_id] ?? [];
      existing.push({ group_id: row.group_id, name: row.name });
      result.groupsBySet[row.group_set_id] = existing;
    });
  }

  const { data: members, error: memberError } = await supabaseAdmin
    .from('keyword_group_members')
    .select('group_set_id,group_id,keyword_id')
    .in('group_set_id', groupSetIds);

  if (!memberError && members) {
    const output: KeywordGroupMembership[] = [];
    (members as KeywordGroupMemberRow[]).forEach((row) => {
      if (!row.group_set_id || !row.group_id || !row.keyword_id) return;
      output.push({
        group_set_id: row.group_set_id,
        group_id: row.group_id,
        keyword_id: row.keyword_id,
      });
    });
    result.memberships = output;
  }

  return result;
};

export type { ProductKeywordGroupMemberships, KeywordGroupMembership, KeywordGroupSummary };
