# Product Profile SOP

Scripts-first, UI later.

## Tables
- `products`
- `product_skus`
- `product_profile`
- `product_cost_history`

## Keys
- Product unique: `(account_id, marketplace, asin)`
- SKU unique: `(account_id, marketplace, sku)`

## Views
- `v_product_sku_base` (base SKU = earliest `created_at` per product)
- `v_product_sku_cost_current` (current cost uses `CURRENT_DATE`)

## Cost History Rules
- Append-only.
- Safe insert closes the current row: `valid_to = new_valid_from - 1 day`.
- Identical rows (same `valid_from`, `currency`, `landed_cost_per_unit`) are skipped.

## Commands
- Seed: `npm run product:seed -- ...`
- Cleanup test SKUs: `npm run product:cleanup-test-skus`
