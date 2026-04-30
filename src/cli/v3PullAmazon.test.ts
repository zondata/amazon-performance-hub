import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  classifyAdsPendingFailure,
  classifyRetailPendingFailure,
  deriveAdsImplementedCoverageResult,
  deriveCoverageSourceResult,
  extractImportedAdsSourceTypesFromSteps,
  parseV3PullAmazonArgs,
} from './v3PullAmazon';
import {
  ACTIVE_PENDING_REQUEST_STATUSES,
  classifyPendingRequestAge,
  classifyPendingRequestAgeByClock,
  parseResumeAmazonArgs,
  shouldWaitForRetryAfter,
} from './v3ResumeAmazon';
import {
  classifyPendingHealthRows,
  parsePendingHealthArgs,
} from './v3CheckAdsPendingHealth';

describe('parseV3PullAmazonArgs', () => {
  it('parses an explicit manual command', () => {
    const args = parseV3PullAmazonArgs([
      '--account-id',
      'sourbear',
      '--marketplace',
      'US',
      '--from',
      '2026-04-21',
      '--to',
      '2026-04-21',
      '--sources',
      'sales,ads',
      '--mode',
      'manual',
    ]);

    expect(args.accountId).toBe('sourbear');
    expect(args.marketplace).toBe('US');
    expect(args.from).toBe('2026-04-21');
    expect(args.to).toBe('2026-04-21');
    expect(args.sources).toEqual(['sales', 'ads']);
    expect(args.mode).toBe('manual');
    expect(args.dryRun).toBe(false);
  });

  it('applies the recent preset defaults', () => {
    const args = parseV3PullAmazonArgs([
      '--account-id=sourbear',
      '--marketplace=US',
      '--preset=recent',
      '--dry-run',
    ]);

    expect(args.sources).toEqual(['ads', 'sales', 'sqp', 'settings']);
    expect(args.mode).toBe('dry-run');
    expect(args.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(args.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('parses diagnose mode without changing the selected sync mode', () => {
    const args = parseV3PullAmazonArgs([
      '--account-id=sourbear',
      '--marketplace=US',
      '--from=2026-04-21',
      '--to=2026-04-21',
      '--sources=ads',
      '--mode=manual',
      '--diagnose',
    ]);

    expect(args.sources).toEqual(['ads']);
    expect(args.mode).toBe('manual');
    expect(args.diagnose).toBe(true);
  });

  it('parses resume-pending for ads reruns', () => {
    const args = parseV3PullAmazonArgs([
      '--account-id=sourbear',
      '--marketplace=US',
      '--from=2026-04-21',
      '--to=2026-04-21',
      '--sources=ads',
      '--mode=manual',
      '--resume-pending',
    ]);

    expect(args.sources).toEqual(['ads']);
    expect(args.resumePending).toBe(true);
  });

  it('parses soft-pending-exit for scheduled retries', () => {
    const args = parseV3PullAmazonArgs([
      '--account-id=sourbear',
      '--marketplace=US',
      '--from=2026-04-21',
      '--to=2026-04-21',
      '--sources=ads',
      '--mode=scheduled',
      '--soft-pending-exit',
    ]);

    expect(args.softPendingExit).toBe(true);
  });

  it('rejects unsupported sources', () => {
    expect(() =>
      parseV3PullAmazonArgs([
        '--account-id=sourbear',
        '--marketplace=US',
        '--from=2026-04-21',
        '--to=2026-04-21',
        '--sources=foo',
      ])
    ).toThrow(/Unsupported --sources/);
  });
});

describe('v3-amazon-data-sync workflow', () => {
  const workflowPath = path.resolve(
    process.cwd(),
    '.github/workflows/v3-amazon-data-sync.yml'
  );
  const pendingWorkflowPath = path.resolve(
    process.cwd(),
    '.github/workflows/v3_ads_pending_resume.yml'
  );
  const verificationWorkflowPath = path.resolve(
    process.cwd(),
    '.github/workflows/v3-ads-loop-verification.yml'
  );
  const runbookPath = path.resolve(
    process.cwd(),
    'docs/V3_AMAZON_DATA_SYNC_RUNBOOK.md'
  );

  it('exists and calls the unified CLI', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('concurrency:');
    expect(workflow).toContain('npm run v3:resume:amazon --');
    expect(workflow).toContain('npm run v3:pull:amazon --');
    expect(workflow).toContain('--sources');
    expect(workflow).toContain('--resume-pending');
    expect(workflow).toContain("--soft-pending-exit");
    expect(workflow).toContain("ADS_API_REPORT_MAX_ATTEMPTS: '3'");
    expect(workflow).toContain("ADS_API_REPORT_POLL_INTERVAL_MS: '1000'");
  });

  it('creates a scheduled pending-resume workflow', () => {
    const workflow = fs.readFileSync(pendingWorkflowPath, 'utf8');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('concurrency:');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('npm run v3:resume:amazon --');
    expect(workflow).toContain('npm run v3:check:ads-pending-health --');
    expect(workflow).toContain("ADS_API_REPORT_MAX_ATTEMPTS: '3'");
    expect(workflow).toContain("ADS_API_REPORT_POLL_INTERVAL_MS: '1000'");
    expect(workflow).toContain('timeout-minutes: 10');
    expect(workflow).toContain("cron: '7,37 * * * *'");
  });

  it('creates a scheduled ads loop verification workflow', () => {
    const workflow = fs.readFileSync(verificationWorkflowPath, 'utf8');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain("cron: '23 7 * * *'");
    expect(workflow).toContain('timeout-minutes: 10');
    expect(workflow).toContain('npm run v3:verify:ads-loop --');
    expect(workflow).toContain('v3_ads_loop_verification.md');
    expect(workflow).toContain('v3-ads-loop-verification-report');
  });

  it('references secrets by name instead of hardcoding values', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const runbook = fs.readFileSync(runbookPath, 'utf8');
    expect(workflow).toContain('${{ secrets.DATABASE_URL }}');
    expect(workflow).toContain('${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}');
    expect(workflow).toContain('${{ secrets.AMAZON_ADS_CLIENT_SECRET }}');
    expect(workflow).toContain('${{ secrets.SP_API_LWA_CLIENT_SECRET }}');
    expect(workflow).not.toMatch(/advertising-api\.amazon\.com\/v\d/);
    expect(runbook).toContain('`.env.local` must never be committed.');
    expect(runbook).toContain('--diagnose');
    expect(runbook).toContain('--resume-pending');
    expect(runbook).toContain('v3:resume:amazon');
    expect(runbook).toContain('v3:check:ads-pending-health');
    expect(runbook).not.toMatch(/client_secret=/i);
    expect(runbook).not.toMatch(/refresh_token=/i);
  });
});

describe('classifyAdsPendingFailure', () => {
  const buildBaseArgs = (mode: 'manual' | 'scheduled') =>
    parseV3PullAmazonArgs([
      '--account-id=sourbear',
      '--marketplace=US',
      '--from=2026-04-21',
      '--to=2026-04-21',
      '--sources=ads',
      `--mode=${mode}`,
    ]);

  it('keeps manual ads runs blocked and actionable when Amazon leaves the report pending', () => {
    const error = Object.assign(new Error('command failed'), {
      metadata: {
        stderr_tail: [
          'Amazon Ads campaign daily error code: pending_timeout',
          'Amazon Ads campaign daily error: Amazon Ads campaign daily report remained pending after 240 attempts. report_id=23d14b56-c1fe-4469-b530-a6f77cba27d4',
          'Diagnostic artifact path: /tmp/sp-campaign-daily.polling-diagnostic.json',
        ],
      },
    });

    const result = classifyAdsPendingFailure(error, buildBaseArgs('manual'));

    expect(result?.status).toBe('blocked');
    expect(result?.blockers[0]).toContain('report_id=23d14b56-c1fe-4469-b530-a6f77cba27d4');
    expect(result?.notes.join(' ')).toContain('--resume-pending');
  });

  it('treats scheduled ads runs as pending instead of a hard infrastructure failure', () => {
    const error = Object.assign(new Error('command failed'), {
      metadata: {
        stderr_tail: [
          'Amazon Ads campaign daily error code: pending_timeout',
          'Amazon Ads campaign daily error: Amazon Ads campaign daily report remained pending after 240 attempts. report_id=23d14b56-c1fe-4469-b530-a6f77cba27d4',
        ],
      },
    });

    const result = classifyAdsPendingFailure(error, buildBaseArgs('scheduled'));

    expect(result?.status).toBe('pending');
    expect(result?.details.error_code).toBe('pending_timeout');
  });

  it('treats soft-pending-exit as recoverable even outside the default scheduled tolerance', () => {
    const error = Object.assign(new Error('command failed'), {
      metadata: {
        stderr_tail: [
          'Amazon Ads campaign daily error code: pending_timeout',
          'Amazon Ads campaign daily error: Amazon Ads campaign daily report remained pending after 240 attempts. report_id=23d14b56-c1fe-4469-b530-a6f77cba27d4',
        ],
      },
    });
    const args = parseV3PullAmazonArgs([
      '--account-id=sourbear',
      '--marketplace=US',
      '--from=2026-04-21',
      '--to=2026-04-21',
      '--sources=ads',
      '--mode=manual',
      '--soft-pending-exit',
    ]);

    const result = classifyAdsPendingFailure(error, args);

    expect(result?.status).toBe('pending');
  });
});

describe('classifyRetailPendingFailure', () => {
  const buildBaseArgs = (mode: 'manual' | 'scheduled') =>
    parseV3PullAmazonArgs([
      '--account-id=sourbear',
      '--marketplace=US',
      '--from=2026-04-21',
      '--to=2026-04-21',
      '--sources=sales',
      `--mode=${mode}`,
    ]);

  it('keeps manual retail runs blocked but recoverable when Amazon is still processing', () => {
    const error = Object.assign(new Error('retail pending'), {
      code: 'retail_report_pending',
      metadata: {
        report_id: 'retail-report-123',
        processing_status: 'IN_PROGRESS',
      },
      steps: [],
    });

    const result = classifyRetailPendingFailure(error, buildBaseArgs('manual'));

    expect(result?.status).toBe('blocked');
    expect(result?.blockers[0]).toContain('retail-report-123');
    expect(result?.notes.join(' ')).toContain('reuse the saved report id');
  });

  it('treats scheduled retail runs as pending instead of a hard failure', () => {
    const error = Object.assign(new Error('retail pending'), {
      code: 'retail_report_pending',
      metadata: {
        report_id: 'retail-report-123',
        processing_status: 'IN_PROGRESS',
      },
      steps: [],
    });

    const result = classifyRetailPendingFailure(error, buildBaseArgs('scheduled'));

    expect(result?.status).toBe('pending');
    expect(result?.details.processing_status).toBe('IN_PROGRESS');
  });
});

describe('v3ResumeAmazon helpers', () => {
  it('parses the pending-resume command and its max-age control', () => {
    const args = parseResumeAmazonArgs([
      '--account-id=sourbear',
      '--marketplace=US',
      '--mode=scheduled',
      '--soft-pending-exit',
      '--max-pending-age-hours=72',
    ]);

    expect(args.accountId).toBe('sourbear');
    expect(args.marketplace).toBe('US');
    expect(args.mode).toBe('scheduled');
    expect(args.softPendingExit).toBe(true);
    expect(args.maxPendingAgeHours).toBe(72);
  });

  it('keeps the expected active pending status set', () => {
    expect(ACTIVE_PENDING_REQUEST_STATUSES).toEqual([
      'created',
      'requested',
      'pending',
      'polling',
      'pending_timeout',
    ]);
  });

  it('marks over-age pending requests as stale', () => {
    expect(
      classifyPendingRequestAge({
        updatedAt: '2026-04-24T00:00:00.000Z',
        nowIso: '2026-04-28T12:00:00.000Z',
        maxPendingAgeHours: 72,
      })
    ).toBe('stale_expired');

    expect(
      classifyPendingRequestAge({
        updatedAt: '2026-04-27T12:00:00.000Z',
        nowIso: '2026-04-28T12:00:00.000Z',
        maxPendingAgeHours: 72,
      })
    ).toBe('active');
  });

  it('uses created_at as the primary SLA clock when available', () => {
    expect(
      classifyPendingRequestAgeByClock({
        createdAt: '2026-04-24T00:00:00.000Z',
        updatedAt: '2026-04-28T11:59:00.000Z',
        nowIso: '2026-04-28T12:00:00.000Z',
        maxPendingAgeHours: 72,
      })
    ).toBe('stale_expired');
  });

  it('waits for retry_after_at before polling again', () => {
    expect(
      shouldWaitForRetryAfter({
        retryAfterAt: '2026-04-28T13:00:00.000Z',
        nowIso: '2026-04-28T12:00:00.000Z',
      })
    ).toBe(true);
  });
});

describe('v3CheckAdsPendingHealth helpers', () => {
  it('parses completed grace minutes', () => {
    const args = parsePendingHealthArgs([
      '--account-id=sourbear',
      '--marketplace=US',
      '--max-pending-age-hours=72',
      '--completed-grace-minutes=45',
    ]);

    expect(args.completedGraceMinutes).toBe(45);
  });

  it('classifies no rows as healthy', () => {
    const summary = classifyPendingHealthRows({
      rows: [],
      nowIso: '2026-04-28T12:00:00.000Z',
      maxPendingAgeHours: 72,
      completedGraceMinutes: 30,
    });

    expect(summary.exitCode).toBe(0);
    expect(summary.activeRows).toHaveLength(0);
    expect(summary.unhealthyRows).toHaveLength(0);
  });

  it('classifies active campaign pending within SLA as healthy', () => {
    const summary = classifyPendingHealthRows({
      rows: [
        {
          id: '1',
          sourceType: 'ads_api_sp_campaign_daily',
          reportId: 'r1',
          status: 'pending_timeout',
          startDate: '2026-04-21',
          endDate: '2026-04-21',
          createdAt: '2026-04-28T10:00:00.000Z',
          updatedAt: '2026-04-28T11:00:00.000Z',
          completedAt: null,
          retryAfterAt: null,
          notes: null,
        },
      ],
      nowIso: '2026-04-28T12:00:00.000Z',
      maxPendingAgeHours: 72,
      completedGraceMinutes: 30,
    });

    expect(summary.exitCode).toBe(0);
    expect(summary.activeRows).toHaveLength(1);
    expect(summary.unhealthyRows).toHaveLength(0);
  });

  it('classifies active target pending within SLA as healthy', () => {
    const summary = classifyPendingHealthRows({
      rows: [
        {
          id: '1',
          sourceType: 'ads_api_sp_target_daily',
          reportId: 'r2',
          status: 'polling',
          startDate: '2026-04-21',
          endDate: '2026-04-21',
          createdAt: '2026-04-28T10:00:00.000Z',
          updatedAt: '2026-04-28T11:00:00.000Z',
          completedAt: null,
          retryAfterAt: null,
          notes: null,
        },
      ],
      nowIso: '2026-04-28T12:00:00.000Z',
      maxPendingAgeHours: 72,
      completedGraceMinutes: 30,
    });

    expect(summary.exitCode).toBe(0);
    expect(summary.activeRows[0].sourceType).toBe('ads_api_sp_target_daily');
  });

  it('classifies failed as unhealthy', () => {
    const summary = classifyPendingHealthRows({
      rows: [
        {
          id: '1',
          sourceType: 'ads_api_sp_campaign_daily',
          reportId: 'r3',
          status: 'failed',
          startDate: '2026-04-21',
          endDate: '2026-04-21',
          createdAt: '2026-04-28T10:00:00.000Z',
          updatedAt: '2026-04-28T11:00:00.000Z',
          completedAt: null,
          retryAfterAt: null,
          notes: null,
        },
      ],
      nowIso: '2026-04-28T12:00:00.000Z',
      maxPendingAgeHours: 72,
      completedGraceMinutes: 30,
    });

    expect(summary.exitCode).toBe(1);
    expect(summary.unhealthyRows[0].status).toBe('failed');
  });

  it('classifies stale_expired as unhealthy', () => {
    const summary = classifyPendingHealthRows({
      rows: [
        {
          id: '1',
          sourceType: 'ads_api_sp_campaign_daily',
          reportId: 'r4',
          status: 'stale_expired',
          startDate: '2026-04-21',
          endDate: '2026-04-21',
          createdAt: '2026-04-20T10:00:00.000Z',
          updatedAt: '2026-04-28T11:00:00.000Z',
          completedAt: null,
          retryAfterAt: null,
          notes: null,
        },
      ],
      nowIso: '2026-04-28T12:00:00.000Z',
      maxPendingAgeHours: 72,
      completedGraceMinutes: 30,
    });

    expect(summary.exitCode).toBe(1);
    expect(summary.unhealthyRows[0].status).toBe('stale_expired');
  });

  it('classifies completed older than grace and not imported as unhealthy', () => {
    const summary = classifyPendingHealthRows({
      rows: [
        {
          id: '1',
          sourceType: 'ads_api_sp_campaign_daily',
          reportId: 'r5',
          status: 'completed',
          startDate: '2026-04-21',
          endDate: '2026-04-21',
          createdAt: '2026-04-28T10:00:00.000Z',
          updatedAt: '2026-04-28T11:00:00.000Z',
          completedAt: '2026-04-28T11:00:00.000Z',
          retryAfterAt: null,
          notes: null,
        },
      ],
      nowIso: '2026-04-28T12:00:00.000Z',
      maxPendingAgeHours: 72,
      completedGraceMinutes: 30,
    });

    expect(summary.exitCode).toBe(1);
    expect(summary.unhealthyRows[0].status).toBe('completed');
  });
});

describe('coverage isolation helpers', () => {
  it('extracts imported Ads source types from successful ingest steps only', () => {
    expect(
      extractImportedAdsSourceTypesFromSteps([
        {
          name: 'adsapi:ingest-sp-campaign-daily',
          status: 'success',
          started_at: '2026-04-21T00:00:00.000Z',
          finished_at: '2026-04-21T00:00:01.000Z',
          duration_ms: 1000,
          summary: {},
        },
        {
          name: 'adsapi:ingest-sp-target-daily',
          status: 'failed',
          started_at: '2026-04-21T00:00:02.000Z',
          finished_at: '2026-04-21T00:00:03.000Z',
          duration_ms: 1000,
          summary: {},
        },
      ])
    ).toEqual(['ads_api_sp_campaign_daily']);
  });

  it('keeps campaign coverage successful when targeting fails later in the same ads batch', () => {
    const result = deriveAdsImplementedCoverageResult(
      {
        source: 'ads',
        status: 'failed',
        sourceType: 'ads_api',
        sourceName: 'ads',
        syncRunId: 'sync-1',
        rowsRead: 20,
        rowsWritten: 20,
        latestAvailableDate: '2026-04-21',
        missingRanges: [],
        blockers: ['Target ingest failed'],
        warnings: [],
        notes: [],
        details: {
          steps: [
            {
              name: 'adsapi:ingest-sp-campaign-daily',
              status: 'success',
              summary: { upload_id: 'campaign-upload' },
            },
            {
              name: 'adsapi:ingest-sp-target-daily',
              status: 'failed',
              summary: {
                message:
                  'duplicate key value violates unique constraint "sp_targeting_daily_raw_uq"',
              },
            },
          ],
        },
      },
      {
        source: 'ads',
        sourceType: 'ads_api_sp_campaign_daily',
        sourceName: 'sp_campaign_hourly',
        tableName: 'sp_campaign_hourly_fact_gold',
        granularity: 'hourly',
        periodStartExpr: 'date::timestamptz',
        periodEndExpr: 'date::timestamptz',
        expectedDelayHours: 48,
        hasMarketplace: false,
        tableStatusDefault: 'success',
      }
    );

    expect(result?.status).toBe('success');
    expect(result?.notes.join(' ')).toContain('ingested successfully');
    expect(result?.warnings.join(' ')).toContain('overall Ads API batch later failed');
  });

  it('scopes duplicate targeting ingest failures to the targeting row', () => {
    const result = deriveAdsImplementedCoverageResult(
      {
        source: 'ads',
        status: 'failed',
        sourceType: 'ads_api',
        sourceName: 'ads',
        syncRunId: 'sync-1',
        rowsRead: 20,
        rowsWritten: 20,
        latestAvailableDate: '2026-04-21',
        missingRanges: [],
        blockers: ['Target ingest failed'],
        warnings: [],
        notes: ['stderr tail: duplicate key value violates unique constraint'],
        details: {
          steps: [
            {
              name: 'adsapi:ingest-sp-campaign-daily',
              status: 'success',
              summary: { upload_id: 'campaign-upload' },
            },
            {
              name: 'adsapi:ingest-sp-target-daily',
              status: 'failed',
              summary: {
                message:
                  'duplicate key value violates unique constraint "sp_targeting_daily_raw_uq"',
                stderr_tail: ['duplicate key value violates unique constraint'],
              },
            },
          ],
        },
      },
      {
        source: 'ads',
        sourceType: 'ads_api_sp_target_daily',
        sourceName: 'sp_targeting_daily',
        tableName: 'sp_targeting_daily_fact',
        granularity: 'daily',
        periodStartExpr: 'date::timestamptz',
        periodEndExpr: 'date::timestamptz',
        expectedDelayHours: 48,
        hasMarketplace: false,
        tableStatusDefault: 'success',
      }
    );

    expect(result?.status).toBe('failed');
    expect(result?.blockers[0]).toContain('duplicate targeting rows were detected');
    expect(result?.notes.join(' ')).not.toContain('stderr tail');
  });

  it('keeps both campaign and target rows for the same window in the resume SQL', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/cli/v3ResumeAmazon.ts'),
      'utf8'
    );
    expect(source).toContain('distinct on (source_type, start_date, end_date)');
    expect(source).toContain('order by source_type asc, start_date asc, end_date asc, updated_at desc');
  });

  it('does not let unsupported Ads coverage warnings force implemented tables to partial', () => {
    const result = deriveCoverageSourceResult(
      {
        source: 'ads',
        status: 'partial',
        sourceType: 'ads_api',
        sourceName: 'ads',
        syncRunId: 'sync-1',
        rowsRead: 10,
        rowsWritten: 10,
        latestAvailableDate: '2026-04-21',
        missingRanges: [],
        blockers: [],
        warnings: [
          'SP STIS automation is not implemented by the current Ads API pullers.',
        ],
        notes: [],
        details: {},
      },
      {
        source: 'ads',
        sourceType: 'ads_api',
        sourceName: 'sp_campaign_hourly',
        tableName: 'sp_campaign_hourly_fact_gold',
        granularity: 'hourly',
        periodStartExpr: 'date::timestamptz',
        periodEndExpr: 'date::timestamptz',
        expectedDelayHours: 48,
        hasMarketplace: false,
        tableStatusDefault: 'success',
      }
    );

    expect(result.status).toBe('partial');
    expect(result.warnings).toEqual([]);
  });
});
