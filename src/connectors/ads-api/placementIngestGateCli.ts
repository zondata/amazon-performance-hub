import {
  AdsApiPlacementIngestGateError,
  runAdsApiPlacementIngestGate,
  type AdsApiPlacementIngestGateResult,
} from './index';

export const buildPlacementIngestGateSuccessLines = (
  result: AdsApiPlacementIngestGateResult
): string[] => [
  'Placement daily ingest succeeded.',
  `App account id: ${result.appAccountId}`,
  `App marketplace: ${result.appMarketplace}`,
  `Profile id: ${result.profileId}`,
  `Date range: ${result.requestedDateRange.startDate} -> ${result.requestedDateRange.endDate}`,
  `Placement row count: ${result.placementRowCount}`,
  `Sink result summary: raw_ingest=${result.sinkResult.ingestStatus}, mapping=${result.sinkResult.mapStatus}, fact_rows=${result.sinkResult.factRows}, issue_rows=${result.sinkResult.issueRows}`,
  `Upload id: ${result.sinkResult.uploadId}`,
];

const parseArgs = (argv: string[]): { artifactPath?: string } => {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--artifact-path') {
      return { artifactPath: argv[index + 1] ?? undefined };
    }
    if (arg.startsWith('--artifact-path=')) {
      return { artifactPath: arg.slice('--artifact-path='.length) };
    }
  }

  return {};
};

async function main(): Promise<void> {
  try {
    const result = await runAdsApiPlacementIngestGate(parseArgs(process.argv.slice(2)));
    for (const line of buildPlacementIngestGateSuccessLines(result)) {
      console.log(line);
    }
  } catch (error) {
    if (error instanceof AdsApiPlacementIngestGateError) {
      console.error(`Placement ingest gate error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Placement ingest gate failed: ${error.message}`);
    } else {
      console.error('Placement ingest gate failed due to an unknown error.');
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
