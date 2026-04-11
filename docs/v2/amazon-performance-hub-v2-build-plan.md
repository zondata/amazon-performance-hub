# Amazon Performance Hub V2 — Detailed Build Plan

## 1) Build goal

Build a leaner Amazon Performance Hub V2 that:

- pulls live Amazon data directly from Amazon APIs where possible,
- stays human-first for decision making,
- is agent-readable and agent-discussable,
- keeps durable memory of product/query/change/outcome context,
- focuses on using ads to improve organic rank,
- avoids V1-style surface sprawl.

This plan assumes:

- manual approval remains required for any Amazon write action,
- the agent is read-only in the first release,
- V2 should replace manual ingestion only where Amazon APIs are strong enough,
- Helium 10 remains an external dependency until ranking automation is proven.

---

## 2) What to keep vs. what to drop from V1

### Keep

- Next.js + Supabase/Postgres foundation.
- Product profile and cost history concepts.
- Logbook / experiment / change / outcome concepts.
- Ads optimizer idea of rule packs, settings, and run history.
- Structured facts + views approach.

### Drop or demote

These are the biggest simplifications.

1. **Drop many primary surfaces.**
   V2 primary daily path should be only:
   - **Overview**
   - **Queries**

   Everything else moves to utilities/admin:
   - History
   - Config
   - Outcome Review
   - Imports Health
   - Bulksheet Ops
   - AI pack import/export

2. **Do not support all ad channels in release 1.**
   Start with **Sponsored Products** only for decision workflow.
   SB and SD can be ingested later, but they should not shape the initial UI or decision engine.

3. **Do not let the agent write to Amazon in release 1.**
   The agent may read, summarize, challenge, and draft recommendations.
   The operator approves. Execution remains manual or controlled handoff.

4. **Do not make “keyword” the main entity.**
   Split the concept into:
   - `search_query` = what shoppers typed
   - `ad_target` = what you bid on
   - `asin_query_goal` = what your product is trying to achieve for a query

5. **Do not keep multiple UI-level “truths.”**
   V2 UI reads from curated marts/views only.
   Raw tables exist for audit and reprocessing, not for direct UI use.

6. **Do not depend on AI-pack import/export in the main workflow.**
   Keep it as an admin/advanced utility only.

7. **Do not build autonomous “optimization.”**
   Build diagnosis + recommendation + logging first.

---

## 3) Recommended V2 operator workflow

### Daily path

#### A. Overview page
Answers:
- what changed,
- whether the product issue is traffic, conversion, economics, rank, or execution,
- what objective matters right now.

Core zones:
- product status / objective bar,
- KPI cards (sales, orders, sessions, CVR, ad spend, TACOS, contribution, margin),
- root-cause panel,
- recent changes and outcomes,
- freshness/finalization state,
- anomalies today.

#### B. Queries page
Answers:
- what query tiers changed,
- which queries climbed or fell,
- which queries are worth pushing,
- what guardrails block a push,
- what action was taken for each query and what happened.

Core zones:
- tier ladder summary,
- query list,
- per-query drilldown,
- rank history,
- SQP vs market performance,
- ad coverage,
- change history,
- recommended next action.

### Secondary utilities

- History / run history
- Config / guardrails
- Outcome Review
- Admin connections / import health
- Manual rank import / ranking automation utilities
- Execution handoff / bulk upload tools

---

## 4) Target architecture

## 4.1 System layers

### Layer 1 — Connectors
Sources:
- Amazon SP-API
- Amazon Ads API
- Amazon Marketing Stream (optional but recommended after core works)
- Helium 10 import (manual first)

### Layer 2 — Raw landing
Append-only raw payload storage:
- raw API responses or normalized ingestion files
- request metadata
- source timestamps
- job status
- finalization/freshness metadata

### Layer 3 — Canonical warehouse
Normalized facts and dimensions:
- account / marketplace / product / query / target / campaign
- daily and weekly facts
- entity mappings

