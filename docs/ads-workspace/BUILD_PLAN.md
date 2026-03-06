# Ads Workspace — Build Plan

This is the execution checklist for building the Ads Workspace.
Codex should work **phase-by-phase**, mark completed items in this file, and stop after the requested phase/subphase instead of partially starting later phases.

## Working thesis
Use AI for diagnosis, not exhaustive action generation. Move execution back to a human-in-the-loop Ads Workspace that stages manual changes, routes them through Bulksheet Ops, and logs/validates outcomes later.

## Current locked decisions
- [x] SP only for v1.
- [x] Combined keyword/target tab is renamed to **Targets**.
- [x] Placement metrics must remain campaign-level context, not target-level facts.
- [x] Parent target row shows target totals; search terms live under expand.
- [x] Ads Workspace supports both **Table** and **Trend** mode.
- [x] Draft changes are staged first; drafts are not facts.
- [x] Search terms tab is grouped first by `(asin, ads_type, normalized_search_term)` and then expands to campaign/ad group/keyword detail.
- [x] Daily change markers use chips / markers / tooltips, not full-row default highlight.
- [x] Objective text must support save-and-reuse.

## Important corrections / non-negotiables
- [x] Product filter in SP v1 is an advertised-ASIN **entity inclusion filter**, not guaranteed ASIN-only slicing for every campaign/target metric.
- [x] Entity-level P&L and break-even bid must remain nullable / coverage-gated until deterministic economics allocation exists.
- [x] `All` channel mode is not a v1 requirement; do not block SP delivery waiting for SP/SB/SD unification.
- [x] SD remains KIV.

## Phase 0 — Spec + agent scaffolding
- [x] Create `docs/ads-workspace/AGENTS.md`.
- [x] Create `docs/ads-workspace/BUILD_PLAN.md`.
- [x] Save an updated high-level plan in repo root as `ads-workspace-plan-v1.md`.
- [x] Add root `AGENTS.md` reference to Ads Workspace docs.

### Phase 0 acceptance
- [x] Repo contains an Ads Workspace spec Codex can follow.
- [x] Locked decisions and caveats are written down.

---

## Phase 1 — Foundation: staging schema, types, repositories

### Objectives
Create the staging layer for manual Ads Workspace drafts before any major UI work.

### Tasks
- [x] Add a new Supabase migration for Ads Workspace staging.
- [x] Create table `ads_change_sets`.
- [x] Create table `ads_change_set_items`.
- [x] Create table `ads_objective_presets`.
- [x] Add indexes for account/date/status lookups.
- [x] Add basic RLS policies consistent with existing logbook/admin usage.
- [x] Add TS types for the new tables under the web app/lib layer.
- [ ] Add repository helpers for:
  - [x] create / update / list change sets
  - [x] create / update / delete / list change set items
  - [x] create / update / list / archive objective presets
- [x] Add input validation helpers for change-set drafts and presets.
- [x] Add tests for validation and basic repository-to-action mapping logic.

### Required schema fields
#### `ads_change_sets`
- id
- account_id
- marketplace
- experiment_id nullable
- name
- status (`draft`, `review_ready`, `generated`, `cancelled`)
- objective nullable
- hypothesis nullable
- forecast_window_days nullable
- review_after_days nullable
- notes nullable
- filters_json
- generated_run_id nullable
- generated_artifact_json nullable
- created_at
- updated_at

#### `ads_change_set_items`
- id
- change_set_id
- channel
- entity_level (`campaign`, `placement`, `ad_group`, `target`, `search_term_context`)
- entity_key
- campaign_id nullable
- ad_group_id nullable
- target_id nullable
- target_key nullable
- placement_code nullable
- action_type
- before_json
- after_json
- objective nullable
- hypothesis nullable
- forecast_json nullable
- review_after_days nullable
- notes nullable
- objective_preset_id nullable
- ui_context_json nullable
- created_at
- updated_at

#### `ads_objective_presets`
- id
- account_id
- marketplace
- channel nullable
- name
- objective
- hypothesis nullable
- forecast_json nullable
- review_after_days nullable
- notes nullable
- is_archived boolean default false
- created_at
- updated_at

### Rules
- One composer save may emit multiple `ads_change_set_items` rows.
- Each item must remain one atomic action type.
- `log_changes` is untouched in this phase.

### Phase 1 acceptance
- [ ] Migration is applied cleanly.
- [x] Validation/tests cover the new draft entities.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 2 — SP workspace shell + Targets table mode

### Objectives
Replace the current placeholder Ads page flow with a real SP-first workspace shell and Targets tab.

### Tasks
- [x] Refactor `/ads/performance` into a workspace shell with shared filters/state.
- [x] Keep channel selector visible, but SP is the only enabled implementation in v1.
- [ ] Add workspace-level controls:
  - [x] date range
  - [x] product selection
  - [x] view mode (`table`, `trend`)
  - [x] level tab selection
