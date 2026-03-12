# Ads Optimizer — Outcome Review build guide

This is a supplement to:
- docs/ads-optimizer/AGENTS.md
- docs/ads-optimizer/BUILD_PLAN.md
- apps/web/src/app/ads/optimizer/AGENTS.md
- apps/web/src/lib/ads-optimizer/AGENTS.md

Do not jump ahead. Complete one phase, pass the gate, then stop.

## Goal
Create an Outcome Review surface that lets the operator:
- see validated optimizer-backed change phases on a product KPI trend chart
- click a phase and review what changed
- compare before vs after vs latest performance
- see objective-aware outcome scoring
- inspect phase-to-phase outcome segments across a longer date range

## Locked decisions
- Outcome Review lives inside `/ads/optimizer` as a new view/tab: `outcomes`.
- A full detail page exists at `/ads/optimizer/outcomes/[changeSetId]`.
- V1 is read-only. No new execution path is allowed.
- Ads Workspace remains the only staging/execution boundary.
- Do not break `/ads/performance`.
- Do not require new database tables for the first implementation unless a real blocker appears.
- The primary change bundle / phase unit is the Ads Workspace `change_set_id`, not a single raw `log_changes` row.
- Only optimizer-originated phases belong here:
  - `ads_change_sets.filters_json.source === 'ads_optimizer_phase10_handoff'`
- Link validated bulk changes back to the optimizer phase using:
  - `ads_change_sets.generated_run_id`
  - `log_changes.after_json.run_id`
  - `log_change_validations.validated_snapshot_date`
- The phase effective date is:
  - the **latest** `validated_snapshot_date` across validated linked bulk changes
  - also store and show `first_validated_date`
  - if nothing is validated yet, the phase is unvalidated/pending and must not receive a confirmed outcome score
- Outcome Review is product-scoped. Require one ASIN.
- Use deterministic scoring only. No AI dependency.
- Objective-aware scoring is required:
  - a good outcome under Break Even is not the same as a good outcome under Rank Growth
- Rolling review horizons should support:
  - 3d, 7d, 14d, 30d
- Keep the system auditable:
  - every score must be explainable from visible metrics and explicit weights/reasons

## Existing repo pieces to reuse
- Optimizer shell/tab model:
  - `apps/web/src/app/ads/optimizer/page.tsx`
  - `apps/web/src/lib/ads-optimizer/shell.ts`
- Existing optimizer overview/product math where useful:
  - `apps/web/src/lib/ads-optimizer/overview.ts`
- Existing Ads Workspace trend marker patterns:
  - `apps/web/src/components/ads/AdsWorkspaceTrendClient.tsx`
  - `apps/web/src/lib/ads/getSpWorkspaceTrendData.ts`
  - `apps/web/src/lib/ads/spWorkspaceTrendModel.ts`
- Existing product/logbook change exploration:
  - `apps/web/src/lib/products/getProductChangesExplorerData.ts`
  - `apps/web/src/lib/products/buildProductChangesExplorerViewModel.ts`
- Existing outcome pill styles:
  - `apps/web/src/lib/logbook/outcomePill.ts`

## Phase 1 — Outcome Review index tab

### Objectives
Create the new Outcome Review tab and the main read-only review page.

### Tasks
- [ ] Add `Outcome Review` to optimizer shell views.
- [ ] Update `/ads/optimizer` routing so `view === 'outcomes'` loads Outcome Review data and renders a new panel.
- [ ] Create:
  - [ ] `apps/web/src/components/ads-optimizer/OptimizerOutcomeReviewPanel.tsx`
  - [ ] `apps/web/src/lib/ads-optimizer/outcomeReview.ts`
  - [ ] `apps/web/src/lib/ads-optimizer/outcomeReviewTypes.ts`
- [ ] Add outcome review search params:
  - [ ] `horizon` (`3`, `7`, `14`, `30`)
  - [ ] `metric` (`contribution_after_ads`, `tacos`, `ad_spend`, `ad_sales`, `total_sales`, `orders`)
- [ ] Require one ASIN; show an honest empty state for `asin=all`.
- [ ] Load optimizer-originated change phases from existing Ads Workspace + logbook lineage:
  - [ ] optimizer handoff change sets
  - [ ] generated bulkgen run ids
  - [ ] linked bulk log changes
  - [ ] latest validation rows
- [ ] Build phase summaries:
  - [ ] `changeSetId`
  - [ ] `optimizerRunId`
  - [ ] `phaseLabel`
  - [ ] `validatedEffectiveDate`
  - [ ] `firstValidatedDate`
  - [ ] validation summary counts
  - [ ] staged action count
  - [ ] target count
  - [ ] status (`pending`, `partial`, `validated`, `mixed_validation`)
- [ ] Load product KPI daily trend for the selected ASIN and date range.
- [ ] Render:
  - [ ] KPI cards
  - [ ] one active-metric trend chart
  - [ ] clickable phase markers on dates
  - [ ] compact phase summary list/table below the chart
- [ ] Marker click behavior for Phase 1:
  - [ ] open an inline summary panel or drawer
  - [ ] include a link to the future detail page route
- [ ] Keep it read-only.

