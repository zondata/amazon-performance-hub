import fs from 'node:fs';
import path from 'node:path';

import { getSupabaseClient } from '../db/supabaseClient';
import { chunkArray, hashFileSha256 } from './utils';
import { retryAsync, isTransientSupabaseError, formatRetryError } from '../lib/retry';

export type SearchTermsMarketWeeklyRow = {
  department_name_raw: string;
  department_name_norm: string;
  search_term_raw: string;
  search_term_norm: string;
  search_frequency_rank: number;
  clicked_asin: string;
  click_share_rank: number;
  click_share: number;
  conversion_share: number;
};

export type SearchTermsMarketWeeklyParseResult = {
  marketplaceId: string;
  weekStart: string;
  weekEnd: string;
  coverageStart: string;
  coverageEnd: string;
  rows: SearchTermsMarketWeeklyRow[];
  warnings: string[];
};

export type SearchTermsMarketWeeklyParseMetadata = Omit<
  SearchTermsMarketWeeklyParseResult,
  'rows'
>;

export type SearchTermsMarketWeeklyParseEvent =
  | {
      type: 'metadata';
      metadata: SearchTermsMarketWeeklyParseMetadata;
    }
  | {
      type: 'rows';
      rows: SearchTermsMarketWeeklyRow[];
    };

export type SearchTermsMarketWeeklyIngestResult = {
  status: 'ok' | 'already ingested';
  uploadId?: string;
  rowCount?: number;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  warningsCount?: number;
  marketplaceId?: string;
};

const SEARCH_TERMS_MARKET_WEEKLY_RAW_ON_CONFLICT =
  'account_id,marketplace,marketplace_id,week_end,department_name_norm,search_term_norm,clicked_asin,click_share_rank,exported_at';

async function writeSearchTermsMarketWeeklyChunk(
  rows: Array<Record<string, unknown>>
) {
  const client = getSupabaseClient();
  const { error } = await client
    .from('search_terms_market_weekly_raw')
    .upsert(rows, {
      onConflict: SEARCH_TERMS_MARKET_WEEKLY_RAW_ON_CONFLICT,
      ignoreDuplicates: true,
    });
  if (error) {
    throw new Error(`Failed inserting search_terms_market_weekly_raw: ${error.message}`);
  }
}

export async function ingestSearchTermsMarketWeeklyRaw(args: {
  rawFilePath: string;
  parsed: SearchTermsMarketWeeklyParseResult;
  accountId: string;
  marketplace: string;
  exportedAtOverride?: string;
}): Promise<SearchTermsMarketWeeklyIngestResult> {
  const client = getSupabaseClient();
  const fileHash = hashFileSha256(args.rawFilePath);
  const filename = path.basename(args.rawFilePath);

  const { data: existingUpload, error: existingError } = await retryAsync(
    () =>
      client
        .from('uploads')
        .select('upload_id')
        .eq('account_id', args.accountId)
        .eq('file_hash_sha256', fileHash)
        .maybeSingle(),
    {
      retries: 3,
      delaysMs: [1000, 3000, 7000],
      shouldRetry: isTransientSupabaseError,
      onRetry: ({ attempt, error, delayMs }) => {
        console.warn(
          `Retrying upload lookup (attempt ${attempt}/3, ${delayMs}ms): ${formatRetryError(error)}`
        );
      },
    }
  );

  if (existingError) {
    throw new Error(`Failed to check existing upload: ${existingError.message}`);
  }

  const stats = fs.statSync(args.rawFilePath);
  const exportedAt = args.exportedAtOverride ?? stats.mtime.toISOString();

  const { error: accountError } = await client
    .from('accounts')
    .upsert({ account_id: args.accountId, marketplace: args.marketplace }, { onConflict: 'account_id' });
  if (accountError) {
    throw new Error(`Failed to upsert account: ${accountError.message}`);
  }

  let uploadId = existingUpload?.upload_id as string | undefined;
  if (!uploadId) {
    const uploadPayload = {
      account_id: args.accountId,
      source_type: 'search_terms',
      original_filename: filename,
      file_hash_sha256: fileHash,
      exported_at: exportedAt,
      coverage_start: args.parsed.coverageStart,
      coverage_end: args.parsed.coverageEnd,
      snapshot_date: null,
    };

    const { data: uploadRow, error: uploadError } = await client
      .from('uploads')
      .insert(uploadPayload)
      .select('upload_id')
      .single();
    if (uploadError) {
      throw new Error(`Failed to insert upload: ${uploadError.message}`);
    }
    uploadId = uploadRow.upload_id;
  }

  if (!uploadId) {
    throw new Error('Failed to resolve upload_id after insert.');
  }

  const rowsToInsert = args.parsed.rows.map((row) => ({
    upload_id: uploadId,
    account_id: args.accountId,
    marketplace: args.marketplace,
    marketplace_id: args.parsed.marketplaceId,
    week_start: args.parsed.weekStart,
    week_end: args.parsed.weekEnd,
    department_name_raw: row.department_name_raw,
    department_name_norm: row.department_name_norm,
    search_term_raw: row.search_term_raw,
    search_term_norm: row.search_term_norm,
    search_frequency_rank: row.search_frequency_rank,
    clicked_asin: row.clicked_asin,
    click_share_rank: row.click_share_rank,
    click_share: row.click_share,
    conversion_share: row.conversion_share,
    exported_at: exportedAt,
  }));

  for (const chunk of chunkArray(rowsToInsert, 500)) {
    await writeSearchTermsMarketWeeklyChunk(chunk);
  }

  return {
    status: 'ok',
    uploadId,
    rowCount: rowsToInsert.length,
    coverageStart: args.parsed.coverageStart,
    coverageEnd: args.parsed.coverageEnd,
    warningsCount: args.parsed.warnings.length,
    marketplaceId: args.parsed.marketplaceId,
  };
}