### Layer 4 — Decision marts
Curated views for UI and agent use:
- product overview mart
- root-cause mart
- query decision mart
- rank tier mart
- change impact mart

### Layer 5 — Memory and review
Structured context tables:
- product context
- query goal context
- change decisions
- outcome reviews
- operator notes
- derived memory summaries

### Layer 6 — Interaction surfaces
- human UI
- agent read API / MCP-style read surface
- admin utilities

---

## 4.2 Core entities

### Accounts and auth
- `amazon_accounts`
- `amazon_marketplaces`
- `sp_api_connections`
- `ads_api_connections`
- `ads_profiles`
- `credential_refs` (store secrets outside DB when possible)

### Product model
- `products`
- `product_skus`
- `product_cost_history`
- `product_context_notes`

### Query model
- `search_queries`
- `asin_query_goals`
- `query_context_notes`
- `query_tier_rules`

### Rank model
- `rank_observations_daily`
- `rank_tier_daily`
- `rank_sources`

### Retail fact model
- `sales_daily_fact`
- `traffic_daily_fact`
- `economics_daily_fact`
- `intraday_product_pulse`

### Ads fact model
- `ad_campaign_dim`
- `ad_group_dim`
- `ad_target_dim`
- `ad_campaign_daily_fact`
- `ad_target_daily_fact`
- `ad_search_term_daily_fact` (later if needed)
- `ad_intraday_fact` (Marketing Stream)

### Market/query fact model
- `sqp_query_asin_weekly_fact`
- `search_terms_market_weekly_fact`

### Change + outcome model
- `change_requests`
- `change_actions`
- `change_action_entities`
- `outcome_reviews`
- `guardrail_events`
- `diagnosis_snapshots`

### Refresh + observability model
- `ingestion_jobs`
- `source_watermarks`
- `freshness_states`
- `anomaly_events`
- `connector_errors`

---

## 4.3 Data truth policy

You need one declared source of truth for each metric family.

### Suggested truth policy
- **Retail sales/traffic**: SP-API reports
- **Ad performance**: Amazon Ads API reporting / Marketing Stream
- **Query market performance**: SQP + Search Terms reports
- **Organic/sponsored rank**: Helium 10 initially
- **Unit economics**: internal cost history + fees/ad spend derivation
- **Change history / intent / outcome**: your own DB only

If two sources disagree, V2 must record:
- primary source,
- secondary source,
- mismatch flag,
- resolution rule.

---

## 5) Detailed build stages

## Stage 0 — Freeze the scope before writing more code

### Objective
Stop V2 from becoming another V1.

### Tasks
- Write one architecture decision record (ADR) for:
  - primary pages,
  - source-of-truth rules,
  - human vs agent authority,
  - write boundaries,
  - SP-first scope.
- Lock a V2 “kill list.”
- Define non-goals.

### Non-goals for release 1
- Autonomous campaign writes
- SB/SD full parity
- Fully automated Helium 10 sync
- Multi-user org permissions beyond your current operator model
- Perfect root-cause AI on day one

### Exit criteria
- One signed-off scope doc.
- Any feature not in scope goes to backlog.

---

## Stage 1 — Restructure the repo for V2 work

### Objective
Create clean boundaries so Codex can work phase-by-phase.

### Tasks
Create these top-level modules:

- `apps/web` — operator UI
- `src/connectors/sp-api`
- `src/connectors/ads-api`
- `src/connectors/helium10`
- `src/ingestion`
- `src/warehouse`
- `src/marts`
- `src/diagnosis`
- `src/memory`
- `src/changes`
- `src/testing/fixtures`

### UI cleanup
- Create new V2 route group:
  - `/v2/overview/[asin]`
  - `/v2/queries/[asin]`
  - `/v2/admin/connections`
  - `/v2/admin/imports`
  - `/v2/admin/history`
- Keep V1 routes alive during transition.
- Do not extend the 2,700+ line product page. Build new V2 pages separately.

### Exit criteria
- V2 pages exist as skeleton routes.
- Connector and mart modules exist.
- New work stops landing in monolithic V1 pages.

