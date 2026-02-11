# Keyword Import

Scripts-first, UI later.

## CSV Rules
- Row 0: notes (ignored)
- Row 1: headers
- D..O headers become group names
- A/B optional mapping
- No status stored

## Command
```bash
npm run keywords:import -- \
  --account_id A10515NC1ZVACY \
  --marketplace US \
  --asin B0FYPRWPN1 \
  --csv_path /path/to/file.csv \
  --group_set_name current_v1_2026-01-27 \
  --exclusive true
```

## Common Issues
- Exclusivity failure: keyword already assigned to another group in the same set.
- Missing product: no product found for account_id + marketplace + asin.
- Group name not found: column B group not in D..O headers.