- [x] Implement SP product selector options.
- [x] Implement SP product filter resolution using deterministic advertised-ASIN entity inclusion logic.
- [x] Build SP Targets query helpers from `sp_targeting_daily_fact_latest`.
- [ ] Show Targets table with KPIs:
  - [x] status
  - [x] target text / expression
  - [x] type
  - [x] portfolio
  - [x] campaign
  - [x] ad group
  - [x] match type
  - [x] STIS
  - [x] STIR
  - [x] TOS IS
  - [x] impressions
  - [x] clicks
  - [x] orders
  - [x] units
  - [x] sales
  - [x] conversion
  - [x] spend
  - [x] CPC
  - [x] CTR
  - [x] ACOS
  - [x] ROAS
  - [x] P&L (nullable / coverage-gated)
  - [x] break-even bid (nullable / coverage-gated)
  - [x] last activity
- [x] Add expandable child rows for search terms from `sp_stis_daily_fact_latest`.
- [x] Keep same-text search term pinned first when available.
- [x] Surface placement context as clearly labeled campaign-level context; do not flatten it into target facts.
- [x] Add empty/coverage-warning states when product scope is ambiguous.

### Rules
- Parent row totals must remain target totals.
- STIS / STIR / TOS IS must not be averaged over time.
- If P&L / break-even bid coverage is not deterministic, show `—` plus coverage note.

### Phase 2 acceptance
- [x] Targets tab is the first real operational tab.
- [x] Product filter works for SP entity inclusion.
- [x] Expanded search-term rows appear under the correct target.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 3 — Change Composer + objective presets + draft save flow

### Objectives
Make the operator able to stage manual edits directly while reviewing targets.

### Tasks
- [x] Add a reusable **Change Composer** drawer/modal.
- [x] Allow opening the composer from SP Targets rows.
- [x] Prefill identity chain and current settings.
- [x] Composer must support only valid editable fields for the row/context.
- [ ] Supported SP action types:
  - [x] `update_target_bid`
  - [x] `update_target_state`
  - [x] `update_ad_group_default_bid`
  - [x] `update_ad_group_state`
  - [x] `update_campaign_budget`
  - [x] `update_campaign_state`
  - [x] `update_campaign_bidding_strategy`
  - [x] `update_placement_modifier`
- [x] Add objective preset picker.
- [x] Add create/save objective preset from the composer.
- [x] Save resolved objective/hypothesis/forecast/review notes onto each draft item.
- [x] Add “active change set” behavior so the operator can keep queuing edits without leaving the page.
- [x] Add queue count / draft badge in the Ads workspace shell.

### Rules
- Draft save must write to `ads_change_sets` / `ads_change_set_items` only.
- One form submit can generate multiple atomic draft items.
- Composer must not expose unsupported actions for the current entity level.

### Phase 3 acceptance
- [x] Operator can create a draft change set and keep adding actions.
- [x] Objective presets can be saved and reused.
- [x] Draft items are persisted with the full reasoning payload.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 4 — Queue review + bulksheet generation + freeze to logbook

### Objectives
Turn staged workspace edits into a reviewable bulksheet execution flow.

### Tasks
- [x] Add a **Change queue / Review** surface (tab in Ads workspace or linked Bulksheet Ops page).
- [x] Show grouped draft items by change set.
- [x] Add per-item edit/remove support.
- [x] Add draft-set status transitions (`draft` -> `review_ready` -> `generated` / `cancelled`).
- [x] Convert SP draft items into `SpUpdateAction[]` using existing action-builder conventions.
- [x] Generate SP bulksheet output through the existing generator stack.
- [x] Persist generated run metadata on the change set.
- [x] Freeze generated actions into `log_changes` + `log_change_entities` at generation time.
- [x] Optionally link generated changes to a chosen experiment when `experiment_id` is present.
- [x] Keep validation compatible with the existing next-bulksheet-ingest workflow.

### Rules
- Generation is the execution boundary.
- Only generated/frozen actions become logbook facts.
- Review UI must show before/after values and full identity chain.

### Phase 4 acceptance
- [x] A staged change set can generate a valid SP bulksheet.
- [x] Generation writes logbook facts only once.
- [x] Existing validation flow still works.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 5 — SP Campaigns, Placements, and Ad groups tabs

### Objectives
Add the remaining SP operational tabs so changes can start from any major entity level.

### Tasks
- [x] Implement **Campaigns** table mode.
- [x] Implement **Placements** table mode.
- [x] Implement **Ad groups** table mode.
- [x] Add row-level composer entry points on all three tabs.
- [x] Campaign KPIs:
  - [x] ads type
  - [x] campaign status
  - [x] campaign name
  - [x] bidding strategy
  - [x] portfolio
  - [x] impressions
  - [x] clicks
  - [x] orders
  - [x] units
  - [x] sales
  - [x] conversion
  - [x] spend
  - [x] CPC / CPS (use existing repo naming rules; do not invent duplicates without a clear definition)
  - [x] CTR
  - [x] ACOS
  - [x] ROAS
  - [x] P&L (nullable / coverage-gated)
- [x] Placement KPIs:
  - [x] type
  - [x] portfolio
  - [x] campaign
  - [x] placement
  - [x] placement modifier
  - [x] impressions
  - [x] clicks
  - [x] orders
  - [x] units
  - [x] sales
  - [x] conversion
  - [x] spend
  - [x] CPC
  - [x] CTR
  - [x] ACOS
  - [x] ROAS
  - [x] P&L (nullable / coverage-gated)
