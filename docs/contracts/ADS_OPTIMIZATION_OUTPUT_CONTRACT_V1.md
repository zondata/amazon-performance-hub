# Ads Optimization Output Contract (V1)

- Status: LOCKED (discussion agreement)
- Last Updated: 2026-03-01
- Scope: ads optimization loop (plan -> apply -> evaluate) for manual workflow today, API workflow later.

## Why this exists
- Chat history is not a reliable source of truth for system behavior decisions.
- This repo document is the canonical agreement for workflow and contract decisions.
- Future chats/tools should treat this file as the baseline before proposing changes.

## Decisions locked
1. AI never outputs Excel/bulksheet files.
   - Rationale: artifact generation must stay deterministic and system-controlled; AI output should stay in structured contract form.
2. Review happens UI-first (sheet export may exist, but UI is primary).
   - Rationale: approvals, diffs, guardrails, and audit logging must happen in one controlled review surface.
3. Manual edits are represented as a Review Patch Pack (not by sending edited spreadsheets back).
   - Rationale: patch semantics are auditable, mergeable, and version-safe; spreadsheet round-trips are opaque and brittle.

## Core principles (invariants)
- Narrative and Plan must be separate:
  - Narrative = human explanation.
  - Plan = machine contract.
- The system must generate review/final bulksheet artifacts; AI must only propose structured changes.
- Versioning must support coexistence:
  - `v1` and `v2` may coexist.
  - Consumers must detect `pack_version` and parse accordingly.
- Traceability is mandatory:
  - every pack must link lineage (baseline/evaluation/workflow chain),
  - every pack must include run metadata.

## Terminology
- Baseline Data Pack: system-generated snapshot used as the analysis starting point.
- Proposal Plan Pack (AI output): structured proposed actions from AI before human review.
- Review Patch Pack (human decisions): reviewer edits/accepts/rejects represented as patch operations.
- Final Plan Pack: system-produced final plan after applying the Review Patch Pack.
- Apply/Upload Record: log record for what was uploaded, when, and by whom/process.
- Validation Record: post-ingest check result confirming whether intended changes landed.
- Evaluation Data Pack (system generated): complete-data measurement pack for experiment evaluation.
- Evaluation Result Pack (AI output): structured evaluation interpretation and decision output.
- KIV (Keep-In-View) items: deferred or confounded items tracked for later explicit review.

## Pack envelope (shared metadata)
Every pack must include a minimal envelope:
- `kind`
- `pack_version`
- `pack_id`
- `created_at`
- `links`:
  - should include applicable lineage ids (for example `baseline_pack_id`, `experiment_id`, `previous_pack_id`).
- `trace`:
  - must include `workflow_mode` (`manual` or `api`),
  - may include model metadata,
  - may include `prompt_template_id`.
- hashes:
  - `input_hash` and `output_hash` are optional but recommended.

## Workflow overview

```mermaid
flowchart LR
  A[Baseline Data Pack] --> B[AI Narrative + Proposal Plan Pack]
  B --> C[UI Review]
  C --> D[Review Patch Pack]
  D --> E[Final Plan Pack]
  E --> F[System Bulksheet Generation]
  F --> G[Upload to Amazon (Manual Today)]
  G --> H[Validation (Next Ingest)]
  H --> I[Evaluation Data Pack]
  I --> J[AI Evaluation Result Pack]
  J --> A
```

## Step-by-step lifecycle

### 1) Generate baseline pack (manual today)
- Inputs:
  - latest ingested performance + mapping facts,
  - selected account/marketplace/date scope.
- Outputs (packs created):
  - Baseline Data Pack.
- What is logged:
  - baseline pack id, generation timestamp, source coverage window, account/marketplace.
- Allowed to change vs frozen:
  - allowed: regeneration as new baseline pack id.
  - frozen: baseline content linked to a specific proposal/evaluation lineage.

### 2) AI analysis + proposal (Narrative + Proposal Plan Pack)
- Inputs:
  - Baseline Data Pack.
- Outputs (packs created):
  - Narrative (human-readable),
  - Proposal Plan Pack (machine-readable).
- What is logged:
  - proposal pack id, producing run metadata, lineage links to baseline.
