# Ads Optimizer V2 — Build Plan

## Purpose

This build plan is for the **V2 migration**, not a greenfield optimizer build.

The repo already contains a substantial V1 optimizer foundation:
- route shell at `apps/web/src/app/ads/optimizer/page.tsx`
- view contract in `apps/web/src/lib/ads-optimizer/shell.ts`
- overview loader in `apps/web/src/lib/ads-optimizer/overview.ts`
- runtime/run persistence in `apps/web/src/lib/ads-optimizer/runtime.ts` and `repoRuntime.ts`
- target/recommendation/state/role engines in `apps/web/src/lib/ads-optimizer/`
- current UI panels in `apps/web/src/components/ads-optimizer/`

The V2 goal is to **simplify the operator-facing surface** while **keeping V1’s backend discipline**:
persisted runs, guardrails, overrides, reason codes, comparison context, history, config, outcome review, and Ads Workspace handoff.

## Canonical save path

Save this file as:

`docs/ads-optimizer/BUILD_PLAN.md`

That is the best path because the repo already uses that path as the canonical optimizer build-plan reference from:
- `docs/ads-optimizer/AGENTS.md`
- `apps/web/src/app/ads/optimizer/AGENTS.md`
- `apps/web/src/lib/ads-optimizer/AGENTS.md`

### Recommended archive step before replacing the current file

If you want to keep the old V1 plan visible in-tree, first rename the current file to:

`docs/ads-optimizer/BUILD_PLAN_V1_ARCHIVE.md`

Git history would also preserve it, but an archive file makes the transition explicit.

## Locked decisions

- [x] **Primary operator UI stays at two tabs only:** `Overview` and `Targets`.
- [x] **History, Config, and Outcome Review stay in the product**, but as **secondary utilities**, not first-level tabs.
- [x] **Do not rewrite the engines first.** Reuse the current backend logic and persisted run tables.
- [x] **Ads Workspace remains the only staging/execution boundary** in this migration.
- [x] **Product objective remains dynamic per ASIN.** Do not replace it with one universal fixed objective.
- [x] **Manual overrides remain first-class.**
- [x] **STIS / STIR / TOS IS / ranking remain non-additive diagnostics.**
- [x] **Old deep links should remain usable** even after the primary navigation is simplified.
- [x] **Feature flag discipline remains in force.**
- [x] **Do not break `/ads/performance` or `/products/[asin]`.**

## Build strategy

Use a **surface-first migration**:

1. Align docs and instructions.
2. Simplify the shell and navigation.
3. Upgrade Overview into a real operator control panel.
4. Refactor Targets into compact inline expandable rows.
5. Demote advanced/secondary surfaces without deleting them.
6. Clean up old V1 surface assumptions after the new flow is stable.

## Important implementation rules

- Prefer **parallel V2 components + thin wrappers** over giant in-place rewrites.
- Keep these imports stable where practical:
  - `OptimizerOverviewPanel.tsx`
  - `OptimizerTargetsPanel.tsx`
  - `page.tsx`
- If you build new V2 subcomponents, let the existing panel files become wrappers during migration.
- Do not delete V1-only helpers until the replacement behavior is proven and tests are green.
- Keep missing-data behavior explicit.
- Keep current-versus-proposed values visible anywhere a recommendation changes something.
- Keep target-level advanced diagnostics available, but hide them by default.

## Phase summary

| Phase | Goal | Main files |
|---|---|---|
| 0 | Align docs, AGENTS, and route contract | `docs/ads-optimizer/*`, optimizer `AGENTS.md` files |
| 1 | Simplify shell to two primary tabs | `shell.ts`, `page.tsx` |
| 2 | Add compact run/scope header flow | `page.tsx`, new header component(s), actions wiring |
| 3 | Upgrade Overview data contract | `overview.ts`, supporting helpers/tests |
| 4 | Rebuild Overview UI | `OptimizerOverviewPanel.tsx` + new subcomponents |
| 5 | Create V2 target row model and split the large panel | `runtime.ts`, `OptimizerTargetsPanel.tsx`, new targets subcomponents |
| 6 | Replace queue+drawer with inline expansion | target UI components, handoff/override wiring |
| 7 | Move secondary tools behind Utilities/Advanced | page shell + existing utility panels |
| 8 | Cleanup, regressions, docs sync | tests, stale copy, docs |

