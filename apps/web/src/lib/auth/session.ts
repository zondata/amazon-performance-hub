import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getAllowedEmailsEnv,
} from './env';
import {
  getSafeRedirectPath,
  isAllowedEmail,
  isPublicAuthPath,
  parseAllowedEmails,
} from './config';

export type AuthenticatedAppUser = {
  id: string;
  email: string;
};

export const getRequestPathnameFromHeaders = async (): Promise<string> => {
  const headerStore = await headers();
  return headerStore.get('x-aph-pathname') ?? '/';
};

export const getAllowedEmails = (): string[] => {
  return parseAllowedEmails(getAllowedEmailsEnv());
};

export const getAuthenticatedAppUser = async (): Promise<AuthenticatedAppUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email) {
    return null;
  }

  if (!isAllowedEmail(user.email, getAllowedEmails())) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
  };
};

export const requireAuthenticatedAppUser = async (): Promise<AuthenticatedAppUser> => {
  const pathname = await getRequestPathnameFromHeaders();
  if (isPublicAuthPath(pathname)) {
    throw new Error('requireAuthenticatedAppUser cannot be used on a public auth path');
  }

  const user = await getAuthenticatedAppUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(getSafeRedirectPath(pathname, '/dashboard'))}`);
  }
  return user;
};
