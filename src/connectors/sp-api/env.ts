import {
  SP_API_REGIONS,
  SpApiConfigError,
  type SpApiEnvConfig,
  type SpApiRegion,
} from './types';

export const REQUIRED_SP_API_ENV_KEYS = [
  'SP_API_LWA_CLIENT_ID',
  'SP_API_LWA_CLIENT_SECRET',
  'SP_API_REFRESH_TOKEN',
  'SP_API_REGION',
  'SP_API_MARKETPLACE_ID',
] as const;

export type SpApiEnvSource = Record<string, string | undefined>;

const readRequiredTrimmed = (source: SpApiEnvSource, key: string) => {
  const value = source[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseRegion = (value: string): SpApiRegion => {
  if ((SP_API_REGIONS as readonly string[]).includes(value)) {
    return value as SpApiRegion;
  }

  throw new SpApiConfigError(
    'invalid_region',
    `SP_API_REGION must be one of: ${SP_API_REGIONS.join(', ')}`,
    { received: value }
  );
};

export const loadSpApiEnv = (
  source: SpApiEnvSource = process.env
): SpApiEnvConfig => {
  const missingKeys = REQUIRED_SP_API_ENV_KEYS.filter(
    (key) => readRequiredTrimmed(source, key) === null
  );

  if (missingKeys.length > 0) {
    throw new SpApiConfigError(
      'missing_env',
      `Missing required SP-API environment variables: ${missingKeys.join(', ')}`,
      { missingKeys }
    );
  }

  return {
    region: parseRegion(readRequiredTrimmed(source, 'SP_API_REGION')!),
    marketplaceId: readRequiredTrimmed(source, 'SP_API_MARKETPLACE_ID')!,
    credentials: {
      lwaClientId: readRequiredTrimmed(source, 'SP_API_LWA_CLIENT_ID')!,
      lwaClientSecret: readRequiredTrimmed(source, 'SP_API_LWA_CLIENT_SECRET')!,
      refreshToken: readRequiredTrimmed(source, 'SP_API_REFRESH_TOKEN')!,
    },
  };
};
