import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { SpApiRequestError } from '../connectors/sp-api/types';
import {
  buildMonthlyCatchupWindows,
  buildWeeklyCatchupWindows,
  latestEligibleMonthlyWindow,
  latestEligibleWeeklyWindow,
  runV3SqpSync,
  type SqpPendingRequest,
} from './v3SyncSqp';

class FakeDb {
  readonly updates: Array<{ status: string; params: unknown[] }> = [];
  readonly coverageWrites: unknown[][] = [];
  activeRequest: SqpPendingRequest | null = null;
  pendingRequests: SqpPendingRequest[] = [];
  latestWeeklyEnd: string | null = '2026-04-18';
  latestMonthlyEnd: string | null = null;
  asins = ['B000000001'];
  inserted = 0;

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('from public.products')) {
      return { rows: this.asins.map((asin) => ({ asin })) };
    }
    if (sql.includes('max(week_end)')) {
      return { rows: [{ latest_end: this.latestWeeklyEnd }] };
    }
    if (sql.includes('max(period_end)')) {
      return { rows: [{ latest_end: this.latestMonthlyEnd }] };
    }
    if (sql.includes('from public.sp_api_sqp_report_requests') && sql.includes('limit 1')) {
      return { rows: this.activeRequest ? [toRow(this.activeRequest)] : [] };
    }
    if (sql.includes('from public.sp_api_sqp_report_requests') && sql.includes('order by updated_at')) {
      return { rows: this.pendingRequests.map(toRow) };
    }
    if (sql.includes('insert into public.sp_api_sqp_report_requests')) {
      this.inserted += 1;
      return {
        rows: [
          {
            id: `request-${this.inserted}`,
            account_id: params[0],
            marketplace: params[1],
            asin: params[2],
            source_type: params[3],
            report_period: params[4],
            report_id: params[5],
            start_date: params[6],
            end_date: params[7],
            status: 'requested',
            attempt_count: 0,
          },
        ],
      };
    }
    if (sql.includes('update public.sp_api_sqp_report_requests')) {
      this.updates.push({ status: String(params[1]), params });
      return { rows: [] };
    }
    if (sql.includes('min(week_start)')) {
      return { rows: [{ oldest: '2026-04-12', latest: '2026-04-18', row_count: 10 }] };
    }
    if (sql.includes('min(period_start)')) {
      return { rows: [{ oldest: '2024-01-01', latest: '2024-01-31', row_count: 10 }] };
    }
    if (sql.includes('insert into public.data_coverage_status')) {
      this.coverageWrites.push(params);
      return { rows: [] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  }
}

const toRow = (request: SqpPendingRequest) => ({
  id: request.id,
  account_id: request.accountId,
  marketplace: request.marketplace,
  asin: request.asin,
  source_type: request.sourceType,
  report_period: request.reportPeriod,
  report_id: request.reportId,
  report_document_id: request.reportDocumentId,
  start_date: request.startDate,
  end_date: request.endDate,
  status: request.status,
  attempt_count: request.attemptCount,
});

const pending = (overrides: Partial<SqpPendingRequest> = {}): SqpPendingRequest => ({
  id: 'req-1',
  accountId: 'acct',
  marketplace: 'US',
  asin: 'B000000001',
  sourceType: 'sp_api_sqp_weekly',
  reportPeriod: 'WEEK',
  reportId: 'report-1',
  reportDocumentId: null,
  startDate: '2026-04-19',
  endDate: '2026-04-25',
  status: 'requested',
  attemptCount: 0,
  ...overrides,
});

const baseOptions = {
  accountId: 'acct',
  marketplace: 'US',
  source: 'weekly' as const,
  mode: 'scheduled' as const,
  from: null,
  to: null,
  monthlyBackfillStart: '2024-01-01',
  maxWindowsPerRun: 1,
  maxAsinsPerRun: 5,
  resumePending: false,
  resumePendingOnly: false,
  softUnavailableExit: true,
  dryRun: false,
  maxPollAttempts: 1,
  pollIntervalMs: 0,
  releaseTimezone: 'America/Los_Angeles',
};

describe('V3 SQP window helpers', () => {
  it('builds Sunday through Saturday weekly windows and honors Monday release gate', () => {
    expect(latestEligibleWeeklyWindow(new Date('2026-04-20T06:59:00.000Z'))).toEqual({
      startDate: '2026-04-05',
      endDate: '2026-04-11',
    });
    expect(latestEligibleWeeklyWindow(new Date('2026-04-20T07:00:00.000Z'))).toEqual({
      startDate: '2026-04-12',
      endDate: '2026-04-18',
    });
  });

  it('builds monthly windows and honors first-day release gate', () => {
    expect(
      buildMonthlyCatchupWindows({
        latestExistingPeriodEnd: null,
        from: null,
        to: '2024-01-31',
        monthlyBackfillStart: '2024-01-01',
        now: new Date('2024-02-01T08:00:00.000Z'),
        releaseTimezone: 'America/Los_Angeles',
        maxWindows: 5,
      })
    ).toEqual([{ startDate: '2024-01-01', endDate: '2024-01-31' }]);
    expect(latestEligibleMonthlyWindow(new Date('2026-05-01T06:59:00.000Z'))).toEqual({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });
    expect(latestEligibleMonthlyWindow(new Date('2026-05-01T07:00:00.000Z'))).toEqual({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });
  });

  it('continues weekly from max week_end and does not massive-backfill without --from', () => {
    expect(
      buildWeeklyCatchupWindows({
        latestExistingWeekEnd: '2026-04-18',
        from: null,
        to: null,
        now: new Date('2026-04-27T07:00:00.000Z'),
        releaseTimezone: 'America/Los_Angeles',
        maxWindows: 2,
      }).windows
    ).toEqual([{ startDate: '2026-04-19', endDate: '2026-04-25' }]);
    expect(
      buildWeeklyCatchupWindows({
        latestExistingWeekEnd: null,
        from: null,
        to: null,
        now: new Date('2026-04-27T07:00:00.000Z'),
        releaseTimezone: 'America/Los_Angeles',
        maxWindows: 2,
      }).note
    ).toContain('Provide --from');
  });

  it('starts monthly at 2024-01-01 with no data and continues from next month with data', () => {
    expect(
      buildMonthlyCatchupWindows({
        latestExistingPeriodEnd: null,
        from: null,
        to: null,
        monthlyBackfillStart: '2024-01-01',
        now: new Date('2024-03-01T08:00:00.000Z'),
        releaseTimezone: 'America/Los_Angeles',
        maxWindows: 1,
      })
    ).toEqual([{ startDate: '2024-01-01', endDate: '2024-01-31' }]);
    expect(
      buildMonthlyCatchupWindows({
        latestExistingPeriodEnd: '2024-01-31',
        from: null,
        to: null,
        monthlyBackfillStart: '2024-01-01',
        now: new Date('2024-03-01T08:00:00.000Z'),
        releaseTimezone: 'America/Los_Angeles',
        maxWindows: 1,
      })
    ).toEqual([{ startDate: '2024-02-01', endDate: '2024-02-29' }]);
  });
});

