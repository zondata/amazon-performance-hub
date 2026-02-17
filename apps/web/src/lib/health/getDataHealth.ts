import 'server-only';

import fs from 'node:fs/promises';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type UploadStatRow = {
  upload_id: string | null;
  account_id: string | null;
  source_type: string | null;
  original_filename: string | null;
  exported_at: string | null;
  ingested_at: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  snapshot_date: string | null;
  row_count: number | string | null;
};

type MappingIssueSummary = {
  issue_rows: number;
  affected_rows: number;
};

const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toSnapshotDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const latestStamp = (row: UploadStatRow): Date | null => {
  return (
    toDate(row.exported_at) ||
    toSnapshotDate(row.snapshot_date) ||
    toDate(row.ingested_at)
  );
};

const compareUploads = (a: UploadStatRow, b: UploadStatRow): number => {
  const aStamp = latestStamp(a);
  const bStamp = latestStamp(b);
  if (aStamp && bStamp) {
    if (aStamp.getTime() !== bStamp.getTime()) {
      return aStamp.getTime() - bStamp.getTime();
    }
  } else if (aStamp) {
    return 1;
  } else if (bStamp) {
    return -1;
  }

  const aIngested = toDate(a.ingested_at);
  const bIngested = toDate(b.ingested_at);
  if (aIngested && bIngested) {
    return aIngested.getTime() - bIngested.getTime();
  }
  if (aIngested) return 1;
  if (bIngested) return -1;
  return 0;
};

const sumRowCounts = (rows: Array<{ row_count: number | string | null }>): number => {
  return rows.reduce((acc, row) => acc + Number(row.row_count ?? 0), 0);
};

const getMappingIssueSummary = async (
  table: 'sp_mapping_issues' | 'sb_mapping_issues' | 'sd_mapping_issues',
  uploadIds: string[]
): Promise<MappingIssueSummary> => {
  if (uploadIds.length === 0) {
    return { issue_rows: 0, affected_rows: 0 };
  }

  const { data, error, count } = await supabaseAdmin
    .from(table)
    .select('row_count', { count: 'exact' })
    .eq('account_id', env.accountId)
    .in('upload_id', uploadIds);

  if (error) {
    throw new Error(`Failed to load ${table}: ${error.message}`);
  }

  const affectedRows = sumRowCounts(data ?? []);

  return {
    issue_rows: count ?? (data?.length ?? 0),
    affected_rows: affectedRows,
  };
};

const countPendingManifests = async (
  pendingDir: string
): Promise<{ configured: boolean; pending_count?: number }> => {
  try {
    const entries = await fs.readdir(pendingDir, { withFileTypes: true });
    const pendingCount = entries.filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json')
    ).length;

    return { configured: true, pending_count: pendingCount };
  } catch (error) {
    console.error('Failed to read pending reconcile directory', {
      pendingDir,
      error,
    });
    return { configured: true, pending_count: 0 };
  }
};

export const getDataHealth = async () => {
  const { data: uploadStats, error } = await supabaseAdmin
    .from('upload_stats')
    .select(
      'upload_id,account_id,source_type,original_filename,exported_at,ingested_at,coverage_start,coverage_end,snapshot_date,row_count'
    )
    .eq('account_id', env.accountId);

  if (error) {
    throw new Error(`Failed to load upload_stats: ${error.message}`);
  }

  const latestBySource = new Map<string, UploadStatRow>();
  (uploadStats ?? []).forEach((row) => {
    if (!row.source_type) return;
    const existing = latestBySource.get(row.source_type);
    if (!existing || compareUploads(existing, row) < 0) {
      latestBySource.set(row.source_type, row);
    }
  });

  const latestUploadsBySourceType = Array.from(latestBySource.values()).sort(
    (a, b) => (a.source_type || '').localeCompare(b.source_type || '')
  );

  const latestIdForSource = (sourceType: string): string | null => {
    const row = latestBySource.get(sourceType);
    return row?.upload_id ?? null;
  };

  const spUploadIds = [
    'sp_campaign',
    'sp_placement',
    'sp_targeting',
    'sp_stis',
  ]
    .map(latestIdForSource)
    .filter((value): value is string => Boolean(value));

  const sbUploadIds = [
    'sb_campaign',
    'sb_campaign_placement',
    'sb_keyword',
    'sb_stis',
  ]
    .map(latestIdForSource)
    .filter((value): value is string => Boolean(value));

  const sdUploadIds = [
    'sd_campaign',
    'sd_advertised_product',
    'sd_targeting',
    'sd_matched_target',
    'sd_purchased_product',
  ]
    .map(latestIdForSource)
    .filter((value): value is string => Boolean(value));

  const [spIssues, sbIssues, sdIssues] = await Promise.all([
    getMappingIssueSummary('sp_mapping_issues', spUploadIds),
    getMappingIssueSummary('sb_mapping_issues', sbUploadIds),
    getMappingIssueSummary('sd_mapping_issues', sdUploadIds),
  ]);

  const reconcileQueue = env.pendingReconcileDir
    ? await countPendingManifests(env.pendingReconcileDir)
    : { configured: false };

  let spendReconciliation:
    | { enabled: false }
    | { enabled: true; recent_flags_count: number; latest_flag_date?: string }
    | { enabled: true; error: 'timeout' };

  if (!env.enableSpendReconciliation) {
    spendReconciliation = { enabled: false };
  } else {
    try {
      const now = new Date();
      const since = new Date(now);
      since.setDate(now.getDate() - 13);
      const sinceDate = since.toISOString().slice(0, 10);

      const { data, error: spendError } = await supabaseAdmin
        .from('v_ppc_spend_reconciliation_daily')
        .select('date,flag_large_delta')
        .eq('account_id', env.accountId)
        .gte('date', sinceDate)
        .order('date', { ascending: false })
        .limit(500);

      if (spendError) {
        throw spendError;
      }

      const flagged = (data ?? []).filter((row) => row.flag_large_delta);
      spendReconciliation = {
        enabled: true,
        recent_flags_count: flagged.length,
        latest_flag_date: flagged[0]?.date ?? undefined,
      };
    } catch {
      spendReconciliation = { enabled: true, error: 'timeout' };
    }
  }

  return {
    accountId: env.accountId,
    marketplace: env.marketplace,
    latestUploadsBySourceType,
    mappingIssues: {
      sp: spIssues,
      sb: sbIssues,
      sd: sdIssues,
    },
    reconcileQueue,
    spendReconciliation,
  };
};

export type DataHealthResult = Awaited<ReturnType<typeof getDataHealth>>;
