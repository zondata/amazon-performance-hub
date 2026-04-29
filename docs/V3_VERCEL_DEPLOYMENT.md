# V3 Vercel Deployment

## Scope

This document covers the Phase 3 deployment setup for the `amazon-performance-hub-v3` web app.

This phase is code-only. Codex does not deploy Vercel from this PR.

You must complete the Vercel project setup, Supabase Auth redirect configuration, and environment variable entry manually.

## Security model

- `SUPABASE_SERVICE_ROLE_KEY` stays server-only.
- Never expose the service-role key in browser code or any `NEXT_PUBLIC_*` variable.
- Protected pages, route handlers, and server actions are guarded by Supabase Auth middleware plus server-side allowed-email checks.
- `AUTH_ALLOWED_EMAILS` controls who may access the app.
- Important: Supabase service-role bypasses RLS. Any server route or server action that reads data with `supabaseAdmin` must enforce auth before reading data.

## Auth method

- Phase 3 uses Supabase Auth with email/password.
- Allowed email list is configured through:

```text
AUTH_ALLOWED_EMAILS=netradesolution@gmail.com
```

- More emails can be added later as a comma-separated list:

```text
AUTH_ALLOWED_EMAILS=netradesolution@gmail.com,second@example.com
```

## Vercel project

Recommended initial Vercel project name:

```text
amazon-performance-hub-v3
```

Use the Vercel-generated domain first. Add a custom domain later only if needed.

## Required environment variables

Server-only:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
APP_ACCOUNT_ID
APP_MARKETPLACE
AUTH_ALLOWED_EMAILS
```

Public/browser-safe:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` should normally match `SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` must be the Supabase publishable key, not the service-role key.
- `NEXT_PUBLIC_SITE_URL` should match the deployed Vercel URL, for example:

```text
NEXT_PUBLIC_SITE_URL=https://amazon-performance-hub-v3.vercel.app
```

## Supabase Auth setup

1. Enable email/password in Supabase Auth.
2. Create the first user in Supabase Auth using:

```text
netradesolution@gmail.com
```

3. Add redirect URLs for:
   - local development
   - Vercel preview URL(s)
   - Vercel production URL

Recommended initial redirect URLs:

```text
http://localhost:3000/auth/callback
https://amazon-performance-hub-v3.vercel.app/auth/callback
```

If Vercel assigns a different generated hostname, update the production callback URL to match it.

## Vercel setup checklist

1. Connect the GitHub repository to Vercel.
2. Use the web app project name `amazon-performance-hub-v3`.
3. Set the build command to:

```text
npm run web:build
```

4. Set the root directory to the repo root unless you intentionally configure a different monorepo entry point.
5. Add all required environment variables in Vercel.
6. Redeploy after variables are saved.

## Local verification

Run from the repo root:

```bash
npm test
npm run build
npm run web:build
```

If local auth testing is needed, make sure `.env.local` includes the Phase 3 auth variables.

## Protected paths

The Phase 3 auth guard protects the application by redirecting unauthenticated users to `/login`.

Protected examples:

- `/dashboard`
- `/imports-health`
- `/pipeline-status`
- `/products`
- `/ads/performance`
- `/logbook/experiments`
- route handlers and server actions under `apps/web/src/app/**`

Public auth paths:

- `/login`
- `/auth/callback`

## Operator note

If you later move data reads from service-role access to anon/session-based access with RLS, update this document and the app guard model together. The current Phase 3 implementation assumes service-role remains server-only and access control is enforced at the app layer.
