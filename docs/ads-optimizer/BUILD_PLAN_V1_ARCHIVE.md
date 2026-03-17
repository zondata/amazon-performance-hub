# Ads Optimizer — BUILD PLAN

This checklist is designed for **Codex phase-by-phase execution**.
Codex should only complete the requested phase, mark finished checkboxes, and stop.
Do **not** jump ahead into later phases.

## Locked decisions

- [x] SP only for V1.
- [x] New left-sidebar section; do not replace or break `/ads/performance`.
- [x] Optimizer is a **recommendation layer first**.
- [x] Existing Ads Workspace remains the execution boundary in early V1.
- [x] Existing Bulksheet Ops / logbook / validation flow stay intact.
- [x] Existing product overview and keyword workflows must remain usable.
- [x] Optimizer config/state must live in new optimizer tables, not inside current ad fact tables.
- [x] Product profile context remains separate from optimizer runtime state.
- [x] Versioned rule packs / templates / scoring configs are required.
- [x] Rollback must be possible by switching back to an older config version.
- [x] Manual run first; background scheduling can come later.
- [x] No AI dependency for core recommendation logic in V1.

## Non-negotiables

- [x] Never break the existing `/ads/performance` workspace.
- [x] Never write optimizer runtime state into `product_profile.profile_json`.
- [x] Never directly mutate existing fact tables.
- [x] Use new tables prefixed with `ads_optimizer_`.
- [x] All recommendation outputs must include reason codes and supporting metrics.
- [x] Existing change-set / queue / bulksheet generation remains the only execution path until a later phase explicitly changes that.
- [x] Feature-flag the new section so unfinished work does not leak into normal use.

---

## Phase 0 — Spec, AGENTS, and route isolation contract

### Objectives
Create the optimizer-specific instructions and define the repo boundary so Codex does not mix this build with the current Ads Workspace.

### Tasks
- [ ] Create `docs/ads-optimizer/AGENTS.md`.
- [ ] Create `docs/ads-optimizer/BUILD_PLAN.md`.
- [ ] Create `apps/web/src/app/ads/optimizer/AGENTS.md`.
- [ ] Create `apps/web/src/lib/ads-optimizer/AGENTS.md`.
- [x] Update root `AGENTS.md` with a short pointer to `docs/ads-optimizer/AGENTS.md`.
- [ ] Write the optimizer isolation contract:
  - [ ] `/ads/performance` remains unchanged in behavior.
  - [ ] optimizer lives at `/ads/optimizer`.
  - [ ] sidebar gets a separate item for optimizer.
  - [ ] feature flag required before surface is visible.
- [ ] Define V1 execution boundary:
  - [ ] recommendations only,
  - [ ] handoff to existing Ads Workspace drafts,
  - [ ] no direct auto-execution.

### Phase 0 acceptance
- [ ] Optimizer docs exist and are scoped.
- [ ] Repo has a written contract that protects current Ads Workspace behavior.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 1 — New shell, sidebar entry, feature flag

### Objectives
Add the new optimizer section without touching current behavior.

### Tasks
- [x] Add `ENABLE_ADS_OPTIMIZER` env flag.
- [x] Add a new left-sidebar item: `Ads Optimizer`.
- [x] Create `/ads/optimizer` route shell.
- [x] Keep `/ads/performance` unchanged.
- [x] Add shell-level filters:
  - [x] date range
  - [x] ASIN selector
  - [x] marketplace/account context display
  - [x] view switch placeholder (`overview`, `targets`, `config`, `history`)
- [x] Add explicit “SP only in V1” banner/state.
- [x] Add safe empty states when optimizer tables are not ready yet.
- [x] Ensure hidden behavior when feature flag is off.

### Phase 1 acceptance
- [x] `/ads/optimizer` renders only when enabled.
- [x] Existing `/ads/performance` still works exactly as before.
- [x] Existing `/products/[asin]` pages still work.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 2 — Versioned config foundation

### Objectives
Create the persistent, versioned settings backbone for the optimizer.

