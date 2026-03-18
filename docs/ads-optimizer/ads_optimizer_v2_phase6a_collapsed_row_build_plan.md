# Ads Optimizer V2 — Build Plan Patch
## Phase 6A — Lock the collapsed target row contract before any expanded-row redesign

## Why this patch is needed

The current Phase 6 implementation is structurally correct but design-wrong.
It delivered inline expandable rows, but the collapsed row still behaves like a V1-style summary surface:
- it is rendered as a grid of cards inside each row
- it does not use the approved table contract
- it does not show the exact current / previous / change structure required for State and Economics
- it does not show contribution shares with ranks
- it does not show both organic and sponsored ranking with trend text
- it does not show the approved change-summary format

The main reason Codex drifted is that the previous build plan was too abstract. Phrases like “compact economics summary” and “strict, narrow row” were not specific enough to force the approved V2 design.

This patch removes that ambiguity.

---

## Scope decision

**Do not continue expanded-row redesign work yet.**

Freeze the collapsed row first.
The expanded area may remain functionally working, but this phase is only about the row in collapsed mode and the table shell that supports expansion.

### In scope
- table-based collapsed row layout
- exact column contract
- exact current / previous / change presentation rules
- contribution share + rank calculations
- ranking trend calculation rules
- change summary rendering rules
- stable selection / expansion / sorting / filtering behavior with the new table structure

### Out of scope for this phase
- redesigning expanded-row sections
- changing Search terms or Placement expanded content
- moving History / Config / Outcome Review
- changing Ads Workspace semantics
- rewriting engines
- changing optimizer recommendation logic

---

## Updated phase structure

Replace the old single Phase 6 with two sub-phases:

### Phase 6A
Lock the collapsed row contract and the inline table shell.

### Phase 6B
Redesign the expanded row against the approved evidence flow, after the collapsed row is approved.

Do not start 6B until 6A matches the approved screenshot/design exactly.

---

## Phase 6A objective

Turn the Targets list into a **real decision table**, not a list of mini cards.

Every target must render as:
1. one table row in collapsed mode
2. one optional detail row directly underneath when expanded

The collapsed row must be the approved operator scan surface.
It must communicate the target’s identity, current state, recent change, contribution, ranking context, role transition, and suggested actions without looking like V1.

---

## Canonical UI contract for collapsed mode

## Non-negotiable layout rule

The collapsed view is a **table**, not a card grid.

### Required structure
- One header row at the top of the Targets table.
- One collapsed data row per target.
- When a row expands, render a second row directly below it for detail content.
- The expanded row should use a full-width detail cell via `colSpan`, but the collapsed row itself must stay table-shaped.
- Do not render bordered summary cards inside the collapsed row.
- Do not render each field as a separate box.
- Do not simulate a table with stacked card panels.

### Semantic preference
Use a real semantic table if practical:
- `<table>`
- `<thead>`
- `<tbody>`
- `<tr>`
- `<th>`
- `<td>`

If a CSS-grid-backed table shell is required for technical reasons, it must still behave visually like a table and preserve header-to-column alignment.

---

## Header row contract

The header row must expose these columns in this order:

1. Target
2. State
3. Economics
4. Contribution
5. Ranking
6. Role
7. Change summary

Do not add extra visible columns in collapsed mode.
If a narrow utility/control strip is needed internally, it must still visually belong to the first `Target` column rather than becoming a separate major data column.

---

## Column-by-column contract

## 1) Target column

This first column is the identity and control anchor.

### Must contain
- handoff selection checkbox
- triangle expand/collapse control
- target text
- keyword / target-type label
- match type
- target ID
- campaign context
- tier
- priority

### Presentation rules
- The checkbox and triangle are part of this column, not separate major columns.
- The target text is the most visually prominent text in the cell.
- The second line must show the target identity metadata in a concise readable form, for example:
  - `Keyword · Exact · 460768373054195`
- The third line must show campaign context, for example:
  - `Campaign Name | Ad Group Name`
- Tier and priority should appear as compact badges or short labels near the bottom of the cell.
- Do not place large pills or large recommendation banners here.
- Do not render a card border around tier or priority.

### Data contract
Create or update a dedicated collapsed-row view model so this column is fed by explicit fields, not ad hoc string building in JSX.