---

## Phase 0 — Docs, AGENTS, and contract alignment

### Objective

Make the repo instructions match the V2 direction **before** implementation starts.

### Why this phase matters

The repo already contains optimizer-specific instructions that still describe the V1 review model.
Right now the optimizer docs still push a queue + drawer workbench pattern, while your V2 direction is:
- two primary pages
- inline target expansion
- utilities demoted from top-level navigation

If these instructions are not updated first, Codex is likely to rebuild the old shape.

### Tasks

- [ ] Replace `docs/ads-optimizer/BUILD_PLAN.md` with this V2 migration plan.
- [ ] Optionally archive the current plan as `docs/ads-optimizer/BUILD_PLAN_V1_ARCHIVE.md`.
- [ ] Update `docs/ads-optimizer/AGENTS.md` to reflect:
  - [ ] V2 is the operator-first surface on top of the existing V1 backend.
  - [ ] `Overview` and `Targets` are the only primary tabs.
  - [ ] `History`, `Config`, and `Outcome Review` remain secondary utilities.
  - [ ] inline expandable rows replace the old queue + drawer as the default target review interaction.
  - [ ] product objective stays dynamic by ASIN.
  - [ ] Ads Workspace stays the execution boundary.
- [ ] Update `apps/web/src/app/ads/optimizer/AGENTS.md` to replace queue/drawer-first guidance with:
  - [ ] inline row expansion
  - [ ] compact header controls
  - [ ] utility access outside primary tabs
  - [ ] global Overview trend mode rather than card-by-card state
- [ ] Update `apps/web/src/lib/ads-optimizer/AGENTS.md` to instruct helpers/view models to support:
  - [ ] compact summary payloads for collapsed rows
  - [ ] separate detail payloads for expanded rows
  - [ ] explicit lazy-detail boundaries
  - [ ] stable row identity
- [ ] Add a brief V2 pointer in root `AGENTS.md`.
- [ ] Review `docs/ads-optimizer/OUTCOME_REVIEW_PLAN.md` and remove/adjust any wording that still assumes Outcome Review is a first-level tab.

### Automated checks

- [ ] `npm test`
- [ ] `npm run web:lint`
- [ ] `npm run web:build`

### Manual checks

- [ ] No optimizer instruction file still tells Codex to default to a queue + drawer review pattern.
- [ ] The docs consistently say primary UI = `Overview` + `Targets`.
- [ ] The docs consistently say History/Config/Outcome Review are still kept, not deleted.
- [ ] There is no contradiction around execution: optimizer proposes, Ads Workspace stages/executes.

### Exit criteria

- [ ] Instructions are internally consistent.
- [ ] Future phases can be executed without design ambiguity.

---

## Phase 1 — Simplify the shell to two primary tabs

### Objective

Make `Overview` and `Targets` the only first-level tabs while preserving backward compatibility for older optimizer links.

### Main repo areas

- `apps/web/src/lib/ads-optimizer/shell.ts`
- `apps/web/src/app/ads/optimizer/page.tsx`
- related shell/navigation tests

### Tasks

- [ ] Change the primary tab contract in `shell.ts` so the visible first-level tabs are only:
  - [ ] `overview`
  - [ ] `targets`
- [ ] Introduce a **secondary utility state** for:
  - [ ] `history`
  - [ ] `config`
  - [ ] `outcomes`
- [ ] Keep old URL compatibility:
  - [ ] old `view=history`
  - [ ] old `view=config`
  - [ ] old `view=outcomes`