- Allowed to change vs frozen:
  - allowed: multiple proposal iterations.
  - frozen: each saved proposal pack payload and its lineage links.

### 3) UI-first review and edits (Review Patch Pack)
- Inputs:
  - Proposal Plan Pack,
  - reviewer decisions.
- Outputs (packs created):
  - Review Patch Pack.
- What is logged:
  - reviewer actions/approvals/rejections, comments, patch id, timestamps.
- Allowed to change vs frozen:
  - allowed: reviewer may edit/approve/reject actions via patch operations.
  - frozen: original proposal pack remains immutable.

### 4) Finalize plan (Final Plan Pack) + forecast + evaluation window definition
- Inputs:
  - Proposal Plan Pack,
  - Review Patch Pack,
  - experiment settings.
- Outputs (packs created):
  - Final Plan Pack with forecast block,
  - evaluation window definition using complete-data rules.
- What is logged:
  - finalization event, forecast assumptions/confidence, stop-loss and guardrails.
- Allowed to change vs frozen:
  - allowed: supersede by issuing a new final plan version before upload.
  - frozen: finalized version used for upload lineage.

### 5) Generate bulksheet artifacts (system)
- Inputs:
  - Final Plan Pack.
- Outputs (packs created):
  - system-generated bulksheet artifacts (not AI-generated),
  - artifact manifest linked to final plan.
- What is logged:
  - generator version, artifact file ids, generation timestamp.
- Allowed to change vs frozen:
  - allowed: regenerate artifact files from same final plan id.
  - frozen: final plan intent and planned actions.

### 6) Upload to Amazon (manual) and mark uploaded
- Inputs:
  - generated bulksheet artifacts.
- Outputs (packs created):
  - Apply/Upload Record.
- What is logged:
  - upload timestamp, uploader/operator, run_id, effective date (if applicable), notes.
- Allowed to change vs frozen:
  - allowed: upload metadata updates (for correction) with audit trail.
  - frozen: uploaded artifact-reference and linked final plan id.

### 7) Validate on next ingest
- Inputs:
  - next ingested reports,
  - Apply/Upload Record,
  - expected action set from Final Plan Pack.
- Outputs (packs created):
  - Validation Record.
- What is logged:
  - per-action validation status, mismatch reasons, snapshot date used.
- Allowed to change vs frozen:
  - allowed: append newer validation pass.
  - frozen: prior validation records remain historical.

### 8) Evaluate after N complete data days (Evaluation packs)
- Inputs:
  - Evaluation Data Pack generated from complete data window,
  - Final Plan Pack + Validation Record lineage.
- Outputs (packs created):
  - Evaluation Data Pack (system),
  - Evaluation Result Pack (AI).
- What is logged:
  - evaluation window boundaries, completeness checks, outcome summary, confidence.
- Allowed to change vs frozen:
  - allowed: re-evaluation with a new evaluation pack id if data completeness changed.
  - frozen: each evaluation result payload once committed.

### 9) KIV handling through loop
- Inputs:
  - KIV items carried from prior proposal/review/evaluation.
- Outputs (packs created):
  - updated KIV decisions linked in proposal/evaluation artifacts.
- What is logged:
  - KIV status decision (`keep`, `promote`, `reject`), reason, next review trigger.
- Allowed to change vs frozen:
  - allowed: KIV state transitions with explicit reason.
  - frozen: past KIV decisions and rationale remain auditable.

## Ordering and review rules
Default review ordering should be:
1. objective alignment first,
2. expected KPI movement,
3. risk/guardrail impact,
4. magnitude last.

Why not “biggest % change” first:
- Large deltas can be low-value or high-risk without objective fit.
- Objective + KPI + risk ordering improves decision quality and reduces false urgency.
- Magnitude should be a tie-breaker, not primary prioritization.

## Experiment state model
Statuses:
- Active path:
  - `DRAFT`
  - `PROPOSED`
  - `REVIEWED`
  - `FINALIZED`
  - `UPLOADED`
  - `VALIDATED`
  - `EVALUATED`
  - `COMPLETE`
- Optional terminal/exception states:
  - `ABANDONED`
  - `ROLLED_BACK`