Recommended shape:
- `rowId`
- `persistedTargetKey`
- `isSelected`
- `isExpandable`
- `isExpanded`
- `isStageable`
- `targetText`
- `targetKindLabel`
- `matchTypeLabel`
- `targetIdLabel`
- `campaignLabel`
- `adGroupLabel`
- `tierLabel`
- `priorityLabel`
- `prioritySortValue`

### Missing-data rule
- If target ID is unresolved, show an explicit fallback label such as `Unresolved target ID`.
- If campaign or ad group are missing, show `—` rather than hiding the field silently.

---

## 2) State column

This column is not the account/ads “state manager” panel from V1.
It is the compact decision-state comparison cell for this target.

### Must contain
A small comparison table with the subheaders:
- Current
- Previous
- Change

Then the following rows:
- state label
- P&L
- ACoS
- Break-even ACoS

### Clarification
- `state label` here means the target’s performance/efficiency state label that the operator can read quickly, such as `LOSS`, `BREAKEVEN`, `PROFITABLE`, or the repo’s canonical equivalent if one already exists.
- Do **not** invent a new state taxonomy if the repo already has a canonical target-state label.

### Comparison rules
- `Current` is the selected run / selected review window.
- `Previous` is the prior comparable run/window already supported by the V2 comparison model where available.
- `Change` must be explicit and concise.

### Value rules
- P&L should use the repo’s most trustworthy field for target-level profit/loss contribution.
  - Prefer the existing derived profit/loss field already used in optimizer logic.
  - Do not invent a new target profit formula if a canonical one already exists.
- ACoS should come from the current target totals.
- Break-even ACoS should be shown as the current break-even reference value.

### Change-color rules
Colors must be metric-aware:
- P&L: higher is better
- ACoS: lower is better
- Break-even ACoS: reference value, usually neutral unless a trustworthy previous comparison exists
- State label change: only color it if there is a trustworthy ordered good/bad transition map; otherwise keep neutral text

### Important constraint
Do not naively color all positive numeric deltas green and all negative deltas red.
Examples:
- `ACoS -5pp` is good
- `P&L +$20` is good
- a categorical state change may be neutral unless mapped to an ordered model

### Missing-data rule
- If previous-period state or metrics are unavailable, show `—` in the Previous and Change slots.
- Do not synthesize previous values.

---

## 3) Economics column

This column is the traffic/revenue block for the target.

### Must contain
A small comparison table with the subheaders:
- Current
- Previous
- Change

Then the following rows:
- Spend
- Sales
- Orders

### Comparison rules
- Current = selected run/window
- Previous = prior comparison run/window when available
- Change = explicit absolute or percentage movement, whichever is already consistent in the system

### Color rules
- Sales: higher is better
- Orders: higher is better
- Spend: **do not use a naive higher-is-bad or higher-is-good rule**

For Spend change color:
1. Prefer an existing trustworthy spend-direction or recommendation-direction signal if one already exists.
2. If no trustworthy signal exists, render spend change as neutral.
3. Do not mislead the operator with simplistic red/green coloring on spend.

### Missing-data rule
- If previous values are unavailable, show `—`.
- Do not fabricate deltas.

---

## 4) Contribution column

This column shows how much this target contributes relative to the selected run, not relative to the filtered visible subset.

### Must contain
Three rows:
- Sales
- Spend
- Impression

Each row must show:
- contribution percentage versus total target-set value for the selected run
- rank within the selected run

### Exact semantics
- Sales contribution = target sales / total ads sales across all persisted target rows in the selected run
- Spend contribution = target spend / total ads spend across all persisted target rows in the selected run
- Impression contribution = target impressions / total impressions across all persisted target rows in the selected run

### Rank rules
- Rank 1 = largest contribution share for that metric
- Ranks must be calculated against the full persisted target set for the selected run
- Do **not** recalculate ranks based only on the filtered visible rows
- Ties may use stable deterministic ordering, such as share desc then persistedTargetKey asc

### Why this matters
If ranks change when the operator changes a filter, the table becomes untrustworthy. Shares and ranks must remain stable for the selected run context.

### Missing-data rule
- If the denominator is zero or unavailable, show `—` and omit the rank.
- Do not show `0% Rank 1` on empty totals.

---

## 5) Ranking column

This column must show both organic and sponsored ranking using the latest trustworthy observed rank plus a trend text descriptor.