### Tasks
- [x] Add Supabase migration(s) for optimizer config tables.
- [x] Create `ads_optimizer_rule_packs`.
- [x] Create `ads_optimizer_rule_pack_versions`.
- [x] Create `ads_optimizer_product_settings`.
- [x] Create `ads_optimizer_manual_overrides`.
- [x] Add indexes for product, active-version, and date lookups.
- [x] Add TS types under `apps/web/src/lib/ads-optimizer`.
- [ ] Add repository helpers for:
  - [x] create/list/archive rule packs
  - [x] create/list/activate/archive rule pack versions
  - [x] assign rule pack version to product
  - [x] save product optimizer settings
  - [x] save manual strategic overrides
- [x] Seed one default rule pack version for SP V1.
- [x] Support version metadata:
  - [x] version label
  - [x] change summary
  - [x] created_from_version_id nullable
  - [x] activated_at
  - [x] archived_at nullable

### Required settings fields
#### `ads_optimizer_product_settings`
- product_id
- account_id
- marketplace
- archetype (`design_led`, `visibility_led`, `hybrid`)
- optimizer_enabled boolean
- default_objective_mode nullable
- rule_pack_version_id
- strategic_notes nullable
- guardrail_overrides_json nullable
- created_at
- updated_at

#### `ads_optimizer_rule_pack_versions`
- rule_pack_version_id
- rule_pack_id
- version_label
- status (`draft`, `active`, `archived`)
- change_summary
- change_payload_json
- created_from_version_id nullable
- created_at
- activated_at nullable
- archived_at nullable

### Phase 2 acceptance
- [x] Config tables migrate cleanly.
- [x] One product can be assigned to one active rule pack version.
- [x] Rule pack versions are immutable after activation except for archive/activation metadata.
- [x] Rollback is possible by switching product assignment to an older version.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 3 — Product command-center inputs

### Objectives
Compute product-level optimizer inputs without touching current product profile behavior.

### Tasks
- [x] Build product-level metrics loader using existing facts tables/views.
- [x] Compute product-level raw metrics:
  - [x] sales
  - [x] orders
  - [x] units
  - [x] ad spend
  - [x] ad sales
  - [x] TACOS
  - [x] average price
  - [x] cost coverage
  - [x] break-even ACoS
  - [x] contribution before ads per unit
  - [x] contribution after ads
- [x] Compute product-level visibility inputs:
  - [x] organic rank coverage where available
  - [x] hero-query rank trend where available
  - [x] SQP demand coverage where available
- [x] Implement product state classification:
  - [x] structurally weak
  - [x] loss
  - [x] break even
  - [x] profitable
- [x] Implement product objective recommendation:
  - [x] recover
  - [x] break even
  - [x] harvest profit
  - [x] scale profit
  - [x] rank growth
  - [x] rank defense
- [x] Add product command-center overview UI for the selected ASIN.
- [x] Add safe coverage notes when required inputs are missing.

### Phase 3 acceptance
- [x] A selected ASIN shows product state + recommended objective.
- [x] Missing economics or rank inputs are clearly surfaced, not silently guessed.
- [x] No current product overview editor behavior is broken.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 4 — Optimizer run + snapshot backbone

### Objectives
Create auditable optimizer runs and persist product/target snapshots.

### Tasks
- [x] Add migration(s) for runtime tables.
- [x] Create `ads_optimizer_runs`.
- [x] Create `ads_optimizer_product_snapshot`.
- [x] Create `ads_optimizer_target_snapshot`.
- [x] Create `ads_optimizer_role_transition_log`.
- [x] Create `ads_optimizer_recommendation_snapshot`.
- [x] Create run status fields:
  - [x] `pending`
  - [x] `running`
  - [x] `completed`
  - [x] `failed`
- [x] Add a manual “Run optimizer now” action or CLI path for V1.
- [x] Snapshot the exact inputs used for each run.
- [x] Snapshot the exact outputs used for each target decision.
- [x] Prevent silent overwrite of prior runs.

### Phase 4 acceptance
- [x] A manual run can be created for one ASIN and date range.
- [x] A completed run stores product + target snapshots.
- [x] A failed run stores diagnostics instead of partial silent success.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 5 — Target profile engine

### Objectives
Build the raw + derived target profile object.

