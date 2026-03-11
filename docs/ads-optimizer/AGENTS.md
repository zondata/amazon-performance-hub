# Ads Optimizer — AGENTS

## Goal
Build a **profit-first, role-based Ads Optimizer** inside Amazon Performance Hub without breaking the current Ads Workspace, Bulksheet Ops, product pages, or existing reporting flows.

This optimizer is a **new recommendation system**, not a replacement for the current manual-first Ads Workspace.

## Working thesis
- The optimizer should evaluate product objective, target role, confidence, importance, guardrails, and recommended actions behind the scenes.
- The operator should review the highest-priority outputs instead of manually thinking through every target.
- Existing Ads Workspace remains the execution boundary for early V1.
- Recommendation quality, auditability, and rollback matter more than speed.

## Locked scope decisions
- **SP only for V1.**
- New left-sidebar section: **Ads Optimizer**.
- Route lives at `/ads/optimizer`.
- Existing `/ads/performance` stays intact.
- Existing Bulksheet Ops and logbook validation remain intact.
- Core V1 is deterministic and rule-based.
- AI is optional later and must not be required for the core engine.

## Non-negotiable invariants

1. **Do not break current systems**
   - Do not degrade or rewrite the existing Ads Workspace behavior while building the optimizer.
   - Do not remove or repurpose the current `/ads/performance` execution flow.

2. **New optimizer state lives in new tables**
   - Use new tables prefixed with `ads_optimizer_`.
   - Do not write optimizer runtime state into current ads fact tables.
   - Do not write optimizer runtime state into `product_profile.profile_json`.

3. **Product profile stays separate**
   - `product_profile.profile_json` currently carries product context such as `short_name`, operator `notes`, structured `intent`, and default `skills`.
   - Treat that as human/product context, not optimizer runtime state.
   - If optimizer needs product-level settings, store them in dedicated optimizer tables.

4. **Version everything that changes optimizer behavior**
   - Rule packs, scoring weights, role templates, and guardrail templates must be versioned.
   - Activated versions should be treated as immutable except for activation/archive metadata.
   - Rollback must be possible by reassigning a product to an older version.

5. **Execution boundary for V1**
   - Optimizer generates recommendations.
   - Existing Ads Workspace change sets / draft queue remain the only execution path in early V1.
   - Do not add direct auto-execution unless an explicit later phase calls for it.

6. **Reason-code discipline**
   - Every target recommendation must include reason codes and the metrics used to reach that result.
   - Avoid “black box” recommendations.

7. **Manual run first**
   - V1 may use a manual optimizer run action or CLI command.
   - Do not block V1 waiting for cron / background scheduling.

8. **KPI scope integrity still applies**
   - Placement metrics remain campaign-level context.
   - Do not flatten campaign placement facts into target-level facts.
   - STIS / STIR / TOS IS remain non-additive diagnostics and must not be silently averaged.
   - Ranking follows the same rule: never average, smooth, or synthesize rank into a raw window metric.
   - If cross-day summary context is needed for STIS / STIR / TOS IS / ranking, expose it only as explicit trend metadata (`latest`, `previous`, `delta`, `direction`, `observed_days`, `latest_observed_date`).
   - Non-additive diagnostics may inform UI context and reason codes, but they must not silently change default V1 score math.
   - Zero-click targets can legitimately lack STIS / STIR / search-term diagnostics; treat that as expected availability behavior unless other evidence makes it suspicious.

9. **Use the current repo patterns**
   - Reuse semantic theme tokens.
   - Reuse shared horizontal-scroll conventions.
   - Reuse current change-set / bulksheet / validation flows where practical.
   - Follow the existing AGENTS/build-plan culture already present in this repo.

10. **Feature-flag incomplete surfaces**
   - Use `ENABLE_ADS_OPTIMIZER` or equivalent to keep unfinished work hidden.

## Required optimizer outputs

### Product level
- structural viability
- product state
- product objective
- product archetype
- rule pack version in use

### Target level
- raw metrics
- derived metrics
- efficiency state
- confidence state
- importance state / tier
- desired role
- current role
- resolved guardrails
- spend direction
- action recommendations
- reason codes
- coverage flags

## Role vocabulary
Use only the approved role names:
- Discover
- Harvest
- Scale
- Rank Push
- Rank Defend
- Suppress

Do not invent alternate role labels unless the docs are explicitly updated.

## Product objective vocabulary
Use only the approved objective names:
- Recover
- Break Even
- Harvest Profit
- Scale Profit
- Rank Growth
- Rank Defense

## V1 architecture preference
Prefer this order:
1. config + versioning
2. product engine
3. run + snapshot backbone
4. target profile engine
5. state engine
6. role + guardrail engine
7. recommendation engine
8. UI review surfaces
9. handoff into existing Ads Workspace
10. portfolio controls + extensions later

## Table naming guidance
Use new optimizer-prefixed tables such as:
- `ads_optimizer_rule_packs`
- `ads_optimizer_rule_pack_versions`
- `ads_optimizer_product_settings`
- `ads_optimizer_runs`
- `ads_optimizer_product_snapshot`
- `ads_optimizer_target_snapshot`
- `ads_optimizer_recommendation_snapshot`
- `ads_optimizer_role_transition_log`
- `ads_optimizer_manual_overrides`

## Acceptance discipline
For every phase:
- `npm test` must pass.
- `npm run web:lint` must pass.
- `npm run web:build` must pass.
- `/ads/performance` must still work.
- `/products/[asin]` must still work.
- Only mark the phase complete after all checks pass.

## When in doubt
Choose the safer option that:
- isolates new behavior,
- keeps the current execution flow working,
- keeps recommendation logic auditable,
- and reduces rollback risk.
