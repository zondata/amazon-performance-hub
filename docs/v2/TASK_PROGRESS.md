# Amazon Performance Hub V2 — Task Progress

Last generated: 2026-04-17

## Overall

- Total tasks: 72
- Done: 22
- Verify: 1
- In progress: 1
- Blocked: 0
- Remaining open: 50
- Remaining fast-track tasks: 22

## Stage summary

| Stage | Done | Verify | In progress | Blocked | Todo | Gates done | Gates total | Can move on? |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Stage 0 — scope freeze and control files | 2 | 0 | 0 | 0 | 0 | 2 | 2 | Yes |
| Stage 1 — repo boundary for V2 | 3 | 0 | 0 | 0 | 0 | 3 | 3 | Yes |
| Stage 2A — SP-API auth + first retail pulls | 10 | 1 | 1 | 0 | 1 | 4 | 4 | Yes |
| Stage 2B — Ads API auth + first Sponsored Products pulls | 7 | 0 | 0 | 0 | 4 | 1 | 4 | No |
| Stage 3 — ingestion backbone | 0 | 0 | 0 | 0 | 8 | 0 | 2 | No |
| Stage 4 — canonical marts | 0 | 0 | 0 | 0 | 6 | 0 | 1 | No |
| Stage 5 — memory system | 0 | 0 | 0 | 0 | 5 | 0 | 1 | No |
| Stage 6 — human UI | 0 | 0 | 0 | 0 | 6 | 0 | 1 | No |
| Stage 7 — diagnosis + agent review loop | 0 | 0 | 0 | 0 | 5 | 0 | 1 | No |
| Stage 8 — change logging + execution handoff | 0 | 0 | 0 | 0 | 5 | 0 | 1 | No |
| Stage 9 — intraday pulse | 0 | 0 | 0 | 0 | 4 | 0 | 1 | No |
| Stage 10 — ranking automation evaluation | 0 | 0 | 0 | 0 | 4 | 0 | 1 | No |

### Stage 2B — Ads API auth + first Sponsored Products pulls — gate tasks still required

- S2B-G2 — Gate: first Sponsored Products campaign daily ingest succeeds
- S2B-G3 — Gate: first Sponsored Products target daily ingest succeeds
- S2B-G4 — Gate: Stage 2B tests green

### Stage 3 — ingestion backbone — gate tasks still required

- S3-G1 — Gate: daily batch jobs runnable end-to-end
- S3-G2 — Gate: app can show current vs delayed vs final data state

### Stage 4 — canonical marts — gate tasks still required

- S4-G1 — Gate: V2 UI can read only from marts, not raw tables

### Stage 5 — memory system — gate tasks still required

- S5-G1 — Gate: agent can answer what changed, why, and what happened last time from structured tables

### Stage 6 — human UI — gate tasks still required

- S6-G1 — Gate: first usable Overview + Queries operating flow

### Stage 7 — diagnosis + agent review loop — gate tasks still required

- S7-G1 — Gate: inspectable agent review loop working

### Stage 8 — change logging + execution handoff — gate tasks still required

- S8-G1 — Gate: no optimization action exists without intent log

### Stage 9 — intraday pulse — gate tasks still required

- S9-G1 — Gate: provisional pulse is clearly separated from final daily data

### Stage 10 — ranking automation evaluation — gate tasks still required

- S10-G1 — Gate: ranking automation decision is explicit and non-blocking

## Milestones

### Ready to move from Stage 2A to Stage 2B

- Progress: 4/4
- Complete: Yes

### First usable app (fast track)

- Progress: 5/20
- Complete: No
- Remaining:
  - S2B-G2 — Gate: first Sponsored Products campaign daily ingest succeeds
  - S2B-G3 — Gate: first Sponsored Products target daily ingest succeeds
  - S2B-G4 — Gate: Stage 2B tests green
  - S3-G1 — Gate: daily batch jobs runnable end-to-end
  - S3-G2 — Gate: app can show current vs delayed vs final data state
  - S4-01 — Build product overview mart
  - S4-03 — Build query decision mart
  - S4-04 — Build rank tier mart
  - S4-G1 — Gate: V2 UI can read only from marts, not raw tables
  - S6-01 — Build Overview page KPI shell
  - S6-03 — Build Queries ladder summary and query table
  - S6-04 — Build per-query drilldown panel
  - S6-05 — Add freshness/finalization banners to Overview and Queries
  - S6-G1 — Gate: first usable Overview + Queries operating flow
  - S8-01 — Build change request form and intent log model

### Agent-aware review system

- Progress: 0/3
- Complete: No
- Remaining:
  - S5-G1 — Gate: agent can answer what changed, why, and what happened last time from structured tables
  - S7-G1 — Gate: inspectable agent review loop working
  - S8-G1 — Gate: no optimization action exists without intent log

## Open tasks by stage

### Stage 2A — SP-API auth + first retail pulls

| ID | Status | Priority | Gate | Fast-track | Title |
|---|---|---|---|---|---|
| S2A-02 | todo | must | no | yes | Create SP-API connection/auth persistence model |
| S2A-06 | in_progress | must | no | yes | Implement Sales and Traffic Business Report parse + ingest |
| S2A-09 | verify | should | no | no | Add SP-API admin connection health check and smoke route/command |

### Stage 2B — Ads API auth + first Sponsored Products pulls

