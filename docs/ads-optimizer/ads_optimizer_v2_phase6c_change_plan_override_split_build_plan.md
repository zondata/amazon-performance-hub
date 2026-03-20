# Ads Optimizer V2 Phase 6C Change Plan Override Split Build Plan

## Scope Boundary
- Phase 6A remains authoritative for the collapsed row.
- Phase 6B remains authoritative for the fixed-height tabbed expanded shell.
- This Phase 6C task supersedes only the tab list and the Change plan / Override content described in the earlier expanded-row work.
- Do not delete or rename any existing Phase 6A or Phase 6B documents.

## Phase 6C Update
- Keep the existing fixed-height expanded-row shell.
- Keep the existing context strip.
- Keep the tab strip directly below the context strip.
- Remove the standalone `Override` tab.
- Manual override controls now live inside the `Change plan` tab.

## Required Tabs
- `why_flagged` -> `Why flagged`
- `change_plan` -> `Change plan`
- `search_term` -> `Search term`
- `placement` -> `Placement`
- `metrics` -> `Metrics`
- `advanced` -> `Advanced`

## Change Plan Contract
- `Change plan` becomes a fixed two-pane split inside the existing scrollable tab body.
- Left pane stays read-only and shows the optimizer proposal plus stageable vs review-only summary.
- Right pane contains the manual override switch, override scope, replacement action bundle, operator note, and save action.
- When manual override is active, the left pane remains visible as an audit view and is dimmed instead of hidden.

## Out Of Scope
- Collapsed-row redesign or behavior changes
- Table sorting, filtering, resizing, selection, or expansion placement changes
- Backend or API changes
- Recommendation-engine logic changes
- Ads Workspace route changes
