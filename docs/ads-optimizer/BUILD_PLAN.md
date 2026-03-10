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
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

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
- [ ] Build product-level metrics loader using existing facts tables/views.
- [ ] Compute product-level raw metrics:
  - [ ] sales
  - [ ] orders
  - [ ] units
  - [ ] ad spend
  - [ ] ad sales
  - [ ] TACOS
  - [ ] average price
  - [ ] cost coverage
  - [ ] break-even ACoS
  - [ ] contribution before ads per unit
  - [ ] contribution after ads
- [ ] Compute product-level visibility inputs:
  - [ ] organic rank coverage where available
  - [ ] hero-query rank trend where available
  - [ ] SQP demand coverage where available
- [ ] Implement product state classification:
  - [ ] structurally weak
  - [ ] loss
  - [ ] break even
  - [ ] profitable
- [ ] Implement product objective recommendation:
  - [ ] recover
  - [ ] break even
  - [ ] harvest profit
  - [ ] scale profit
  - [ ] rank growth
  - [ ] rank defense
- [ ] Add product command-center overview UI for the selected ASIN.
- [ ] Add safe coverage notes when required inputs are missing.

### Phase 3 acceptance
- [ ] A selected ASIN shows product state + recommended objective.
- [ ] Missing economics or rank inputs are clearly surfaced, not silently guessed.
- [ ] No current product overview editor behavior is broken.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

## Phase 4 — Optimizer run + snapshot backbone

### Objectives
Create auditable optimizer runs and persist product/target snapshots.

### Tasks
- [ ] Add migration(s) for runtime tables.
- [ ] Create `ads_optimizer_runs`.
- [ ] Create `ads_optimizer_product_snapshot`.
- [ ] Create `ads_optimizer_target_snapshot`.
- [ ] Create `ads_optimizer_role_transition_log`.
- [ ] Create `ads_optimizer_recommendation_snapshot`.
- [ ] Create run status fields:
  - [ ] `pending`
  - [ ] `running`
  - [ ] `completed`
  - [ ] `failed`
- [ ] Add a manual “Run optimizer now” action or CLI path for V1.
- [ ] Snapshot the exact inputs used for each run.
- [ ] Snapshot the exact outputs used for each target decision.
- [ ] Prevent silent overwrite of prior runs.

### Phase 4 acceptance
- [ ] A manual run can be created for one ASIN and date range.
- [ ] A completed run stores product + target snapshots.
- [ ] A failed run stores diagnostics instead of partial silent success.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

## Phase 5 — Target profile engine

### Objectives
Build the raw + derived target profile object.

### Tasks
- [ ] Build target-level raw metrics loader from existing SP facts.
- [ ] Pull target-level raw inputs:
  - [ ] impressions
  - [ ] clicks
  - [ ] spend
  - [ ] orders
  - [ ] sales
  - [ ] CPC
  - [ ] CTR
  - [ ] CVR
  - [ ] ACoS
  - [ ] ROAS
  - [ ] TOS IS
  - [ ] STIS
  - [ ] STIR
  - [ ] campaign / ad group / target identity chain
  - [ ] demand proxies
  - [ ] placement context
  - [ ] search term diagnostics
- [ ] Compute target derived metrics:
  - [ ] contribution after ads
  - [ ] break-even gap
  - [ ] max CPC support gap
  - [ ] loss dollars / profit dollars
  - [ ] click velocity
  - [ ] impression velocity
  - [ ] organic leverage proxy
- [ ] Store full target profile snapshot per run.

### Phase 5 acceptance
- [ ] Target profile rows render for a selected ASIN.
- [ ] Every row has both raw and derived fields.
- [ ] Coverage gaps are explicit.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

## Phase 6 — State engine: efficiency, confidence, importance, tier

### Objectives
Classify targets before role assignment.

### Tasks
- [ ] Implement efficiency states:
  - [ ] no data
  - [ ] learning / no sale
  - [ ] converting but loss-making
  - [ ] break-even
  - [ ] profitable
- [ ] Implement confidence states:
  - [ ] insufficient
  - [ ] directional
  - [ ] confirmed
- [ ] Implement importance states / tiers:
  - [ ] Tier 1 dominant
  - [ ] Tier 2 core
  - [ ] Tier 3 test / long-tail
- [ ] Compute opportunity score.
- [ ] Compute risk score.
- [ ] Store reason codes for each state decision.

### Phase 6 acceptance
- [ ] Known targets classify into sensible states.
- [ ] Reason codes are visible and auditable.
- [ ] Tiering is partly mathematical and partly configurable.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

## Phase 7 — Role engine + dynamic guardrails

### Objectives
Resolve desired/current role and the allowed action envelope.

### Tasks
- [ ] Implement desired roles:
  - [ ] Discover
  - [ ] Harvest
  - [ ] Scale
  - [ ] Rank Push
  - [ ] Rank Defend
  - [ ] Suppress
- [ ] Implement current-role resolution from:
  - [ ] previous role
  - [ ] desired role
  - [ ] current data
  - [ ] transition rules
- [ ] Implement dynamic guardrail categories:
  - [ ] no-sale spend cap
  - [ ] no-sale click cap
  - [ ] max loss per cycle
  - [ ] max bid increase per cycle
  - [ ] max bid decrease per cycle
  - [ ] max placement bias increase per cycle
  - [ ] rank-push time limit
  - [ ] manual approval threshold
  - [ ] auto-pause threshold
  - [ ] min bid floor / max bid ceiling