### Tasks
- [x] Build target-level raw metrics loader from existing SP facts.
- [x] Pull target-level raw inputs:
  - [x] impressions
  - [x] clicks
  - [x] spend
  - [x] orders
  - [x] sales
  - [x] CPC
  - [x] CTR
  - [x] CVR
  - [x] ACoS
  - [x] ROAS
  - [x] TOS IS
  - [x] STIS
  - [x] STIR
  - [x] campaign / ad group / target identity chain
  - [x] demand proxies
  - [x] placement context
  - [x] search term diagnostics
- [x] Compute target derived metrics:
  - [x] contribution after ads
  - [x] break-even gap
  - [x] max CPC support gap
  - [x] loss dollars / profit dollars
  - [x] click velocity
  - [x] impression velocity
  - [x] organic leverage proxy
- [x] Store full target profile snapshot per run.

### Phase 5 acceptance
- [x] Target profile rows render for a selected ASIN.
- [x] Every row has both raw and derived fields.
- [x] Coverage gaps are explicit.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 6 — State engine: efficiency, confidence, importance, tier

### Objectives
Classify targets before role assignment.

### Tasks
- [x] Implement efficiency states:
  - [x] no data
  - [x] learning / no sale
  - [x] converting but loss-making
  - [x] break-even
  - [x] profitable
- [x] Implement confidence states:
  - [x] insufficient
  - [x] directional
  - [x] confirmed
- [x] Implement importance states / tiers:
  - [x] Tier 1 dominant
  - [x] Tier 2 core
  - [x] Tier 3 test / long-tail
- [x] Compute opportunity score.
- [x] Compute risk score.
- [x] Store reason codes for each state decision.

### Phase 6 acceptance
- [x] Known targets classify into sensible states.
- [x] Reason codes are visible and auditable.
- [x] Tiering is partly mathematical and partly configurable.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 7 — Role engine + dynamic guardrails

### Objectives
Resolve desired/current role and the allowed action envelope.

### Tasks
- [x] Implement desired roles:
  - [x] Discover
  - [x] Harvest
  - [x] Scale
  - [x] Rank Push
  - [x] Rank Defend
  - [x] Suppress
- [x] Implement current-role resolution from:
  - [x] previous role
  - [x] desired role
  - [x] current data
  - [x] transition rules
- [x] Implement dynamic guardrail categories:
  - [x] no-sale spend cap
  - [x] no-sale click cap
  - [x] max loss per cycle
  - [x] max bid increase per cycle
  - [x] max bid decrease per cycle
  - [x] max placement bias increase per cycle
  - [x] rank-push time limit
  - [x] manual approval threshold
  - [x] auto-pause threshold
  - [x] min bid floor / max bid ceiling
- [x] Resolve guardrails from:
  - [x] rule pack version
  - [x] product objective
  - [x] role
  - [x] archetype
  - [x] confidence
  - [x] importance
  - [x] product overrides
- [x] Log role transitions with reason codes.

### Phase 7 acceptance
- [x] Targets receive desired role + current role + resolved guardrails.
- [x] Role changes change operating mode, not only labels.
- [x] Transition reasons are saved.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 8 — Recommendation engine

### Objectives
Turn profile + role + guardrails into a concrete recommendation set.

### Tasks
- [x] Implement spend direction engine:
  - [x] increase
  - [x] hold
  - [x] reduce
  - [x] collapse
  - [x] stop
- [x] Implement action recommendation types:
  - [x] update target bid
  - [x] update target state
  - [x] update placement modifier
  - [x] isolate query candidate
  - [x] negative candidate
  - [x] change review cadence
- [x] Add recommendation reason codes.
- [x] Add coverage flags / confidence notes.
- [x] Prevent unsupported action generation for current entity context.
- [x] Keep recommendations read-only in this phase.

### Phase 8 acceptance
- [x] Every recommended action is supported by the current data model.
- [x] The same input run reproduces the same recommendation output.
- [x] No recommendations are silently written into execution tables.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 9 — Optimizer UI: command center, target queue, detail drawer

### Objectives
Make the optimizer reviewable and usable.

