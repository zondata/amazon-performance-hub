# Ads Optimizer V2 Phase 6E Placement Tab Build Plan

- Phase 6A remains authoritative for the collapsed row.
- Phase 6B remains authoritative for the fixed-height expanded shell.
- Phase 6D remains authoritative for the Search term tab.
- This task changes only the Placement tab.
- Placement metrics remain campaign-level context.
- TOS IS remains a non-additive target-level diagnostic.
- The Placement tab intentionally shows two scopes in one tab:
  - target-scope TOS IS diagnostic
  - campaign-scope placement performance table
- No client fetch is performed when the tab opens.
- No synthetic TOS IS window average is allowed.

## Scope

- Replace the existing Placement tab content entirely.
- Keep the current fixed-height expanded-row shell, context strip, tab strip, and tab order unchanged.
- Keep Search term, Why flagged, Change plan, Metrics, and Advanced unchanged.
- Build the new three-row placement table from the server-side placement facts already loaded during target-profile construction.
- Keep the existing `placementContext` field for backward compatibility.
- Add a new richer `placementBreakdown` payload/view field plus `currentCampaignBiddingStrategy`.

## Data rules

- Placement metrics remain campaign-level context only and must not be treated as target-owned history.
- `TOS IS`, `STIS`, and `STIR` remain non-additive diagnostics and must not be synthesized into window averages.
- The Placement tab renders only repo-compliant TOS IS metadata:
  - `latestValue`
  - `previousValue`
  - `delta`
  - `direction`
  - `observedDays`
  - `latestObservedDate`
- Trend/sparkline behavior from the mockup is intentionally not implemented.

## UI contract

- Render a four-row Placement tab layout:
  - info row
  - toolbar
  - scrollable table region
  - footer
- The left info card is a fixed-width TOS IS diagnostic card.
- The right info card explains campaign sharing context using in-memory target rows for the campaign target count.
- The table renders exactly three placement rows plus one total row.
- The `Previous & change` switch only shows or hides stacked previous/change metric lines in placement data rows.
- No Trend button is rendered in this tab.
