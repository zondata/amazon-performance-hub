import fs from 'node:fs';
import path from 'node:path';

import {
  adsApiFetchTransport,
  AdsApiAuthError,
  AdsApiConfigError,
  AdsApiProfilesError,
  buildAdsProfilesSyncArtifact,
  fetchAdsProfiles,
  loadAdsApiEnvForProfileSync,
  refreshAdsAccessToken,
  type AdsApiProfilesSyncArtifact,
} from './index';
import { loadLocalEnvFiles } from './loadLocalEnv';

export const ADS_API_PROFILE_SYNC_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-profile-sync/ads-profiles.sync.json'
);

export const buildProfileSyncSuccessLines = (args: {
  artifact: AdsApiProfilesSyncArtifact;
  artifactPath: string;
}): string[] => [
  'Amazon Ads profile sync succeeded.',
  `Configured profile id: ${args.artifact.configuredProfileId}`,
  `Selected profile id: ${args.artifact.selectedProfile.profileId}`,
  `Profile count: ${args.artifact.profileCount}`,
  `Selected country code: ${args.artifact.selectedProfile.countryCode ?? '(none)'}`,
  `Selected account name: ${
    args.artifact.selectedProfile.accountInfo?.name ?? '(none)'
  }`,
  `Artifact path: ${args.artifactPath}`,
];

async function main(): Promise<void> {
  try {
    loadLocalEnvFiles();

    const config = loadAdsApiEnvForProfileSync();
    const tokenResult = await refreshAdsAccessToken({
      config,
      transport: adsApiFetchTransport,
    });

    if (!tokenResult.ok) {
      throw tokenResult.error;
    }

    const profilesResult = await fetchAdsProfiles({
      config,
      accessToken: tokenResult.accessToken,
      transport: adsApiFetchTransport,
    });

    if (!profilesResult.ok) {
      throw profilesResult.error;
    }

    const artifact = buildAdsProfilesSyncArtifact({
      profiles: profilesResult.profiles,
      configuredProfileId: config.profileId,
      appAccountId: config.appAccountId,
      appMarketplace: config.appMarketplace,
      adsApiBaseUrl: config.apiBaseUrl,
    });

    fs.mkdirSync(path.dirname(ADS_API_PROFILE_SYNC_ARTIFACT_PATH), {
      recursive: true,
    });
    fs.writeFileSync(
      ADS_API_PROFILE_SYNC_ARTIFACT_PATH,
      `${JSON.stringify(artifact, null, 2)}\n`,
      'utf8'
    );

    for (const line of buildProfileSyncSuccessLines({
      artifact,
      artifactPath: ADS_API_PROFILE_SYNC_ARTIFACT_PATH,
    })) {
      console.log(line);
    }
  } catch (error) {
    if (error instanceof AdsApiConfigError) {
      console.error(`Amazon Ads config error: ${error.message}`);
    } else if (error instanceof AdsApiAuthError) {
      console.error(`Amazon Ads auth error: ${error.message}`);
    } else if (error instanceof AdsApiProfilesError) {
      console.error(`Amazon Ads profiles error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Amazon Ads profile sync failed: ${error.message}`);
    } else {
      console.error('Amazon Ads profile sync failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
