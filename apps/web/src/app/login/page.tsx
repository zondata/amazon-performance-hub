import { redirect } from 'next/navigation';

import { loginAction } from '@/lib/auth/actions';
import { getAuthenticatedAppUser } from '@/lib/auth/session';

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const readParam = (
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
): string | undefined => {
  const value = params?.[key];
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getAuthenticatedAppUser();
  const params = searchParams ? await searchParams : undefined;
  const next = readParam(params, 'next') ?? '/dashboard';
  const error = readParam(params, 'error');

  if (user) {
    redirect(next);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <section className="w-full rounded-2xl border border-border bg-surface/85 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">
          Private Access
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Email/password access is enabled for approved internal users only.
        </p>
        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block text-sm text-foreground">
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              required
            />
          </label>
          <label className="block text-sm text-foreground">
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              required
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </button>
        </form>
        <div className="mt-4 text-xs text-muted">
          Create the first user in Supabase Auth, then sign in here with the allowed email list.
        </div>
      </section>
    </div>
  );
}