describe('V3 SQP pending and coverage behavior', () => {
  it('does not create a duplicate active request for the same SQP scope', async () => {
    const db = new FakeDb();
    db.activeRequest = pending();
    const createReport = vi.fn();
    await runV3SqpSync(baseOptions, {
      db,
      now: new Date('2026-04-27T07:00:00.000Z'),
      reportRunner: { createReport },
      writeReport: async () => {},
    });
    expect(createReport).not.toHaveBeenCalled();
    expect(db.inserted).toBe(0);
  });

  it('saves pending_timeout when polling stays in progress and later imports DONE reports', async () => {
    const db = new FakeDb();
    db.pendingRequests = [pending()];
    await runV3SqpSync({ ...baseOptions, resumePending: true, resumePendingOnly: true }, {
      db,
      reportRunner: {
        pollReport: async () => ({
          reportId: 'report-1',
          reportType: null,
          processingStatus: 'IN_PROGRESS',
          terminalReached: false,
          maxAttemptsReached: true,
          attemptCount: 1,
          reportDocumentId: null,
        }),
      },
      writeReport: async () => {},
    });
    expect(db.updates.map((update) => update.status)).toContain('pending_timeout');

    const doneDb = new FakeDb();
    doneDb.pendingRequests = [pending()];
    await runV3SqpSync({ ...baseOptions, resumePending: true, resumePendingOnly: true }, {
      db: doneDb,
      reportRunner: {
        pollReport: async () => ({
          reportId: 'report-1',
          reportType: null,
          processingStatus: 'DONE',
          terminalReached: true,
          maxAttemptsReached: false,
          attemptCount: 1,
          reportDocumentId: 'doc-1',
        }),
        downloadAndIngest: async () => ({
          endpoint: 'spApiSqpFirstRealPullAndIngest',
          reportId: 'report-1',
          reportDocumentId: 'doc-1',
          rawArtifactPath: '/tmp/report.csv',
          scopeType: 'asin',
          scopeValue: 'B000000001',
          coverageStart: '2026-04-19',
          coverageEnd: '2026-04-25',
          rowCount: 1,
          uploadId: 'upload-1',
          warningsCount: 0,
        }),
      },
      writeReport: async () => {},
    });
    expect(doneDb.updates.map((update) => update.status)).toContain('imported');
  });

  it('marks expected unavailable as delayed_expected and exits softly', async () => {
    const db = new FakeDb();
    const report = await runV3SqpSync(baseOptions, {
      db,
      now: new Date('2026-04-27T07:00:00.000Z'),
      reportRunner: {
        createReport: async () => {
          throw new SpApiRequestError('api_response_error', 'SQP report is not available yet', {
            status: 400,
            details: { message: 'not published' },
          });
        },
      },
      writeReport: async () => {},
    });
    expect(report.exitCode).toBe(0);
    expect(report.unavailableWindows).toHaveLength(1);
    expect(db.coverageWrites[0]).toContain('sp_api_sqp_weekly');
    expect(db.coverageWrites[0]).toContain('delayed_expected');
    expect(db.coverageWrites[0]).not.toContain('sp_api');
  });
});

describe('V3 SQP workflow wiring', () => {
  it('defines dispatch workflows that run the new scripts with soft unavailable exits', () => {
    const sync = fs.readFileSync(
      path.join(process.cwd(), '.github/workflows/v3_sqp_sync.yml'),
      'utf8'
    );
    const resume = fs.readFileSync(
      path.join(process.cwd(), '.github/workflows/v3_sqp_pending_resume.yml'),
      'utf8'
    );
    expect(sync).toContain('workflow_dispatch');
    expect(sync).toContain('npm run v3:sync:sqp');
    expect(sync).toContain('--soft-unavailable-exit');
    expect(resume).toContain('workflow_dispatch');
    expect(resume).toContain('npm run v3:resume:sqp');
    expect(resume).toContain('--soft-unavailable-exit');
  });

  it('exposes package scripts for sync, resume, and backfill', () => {
    const pkg = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
    expect(pkg).toContain('"v3:sync:sqp"');
    expect(pkg).toContain('"v3:resume:sqp"');
    expect(pkg).toContain('"v3:backfill:sqp"');
  });
});