### Must contain
Two ranking blocks:
- Organic
- Sponsored

Each block must show:
- latest rank value
- trend text

### Trend text vocabulary
Use exactly these human-facing trend labels:
- Rising
- Maintain
- Decline
- Limited data
- No data

### Trend-direction meaning
Because lower rank numbers are better:
- `Rising` means the rank number is moving toward 1 in a meaningful way
- `Decline` means the rank number is moving away from 1 in a meaningful way
- `Maintain` means movement exists but is still inside the fluctuation band

### Non-additive rule
Never average rank into a synthetic window value.
Only use observed rank points or already-persisted trustworthy rank snapshots.

### Required trend algorithm
Codex must not invent an arbitrary trend label. Use this decision order:

#### Step 1 — Prefer an existing trustworthy trend helper
If the repo already has a ranking-history helper or persisted trend metadata that fits this target row, reuse it.
Do not duplicate logic unnecessarily.

#### Step 2 — If no helper exists, compute trend using a fluctuation-safe median comparison
For each ranking type independently:
1. collect the latest observed rank points in chronological order
2. ignore missing/null ranks
3. require at least 4 observed points total to claim a real trend
4. split the most recent observations into:
   - latest bucket = most recent up to 3 points
   - prior bucket = immediately preceding up to 3 points
5. compute the median rank in each bucket
6. compare latest median vs prior median using a fluctuation threshold

#### Fluctuation thresholds
Use threshold by prior-rank band:
- prior median rank 1–10: threshold = 2 positions
- prior median rank 11–45: threshold = 5 positions
- prior median rank 46–90: threshold = 8 positions
- prior median rank >90: threshold = 12 positions

#### Trend outcome rules
- if insufficient points: `Limited data`
- if no points: `No data`
- if latest median <= prior median - threshold: `Rising`
- if latest median >= prior median + threshold: `Decline`
- otherwise: `Maintain`

### Why this algorithm is required
Ranking fluctuates naturally. A one-point or two-point swing should not flip the label constantly. The thresholded median method is stable enough for the collapsed row while still being easy to explain.

### Missing-data rule
- If only one of organic or sponsored rank exists, show that one and explicitly show `No data` for the other.
- Do not copy organic values into sponsored, or vice versa.

---

## 6) Role column

This column is the compact role handoff summary.

### Must contain
- Current
- Next

### Rules
- Show the current role and next role as short labels only.
- Do not place long role-history narrative in this column.
- If next role is unchanged, still show both fields.
- If next role is unavailable, show `—` explicitly.

### Data rule
Reuse the repo’s existing current-role / desired-role or current-role / next-role model.
Do not create a second competing role model.

---

## 7) Change summary column

This column is where the operator understands exactly what the optimizer wants changed before expanding.

### Must contain
A compact list of the target’s recommended changes.

### Rendering rules
- One line per supported change.
- Keep each line human-readable and direct.
- Preserve multi-change targets.
- Do not flatten multiple actions into one vague summary.

### Examples
- `Reduce bid from $1.45 to $1.30`
- `Reduce TOS modifier from 15% to 10%`
- `Change state from enabled to paused`

### If many changes exist
- Show the first 2 lines fully.
- If more remain, show a final short overflow line such as `+2 more changes`.
- Do not hide multi-change behavior completely.

### Data rule
Use the existing recommendation snapshot / recommendation detail model.
Do not restate unsupported actions as if they are stageable.

### Missing-data rule
- If there is no supported change, show `No supported stageable change` or the repo’s canonical neutral equivalent.

---

## Visual and density rules

## Row styling rules
- The collapsed row must look like a single table row.
- It must not look like seven mini cards.
- Use subtle separators, shared row background, and consistent column alignment.
- Avoid heavy outlines around every cell.
- Typography should do most of the work.

## Density rules
- The row should remain scannable on a laptop-width screen.
- Do not add explanatory paragraphs inside collapsed cells.
- Use short labels and compact numeric summaries.
- The only text that may wrap more generously is:
  - target text
  - campaign/ad-group context
  - longer change-summary lines

## Responsiveness rule
- The approved default should fit a normal operator laptop width without the entire page turning into a wall of cards.
- If a narrow fallback is needed, allow local horizontal scrolling inside the table container as a fallback.
- Do not collapse the table back into card stacks on smaller widths.

