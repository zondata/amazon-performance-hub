import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  InMemoryIngestionJobRepository,
  getIngestionStateEnvelopeFromJob,
} from './index';
import {
  ManualHelium10RankImportError,
  runManualHelium10RankImport,
  summarizeManualHelium10RankImport,
  validateManualHelium10RankCsv,
} from './manualHelium10RankImport';
import { parseManualHelium10RankImportCliArgs } from './manualHelium10RankImportCli';

const fixturePath = (name: string): string =>
  path.join(process.cwd(), 'src/testing/fixtures/helium10', name);

const NOW_VALUES = [
  '2026-04-19T00:00:00.000Z',
  '2026-04-19T00:00:01.000Z',
  '2026-04-19T00:00:02.000Z',
  '2026-04-19T00:00:03.000Z',
  '2026-04-19T00:00:04.000Z',
  '2026-04-19T00:00:05.000Z',
  '2026-04-19T00:00:06.000Z',
  '2026-04-19T00:00:07.000Z',
];

function buildNow() {
  let index = 0;
  return () => NOW_VALUES[Math.min(index++, NOW_VALUES.length - 1)];
}

function buildCreateJobId() {
  let index = 0;
  return () => `job-${String(++index).padStart(3, '0')}`;
}

describe('manual Helium 10 rank CSV import', () => {
  it('validates and imports a valid single-scope CSV through Stage 3 state', async () => {
    const result = await runManualHelium10RankImport({
      csvPath: fixturePath('h10-rank-valid.csv'),
      accountId: 'sourbear',
      marketplace: 'US',
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(result.summary.inputRowCount).toBe(3);
    expect(result.summary.acceptedRowCount).toBe(3);
    expect(result.summary.duplicateRowCount).toBe(0);
    expect(result.summary.rejectedRowCount).toBe(0);
    expect(result.summary.asin).toBe('B0B2K57W5R');
    expect(result.summary.coverageStart).toBe('2026-04-16');
    expect(result.summary.coverageEnd).toBe('2026-04-17');
    expect(result.summary.jobStatus).toBe('available');
    expect(result.job.watermark?.status).toBe('available');
    expect(getIngestionStateEnvelopeFromJob(result.job.job).collectionState).toBe('available');
  });

  it('fails clearly when a required column is missing', () => {
    expect(() => validateManualHelium10RankCsv(fixturePath('h10-rank-missing-column.csv'))).toThrow(
      /missing required column\(s\): sponsored position/i
    );
  });

  it('fails malformed rank values deterministically', () => {
    try {
      validateManualHelium10RankCsv(fixturePath('h10-rank-malformed.csv'));
      throw new Error('expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ManualHelium10RankImportError);
      const importError = error as ManualHelium10RankImportError;
      expect(importError.code).toBe('invalid_row');
      expect(importError.issues.map((issue) => issue.code)).toContain('invalid_organic_rank');
    }
  });

  it('dedupes repeated identical rows deterministically', async () => {
    const result = await runManualHelium10RankImport({
      csvPath: fixturePath('h10-rank-duplicates.csv'),
      accountId: 'sourbear',
      marketplace: 'US',
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(result.summary.inputRowCount).toBe(4);
    expect(result.summary.acceptedRowCount).toBe(3);
    expect(result.summary.duplicateRowCount).toBe(1);
    expect(result.summary.warningCount).toBe(1);
    expect(result.warnings[0]?.code).toBe('duplicate_row_deduped');
  });

  it('rejects conflicting duplicate rows instead of choosing one silently', () => {
    expect(() => validateManualHelium10RankCsv(fixturePath('h10-rank-conflicting-duplicate.csv'))).toThrow(
      /failed validation/i
    );
  });

  it('reuses the Stage 3 job on rerun of the same file and does not invoke the executor again', async () => {
    const repository = new InMemoryIngestionJobRepository();
    const first = await runManualHelium10RankImport({
      csvPath: fixturePath('h10-rank-valid.csv'),
      accountId: 'sourbear',
      marketplace: 'US',
      repository,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });
    const second = await runManualHelium10RankImport({
      csvPath: fixturePath('h10-rank-valid.csv'),
      accountId: 'sourbear',
      marketplace: 'US',
      repository,
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });

    expect(first.summary.jobResult).toBe('created');
    expect(first.summary.executorInvoked).toBe(true);
    expect(second.summary.jobResult).toBe('reused_existing');
    expect(second.summary.executorInvoked).toBe(false);
    expect(second.summary.jobId).toBe(first.summary.jobId);
  });

  it('prints a safe deterministic CLI-style summary', async () => {
    const result = await runManualHelium10RankImport({
      csvPath: fixturePath('h10-rank-duplicates.csv'),
      accountId: 'sourbear',
      marketplace: 'US',
      now: buildNow(),
      createJobId: buildCreateJobId(),
    });
    const summary = summarizeManualHelium10RankImport(result);

    expect(summary).toContain('Manual Helium 10 rank CSV import completed.');
    expect(summary).toContain('accepted_rows=3');
    expect(summary).toContain('deduped_rows=1');
    expect(summary).toContain('job_status=available');
    expect(summary).not.toMatch(/password|secret|token/i);
  });

  it('parses required CLI arguments', () => {
    expect(
      parseManualHelium10RankImportCliArgs([
        '--file',
        'rank.csv',
        '--account-id=sourbear',
        '--marketplace',
        'US',
      ])
    ).toEqual({
      csvPath: 'rank.csv',
      accountId: 'sourbear',
      marketplace: 'US',
    });
  });
});
