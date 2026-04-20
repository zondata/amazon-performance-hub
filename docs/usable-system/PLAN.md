# Amazon Performance Hub — Usable System Build Plan

## Purpose

Get to a minimum usable system this sprint. Stop the V2 linear build. Four steps, ~14 tasks total.

After this plan ships, I can:
- See yesterday's API-sourced Amazon data in the existing V1 UI (sales, ads, SQP).
- Keep uploading Helium 10 ranking data manually as today.
- Discuss ads with Claude over MCP, backed by real tables.
- Log decisions and retrieve prior reasoning on demand.

This plan replaces the sequencing in `docs/v2/amazon-performance-hub-v2-build-plan.md` for the foreseeable future. That plan is paused, not deleted.

## Why this plan exists

The V2 linear build, after 31 completed tasks, is still 8/20 of the way to a first usable app (per `docs/v2/TASK_PROGRESS.md`). The gap is structural: V2 is building a warehouse / marts / memory stack on top of V1's already-working UI, with MCP as task 13 of 15 in the priority list. This plan inverts the order — usable loop first, deeper architecture later only if real usage reveals the need.

## Protocol rules (non-negotiable)

Apply to every task file in this plan.

1. **"Newly able to do X" test.** Every task file starts with one sentence: "After this task runs, I can newly do X." If X cannot be written without the words *boundary*, *contract*, *adapter*, *shape*, *handoff*, *interface*, or *artifact*, the task is wrong. Rewrite or remove it.

2. **No scope ratchet.** Tasks do not grow during execution. If mid-task something else is needed, stop and create a new task file; do not fold it in.

3. **One thing per task.** A task either (a) audits, (b) writes code, or (c) deploys — never all three. Audits produce docs. Code produces code. Deploys produce a running system.

4. **V1 is the UI.** No V2 UI work in this plan. No marts. No new pages. V1 UI reads from V1 table shapes. Everything new lands into those shapes.

---

## Step 1 — Freeze the V2 linear build

Goal: leave V2 in a known state so work can resume from a clear commit if ever needed.

- **Task 1.1** — Write freeze note at `docs/v2/FREEZE.md` stating the V2 linear build is paused, current in-progress task (S2A-06) is marked `paused`, this plan supersedes it, and no tasks V2-16+ or S3+ are to be executed until freeze lifts. Update `docs/v2/TASK_PROGRESS.md` to reflect pause.

Exit: freeze note committed; progress doc updated.

---

## Step 2 — Fork OB1 for Open Brain

Goal: persistent memory + capture + MCP, without building it from scratch.

- **Task 2.1** — Fork the OB1 repo and complete base setup per its `docs/01-getting-started.md`. Provision a fresh Supabase project for the brain (keep separate from Performance Hub data). Deploy the MCP server. Verify Claude Desktop/Chrome can connect and call `write_thought` / `search_thoughts`.
  - *Newly able to do:* write a thought from Claude and retrieve it back.

- **Task 2.2** — Seed Open Brain with current operating context. Paste in: B0FYPRWPN1 recovery history (the April 6–7 revert, flywheel strategy, 6 priority keywords, May 7 inventory deadline), condensed PPC skill content, and the last two weeks of Claude conversations about the product. One structured thought per logical chunk.
  - *Newly able to do:* ask Claude "what's my current state on B0FYPRWPN1?" and get an accurate answer pulled from the brain, not from a re-pasted conversation.

- **Task 2.3 (optional)** — Set up Slack or Discord capture via `recipes/auto-capture`. Defer if Steps 3–4 feel more urgent.
  - *Newly able to do:* jot a thought on mobile and have it land in the brain.

Exit: Claude has a working persistent memory tied to the Amazon business; B0FYPRWPN1 context is retrievable in a fresh chat.

---

## Step 3 — Land V2 API pulls into V1 table shapes

Goal: V1 UI lights up with API-sourced data. No more manual CSV uploads for sales, ads, or SQP.

- **Task 3.1** — Audit V1 table dependencies. For each V1 page (Dashboard, Ads Optimizer, Products overview, Ads Performance, SQP, Ranking), list the exact Supabase tables/views it queries. Produce `docs/usable-system/v1-table-map.md`. No code changes.
  - *Newly able to do:* know exactly which views to build in Tasks 3.2–3.4.

- **Task 3.2** — Create SQL views that project V2 SP-API retail data into V1's sales table shape (likely `si_sales_trend_daily_latest` or upstream of it). Validate on one day where CSV-sourced and API-sourced data both exist — numbers match within tolerance.
  - *Newly able to do:* V1 sales pages show yesterday's data from the API without a CSV upload.

- **Task 3.3** — Create SQL views that project V2 Ads API campaign/placement/targeting data into V1's ads table shapes (`sp_campaign_daily_gold`, `sp_placement_latest`, `sp_targeting_latest`). Validate on one day of overlap.
  - *Newly able to do:* V1 Ads Optimizer shows yesterday's ads performance from the API without a bulk-sheet upload.