---

## View-model requirements

Create or revise the collapsed-row summary builder so it matches the table contract exactly.
Do not keep a vague “compact summary” object.

Recommended dedicated helper:
- `apps/web/src/lib/ads-optimizer/targetRowTableSummary.ts`
  or refactor the existing summary builder into this exact contract

### Required view-model sections
Each row summary should contain explicit objects for:
- `identity`
- `stateComparison`
- `economicsComparison`
- `contribution`
- `ranking`
- `role`
- `changeSummary`
- `exceptions`
- `selection`
- `expansion`

### Formatting rule
The view model should carry semantically ready values and direction tokens, for example:
- numeric values
- formatted display strings where consistent
- direction flags like `good | bad | neutral | missing`

Do not force JSX components to reconstruct business meaning from raw numbers.

---

## Sorting and filtering constraints

This table redesign must not break sorting or filtering.

### Rules
- Sorting still works from the same run-backed row identity.
- Filtering still works from the same run-backed row identity.
- Selection state still keys off stable persisted target identity.
- Expansion state still keys off stable persisted target identity.
- Contribution ranks must stay stable across filters.
- Expansion must survive sort/filter changes predictably where possible.

---

## Explicit non-goals for Phase 6A

Do not do these in this phase:
- redesign expanded-row Search terms
- redesign expanded-row Placement
- redesign expanded-row Metrics
- move advanced diagnostics again
- revisit shell navigation
- add direct execution from Targets
- change Ads Workspace handoff semantics
- remove manual override
- rewrite recommendation or ranking engines

---

## Tests required for Phase 6A

## View-model tests
Add or update tests for:
- target-column summary mapping
- state current / previous / change mapping
- economics current / previous / change mapping
- contribution percentage calculation
- contribution rank stability against full-run rows, not filtered rows
- ranking trend classification
- missing-data states for ranking
- multi-change summary rendering data

## UI tests
Add or update tests for:
- Targets collapsed surface renders as a table-like structure with the required header columns
- rows no longer render the card-grid summary layout
- each row renders the 7 required columns in order
- checkbox and expand control exist inside the first column
- change summary shows multiple changes when present
- current/previous/change labels appear in State and Economics columns
- selection still works
- expand/collapse still works
- handoff still works

## Suggested relevant files
- `test/adsOptimizerTargetRowSummary.test.ts`
- `test/adsOptimizerTargetProfileUiWiring.test.ts`
- `test/adsOptimizerRuntimeUiWiring.test.ts`
- `test/adsOptimizerWorkspaceHandoff.test.ts`
- add a dedicated ranking-trend helper test if new helper is created

---

## Manual checks for Phase 6A

1. Open `/ads/optimizer` → `Targets`.
2. Confirm the collapsed surface is a table, not a card grid.
3. Confirm the header row is exactly:
   - Target
   - State
   - Economics
   - Contribution
   - Ranking
   - Role
   - Change summary
4. Confirm the first column contains checkbox, triangle, target identity, campaign context, tier, and priority.
5. Confirm the State column shows Current / Previous / Change plus state label, P&L, ACoS, and break-even ACoS.
6. Confirm the Economics column shows Current / Previous / Change plus Spend, Sales, and Orders.
7. Confirm the Contribution column shows Sales / Spend / Impression percentages plus ranks.
8. Confirm the Ranking column shows both Organic and Sponsored rows with rank and trend text.
9. Confirm the Role column shows Current and Next.
10. Confirm the Change summary column shows one line per recommended change.
11. Change filters and confirm contribution ranks do not renumber based on the filtered subset.
12. Sort rows and confirm selection + expansion state still follow the correct target.
13. Expand one row and confirm expansion still works, but do not redesign expanded content in this phase.

---

## Exit criteria for Phase 6A

Phase 6A is done only when all of the following are true:
- the collapsed row matches the approved V2 table contract
- the row no longer looks like a mini dashboard or card grid
- current / previous / change behavior is explicit in State and Economics
- contribution shares and ranks are stable and correct
- ranking shows latest observed organic + sponsored rank with a fluctuation-safe trend label
- change summary preserves multi-change recommendations
- selection, expansion, sorting, filtering, and Ads Workspace handoff still work

Only after that should work continue to Phase 6B expanded-row redesign.
