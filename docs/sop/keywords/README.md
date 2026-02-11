# Keywords SOP

Scripts-first, UI later.

## Tables
- `dim_keyword`
- `keyword_group_sets`
- `keyword_groups`
- `keyword_group_members`

## Concepts
- Group set = grouping scheme per product.
- Versioning: create a new group set when strategy changes.
- `is_active` marks the current set.

## Exclusivity
- If `is_exclusive = true`, a keyword can belong to only one group in that set.
- Enforced by trigger.

## Scope
- Strategy library only; not mirroring Amazon state.
- No status fields stored.

## Importer
- `npm run keywords:import -- ...`
- Row 0 ignored, row 1 headers.
- D..O headers become group names.
- Group names must match CSV headers exactly.
