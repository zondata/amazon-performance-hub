# Experiment Core — AGENTS

## Goals
- Provide a deterministic experiment workflow on top of existing facts-layer data.
- Keep the architecture unchanged: CLI ingestion -> Supabase facts -> read-only UI packs.
- Make experiment planning/evaluation reproducible with explicit IDs, date windows, and warning-first failure handling.

## Invariants
- No ingestion rewrites in this module.
- Facts remain source of truth; prompt packs never invent campaign/ad-group/target IDs.
- Routes should degrade with warnings when optional context is missing.
- No hidden timezone assumptions; date derivation rules must be explicit.
- No SQL migrations unless an explicitly scoped later phase requires it.

## Concepts
- `maintenance`: low-risk tuning to preserve known-good behavior (small deltas, guardrails first).
- `experiment`: bounded hypothesis test with explicit objective, expected outcome, and stop-loss.
- `phase`: delivery gate; each phase ships only when tests are green.
- `stop-loss`: predefined rollback trigger (performance/guardrail breach, data ambiguity, or mapping uncertainty).

## Storage Map
- `products`: canonical product identity (`product_id`, `asin`, account/marketplace scope).
- `product_profile.profile_json`: product context (`short_name`, operator `notes`, structured `intent`, default `skills` IDs).
- `log_experiments`: experiment metadata, scope, expected outcome.
- `log_experiment_changes` + `log_changes` + `log_change_entities`: linked execution trail.
- `log_evaluations`: post-window evaluation snapshots.
- Data-pack routes:
  - product baseline pack: `apps/web/src/app/products/[asin]/logbook/ai-data-pack/route.ts`
  - experiment eval pack: `apps/web/src/app/logbook/experiments/[id]/ai-eval-data-pack/route.ts`

## Pack Contracts
- `aph_product_baseline_data_pack_v2`
  - `product` includes `asin`, `title`, `short_name`, `notes`, `intent`, `skills`.
  - includes deterministic `computed_summary`.
- `aph_product_experiment_pack_v1`
  - planning output must include deterministic run IDs and non-empty bulkgen actions.
- `aph_experiment_evaluation_data_pack_v1`
  - `experiment` includes `expected_outcome` and nullable `product_profile` context.
  - `experiment` includes merged `skills` (`product_ids`, `experiment_ids`, `resolved`).
  - includes deterministic `computed_summary_eval`.
  - context load failures must append `warnings` and not hard-fail the route.

## Effective Date Rules
- Operator-facing actions use Malaysia local day (`Asia/Kuala_Lumpur`) for planning cadence and notes.
- Marketplace performance joins must respect marketplace report day boundaries (marketplace timezone/day semantics from source facts).
- If Malaysia day and marketplace day differ around UTC boundaries, preserve both:
  - use marketplace day for KPI windows and comparisons
  - keep Malaysia-local timestamp/day in notes/audit context
- Always serialize API payload dates as ISO `YYYY-MM-DD` for date-only fields.

## Build Checklist
- [x] Phase 0: spec scaffolding (`docs/experiment-core/AGENTS.md`, `docs/skills/README.md`, root AGENTS reference)
- [x] Phase 1: product intent/notes propagation into AI packs + helper + tests
- [x] Phase 2: memory + interruption-aware evaluation contracts + tests
- [x] Phase 3: stop-loss and maintenance/experiment orchestration
- [x] Phase 4: Skills v1 + computed grouped summary guardrails

## Phase 1 (Lint/Build Hygiene)
- `npm run web:build` passes.
- `npm run web:lint` passes.

## Phase 2 (Memory v1 + Timeline Signals)
- Effective date derivation now uses explicit fallback priority:
  - `scope.start_date/end_date` when both valid.
  - `log_change_validations.validated_snapshot_date` min/max when scope dates are missing.
  - linked `log_changes.occurred_at` min/max as final fallback.
- Experiment context now includes interruption visibility and phase summaries:
  - interruption types are exact-match on `manual_intervention`, `guardrail_breach`, `stop_loss`, `rollback`.
  - `major_actions` keeps newest actions but always includes interruption changes.
  - `phases` provides run-based summaries (`run_id`, `change_count`, `validation_summary`, `latest_occurred_at`) while keeping `run_groups` unchanged.
- Experiment evaluation data pack (`aph_experiment_evaluation_data_pack_v1`) now includes:
  - interruption entries,
  - phase summaries,
  - `noise_flags` (`low_orders`, `missing_test_days`, `missing_baseline_days`, `zero_sales_test`) with warning-first messaging when present.
