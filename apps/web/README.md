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
BULKGEN_OUT_ROOT=/mnt/c/Users/User/Dropbox/AmazonReports/_BULKGEN_OUT
BULKGEN_PENDING_RECONCILE_DIR=/mnt/c/Users/User/Dropbox/AmazonReports/_PENDING_RECONCILE
BULKGEN_RECONCILED_DIR=/mnt/c/Users/User/Dropbox/AmazonReports/_RECONCILED
BULKGEN_FAILED_DIR=/mnt/c/Users/User/Dropbox/AmazonReports/_FAILED
BULKGEN_TEMPLATE_SP_UPDATE=
BULKGEN_TEMPLATE_SB_UPDATE=
BULKGEN_TEMPLATE_SP_CREATE=
ENABLE_BULKGEN_SPAWN=0
```

`ENABLE_SPEND_RECONCILIATION` is optional. Keep it at `0` (default) to skip the spend reconciliation query. Set to `1` to enable it.

Bulksheet Ops is local-first and expects filesystem access. Configure the `BULKGEN_*` paths to Dropbox (or local folders). `ENABLE_BULKGEN_SPAWN=1` allows the UI to spawn CLI scripts; keep it `0` on Vercel or other serverless hosts.

2. Install dependencies (already done when created via `create-next-app`).

## Dev

```bash
npm run dev
```

## Build

```bash
npm run build
```
