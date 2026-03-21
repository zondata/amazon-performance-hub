# Ads Optimizer V2 Phase 6F SQP Tab Build Plan

- Phase 6A remains authoritative for the collapsed row.
- Phase 6B remains authoritative for the fixed-height expanded shell.
- Phase 6D remains authoritative for the Search term tab.
- Phase 6E remains authoritative for the Placement tab.
- This phase changes only the new SQP tab.
- Search term and Placement remain authoritative for their own tabs.
- SQP is matched-query ASIN context, not target-owned history.
- The tab uses persisted snapshot payload, not tab-open fetches.
- Comparison is same matched query only.
- Current and previous SQP week labels come from the current snapshot and previous comparable snapshot respectively.
- Deterministic summary only. No AI call.

## Scope

- Add a new `SQP` tab to the expanded-row tab strip after `Placement`.
- Keep the fixed-height expanded shell, active-tab reset behavior, and existing tabs unchanged.
- Build SQP detail from the same aligned ASIN-level SQP week already used by the collapsed-row SQP context.
- Persist only matched-query SQP detail in the target snapshot payload; do not persist the full aligned-week row set.

## Data rules

- Use the deterministic resolved-keyword mapping already used by optimizer ranking context.
- Current SQP week comes from the current snapshot payload.
- Previous SQP week comes from the previous comparable snapshot payload.
- Do not compare different matched queries.
- If the previous comparable resolves to a different SQP query, show current SQP values and hide previous/change values.

## UI contract

- Render a four-row SQP tab layout:
  - info row
  - toolbar
  - scrollable table region
  - footer
- The info row includes `SQP CONTEXT` and `SQP SUMMARY` cards.
- The toolbar uses the same `Previous & change` interaction pattern as the Search term and Placement tabs.
- The table is fixed-order and non-sortable.
- Missing data remains explicit and uses the persisted SQP notes when available.