### Tasks
- [x] Build ASIN command center view:
  - [x] product objective
  - [x] product state
  - [x] top risks
  - [x] top opportunities
  - [x] optimizer run status
  - [x] active rule pack version
- [x] Build target queue/table view:
  - [x] filters by role, state, tier, confidence
  - [x] recommendation count
  - [x] reason-code badges
  - [x] priority sorting
- [x] Build target detail drawer/page:
  - [x] raw metrics
  - [x] derived metrics
  - [x] state breakdown
  - [x] role history
  - [x] guardrails
  - [x] recommendation details
  - [x] query diagnostics
  - [x] placement diagnostics
- [x] Show explicit coverage notes and null states.

### Phase 9 acceptance
- [x] Operator can review optimizer output without reading DB rows.
- [x] Priority queue makes obvious what to look at first.
- [x] UI uses semantic tokens and shared horizontal-scroll pattern.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 10 — Handoff to existing Ads Workspace

### Objectives
Reuse the current execution system instead of inventing a second one.

### Tasks
- [x] Add action(s) to send optimizer recommendation(s) into existing Ads Workspace draft queue.
- [x] Reuse existing `ads_change_sets` and `ads_change_set_items`.
- [x] Map supported recommendations into existing atomic draft item types.
- [x] Support single-item handoff.
- [x] Support selected-row batch handoff with guardrail checks.
- [x] Keep objective / hypothesis / notes payload.
- [x] Link back from draft item to optimizer run / target snapshot / recommendation snapshot.
- [x] Add “open in existing Change Composer” shortcut where useful.

### Phase 10 acceptance
- [x] A recommendation can be staged into the existing draft queue.
- [x] Existing review / bulksheet / validation flow still works.
- [x] No optimizer code bypasses the current execution boundary.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 11 — Portfolio control + query / placement diagnostics

### Objectives
Add the higher-order controls that stop local decisions from hurting the whole ASIN.

### Tasks
- [x] Add ASIN-level portfolio caps:
  - [x] max active Discover targets
  - [x] learning budget cap
  - [x] total stop-loss cap
  - [x] max budget share per target
- [x] Add query-level diagnostics:
  - [x] same-text query pinning
  - [x] promote-to-exact candidates
  - [x] negative candidates
  - [x] isolate candidates
- [x] Add placement diagnostics:
  - [x] stronger vs weaker placement bias recommendation
  - [x] explicit campaign-level context labels
- [x] Add exception queue for:
  - [x] guardrail breaches
  - [x] major role changes
  - [x] main-driver degradation
  - [x] low-confidence high-spend targets

### Phase 11 acceptance
- [x] Portfolio caps materially affect recommendation output where expected.
- [x] Query/placement advice is visible and not flattened incorrectly into target facts.
- [x] Exception queue is usable.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---

## Phase 12 — rollback / versioned comparison / operator trust layer

### Objectives
Add a trust/review layer that helps an operator understand what changed between optimizer runs,
what changed after handoff/staging, and what rollback or reversal actions should be reviewed,
while keeping Ads Workspace as the only execution boundary.

### Tasks
- [x] Add run-to-run comparison for the same ASIN and exact window where applicable.
- [x] Surface what changed between optimizer versions / rule pack outputs:
  - [x] target state/role changes
  - [x] recommendation changes
  - [x] exception changes
  - [x] portfolio-control changes
- [x] Add rollback / reversal guidance layer:
  - [x] show what prior decision or staged action may need reversal
  - [x] show suggested rollback candidates or caution flags
  - [x] keep this advisory only
- [x] Improve operator trust surfaces:
  - [x] explicit change summaries
  - [x] version/run comparison cues
  - [x] clear “what changed and why” framing
- [x] Preserve exact-run scope and auditability.

### Phase 12 acceptance
- [x] An operator can compare runs without querying the database.
- [x] Material changes between runs are visible and understandable.
- [x] Rollback/reversal guidance is visible where appropriate.
- [x] Ads Workspace remains the only staging/execution boundary.
- [x] `/ads/performance` remains unchanged.
- [x] `/products/[asin]` remains usable and unchanged.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

---


---

