# Product Cost History

Scripts-first, UI later.

## Rules
- Append-only history.
- New cost inserts close the current row: `valid_to = new_valid_from - 1 day`.
- Identical new row (same `valid_from`, `currency`, `landed_cost_per_unit`) is skipped.
- Current cost views use `CURRENT_DATE`.

## Safe Insert Behavior
- If a current row exists (`valid_to is null`), it is closed before inserting the new row.
- No deletes; history remains intact.
