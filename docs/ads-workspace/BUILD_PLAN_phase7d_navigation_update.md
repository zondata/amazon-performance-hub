# Ads Workspace Navigation Update Plan (Conflict-Free)

## File
`docs/ads-workspace/BUILD_PLAN_phase7d_navigation_update.md`

## Goal
Improve Ads Workspace navigation and row actions without conflicting with the completed STIS/STIR/TOS IS semantics fix and the later Target Table KPI cleanup.

This plan replaces the older navigation plan assumptions that are now outdated.

---

## Locked Rules From Completed Work

### KPI scope rules that must remain true
- STIS = Search Term Impression Share
- STIR = Search Term Impression Rank
- TOS IS = Top-of-Search Impression Share

### Surface rules that must remain true
- Campaign surfaces:
  - do not show STIS
  - do not show STIR
  - do not derive or infer campaign TOS IS from target rows
- Target Table:
  - do not show STIS
  - do not show STIR
  - do not show TOS IS
- Target Trend:
  - keep STIS
  - keep STIR
  - keep TOS IS
- On target surfaces, TOS IS is a target-row diagnostic from SP Targeting rows, not campaign placement context
- Campaign placement context is still valid for placement metrics and placement modifiers only

### Navigation design rules
- One consistent row-end actions entry point across levels
- Scope-aware destinations only
- Do not show destinations that are ambiguous or unsupported
- Preserve current workspace context when navigating whenever possible
- Stage change should be reachable from the row-end actions entry point

---

## Non-Goals
- Do not change STIS/STIR/TOS IS definitions
- Do not reintroduce STIS/STIR/TOS IS into Target Table
- Do not add campaign-level TOS IS unless a true campaign-grain source is implemented in a separate phase
- Do not redesign unrelated KPI calculations

---

## Proposed UX

### Single row-end actions menu
Each row at each supported level gets one actions button at the end of the row.

When clicked, it opens a compact menu with only the destinations/actions that are valid for that row.

Menu entries may include:
- Stage change
- Campaign
- Placement
- Ad group
- Target
- Search term

But only show entries that are valid for the current row and current scope.

### Scope-aware behavior
- Campaign row:
  - Stage change
  - Placement
  - Ad group
  - Target
  - Search term
- Placement row:
  - Stage change
  - Campaign
  - Ad group
  - Target
  - Search term
- Ad group row:
  - Stage change
  - Campaign
  - Placement
  - Target
  - Search term
- Target row:
  - Stage change
  - Campaign
  - Placement
  - Ad group
  - Search term
- Search term row:
  - Stage change only if supported and meaningful
  - Campaign
  - Placement
  - Ad group
  - Target

If a destination is not deterministic for that row, do not show it.

---

## Required Product Decisions

### 1. Target row actions
- Move Stage change to the main target row actions menu
- Do not require row expansion just to access Stage change
- Keep expanded content for diagnostics and inspection, not for primary actions

### 2. Campaign context on Target rows
Allowed:
- campaign target count
- placement modifier context
- campaign placement performance context where already supported

Not allowed:
- TOS IS as campaign context
- STIS/STIR/TOS IS in Target Table aggregated KPI columns

### 3. Target Table KPI restrictions
Do not reintroduce:
- STIS
- STIR
- TOS IS

These stay off the aggregated Target Table.

### 4. Target Trend KPI retention
Keep:
- STIS
- STIR
- TOS IS

Do not remove them from Target Trend.

### 5. Campaign surfaces
Keep campaign surfaces free of:
- STIS
- STIR
- inferred TOS IS from target rows

If campaign-level TOS IS is ever added later, it must come from a true campaign-grain source in a separate plan.

---

## Implementation Phases

## Phase 7D.1 - Row actions foundation
- [x] Audit current row action buttons across Campaign, Ad Group, Target, and Search Term surfaces
- [x] Define one reusable row-actions menu component or shared pattern
- [x] Add row-end actions trigger on supported rows
- [x] Preserve current actions behavior while moving toward the shared menu
- [x] Keep changes minimal and local to Ads Workspace

### Acceptance criteria
- [x] Every intended row has one visible row-end actions entry point
- [x] No KPI semantics are changed
- [x] Existing navigation still works

---