---

## Stage 2 — Set up Amazon APIs first

## 2A. SP-API setup

### Goal
Enable direct access to retail, analytics, and notification data.

### Recommended path
Use a **private/internal app** if this tool is only for your own business and permitted under your account structure. If the two Amazon accounts should remain strongly separated for compliance or legal reasons, use **separate app credentials / separate secret sets / separate connection records**, and consider separate deployments if you want hard isolation.

### Required setup steps
1. Create or use a **Solution Provider Portal** account.
2. Create a **developer profile**.
3. Register a **sandbox app** first.
4. Register the **production app**.
5. Configure **Login with Amazon (LWA)** authorization.
6. Select the roles you actually need.
7. Authorize the app for the seller account(s).
8. Store the refresh token(s) and app credentials securely.
9. Implement token refresh.
10. Make a first production call and log the result.

### Roles to request
Minimum likely set:
- **Brand Analytics**
- **Finances**
- any additional seller roles you need for inventory/order context later

### SP-API capabilities to wire first
Priority order:
1. `GET_SALES_AND_TRAFFIC_REPORT`
2. `GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT`
3. `GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT`
4. Finances API for fee/economics enrichment
5. Notifications API for hourly pulse

### V2 connector requirements
Your SP-API client must support:
- LWA access token refresh
- regional endpoint routing
- marketplace-aware requests
- report creation / polling / retrieval
- retries and backoff
- rate-limit logging
- job persistence

### Exit criteria
- One command/job can request and ingest sales + traffic business report for one account/marketplace.
- One command/job can request and ingest SQP for one ASIN window.
- One command/job can request and ingest Search Terms for one marketplace window.

## 2B. Ads API setup

### Goal
Enable direct access to ad structures and performance.

### Setup steps
1. Create a **Login with Amazon security profile** for Amazon Ads.
2. Apply for **Amazon Ads API access**.
3. Assign the approved access to the security profile.
4. Create an authorization grant from the advertising account.
5. Exchange the auth code for **access + refresh tokens**.
6. Retrieve **profile IDs** and map them by marketplace/account.
7. Persist profile metadata and token references.

### Ads data to wire first
Priority order:
1. daily campaign performance
2. daily target-level performance
3. campaign / ad group / target dimensions
4. change history if available from API surfaces you use
5. Marketing Stream hourly metrics

### Exit criteria
- One job can pull profiles.
- One job can ingest daily Sponsored Products performance for one profile and date range.
- One job can ingest target-level Sponsored Products facts for one profile and date range.

## 2C. Credential model

### Rules
- One connection record per Amazon account x API family.
- One ads profile record per marketplace profile.
- No mixed credentials in a shared env var blob.
- All jobs require explicit `account_id` and `marketplace`.
- Every row written must carry `account_id` and `marketplace`.

---

## Stage 3 — Build the ingestion backbone

### Objective
Replace manual file ingestion with scheduled API-backed jobs.

### Jobs to build
#### Daily batch jobs
- retail sales/traffic sync
- ad daily sync
- SQP weekly/monthly sync
- Search Terms sync
- finances sync

#### Intraday jobs
- ad pulse sync from Marketing Stream
- SP-API notification ingestion if enabled
- refresh-state updater

#### Manual jobs
- rank import from Helium 10
- backfill by date range
- replay failed jobs

### Required metadata per ingest
Every load writes:
- source name
- account_id
- marketplace
- requested_at
- source_window_start
- source_window_end
- retrieved_at
- processing_status
- freshness_state
- finalization_state
- source_confidence
- job_id
- checksum / idempotency key

### Freshness/finalization states
Use these enums:
- `live`
- `hourly`
- `daily`
- `weekly`

And:
- `requested`
- `processing`
- `available`
- `failed`

And:
- `partial_period`
- `provisional`
- `revisable`
- `final`

### Exit criteria
- Ingestion dashboard shows status for each source.
- Jobs are idempotent.
- Backfills can rerun safely.
- UI can tell whether data is current, delayed, or final.

