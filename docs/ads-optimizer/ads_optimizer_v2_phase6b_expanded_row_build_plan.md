# Ads Optimizer V2 — Build Plan Patch
## Phase 6B — Expanded-row tab shell after the Phase 6A collapsed-row lock

## Authority and scope

Phase 6A remains the authoritative contract for collapsed rows:
- `docs/ads-optimizer/ads_optimizer_v2_phase6a_collapsed_row_build_plan.md`

Phase 6B is incremental.
It does not reopen or relax the locked collapsed-row contract.

## Phase 6B.1 scope

Phase 6B.1 is exactly:
- fixed-height expanded detail shell
- horizontal tab strip
- Why flagged tab content
- all future tabs visible but disabled

## Out of scope for Phase 6B.1

These expanded-row tabs are out of scope in Phase 6B.1:
- Change plan
- Search term
- Placement
- Metrics (Raw & Derived)
- Override
- Advanced expert details

Do not ship partial content for those tabs in this phase.
They may appear as visible disabled labels only.

## UI contract for Phase 6B.1

- Keep the collapsed table behavior and one-row-expanded-at-a-time behavior unchanged.
- Keep the expanded row as the second `<tr>` directly under the collapsed row.
- Replace the old stacked expanded body with a fixed-height tab shell.
- The expanded panel shell owns the fixed height: `36rem`.
- The header content and tab strip remain visible while only the detail body scrolls vertically.
- The tab strip is horizontal and horizontally scrollable when needed.
- The tab labels appear in this exact order:
  1. Why flagged
  2. Change plan
  3. Search term
  4. Placement
  5. Metrics (Raw & Derived)
  6. Override
  7. Advanced expert details
- Only `Why flagged` is enabled in Phase 6B.1.
- Disabled future tabs must remain visible and must not change the active panel.
- The active tab resets to `why_flagged` whenever a different expanded row becomes active.

## Why flagged contract

In Phase 6B.1 the detail body renders only the Why flagged panel.

Render order:
1. optional warning/callout box for critical warnings and row-specific exceptions
2. existing `buildWhyFlaggedNarrative(...)` narrative
3. reason-code badge block

Reason-code requirements:
- visible label: `Reason codes`
- render `row.queue.reasonCodeBadges`
- preserve machine-code text
- when empty, render exact muted text `No persisted reason codes`

## Non-goals

- no Change plan tab content
- no Search term tab content
- no Placement tab content
- no Metrics tab content
- no Override tab content
- no Advanced tab content
- no changes to runtime loaders or optimizer engines
- no changes to collapsed-row structure or table-mode contracts
