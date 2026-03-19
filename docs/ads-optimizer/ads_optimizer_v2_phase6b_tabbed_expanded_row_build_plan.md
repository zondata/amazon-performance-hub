# Ads Optimizer V2 Phase 6B Tabbed Expanded Row Build Plan

## Scope Boundary
- Phase 6A remains the authoritative contract for collapsed rows.
- This Phase 6B task changes only the inline expanded row rendered directly beneath a selected collapsed row.
- This task replaces the stacked expanded sections with a tabbed expanded surface.

## Phase 6B Tabbed Expanded Row
- Keep the collapsed row visible and unchanged.
- Keep one expanded row open at a time.
- Keep the expanded row rendered as the second `<tr>` directly below the selected collapsed row.
- Use a fixed-height inline shell with a persistent context strip, a horizontal tab strip, and a vertically scrollable content body.

## Tabbed Expanded Surface
- The expanded shell is fixed at `36rem`.
- The shell uses three rows:
  - context strip
  - tab strip
  - scrollable tab panel body
- The context strip replaces the duplicated expanded-row heading, metadata lines, badge row, and panel-level actions.
- The tab strip replaces the old stacked section order.
- Only one tab panel is visible at a time.

## Required Tabs
- `why_flagged` -> `Why flagged`
- `change_plan` -> `Change plan`
- `search_term` -> `Search term`
- `placement` -> `Placement`
- `metrics` -> `Metrics`
- `override` -> `Override`
- `advanced` -> `Advanced`

## Content Contract
- `Why flagged` uses the existing why-flagged narrative, callout helpers, and persisted reason-code badges.
- `Change plan` reuses the existing proposed-change content.
- `Search term` reuses the existing search-term evidence table and diagnostics content.
- `Placement` reuses the existing placement evidence content.
- `Metrics` reuses the existing metrics block content without the old disclosure wrapper.
- `Override` reuses the existing override summary, saved override details, manual override cards, and `TargetOverrideForm` without the old disclosure wrapper.
- `Advanced` reuses the existing advanced diagnostics blocks without the old disclosure wrapper.

## Out Of Scope
- Collapsed-row redesign
- Runtime loader changes
- Recommendation-engine changes
- Persisted data-shape changes
- New Ads Workspace entry points inside the expanded row
