# Amazon Performance Hub V2 — Fast-track minimum usable API-backed path

## Control note
This file records a temporary V2 task-ordering control note.

## Status
Active sequence-adjustment note.

## Purpose
Record a deliberate near-term execution sequence change so the repo explains:
- why the team is temporarily prioritizing a narrower path,
- what is and is not changing,
- how this still fits the V2 architecture,
- when the normal build plan order resumes.

## Summary
This is a delivery-sequence adjustment, not a product architecture change.

The target V2 architecture remains:
- retail sales and traffic from SP-API
- ads from Amazon Ads API
- SQP and Search Terms from Amazon reports
- ranking by manual Helium 10 import until automation is proven
- curated marts as the read layer before UI and agent access
- human-first operation with no autonomous Amazon writes

The fast-track adjustment exists because the operator's immediate goal is to use the system as soon as possible with:
- API-backed sales and traffic
- API-backed ads
- API-backed SQP and Search Terms
- manual ranking upload only

## Why this note is needed
The current repo has already completed major API and ingestion work, but the first useful daily operating path is still blocked because product-level sales and traffic usage is still tied to the legacy SI SalesTrend layer in some current read paths.

Without this note, the repo can look confusing:
- the long-term plan says V2 should move to API-backed sources
- the current execution history includes many bounded tasks
- the next fastest value path is narrower than the default stage-by-stage interpretation

This note makes that prioritization explicit.

## What is not changing
This fast-track does not change the following:
- Stage definitions
- `docs/v2/TASK_REGISTRY.json` stage definitions or task ids
- source-of-truth policy
- no-write operator approval rule
- manual ranking fallback policy
- requirement that UI and future MCP/agent reads should use curated marts, not raw tables
- the long-term need for root-cause, memory, change logging, and review features

## What is changing
The near-term implementation order is temporarily optimized for minimum usable API-backed operation.

Instead of treating all remaining Stage 4 and Stage 6 work as equal next steps, the repo should prioritize the narrowest sequence that gets the operator to a usable state with only manual ranking upload remaining.

## Fast-track goal
Reach this usable condition as early as possible:

1. Sales and traffic come from SP-API, not SI manual upload.
2. Ads come from Ads API.
3. SQP and Search Terms come from API-backed report ingestion.
4. Ranking remains manual upload.
5. A stable mart/read layer exists for product overview.
6. A first Overview UI reads from the mart.
7. After manual ranking upload, the data set is complete enough for AI/MCP read access later.

## Fast-track sequence
Current fast-track step: `FT-01`.

### FT-01
Finish SP-API retail sales and traffic ingest end-to-end as the active retail truth path.

### FT-02
Land the API-backed retail fact or latest-view contract as the warehouse truth for retail sales and traffic.

### FT-03
Move the product overview mart off `si_sales_trend_daily_latest` and onto API-backed retail plus Ads-backed sources.

### FT-04
Ship the first usable V2 Overview page backed only by the product overview mart.

### FT-05
Resume the normal fast-track path for query-facing work:
- query decision mart
- rank tier mart
- Queries UI
- freshness and finalization surfaces
- remaining review and logging work

## Explicit interpretation
This sequence is a controlled reprioritization inside the existing V2 plan.

It is justified because the operator's minimum usable requirement is:
- no manual sales import
- no manual ads import
- no manual SQP import
- ranking manual upload allowed

That requirement still matches the source-of-truth policy and release approach already defined in V2.

## Decision rules
While this fast-track note is active:

- Prefer tasks that reduce reliance on SI manual SalesTrend data.
- Prefer tasks that make one bounded Overview workflow usable sooner.
- Do not widen scope into memory, diagnosis, agent review, or execution handoff before the first API-backed Overview path is usable.
- Keep ranking as manual import until separate automation proof is accepted.
- Do not bypass marts by wiring UI directly to raw tables.

## Exit condition
This note stops controlling task order once all of the following are true:
- retail sales and traffic are API-backed in the active product overview path
- ads are API-backed in the active product overview path
- SQP/Search Terms ingestion is runnable through the ingestion backbone
- manual ranking upload remains usable
- the first V2 Overview page is usable against marts only

At that point, task priority returns to the normal registry and build-plan flow.

## Repo update requirement
When this note is committed, also update `docs/v2/BUILD_STATUS.md` to:
- mention that a fast-track minimum-usable API-backed path is active
- state the reason
- state the current fast-track step
- state that this is a sequence adjustment, not an architecture change