### Phase 1 acceptance
- [ ] `/ads/optimizer?view=outcomes` renders only for one ASIN.
- [ ] Validated optimizer change phases appear as markers on the trend chart.
- [ ] The page shows KPI cards + chart + phase list.
- [ ] Unvalidated phases are clearly marked and not shown as confirmed wins/losses.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

## Phase 2 — Outcome phase detail page + deterministic scoring

### Objectives
Create a full detail page for one optimizer change phase and compute objective-aware outcome scoring.

### Tasks
- [ ] Create route:
  - [ ] `apps/web/src/app/ads/optimizer/outcomes/[changeSetId]/page.tsx`
- [ ] Create detail component/helper(s):
  - [ ] `apps/web/src/components/ads-optimizer/OptimizerOutcomeReviewDetail.tsx`
  - [ ] optional score helper module
- [ ] Load one optimizer-originated phase by `changeSetId`.
- [ ] Show:
  - [ ] validated effective date
  - [ ] first validated date
  - [ ] originating optimizer run id
  - [ ] selected ASIN
  - [ ] validation summary
  - [ ] staged action count
  - [ ] target count
- [ ] Show “What changed” using staged Ads Workspace items:
  - [ ] target state changes
  - [ ] target bid changes
  - [ ] placement modifier changes
  - [ ] review-only notes separately
- [ ] Show objective context:
  - [ ] objective at change time
  - [ ] current/latest objective
  - [ ] whether objective changed since the phase
- [ ] Compute deterministic review windows from the selected horizon:
  - [ ] baseline window = N days before effective date
  - [ ] post-change window = effective date forward N days, capped before next phase if needed
  - [ ] latest window = latest N days ending at current selected end date
- [ ] Compute before / after / latest KPI deltas.
- [ ] Add objective-aware outcome score and label:
  - [ ] `too_early`
  - [ ] `improving`
  - [ ] `mixed`
  - [ ] `confirmed_win`
  - [ ] `confirmed_loss`
- [ ] Add score confidence:
  - [ ] low / medium / high
  - [ ] based on validation completeness, window length, and available evidence
- [ ] Add expandable details:
  - [ ] KPI movement
  - [ ] action list
  - [ ] validation details
  - [ ] score explanation
  - [ ] visible weights / reasons
- [ ] Reuse `getOutcomePillClassName` for the score pill.

### Phase 2 acceptance
- [ ] Clicking a phase from Outcome Review can navigate to the detail page.
- [ ] Detail page clearly shows what changed and when it became effective.
- [ ] Before / after / latest KPI summaries are visible.
- [ ] Outcome scoring is deterministic and explainable.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

## Phase 3 — Multi-phase segment review + polish

### Objectives
Make the main Outcome Review page useful for longer windows with multiple phases.

### Tasks
- [ ] Add segment summary rows on the index page:
  - [ ] baseline -> phase 1
  - [ ] phase 1 -> phase 2
  - [ ] phase 2 -> phase 3
  - [ ] ...
  - [ ] last phase -> selected end date
- [ ] Each segment should show:
  - [ ] window label
  - [ ] objective context
  - [ ] outcome score
  - [ ] confidence
  - [ ] primary KPI movement summary
- [ ] Add filters:
  - [ ] all
  - [ ] pending
  - [ ] improving
  - [ ] mixed
  - [ ] confirmed win
  - [ ] confirmed loss
- [ ] Add caution states when:
  - [ ] objective changed mid-segment
  - [ ] another phase lands too soon after the previous one
  - [ ] validation is incomplete
  - [ ] KPI coverage is incomplete
- [ ] Keep chart markers and summary list in sync.
- [ ] Add plain-language help copy:
  - [ ] What this page is
  - [ ] How to read phase markers
  - [ ] What the score means
  - [ ] Why some phases are “too early”

### Phase 3 acceptance
- [ ] A 60-day view with multiple phases shows usable segment scoring.
- [ ] Marker clicks and segment summaries stay consistent.
- [ ] The operator can quickly tell which change phases helped, hurt, or are too early.
- [ ] `npm test` passes.
- [ ] `npm run web:lint` passes.
- [ ] `npm run web:build` passes.

## Scoring rules for Outcome Review V1
- Deterministic only.
- Use the selected horizon as the comparison window.
- Prefer validated effective date over occurred_at.
- If validated coverage is incomplete, lower confidence and avoid “confirmed” language.
- Objective-aware weighting:
  - Recover / Break Even:
    - favor contribution after ads, TACoS improvement, waste reduction
  - Harvest Profit / Scale Profit:
    - favor contribution after ads, orders/sales growth, efficiency stability
  - Rank Growth / Rank Defense:
    - include rank/visibility only when available
    - otherwise degrade confidence instead of inventing data
- Keep the exact score formula visible in code and in the score explanation UI.
- No AI-generated score text.

## Manual gate after every phase
- [ ] Run `npm test`
- [ ] Run `npm run web:lint`
- [ ] Run `npm run web:build`
- [ ] Confirm `/ads/performance` still works
- [ ] Confirm existing `/ads/optimizer` views still work
- [ ] Confirm Ads Workspace handoff still works
- [ ] Commit only after the manual gate passes