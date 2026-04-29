import { describe, expect, it } from 'vitest';

import {
  buildPipelineStatusRows,
  type PipelineStatusSpec,
} from '../apps/web/src/lib/pipeline-status/model';

describe('buildPipelineStatusRows', () => {
  it('marks unsupported sources as not implemented instead of failed', () => {
    const specs: PipelineStatusSpec[] = [
      {
        sourceGroup: 'SP placement daily',
        sourceType: 'ads_api_sp_placement_daily',
        targetTable: 'sp_placement_daily_fact',
        implementationStatus: 'not_implemented',
      },
    ];

    const rows = buildPipelineStatusRows({
      specs,
      coverageRows: [],
      pendingRows: [],
      nowIso: '2026-04-29T12:00:00.000Z',
    }).rows;

    expect(rows[0].implementationStatus).toBe('not_implemented');
    expect(rows[0].currentCoverageStatus).toBe('not implemented');
    expect(rows[0].nextAction).toContain('automation');
  });

  it('surfaces active pending counts and retry_after_at for implemented sources', () => {
    const specs: PipelineStatusSpec[] = [
      {
        sourceGroup: 'SP target daily',
        sourceType: 'ads_api_sp_target_daily',
        targetTable: 'sp_targeting_daily_fact',
        implementationStatus: 'implemented',
        pendingSourceType: 'ads_api_sp_target_daily',
      },
    ];

    const rows = buildPipelineStatusRows({
      specs,
      coverageRows: [
        {
          sourceType: 'ads_api_sp_target_daily',
          tableName: 'sp_targeting_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:00:00.000Z',
          lastSyncRunId: 'sync-1',
          notes: null,
        },
      ],
      pendingRows: [
        {
          sourceType: 'ads_api_sp_target_daily',
          status: 'pending',
          createdAt: '2026-04-29T09:00:00.000Z',
          retryAfterAt: '2026-04-29T12:15:00.000Z',
        },
      ],
      syncRunsById: new Map([
        [
          'sync-1',
          {
            syncRunId: 'sync-1',
            status: 'succeeded',
            dataStatus: 'live',
            finishedAt: '2026-04-29T11:00:00.000Z',
            errorCode: null,
            errorMessage: null,
            resultJson: {},
            rawJson: {},
          },
        ],
      ]),
      nowIso: '2026-04-29T12:00:00.000Z',
    }).rows;

    expect(rows[0].activePendingCount).toBe(1);
    expect(rows[0].retryAfterAt).toBe('2026-04-29T12:15:00.000Z');
    expect(rows[0].nextAction).toContain('retry_after_at');
  });

  it('keeps campaign status successful when targeting failed later in the same ads batch', () => {
    const pageData = buildPipelineStatusRows({
      specs: [
        {
          sourceGroup: 'SP campaign daily',
          sourceType: 'ads_api_sp_campaign_daily',
          targetTable: 'sp_campaign_hourly_fact_gold',
          implementationStatus: 'implemented',
          pendingSourceType: 'ads_api_sp_campaign_daily',
        },
        {
          sourceGroup: 'SP target daily',
          sourceType: 'ads_api_sp_target_daily',
          targetTable: 'sp_targeting_daily_fact',
          implementationStatus: 'implemented',
          pendingSourceType: 'ads_api_sp_target_daily',
        },
      ],
      coverageRows: [
        {
          sourceType: 'ads_api_sp_campaign_daily',
          tableName: 'sp_campaign_hourly_fact_gold',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:00:00.000Z',
          lastSyncRunId: 'ads-run-1',
          notes:
            'SP Campaign Daily ingested successfully for the latest available period. | SP Campaign Daily ingested successfully, but the overall Ads API batch later failed at SP Targeting Daily ingest.',
        },
        {
          sourceType: 'ads_api_sp_target_daily',
          tableName: 'sp_targeting_daily_fact',
          lastStatus: 'failed',
          freshnessStatus: 'blocked',
          latestPeriodEnd: '2026-04-25T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-26T11:00:00.000Z',
          lastSyncRunId: 'ads-run-1',
          notes:
            'SP Targeting Daily failed because duplicate targeting rows were detected during ingest. | Campaign data already loaded remains usable. Fix the targeting ingest dedupe behavior, then rerun the Ads API refresh.',
        },
      ],
      pendingRows: [],
      syncRunsById: new Map([
        [
          'ads-run-1',
          {
            syncRunId: 'ads-run-1',
            status: 'failed',
            dataStatus: 'failed',
            finishedAt: '2026-04-29T11:05:00.000Z',
            errorCode: 'source_failed',
            errorMessage: 'Target ingest failed',
            resultJson: {
              source_details: {
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
                      code: 'source_failed',
                      message:
                        'duplicate key value violates unique constraint "sp_targeting_daily_raw_uq"',
                      stderr_tail: ['duplicate key value violates unique constraint'],
                    },
                  },
                ],
              },
            },
            rawJson: {},
          },
        ],
      ]),
      batchRun: {
        syncRunId: 'ads-run-1',
        status: 'failed',
        dataStatus: 'failed',
        finishedAt: '2026-04-29T11:05:00.000Z',
        errorCode: 'source_failed',
        errorMessage: 'Target ingest failed',
        resultJson: {
          source_details: {
            steps: [
              {
                name: 'adsapi:ingest-sp-target-daily',
                status: 'failed',
                summary: { message: 'duplicate key value violates unique constraint' },
              },
            ],
          },
        },
        rawJson: {},
      },
      nowIso: '2026-04-29T12:00:00.000Z',
    });

    const [campaignRow, targetRow] = pageData.rows;
    expect(campaignRow.sourceGroupStatus).toBe('success');
    expect(campaignRow.lastSuccessfulImportTime).toBe('2026-04-29T11:00:00.000Z');
    expect(campaignRow.currentCoverageStatus).toBe('updated');
    expect(campaignRow.friendlySummary).toContain('ingested successfully');
    expect(campaignRow.friendlySummary).not.toContain('stderr tail');

    expect(targetRow.sourceGroupStatus).toBe('failed');
    expect(targetRow.friendlySummary).toContain('duplicate targeting rows');
    expect(targetRow.technicalDetails).toContain('sp_targeting_daily_raw_uq');
    expect(pageData.batchSummary?.status).toBe('failed');
  });
});
