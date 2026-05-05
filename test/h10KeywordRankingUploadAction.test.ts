import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  execFileMock,
  existsSyncMock,
  mkdtempMock,
  rmMock,
  writeFileMock,
} = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  existsSyncMock: vi.fn(),
  mkdtempMock: vi.fn(),
  rmMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
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

import { importH10KeywordRankingUpload } from '../apps/web/src/lib/imports/h10KeywordRankingUpload';
import { uploadH10KeywordRankingAction } from '../apps/web/src/app/imports/h10-keyword-ranking/actions';
import { INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE } from '../apps/web/src/lib/imports/h10KeywordRankingUploadShared';

describe('H10 keyword ranking upload action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mkdtempMock.mockResolvedValue('/tmp/aph-h10-keyword-ranking-123');
    writeFileMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);
    existsSyncMock.mockImplementation((value: string) =>
      value.endsWith('node_modules/.bin/ts-node') ||
      value.endsWith('src/cli/ingestHelium10KeywordTracker.ts')
    );
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: Record<string, unknown>,
        callback: (error: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        callback(null, {
          stdout: JSON.stringify({
            status: 'ok',
            uploadId: 'upload-123',
            rowCount: 3,
            coverageStart: '2026-04-16',
            coverageEnd: '2026-04-17',
            asin: 'B0B2K57W5R',
          }),
          stderr: '',
        });
      }
    );
  });

  it('rejects a missing file', async () => {
    const result = await uploadH10KeywordRankingAction(
      INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE,
      new FormData()
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/select a helium 10 keyword tracker csv/i);
    expect(execFileMock).not.toHaveBeenCalled();
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
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('writes to a controlled temp path and imports through the existing H10 ingest path', async () => {
    const result = await importH10KeywordRankingUpload(
      new File(['Title,ASIN\nx,B0B2K57W5R\n'], '../../unsafe-name.csv', { type: 'text/csv' })
    );

    expect(result.ok).toBe(true);
    expect(writeFileMock).toHaveBeenCalledWith(
      '/tmp/aph-h10-keyword-ranking-123/upload.csv',
      expect.any(Buffer)
    );
    expect(execFileMock).toHaveBeenCalledWith(
      expect.stringMatching(/node_modules\/\.bin\/ts-node$/),
      expect.arrayContaining([
        expect.stringMatching(/src\/cli\/ingestHelium10KeywordTracker\.ts$/),
        '--account-id',
        'sourbear',
        '--marketplace',
        'US',
        '--original-filename',
        'unsafe-name.csv',
        '--json',
        '/tmp/aph-h10-keyword-ranking-123/upload.csv',
      ]),
      expect.objectContaining({
        maxBuffer: 10 * 1024 * 1024,
      }),
      expect.any(Function)
    );
    expect(rmMock).toHaveBeenCalledWith('/tmp/aph-h10-keyword-ranking-123', {
      recursive: true,
      force: true,
    });
  });
});