Transition rules:
- `DRAFT -> PROPOSED`: requires Proposal Plan Pack.
- `PROPOSED -> REVIEWED`: requires Review Patch Pack (even if no-op approval patch).
- `REVIEWED -> FINALIZED`: requires Final Plan Pack with forecast + evaluation window.
- `FINALIZED -> UPLOADED`: requires Apply/Upload Record.
- `UPLOADED -> VALIDATED`: requires Validation Record for next ingest pass.
- `VALIDATED -> EVALUATED`: requires Evaluation Data Pack + Evaluation Result Pack.
- `EVALUATED -> COMPLETE`: requires explicit close decision and final outcome capture.
- Any active state -> `ABANDONED`: requires reason log.
- Any post-upload state -> `ROLLED_BACK`: requires rollback linkage and reason log.

## Forecast contract (V1)
Forecast rules:
- Forecast must be directional + range-based outcomes, not single hard numbers.
- Forecast must include assumptions and confidence.
- Evaluation window must be defined by complete-data concept (not calendar-only assumptions).
- Forecast must include stop-loss/guardrails and explicit early-stop triggers.

## KIV contract (V1)
KIV rules:
- Items go to KIV when confounded, underpowered, or not testable now.
- Each evaluation must decide each relevant KIV item: `keep`, `promote`, or `reject`.
- Every KIV item must carry:
  - reason,
  - next review trigger (date/event/condition).

## What is NOT in scope (for clarity)
- How to analyze the data pack (analysis skills/process).
- Detailed prompt text.
- Amazon API automation implementation details (future work).

## References in this repo
- Roadmap: [docs/ROADMAP.md](../ROADMAP.md)
- Implementation tasks are tracked in ROADMAP IDs (for example `APH-P0-001` to `APH-P0-004`).

Likely integration points:
- Key files (see ROADMAP for full list):
  - `apps/web/src/lib/logbook/aiPack/accountBaselinePack.ts`
  - `apps/web/src/lib/logbook/aiPack/getAccountBaselineDataPack.ts`
  - `apps/web/src/lib/logbook/aiPack/parseExperimentEvaluationOutputPack.ts`
  - `apps/web/src/lib/logbook/aiPack/importExperimentEvaluationOutputPack.ts`
  - `apps/web/src/lib/logbook/aiPack/parseProductExperimentOutputPack.ts`
  - `apps/web/src/lib/logbook/aiPack/importProductExperimentOutputPack.ts`
  - `apps/web/src/lib/logbook/aiPack/importLogbookAiPack.ts`
  - `apps/web/src/lib/logbook/validation.ts`
  - `apps/web/src/app/products/[asin]/page.tsx`
  - `apps/web/src/app/logbook/experiments/page.tsx`
  - `apps/web/src/app/logbook/experiments/[id]/page.tsx`
  - `apps/web/src/lib/products/getProductLogbookData.ts`

## Open items / Next build steps
- [x] `APH-P0-001`: extend stored metadata for baseline cutoff + forecast KPIs and carry into eval.
- [ ] `APH-P0-002`: semantic validation at AI import boundary.
- [ ] `APH-P0-003`: make logbook experiments primary workflow UI.
- [ ] `APH-P0-004`: CI.

## Implementation Status

### Phase 0 (Foundation) — DONE (2026-03-01)
- [x] Added V1 contract types/parsing helpers in `apps/web/src/lib/logbook/contracts/adsOptimizationContractV1.ts`.
- [x] Extended experiment output pack parsing/import to accept and persist `scope.contract.ads_optimization_v1`.
- [x] Added normalization default for missing `ai_run_meta.workflow_mode` -> `manual` on stored metadata.
- [x] Carried contract metadata into experiment evaluation data packs and evaluation prompt context.
- [x] Snapshot baseline_ref + forecast + ai_run_meta into evaluation `metrics_json` during evaluation import.
- [x] Added experiment detail UI panel to show baseline cutoff, forecast summary, and AI run metadata with missing badges.
- [x] Added/updated tests for contract parsing/normalization and wiring across import/eval/UI paths.

## Changelog
- 2026-03-01: V1 locked decisions (AI no XLSX; UI-first review; Review Patch Pack).
- 2026-03-01: Implemented Phase 0: persisted baseline cutoff + forecast + ai_run metadata; carried into evaluation data pack/context and evaluation snapshots.
