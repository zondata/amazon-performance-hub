import {
  AdsApiTargetIngestGateError,
  runAdsApiTargetIngestGate,
  type AdsApiTargetIngestGateResult,
} from './index';

export const buildTargetIngestGateSuccessLines = (
  result: AdsApiTargetIngestGateResult
): string[] => [
  'Target daily ingest succeeded.',
  `App account id: ${result.appAccountId}`,
  `App marketplace: ${result.appMarketplace}`,
  `Profile id: ${result.profileId}`,
  `Date range: ${result.requestedDateRange.startDate} -> ${result.requestedDateRange.endDate}`,
  `Target row count: ${result.targetRowCount}`,
  `Sink result summary: raw_ingest=${result.sinkResult.ingestStatus}, mapping=${result.sinkResult.mapStatus}, fact_rows=${result.sinkResult.factRows}, issue_rows=${result.sinkResult.issueRows}`,
  `Upload id: ${result.sinkResult.uploadId}`,
];

async function main(): Promise<void> {
  try {
    const result = await runAdsApiTargetIngestGate({});
    for (const line of buildTargetIngestGateSuccessLines(result)) {
      console.log(line);
    }
  } catch (error) {
    if (error instanceof AdsApiTargetIngestGateError) {
      console.error(`Target ingest gate error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Target ingest gate failed: ${error.message}`);
    } else {
      console.error('Target ingest gate failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
