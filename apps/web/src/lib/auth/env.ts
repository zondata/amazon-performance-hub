const readTrimmed = (value: string | undefined | null): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const requireAuthEnv = (key: string, value: string | null): string => {
  if (!value) {
    throw new Error(`Missing required auth environment variable: ${key}`);
  }
  return value;
};

export const getSupabaseAuthUrl = (): string => {
  return requireAuthEnv(
    'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL',
    readTrimmed(process.env.NEXT_PUBLIC_SUPABASE_URL) ??
      readTrimmed(process.env.SUPABASE_URL)
  );
};

export const getSupabasePublishableKey = (): string => {
  return requireAuthEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    readTrimmed(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
};

export const getAllowedEmailsEnv = (): string => {
  return requireAuthEnv(
    'AUTH_ALLOWED_EMAILS',
    readTrimmed(process.env.AUTH_ALLOWED_EMAILS)
  );
};
