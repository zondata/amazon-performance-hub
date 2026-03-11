# Progressive Disclosure Workbench

## Purpose
Use this pattern for dense operator review pages where the user needs to:
- scan many rows quickly,
- keep a detailed explanation open at the same time,
- compare context without losing place,
- and avoid wasting most of the viewport on secondary cards.

The pattern is built for review-first workflows, not execution-first workflows.

## When to use it
Use this layout when all of these are true:
- the page has a row queue, table, or review list,
- each row has materially more detail than fits in a table,
- the operator needs both fast scanning and full explanation,
- and the page would become too tall if all context stayed expanded above the main work area.

Do not use it for simple dashboards, short forms, or pages where one scroll column is enough.

## Layout intent
- Top/context sections should be compact or collapsed by default.
- The main workbench should take most of the available desktop height.
- Dense review should happen in the workbench, not in top summary cards.
- The queue is for scan, sort, compare, and selection.
- The drawer is for full explanation, diagnostics, and audit detail.

## Desktop behavior
On desktop, prefer a split workbench:
- left: queue/table/list pane,
- right: detail drawer pane,
- above: compact contextual panels, usually collapsed first.

The workbench should be the primary review surface. The user should be able to stay inside it for most of the task.

## Mobile / tablet fallback
On mobile and tablet, simplify:
- allow a normal page scroll,
- reduce or remove nested scroll regions,
- avoid sticky/frozen behavior that creates touch traps,
- allow queue and detail surfaces to stack naturally if needed.

This pattern is desktop-first. Touch devices should degrade gracefully instead of forcing desktop nested-scroll behavior.

## Scroll ownership rules
- The queue pane owns its own vertical scroll.
- If the queue contains a wide table, the queue pane also owns that table's horizontal scroll.
- The drawer pane owns its own vertical scroll.
- The outer page should not accidentally become the effective scroll owner for queue or drawer browsing.

Practical rule:
- put the actual `overflow-auto` or split `overflow-y-auto` / `overflow-x-auto` on the real pane that the user is meant to scroll,
- not on an outer shell,
- and not on multiple competing ancestors.

## Sticky header rules
- Sticky headers must attach to the real queue scroll container.
- The sticky header needs explicit `top`, background, and z-index.
- Sticky header cells are usually more reliable than trying to stick the entire row in complex tables.
- Keep header alignment tied to the same table/layout as the body.

If the header disappears during scroll, the scroll owner is probably wrong or a parent overflow/contain chain is breaking sticky.

## Sticky first-column rules
- Freeze only the columns the user truly needs.
- Attach sticky-left behavior to the same real queue scroll container as the table.
- Give frozen cells a solid background.
- Add explicit z-index layering so frozen cells sit above scrolling cells.
- The top-left intersecting cell needs the highest z-index among table cells.
- Add a visible separator so the frozen column does not visually blend into the scrolling columns.

If cells bleed through, the frozen column is missing explicit background or layering.

## Collapsible summary panel rules
Use compact summary panels for contextual sections above the workbench:
- portfolio controls,
- exception queues,
- comparison summaries,
- rollback guidance,
- methodology help,
- or other reference/context blocks.

Default behavior:
- show a short summary row or count strip first,
- hide heavy detail until the operator chooses to expand it,
- keep empty states compact.

These panels should help the operator orient quickly, not push the workbench off screen.

## Queue vs drawer responsibilities
Queue responsibilities:
- scan,
- sort,
- filter,
- compare rows,
- show compact warnings/signals,
- support selection or handoff controls when relevant.

Drawer responsibilities:
- full explanation,
- diagnostics,
- raw and derived metrics,
- comparison detail,
- role/guardrail context,
- audit and rollback context,
- detailed recommendation reasoning.

If the queue starts trying to explain everything, density and review speed collapse.

## Toolbar rules
- Use a dense horizontal toolbar on desktop.
- Keep the main row actions in one line when space allows.
- Put status/selection summary in the toolbar instead of giving it a separate large card.
- Keep toolbar controls above the queue scroller, not mixed into table rows.

## Empty state rules
- Keep empty states compact.
- Prefer one or two short lines over tall boxes.
- Explain what is missing and what the operator should do next.
- Do not use large empty-state cards where the content is effectively "nothing changed" or "no rows match".

## Implementation pitfalls to avoid
- Overflow on the wrong ancestor.
- Missing `min-h-0` on flex or grid children, causing scroll to attach to the page instead of the pane.
- Sticky broken by an overflow/contain/transform chain.
- Sticky header rendered outside the real scroll pane.
- Two horizontal scroll owners for the same table.
- Registering a table with a global horizontal scrollbar when the pane should own its own scroll.
- Frozen-column bleed-through because of missing background or z-index.
- Top cards staying fully expanded and consuming the viewport before the user reaches the workbench.
- Toolbar controls stacking vertically on wide desktop layouts without a good reason.

## Short implementation guidance
- Constrain the desktop workbench height explicitly.
- Use `min-h-0` anywhere a flex/grid child needs to become scrollable.
- Keep queue and drawer scroll panes separate.
- For wide tables, prefer one pane that owns both axes when sticky header and sticky first-column behavior need to stay coordinated.
- Use explicit backgrounds and z-index for all sticky cells.
- Test both vertical and horizontal scroll together, not separately.

## Reference implementation
Current reference implementation:
- [OptimizerTargetsPanel.tsx](/home/albert/code/amazon-performance-hub/apps/web/src/components/ads-optimizer/OptimizerTargetsPanel.tsx)

Use that page as the reference for:
- internal queue scroll,
- internal drawer scroll,
- sticky queue header,
- sticky first column,
- progressive disclosure top sections,
- desktop-first dense review workflow.

## Notes for future pages
Future dense review pages should prefer this pattern when appropriate, but copy the behavior intentionally:
- compact the top context,
- give the workbench the height,
- make scroll ownership explicit,
- and keep queue/drawer responsibilities separate.