## Phase 12B — Non-additive diagnostics contract + target-page review UX polish

### Objectives
Lock down the semantics for non-additive Amazon diagnostics and make the Targets page faster to review without changing the existing execution boundary.

> This patch phase assumes Phases 0–12 are already complete. Do not reopen earlier phases unless a task below explicitly requires it.

### New locked decisions for this phase
- [x] STIS, STIR, and TOS IS are **non-additive diagnostics**. Never sum, average, or synthesize a window-level value for them.
- [x] Ranking metrics follow the same rule: never average rank. Use **latest observed value + explicit trend metadata** only.
- [x] If a cross-day summary is needed, it must be labeled as a **trend descriptor** (`latest`, `previous`, `delta`, `direction`, `observed_days`, `latest_observed_date`) and never presented as the raw metric itself.
- [x] Non-additive diagnostics may inform UI context and reason codes, but they must not silently become hard optimization math in the default V1 path.
- [x] Expected absence of STIS/STIR/search-term diagnostics on zero-click targets is **normal availability behavior**, not a broken-data error.

### Tasks

#### A. Data semantics + engine contract
- [x] Update optimizer docs/AGENTS with an explicit non-additive metrics contract:
  - [x] `docs/ads-optimizer/AGENTS.md`
  - [x] `apps/web/src/app/ads/optimizer/AGENTS.md`
  - [x] `apps/web/src/lib/ads-optimizer/AGENTS.md`
- [x] Audit all optimizer code paths that touch STIS / STIR / TOS IS / ranking and confirm each usage is one of:
  - [x] raw daily value
  - [x] latest observed value
  - [x] explicit trend descriptor
  - [x] UI-only contextual note
- [x] Keep raw source-day diagnostics unchanged in storage and snapshots.
- [x] Rename persisted optimizer payload fields so they read as **point-in-time observations**, not as rollups:
  - [x] `latest_observed_tos_is`
  - [x] `latest_observed_stis`
  - [x] `latest_observed_stir`
  - [x] matching `*_observed_date`
- [x] Add optional trend payloads for non-additive diagnostics where useful:
  - [x] `previous_value`
  - [x] `delta`
  - [x] `direction`
  - [x] `observed_days`
  - [x] `latest_observed_date`
- [x] Ensure no code path creates a synthetic window-level STIS / STIR / TOS IS value.
- [x] Remove or feature-flag off any default scoring logic that mixes non-additive diagnostics with additive totals.
- [x] Replace the current organic-leverage numeric proxy with one of:
  - [x] UI/context-only signal, or
  - [x] qualitative reason code that does not alter default V1 score/action math.
- [x] Ensure ranking logic uses only:
  - [x] latest observed rank
  - [x] prior comparable observed rank or first observed rank in scope
  - [x] delta / direction
  - [x] observation count / latest observed date
- [x] Never average, median, or otherwise smooth rank into a synthetic raw value.

#### B. Coverage semantics
- [x] Introduce an internal distinction between:
  - [x] `ready`
  - [x] `partial`
  - [x] `expected_unavailable`
  - [x] `true_missing`
- [x] Map common zero-click cases so STIS / STIR / search-term coverage becomes `expected_unavailable`, not `true_missing`.
- [x] Keep the queue cell compact by displaying only three user-facing buckets:
  - [x] Ready
  - [x] Partial
  - [x] Missing
- [x] Within the compact display, color Missing differently when it is:
  - [x] expected-unavailable / normal
  - [x] true missing / suspicious
- [x] Do not count expected-unavailable cases as critical coverage warnings.
- [x] Add a compact tooltip / popover / expandable detail that lists which checks are in each bucket.
- [x] Update queue-level warning cards so they count only actionable row-specific warnings, not generic methodology notes.

#### C. Target queue UI polish
- [x] Replace the current six coverage badges in the queue table with a compact summary format such as:
  - [x] `Ready 6`
  - [x] `Partial 0`
  - [x] `Missing 0`
