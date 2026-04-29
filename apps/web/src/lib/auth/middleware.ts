import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import {
  getSafeRedirectPath,
  isAllowedEmail,
  isPublicAuthPath,
  parseAllowedEmails,
} from './config';
import { getAllowedEmailsEnv, getSupabaseAuthUrl, getSupabasePublishableKey } from './env';

const createRedirectResponse = (request: NextRequest, pathname: string, error?: string) => {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('next', getSafeRedirectPath(pathname, '/dashboard'));
  if (error) {
    loginUrl.searchParams.set('error', error);
  }
  return NextResponse.redirect(loginUrl);
};

export const updateAuthSession = async (request: NextRequest) => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-aph-pathname', request.nextUrl.pathname);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    getSupabaseAuthUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
          }
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          for (const cookie of cookiesToSet) {
            response.cookies.set(cookie.name, cookie.value, cookie.options);
          }
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;
  const allowedEmails = parseAllowedEmails(getAllowedEmailsEnv());

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;
  const claimEmail =
    typeof claims?.email === 'string' ? claims.email : null;

  if (isPublicAuthPath(pathname)) {
    if (claimEmail && isAllowedEmail(claimEmail, allowedEmails)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = getSafeRedirectPath(
        request.nextUrl.searchParams.get('next'),
        '/dashboard'
      );
      redirectUrl.search = '';
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  if (!claimEmail) {
    return createRedirectResponse(request, pathname);
  }

  if (!isAllowedEmail(claimEmail, allowedEmails)) {
    await supabase.auth.signOut();
    return createRedirectResponse(request, pathname, 'This email is not allowed to access the app.');
  }

  return response;
};