- [ ] Map old deep links to the new shell contract without 404 or dead screens.
- [ ] Keep `buildAdsOptimizerHref(...)` backward-compatible enough that old links can still be generated or normalized cleanly.
- [ ] Update the tab rendering in `page.tsx` so only two primary tabs are visible.
- [ ] Add a compact Utilities entry point in the page header or adjacent controls.
- [ ] Keep existing utility panels reachable, even if the surface is transitional in this phase.

### Suggested implementation approach

- Prefer adding `utility` query state over creating a third tab row.
- Normalize old `view=config|history|outcomes` into the new contract in one place.
- Avoid deleting existing utility panel code in this phase.

### Tests to add or update

- [ ] `test/adsOptimizerOutcomeReviewUiWiring.test.ts`
- [ ] `test/adsOptimizerRuntimeUiWiring.test.ts`
- [ ] any shell normalization tests touching `ADS_OPTIMIZER_VIEWS`
- [ ] page-level UI wiring tests that currently assume five top-level tabs

### Automated checks

- [ ] `npm test`
- [ ] `npm run web:lint`
- [ ] `npm run web:build`

### Manual checks

- [ ] Only `Overview` and `Targets` show as primary tabs.
- [ ] Opening an old `?view=history`, `?view=config`, or `?view=outcomes` URL still lands somewhere valid and understandable.
- [ ] The user can still reach History, Config, and Outcome Review without hunting.
- [ ] `/ads/performance` is unchanged.

### Exit criteria

- [ ] The optimizer shell feels simpler immediately.
- [ ] Existing utility surfaces are still reachable.

---

## Phase 2 — Add the compact run and scope header flow

### Objective

Move day-to-day run control into the main optimizer header so the operator no longer has to think in “go to History first” terms.

### Important design decision

Do **not** force the Overview page to become fully run-bound in the first pass.

A simpler contract is:
- Overview is still primarily **ASIN + date-range** driven.
- Targets is the **run-review** surface.
- The shared header shows:
  - selected ASIN
  - date range
  - `Run now`
  - latest completed run reference
  - quick-open into Targets for the relevant run

That is simpler than making every page operate on a selected run immediately.

### Main repo areas

- `apps/web/src/app/ads/optimizer/page.tsx`
- `apps/web/src/app/ads/optimizer/actions.ts`
- `apps/web/src/lib/ads-optimizer/runtime.ts`
- optional new header component(s) under `apps/web/src/components/ads-optimizer/`

### Tasks

- [ ] Create a shared optimizer header/run bar component.
- [ ] Surface:
  - [ ] ASIN scope
  - [ ] date range
  - [ ] `Run now`
  - [ ] latest completed run reference
  - [ ] open-latest-run-in-Targets action
- [ ] On Targets, keep run selection/review explicit.
- [ ] On Overview, show run context as supporting information, not as the primary data source.
- [ ] Reuse existing `runAdsOptimizerNowAction`.
- [ ] Keep URL state stable when moving between Overview and Targets.
- [ ] Preserve current `runId` behavior on Targets.

### Tests to add or update

- [ ] `test/adsOptimizerTargetsRunContext.test.ts`
- [ ] `test/adsOptimizerRuntimeUiWiring.test.ts`
- [ ] page wiring tests around `runAdsOptimizerNowAction`

### Automated checks

- [ ] `npm test`
- [ ] `npm run web:lint`
- [ ] `npm run web:build`

### Manual checks

- [ ] The operator can run the optimizer from the main header.
- [ ] The latest run is easy to identify.
- [ ] Opening Targets from the header lands on the intended run.
- [ ] Switching between Overview and Targets does not accidentally drop ASIN/date scope.
- [ ] The UI still feels simpler than the old History-first workflow.

### Exit criteria

- [ ] Normal daily flow no longer requires opening History first.
- [ ] Targets still resolves run context correctly.

---

## Phase 3 — Upgrade the Overview data contract

### Objective