- [x] Keep the row height stable even when coverage notes exist.
- [x] On desktop (`xl+`), convert the target review area into a split workbench with contained scroll regions.
- [x] Keep the main page scroll for the overall route shell only.
- [x] Add an internal vertical scroll container for **Target queue** on desktop.
- [x] Make the queue controls sticky inside the queue pane:
  - [x] section header
  - [x] row-count summary
  - [x] role/state/tier/confidence/order filters
  - [x] selection + handoff toolbar
  - [x] table header row
- [x] Ensure wheel / trackpad scroll inside the queue pane does not push away the queue controls.
- [x] Add overscroll containment so queue scrolling does not fight the page scroll.

#### D. Target detail drawer UI polish
- [x] Add an internal vertical scroll container for **Target detail drawer** on desktop.
- [x] Make the drawer header sticky inside the drawer pane:
  - [x] target name / identity
  - [x] current + desired role pills
  - [x] open-in-workspace action
  - [x] handoff action
- [x] Ensure wheel / trackpad scroll inside the drawer pane does not move the queue pane or the main page until drawer bounds are reached.
- [x] Keep mobile/tablet on a simpler single-scroll layout to avoid nested-scroll traps on touch devices.

#### E. Notes, help, and readability
- [x] Split notes into three categories:
  - [x] global methodology notes
  - [x] row-specific exceptions
  - [x] critical warnings
- [x] Move repeated methodology notes out of every row/drawer and into a collapsed page-level help panel.
- [x] Add a collapsed **How to read the Targets page** explainer near the top of the view.
- [x] Use a plain-language format for explainers:
  - [x] What this is
  - [x] Why it matters
  - [x] How to read it
  - [x] What to do next
- [x] Add small expandable help blocks or info affordances for dense sections such as:
  - [x] Coverage
  - [x] Reason-code badges
  - [x] Exception signals
  - [x] Portfolio controls
  - [x] Rollback guidance
- [x] Keep only row-specific exceptions expanded by default.
- [x] Make the inline copy easy to understand for non-technical operators.

#### F. Tests + manual QA
- [x] Add regression coverage for non-additive metrics handling:
  - [x] latest-observed selection by `date` + `exported_at`
  - [x] no sum/average window rollup for STIS / STIR / TOS IS
  - [x] zero-click expected-unavailable mapping
  - [x] ranking trend without rank averaging
- [x] Add UI/component coverage for the compact coverage summary state mapping.
- [x] Add manual QA steps for desktop scroll containment:
  - [x] queue scroll isolation
  - [x] drawer scroll isolation
  - [x] sticky filters/header behavior
  - [x] mobile/tablet single-scroll fallback

### Phase 12B acceptance
- [x] STIS, STIR, and TOS IS are never summed, averaged, or presented as synthetic window-level values anywhere in the optimizer.
- [x] Default V1 scoring/actions no longer depend on a derived numeric proxy built from STIS / STIR / TOS IS.
- [x] Ranking is surfaced as latest observed value plus explicit trend only.
- [x] A zero-click target no longer looks like broken coverage just because STIS / STIR / search terms are absent.
- [x] Queue rows remain compact; coverage no longer makes rows tall.
- [x] Queue filters/header stay visible while the queue body scrolls.
- [x] Target detail drawer scrolls independently from the queue.
- [x] Repeated methodology notes no longer dominate the page.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.
- [ ] `/ads/performance` remains unchanged.
- [ ] Existing Ads Workspace handoff still works.


## Post-V1 / future phases

### Phase 13 — Extension modules
- [ ] inventory
- [ ] price changes
- [ ] reviews / rating trend
- [ ] coupon / promo
- [ ] seasonality
- [ ] competitor / share-of-voice if later available

### Phase 14 — AI explanation layer
- [ ] natural-language explanation of recommendations
- [ ] history summarization
- [ ] anomaly narration
- [ ] “ask optimizer” assistant for review speed
- [ ] AI stays explanation-only unless a later explicit phase changes this

---

## Required manual gate after every phase

- [ ] Run `npm test`
- [ ] Run `npm run web:lint`
- [ ] Run `npm run web:build`
- [ ] Confirm `/ads/performance` still works
- [ ] Confirm `/products/[asin]` still works
- [ ] Confirm sidebar still renders correctly
- [ ] Commit only after the manual gate passes
