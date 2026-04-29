export const PUBLIC_AUTH_PATHS = ['/login', '/auth/callback'] as const;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const parseAllowedEmails = (raw: string | undefined | null): string[] => {
  const normalized = (raw ?? '')
    .split(',')
    .map((value) => normalizeEmail(value))
    .filter((value) => value.length > 0);
  return [...new Set(normalized)];
};

export const isAllowedEmail = (
  email: string | null | undefined,
  allowedEmails: string[]
): boolean => {
  if (!email) return false;
  return allowedEmails.includes(normalizeEmail(email));
};

export const isPublicAuthPath = (pathname: string): boolean => {
  return PUBLIC_AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
};

export const isSafeRedirectPath = (value: string | null | undefined): value is string => {
  if (!value) return false;
  return value.startsWith('/') && !value.startsWith('//');
};

export const getSafeRedirectPath = (
  value: string | null | undefined,
  fallback = '/dashboard'
): string => {
  return isSafeRedirectPath(value) ? value : fallback;
};
