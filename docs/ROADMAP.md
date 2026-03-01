# Amazon Performance Hub Roadmap

Last Updated: 2026-03-01

## Implementation Order (Phased)

### Phase 0 (Now: optimize ads safely)
- `P0` Output contract extension (baseline cutoff date + forecast KPIs + AI run metadata) stored and carried into eval.
- `P0` Semantic validation at AI-pack import boundaries (IDs exist/belong; reject bad actions early).
- `P0` Make logbook experiments the primary workflow UI (product page becomes summary + links).
- `P0` Add CI (`typecheck` + tests + lint).

### Phase 1 (Soon: reduce maintenance pain)
- `P1` Extract shared CLI helpers (no big-bang rewrite).
- `P1` Consolidate / clarify AI pack formats (deprecate legacy if applicable).

### Phase 2 (Later: ingestion hardening + scaling)
- `P2` Replace/centralize CSV parsing (or switch to `csv-parse` / `papaparse`).
- `P2` Auth/RLS planning if moving beyond single-user.

## Context / Current State
- Current workflow: manual report upload + external web-based AI + JSON pack import + bulkgen XLSX generation + manual upload to Amazon.
- Future direction: Amazon Ads API ingestion + in-system AI API calls (pack generation/evaluation inside this system).

## How to use this file
- Status tags: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`.
- Priority tags: `P0`, `P1`, `P2`.
- Rule: always update both status and date when changing an item (example: `IN_PROGRESS (2026-03-01)`).
- Keep IDs stable; do not rename IDs after creation.

## Workstreams

### A) Output Contract & Evaluation Reliability

| ID | Priority | Status | Problem | Fix / Approach | Acceptance Criteria | Key Files |
|---|---|---|---|---|---|---|
| APH-P0-001 | P0 | DONE (2026-03-01) | Output contract did not carry structured forecast KPIs and baseline cutoff metadata through evaluation. | Extend experiment/evaluation pack schemas to include baseline cutoff + forecast KPI block + AI run metadata under `scope.contract.ads_optimization_v1`; persist and propagate into eval data packs and evaluation records. | Backward-compatible import (contract optional), new contract metadata persisted on experiment scope, evaluation data pack/context include contract metadata, evaluation import stores contract snapshot in `metrics_json`, tests cover parser/helpers/wiring. | `apps/web/src/lib/logbook/contracts/adsOptimizationContractV1.ts`, `apps/web/src/lib/logbook/aiPack/parseProductExperimentOutputPack.ts`, `apps/web/src/lib/logbook/aiPack/importProductExperimentOutputPack.ts`, `apps/web/src/app/logbook/experiments/[id]/ai-eval-data-pack/route.ts`, `apps/web/src/lib/logbook/aiPack/importExperimentEvaluationOutputPack.ts`, `apps/web/src/app/logbook/experiments/[id]/page.tsx`, `test/productExperimentOutputPack.test.ts`, `test/adsOptimizationContractV1.test.ts`, `test/outputContractV1Wiring.test.ts` |
| APH-P0-005 | P0 | DONE (2026-03-01) | Proposal plans were not review-patch driven, and bulksheet generation did not prefer a finalized plan snapshot. | Add UI-first review decisions, Review Patch Pack import/export (`aph_review_patch_pack_v1`), patch application to proposal, final plan snapshot storage in `scope.contract.ads_optimization_v1.final_plan`, and generation gating to prefer final plan. | Experiment detail supports accept/reject/modify review decisions with patch save/import/export; status transitions to `REVIEWED` and `FINALIZED`; bulksheet generation uses `final_plan` when present and warns on proposal fallback; final plan pack reference is carried into bulkgen metadata. | `apps/web/src/lib/logbook/contracts/reviewPatchPlan.ts`, `apps/web/src/lib/logbook/aiPack/parseReviewPatchPack.ts`, `apps/web/src/lib/logbook/aiPack/importReviewPatchPack.ts`, `apps/web/src/app/logbook/experiments/[id]/review-patch-pack/route.ts`, `apps/web/src/app/logbook/experiments/[id]/finalize-plan/route.ts`, `apps/web/src/components/logbook/ExperimentReviewPatchManager.tsx`, `apps/web/src/app/logbook/experiments/[id]/page.tsx`, `apps/web/src/app/products/[asin]/page.tsx`, `apps/web/src/lib/bulksheets/runGenerators.ts`, `src/logbook/bulkgen.ts`, `test/reviewPatchPlan.test.ts`, `test/reviewPatchPackParser.test.ts`, `test/reviewPatchWiring.test.ts` |
| APH-P1-001 | P1 | TODO (2026-03-01) | Two competing AI pack concepts increase confusion (`logbook_pack_v1` vs `product_experiment_pack_v1`). | Declare one official contract, document it, and deprecate the other path with explicit compatibility rules and sunset date. | One canonical pack spec in active use; deprecated path is clearly marked and tested for migration compatibility only. | `apps/web/src/lib/logbook/aiPack/parseLogbookAiPack.ts`, `apps/web/src/lib/logbook/aiPack/importLogbookAiPack.ts`, `apps/web/src/lib/logbook/aiPack/parseProductExperimentOutputPack.ts`, `apps/web/src/lib/logbook/aiPack/importProductExperimentOutputPack.ts`, `apps/web/src/app/products/[asin]/logbook/ai-pack/route.ts` |

### B) Validation & Safety at Boundaries

| ID | Priority | Status | Problem | Fix / Approach | Acceptance Criteria | Key Files |
|---|---|---|---|---|---|---|
| APH-P0-002 | P0 | DONE (2026-03-01) | External AI pack imports had syntactic validation but limited semantic boundary checks (entity IDs may not exist/belong). | Added shared semantic validators before writes: verify campaign/ad group/target IDs exist in account context and belong to pack ASIN scope; reject with actionable structured errors. Also added evaluation KIV-id scope checks and review-patch `change_id` boundary checks. | Invalid entity references fail import before inserts; mismatch errors include offending field + ID + recommendation under normalized `details.semantic_issues`; valid packs import unchanged. | `apps/web/src/lib/logbook/aiPack/semanticValidation.ts`, `apps/web/src/lib/logbook/aiPack/importProductExperimentOutputPack.ts`, `apps/web/src/lib/logbook/aiPack/importExperimentEvaluationOutputPack.ts`, `apps/web/src/lib/logbook/aiPack/importReviewPatchPack.ts`, `apps/web/src/app/logbook/experiments/[id]/evaluation-import/route.ts`, `apps/web/src/app/logbook/experiments/[id]/review-patch-pack/route.ts`, `test/semanticBoundaryValidation.test.ts`, `test/semanticBoundaryWiring.test.ts` |
| APH-P1-002 | P1 | IN_PROGRESS (2026-03-01) | Boundary checks are uneven across import routes (some strict checks already exist, others are permissive). | Standardize shared boundary validation helpers used by all AI-pack import routes. | All import endpoints enforce the same ASIN/account/experiment consistency checks and return normalized `{ ok: false, error, details? }` errors. | `apps/web/src/app/logbook/experiments/[id]/evaluation-import/route.ts`, `apps/web/src/lib/logbook/aiPack/importExperimentEvaluationOutputPack.ts`, `apps/web/src/lib/logbook/aiPack/evaluationImportResponse.ts`, `test/evaluationImportResponse.test.ts`, `test/logbookWebValidation.test.ts` |

### C) UX / Page Structure (reduce monolith risk)

| ID | Priority | Status | Problem | Fix / Approach | Acceptance Criteria | Key Files |
|---|---|---|---|---|---|---|
| APH-P0-003 | P0 | IN_PROGRESS (2026-03-01) | `apps/web/src/app/products/[asin]/page.tsx` is a monolith and currently absorbs workflow complexity. | Make `/logbook/experiments` + experiment detail the primary workflow; keep product detail as summary and deep links. | New workflow actions are added to logbook pages first; product page focuses on overview + navigation + read-only context. | `apps/web/src/app/products/[asin]/page.tsx`, `apps/web/src/app/logbook/experiments/page.tsx`, `apps/web/src/app/logbook/experiments/[id]/page.tsx`, `apps/web/src/lib/products/getProductLogbookData.ts` |
| APH-P1-003 | P1 | TODO (2026-03-01) | Single-file product page (2700+ lines) raises regression risk and slows edits/review. | Split server actions/data loaders/UI sections into focused modules/components with clear ownership boundaries. | Product page file size reduced materially; major sections moved to dedicated files; behavior unchanged and tests stay green. | `apps/web/src/app/products/[asin]/page.tsx`, `apps/web/src/lib/products/getProductDetailData.ts`, `apps/web/src/lib/products/getProductChangesExplorerData.ts`, `apps/web/src/components/logbook/ProductDriverIntentManager.tsx` |

### D) DevEx / CI Quality Gates

| ID | Priority | Status | Problem | Fix / Approach | Acceptance Criteria | Key Files |
|---|---|---|---|---|---|---|
| APH-P0-004 | P0 | TODO (2026-03-01) | No CI currently enforces `build`/tests/lint on pull requests. | Add CI pipeline to run root typecheck/build, root tests, and web lint on each PR. | PRs fail when build/tests/lint fail; local commands and CI commands are aligned/documented. | `package.json`, `apps/web/package.json`, `apps/web/eslint.config.mjs`, `tsconfig.json`, `test/parseSpCampaignReport.test.ts` |
| APH-P1-004 | P1 | TODO (2026-03-01) | Quality gates are not standardized for contributors. | Document “must-pass” local checks and add a single script entrypoint for pre-merge verification. | One documented command runs all required checks locally; contributors use identical checks to CI. | `package.json`, `AGENTS.md`, `apps/web/README.md` |

### E) CLI Maintainability

| ID | Priority | Status | Problem | Fix / Approach | Acceptance Criteria | Key Files |
|---|---|---|---|---|---|---|
| APH-P1-005 | P1 | TODO (2026-03-01) | CLI scripts duplicate arg parsing/usage handling, making flag additions inconsistent. | Introduce shared CLI arg helpers incrementally and migrate scripts over time (no big-bang rewrite). | New flags can be added once and reused across commands; migrated CLIs have consistent `--help`/validation behavior. | `src/cli/ingestSpCampaign.ts`, `src/cli/ingestSpPlacement.ts`, `src/cli/ingestSqpWeekly.ts`, `src/cli/ingestBulk.ts`, `src/cli/_accountGuard.ts` |
| APH-P1-006 | P1 | TODO (2026-03-01) | Date-folder wrappers and direct-ingest CLIs repeat control flow and error shape patterns. | Extract shared runner utilities for account-id checks, exported-at parsing, and uniform result printing. | Wrappers share one execution pattern; reduced duplication across ingest/map/backfill CLIs; existing command UX preserved. | `src/cli/ingestSpCampaignDate.ts`, `src/cli/ingestSbCampaignDate.ts`, `src/cli/ingestSdCampaignDate.ts`, `src/cli/mapSpAllDate.ts`, `src/cli/reingestSpPlacementAndMap.ts` |

### F) Ingestion Robustness (CSV parsing)

| ID | Priority | Status | Problem | Fix / Approach | Acceptance Criteria | Key Files |
|---|---|---|---|---|---|---|
| APH-P2-001 | P2 | TODO (2026-03-01) | Hand-rolled CSV parsing exists in multiple modules, increasing bug surface (quotes/newlines/edge cases). | Centralize CSV parsing behind one utility or adopt a battle-tested parser (`csv-parse`/`papaparse`) with compatibility fixtures. | All CSV ingest paths use one parser layer; existing parser regression tests pass; edge-case coverage expands. | `src/ads/parseSpCampaignReport.ts`, `src/sqp/parseSqpReport.ts`, `src/ads/parseSpStisReport.ts`, `apps/web/src/lib/csv/parseCsv.ts`, `test/parseSqpReport.test.ts` |
| APH-P2-002 | P2 | TODO (2026-03-01) | Parser behavior differs across report types and can silently diverge. | Build parser conformance tests shared across report modules (quoted commas, escaped quotes, CRLF, blank trailing fields). | Conformance suite runs in CI and protects all parser consumers; no silent row-shape drift across modules. | `test/parseSpCampaignReport.test.ts`, `test/parseSpStisReport.test.ts`, `test/parseSqpReport.test.ts`, `src/ads/sdReportUtils.ts` |

### G) Security / Supabase Key Usage (future multi-user readiness)

| ID | Priority | Status | Problem | Fix / Approach | Acceptance Criteria | Key Files |
|---|---|---|---|---|---|---|
| APH-P2-003 | P2 | IN_PROGRESS (2026-03-01) | Service-role Supabase key is used broadly across server code; acceptable for internal single-user but risky for multi-user expansion. | Keep strict server-only boundary now; document threat model and start auth/RLS migration plan for future multi-user mode. | No client-side service-role exposure; explicit migration plan exists for auth + RLS + least-privilege data access. | `apps/web/src/lib/env.ts`, `apps/web/src/lib/supabaseAdmin.ts`, `apps/web/src/lib/products/getProductsData.ts`, `apps/web/src/lib/logbook/getExperimentDetail.ts`, `supabase/migrations/001_init.sql` |
| APH-P2-004 | P2 | TODO (2026-03-01) | Server routes/actions mostly assume trusted single operator context. | Introduce authorization strategy doc and phased implementation checklist (session identity, scoped queries, policy enforcement). | Auth/RLS readiness checklist is actionable and linked to concrete query surfaces before any multi-user rollout. | `apps/web/src/app/products/[asin]/page.tsx`, `apps/web/src/app/logbook/experiments/[id]/page.tsx`, `apps/web/src/lib/supabaseFetchAll.ts`, `docs/schema_snapshot.md` |
