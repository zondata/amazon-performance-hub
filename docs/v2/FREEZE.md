# V2 Linear Build — FREEZE

**Status:** PAUSED
**Frozen on:** 2026-04-20
**Frozen at commit:** 3431b68
**Superseded by:** `/PLAN.md` (Amazon Performance Hub — Usable System Build Plan; stored in this repo as `docs/usable-system/PLAN.md`)

## What this means

The V2 linear build described in `docs/v2/amazon-performance-hub-v2-build-plan.md` is paused. It is not abandoned. It is not deleted. No work should be done against it while this freeze is in effect.

## State at freeze

- **In-progress task:** S2A-06 — marked `paused` in `TASK_PROGRESS.md`.
- **Last completed task:** `TASK_PROGRESS.md` does not list an individual last completed task; it records **Done: 31** and the latest completed milestone as **Ready to move from Stage 2A to Stage 2B — Complete: Yes**.
- **Tasks not to execute until freeze lifts:** any V2-16+, any S3+, and anything downstream of S2A-06 in the V2 plan.

## Why

After 31 completed V2 tasks, the V2 linear build was still 8/20 of the way to a first usable app (per `TASK_PROGRESS.md` at freeze time). The usable-system plan in `/PLAN.md` inverts the order: project V2 API ingestion into V1 table shapes, fork OB1 for memory, and add a thin ads MCP — producing a usable loop first and deeper architecture later only if real usage justifies it.

## What continues during freeze

- V1 UI, V1 tables, H10 manual upload — unchanged and in active use.
- V2 API ingestion code already written — kept; its outputs will be projected into V1 shapes by Step 3 of the usable-system plan.
- V2 tests, types, fixtures — left in place; not actively maintained.

## What does NOT continue

- No new V2 tasks executed.
- No V2 UI work (`overview`, `queries`, or any new V2 page).
- No V2 marts.
- No V2 memory tables (OB1 replaces them).
- No refactors of V2 code for their own sake.

## Resume protocol

To lift this freeze:

1. The usable-system plan in `/PLAN.md` must have reached its stated exit condition (all five Monday-morning checks true), OR that plan must have been explicitly superseded by a later plan.
2. A new commit must edit this file to change `Status:` from `PAUSED` to `LIFTED`, record the lift date, and state which plan is being resumed or replaces both.
3. `TASK_PROGRESS.md` must be reviewed against reality before any paused task resumes.

No informal unfreezing. No "just this one task." If the temptation arises to run a V2 task while this freeze is in effect, that is evidence for adding a task to the active plan instead.
