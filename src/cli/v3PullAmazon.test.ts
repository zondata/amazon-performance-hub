import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { classifyAdsPendingFailure, parseV3PullAmazonArgs } from './v3PullAmazon';

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
  const runbookPath = path.resolve(
    process.cwd(),
    'docs/V3_AMAZON_DATA_SYNC_RUNBOOK.md'
  );

  it('exists and calls the unified CLI', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('npm run v3:pull:amazon --');
    expect(workflow).toContain('--sources');
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
});
