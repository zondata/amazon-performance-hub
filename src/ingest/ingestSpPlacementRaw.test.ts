import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const uploadsMaybeSingleMock = vi.fn();
const accountsUpsertMock = vi.fn();
const uploadsInsertSingleMock = vi.fn();
const placementSelectCountMock = vi.fn();
const placementUpsertMock = vi.fn();

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

  if (table === 'sp_placement_daily_raw') {
    return {
      select: () => {
        const builder = {
          eq: vi.fn(() => placementSelectCountMock()),
        };
        return builder;
      },
      upsert: placementUpsertMock,
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

vi.mock('../ads/parseSpPlacementReport', () => ({
  parseSpPlacementReport: vi.fn(),
}));

vi.mock('./utils', async () => {
  const actual = await vi.importActual<typeof import('./utils')>('./utils');
  return {
    ...actual,
    hashFileSha256: vi.fn(() => 'hash-123'),
  };
});

import { parseSpPlacementReport } from '../ads/parseSpPlacementReport';
import { ingestSpPlacementRaw } from './ingestSpPlacementRaw';

const parseSpPlacementReportMock = vi.mocked(parseSpPlacementReport);

const tempDirs: string[] = [];

const makeTempFile = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-placement-ingest-'));
  tempDirs.push(dir);
  const filePath = path.join(dir, 'placement.xlsx');
  fs.writeFileSync(filePath, 'xlsx');
  return filePath;
};

const baseRow = {
  date: '2026-04-10',
  portfolio_name_raw: 'Portfolio A',
  portfolio_name_norm: 'portfolio a',
  campaign_name_raw: 'Campaign A',
  campaign_name_norm: 'campaign a',
  bidding_strategy: 'dynamic bids - down only',
  placement_raw: 'Top of search (first page)',
  placement_raw_norm: 'top of search first page',
  placement_code: 'TOS',
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
};

beforeEach(() => {
  fromMock.mockClear();
  uploadsMaybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null });
  accountsUpsertMock.mockReset().mockResolvedValue({ error: null });
  uploadsInsertSingleMock
    .mockReset()
    .mockResolvedValue({ data: { upload_id: 'upload-123' }, error: null });
  placementSelectCountMock.mockReset().mockResolvedValue({ count: 0, error: null });
  placementUpsertMock.mockReset().mockResolvedValue({ error: null });
  parseSpPlacementReportMock.mockReset().mockReturnValue({
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

describe('ingestSpPlacementRaw', () => {
  it('dedupes identical rows and writes conflict-safe upserts', async () => {
    const filePath = makeTempFile();
    parseSpPlacementReportMock.mockReturnValueOnce({
      rows: [baseRow, { ...baseRow }],
      coverageStart: '2026-04-10',
      coverageEnd: '2026-04-10',
    });

    const result = await ingestSpPlacementRaw(
      filePath,
      'test-account',
      '2026-04-10T23:59:59.000Z'
    );

    expect(result.status).toBe('ok');
    expect(result.rowCount).toBe(1);
    expect(result.duplicateIdenticalRowCount).toBe(1);
    expect(placementUpsertMock).toHaveBeenCalledTimes(1);
    expect(placementUpsertMock.mock.calls[0]?.[0]).toHaveLength(1);
    expect(placementUpsertMock.mock.calls[0]?.[1]).toEqual({
      onConflict:
        'account_id,date,campaign_name_norm,placement_code,placement_raw_norm,exported_at',
      ignoreDuplicates: true,
    });
  });

  it('aggregates duplicate keys that carry conflicting metrics', async () => {
    const filePath = makeTempFile();
    parseSpPlacementReportMock.mockReturnValueOnce({
      rows: [baseRow, { ...baseRow, clicks: 3 }],
      coverageStart: '2026-04-10',
      coverageEnd: '2026-04-10',
    });

    const result = await ingestSpPlacementRaw(
      filePath,
      'test-account',
      '2026-04-10T23:59:59.000Z'
    );

    expect(result.status).toBe('ok');
    expect(result.rowCount).toBe(1);
    expect(result.duplicateAggregatedRowCount).toBe(1);
    expect(placementUpsertMock).toHaveBeenCalledTimes(1);
    expect(placementUpsertMock.mock.calls[0]?.[0]?.[0]).toMatchObject({
      impressions: 20,
      clicks: 5,
      spend: 6.5,
      sales: 17,
      orders: 2,
      units: 2,
    });
  });

  it('returns already ingested for reruns when the same upload already has raw rows', async () => {
    const filePath = makeTempFile();
    uploadsMaybeSingleMock.mockResolvedValueOnce({
      data: {
        upload_id: 'upload-existing',
        exported_at: '2026-04-10T23:59:59.000Z',
      },
      error: null,
    });
    placementSelectCountMock.mockResolvedValueOnce({ count: 5, error: null });

    const result = await ingestSpPlacementRaw(
      filePath,
      'test-account',
      '2026-04-10T23:59:59.000Z'
    );

    expect(result).toEqual({ status: 'already ingested' });
    expect(placementUpsertMock).not.toHaveBeenCalled();
  });
});