- [x] Ad group KPIs:
  - [x] ads type
  - [x] campaign
  - [x] ad group status
  - [x] ad group
  - [x] default bid
  - [x] impressions
  - [x] clicks
  - [x] orders
  - [x] units
  - [x] sales
  - [x] conversion
  - [x] spend
  - [x] CPC
  - [x] CTR
  - [x] ACOS
  - [x] ROAS
  - [x] P&L (nullable / coverage-gated)

### Rules
- Placement rows remain campaign-level facts.
- Targets tab may consume placement rows as context, but never as target-owned metrics.

### Phase 5 acceptance
- [x] All three SP tabs are usable in table mode.
- [x] Composer can be launched from any supported row.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 6 — SP Search terms tab

### Objectives
Provide a search-term-first operational view for SP.

### Tasks
- [ ] Build SP Search terms parent grouping by `(asin, ads_type, normalized_search_term)`.
- [ ] Show each search term once per ad type.
- [ ] Add expandable child rows with KPI header:
  - [ ] campaign
  - [ ] ad group
  - [ ] keyword / target
  - [ ] status
  - [ ] match type
  - [ ] impressions
  - [ ] clicks
  - [ ] orders
  - [ ] units
  - [ ] sales
  - [ ] conversion
  - [ ] cost
  - [ ] current bid
  - [ ] CPC
  - [ ] ACOS
  - [ ] ROAS
- [ ] Search-term parent KPIs:
  - [ ] sponsored
  - [ ] search term
  - [ ] impressions
  - [ ] clicks
  - [ ] orders
  - [ ] units
  - [ ] spend
  - [ ] sales
  - [ ] CTR
  - [ ] CPC
  - [ ] cost / order
  - [ ] conversion
  - [ ] ACOS
  - [ ] ROAS
  - [ ] P&L (nullable / coverage-gated)
- [ ] Add coverage/fallback behavior for missing STIS rows.

### Rules
- Search terms live under the selected ad type; do not mix SP with SB/SD here in v1.
- This phase is SP-only.

### Phase 6 acceptance
- [ ] Search terms tab is operational for SP.
- [ ] Parent/child grouping is stable and deduplicated.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

## Phase 7 — Trend mode + daily change markers

### Objectives
Add the sales-style diagnostic view for Ads without sacrificing the normal editing table.

### Tasks
- [ ] Add `trend` mode toggle for supported tabs.
- [ ] Build daily horizontal trend layout with dates as columns and KPIs as rows.
- [ ] Support hover drill-in for daily KPI values.
- [ ] Show daily trend support for high-value diagnostics:
  - [ ] spend
  - [ ] sales
  - [ ] orders
  - [ ] units
  - [ ] ACOS
  - [ ] ROAS
  - [ ] CTR
  - [ ] CPC
  - [ ] STIS
  - [ ] STIR
  - [ ] TOS IS
- [ ] Add change markers to daily trend/date cells.
- [ ] Markers must open change details / reasoning / before-after summary.
- [ ] Pull change markers from generated/validated changes, not raw drafts by default.

### Rules
- Trend mode is diagnostic-first.
- Inline editing remains table-first.
- Non-additive diagnostics must stay daily or explicit-window, never silently averaged.

### Phase 7 acceptance
- [ ] Operator can switch between table and trend.
- [ ] Trend mode surfaces before/after intervention patterns clearly.
- [ ] Change markers are visible and explainable.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

## Phase 8 — SB extension

### Objectives
Extend the workspace to Sponsored Brands after SP flow is stable.

### Tasks
- [ ] Enable SB channel selector path.
- [ ] Add SB Targets/Campaigns/Ad groups/Placements coverage where facts already exist.
- [ ] Extend objective presets and draft items to SB.
- [ ] Extend queue -> bulksheet generation flow to `SbUpdateAction[]`.
- [ ] Add SB Search terms behavior where data is available.
- [ ] Keep unsupported SB coverage explicit with warnings.

### Rules
- Do not back-port SD into this phase.
- Do not add `All` mode until SB parity is stable enough to make it honest.

### Phase 8 acceptance
- [ ] SB flow can stage and generate supported update actions.
- [ ] Ads Workspace remains explicit about partial coverage.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

## KIV / later backlog
- [ ] True `All` mode with explicit cross-channel capability matrix.
- [ ] SD workspace support.
- [ ] Exact ASIN-sliced entity metrics where facts layer supports them.
- [ ] Exact entity-level P&L allocation and break-even bid for mixed-ASIN entities.
- [ ] AI diagnostic widgets embedded directly inside the workspace.
- [ ] Batch approval / batch review UX improvements.
- [ ] Rich experiment linking and post-change evaluation views.

## Notes for Codex
- Do not silently change KPI definitions to “make the UI work”.
- If a metric is not trustworthy at that scope, render it nullable with an explicit warning.
- Prefer adding narrow helper modules over growing one large page file.
- Update this checklist when a phase is completed.
