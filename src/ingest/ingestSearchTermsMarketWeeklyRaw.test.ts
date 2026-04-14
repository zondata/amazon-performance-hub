import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const uploadsMaybeSingleMock = vi.fn();
const accountsUpsertMock = vi.fn();
const uploadsInsertSingleMock = vi.fn();
const searchTermsUpsertMock = vi.fn();
const searchTermsSelectCountMock = vi.fn();

const fromMock = vi.fn((table: string) => {
  if (table === 'uploads') {
    return {
      select: () => {
        const builder = {
          eq: vi.fn(() => builder),
          maybeSingle: uploadsMaybeSingleMock,
        };
        return builder;
      },
      insert: () => ({
        select: () => ({
          single: uploadsInsertSingleMock,
        }),
      }),
    };
  }

  if (table === 'accounts') {
    return {
      upsert: accountsUpsertMock,
    };
  }

  if (table === 'search_terms_market_weekly_raw') {
    return {
      upsert: searchTermsUpsertMock,
      select: () => {
        const builder = {
          eq: vi.fn(() => searchTermsSelectCountMock()),
        };
        return builder;
      },
    };
  }

  throw new Error(`Unexpected table mock: ${table}`);
});

vi.mock('../db/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: fromMock,
  }),
}));

import { ingestSearchTermsMarketWeeklyRaw } from './ingestSearchTermsMarketWeeklyRaw';
import { ingestSearchTermsMarketWeeklyRawStream } from './ingestSearchTermsMarketWeeklyRaw';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-terms-ingest-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  fromMock.mockClear();
  uploadsMaybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null });
  accountsUpsertMock.mockReset().mockResolvedValue({ error: null });
  uploadsInsertSingleMock
    .mockReset()
    .mockResolvedValue({ data: { upload_id: 'upload-123' }, error: null });
  searchTermsUpsertMock.mockReset().mockResolvedValue({ error: null });
  searchTermsSelectCountMock.mockReset().mockResolvedValue({ count: 0, error: null });
});

describe('ingestSearchTermsMarketWeeklyRaw', () => {
  it('uses conflict-safe writes for duplicate Search Terms rows in the same bounded payload', async () => {
    const tempDir = makeTempDir();
    const rawPath = path.join(tempDir, 'report-dup.search-terms.raw.json.gz');
    fs.writeFileSync(rawPath, 'raw-bytes');

    const duplicateRow = {
      department_name_raw: 'Amazon.com',
      department_name_norm: 'amazon.com',
      search_term_raw: 'vitamin c serum',
      search_term_norm: 'vitamin c serum',
      search_frequency_rank: 1,
      clicked_asin: 'B0TESTASIN',
      click_share_rank: 1,
      click_share: 0.0771,
      conversion_share: 0,
    };

    const result = await ingestSearchTermsMarketWeeklyRaw({
      rawFilePath: rawPath,
      accountId: 'test-account',
      marketplace: 'US',
      exportedAtOverride: '2026-04-14T00:00:00.000Z',
      parsed: {
        marketplaceId: 'ATVPDKIKX0DER',
        weekStart: '2026-04-05',
        weekEnd: '2026-04-11',
        coverageStart: '2026-04-05',
        coverageEnd: '2026-04-11',
        warnings: [],
        rows: [duplicateRow, duplicateRow],
      },
    });

    expect(result).toMatchObject({
      status: 'ok',
      uploadId: 'upload-123',
      rowCount: 2,
      marketplaceId: 'ATVPDKIKX0DER',
    });

    expect(searchTermsUpsertMock).toHaveBeenCalledTimes(1);
    expect(searchTermsUpsertMock.mock.calls[0]?.[0]).toHaveLength(2);
    expect(searchTermsUpsertMock.mock.calls[0]?.[1]).toEqual({
      onConflict:
        'account_id,marketplace,marketplace_id,week_end,department_name_norm,search_term_norm,clicked_asin,click_share_rank,exported_at',
      ignoreDuplicates: true,
    });
  });

  it('resolves metadata before returning already ingested for the streaming path', async () => {
    const tempDir = makeTempDir();
    const rawPath = path.join(tempDir, 'report-already.search-terms.raw.json.gz');
    fs.writeFileSync(rawPath, 'raw-bytes');

    uploadsMaybeSingleMock.mockResolvedValueOnce({
      data: { upload_id: 'upload-existing' },
      error: null,
    });
    searchTermsSelectCountMock.mockResolvedValueOnce({ count: 5, error: null });

    async function* parsedEvents() {
      yield {
        type: 'metadata' as const,
        metadata: {
          marketplaceId: 'ATVPDKIKX0DER',
          weekStart: '2026-04-05',
          weekEnd: '2026-04-11',
          coverageStart: '2026-04-05',
          coverageEnd: '2026-04-11',
          warnings: [],
        },
      };
      throw new Error('stream should not advance past metadata for already-ingested uploads');
    }

    const result = await ingestSearchTermsMarketWeeklyRawStream({
      rawFilePath: rawPath,
      parsedEvents: parsedEvents(),
      accountId: 'test-account',
      marketplace: 'US',
      exportedAtOverride: '2026-04-14T00:00:00.000Z',
    });

    expect(result).toEqual({
      status: 'already ingested',
      uploadId: 'upload-existing',
      coverageStart: '2026-04-05',
      coverageEnd: '2026-04-11',
      warningsCount: 0,
      marketplaceId: 'ATVPDKIKX0DER',
    });
    expect(searchTermsUpsertMock).not.toHaveBeenCalled();
  });
});
