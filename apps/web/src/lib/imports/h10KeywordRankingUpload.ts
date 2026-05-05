import 'server-only';

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { env } from '@/lib/env';
import {
  INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE,
  type H10KeywordRankingUploadState,
} from '@/lib/imports/h10KeywordRankingUploadShared';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  ingestHelium10KeywordTrackerRawWithClient,
  type Helium10KeywordTrackerIngestResult,
} from '../../../../../shared/helium10KeywordTrackerIngestCore';

const CSV_CONTENT_TYPES = new Set([
  '',
  'application/csv',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
]);

export type H10KeywordRankingStatus = {
  latestObservedDate: string | null;
  rowCount: number | null;
  latestAsinCount: number | null;
  statusMessage: string | null;
};

const buildSummary = (result: Helium10KeywordTrackerIngestResult) => {
  const parts: string[] = [];
  if (result.asin) parts.push(`ASIN ${result.asin}`);
  if (typeof result.rowCount === 'number') {
    parts.push(`${result.rowCount.toLocaleString('en-US')} rows`);
  }
  if (result.coverageStart || result.coverageEnd) {
    parts.push(`${result.coverageStart ?? '—'} -> ${result.coverageEnd ?? '—'}`);
  }
  if (result.uploadId) {
    parts.push(`upload ${result.uploadId}`);
  }
  return parts.length > 0 ? parts.join(' • ') : null;
};

const normalizeOriginalFilename = (rawName: string): string => {
  const base = path.basename(rawName.replace(/\\/g, '/').trim());
  return base || 'upload.csv';
};

const isCsvUpload = (fileName: string, contentType: string): string | null => {
  if (!fileName.toLowerCase().endsWith('.csv')) {
    return 'Upload must be a .csv file.';
  }
  if (!CSV_CONTENT_TYPES.has(contentType.trim().toLowerCase())) {
    return `Upload must be a CSV file. Received content type ${contentType || 'unknown'}.`;
  }
  return null;
};

export async function importH10KeywordRankingUpload(
  file: File
): Promise<H10KeywordRankingUploadState> {
  const originalFileName = normalizeOriginalFilename(file.name || 'upload.csv');
  const csvError = isCsvUpload(originalFileName, file.type || '');
  if (csvError) {
    return {
      ...INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE,
      tone: 'error',
      message: csvError,
      fileName: originalFileName,
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aph-h10-keyword-ranking-'));
  const tempPath = path.join(tempDir, 'upload.csv');

  try {
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempPath, Buffer.from(arrayBuffer));

    const ingestResult = await ingestHelium10KeywordTrackerRawWithClient({
      client: supabaseAdmin,
      csvPath: tempPath,
      accountId: env.accountId,
      marketplace: env.marketplace,
      originalFilenameOverride: originalFileName,
    });

    return {
      ok: true,
      tone: ingestResult.status === 'already ingested' ? 'warning' : 'success',
      message:
        ingestResult.status === 'already ingested'
          ? 'This CSV was already ingested. No new rows were imported.'
          : 'CSV imported successfully.',
      summary: buildSummary(ingestResult),
      fileName: originalFileName,
      asin: ingestResult.asin ?? null,
      rowCount: ingestResult.rowCount ?? null,
      warningCount: null,
      coverageStart: ingestResult.coverageStart ?? null,
      coverageEnd: ingestResult.coverageEnd ?? null,
      uploadId: ingestResult.uploadId ?? null,
    };
  } catch (error) {
    return {
      ...INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE,
      tone: 'error',
      message: error instanceof Error ? error.message : 'Import failed.',
      fileName: originalFileName,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function getH10KeywordRankingStatus(): Promise<H10KeywordRankingStatus> {
  let latestObservedDate: string | null = null;
  let rowCount: number | null = null;
  let latestAsinCount: number | null = null;
  const issues: string[] = [];

  const latestDateQuery = await supabaseAdmin
    .from('h10_keyword_rank_daily_latest')
    .select('observed_date')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .order('observed_date', { ascending: false })
    .limit(1);

  if (latestDateQuery.error) {
    issues.push(`Latest observed date failed: ${latestDateQuery.error.message}`);
  } else {
    latestObservedDate = latestDateQuery.data?.[0]?.observed_date ?? null;
  }

  const rowCountQuery = await supabaseAdmin
    .from('h10_keyword_rank_daily_latest')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace);

  if (rowCountQuery.error) {
    issues.push(`Row count failed: ${rowCountQuery.error.message}`);
  } else {
    rowCount = rowCountQuery.count ?? 0;
  }

  if (latestObservedDate) {
    const latestAsinQuery = await supabaseAdmin
      .from('h10_keyword_rank_daily_latest')
      .select('asin')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .eq('observed_date', latestObservedDate);

    if (latestAsinQuery.error) {
      issues.push(`Latest ASIN count failed: ${latestAsinQuery.error.message}`);
    } else {
      latestAsinCount = new Set(
        (latestAsinQuery.data ?? [])
          .map((row) => row.asin)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      ).size;
    }
  }

  return {
    latestObservedDate,
    rowCount,
    latestAsinCount,
    statusMessage: issues.length > 0 ? issues.join(' ') : null,
  };
}
