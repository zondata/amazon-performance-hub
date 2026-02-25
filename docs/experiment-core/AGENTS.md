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
- `product_profile.profile_json`: product context (`short_name`, operator `notes`, structured `intent`).
- `log_experiments`: experiment metadata, scope, expected outcome.
- `log_experiment_changes` + `log_changes` + `log_change_entities`: linked execution trail.
- `log_evaluations`: post-window evaluation snapshots.
- Data-pack routes:
  - product baseline pack: `apps/web/src/app/products/[asin]/logbook/ai-data-pack/route.ts`
  - experiment eval pack: `apps/web/src/app/logbook/experiments/[id]/ai-eval-data-pack/route.ts`

## Pack Contracts
- `aph_product_baseline_data_pack_v2`
  - `product` includes `asin`, `title`, `short_name`, `notes`, `intent`.
- `aph_product_experiment_pack_v1`
  - planning output must include deterministic run IDs and non-empty bulkgen actions.
- `aph_experiment_evaluation_data_pack_v1`
  - `experiment` includes `expected_outcome` and nullable `product_profile` context.
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
- [ ] Phase 3: stop-loss and maintenance/experiment orchestration (future)
- [ ] Phase 4: advanced analytics and automation (future)

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
