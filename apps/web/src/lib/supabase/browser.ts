'use client';

import { createBrowserClient } from '@supabase/ssr';

import { getSupabaseAuthUrl, getSupabasePublishableKey } from '@/lib/auth/env';

export const createSupabaseBrowserClient = () => {
  return createBrowserClient(getSupabaseAuthUrl(), getSupabasePublishableKey());
};