Extend the current Overview data model so the page can support V2’s operator-facing sections:
economics, ranking, traffic, conversion, previous-period comparison, and trend mode.

### Main repo areas

- `apps/web/src/lib/ads-optimizer/overview.ts`
- supporting loaders reused from:
  - `@/lib/sales/getSalesDaily`
  - ranking helpers
  - SQP helpers
  - existing SP workspace data/aggregation helpers where useful

### Tasks

- [ ] Add **previous-period comparison** using an equal-length prior window.
- [ ] Add delta support for core metrics:
  - [ ] absolute delta
  - [ ] percent delta where safe
  - [ ] metric-aware good/bad semantics
- [ ] Add a **ranking ladder** for organic bands:
  - [ ] page 1 numeric splits: `1-2`, `3-5`, `6-10`, `11-20`, `21-45`
  - [ ] page-based buckets after page 1: `Page 2`, `Page 3`, `Page 4`, `Page 5`, `Page 6`, `Page 7`
  - [ ] optional `Beyond tracked range` only when the source distinguishes it honestly
  - [ ] do not fake `Not ranked` when the source only tells us the tracked range ceiling
  - [ ] show bucket label, current count, and signed count delta vs previous period only
- [ ] Add a compact **traffic** block:
  - [ ] sessions
  - [ ] total SP impressions
  - [ ] one SQP demand indicator
- [ ] Add a compact **conversion** block:
  - [ ] unit session percentage
  - [ ] one secondary conversion-support metric only if it truly adds clarity
- [ ] Add page-level **trend mode** support for:
  - [ ] `7`
  - [ ] `14`
  - [ ] `30`
  - [ ] `60`
- [ ] Keep objective logic dynamic by product state/archetype. Do not hard-lock one universal objective.
- [ ] Keep missing-data notes explicit, especially for SQP week alignment and ranking coverage.
- [ ] Preserve the non-additive treatment of STIS/STIR/TOS IS/ranking.

### Recommended implementation notes

- Prefer extending the Overview loader with a page-specific view model rather than pushing UI formatting into the component.
- Reuse existing sales/ranking/SQP sources before adding any new query path.
- Prefer one page-level trend control instead of per-card trend toggles.
- Treat one Amazon search-results page as `45` organic positions when building page-based ladder buckets.

### Tests to add or update

- [ ] `test/adsOptimizerOverview.test.ts`
- [ ] new tests for previous-period window calculation
- [ ] new tests for ranking ladder classification
- [ ] new tests for traffic/conversion coverage notes
- [ ] tests that ensure rank remains latest/trend-based rather than silently averaged

### Automated checks

- [ ] `npm test`
- [ ] `npm run web:lint`
- [ ] `npm run web:build`

### Manual checks

- [ ] Current vs previous period uses equal-length windows.
- [ ] Deltas are sensible and do not flip meaning for inverse metrics.
- [ ] Rank is shown as latest/trend context, not an averaged number.
- [ ] The Overview data still loads honestly when one source is missing.
- [ ] SQP alignment notes are visible when nearest-week logic is used.

### Exit criteria

- [ ] Overview data can support the V2 screen without hacks in the UI layer.
- [ ] Comparison and coverage logic are trustworthy.

---

## Phase 4 — Rebuild the Overview UI

### Objective

Turn Overview into a real V2 operator command center.

### Main repo areas

- `apps/web/src/components/ads-optimizer/OptimizerOverviewPanel.tsx`
- new subcomponents, recommended under:
  - `apps/web/src/components/ads-optimizer/overview/`

### Tasks

- [ ] Split the current monolithic Overview panel into smaller subcomponents.
- [ ] Keep `OptimizerOverviewPanel.tsx` as the stable import boundary, but let it delegate to new V2 pieces.
- [ ] Build these visible sections:
  - [ ] header summary
  - [ ] KPI cards with current / previous / delta
  - [ ] ranking ladder
  - [ ] traffic
  - [ ] conversion
  - [ ] notes / coverage / warnings