| ID | Status | Priority | Gate | Fast-track | Title |
|---|---|---|---|---|---|
| S2B-07 | todo | should | no | no | Add Ads admin connection health check and smoke route/command |
| S2B-G2 | todo | must | yes | yes | Gate: first Sponsored Products campaign daily ingest succeeds |
| S2B-G3 | todo | must | yes | yes | Gate: first Sponsored Products target daily ingest succeeds |
| S2B-G4 | todo | must | yes | yes | Gate: Stage 2B tests green |

### Stage 3 — ingestion backbone

| ID | Status | Priority | Gate | Fast-track | Title |
|---|---|---|---|---|---|
| S3-01 | todo | must | no | yes | Create ingestion_jobs and source_watermarks schema |
| S3-02 | todo | must | no | yes | Implement idempotent job runner with retries and replay |
| S3-03 | todo | must | no | yes | Implement backfill by date range and safe reruns |
| S3-04 | todo | must | no | yes | Model freshness_state, collection_state, finalization_state, source_confidence |
| S3-05 | todo | should | no | no | Build ingestion dashboard/status view |
| S3-06 | todo | must | no | yes | Build manual Helium 10 rank CSV import with validation and dedupe |
| S3-G1 | todo | must | yes | yes | Gate: daily batch jobs runnable end-to-end |
| S3-G2 | todo | must | yes | yes | Gate: app can show current vs delayed vs final data state |

### Stage 4 — canonical marts

| ID | Status | Priority | Gate | Fast-track | Title |
|---|---|---|---|---|---|
| S4-01 | todo | must | no | yes | Build product overview mart |
| S4-02 | todo | must | no | no | Build root-cause mart |
| S4-03 | todo | must | no | yes | Build query decision mart |
| S4-04 | todo | must | no | yes | Build rank tier mart |
| S4-05 | todo | should | no | no | Build change impact mart |
| S4-G1 | todo | must | yes | yes | Gate: V2 UI can read only from marts, not raw tables |

### Stage 5 — memory system

| ID | Status | Priority | Gate | Fast-track | Title |
|---|---|---|---|---|---|
| S5-01 | todo | should | no | no | Create product context notes and product memory tables |
| S5-02 | todo | should | no | no | Create query context notes and asin_query_goals memory tables |
| S5-03 | todo | should | no | no | Create change/outcome/memory evidence link tables |
| S5-04 | todo | should | no | no | Build derived memory cards and agent brief read models |
| S5-G1 | todo | must | yes | no | Gate: agent can answer what changed, why, and what happened last time from structured tables |

### Stage 6 — human UI

| ID | Status | Priority | Gate | Fast-track | Title |
|---|---|---|---|---|---|
| S6-01 | todo | must | no | yes | Build Overview page KPI shell |
| S6-02 | todo | should | no | no | Build Overview root-cause panel with evidence for/against |
| S6-03 | todo | must | no | yes | Build Queries ladder summary and query table |
| S6-04 | todo | must | no | yes | Build per-query drilldown panel |
| S6-05 | todo | must | no | yes | Add freshness/finalization banners to Overview and Queries |
| S6-G1 | todo | must | yes | yes | Gate: first usable Overview + Queries operating flow |

### Stage 7 — diagnosis + agent review loop

| ID | Status | Priority | Gate | Fast-track | Title |
|---|---|---|---|---|---|
| S7-01 | todo | should | no | no | Build deterministic feature extraction engine |
| S7-02 | todo | should | no | no | Build candidate-cause ranking logic |
| S7-03 | todo | should | no | no | Build agent review contract and read surface |
| S7-04 | todo | should | no | no | Build inspectable evidence panel and disagreement support |
| S7-G1 | todo | must | yes | no | Gate: inspectable agent review loop working |

### Stage 8 — change logging + execution handoff

| ID | Status | Priority | Gate | Fast-track | Title |
|---|---|---|---|---|---|
| S8-01 | todo | must | no | yes | Build change request form and intent log model |
| S8-02 | todo | should | no | no | Record guardrail checks and warnings with each planned change |
| S8-03 | todo | should | no | no | Create execution confirmation and outcome review queue |
| S8-04 | todo | should | no | no | Show recent change history on Queries page |
| S8-G1 | todo | must | yes | no | Gate: no optimization action exists without intent log |

### Stage 9 — intraday pulse

| ID | Status | Priority | Gate | Fast-track | Title |
|---|---|---|---|---|---|
| S9-01 | todo | later | no | no | Create intraday ads/pulse schema |
| S9-02 | todo | later | no | no | Integrate Marketing Stream or chosen intraday source |
| S9-03 | todo | later | no | no | Build pulse UI with revision risk labels |
| S9-G1 | todo | must | yes | no | Gate: provisional pulse is clearly separated from final daily data |

### Stage 10 — ranking automation evaluation

| ID | Status | Priority | Gate | Fast-track | Title |
|---|---|---|---|---|---|
| S10-01 | todo | later | no | no | Harden manual Helium 10 parser and exception handling |
| S10-02 | todo | later | no | no | Add coverage/dedupe/exception reporting for rank imports |
| S10-03 | todo | later | no | no | Evaluate ranking automation options and document decision |
| S10-G1 | todo | must | yes | no | Gate: ranking automation decision is explicit and non-blocking |
