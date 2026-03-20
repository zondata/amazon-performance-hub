# Ads Optimizer V2 Phase 6D: Search Term Tab Redesign

## Scope boundary
- Phase 6A remains authoritative for the collapsed row.
- Phase 6B remains authoritative for the fixed-height tabbed expanded shell.
- This task changes only the `Search term` tab content.
- This task replaces the existing `Search term` tab layout entirely.

## Search term tab contract
- Keep the current fixed-height expanded-row shell, context strip, tab strip placement, and active-tab plumbing.
- Replace the old search-term evidence card layout with a full-height toolbar + scrollable table + footer tab body.
- STIR remains a rank integer.
- Trend is not rendered inline inside the `Search term` tab; the tab uses a `Trend` button that opens Ads Workspace target trend in a new browser tab.

## Non-goals
- Do not change the collapsed row structure or behavior.
- Do not change the tab list in this phase.
- Do not change `Change plan`, `Placement`, `Metrics`, or `Advanced`.
- Do not add inline charting, isolate/negate execution behavior, or new backend/data-loading contracts.
