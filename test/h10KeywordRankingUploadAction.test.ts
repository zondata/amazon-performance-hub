import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ingestWithClientMock, mkdtempMock, rmMock, writeFileMock } = vi.hoisted(() => ({
  ingestWithClientMock: vi.fn(),
  mkdtempMock: vi.fn(),
  rmMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    mkdtemp: mkdtempMock,
    writeFile: writeFileMock,
    rm: rmMock,
  },
  mkdtemp: mkdtempMock,
  writeFile: writeFileMock,
  rm: rmMock,
}));

vi.mock('../shared/helium10KeywordTrackerIngestCore', () => ({
  ingestHelium10KeywordTrackerRawWithClient: ingestWithClientMock,
}));

vi.mock('../apps/web/src/lib/env', () => ({
  env: {
    accountId: 'sourbear',
    marketplace: 'US',
  },
}));

vi.mock('../apps/web/src/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      throw new Error('supabaseAdmin should not be called in upload action tests');
    }),
  },
}));

import { parseIngestHelium10KeywordTrackerCliArgs } from '../src/cli/ingestHelium10KeywordTracker';
import { uploadH10KeywordRankingAction } from '../apps/web/src/app/imports/h10-keyword-ranking/actions';
import { importH10KeywordRankingUpload } from '../apps/web/src/lib/imports/h10KeywordRankingUpload';
import { INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE } from '../apps/web/src/lib/imports/h10KeywordRankingUploadShared';

const h10UploadServerPath = path.join(
  process.cwd(),
  'apps/web/src/lib/imports/h10KeywordRankingUpload.ts'
);

describe('H10 keyword ranking upload action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mkdtempMock.mockResolvedValue('/tmp/aph-h10-keyword-ranking-123');
    writeFileMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);
    ingestWithClientMock.mockResolvedValue({
      status: 'ok',
      uploadId: 'upload-123',
      rowCount: 3,
      coverageStart: '2026-04-16',
      coverageEnd: '2026-04-17',
      asin: 'B0B2K57W5R',
    });
  });

  it('rejects a missing file', async () => {
    const result = await uploadH10KeywordRankingAction(
      INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE,
      new FormData()
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/select a helium 10 keyword tracker csv/i);
    expect(ingestWithClientMock).not.toHaveBeenCalled();
  });

  it('rejects a non-csv file', async () => {
    const formData = new FormData();
    formData.set('file', new File(['not,csv'], 'notes.txt', { type: 'text/plain' }));

    const result = await uploadH10KeywordRankingAction(
      INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE,
      formData
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/must be a \.csv file/i);
    expect(ingestWithClientMock).not.toHaveBeenCalled();
  });

  it('writes to a controlled temp path and imports through shared server ingest', async () => {
    const result = await importH10KeywordRankingUpload(
      new File(['Title,ASIN\nx,B0B2K57W5R\n'], '../../unsafe-name.csv', { type: 'text/csv' })
    );

    expect(result.ok).toBe(true);
    expect(writeFileMock).toHaveBeenCalledWith(
      '/tmp/aph-h10-keyword-ranking-123/upload.csv',
      expect.any(Buffer)
    );
    expect(ingestWithClientMock).toHaveBeenCalledWith({
      client: expect.any(Object),
      csvPath: '/tmp/aph-h10-keyword-ranking-123/upload.csv',
      accountId: 'sourbear',
      marketplace: 'US',
      originalFilenameOverride: 'unsafe-name.csv',
    });
    expect(rmMock).toHaveBeenCalledWith('/tmp/aph-h10-keyword-ranking-123', {
      recursive: true,
      force: true,
    });
  });

  it('does not shell out through child_process or ts-node in the web upload path', () => {
    const source = fs.readFileSync(h10UploadServerPath, 'utf8');

    expect(source).toContain('ingestHelium10KeywordTrackerRawWithClient');
    expect(source).not.toContain('node:child_process');
    expect(source).not.toContain('execFile');
    expect(source).not.toContain('ts-node');
  });

  it('keeps CLI json parsing compatible with positional csv arguments', () => {
    expect(
      parseIngestHelium10KeywordTrackerCliArgs([
        '--account-id',
        'sourbear',
        '--marketplace',
        'US',
        '--original-filename',
        'unsafe-name.csv',
        '--json',
        '/tmp/aph-h10-keyword-ranking-123/upload.csv',
      ])
    ).toEqual({
      accountId: 'sourbear',
      marketplace: 'US',
      exportedAt: undefined,
      originalFilename: 'unsafe-name.csv',
      json: true,
      csvPath: '/tmp/aph-h10-keyword-ranking-123/upload.csv',
    });
  });
});