- [ ] Keep hero query overrideable per ASIN:
  - [ ] auto-selection remains the fallback
  - [ ] manual selection can be saved and reset from Overview
  - [ ] saved manual hero query drives all hero-query-dependent Overview sections until reset
- [ ] Keep the ranking ladder on the shared V2 definition:
  - [ ] page 1 numeric splits (`1-2`, `3-5`, `6-10`, `11-20`, `21-45`)
  - [ ] page-based buckets for `Page 2` through `Page 7`
  - [ ] display only bucket label, current count, and signed count delta vs previous period
  - [ ] do not add average rank or percentages
- [ ] Add one **global trend mode** control for the page.
- [ ] Keep layout clean on laptop widths.
- [ ] Use metric-aware color handling.
- [ ] Keep the page readable without opening utilities.

### Nice-to-have that should not block this phase

- KPI pinning/customization can wait until the fixed default layout already works well.

### Tests to add or update

- [ ] `test/adsOptimizerOverviewUiWiring.test.ts`
- [ ] any screenshot/text wiring tests for section labels and trend controls

### Automated checks

- [ ] `npm test`
- [ ] `npm run web:lint`
- [ ] `npm run web:build`

### Manual checks

- [ ] A new operator can understand the page in under one minute.
- [ ] The page reads naturally top to bottom.
- [ ] The ranking ladder is visible and useful.
- [ ] Traffic and conversion are visible without crowding the page.
- [ ] Trend mode is page-level, not duplicated inside every card.
- [ ] The page still works well on a laptop without horizontal overload.

### Exit criteria

- [ ] Overview now feels like the V2 design intent rather than the old V1 readout.

---

## Phase 5 — Create the V2 target row model and split the large Targets panel

### Objective

Prepare the Targets page for V2 by separating:
- compact row summary data
- expanded detail data
- panel structure
- advanced diagnostics

### Main repo areas

- `apps/web/src/lib/ads-optimizer/runtime.ts`
- `apps/web/src/lib/ads-optimizer/targetProfile.ts`
- `apps/web/src/components/ads-optimizer/OptimizerTargetsPanel.tsx`

### Tasks

- [ ] Define a V2-facing compact row view model that includes only the collapsed-row essentials:
  - [ ] target text
  - [ ] target tier
  - [ ] compact economics summary
  - [ ] efficiency badge
  - [ ] confidence badge
  - [ ] current role → next role
  - [ ] organic rank + trend summary
  - [ ] contribution summary
  - [ ] change summary
  - [ ] search-term diagnosis chip
  - [ ] sort priority
  - [ ] exception flags
- [ ] Keep full diagnostics available separately for expanded content.
- [ ] Split the giant Targets file into a dedicated subfolder, recommended:
  - [ ] `targets/TargetsPageShell.tsx`
  - [ ] `targets/TargetsToolbar.tsx`
  - [ ] `targets/TargetSummaryRow.tsx`
  - [ ] `targets/TargetExpandedPanel.tsx`
  - [ ] `targets/TargetOverrideForm.tsx`
  - [ ] `targets/TargetAdvancedSection.tsx`
- [ ] Keep `OptimizerTargetsPanel.tsx` as the stable import boundary during migration.
- [ ] Introduce detail lazy-load or at least render-lazy boundaries for:
  - [ ] search terms
  - [ ] raw metrics
  - [ ] deep diagnostics
  - [ ] advanced comparison/rollback panels
- [ ] Keep current handoff/override data intact while the component tree is being split.

### Tests to add or update

- [ ] `test/adsOptimizerTargetProfileUiWiring.test.ts`
- [ ] `test/adsOptimizerRuntimeUiWiring.test.ts`
- [ ] new view-model tests for collapsed row summaries
- [ ] new tests for stable row IDs / selection state

### Automated checks

- [ ] `npm test`
- [ ] `npm run web:lint`
- [ ] `npm run web:build`

### Manual checks