---

## Stage 4 — Build the canonical marts before the UI

### Objective
Prevent V2 from querying raw tables directly.

### Required marts
#### Product overview mart
Contains, by ASIN/date window:
- sales
- orders
- sessions
- CVR
- ad spend
- ad sales
- TACOS
- estimated contribution
- freshness/finalization summary
- major deltas vs previous window

#### Root-cause mart
Contains deterministic features:
- traffic delta
- conversion delta
- price delta
- buy box / offer risk if available
- stock / inventory risk if available
- ads delivery delta
- budget exhaustion flags
- CPC/CPA shifts
- rank tier changes
- SQP share shifts
- recent changes in review window

#### Query mart
Contains per ASIN x query:
- current organic rank
- current sponsored rank
- current tier
- prior tier
- climb/fall flag
- SQP market size
- self impression/click/purchase share
- market CTR/CVR indexes
- ad coverage state
- objective mode
- guardrail state
- next suggested action

#### Change impact mart
Contains:
- change date
- change reason
- entities touched
- expected outcome window
- observed outcome windows
- verdict
- confidence

### Exit criteria
- UI pages can be built against marts only.
- Agent read layer points at marts + structured memory tables.

---

## Stage 5 — Build the memory system correctly

### Objective
Give the agent context without letting memory turn into unstructured junk.

### Memory types
#### Product memory
Store:
- product objective
- lifecycle stage
- hero queries
- economic constraints
- seasonal context
- known issues

#### Query memory
Store:
- target tier
- ranking objective
- push allowed / not allowed
- max CPC / CPA / TACOS
- known patterns for this query

#### Change memory
Store:
- what changed
- why it changed
- who approved it
- expected time window
- rollback condition

#### Outcome memory
Store:
- what happened after 3/7/14 days
- better / worse / neutral
- confidence
- lesson
- suggested future rule

### Important rule
Memory entries must be either:
- operator-authored, or
- system-derived from structured evidence,

not free-floating agent summaries with no evidence link.

### Suggested tables
- `product_context_notes`
- `query_context_notes`
- `change_actions`
- `outcome_reviews`
- `memory_evidence_links`
- `derived_memory_cards`

### Agent read surface
Create one read model per page:
- `agent_product_brief_v1`
- `agent_query_brief_v1`
- `agent_change_brief_v1`

These should join facts + context + outcome history into a stable contract.

### Exit criteria
- Agent can answer “what changed, why, and what happened last time?” from structured tables.
- Every memory item has traceable evidence.

---

## Stage 6 — Build the human UI

## 6A. Overview page

### Must show
- KPI cards with current vs previous
- freshness/finalization banner
- root-cause ranking with evidence for / against
- recent changes affecting this ASIN
- open guardrails / warnings
- today pulse / anomaly panel

### Root-cause design rule
Deterministic analysis first, AI narrative second.

The system should compute candidate causes before the model explains them.

### Exit criteria
- Operator can tell in under 30 seconds whether the main issue is traffic, conversion, economics, rank, or execution.

## 6B. Queries page

### Must show
- tier ladder summary
- number of queries in each tier
- climbed / fell since previous window
- query table with filters
- one expandable per-query panel

### Per-query panel must show
- organic rank history
- sponsored rank history
- current tier + target tier
- SQP share and market size
- current ad coverage
- current economics / guardrails
- recent change history
- recommended next move

### Exit criteria
- Operator can decide whether to push, hold, defend, or stop for one query without leaving the page.

---

## Stage 7 — Build the diagnosis engine and agent review loop

### Objective
The agent should challenge your diagnosis, not replace your judgment.

### Step 1: deterministic feature extraction
Compute features for each ASIN and query.

### Step 2: hypothesis ranking
Create candidate causes with scores.

### Step 3: agent review
The agent receives:
- structured facts,
- prior changes,
- outcome history,
- current constraints.

The agent must return:
- ranked causes,
- evidence for each,
- evidence against each,
- confidence,
- missing data,
- suggested next action,
- suggested non-action if evidence is weak.

