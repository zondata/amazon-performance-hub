# Ads Workspace — Build Plan (Phase 7B update)

This is the execution checklist for building the Ads Workspace.
Codex should work **phase-by-phase**, mark completed items in this file, and stop after the requested phase/subphase instead of partially starting later phases.

> This file is a **new build-plan revision** that preserves the previous build plan and adds a Phase 7B SP stabilization / UX polish sequence before SB expansion.

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
- [x] Search Terms units may remain null-safe when the current STIS export does not provide a units field.
- [x] Trend mode may reuse campaign-level placement facts for campaign-level fallback only; do not flatten placement facts into target-owned metrics.
- [x] Rank context in Targets must remain **context**, not target-owned ad-performance fact.

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
- [x] Build SP Search terms parent grouping by `(asin, ads_type, normalized_search_term)`.
- [x] Show each search term once per ad type.
- [x] Add expandable child rows with KPI header:
  - [x] campaign
  - [x] ad group
  - [x] keyword / target
  - [x] status
  - [x] match type
  - [x] impressions
  - [x] clicks
  - [x] orders
  - [x] units
  - [x] sales
  - [x] conversion
  - [x] cost
  - [x] current bid
  - [x] CPC
  - [x] ACOS
  - [x] ROAS
- [x] Search-term parent KPIs:
  - [x] sponsored
  - [x] search term
  - [x] impressions
  - [x] clicks
  - [x] orders
  - [x] units
  - [x] spend
  - [x] sales
  - [x] CTR
  - [x] CPC
  - [x] cost / order
  - [x] conversion
  - [x] ACOS
  - [x] ROAS
  - [x] P&L (nullable / coverage-gated)
- [x] Add coverage/fallback behavior for missing STIS rows.

### Rules
- Search terms live under the selected ad type; do not mix SP with SB/SD here in v1.
- This phase is SP-only.

### Phase 6 acceptance
- [x] Search terms tab is operational for SP.
- [x] Parent/child grouping is stable and deduplicated.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 7 — Trend mode + daily change markers

### Objectives
Add the sales-style diagnostic view for Ads without sacrificing the normal editing table.

### Tasks
- [x] Add `trend` mode toggle for supported tabs.
- [x] Build daily horizontal trend layout with dates as columns and KPIs as rows.
- [x] Support hover drill-in for daily KPI values.
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
- [x] Add change markers to daily trend/date cells.
- [x] Markers must open change details / reasoning / before-after summary.
- [x] Pull change markers from generated/validated changes, not raw drafts by default.

### Current slice note
- Campaigns and Targets are the first supported trend tabs in this phase.
- Ad Groups, Placements, and Search Terms trend slices remain explicit follow-up work.
- Phase 7B below is the ordered SP stabilization / polish pass before SB.

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

## Phase 7B — SP stabilization and UX polish before SB

### Objectives
Finish the SP workspace hardening and usability pass before Sponsored Brands expansion.

### Global rules
- Treat 7B as **SP-first stabilization**, not scope creep.
- Work subphase-by-subphase; stop after the requested subphase instead of partially starting later subphases.
- Do not weaken any null-safety rules just to fill UI cells.
- Keep Search Terms units null-safe unless a deterministic source exists.
- Rank additions in Targets must be clearly labeled **context**, not target-owned performance facts.
- Prefer reusable table/trend infrastructure over one-off per-tab hacks.
- Preserve existing table mode and queue/composer behavior unless the subphase explicitly changes them.

### Phase 7B-A — correctness and hardening

#### Objectives
Resolve remaining SP correctness issues and harden layout behavior before broader UX additions.

#### Tasks
- [x] Fix Campaign Trend units so trend mode uses the same trustworthy campaign-units fallback logic as Campaign table mode.
- [x] Fix Change Composer bidding strategy options so the value is actually editable, not read-only/current-value only.
- [x] Extend placement modifier editing support to all SP placement types used in the workspace:
  - [x] Top of Search (TOS)
  - [x] Rest of Search (ROS)
  - [x] Product Pages (PP)
- [x] Fix horizontal scrollbar architecture so the visible scrollbar truly reaches the last column in Ads Workspace tables/trend grids.
- [x] Minimum responsive hardening for SP workspace:
  - [x] stack controls cleanly on smaller screens
  - [x] eliminate broken horizontal/vertical overflow
  - [x] preserve usable scroll behavior
  - [x] keep sticky behavior working once introduced

#### Rules
- Campaign Trend units may reuse campaign-level placement fallback only at campaign scope.
- Do not invent Search Terms units.
- Responsive hardening does not mean “fit every wide table without scrolling”; horizontal scroll remains acceptable for analytical tables.

#### Acceptance
- [x] Campaign trend units no longer disagree with trustworthy campaign-level fallback logic.
- [x] Composer supports editable bidding strategy and all required SP placement modifiers.
- [x] Horizontal scrolling reaches the actual last visible column.
- [x] Small-screen layout remains usable.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

### Phase 7B-B — reusable table/trend UX polish

#### Objectives
Add high-value reusable UX improvements that make the SP workspace easier to inspect without changing metric definitions.

