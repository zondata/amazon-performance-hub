import { AdsApiConfigError, type AdsApiAuthorizationUrlInput } from './types';

export const ADS_API_AUTHORIZATION_ENDPOINT = 'https://www.amazon.com/ap/oa';
export const LWA_TOKEN_ENDPOINT = 'https://api.amazon.com/auth/o2/token';

const requireNonEmptyValue = (label: string, value: string): string => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new AdsApiConfigError(
      'invalid_env',
      `${label} must be a non-empty string`
    );
  }

  return trimmed;
};

export const buildAdsAuthorizationUrlFromInputs = (
  input: AdsApiAuthorizationUrlInput
): string => {
  const url = new URL(ADS_API_AUTHORIZATION_ENDPOINT);

  url.searchParams.set('client_id', requireNonEmptyValue('clientId', input.clientId));
  url.searchParams.set(
    'redirect_uri',
    requireNonEmptyValue('redirectUri', input.redirectUri)
  );
  url.searchParams.set('scope', requireNonEmptyValue('scope', input.scope));
  url.searchParams.set('response_type', 'code');

  if (typeof input.state === 'string' && input.state.trim().length > 0) {
    url.searchParams.set('state', input.state.trim());
  }

  return url.toString();
};
