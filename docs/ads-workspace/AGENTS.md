# Ads Workspace — AGENTS

## Goal
Build a human-in-the-loop Ads Workspace for Amazon Performance Hub.
Use AI for diagnosis and prioritization, but keep execution manual, staged, reviewable, and fully auditable through Bulksheet Ops + validation.

## Working thesis
- AI should explain what is wrong and where the biggest opportunities are.
- The operator should choose what to change.
- Draft changes are not facts.
- Generated bulksheets are the execution boundary.
- Validation against later bulksheet ingest is the source of truth for what actually landed.

## Locked scope decisions
- **SP first**. SB comes later. SD is KIV.
- Rename the combined keyword/target tab to **Targets**.
- Support two view modes: **Table** and **Trend**.
- Add a **Change Composer** that can open from any supported row.
- Save objective/hypothesis/forecast/review notes in drafts before generation.
- Objective entry must support **save and reuse** via presets/templates.

## Invariants
1. **Human-in-the-loop first**
   - Do not rebuild this into an AI-autopilot system.
   - AI widgets may assist later, but the workspace itself is manual-first.

2. **Drafts are not facts**
   - Do **not** write draft workspace edits directly to `log_changes`.
   - Drafts belong in dedicated staging tables.
   - `log_changes` / `log_change_entities` are created only when a bulksheet is generated/frozen for execution.

3. **Atomic draft items**
   - One `ads_change_set_items` row represents one atomic action type.
   - If the composer edits multiple fields at once, split that save into multiple draft items.

4. **KPI scope integrity**
   - Placement metrics are campaign-level facts.
   - Do **not** flatten placement metrics into target-level facts.
   - In the Targets tab, placement metrics may appear only as clearly labeled campaign-level context.
   - STIS / STIR / TOS IS are non-additive diagnostics. Do not average them across time or entities.
   - Follow `docs/skills/library/ads_kpi_scope_glossary.md`.

5. **Targets row behavior**
   - Parent row = full target totals.
   - Expanded child rows = search terms under that target.
   - Do not replace target totals with one search-term slice.
   - If same-text search term exists, it may be pinned first inside the expanded section, but it does not replace the parent totals.

6. **Trend mode rules**
   - Trend mode is diagnostic-first, not the default editing surface.
   - Table mode remains the default for filtering, comparison, and editing.
   - Daily change markers must use chips / markers / borders, not full-row highlight by default.

7. **Product filter semantics (SP v1)**
   - Product filter is an **entity inclusion filter** based on advertised ASIN scope.
   - Use deterministic product-ad / advertised-product mappings to decide which SP campaigns, ad groups, targets, and search-term groups belong to the selected ASIN.
   - Unless a dataset is truly ASIN-sliced at the entity level, row metrics remain entity totals.
   - Do not pretend campaign/target metrics are ASIN-only when the facts layer cannot prove that.
   - When coverage is ambiguous (for example multi-ASIN campaign scope), surface a warning / coverage badge rather than false precision.

8. **Economics integrity**
   - P&L and break-even bid are valuable, but they must not be shown as exact facts when the economics scope is ambiguous.
   - In SP v1, treat entity-level P&L / break-even bid as nullable derived metrics.
   - Show them only when the row has deterministic product economics coverage; otherwise return `null` / `—` with a coverage note.

9. **Phase discipline**
   - Follow `docs/ads-workspace/BUILD_PLAN.md` in order.
   - Mark checklist items done only after code, tests, lint, and build pass for that phase.
   - Do not jump ahead to a later phase while earlier acceptance checks are still open.

## Storage map
- Existing facts layer remains source-of-truth for performance data.
- New staging layer for workspace drafts:
  - `ads_change_sets`
  - `ads_change_set_items`
  - `ads_objective_presets`
- Existing logging / validation layer remains execution truth:
  - `log_changes`
  - `log_change_entities`
  - `log_experiment_changes`
  - `log_change_validations`

## Ads Workspace build order
1. Foundations: migrations, types, data-access helpers, objective presets.
2. SP Targets table mode.
3. Change Composer + draft queue save.
4. Queue review + bulksheet generation + freeze to logbook.
5. Campaign / Placement / Ad group tabs.
6. Search terms tab.
7. Trend mode + daily change markers.
8. SB extension.

## UI constraints
- Use semantic theme tokens only; avoid hard-coded slate/white styling in new components.
- Wide tables must use the global horizontal scroll convention from the root `AGENTS.md`.
- Preserve URL-driven filters where practical (`start`, `end`, `asin`, `channel`, `level`, `view`, queue context).
- Keep empty / partial coverage states explicit.

## Acceptance discipline
For each implementation phase:
- `npm test` must pass.
- `npm run web:lint` must pass.
- `npm run web:build` must pass.
- Update the checklist in `docs/ads-workspace/BUILD_PLAN.md`.