- [ ] The codebase is easier to work in even before the full UI swap is complete.
- [ ] The panel still renders with no missing target data.
- [ ] Selection state survives the component split.
- [ ] The list does not become slower after the refactor foundation.

### Exit criteria

- [ ] The code is ready for the UI interaction rewrite without forcing another giant monolith.

---

## Phase 6 — Replace queue + drawer with inline expandable target rows

### Objective

Make the Targets page behave like V2:
targets are reviewed as expandable decision rows instead of a queue plus a separate sticky drawer.

### Main repo areas

- `apps/web/src/components/ads-optimizer/OptimizerTargetsPanel.tsx`
- new `targets/*` subcomponents
- supporting runtime/view-model helpers

### Tasks

- [ ] Replace the default queue + drawer interaction with inline expansion.
- [ ] Keep the collapsed row strict and narrow.
- [ ] Order expanded sections as:
  - [ ] Why flagged
  - [ ] Change plan
  - [ ] Search terms
  - [ ] Placement
  - [ ] Metrics
  - [ ] Override
  - [ ] Advanced
- [ ] Keep `Why flagged` first and always visible when expanded.
- [ ] Keep current value vs proposed value visible for every supported change.
- [ ] Preserve multi-change recommendations on one target.
- [ ] Preserve manual override controls.
- [ ] Keep bulk selection and Ads Workspace handoff.
- [ ] Simplify the top filter bar to a small default set:
  - [ ] role
  - [ ] tier
  - [ ] trend state
  - [ ] spend direction
  - [ ] exception status
- [ ] Move comparison / rollback / portfolio-cap pressure into Advanced, not the default reading path.
- [ ] Remove or rewrite old copy that still frames the page as “queue + drawer”.

### Tests to add or update

- [ ] `test/adsOptimizerTargetProfileUiWiring.test.ts`
- [ ] `test/adsOptimizerWorkspaceHandoff.test.ts`
- [ ] new UI tests for expand/collapse behavior
- [ ] new tests for override visibility inside expanded rows
- [ ] new tests for default filter and sort behavior

### Automated checks

- [ ] `npm test`
- [ ] `npm run web:lint`
- [ ] `npm run web:build`

### Manual checks

- [ ] The collapsed row is readable on a laptop without feeling like V1 again.
- [ ] Expanding a target keeps the user in context.
- [ ] `Why flagged` is easy to understand.
- [ ] Search-term and placement evidence are close to the decision.
- [ ] Current vs proposed values are always visible before handoff.
- [ ] Bulk selection and handoff to Ads Workspace still work.
- [ ] No accidental direct-execution behavior appears.

### Exit criteria

- [ ] Targets now behaves like the V2 design intent.
- [ ] The operator can review decisions faster than in V1.

---

## Phase 7 — Move History, Config, and Outcome Review behind Utilities / Advanced

### Objective

Keep these valuable surfaces, but remove them from the daily top-level path.

### Main repo areas

- `apps/web/src/app/ads/optimizer/page.tsx`
- `OptimizerHistoryPanel.tsx`
- `OptimizerConfigManager.tsx`
- `OptimizerOutcomeReviewPanel.tsx`
- outcome review/detail routing if needed

### Tasks

- [ ] Finalize one compact utility access pattern in the optimizer shell.
- [ ] Keep History reachable for:
  - [ ] run inspection
  - [ ] manual-run lineage
- [ ] Keep Config reachable for:
  - [ ] rule-pack versioning
  - [ ] product assignment/settings
- [ ] Keep Outcome Review reachable for:
  - [ ] validated change review
  - [ ] score/history inspection
- [ ] Make old deep links still resolve cleanly.
- [ ] Adjust panel copy so these are clearly secondary tools, not the daily home flow.
- [ ] Do not delete these loaders or persistence paths.

### Tests to add or update

- [ ] `test/adsOptimizerConfigUiWiring.test.ts`
- [ ] `test/adsOptimizerOutcomeReviewUiWiring.test.ts`
- [ ] `test/adsOptimizerOutcomeReviewDetailUiWiring.test.ts`
- [ ] `test/adsOptimizerRuntimeUiWiring.test.ts`

