import { describe, expect, it } from 'vitest';

import {
  classifyManualRunFailure,
  describePipelineManualRunBackend,
  deriveRecentManualRunWindow,
  hasGitHubDispatchConfig,
  summarizeManualRunOutput,
  supportsAnyPipelineManualRun,
  supportsPipelineManualRun,
} from '../apps/web/src/lib/pipeline-status/manualRun';

describe('pipeline status manual run helpers', () => {
  it('detects which source types support manual runs', () => {
    expect(supportsPipelineManualRun('ads_api_sp_campaign_daily')).toBe(true);
    expect(supportsPipelineManualRun('sp_api_sales_traffic_daily')).toBe(true);
    expect(supportsPipelineManualRun('ads_api_sb_campaign_daily')).toBe(false);
  });

  it('treats GitHub workflow dispatch as a valid manual-run backend', () => {
    expect(
      hasGitHubDispatchConfig({
        GITHUB_ACTIONS_DISPATCH_TOKEN: 'token',
        GITHUB_ACTIONS_REPO_OWNER: 'acme',
        GITHUB_ACTIONS_REPO_NAME: 'repo',
      } as NodeJS.ProcessEnv)
    ).toBe(true);

    expect(
      supportsAnyPipelineManualRun({
        GITHUB_ACTIONS_DISPATCH_TOKEN: 'token',
        GITHUB_ACTIONS_REPO_OWNER: 'acme',
        GITHUB_ACTIONS_REPO_NAME: 'repo',
      } as NodeJS.ProcessEnv)
    ).toBe(true);

    expect(
      describePipelineManualRunBackend({
        GITHUB_ACTIONS_DISPATCH_TOKEN: 'token',
        GITHUB_ACTIONS_REPO_OWNER: 'acme',
        GITHUB_ACTIONS_REPO_NAME: 'repo',
      } as NodeJS.ProcessEnv)
    ).toEqual({
      available: true,
      backend: 'github_actions',
      missingEnvKeys: [],
    });
  });

  it('reports missing GitHub dispatch env vars when no backend is configured', () => {
    expect(describePipelineManualRunBackend({} as NodeJS.ProcessEnv)).toEqual({
      available: false,
      backend: null,
      missingEnvKeys: [
        'GITHUB_ACTIONS_DISPATCH_TOKEN',
        'GITHUB_ACTIONS_REPO_OWNER',
        'GITHUB_ACTIONS_REPO_NAME',
      ],
    });
  });

  it('builds a recent 30 day window ending on the provided day', () => {
    expect(deriveRecentManualRunWindow(new Date('2026-04-30T12:00:00.000Z'))).toEqual({
      from: '2026-04-01',
      to: '2026-04-30',
    });
  });

  it('treats pending timeout output as pending instead of hard failure', () => {
    expect(
      classifyManualRunFailure('', 'Amazon Ads search term daily error code: pending_timeout')
    ).toBe('pending');
  });

  it('treats retail pipeline summaries with blocked pending state as pending', () => {
    expect(
      classifyManualRunFailure(
        'V3 Amazon data pull summary\nsource=sales | status=blocked | blockers=Amazon SP-API Sales & Traffic report is still pending in Amazon. report_id=retail-report-123',
        ''
      )
    ).toBe('pending');
  });

  it('prefers a meaningful summary line from command output', () => {
    expect(
      summarizeManualRunOutput(
        'Downloaded report successfully\nNormalized artifact saved',
        ''
      )
    ).toBe('Downloaded report successfully');
  });
});
