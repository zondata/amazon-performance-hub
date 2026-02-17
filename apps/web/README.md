# Amazon Performance Hub Web

Next.js app for read-only diagnostics. Supabase access is server-side only.

## Setup

1. Copy the root `.env.local` values into the web app and add the UI-specific vars:

```bash
cp .env.local apps/web/.env.local
```

Then open `apps/web/.env.local` and ensure it includes:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_ACCOUNT_ID=US
APP_MARKETPLACE=US
PENDING_RECONCILE_DIR=/mnt/c/Users/User/Dropbox/AmazonReports/_PENDING_RECONCILE
ENABLE_SPEND_RECONCILIATION=0
```

`ENABLE_SPEND_RECONCILIATION` is optional. Keep it at `0` (default) to skip the spend reconciliation query. Set to `1` to enable it.

2. Install dependencies (already done when created via `create-next-app`).

## Dev

```bash
npm run dev
```

## Build

```bash
npm run build
```
