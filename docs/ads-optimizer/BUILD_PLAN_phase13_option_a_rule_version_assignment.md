# Ads Optimizer — Phase 13 Option A: versioned rule library + product assignment

This patch plan extends the existing optimizer config foundation so different products can run different saved engine versions, with separate rule versions for `hybrid`, `visibility_led`, and `design_led` strategies.

## Why this patch exists

The repo already has:
- versioned rule packs / rule pack versions
- product settings with `archetype` and `rule_pack_version_id`
- a config screen that can create draft versions, activate versions, and save product settings

But the repo still has important gaps:
- manual runs still resolve the **account active version** instead of the selected product’s assigned version
- config copy still implies runtime/config are not live
- versions are not clearly tagged/grouped by intended strategy profile
- draft payloads are not editable through a structured UI
- some high-leverage strategy behavior still lives in code and is not yet configurable enough to justify a true version library

Option A solves this by using **separate saved rule versions per strategy profile** and assigning the right one per product.

## Locked decisions

- Reuse the existing optimizer backbone, tables, and Ads Workspace execution boundary.
- Do **not** mutate activated versions in place.
- “Edit previous version” must mean: **clone to draft → edit draft → activate if desired**.
- Option A uses separate saved versions for strategy profiles such as:
  - `hybrid`
  - `visibility_led`
  - `design_led`
- A product can still choose any saved version explicitly, but the UI should make matching-by-strategy the easy path.
- Runtime version precedence for a manual run should be:
  1. selected product’s assigned `rule_pack_version_id` when product settings exist and `optimizer_enabled = true`
  2. account active version as fallback
- If product settings exist but `optimizer_enabled = false`, do **not** silently pretend product assignment is active. Use the account active version and surface that the product-specific optimizer policy is disabled.
- Prefer extending `change_payload_json` over adding new top-level DB columns unless a real blocker appears.
- Structured UI should be the default editing path. Raw JSON may remain as a collapsed advanced/debug preview, not the primary workflow.
- Keep `/ads/performance` and the current Ads Workspace staging/review/validation flow unchanged.

---

## Phase 13A — Effective runtime version resolution + audit wiring

### Objectives
Make the optimizer actually use the selected product’s assigned rule-pack version during runs, while preserving a safe account-level fallback.

### Tasks
- Add a runtime resolver that determines the effective rule-pack version for a manual run using:
  - selected ASIN → product row
  - product settings
  - assigned `rule_pack_version_id`
  - account active version fallback
- Update manual run execution so the effective version is resolved **before** the run row is created.
- Persist the effective version context into run/input payloads and product snapshot context, including:
  - `rule_pack_version_id`
  - `version_label`
  - resolution source: `product_assignment` or `account_active_fallback`
  - product archetype when available
  - whether product-specific optimizer policy is disabled
- Update config/history/targets surfaces so they show the **effective version used for the run**, not only the account active version.
- Remove stale config copy that says config/runtime are not wired yet.
- Add tests covering:
  - product-assigned version wins over account active version
  - fallback to account active version when no product settings exist
  - fallback behavior is explicit when product settings exist but optimizer is disabled

### Phase 13A acceptance
- Different ASINs can run different rule-pack versions in the same account.
- Run history and target review surfaces show which version actually drove the run.
- No change bypasses Ads Workspace as the execution boundary.
- `npm test` passes.
- `npm run web:lint` passes.
- `npm run web:build` passes.

---

## Phase 13B — Expand the version payload contract so saved versions materially affect strategy behavior

### Objectives
Make saved versions useful enough that separate strategy-specific versions are worth managing.

### Tasks
- Extend `AdsOptimizerRulePackPayload` and validation with explicit, typed strategy metadata and high-leverage tuning sections inside `change_payload_json`.
- Add at minimum:
  - `strategy_profile` (`hybrid` | `visibility_led` | `design_led`)
  - `loss_maker_policy`
  - `phased_recovery_policy`
  - `role_bias_policy`
- Keep existing sections and continue supporting:
  - `role_templates`
  - `guardrail_templates`
  - `scoring_weights`
  - `state_engine`
  - `action_policy`
- Create central config readers/helpers so state/role/recommendation code does **not** parse ad hoc payload fields in many places.
- Move the most important hardcoded strategy knobs into config readers where safe, especially the knobs that materially affect Option A outcomes:
  - protected contributor thresholds for converting-but-loss-making targets
  - shallow/moderate/severe loss band thresholds
  - phased bid-reduction step counts / max step size
  - pause aggressiveness / stop eligibility for protected contributors
  - visibility-led rank-defense bias
  - design-led long-tail suppression bias
