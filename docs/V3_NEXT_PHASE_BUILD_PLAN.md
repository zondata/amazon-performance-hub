# V3 Next Phase Build Plan

## Purpose

This build is for turning V3 from a local/manual Amazon data system into an operational, web-accessible, AI-readable data platform.

The current core objective remains unchanged:

1. Pull Amazon data automatically into Supabase.
2. Let AI read Supabase data through an MCP connector.
3. Avoid manual report uploads and avoid manual recovery work.

The extra work in this plan is not feature drift. The V3 status page, Vercel deployment, login/RLS, and loop verification are operational infrastructure needed to make the original objective reliable.

## Current baseline

The V3 Ads pending-resume workflow has been fixed so it no longer waits around 20 minutes for Amazon Ads reports.

The pending-resume workflow now:

- short-polls Amazon Ads reports
- stores/reuses pending report IDs
- checks pending request health, not full Ads freshness
- succeeds when pending requests are active within SLA
- fails only for unhealthy pending states

Currently implemented Ads API report types:

- ads_api_sp_campaign_daily
- ads_api_sp_target_daily

Remaining report expansion should happen after the current loop is proven stable.

## What this build will deliver

After this build is done, V3 should have:

1. A simple web status page showing:
   - latest available Supabase data by source/table
   - active pending Amazon report requests
   - stale or failed pending requests
   - which report sources are implemented
   - which report sources are not implemented yet
   - next action for each source

2. An automated verification CLI/workflow that confirms:
   - report request -> pending -> resume -> download -> import works
   - pending report IDs are reused instead of duplicated
   - active pending reports are within SLA
   - completed reports become imported
   - failed/stale reports are surfaced clearly

3. V3 deployed to Vercel with:
   - login protection
   - safe server-only Supabase access
   - no service-role key exposed to the browser
   - a documented environment variable checklist
   - RLS/auth plan implemented or explicitly staged

4. An MCP connector that lets AI read V3 Supabase data without uploaded reports:
   - read-only tools only
   - no write operations
   - no secret exposure
   - clear row limits and query safety
   - tools for pipeline status, data coverage, pending reports, sales summaries, SP campaign summaries, and SP target summaries

5. A controlled report expansion path:
   - expand remaining SP reports first
   - then SB reports
   - then SD reports
   - one source or closely related source group per PR
   - each new report type must pass request/pending/resume/download/import verification before being considered done

## Non-goals

Do not build polished UI/UX.

Do not build advanced dashboards.

Do not add campaign editing or bulk action features.

Do not expose Supabase service-role credentials to the browser.

Do not expand SP/SB/SD reports until the existing SP campaign and SP target loop is verifiably stable.

Do not let unsupported report types make implemented report types look failed.

Do not create one huge PR containing all phases if it becomes risky. Prefer small PRs with clean acceptance checks.

## Phase 1 — Pipeline status page

### Purpose

Give the user visibility into automatic Amazon data pulling.

The user should no longer need to inspect GitHub Actions logs to answer:

- What is the latest data available in Supabase?
- Is Amazon still preparing a report?
- Are there failed or stale pending reports?
- Which sources are implemented?
- Which sources are not implemented yet?

### Deliverables

Create a simple V3 page:

```text
/apps/web/src/app/pipeline-status/page.tsx

or extend the existing Imports & Health page only if that is cleaner.

Preferred route:

/pipeline-status

Add a server-side data function:

/apps/web/src/lib/pipeline-status/getPipelineStatus.ts

The page should show a plain table. No advanced UI needed.

Minimum columns:

source group
source type
target table
implementation status
latest period end
last successful import time
current coverage status
active pending count
oldest pending age
failed/stale count
retry_after_at
next action
notes

Data sources:

public.ads_api_report_requests
public.data_coverage_status
sync run table if available
latest dates from implemented fact tables where safe

Required source groups:

Sales & Traffic
SP campaign daily
SP target daily
SP placement daily
SP STIS daily
SP advertised product daily
SB campaign daily
SB placement/keyword/STIS/attributed purchases
SD campaign/advertised/targeting/matched/purchased
SQP if already supported
Done criteria

This phase is done when:

/pipeline-status loads locally.
It shows SP campaign and SP target pending/import status.
It clearly marks unsupported sources as not_implemented, not failed.
It links from the main dashboard or Imports & Health page.
npm run web:build passes.
npm test passes.
No browser bundle contains Supabase service-role key.
Phase 2 — Automated Ads loop verification
Purpose

Automatically confirm that the Amazon Ads report loop works without the user manually checking logs.

The loop is:

request report
-> save report_id
-> Amazon pending
-> resume saved report_id
-> download when ready
-> import into Supabase
-> mark imported
Deliverables

Create a CLI:

src/cli/v3VerifyAdsLoop.ts

Add package script:

"v3:verify:ads-loop": "ts-node src/cli/v3VerifyAdsLoop.ts"

The CLI must accept:

--account-id
--marketplace
--lookback-hours
--max-pending-age-hours

The CLI should write:

out/v3_ads_loop_verification.md

The verification should inspect:

public.ads_api_report_requests
public.data_coverage_status
implemented target tables
sync run records if available

Verification rules:

PASS when no unhealthy rows exist and implemented sources have recent imported data or active pending recovery.
PASS when Amazon reports are still pending but within SLA.
WARN when unsupported sources are not implemented.
FAIL when a request is failed.
FAIL when a request is stale_expired.
FAIL when a completed report is not imported after grace period.
FAIL when duplicate active report IDs exist for the same account, marketplace, profile hash, source type, report type, start date, and end date.
FAIL when implemented source coverage is stale and no pending recovery exists.

Add a workflow:

.github/workflows/v3-ads-loop-verification.yml

Schedule:

daily
workflow_dispatch

The workflow should run the verification CLI and upload the markdown report.

Done criteria

This phase is done when:

The CLI can run locally.
The GitHub workflow can run manually.
The generated report explains PASS/WARN/FAIL.
It confirms SP campaign and SP target are either imported or actively pending within SLA.
It does not fail because SP placement, SP STIS, SP advertised product, SB, or SD are not implemented yet.
npm test passes.
npm run build passes.
Phase 3 — Vercel deployment, login, and Supabase safety
Purpose

Make V3 accessible through the web instead of localhost, without exposing private data.

Required safety rule

The Supabase service-role key must never be exposed to the browser.

Existing server env currently requires:

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
APP_ACCOUNT_ID
APP_MARKETPLACE

If the app keeps using service-role server-side, every protected route and server action must enforce authentication before reading data.

RLS is important, but note:

Supabase service-role bypasses RLS.
Login alone is not enough if unauthenticated users can reach server-rendered pages.
Either use user-session/anon-key queries with RLS, or keep service-role server-only and enforce auth at every server route/action.
Deliverables

Add login protection.

Preferred approach:

Supabase Auth with email/password or magic link.
Middleware protects all V3 app routes except login/callback.
Add allowed-email check or account access table.
Add logout.
Add protected layout.
Add clear environment variable docs.

Add or update:

apps/web/src/middleware.ts
apps/web/src/app/login/page.tsx
apps/web/src/app/auth/callback/route.ts
apps/web/src/lib/auth/*
docs/V3_VERCEL_DEPLOYMENT.md

Add Vercel configuration if useful:

vercel.json

Vercel build should use:

npm run web:build

or equivalent monorepo-safe command.

Done criteria

This phase is done when:

Unauthenticated visitor is redirected to login.
Authenticated allowed user can access dashboard/imports-health/pipeline-status.
Unauthorized user cannot access data.
Service-role key is only used in server-only files.
No NEXT_PUBLIC_* secret contains private keys.
Vercel deployment docs include all required env vars.
npm run web:build passes.
npm test passes.
Phase 4 — MCP connector
Purpose

Let AI read V3 data from Supabase without the user uploading reports.

Design

Create an MCP connector that exposes read-only tools.

Preferred location:

apps/mcp

or:

src/mcp

Use TypeScript.

The MCP connector must not expose write operations.

Minimum tools:

get_pipeline_status
returns same core data as /pipeline-status
get_data_coverage_status
returns data freshness by source/table
list_ads_pending_reports
returns active, failed, stale, and recently imported Ads report requests
get_sales_summary
date range input
optional ASIN filter
returns sales, orders, units, sessions if available
get_sp_campaign_summary
date range input
optional campaign filter
returns impressions, clicks, cost, sales, purchases, ACOS/ROAS if available
get_sp_target_summary
date range input
optional campaign/ad group/target filter
returns impressions, clicks, cost, sales, purchases

Optional tool:

readonly_sql
SELECT only
allowed tables/views only
hard row limit
query timeout
no multiple statements
no mutation keywords
no secrets in output
Security

Use one of these:

a dedicated read-only Postgres role, preferred for MCP
or Supabase server key only if connector is private and never exposed to browser/client

Do not use service-role key in a browser-facing context.

Done criteria

This phase is done when:

MCP server starts locally.
Each required tool returns valid JSON.
Tools have tests.
Tools enforce row limits.
Mutation queries are rejected.
The connector can answer:
latest available data
pending Amazon reports
basic sales summary
basic SP campaign summary
basic SP target summary
No write tool exists.
No secret is logged.
npm test passes.
npm run build passes.
Phase 5 — Expand remaining Amazon Ads reports
Purpose

Expand from current implemented Ads API reports to full Ads automation.

Current implemented sources:

SP campaign daily
SP target daily

Expansion order:

SP placement daily
SP advertised product daily
SP STIS/search term daily
SB campaign daily
SB campaign placement daily
SB keyword daily
SB STIS daily
SB attributed purchases daily
SD campaign daily
SD advertised product daily
SD targeting daily
SD matched target daily
SD purchased product daily
Required implementation pattern for every new report source

Each new source must have:

source registry entry
create report request builder
status poller
pending request persistence
duplicate report reuse
download parser
normalized artifact
import into Supabase target table
data coverage update
pending health inclusion only after implemented
pipeline status page inclusion
MCP inclusion if useful
unit tests
one manual workflow dispatch verification
Important rule

Do not guess Amazon Ads API report type IDs or columns.

Codex must verify report type IDs and columns from:

existing repository importers/schema
existing table names
official Amazon Ads API reporting references if available in its environment

If a report type cannot be verified, Codex must stop before enabling that source and write a clear gap note.

Done criteria for each new source

A source is done only when:

request -> pending -> resume -> download -> import works
no duplicate active pending request is created
imported rows appear in the target table
pipeline status page shows latest imported date
pending-health checker includes the source only after implementation
loop verification passes
tests pass
build passes
User-required actions

The user must do these when requested:

Vercel setup
connect Vercel to the GitHub repo
set production branch
set build command/root directory if Codex documents it
add environment variables

Vercel environment variables
Required server variables:

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
APP_ACCOUNT_ID
APP_MARKETPLACE

Likely auth variables, depending on implementation:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
AUTH_ALLOWED_EMAILS
AUTH_SECRET or APP_SESSION_SECRET
NEXT_PUBLIC_SITE_URL

Optional feature flags:

ENABLE_ADS_OPTIMIZER
ENABLE_SPEND_RECONCILIATION
ENABLE_BULKGEN_SPAWN
Supabase Auth setup
enable chosen login method
add redirect URLs for local and Vercel domains
create/allow the first user email
Supabase RLS / read-only access
apply migrations if Codex cannot apply them
create read-only DB credentials for MCP if using direct Postgres
never paste service-role key into client-side env vars
Amazon Ads permissions
if SB or SD report pulls fail because token permissions are insufficient, reauthorize Amazon Ads access with required permissions
Overall done definition

This full build is done when:

V3 is deployed to Vercel and protected by login.
/pipeline-status shows latest data and pending report state.
Ads loop verification runs automatically and reports PASS/WARN/FAIL.
AI can read Supabase through MCP without report uploads.
SP campaign and SP target are stable.
Remaining SP reports are implemented and verified.
SB reports are implemented and verified if relevant.
SD reports are implemented and verified if relevant.
Unsupported or not-needed sources are clearly marked and do not break workflows.