### Step 4: operator decision
Operator accepts, edits, or rejects the diagnosis.

### Do not do in release 1
- direct writeback to Amazon
- self-triggered spend changes
- autonomous rollback

### Exit criteria
- Agent can disagree with a bad human diagnosis using structured evidence.
- Diagnosis output is inspectable and linked to evidence rows.

---

## Stage 8 — Change logging and execution handoff

### Objective
Every optimization action must have intent, context, and review.

### Change flow
1. operator selects ASIN + query
2. operator sets objective
3. operator records action plan
4. system logs change request
5. system generates optional execution handoff
6. operator executes manually
7. system records execution confirmation
8. review is scheduled automatically

### Store for each change
- ASIN
- query
- campaign / ad group / target if applicable
- objective
- hypothesis
- guardrails checked
- expected review date
- actual execution date
- outcome snapshot IDs

### Exit criteria
- No ad adjustment exists without an intent log.
- Outcome review queue is generated automatically.

---

## Stage 9 — Add intraday pulse safely

### Objective
See if today is abnormal without pretending unfinished data is final.

### Use cases
- ad delivery suddenly died after a change
- traffic dropped sharply today
- spend pacing abnormal

### Design rule
Intraday pulse is for **awareness**, not final judgment.

### UI requirement
Every intraday card must display:
- data source
- last refresh time
- revision risk label
- compare baseline window

### Exit criteria
- Today view clearly separates provisional pulse from finalized daily data.

---

## Stage 10 — Ranking data automation

### Objective
Reduce Helium 10 manual work without blocking V2 release.

### Release 1
- Manual CSV import remains supported.
- Build reliable parser + validation + dedupe + coverage report.

### Release 2 options
Evaluate in this order:
1. official Helium 10 API if available for your plan/use case
2. vendor-supported export automation if allowed
3. last resort manual import with strong tooling

### Important rule
Do **not** build fragile scraping as a foundation for V2 unless you accept the maintenance burden and terms risk.

### Exit criteria
- Manual import is fast, validated, and impossible to silently corrupt.
- Automation is optional, not blocking.

---

## 6) Amazon API implementation appendix

## 6.1 SP-API first call checklist

- [ ] Solution Provider Portal account exists
- [ ] Developer profile approved
- [ ] Sandbox app registered
- [ ] Production app registered
- [ ] LWA client ID and secret stored securely
- [ ] Refresh token stored securely
- [ ] Brand Analytics role approved
- [ ] Finances role approved
- [ ] Regional endpoint mapping configured
- [ ] Token refresh job implemented
- [ ] Report create -> poll -> retrieve flow implemented
- [ ] First `GET_SALES_AND_TRAFFIC_REPORT` stored successfully
- [ ] First SQP report stored successfully
- [ ] First Search Terms report stored successfully

## 6.2 Ads API first call checklist

- [ ] LWA security profile created
- [ ] Ads API access approved
- [ ] Access assigned to security profile
- [ ] Auth grant created from advertising account
- [ ] Access + refresh token exchange working
- [ ] `/v2/profiles` retrieval working
- [ ] Internal profile mapping created
- [ ] First SP daily report stored successfully
- [ ] First SP target-level report stored successfully

## 6.3 Source-specific notes

### Retail sales and traffic
Use SP-API reports for finalized retail performance.

### Profit
Treat profit as a **derived metric**, not a single-source metric.
Build it from:
- retail sales,
- ad spend,
- fees,
- refunds,
- cost history.

### Query intelligence
Use both:
- SQP for ASIN-relative query performance,
- Search Terms for broader market query rank / popularity context.

### Ranking
Keep Helium 10 as ranking source until you have a stable automation path.

### Intraday
Use Ads API / Marketing Stream and SP-API notifications for pulse, but keep “finalized” logic separate.

---

## 7) Codex + ChatGPT workflow

## 7.1 ChatGPT thinking mode should be used for
- architecture decisions
- schema reviews
- diagnosis logic design
- spec writing
- PR review
- bug triage and root-cause discussion