- Product baseline data pack (`aph_product_baseline_data_pack_v2`) now includes Memory v1 per experiment:
  - latest evaluation timestamp,
  - normalized latest outcome (`score`, `label`, `summary`, `next_steps`) from `log_evaluations.metrics_json`.

Only check phase boxes after `npm test` is green for the committed scope.

## Phase 3 (Operational Controls)
- New logbook tables:
  - `log_experiment_phases`: first-class experiment phase/run records keyed by `(experiment_id, run_id)`.
  - `log_experiment_events`: append-only operational events linked to experiment and optional phase/run.
- “Uploaded to Amazon” manual action:
  - Route: `POST /logbook/experiments/[id]/phases/[runId]/mark-uploaded`
  - Computes marketplace day from experiment marketplace timezone.
  - Upserts phase `effective_date` + `uploaded_at`.
  - Inserts `uploaded_to_amazon` event for audit.
- Manual operational event logging:
  - Route: `POST /logbook/experiments/[id]/events`
  - Supports: `guardrail_breach`, `manual_intervention`, `stop_loss`, `rollback`.
  - Fills marketplace `event_date` when omitted.
- Experiment context enhancements:
  - includes full `phases` and `events`.
  - includes `interruption_events` filtered from operational events.
  - date window fallback priority: `scope` -> `phase_effective_dates` -> `validated_snapshot_dates` -> `linked_changes`.
- Evaluation data pack now includes phase/event context and interruption warnings.
- Deterministic rollback pack:
  - Helper: `buildRollbackOutputPack(...)` in `apps/web/src/lib/logbook/rollbackPlan.ts`.
  - Route: `GET /logbook/experiments/[id]/rollback-pack[?run_id=...]`.
  - Generates rollback actions from structured `before_json` + bulkgen metadata.
  - Emits warnings for non-deterministic/non-rollable changes.
- Minimal experiment-page controls:
  - Phase run list with “Mark uploaded to Amazon”.
  - Event form for guardrail/intervention/stop-loss/rollback logging.

### Phase 3 Acceptance Checklist
- [x] Multi-phase records persist in logbook tables.
- [x] “Uploaded to Amazon” sets phase `effective_date` using marketplace day.
- [x] Guardrail/intervention events are logged and visible in experiment eval pack.
- [x] Deterministic rollback pack generation works and warns on non-rollable changes.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

## Phase 4 (Skills v1 + Computed Grouped Summary)
- Skills v1 contract:
  - skill library markdown files live under `docs/skills/library/` with required frontmatter.
  - product-level defaults are stored as `product_profile.profile_json.skills: string[]`.
  - experiment overrides/extensions are stored as `log_experiments.scope.skills: string[]`.
  - data packs contain IDs plus server-resolved skill content (no DB content duplication).
- Non-bluffable grouped summary:
  - product baseline pack includes `computed_summary`, derived from facts already present in the pack.
  - experiment eval pack includes `computed_summary_eval`, derived from KPI comparison + interruption events.
  - prompt templates require AI to reference computed summary counts first and to state `unknown due to missing data` when needed.

### Phase 4 Acceptance Checklist
- [x] Baseline pack includes `product.skills` (`ids`, `resolved`) and `computed_summary`.
- [x] Evaluation pack includes `experiment.skills` (`product_ids`, `experiment_ids`, `resolved`) and `computed_summary_eval`.
- [x] Unknown experiment-scope skill IDs produce warnings without failing the route.
- [x] Partner prompt template enforces computed-summary-first analysis and unknown-data handling.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.

## Phase 5 (Skills Assignment + Driver Intent + KIV Persistence)
- Product-level skills + notes + intent are editable from `/products/[asin]`, persisted to `product_profile.profile_json`.
- Experiment-level skills override is editable from `/logbook/experiments/[id]`, persisted to `log_experiments.scope.skills`.
- Driver campaign intents persist per product/campaign and are available to planning/evaluation packs.
- KIV backlog persists per product, supports manual edits, AI carry-forward creation, and evaluation updates.
- Baseline/evaluation data packs include driver intent + KIV sections with stable additive structure.

### Phase 5 Acceptance Checklist
- [x] Product/experiment skill assignment UI and routes are operational.
- [x] Driver campaign intents are CRUD-capable and exported in both data packs.
- [x] Product KIV backlog is CRUD-capable and exported in both data packs.
- [x] Product AI output-pack import supports `kiv_items` (dedupe + warnings).
- [x] Evaluation output-pack import supports `kiv_updates` (update/match/create + warnings).
- [x] Prompt template guidance references skills, driver intents, and KIV carry-forward behavior.
- [x] `npm test` passes.
- [x] `npm run web:lint` passes.
- [x] `npm run web:build` passes.
