import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type ChangeListItem = {
  change_id: string;
  occurred_at: string;
  channel: string;
  change_type: string;
  summary: string;
  why: string | null;
  source: string;
};

export type ChangeFilters = {
  start?: string | null;
  end?: string | null;
  source?: string | null;
  q?: string | null;
  change_type?: string | null;
  channel?: string | null;
  limit?: number | null;
  useDefaultRange?: boolean;
};

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

export const getChanges = async (filters: ChangeFilters = {}) => {
  const {
    start,
    end,
    source,
    q,
    change_type,
    channel,
    limit = 200,
    useDefaultRange = true,
  } = filters;

  const today = new Date();
  const defaultEnd = dateOnly(today);
  const defaultStart = dateOnly(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));

  const startDate = start ?? (useDefaultRange ? defaultStart : null);
  const endDate = end ?? (useDefaultRange ? defaultEnd : null);

  let query = supabaseAdmin
    .from('log_changes')
    .select('change_id,occurred_at,channel,change_type,summary,why,source')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .order('occurred_at', { ascending: false })
    .limit(limit ?? 200);

  if (startDate) {
    query = query.gte('occurred_at', `${startDate}T00:00:00Z`);
  }

  if (endDate) {
    query = query.lte('occurred_at', `${endDate}T23:59:59Z`);
  }

  if (source && source !== 'all') {
    query = query.eq('source', source);
  }

  if (change_type) {
    query = query.eq('change_type', change_type);
  }

  if (channel) {
    query = query.eq('channel', channel);
  }

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(`summary.ilike.%${term}%,why.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load changes: ${error.message}`);
  }

  return (data ?? []) as ChangeListItem[];
};
