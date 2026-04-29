'use server';

import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getSafeRedirectPath,
  isAllowedEmail,
  parseAllowedEmails,
} from './config';
import { getAllowedEmailsEnv } from './env';

const redirectWithError = (message: string, next?: string | null) => {
  const target = getSafeRedirectPath(next, '/dashboard');
  redirect(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(target)}`);
};

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');

  if (!email || !password) {
    redirectWithError('Email and password are required.', next);
  }

  const allowedEmails = parseAllowedEmails(getAllowedEmailsEnv());
  if (!isAllowedEmail(email, allowedEmails)) {
    redirectWithError('This email is not allowed to access the app.', next);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectWithError(error.message, next);
  }

  redirect(getSafeRedirectPath(next, '/dashboard'));
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