export async function ingestSearchTermsMarketWeeklyRawStream(args: {
  rawFilePath: string;
  parsedEvents: AsyncIterable<SearchTermsMarketWeeklyParseEvent>;
  accountId: string;
  marketplace: string;
  exportedAtOverride?: string;
}): Promise<SearchTermsMarketWeeklyIngestResult> {
  const client = getSupabaseClient();
  const fileHash = hashFileSha256(args.rawFilePath);
  const filename = path.basename(args.rawFilePath);

  const { data: existingUpload, error: existingError } = await retryAsync(
    () =>
      client
        .from('uploads')
        .select('upload_id')
        .eq('account_id', args.accountId)
        .eq('file_hash_sha256', fileHash)
        .maybeSingle(),
    {
      retries: 3,
      delaysMs: [1000, 3000, 7000],
      shouldRetry: isTransientSupabaseError,
      onRetry: ({ attempt, error, delayMs }) => {
        console.warn(
          `Retrying upload lookup (attempt ${attempt}/3, ${delayMs}ms): ${formatRetryError(error)}`
        );
      },
    }
  );

  if (existingError) {
    throw new Error(`Failed to check existing upload: ${existingError.message}`);
  }

  const stats = fs.statSync(args.rawFilePath);
  const exportedAt = args.exportedAtOverride ?? stats.mtime.toISOString();

  const { error: accountError } = await client
    .from('accounts')
    .upsert({ account_id: args.accountId, marketplace: args.marketplace }, { onConflict: 'account_id' });
  if (accountError) {
    throw new Error(`Failed to upsert account: ${accountError.message}`);
  }

  let uploadId = existingUpload?.upload_id as string | undefined;
  let metadata: SearchTermsMarketWeeklyParseMetadata | null = null;
  let rowCount = 0;

  for await (const event of args.parsedEvents) {
    if (event.type === 'metadata') {
      if (metadata) {
        throw new Error('Received duplicate Search Terms parse metadata event.');
      }

      metadata = event.metadata;

      if (existingUpload?.upload_id) {
        const { count, error: countError } = await client
          .from('search_terms_market_weekly_raw')
          .select('upload_id', { count: 'exact', head: true })
          .eq('upload_id', existingUpload.upload_id);
        if (countError) {
          throw new Error(`Failed to check existing Search Terms rows: ${countError.message}`);
        }
        if ((count ?? 0) > 0) {
          return {
            status: 'already ingested',
            uploadId: existingUpload.upload_id,
            coverageStart: metadata.coverageStart,
            coverageEnd: metadata.coverageEnd,
            warningsCount: metadata.warnings.length,
            marketplaceId: metadata.marketplaceId,
          };
        }
      }

      if (!uploadId) {
        const uploadPayload = {
          account_id: args.accountId,
          source_type: 'search_terms',
          original_filename: filename,
          file_hash_sha256: fileHash,
          exported_at: exportedAt,
          coverage_start: metadata.coverageStart,
          coverage_end: metadata.coverageEnd,
          snapshot_date: null,
        };

        const { data: uploadRow, error: uploadError } = await client
          .from('uploads')
          .insert(uploadPayload)
          .select('upload_id')
          .single();
        if (uploadError) {
          throw new Error(`Failed to insert upload: ${uploadError.message}`);
        }
        uploadId = uploadRow.upload_id;
      }

      continue;
    }

    if (!metadata) {
      throw new Error('Search Terms parse stream emitted rows before metadata.');
    }

    if (!uploadId) {
      throw new Error('Failed to resolve upload_id before Search Terms row insertion.');
    }

    if (event.rows.length === 0) {
      continue;
    }

    const rowsToInsert = event.rows.map((row) => ({
      upload_id: uploadId,
      account_id: args.accountId,
      marketplace: args.marketplace,
      marketplace_id: metadata!.marketplaceId,
      week_start: metadata!.weekStart,
      week_end: metadata!.weekEnd,
      department_name_raw: row.department_name_raw,
      department_name_norm: row.department_name_norm,
      search_term_raw: row.search_term_raw,
      search_term_norm: row.search_term_norm,
      search_frequency_rank: row.search_frequency_rank,
      clicked_asin: row.clicked_asin,
      click_share_rank: row.click_share_rank,
      click_share: row.click_share,
      conversion_share: row.conversion_share,
      exported_at: exportedAt,
    }));

    for (const chunk of chunkArray(rowsToInsert, 500)) {
      await writeSearchTermsMarketWeeklyChunk(chunk);
    }

    rowCount += rowsToInsert.length;
  }

  if (!metadata) {
    throw new Error('Search Terms parse stream completed without metadata.');
  }

  if (!uploadId) {
    throw new Error('Search Terms parse stream completed without upload_id resolution.');
  }

  if (rowCount === 0) {
    throw new Error('Search Terms parse stream completed without any rows to ingest.');
  }

  return {
    status: 'ok',
    uploadId,
    rowCount,
    coverageStart: metadata.coverageStart,
    coverageEnd: metadata.coverageEnd,
    warningsCount: metadata.warnings.length,
    marketplaceId: metadata.marketplaceId,
  };
}
