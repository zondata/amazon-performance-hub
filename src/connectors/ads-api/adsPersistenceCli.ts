import {
  AdsApiPersistenceError,
  runAdsPersistence,
  type AdsApiPersistedNormalizationArtifact,
} from './index';

export const buildAdsPersistenceSuccessLines = (args: {
  appAccountId: string;
  appMarketplace: string;
  profileId: string;
  dateRange: { startDate: string; endDate: string };
  persistedArtifact: AdsApiPersistedNormalizationArtifact;
  landingArtifactPath: string;
  normalizationArtifactPath: string;
}): string[] => [
  'Ads persistence succeeded.',
  `App account id: ${args.appAccountId}`,
  `App marketplace: ${args.appMarketplace}`,
  `Profile id: ${args.profileId}`,
  `Date range: ${args.dateRange.startDate} -> ${args.dateRange.endDate}`,
  `Campaign row count: ${args.persistedArtifact.campaignRowCount}`,
  `Target row count: ${args.persistedArtifact.targetRowCount}`,
  `Placement row count: ${args.persistedArtifact.placementRowCount}`,
  `Landing artifact path: ${args.landingArtifactPath}`,
  `Normalization artifact path: ${args.normalizationArtifactPath}`,
];

async function main(): Promise<void> {
  try {
    const result = runAdsPersistence({});

    for (const line of buildAdsPersistenceSuccessLines({
      appAccountId: result.sharedMetadata.appAccountId,
      appMarketplace: result.sharedMetadata.appMarketplace,
      profileId: result.sharedMetadata.profileId,
      dateRange: result.sharedMetadata.requestedDateRange,
      persistedArtifact: result.persistedArtifact,
      landingArtifactPath: result.landingArtifactPath,
      normalizationArtifactPath: result.normalizationArtifactPath,
    })) {
      console.log(line);
    }
  } catch (error) {
    if (error instanceof AdsApiPersistenceError) {
      console.error(`Ads persistence error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Ads persistence failed: ${error.message}`);
    } else {
      console.error('Ads persistence failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
