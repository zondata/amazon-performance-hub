import {
  AdsApiCampaignIngestGateError,
  runAdsApiCampaignIngestGate,
  type AdsApiCampaignIngestGateResult,
} from './index';

export const buildCampaignIngestGateSuccessLines = (
  result: AdsApiCampaignIngestGateResult
): string[] => [
  'Campaign daily ingest succeeded.',
  `App account id: ${result.appAccountId}`,
  `App marketplace: ${result.appMarketplace}`,
  `Profile id: ${result.profileId}`,
  `Date range: ${result.requestedDateRange.startDate} -> ${result.requestedDateRange.endDate}`,
  `Campaign row count: ${result.campaignRowCount}`,
  `Sink result summary: raw_ingest=${result.sinkResult.ingestStatus}, mapping=${result.sinkResult.mapStatus}, fact_rows=${result.sinkResult.factRows}, issue_rows=${result.sinkResult.issueRows}`,
  `Upload id: ${result.sinkResult.uploadId}`,
];

async function main(): Promise<void> {
  try {
    const result = await runAdsApiCampaignIngestGate({});
    for (const line of buildCampaignIngestGateSuccessLines(result)) {
      console.log(line);
    }
  } catch (error) {
    if (error instanceof AdsApiCampaignIngestGateError) {
      console.error(`Campaign ingest gate error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Campaign ingest gate failed: ${error.message}`);
    } else {
      console.error('Campaign ingest gate failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