- [ ] Resolve guardrails from:
  - [ ] rule pack version
  - [ ] product objective
  - [ ] role
  - [ ] archetype
  - [ ] confidence
  - [ ] importance
  - [ ] product overrides
- [ ] Log role transitions with reason codes.

### Phase 7 acceptance
- [ ] Targets receive desired role + current role + resolved guardrails.
- [ ] Role changes change operating mode, not only labels.
- [ ] Transition reasons are saved.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

## Phase 8 — Recommendation engine

### Objectives
Turn profile + role + guardrails into a concrete recommendation set.

### Tasks
- [ ] Implement spend direction engine:
  - [ ] increase
  - [ ] hold
  - [ ] reduce
  - [ ] collapse
  - [ ] stop
- [ ] Implement action recommendation types:
  - [ ] update target bid
  - [ ] update target state
  - [ ] update placement modifier
  - [ ] isolate query candidate
  - [ ] negative candidate
  - [ ] change review cadence
- [ ] Add recommendation reason codes.
- [ ] Add coverage flags / confidence notes.
- [ ] Prevent unsupported action generation for current entity context.
- [ ] Keep recommendations read-only in this phase.

### Phase 8 acceptance
- [ ] Every recommended action is supported by the current data model.
- [ ] The same input run reproduces the same recommendation output.
- [ ] No recommendations are silently written into execution tables.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

## Phase 9 — Optimizer UI: command center, target queue, detail drawer

### Objectives
Make the optimizer reviewable and usable.

### Tasks
- [ ] Build ASIN command center view:
  - [ ] product objective
  - [ ] product state
  - [ ] top risks
  - [ ] top opportunities
  - [ ] optimizer run status
  - [ ] active rule pack version
- [ ] Build target queue/table view:
  - [ ] filters by role, state, tier, confidence
  - [ ] recommendation count
  - [ ] reason-code badges
  - [ ] priority sorting
- [ ] Build target detail drawer/page:
  - [ ] raw metrics
  - [ ] derived metrics
  - [ ] state breakdown
  - [ ] role history
  - [ ] guardrails
  - [ ] recommendation details
  - [ ] query diagnostics
  - [ ] placement diagnostics
- [ ] Show explicit coverage notes and null states.

### Phase 9 acceptance
- [ ] Operator can review optimizer output without reading DB rows.
- [ ] Priority queue makes obvious what to look at first.
- [ ] UI uses semantic tokens and shared horizontal-scroll pattern.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

## Phase 10 — Handoff to existing Ads Workspace

### Objectives
Reuse the current execution system instead of inventing a second one.

### Tasks
- [ ] Add action(s) to send optimizer recommendation(s) into existing Ads Workspace draft queue.
- [ ] Reuse existing `ads_change_sets` and `ads_change_set_items`.
- [ ] Map supported recommendations into existing atomic draft item types.
- [ ] Support single-item handoff.
- [ ] Support selected-row batch handoff with guardrail checks.
- [ ] Keep objective / hypothesis / notes payload.
- [ ] Link back from draft item to optimizer run / target snapshot / recommendation snapshot.
- [ ] Add “open in existing Change Composer” shortcut where useful.

### Phase 10 acceptance
- [ ] A recommendation can be staged into the existing draft queue.
- [ ] Existing review / bulksheet / validation flow still works.
- [ ] No optimizer code bypasses the current execution boundary.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

## Phase 11 — Portfolio control + query / placement diagnostics

### Objectives
Add the higher-order controls that stop local decisions from hurting the whole ASIN.

### Tasks
- [ ] Add ASIN-level portfolio caps:
  - [ ] max active Discover targets
  - [ ] learning budget cap
  - [ ] total stop-loss cap
  - [ ] max budget share per target
- [ ] Add query-level diagnostics:
  - [ ] same-text query pinning
  - [ ] promote-to-exact candidates
  - [ ] negative candidates
  - [ ] isolate candidates
- [ ] Add placement diagnostics:
  - [ ] stronger vs weaker placement bias recommendation
  - [ ] explicit campaign-level context labels
- [ ] Add exception queue for:
  - [ ] guardrail breaches
  - [ ] major role changes
  - [ ] main-driver degradation
  - [ ] low-confidence high-spend targets

### Phase 11 acceptance
- [ ] Portfolio caps materially affect recommendation output where expected.
- [ ] Query/placement advice is visible and not flattened incorrectly into target facts.
- [ ] Exception queue is usable.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

## Phase 12 — Outcome tracking, tuning, rollback, and release discipline

### Objectives
Make the optimizer safe to tune after live use begins.

### Tasks
- [ ] Add rule pack version comparison UI.
- [ ] Add product assignment history.
- [ ] Add pre/post outcome comparison for recommendation batches.
- [ ] Add rollback action to switch a product back to a prior rule pack version.
- [ ] Add release notes field for each new version.
- [ ] Add “why this version exists” summary field.
- [ ] Add archive/deactivate rules for stale versions.
- [ ] Add run-to-run diff view for the same ASIN.

### Phase 12 acceptance
- [ ] A newer rule pack version can be rolled back cleanly.
- [ ] Historical optimizer decisions remain reproducible.
- [ ] Version metadata is good enough to understand what changed and why.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

---

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
