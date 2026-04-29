import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getSupabaseAuthUrl, getSupabasePublishableKey } from '@/lib/auth/env';

export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseAuthUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {
          // Server Components cannot always write cookies. Middleware handles refresh.
        }
      },
    },
  });
};
