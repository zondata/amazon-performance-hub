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
  readonly insertedRequests: Array<{ asin: string; sourceType: string; startDate: string; endDate: string }> = [];
  activeRequest: SqpPendingRequest | null = null;
  pendingRequests: SqpPendingRequest[] = [];
  latestWeeklyEnd: string | null = '2026-04-18';
  latestMonthlyEnd: string | null = null;
  asins = ['B000000001'];
  completedScopes = new Set<string>();
  activeScopes = new Set<string>();
  rawScopes = new Set<string>();
  inserted = 0;

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('with valid_products')) {
      const sourceType = String(params[4]);
      const startDate = String(params[2]);
      const endDate = String(params[3]);
      return {
        rows: this.asins
          .map((asin) => asin.trim().toUpperCase())
          .filter((asin) => /^[A-Z0-9]{10}$/.test(asin))
          .filter((asin) => !this.rawScopes.has(scope(sourceType, asin, startDate, endDate)))
          .filter((asin) => !this.completedScopes.has(scope(sourceType, asin, startDate, endDate)))
          .sort()
          .map((asin) => ({
            asin,
            has_active_request: this.activeScopes.has(scope(sourceType, asin, startDate, endDate)),
          })),
      };
    }
    if (sql.includes('max(week_end)')) {
      return { rows: [{ latest_end: this.latestWeeklyEnd }] };
    }
    if (sql.includes('max(period_end)')) {
      return { rows: [{ latest_end: this.latestMonthlyEnd }] };
    }
    if (sql.includes('from public.sp_api_sqp_report_requests') && sql.includes('limit 1')) {
      if (this.activeRequest) return { rows: [toRow(this.activeRequest)] };
      const asin = String(params[2]);
      const sourceType = String(params[3]);
      const startDate = String(params[4]);
      const endDate = String(params[5]);
      if (this.activeScopes.has(scope(sourceType, asin, startDate, endDate))) {
        return {
          rows: [
            toRow(pending({
              asin,
              sourceType,
              reportPeriod: sourceType === 'sp_api_sqp_monthly' ? 'MONTH' : 'WEEK',
              startDate,
              endDate,
            })),
          ],
        };
      }
      return { rows: [] };
    }
    if (sql.includes('from public.sp_api_sqp_report_requests') && sql.includes('order by updated_at')) {
      return { rows: this.pendingRequests.map(toRow) };
    }
    if (sql.includes('insert into public.sp_api_sqp_report_requests')) {
      this.inserted += 1;
      this.insertedRequests.push({
        asin: String(params[2]),
        sourceType: String(params[3]),
        startDate: String(params[6]),
        endDate: String(params[7]),
      });
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

const scope = (sourceType: string, asin: string, startDate: string, endDate: string) =>
  `${sourceType}:${asin}:${startDate}:${endDate}`;

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

  it('includes the latest existing weekly window and does not massive-backfill without --from', () => {
    expect(
      buildWeeklyCatchupWindows({
        latestExistingWeekEnd: '2026-04-18',
        from: null,
        to: null,
        now: new Date('2026-04-27T07:00:00.000Z'),
        releaseTimezone: 'America/Los_Angeles',
        maxWindows: 2,
      }).windows
    ).toEqual([
      { startDate: '2026-04-12', endDate: '2026-04-18' },
      { startDate: '2026-04-19', endDate: '2026-04-25' },
    ]);
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

  it('starts monthly at 2024-01-01 with no data and includes the latest month with data', () => {
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
    ).toEqual([{ startDate: '2024-01-01', endDate: '2024-01-31' }]);
  });
});

