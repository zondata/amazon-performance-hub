import {
  AdsApiConfigError,
  type AdsApiEnvConfig,
  type AdsApiProfileSyncEnvConfig,
} from './types';

export const REQUIRED_AMAZON_ADS_ENV_KEYS = [
  'AMAZON_ADS_CLIENT_ID',
  'AMAZON_ADS_CLIENT_SECRET',
  'AMAZON_ADS_API_BASE_URL',
] as const;

export const AMAZON_ADS_ENV_OPTIONAL_KEYS = [
  'AMAZON_ADS_REFRESH_TOKEN',
  'AMAZON_ADS_PROFILE_ID',
] as const;

export const REQUIRED_ADS_PROFILE_SYNC_ENV_KEYS = [
  'AMAZON_ADS_REFRESH_TOKEN',
  'AMAZON_ADS_PROFILE_ID',
  'APP_ACCOUNT_ID',
  'APP_MARKETPLACE',
] as const;

export type AdsApiEnvSource = Record<string, string | undefined>;

const readTrimmed = (source: AdsApiEnvSource, key: string): string | null => {
  const value = source[key];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeAmazonAdsRefreshToken = (
  value: string | null
): string | null => {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const startsWithDouble = trimmed.startsWith('"');
  const endsWithDouble = trimmed.endsWith('"');
  const startsWithSingle = trimmed.startsWith("'");
  const endsWithSingle = trimmed.endsWith("'");

  if (
    (startsWithDouble && endsWithDouble) ||
    (startsWithSingle && endsWithSingle)
  ) {
    const unwrapped = trimmed.slice(1, -1).trim();
    return unwrapped.length > 0 ? unwrapped : null;
  }

  return trimmed;
};

const normalizeApiBaseUrl = (value: string): string => {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new AdsApiConfigError(
      'invalid_env',
      'AMAZON_ADS_API_BASE_URL must be a valid absolute URL, for example https://advertising-api.amazon.com',
      { details: { received: value } }
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AdsApiConfigError(
      'invalid_env',
      'AMAZON_ADS_API_BASE_URL must use http or https',
      { details: { received: value } }
    );
  }

  return parsed.toString().replace(/\/$/, '');
};

export const loadAdsApiEnv = (
  source: AdsApiEnvSource = process.env
): AdsApiEnvConfig => {
  const missingKeys = REQUIRED_AMAZON_ADS_ENV_KEYS.filter(
    (key) => readTrimmed(source, key) === null
  );

  if (missingKeys.length > 0) {
    throw new AdsApiConfigError(
      'missing_env',
      `Missing required Amazon Ads environment variables: ${missingKeys.join(', ')}`,
      { details: { missingKeys } }
    );
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(
      readTrimmed(source, 'AMAZON_ADS_API_BASE_URL')!
    ),
    profileId: readTrimmed(source, 'AMAZON_ADS_PROFILE_ID'),
    credentials: {
      clientId: readTrimmed(source, 'AMAZON_ADS_CLIENT_ID')!,
      clientSecret: readTrimmed(source, 'AMAZON_ADS_CLIENT_SECRET')!,
      refreshToken: normalizeAmazonAdsRefreshToken(
        readTrimmed(source, 'AMAZON_ADS_REFRESH_TOKEN')
      ),
    },
  };
};

export const loadAdsApiEnvForRefresh = (
  source: AdsApiEnvSource = process.env
): AdsApiEnvConfig => {
  const config = loadAdsApiEnv(source);

  if (!config.credentials.refreshToken) {
    throw new AdsApiConfigError(
      'missing_env',
      'Missing required Amazon Ads environment variables: AMAZON_ADS_REFRESH_TOKEN',
      { details: { missingKeys: ['AMAZON_ADS_REFRESH_TOKEN'] } }
    );
  }

  return config;
};

export const loadAdsApiEnvForProfileSync = (
  source: AdsApiEnvSource = process.env
): AdsApiProfileSyncEnvConfig => {
  const missingKeys = [
    ...REQUIRED_AMAZON_ADS_ENV_KEYS.filter(
      (key) => readTrimmed(source, key) === null
    ),
    ...REQUIRED_ADS_PROFILE_SYNC_ENV_KEYS.filter(
      (key) => readTrimmed(source, key) === null
    ),
  ];

  if (missingKeys.length > 0) {
    throw new AdsApiConfigError(
      'missing_env',
      `Missing required environment variables: ${missingKeys.join(', ')}`,
      { details: { missingKeys } }
    );
  }

  const config = loadAdsApiEnv(source);

  return {
    ...config,
    profileId: readTrimmed(source, 'AMAZON_ADS_PROFILE_ID')!,
    credentials: {
      ...config.credentials,
      refreshToken: normalizeAmazonAdsRefreshToken(
        readTrimmed(source, 'AMAZON_ADS_REFRESH_TOKEN')
      ),
    },
    appAccountId: readTrimmed(source, 'APP_ACCOUNT_ID')!,
    appMarketplace: readTrimmed(source, 'APP_MARKETPLACE')!,
  };
};
