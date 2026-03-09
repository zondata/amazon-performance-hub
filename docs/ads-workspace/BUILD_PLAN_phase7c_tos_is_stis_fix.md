# Ads Workspace — Build Plan (Phase 7C STIS / STIR / TOS IS correction)

This is a focused corrective build plan for Ads Workspace KPI semantics.
Codex should work phase-by-phase, mark completed items in this file, and stop after the requested phase instead of partially starting later phases.

## Why this plan exists
- [x] Fix glossary and repo terminology so **STIS** means **Search Term Impression Share**.
- [x] Keep **STIR** as **Search Term Impression Rank**.
- [x] Treat `top_of_search_impression_share` from the SP Targeting report as **TOS IS** on Ads Workspace target surfaces.
- [x] Stop mapping `top_of_search_impression_share` into the `stis` field.
- [x] Do **not** roll up target-level `top_of_search_impression_share` into campaign-level TOS IS.

## Source of truth after the fix
- [x] **STIS** = `sp_stis_daily_fact_latest.search_term_impression_share`
- [x] **STIR** = `sp_stis_daily_fact_latest.search_term_impression_rank`
- [x] **TOS IS** = `sp_targeting_daily_fact_latest.top_of_search_impression_share`
- [x] All three are non-additive diagnostics. Do not average across time or entities unless there is an explicit weighted rule.
- [x] Campaign table/trend must not show TOS IS unless a true campaign-grain source is ingested separately.

---

## Phase 7C.1 — Semantics correction + table surfaces

### Objectives
Correct the KPI definitions and parent target-row semantics first, before touching trend behavior.

### Tasks
- [x] Update `docs/skills/library/ads_kpi_scope_glossary.md`
  - [x] Change STIS definition to **search term impression share**.
  - [x] Keep STIR as **search term impression rank**.
  - [x] Change TOS IS definition to **top-of-search impression share**.
  - [x] Clarify that in the current repo, TOS IS is available on SP target rows via the Targeting report.
  - [x] Clarify that campaign-level TOS IS needs its own source and must not be inferred by averaging target rows.
- [x] Update wording in `docs/ads-workspace/AGENTS.md` and any local AGENTS files that still imply TOS IS is unavailable on target surfaces.
- [x] In `apps/web/src/lib/ads/spTargetsWorkspaceModel.ts`:
  - [x] Stop assigning `top_of_search_impression_share` into parent-row `stis`.
  - [x] Assign target-row `top_of_search_impression_share` into parent-row `tos_is`.
  - [x] Keep child search-term STIS from `search_term_impression_share`.
  - [x] Build one representative child diagnostic selector for the parent row using the existing priority:
    - [x] same-text search term first
    - [x] then higher impressions
    - [x] then higher clicks
    - [x] then higher spend
    - [x] then latest activity
  - [x] Set parent-row `stis` from that representative child’s `search_term_impression_share`.
  - [x] Set parent-row `stir` from that representative child’s `search_term_impression_rank`.
- [x] In `apps/web/src/components/ads/SpTargetsTable.tsx`:
  - [x] Make TOS IS show the actual target-row value instead of `—`.
  - [x] Update STIS note to reflect representative child sourcing.
  - [x] Update TOS IS note to reflect target targeting-report sourcing.
  - [x] Remove the fake `TOS IS = —` placeholder from placement context.
- [x] Campaign surfaces:
  - [x] Keep campaign table/trend free of STIS and STIR.
  - [x] Do not add TOS IS to campaign table/trend from target rows.

### Phase 7C.1 acceptance
- [x] Parent target-row `stis`, `stir`, and `tos_is` each have one correct meaning.
- [x] Targets table no longer labels `top_of_search_impression_share` as STIS.
- [x] Campaign surfaces remain free of fake derived STIS/STIR/TOS IS.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 7C.2 — Trend parity + copy cleanup + consistency sweep

### Objectives
Make target trend behavior match the corrected table semantics and remove stale helper text.

### Tasks
- [x] In `apps/web/src/lib/ads/getSpWorkspaceTrendData.ts`:
  - [x] Extend the `sp_stis_daily_fact_latest` select list to include `search_term_impression_share`.
- [x] In `apps/web/src/lib/ads/spWorkspaceTrendModel.ts`:
  - [x] Add `search_term_impression_share` to the target STIS/STIR diagnostic row type.
  - [x] Stop assigning `top_of_search_impression_share` into daily `stis`.
  - [x] Assign `top_of_search_impression_share` into daily `tos_is`.
  - [x] For each date, choose one representative STIS/STIR child using the same same-text / impressions / clicks / spend / recency ordering already used for STIR.
  - [x] Set trend `stis` from `search_term_impression_share` of that selected child.
  - [x] Set trend `stir` from `search_term_impression_rank` of that selected child.
  - [x] Set trend `tos_is` from target-row `top_of_search_impression_share`.
- [x] Update support notes, warnings, and tooltips so Targets trend explains:
  - [x] STIS/STIR come from search-term impression-share coverage.
  - [x] TOS IS comes from target targeting-report coverage.
- [x] Search the repo for any place still treating `top_of_search_impression_share` as STIS.
- [x] Preserve existing correct handling in `apps/web/src/app/products/[asin]/logbook/ai-data-pack-v3/route.ts`.

### Phase 7C.2 acceptance
- [x] Target trend shows correct daily `stis`, `stir`, and `tos_is` semantics.
- [x] Support copy no longer claims TOS IS is unavailable on target surfaces.
- [x] No remaining Ads Workspace surfaces map `top_of_search_impression_share` into `stis`.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 7C.3 — Regression coverage

### Objectives
Lock the corrected semantics in tests so later navigation / KPI work does not regress them.

### Tasks
- [x] Add parser regression coverage confirming:
  - [x] SP Targeting report parses `top_of_search_impression_share`.
  - [x] SP STIS report parses `search_term_impression_share`.
- [x] Add target table model tests proving:
  - [x] parent `tos_is` comes from `sp_targeting_daily_fact_latest.top_of_search_impression_share`.
  - [x] parent `stis` comes from representative child `search_term_impression_share`.
  - [x] parent `stir` comes from representative child `search_term_impression_rank`.
- [x] Add target trend tests proving:
  - [x] `tos_is` is populated when targeting rows have `top_of_search_impression_share`.
  - [x] `stis` and `stir` are populated from STIS rows.
  - [x] the same representative child is used for both STIS and STIR on a given date.
- [x] Add campaign trend tests proving STIS/STIR/TOS IS do not appear as fake derived campaign metrics.

### Phase 7C.3 acceptance
- [x] Regression tests protect the corrected KPI semantics.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

## Decision notes for Codex
- [x] This is a terminology correction plus model remap, not a new parser project.
- [x] The TOS IS field is already parsed and stored.
- [x] The highest-risk bug is that the current target parent STIS column and target child STIS column mean different metrics.
- [x] Complete Phase 7C.1 first before any navigation refactor that depends on KPI labels.