## 7.2 Codex should be used for
- implementing one scoped task at a time
- generating migrations
- writing typed connectors
- writing ingestion jobs
- creating UI components
- writing unit tests
- running browser tests
- preparing a PR-sized patch

## 7.3 Required build discipline for Codex
For every phase, give Codex:
1. one spec,
2. one acceptance checklist,
3. one test checklist,
4. one forbidden-changes list.

Do **not** ask Codex to “build V2.”
Ask it to complete one bounded step.

### Example task slices
- “Create SP-API token refresh service with secure env contract and unit tests.”
- “Add `sales_daily_fact` migration and ingestion repository.”
- “Build Overview KPI card component reading from `product_overview_mart` only.”
- “Add browser smoke test for `/v2/overview/[asin]` using fixture data.”

## 7.4 Suggested Codex skills to create
- `amazon-sp-api-skill`
- `amazon-ads-api-skill`
- `warehouse-migration-skill`
- `browser-e2e-skill`
- `root-cause-review-skill`
- `v2-ui-boundary-skill`

Each skill should include:
- scope,
- input contract,
- forbidden edits,
- validation commands,
- example tasks.

---

## 8) Testing plan

## 8.1 Test pyramid

### Unit tests
Required for:
- auth/token refresh
- report parsing
- normalization
- tier assignment
- root-cause feature extraction
- memory derivation
- guardrail evaluation

### Integration tests
Required for:
- connector -> raw landing
- raw -> canonical fact upsert
- mart computation
- change logging flow

### Browser tests
Required for:
- Overview page loads with seeded fixture data
- Queries page loads and expands a query row
- change logging form submits
- freshness/finalization banners display correctly
- agent review evidence panel renders

### Manual tests
Reserved for:
- live Amazon credential authorization
- production profile mapping
- real report backfills
- final operator UX validation

## 8.2 Important rule for Codex browser testing
Codex should browser-test **your app**, not Amazon Seller Central or Amazon Ads console with live credentials.

Use:
- seeded local DB fixtures,
- mocked connector responses,
- replayable sample payloads,
- staging environments with test connections.

Then only after those pass, do manual live-account smoke checks.

## 8.3 Test gates per PR
Every non-trivial PR must pass:
- lint
- typecheck
- unit tests
- integration tests relevant to the change
- browser smoke tests if UI changed

---

## 9) Suggested release order

## Release A — Foundation
- scope freeze
- repo restructure
- connection management UI
- SP-API auth service
- Ads API auth service
- ingestion job framework

## Release B — First useful data
- sales/traffic business report
- Sponsored Products daily performance
- SQP + Search Terms
- Helium 10 import
- initial marts

## Release C — First useful UI
- V2 Overview
- V2 Queries
- freshness state banners
- tier ladder

## Release D — Memory and review
- change logging
- outcome reviews
- product/query context notes
- agent review surface

## Release E — Intraday pulse
- Marketing Stream
- notifications
- anomaly rules

## Release F — Safer execution handoff
- draft actions
- bulk handoff generation
- rollback suggestions

---

## 10) What I would build first, in exact order

1. Scope freeze doc + kill list
2. Repo restructure for V2 routes and modules
3. SP-API auth + first Sales and Traffic report pull
4. Ads API auth + profile sync + SP daily report pull
5. Core warehouse tables for products, sales, ads, queries, ranks, changes
6. SQP + Search Terms ingestion
7. Helium 10 import cleanup
8. Product overview mart
9. Query decision mart
10. V2 Overview page
11. V2 Queries page
12. Change log + outcome review
13. Agent review API / MCP-style read layer
14. Intraday pulse
15. Execution handoff

---

## 11) Clear recommendation

Build V2 as a **two-page operating system** on top of a clean data core:

- **Overview** = what problem is happening now
- **Queries** = what to do about traffic/rank at the query level

Everything else is support infrastructure.

That is the best way to avoid repeating V1’s sprawl while still keeping the real power of the system.
