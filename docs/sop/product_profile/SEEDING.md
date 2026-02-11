# Product Seeding

Scripts-first, UI later.

## Command
```bash
npm run product:seed -- \
  --account_id A10515NC1ZVACY \
  --marketplace US \
  --asin B0FYPRWPN1 \
  --status active \
  --brand "Brand" \
  --title "Title" \
  --sku SB-FRAME-WHT-VER \
  --sku SB-FRAME-WHT-VER-2
```

## Optional Cost
```bash
npm run product:seed -- \
  --account_id A10515NC1ZVACY \
  --marketplace US \
  --asin B0FYPRWPN1 \
  --sku SB-FRAME-WHT-VER \
  --cost_sku SB-FRAME-WHT-VER \
  --currency USD \
  --landed_cost_per_unit 7.25 \
  --valid_from 2026-02-12
```

## Optional Profile
```bash
npm run product:seed -- \
  --account_id A10515NC1ZVACY \
  --marketplace US \
  --asin B0FYPRWPN1 \
  --profile_json_path /path/to/profile.json
```