## Phase 7D.2 - Target row ergonomics
- [x] Move Stage change from expanded Target details to the main Target row actions menu
- [x] Keep expanded panel available for search-term diagnostics and context
- [ ] If useful, show campaign target count in the Target row context area or a dedicated small column
- [x] Do not add STIS/STIR/TOS IS back into Target Table

### Acceptance criteria
- [x] User can access Stage change from Target row without expanding
- [x] Expanded Target details remain focused on diagnostics
- [x] No aggregated Target Table diagnostic KPI regression

---

## Phase 7D.3 - Scoped navigation destinations
- [x] Implement valid destination matrix for each row scope
- [x] Hide ambiguous or unsupported destinations
- [x] Preserve selected product, date range, filters, and row context where possible
- [x] When drilling between levels, carry the strongest deterministic parent identifiers available

### Acceptance criteria
- [x] Row menu only shows valid destinations
- [x] Navigation does not land on misleading or over-broad views
- [x] Context is preserved as much as possible

---

## Phase 7D.4 - Campaign and Placement consistency
- [x] Ensure Campaign and Placement row menus follow the same shared pattern
- [x] Keep campaign surfaces free from STIS/STIR/inferred TOS IS
- [x] Keep placement navigation campaign-scoped and clearly labeled

### Acceptance criteria
- [x] Campaign and Placement actions feel consistent with Target and Ad Group rows
- [x] No KPI scope regressions are introduced

---

## Phase 7D.5 - Tests and polish
- [x] Add UI wiring tests for row-actions visibility by scope
- [x] Add tests for valid/invalid destination visibility by row type
- [x] Add tests confirming Target row Stage change is accessible without expansion
- [x] Add tests confirming Target Table still excludes STIS/STIR/TOS IS
- [x] Add tests confirming Target Trend still includes STIS/STIR/TOS IS where expected
- [x] Update any relevant docs or local AGENTS notes if interaction rules changed

### Acceptance criteria
- [x] Tests cover the destination matrix and target-row action ergonomics
- [x] Existing lint/build/test remain green

---

## Suggested Destination Matrix

### Campaign row
Show:
- Stage change
- Placement
- Ad group
- Target
- Search term

Hide:
- Campaign (already here)

### Placement row
Show:
- Stage change
- Campaign
- Ad group
- Target
- Search term

Hide:
- Placement (already here)

### Ad group row
Show:
- Stage change
- Campaign
- Placement
- Target
- Search term

Hide:
- Ad group (already here)

### Target row
Show:
- Stage change
- Campaign
- Placement
- Ad group
- Search term

Hide:
- Target (already here)

### Search term row
Show:
- Campaign
- Placement
- Ad group
- Target

Optional:
- Stage change only if there is a meaningful row-bound action

Hide:
- Search term (already here)

---

## Engineering Guardrails
- Do not mix KPI-scope changes into this navigation phase
- Do not re-open the TOS IS/STIS semantic fix
- Do not add unsupported deep links that appear valid but lose determinism
- Prefer hiding unavailable destinations over sending users to a broad ambiguous view
- Keep URL/state handling explicit and testable
- Keep current null-safe behavior where source coverage is incomplete

---

## Suggested Codex Execution Order
1. Build the shared row-actions pattern
2. Move Target row Stage change into the row actions menu
3. Implement destination matrix for each row type
4. Wire context-preserving navigation
5. Add regression tests
6. Update the checklist in this file

---

## Ready-to-Use Codex Instruction
Follow `docs/ads-workspace/BUILD_PLAN_phase7d_navigation_update.md`.

Important:
- Do not reintroduce STIS/STIR/TOS IS into Target Table
- Keep STIS/STIR/TOS IS on Target Trend
- Do not derive campaign TOS IS from target rows
- Move Target row Stage change to the main row actions menu
- Use one shared row-end actions pattern across levels
- Only show valid destinations for each row scope
- Update the checkboxes in this file as work completes
- Run tests, lint, and build before stopping

---

## Definition of Done
- One shared row-end actions pattern exists across supported Ads Workspace levels
- Target row Stage change no longer requires expansion
- Navigation is scope-aware and deterministic
- Target Table remains free of STIS/STIR/TOS IS
- Target Trend keeps STIS/STIR/TOS IS
- Campaign surfaces remain free of fake campaign STIS/STIR/TOS IS
- Tests, lint, and build pass
