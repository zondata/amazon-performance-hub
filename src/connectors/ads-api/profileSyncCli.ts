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

const ADS_API_PERSISTED_NORMALIZATION_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'out/ads-api-persisted/normalized/ads-sp-daily.persisted.json'
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

const readArtifactMetadata = (
  artifactPath: string,
  requiredKeys: string[] = []
): { appAccountId: string; appMarketplace: string } | null => {
  if (!fs.existsSync(artifactPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as Record<
      string,
      unknown
    >;
    const appAccountId =
      typeof parsed.appAccountId === 'string' ? parsed.appAccountId.trim() : '';
    const appMarketplace =
      typeof parsed.appMarketplace === 'string'
        ? parsed.appMarketplace.trim()
        : '';
    const configuredProfileId =
      typeof parsed.configuredProfileId === 'string'
        ? parsed.configuredProfileId.trim()
        : '';

    if (!appAccountId || !appMarketplace) {
      return null;
    }

    for (const key of requiredKeys) {
      const value = parsed[key];
      if (typeof value !== 'string' || value.trim().length === 0) {
        return null;
      }
    }

    if (
      requiredKeys.includes('configuredProfileId') &&
      configuredProfileId.length === 0
    ) {
      return null;
    }

    return {
      appAccountId,
      appMarketplace,
    };
  } catch {
    return null;
  }
};

async function main(): Promise<void> {
  try {
    const hadExplicitAppAccountId =
      typeof process.env.APP_ACCOUNT_ID === 'string' &&
      process.env.APP_ACCOUNT_ID.trim().length > 0;
    const hadExplicitAppMarketplace =
      typeof process.env.APP_MARKETPLACE === 'string' &&
      process.env.APP_MARKETPLACE.trim().length > 0;

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

    const existingMetadata =
      !hadExplicitAppAccountId || !hadExplicitAppMarketplace
        ? readArtifactMetadata(ADS_API_PERSISTED_NORMALIZATION_ARTIFACT_PATH, [
            'profileId',
          ]) ??
          readArtifactMetadata(ADS_API_PROFILE_SYNC_ARTIFACT_PATH, [
            'configuredProfileId',
          ])
        : null;

    const artifact = buildAdsProfilesSyncArtifact({
      profiles: profilesResult.profiles,
      configuredProfileId: config.profileId,
      appAccountId:
        hadExplicitAppAccountId || !existingMetadata
          ? config.appAccountId
          : existingMetadata.appAccountId,
      appMarketplace:
        hadExplicitAppMarketplace || !existingMetadata
          ? config.appMarketplace
          : existingMetadata.appMarketplace,
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