describe('V3 SQP pending and coverage behavior', () => {
  it('batches missing monthly ASINs for the current month before advancing', async () => {
    const asins = Array.from({ length: 12 }, (_, index) =>
      `B${String(index + 1).padStart(9, '0')}`
    );
    const db = new FakeDb();
    db.asins = asins;
    db.latestMonthlyEnd = null;
    const createReport = vi.fn(async () => ({ reportId: `report-${createReport.mock.calls.length}` }));
    await runV3SqpSync(
      {
        ...baseOptions,
        source: 'monthly',
        mode: 'backfill',
        maxAsinsPerRun: 5,
      },
      {
        db,
        now: new Date('2024-03-01T08:00:00.000Z'),
        reportRunner: {
          createReport,
          pollReport: async ({ reportId }) => ({
            reportId,
            reportType: null,
            processingStatus: 'IN_PROGRESS',
            terminalReached: false,
            maxAttemptsReached: true,
            attemptCount: 1,
            reportDocumentId: null,
          }),
        },
        writeReport: async () => {},
      }
    );
    expect(db.insertedRequests.map((request) => request.asin)).toEqual(asins.slice(0, 5));
    expect(new Set(db.insertedRequests.map((request) => request.startDate))).toEqual(
      new Set(['2024-01-01'])
    );

    const nextDb = new FakeDb();
    nextDb.asins = asins;
    nextDb.latestMonthlyEnd = null;
    for (const asin of asins.slice(0, 5)) {
      nextDb.completedScopes.add(scope('sp_api_sqp_monthly', asin, '2024-01-01', '2024-01-31'));
    }
    await runV3SqpSync(
      {
        ...baseOptions,
        source: 'monthly',
        mode: 'backfill',
        maxAsinsPerRun: 5,
      },
      {
        db: nextDb,
        now: new Date('2024-03-01T08:00:00.000Z'),
        reportRunner: {
          createReport: async () => ({ reportId: 'report-next' }),
          pollReport: async ({ reportId }) => ({
            reportId,
            reportType: null,
            processingStatus: 'IN_PROGRESS',
            terminalReached: false,
            maxAttemptsReached: true,
            attemptCount: 1,
            reportDocumentId: null,
          }),
        },
        writeReport: async () => {},
      }
    );
    expect(nextDb.insertedRequests.map((request) => request.asin)).toEqual(asins.slice(5, 10));
    expect(new Set(nextDb.insertedRequests.map((request) => request.startDate))).toEqual(
      new Set(['2024-01-01'])
    );
  });

  it('does not skip a partially complete latest monthly raw window', async () => {
    const asins = Array.from({ length: 12 }, (_, index) =>
      `B${String(index + 1).padStart(9, '0')}`
    );
    const db = new FakeDb();
    db.asins = asins;
    db.latestMonthlyEnd = '2024-01-31';
    for (const asin of asins.slice(0, 5)) {
      db.rawScopes.add(scope('sp_api_sqp_monthly', asin, '2024-01-01', '2024-01-31'));
    }
    await runV3SqpSync(
      {
        ...baseOptions,
        source: 'monthly',
        mode: 'backfill',
        maxAsinsPerRun: 5,
      },
      {
        db,
        now: new Date('2024-03-01T08:00:00.000Z'),
        reportRunner: {
          createReport: async () => ({ reportId: 'report-monthly' }),
          pollReport: async ({ reportId }) => ({
            reportId,
            reportType: null,
            processingStatus: 'IN_PROGRESS',
            terminalReached: false,
            maxAttemptsReached: true,
            attemptCount: 1,
            reportDocumentId: null,
          }),
        },
        writeReport: async () => {},
      }
    );
    expect(db.insertedRequests.map((request) => request.asin)).toEqual(asins.slice(5, 10));
    expect(new Set(db.insertedRequests.map((request) => request.startDate))).toEqual(
      new Set(['2024-01-01'])
    );
  });

  it('advances monthly when the latest raw window is complete for all ASINs', async () => {
    const asins = Array.from({ length: 12 }, (_, index) =>
      `B${String(index + 1).padStart(9, '0')}`
    );
    const db = new FakeDb();
    db.asins = asins;
    db.latestMonthlyEnd = '2024-01-31';
    for (const asin of asins) {
      db.rawScopes.add(scope('sp_api_sqp_monthly', asin, '2024-01-01', '2024-01-31'));
    }
    await runV3SqpSync(
      {
        ...baseOptions,
        source: 'monthly',
        mode: 'backfill',
        maxAsinsPerRun: 5,
      },
      {
        db,
        now: new Date('2024-03-01T08:00:00.000Z'),
        reportRunner: {
          createReport: async () => ({ reportId: 'report-monthly-next' }),
          pollReport: async ({ reportId }) => ({
            reportId,
            reportType: null,
            processingStatus: 'IN_PROGRESS',
            terminalReached: false,
            maxAttemptsReached: true,
            attemptCount: 1,
            reportDocumentId: null,
          }),
        },
        writeReport: async () => {},
      }
    );
    expect(db.insertedRequests.map((request) => request.asin)).toEqual(asins.slice(0, 5));
    expect(new Set(db.insertedRequests.map((request) => request.startDate))).toEqual(
      new Set(['2024-02-01'])
    );
    expect(new Set(db.insertedRequests.map((request) => request.endDate))).toEqual(
      new Set(['2024-02-29'])
    );
  });

  it('batches missing weekly ASINs for the current week before advancing', async () => {
    const asins = Array.from({ length: 12 }, (_, index) =>
      `B${String(index + 1).padStart(9, '0')}`
    );
    const db = new FakeDb();
    db.asins = asins;
    db.latestWeeklyEnd = '2026-04-25';
    for (const asin of asins.slice(0, 5)) {
      db.rawScopes.add(scope('sp_api_sqp_weekly', asin, '2026-04-19', '2026-04-25'));
    }
    await runV3SqpSync(
      {
        ...baseOptions,
        source: 'weekly',
        maxAsinsPerRun: 5,
      },
      {
        db,
        now: new Date('2026-05-04T07:00:00.000Z'),
        reportRunner: {
          createReport: async () => ({ reportId: 'report-weekly' }),
          pollReport: async ({ reportId }) => ({
            reportId,
            reportType: null,
            processingStatus: 'IN_PROGRESS',
            terminalReached: false,
            maxAttemptsReached: true,
            attemptCount: 1,
            reportDocumentId: null,
          }),
        },
        writeReport: async () => {},
      }
    );
    expect(db.insertedRequests.map((request) => request.asin)).toEqual(asins.slice(5, 10));
    expect(new Set(db.insertedRequests.map((request) => request.startDate))).toEqual(
      new Set(['2026-04-19'])
    );
  });

  it('does not skip a partially complete latest weekly raw window', async () => {
    const asins = Array.from({ length: 12 }, (_, index) =>
      `B${String(index + 1).padStart(9, '0')}`
    );
    const db = new FakeDb();
    db.asins = asins;
    db.latestWeeklyEnd = '2026-04-25';
    for (const asin of asins.slice(0, 5)) {
      db.rawScopes.add(scope('sp_api_sqp_weekly', asin, '2026-04-19', '2026-04-25'));
    }
    await runV3SqpSync(
      {
        ...baseOptions,
        source: 'weekly',
        maxAsinsPerRun: 5,
      },
      {
        db,
        now: new Date('2026-05-11T07:00:00.000Z'),
        reportRunner: {
          createReport: async () => ({ reportId: 'report-weekly-partial' }),
          pollReport: async ({ reportId }) => ({
            reportId,
            reportType: null,
            processingStatus: 'IN_PROGRESS',
            terminalReached: false,
            maxAttemptsReached: true,
            attemptCount: 1,
            reportDocumentId: null,
          }),
        },
        writeReport: async () => {},
      }
    );
    expect(db.insertedRequests.map((request) => request.asin)).toEqual(asins.slice(5, 10));
    expect(new Set(db.insertedRequests.map((request) => request.startDate))).toEqual(
      new Set(['2026-04-19'])
    );
  });

  it('advances weekly when the latest raw window is complete for all ASINs', async () => {
    const asins = Array.from({ length: 12 }, (_, index) =>
      `B${String(index + 1).padStart(9, '0')}`
    );
    const db = new FakeDb();
    db.asins = asins;
    db.latestWeeklyEnd = '2026-04-25';
    for (const asin of asins) {
      db.completedScopes.add(scope('sp_api_sqp_weekly', asin, '2026-04-19', '2026-04-25'));
    }
    await runV3SqpSync(
      {
        ...baseOptions,
        source: 'weekly',
        maxAsinsPerRun: 5,
      },
      {
        db,
        now: new Date('2026-05-11T07:00:00.000Z'),
        reportRunner: {
          createReport: async () => ({ reportId: 'report-weekly-next' }),
          pollReport: async ({ reportId }) => ({
            reportId,
            reportType: null,
            processingStatus: 'IN_PROGRESS',
            terminalReached: false,
            maxAttemptsReached: true,
            attemptCount: 1,
            reportDocumentId: null,
          }),
        },
        writeReport: async () => {},
      }
    );
    expect(db.insertedRequests.map((request) => request.asin)).toEqual(asins.slice(0, 5));
    expect(new Set(db.insertedRequests.map((request) => request.startDate))).toEqual(
      new Set(['2026-04-26'])
    );
    expect(new Set(db.insertedRequests.map((request) => request.endDate))).toEqual(
      new Set(['2026-05-02'])
    );
  });

  it('keeps DONE_NO_DATA retryable during release grace and marks old windows no_data', async () => {
    const recentDb = new FakeDb();
    recentDb.pendingRequests = [pending()];
    await runV3SqpSync({ ...baseOptions, resumePending: true, resumePendingOnly: true }, {
      db: recentDb,
      now: new Date('2026-04-27T07:00:00.000Z'),
      reportRunner: {
        pollReport: async () => ({
          reportId: 'report-1',
          reportType: null,
          processingStatus: 'DONE_NO_DATA',
          terminalReached: true,
          maxAttemptsReached: false,
          attemptCount: 1,
          reportDocumentId: null,
        }),
      },
      writeReport: async () => {},
    });
    expect(recentDb.updates.map((update) => update.status)).toContain('unavailable');
    expect(recentDb.coverageWrites[0]).toContain('delayed_expected');

    const oldDb = new FakeDb();
    oldDb.pendingRequests = [pending()];
    await runV3SqpSync({ ...baseOptions, resumePending: true, resumePendingOnly: true }, {
      db: oldDb,
      now: new Date('2026-05-10T07:00:00.000Z'),
      reportRunner: {
        pollReport: async () => ({
          reportId: 'report-1',
          reportType: null,
          processingStatus: 'DONE_NO_DATA',
          terminalReached: true,
          maxAttemptsReached: false,
          attemptCount: 1,
          reportDocumentId: null,
        }),
      },
      writeReport: async () => {},
    });
    expect(oldDb.updates.map((update) => update.status)).toContain('no_data');
    expect(oldDb.coverageWrites[0]).toContain('no_data');
  });

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