- **Task 3.4** — Create SQL views that project V2 SP-API SQP data into V1's `sqp_weekly` shape. Validate on one week of overlap.
  - *Newly able to do:* V1 SQP pages show the latest week's SQP from the API.

- **Task 3.5** — Schedule a daily cron/worker to run the V2 ingestion jobs on cadence (retail + ads daily; SQP weekly). Use whatever scheduler the repo already supports (Vercel cron, Supabase scheduled functions, or GitHub Actions — pick the simplest).
  - *Newly able to do:* open V1 in the morning and see yesterday's data without running anything manually.

Exit: V1 UI shows yesterday's sales, ads, and latest-week SQP automatically. H10 ranking stays manual upload exactly as today. No V1 UI code changes.

---

## Step 4 — Thin ads MCP over V1 tables

Goal: Claude can discuss ads, read full context, and log decisions directly against V1 tables.

- **Task 4.1** — Scaffold a minimal MCP server (same tech stack as OB1's server — Deno edge function on Supabase — or Node/TypeScript if preferred). Empty tool list. Deploy, connect to Claude, confirm handshake.
  - *Newly able to do:* Claude sees an "amazon-performance-hub" MCP server with zero tools.

- **Task 4.2** — Implement `read_ads_performance(asin, date_range, scope?)`. Joins campaign daily, placement, and targeting for the ASIN. Returns structured JSON with per-day and per-keyword breakdowns.
  - *Newly able to do:* ask Claude "how is B0FYPRWPN1 ads doing this week?" and get a grounded answer.

- **Task 4.3** — Implement `read_sqp(asin, weeks_back)` and `read_rank(asin, keywords?, date_range)`. Reads V1's `sqp_weekly` and `h10_keyword_tracker`.
  - *Newly able to do:* Claude can pull SQP and ranking context to reason about organic vs ad-driven performance.

- **Task 4.4** — Implement `read_changelog(asin, date_range)` and `write_change(asin, kind, from, to, reasoning, expected_outcome, risk, review_date)`. Writes to V1's existing `logbook_*` tables. `kind` is a text enum: `bid`, `placement_modifier`, `keyword_add`, `keyword_negate`, `image`, `a_plus`, `price`, `review_response`, `other`.
  - *Newly able to do:* Claude drafts a change, I approve, Claude logs it with reasoning + review date; later Claude can pull the log and tell me what we changed and why.

- **Task 4.5** — Wire all tools into the MCP, deploy, test end-to-end with one real B0FYPRWPN1 discussion. Success test: Claude reads yesterday's ads → proposes a small bid change → I approve → Claude logs it with `review_date = today + 7` → I execute in Amazon → seven days later Claude reviews outcome.
  - *Newly able to do:* run the full discuss-log-review loop on a real ads decision.

Exit: minimum usable system is live. I can discuss ads with Claude backed by real data, log decisions, and retrieve them later. V1 UI still works. H10 uploads still work. Open Brain carries thought-level context alongside the structured ads data.

---

## What this plan does NOT include

Stated explicitly to prevent re-widening during execution.

- No V2 marts (Stage 4 in the old plan).
- No V2 memory tables — OB1 replaces.
- No V2 Overview / Queries UI pages — V1 UI remains the UI.
- No autonomous writes to Amazon — manual execution always.
- No H10 automation — manual upload stays.
- No competitor tracking, no listing change log beyond ads, no intraday pulse. These go to a later plan if real usage reveals the need.
- No refactor of V1 code. V1 is frozen good-enough.

## Chat split for execution

This master plan is the only output from the current chat.

- **Step 1** — one fresh chat. Produces Task 1.1 file.
- **Step 2** — one fresh chat. Produces Tasks 2.1–2.3 files.
- **Step 3** — one fresh chat for Task 3.1 (audit is standalone because its output feeds 3.2–3.4). One more chat for Tasks 3.2–3.5.
- **Step 4** — one fresh chat for Tasks 4.1–4.2 (scaffold + first real tool). One more for 4.3–4.5.

At the start of each new chat: paste `PLAN.md` + relevant prior task output + `docs/v2/FREEZE.md`.

## Exit condition for the whole plan

On a Monday morning, I can:

1. Open V1 UI, see yesterday's ads / sales / SQP auto-populated.
2. Manually upload Helium 10 ranking data as before.
3. Ask Claude "what happened to B0FYPRWPN1 last week?" and get a grounded answer pulled from ads data + logbook + Open Brain.
4. Discuss a bid change, approve it, have Claude log it with a review date.
5. Seven days later, have Claude read the log + fresh data and evaluate outcome.

When all five are true, this plan is done. The next planning chapter starts from real usage evidence, not architectural imagination.
