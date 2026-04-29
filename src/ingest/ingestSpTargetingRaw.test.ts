import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const uploadsMaybeSingleMock = vi.fn();
const accountsUpsertMock = vi.fn();
const uploadsInsertSingleMock = vi.fn();
const targetingSelectCountMock = vi.fn();
const targetingUpsertMock = vi.fn();

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
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    };
  }

  if (table === 'accounts') {
    return {
      upsert: accountsUpsertMock,
    };
  }

  if (table === 'sp_targeting_daily_raw') {
    return {
      select: () => {
        const builder = {
          eq: vi.fn(() => targetingSelectCountMock()),
        };
        return builder;
      },
      upsert: targetingUpsertMock,
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    };
  }

  throw new Error(`Unexpected table mock: ${table}`);
});

vi.mock('../db/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: fromMock,
  }),
}));

vi.mock('../ads/parseSpTargetingReport', () => ({
  parseSpTargetingReport: vi.fn(),
}));

vi.mock('./utils', async () => {
  const actual = await vi.importActual<typeof import('./utils')>('./utils');
  return {
    ...actual,
    hashFileSha256: vi.fn(() => 'hash-123'),
  };
});

import { parseSpTargetingReport } from '../ads/parseSpTargetingReport';
import { ingestSpTargetingRaw } from './ingestSpTargetingRaw';

const parseSpTargetingReportMock = vi.mocked(parseSpTargetingReport);

const tempDirs: string[] = [];

const makeTempFile = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-targeting-ingest-'));
  tempDirs.push(dir);
  const filePath = path.join(dir, 'targeting.xlsx');
  fs.writeFileSync(filePath, 'xlsx');
  return filePath;
};

const baseRow = {
  date: '2026-04-10',
  portfolio_name_raw: 'Portfolio A',
  portfolio_name_norm: 'portfolio a',
  campaign_name_raw: 'Campaign A',
  campaign_name_norm: 'campaign a',
  ad_group_name_raw: 'Ad Group A',
  ad_group_name_norm: 'ad group a',
  targeting_raw: 'keyword a',
  targeting_norm: 'keyword a',
  match_type_raw: 'PHRASE',
  match_type_norm: 'PHRASE',
  impressions: 10,
  clicks: 2,
  spend: 3.25,
  sales: 8.5,
  orders: 1,
  units: 1,
  cpc: 1.625,
  ctr: 0.2,
  acos: 0.38,
  roas: 2.61,
  conversion_rate: 0.5,
  top_of_search_impression_share: 0.1,
};

beforeEach(() => {
  fromMock.mockClear();
  uploadsMaybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null });
  accountsUpsertMock.mockReset().mockResolvedValue({ error: null });
  uploadsInsertSingleMock
    .mockReset()
    .mockResolvedValue({ data: { upload_id: 'upload-123' }, error: null });
  targetingSelectCountMock.mockReset().mockResolvedValue({ count: 0, error: null });
  targetingUpsertMock.mockReset().mockResolvedValue({ error: null });
  parseSpTargetingReportMock.mockReset().mockReturnValue({
    rows: [baseRow],
    coverageStart: '2026-04-10',
    coverageEnd: '2026-04-10',
  });
});

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('ingestSpTargetingRaw', () => {
  it('dedupes identical rows and writes conflict-safe inserts', async () => {
    const filePath = makeTempFile();
    parseSpTargetingReportMock.mockReturnValueOnce({
      rows: [baseRow, { ...baseRow }],
      coverageStart: '2026-04-10',
      coverageEnd: '2026-04-10',
    });

    const result = await ingestSpTargetingRaw(
      filePath,
      'test-account',
      '2026-04-10T23:59:59.000Z'
    );

    expect(result.status).toBe('ok');
    expect(result.rowCount).toBe(1);
    expect(result.duplicateIdenticalRowCount).toBe(1);
    expect(targetingUpsertMock).toHaveBeenCalledTimes(1);
    expect(targetingUpsertMock.mock.calls[0]?.[0]).toHaveLength(1);
    expect(targetingUpsertMock.mock.calls[0]?.[1]).toEqual({
      onConflict:
        'account_id,date,campaign_name_norm,ad_group_name_norm,targeting_norm,match_type_norm,exported_at',
      ignoreDuplicates: true,
    });
  });

  it('fails fast when duplicate keys carry conflicting metrics', async () => {
    const filePath = makeTempFile();
    parseSpTargetingReportMock.mockReturnValueOnce({
      rows: [baseRow, { ...baseRow, clicks: 3 }],
      coverageStart: '2026-04-10',
      coverageEnd: '2026-04-10',
    });

    await expect(
      ingestSpTargetingRaw(filePath, 'test-account', '2026-04-10T23:59:59.000Z')
    ).rejects.toThrow(/Duplicate targeting rows with conflicting metrics/);

    expect(targetingUpsertMock).not.toHaveBeenCalled();
  });

  it('returns already ingested for reruns when the same upload already has raw rows', async () => {
    const filePath = makeTempFile();
    uploadsMaybeSingleMock.mockResolvedValueOnce({
      data: {
        upload_id: 'upload-existing',
        account_id: 'test-account',
        source_type: 'sp_targeting',
        file_hash_sha256: 'hash-123',
        exported_at: '2026-04-10T23:59:59.000Z',
      },
      error: null,
    });
    targetingSelectCountMock.mockResolvedValueOnce({ count: 5, error: null });

    const result = await ingestSpTargetingRaw(
      filePath,
      'test-account',
      '2026-04-10T23:59:59.000Z'
    );

    expect(result).toEqual({ status: 'already ingested' });
    expect(targetingUpsertMock).not.toHaveBeenCalled();
  });
});
