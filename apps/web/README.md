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

## STIS/STIR Handling (Product Baseline Data Pack V3)

`/products/[asin]/logbook/ai-data-pack-v3` supports `stis_mode=pack|export`:

- `stis_mode=pack`:
  - Includes STIS + STIR artifacts directly inside the pack JSON.
- `stis_mode=export`:
  - Excludes STIS/STIR from pack JSON and exports two separate files (`stis` and `stir`) for separate upload.

UI flow:

- When both STIS and STIR are available, the download action requires an explicit choice before pack generation.
- Recommended default is `pack`.

Non-interactive usage:

- If `stis_mode` is not provided, non-interactive requests default to `pack` and log that fallback in pack messages/metadata.

## Required Data Availability Preflight (Evaluation Import)

`/logbook/experiments/[id]/evaluation-import` now runs a mandatory preflight check before importing evaluation output.

- The UI always shows `Required data availability` first.
- Required inputs for this analysis flow:
  - Evaluation output pack JSON
  - Product baseline data pack JSON
  - STIS and STIR data, resolved from either:
    - inside the baseline pack (`from pack`), or
    - separate uploaded files (`separate upload`)
- If any required item fails, import is blocked and no evaluation results are applied.
- For missing STIS/STIR, remediation is:
  - regenerate baseline pack and choose include mode, or
  - regenerate with export mode and upload both STIS + STIR files with the evaluation import.