- Keep deterministic defaults for any new config fields so old versions still work.
- Add tests proving that the same target payload can produce different role/recommendation outcomes under different saved rule payloads.

### Suggested payload shape
This is guidance, not a hard schema if a better typed shape emerges:

```json
{
  "schema_version": 2,
  "channel": "sp",
  "strategy_profile": "visibility_led",
  "state_engine": { "thresholds": { "...": 0 } },
  "guardrail_templates": { "default": { "thresholds": { "...": 0 } } },
  "scoring_weights": { "importance": 1, "confidence": 1, "profitability": 1 },
  "action_policy": { "recommendation_thresholds": { "...": 0 } },
  "loss_maker_policy": {
    "protected_ad_sales_share_min": 0.15,
    "protected_order_share_min": 0.15,
    "shallow_loss_ratio_max": 0.1,
    "moderate_loss_ratio_max": 0.25,
    "severe_loss_ratio_min": 0.25,
    "pause_protected_contributors": false
  },
  "phased_recovery_policy": {
    "default_steps": 3,
    "visibility_led_steps": 4,
    "design_led_steps": 2,
    "max_step_bid_decrease_pct": 12,
    "continue_until_break_even": true
  },
  "role_bias_policy": {
    "visibility_led_rank_defend_bias": true,
    "design_led_long_tail_suppress_bias": true
  }
}
```

### Phase 13B acceptance
- Saved versions do more than just change labels/history; they can materially alter runtime behavior.
- Old seeded versions remain readable via defaults.
- `npm test` passes.
- `npm run web:lint` passes.
- `npm run web:build` passes.

---

## Phase 13C — Structured draft editor for versioned optimizer rules

### Objectives
Let the operator create and tune draft rule versions from the Config UI without editing raw JSON by hand.

### Tasks
- Add repo helper(s) and server action(s) to update **draft** rule-pack versions.
- Enforce that only `draft` versions are editable.
- Activated or archived versions must remain immutable except for activation/archive metadata.
- Expand the Config UI so a draft version can be edited in a structured form.
- Keep the existing append-only flow:
  - choose source version
  - create new draft version
  - edit draft values
  - activate when ready
- Add structured sections for supported fields, at minimum:
  - version metadata
  - strategy profile
  - state engine thresholds
  - guardrail thresholds
  - loss-maker protection policy
  - phased recovery policy
  - role bias policy
  - recommendation thresholds
  - role enable/disable toggles
- Keep a collapsed JSON preview for audit/debug, but do not make it the default editor.
- Add validation, empty states, and clear save/activation notices.
- Update outdated UI text that still describes config as a pre-runtime placeholder.
- Add tests for:
  - creating a draft from a prior version
  - editing a draft payload
  - preventing edits to active versions
  - activating a tuned draft version

### Phase 13C acceptance
- A user can create a new draft version, tune it from the UI, and activate it.
- Old active versions remain immutable.
- The config screen reflects that the optimizer runtime is live.
- `npm test` passes.
- `npm run web:lint` passes.
- `npm run web:build` passes.

---

## Phase 13D — Product assignment UX + strategy library ergonomics

### Objectives
Make it easy to assign the right saved version to each product and manage separate rule versions by strategy profile.

### Tasks
- Improve the product settings card so the selected product shows:
  - current archetype
  - assigned rule-pack version
  - effective fallback behavior
  - strategy profile of the assigned version
  - strategic notes
- Improve version selection UX:
  - group versions by strategy profile and/or status
  - show change summary inline
  - make versions matching the selected product archetype easiest to choose
  - warn clearly when assigned version strategy profile does not match product archetype
- Add a convenience action to seed starter versions by cloning the current active version into one starter draft per strategy profile when those starters do not exist yet.
- Keep single-product assignment as the V1 scope; do not add bulk assignment unless it falls out naturally and safely.
- Update overview/history/targets surfaces so the run clearly shows:
  - product archetype
  - effective version label
  - strategy profile of the version used
- Add tests for:
  - assigning a product to a matching strategy-profile version
  - displaying mismatch warning when archetype and version profile diverge
  - seeded starter versions appearing in the config library

### Phase 13D acceptance
- The operator can maintain a small version library for `hybrid`, `visibility_led`, and `design_led` and assign the right version to each product from the UI.
- The run surfaces show the exact strategy profile + version used.
- `npm test` passes.
- `npm run web:lint` passes.
- `npm run web:build` passes.

---

## Optional later patch — preview / simulation before activation

Not required for Option A MVP, but this is the next best trust-layer improvement:
- choose one ASIN + draft version
- preview how the draft would change state/role/recommendation vs the currently assigned version
- keep it read-only
- do not stage anything automatically

That can be a later patch after 13A–13D are stable.
