import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type GroupSetRow = {
  group_set_id: string;
  name: string;
  is_exclusive: boolean;
  created_at: string | null;
};

type GroupRow = {
  group_id: string;
  name: string;
  created_at: string | null;
};

type MemberRow = {
  group_id: string;
  keyword_id: string;
  note: string | null;
};

type KeywordRow = {
  keyword_id: string;
  keyword_raw: string;
};

type KeywordGroupExportData = {
  product_id: string;
  asin: string;
  title: string | null;
  short_name: string | null;
  group_set: GroupSetRow;
  group_names: string[];
  group_keywords: Record<string, string[]>;
};

type KeywordGroupExportResult =
  | { ok: true; data: KeywordGroupExportData }
  | { ok: false; reason: 'product_not_found' | 'group_set_not_found' };

const parseShortName = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const shortName = (value as Record<string, unknown>).short_name;
  return typeof shortName === 'string' && shortName.trim().length > 0
    ? shortName.trim()
    : null;
};

export const getKeywordGroupExportData = async ({
  accountId,
  marketplace,
  asin,
  groupSetId,
}: {
  accountId: string;
  marketplace: string;
  asin: string;
  groupSetId?: string | null;
}): Promise<KeywordGroupExportResult> => {
  const { data: productRow, error: productError } = await supabaseAdmin
    .from('products')
    .select('product_id,title')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .eq('asin', asin)
    .maybeSingle();

  if (productError) {
    throw new Error(`Failed to load product: ${productError.message}`);
  }

  if (!productRow?.product_id) {
    return { ok: false, reason: 'product_not_found' };
  }

  const productId = productRow.product_id as string;
  let shortName: string | null = null;

  try {
    const { data: profileRow } = await supabaseAdmin
      .from('product_profile')
      .select('profile_json')
      .eq('product_id', productId)
      .maybeSingle();

    shortName = parseShortName(profileRow?.profile_json ?? null);
  } catch {
    shortName = null;
  }

  let groupSet: GroupSetRow | null = null;

  if (groupSetId) {
    const { data: setRow, error: setError } = await supabaseAdmin
      .from('keyword_group_sets')
      .select('group_set_id,name,is_exclusive,created_at')
      .eq('product_id', productId)
      .eq('group_set_id', groupSetId)
      .maybeSingle();

    if (setError) {
      throw new Error(`Failed to load keyword group set: ${setError.message}`);
    }

    if (setRow) {
      groupSet = setRow as GroupSetRow;
    }
  } else {
    const { data: activeSet, error: activeError } = await supabaseAdmin
      .from('keyword_group_sets')
      .select('group_set_id,name,is_exclusive,created_at')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (activeError) {
      throw new Error(
        `Failed to load active keyword group set: ${activeError.message}`
      );
    }

    if (activeSet && activeSet.length > 0) {
      groupSet = activeSet[0] as GroupSetRow;
    } else {
      const { data: latestSet, error: latestError } = await supabaseAdmin
        .from('keyword_group_sets')
        .select('group_set_id,name,is_exclusive,created_at')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestError) {
        throw new Error(
          `Failed to load latest keyword group set: ${latestError.message}`
        );
      }

      if (latestSet && latestSet.length > 0) {
        groupSet = latestSet[0] as GroupSetRow;
      }
    }
  }

  if (!groupSet) {
    return { ok: false, reason: 'group_set_not_found' };
  }

  const { data: groups, error: groupsError } = await supabaseAdmin
    .from('keyword_groups')
    .select('group_id,name,created_at')
    .eq('group_set_id', groupSet.group_set_id)
    .order('created_at', { ascending: true });

  if (groupsError) {
    throw new Error(`Failed to load keyword groups: ${groupsError.message}`);
  }

  const groupRows = (groups ?? []) as GroupRow[];
  const groupNames = groupRows.map((row) => row.name);
  const groupIdToName = new Map<string, string>();
  groupRows.forEach((row) => {
    groupIdToName.set(row.group_id, row.name);
  });

  const { data: members, error: membersError } = await supabaseAdmin
    .from('keyword_group_members')
    .select('group_id,keyword_id,note')
    .eq('group_set_id', groupSet.group_set_id);

  if (membersError) {
    throw new Error(
      `Failed to load keyword group members: ${membersError.message}`
    );
  }

  const memberRows = (members ?? []) as MemberRow[];
  const keywordIds = Array.from(
    new Set(memberRows.map((row) => row.keyword_id).filter(Boolean))
  );

  const keywordIdToRaw = new Map<string, string>();
  if (keywordIds.length > 0) {
    const { data: keywords, error: keywordsError } = await supabaseAdmin
      .from('dim_keyword')
      .select('keyword_id,keyword_raw')
      .in('keyword_id', keywordIds);

    if (keywordsError) {
      throw new Error(`Failed to load keywords: ${keywordsError.message}`);
    }

    (keywords ?? []).forEach((row) => {
      const keyword = row as KeywordRow;
      keywordIdToRaw.set(keyword.keyword_id, keyword.keyword_raw);
    });
  }

  const groupKeywords: Record<string, string[]> = {};
  groupNames.forEach((name) => {
    groupKeywords[name] = [];
  });

  memberRows.forEach((member) => {
    const groupName = groupIdToName.get(member.group_id);
    if (!groupName) return;
    const keywordRaw = keywordIdToRaw.get(member.keyword_id);
    if (!keywordRaw) return;
    groupKeywords[groupName].push(keywordRaw);
  });

  Object.keys(groupKeywords).forEach((key) => {
    groupKeywords[key] = Array.from(new Set(groupKeywords[key])).sort((a, b) =>
      a.localeCompare(b)
    );
  });

  return {
    ok: true,
    data: {
      product_id: productId,
      asin,
      title: (productRow.title ?? null) as string | null,
      short_name: shortName,
      group_set: groupSet,
      group_names: groupNames,
      group_keywords: groupKeywords,
    },
  };
};

export type { KeywordGroupExportData, KeywordGroupExportResult };