#### Tasks
- [x] Add sticky/frozen headers across supported Ads Workspace tabs.
- [x] Add rightmost mini trend bar chart column in Trend view, reusing the Sales-page pattern where practical.
- [x] Add visual differentiation for expanded child sections:
  - [x] color/style expanded search-term rows in Targets
  - [x] color/style expanded child rows in Search Terms
- [x] Add a global workspace **Show IDs** toggle, default off.
  - [x] default display remains human-readable name only
  - [x] when enabled, show IDs alongside names in muted secondary text
- [x] Add scoped drilldown navigation:
  - [x] Campaign row can drill into Ad Groups
  - [x] Ad Group row can drill into Targets
  - [x] preserve date/product/view state when drilling down

#### Rules
- Sticky headers must not break existing scroll behavior.
- Trend mini charts are supplemental diagnostics, not replacements for numeric cells.
- Drilldown should stay within Ads Workspace semantics, not jump to unrelated pages.

#### Acceptance
- [x] Sticky headers work consistently on supported tabs.
- [x] Trend view has usable rightmost mini chart diagnostics.
- [x] Expanded child sections are visually distinguishable from parent rows.
- [x] ID toggle works without cluttering the default view.
- [x] Drilldown preserves workspace context.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

### Phase 7B-C — configurability and operator ergonomics

#### Objectives
Add operator controls for column management, filtering, wrapping, and non-modal editing in a staged way.

#### Tasks
- [x] Header interactions:
  - [x] add per-column sort
  - [x] add basic numeric filter popover with:
    - [x] `>=`
    - [x] `<=`
    - [x] `>`
    - [x] `<`
    - [x] `has value`
  - [ ] add advanced AND/OR filter builder only after basic filters are stable
- [x] Add **Wrap long labels** toggle:
  - [x] default to clamped/multi-line-safe display
  - [x] allow fuller wrap when enabled
- [x] Add per-tab column settings in stages:
  - [x] show / hide columns
  - [x] reorder columns
  - [x] freeze / unfreeze columns
  - [x] save defaults per tab/view
  - [x] font size controls
- [x] Convert Change Composer from modal/expand-only flow to a docked non-modal side panel first.
  - [x] keep page/table/trend context visible while composing
  - [x] only consider draggable pop-out later if still needed
- [x] Further responsive refinements after the above controls land.

#### Rules
- Do not start with a full complex filter DSL if basic sort/filter controls are not stable.
- Save defaults per tab/view, not one global layout that breaks all surfaces.
- Docked composer is preferred over draggable floating-window complexity in this phase.

#### Acceptance
- [x] Operators can sort and apply basic numeric filters in-header.
- [x] Long labels are readable without forcing every row into excessive height.
- [x] Column settings are configurable per tab/view.
- [x] Composer can stay open while inspecting the workspace.
- [x] Responsive behavior remains usable after these controls are added.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

### Post-7B-C — active draft highlight safety

#### Objectives
Make currently staged SP draft edits visually obvious in the workspace so operators do not accidentally restage the same entity.

#### Tasks
- [x] Derive active staged entity identity from the current active draft change set items only.
- [x] Add strongest direct row highlight for staged SP table rows:
  - [x] Campaign rows
  - [x] Ad Group rows
  - [x] Target rows
  - [x] Placement rows
- [x] Add lighter contextual ancestor highlight where identity is deterministic:
  - [x] Campaign rows for staged ad-group / target / placement edits
  - [x] Ad Group rows for staged target edits
- [x] Keep highlight tied to active draft state only so it clears when the draft item is removed or the change set leaves `draft` status.
- [x] Add tests for staged-highlight derivation and row wiring.

#### Acceptance
- [x] Active staged SP table rows are visibly distinguishable from untouched rows.
- [x] Directly edited rows are stronger than contextual ancestor rows.
- [x] Highlight does not persist for generated or non-draft change sets.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

### Phase 7B-D — conditional rank context in Targets

#### Objectives
Add rank context to Targets in a way that is explicit about scope and coverage.

#### Tasks
- [ ] Add **Rank context** cell/column to Targets.
- [ ] Show Organic rank on top (bold) and Sponsored rank below in the same cell.
- [ ] Gate rank context to trustworthy coverage only, such as:
  - [ ] single-ASIN context
  - [ ] or another deterministic rank-context mapping with explicit rules
- [ ] Keep null-safe display when rank context is not trustworthy.
- [ ] If useful, expose supporting coverage note / tooltip that rank is contextual, not target-owned ad-performance fact.

#### Rules
- Rank context must not be mislabeled as a target-owned performance metric.
- Do not backfill/invent rank for ambiguous ASIN coverage.

#### Acceptance
- [ ] Rank context is visible where trustworthy.
- [ ] Organic and Sponsored ranks are readable in one cell.
- [ ] Ambiguous coverage stays null-safe with explicit explanation.
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
- Start Phase 8 only after the requested Phase 7 / 7B SP checkpoint is stable enough to serve as a clean baseline.

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
- Update this checklist when a phase/subphase is completed.