### Automated checks

- [ ] `npm test`
- [ ] `npm run web:lint`
- [ ] `npm run web:build`

### Manual checks

- [ ] The primary optimizer surface still feels like only two pages.
- [ ] History, Config, and Outcome Review are still easy to find.
- [ ] Old bookmarks and direct links remain usable.
- [ ] Utility panels do not visually take over the main shell.

### Exit criteria

- [ ] V2 remains simple without deleting important trust layers.

---

## Phase 8 — Cleanup, regressions, and documentation sync

### Objective

Remove stale V1 surface assumptions and finish the migration cleanly.

### Main repo areas

- optimizer UI components
- optimizer tests
- optimizer docs and AGENTS files

### Tasks

- [ ] Remove dead or unused queue/drawer-specific code paths once the new flow is proven.
- [ ] Update stale labels, comments, and help copy that still mention:
  - [ ] review queue as the primary metaphor
  - [ ] target detail drawer as the primary interaction
  - [ ] five equal first-level tabs
- [ ] Ensure `OptimizerOverviewPanel.tsx` and `OptimizerTargetsPanel.tsx` are no longer monolith bottlenecks.
- [ ] Re-run full optimizer regression coverage.
- [ ] Update BUILD_PLAN checkboxes and AGENTS wording to match the shipped V2 contract.
- [ ] Reconfirm Ads Workspace and product pages were not broken.
- [ ] Keep performance acceptable for larger target lists.

### Tests to add or update

- [ ] update stale string-based UI wiring tests
- [ ] full optimizer regression run
- [ ] any new tests needed for performance-sensitive lazy detail loading

### Automated checks

- [ ] `npm test`
- [ ] `npm run web:lint`
- [ ] `npm run web:build`

### Manual checks

- [ ] No prominent optimizer screen still looks like the old V1 queue/drawer model.
- [ ] No dead utilities or broken links remain.
- [ ] The page is faster to scan than V1.
- [ ] `/ads/performance` still works exactly as before.
- [ ] `/products/[asin]` still works exactly as before.
- [ ] There are no obvious console errors or hydration issues.

### Exit criteria

- [ ] V2 is the default operator-facing optimizer surface.
- [ ] V1’s backend rigor is still intact behind it.

---

## AGENTS update decision

**Yes — AGENTS should be updated before Codex starts building.**

### Must-update files

1. `docs/ads-optimizer/AGENTS.md`
2. `apps/web/src/app/ads/optimizer/AGENTS.md`
3. `apps/web/src/lib/ads-optimizer/AGENTS.md`

### Recommended additional update

4. `AGENTS.md` (root) — short pointer only

### Probably no change needed right away

- `apps/web/src/app/ads/AGENTS.md`
- `apps/web/src/lib/ads/AGENTS.md`

Those two are Ads Workspace instructions, and the execution boundary is not changing.

### One non-AGENTS file that also needs review

- `docs/ads-optimizer/OUTCOME_REVIEW_PLAN.md`

It currently describes Outcome Review as a new view/tab, which can conflict with the V2 “secondary utility” direction if left untouched.

---

## Definition of done for the full V2 migration

- [ ] Primary optimizer navigation is only `Overview` and `Targets`.
- [ ] Operators can run, inspect, and hand off without living in History or Config.
- [ ] Overview shows current vs previous period with ranking, traffic, and conversion context.
- [ ] Targets uses inline expansion instead of a separate detail drawer.
- [ ] Current vs proposed values are visible for all changes.
- [ ] Manual overrides remain intact.
- [ ] History, Config, and Outcome Review still work as secondary utilities.
- [ ] Ads Workspace remains the only staging/execution path.
- [ ] `/ads/performance` still works.
- [ ] `/products/[asin]` still works.
- [ ] All required tests, lint, and build checks pass.
