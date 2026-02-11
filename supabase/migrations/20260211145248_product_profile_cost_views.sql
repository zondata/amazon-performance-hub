-- Product Profile cost views

CREATE OR REPLACE VIEW v_product_sku_base AS
SELECT DISTINCT ON (ps.product_id)
  ps.product_id,
  ps.sku_id AS base_sku_id,
  ps.sku AS base_sku,
  ps.account_id,
  ps.marketplace
FROM product_skus ps
ORDER BY ps.product_id, ps.created_at ASC, ps.sku_id ASC;

CREATE OR REPLACE VIEW v_product_sku_cost_current AS
WITH current_cost_by_sku AS (
  SELECT DISTINCT ON (pch.sku_id)
    pch.sku_id,
    pch.currency,
    pch.landed_cost_per_unit,
    pch.supplier_cost,
    pch.packaging_cost,
    pch.domestic_ship_cost,
    pch.intl_ship_cost,
    pch.duty_tax_cost,
    pch.prep_cost,
    pch.assembly_cost,
    pch.other_cost,
    pch.valid_from,
    pch.valid_to,
    pch.notes,
    pch.created_at
  FROM product_cost_history pch
  WHERE pch.valid_from <= CURRENT_DATE
    AND (pch.valid_to IS NULL OR pch.valid_to >= CURRENT_DATE)
  ORDER BY pch.sku_id, pch.valid_from DESC, pch.created_at DESC, pch.cost_id DESC
)
SELECT
  ps.sku_id,
  ps.product_id,
  ps.account_id,
  ps.marketplace,
  ps.sku,
  COALESCE(self_cost.sku_id, base_cost.sku_id) AS effective_sku_id,
  COALESCE(self_cost.currency, base_cost.currency) AS currency,
  COALESCE(self_cost.landed_cost_per_unit, base_cost.landed_cost_per_unit) AS landed_cost_per_unit,
  COALESCE(self_cost.supplier_cost, base_cost.supplier_cost) AS supplier_cost,
  COALESCE(self_cost.packaging_cost, base_cost.packaging_cost) AS packaging_cost,
  COALESCE(self_cost.domestic_ship_cost, base_cost.domestic_ship_cost) AS domestic_ship_cost,
  COALESCE(self_cost.intl_ship_cost, base_cost.intl_ship_cost) AS intl_ship_cost,
  COALESCE(self_cost.duty_tax_cost, base_cost.duty_tax_cost) AS duty_tax_cost,
  COALESCE(self_cost.prep_cost, base_cost.prep_cost) AS prep_cost,
  COALESCE(self_cost.assembly_cost, base_cost.assembly_cost) AS assembly_cost,
  COALESCE(self_cost.other_cost, base_cost.other_cost) AS other_cost,
  COALESCE(self_cost.valid_from, base_cost.valid_from) AS valid_from,
  COALESCE(self_cost.valid_to, base_cost.valid_to) AS valid_to,
  COALESCE(self_cost.notes, base_cost.notes) AS notes
FROM product_skus ps
LEFT JOIN v_product_sku_base vb
  ON vb.product_id = ps.product_id
LEFT JOIN current_cost_by_sku self_cost
  ON self_cost.sku_id = ps.sku_id
LEFT JOIN current_cost_by_sku base_cost
  ON base_cost.sku_id = vb.base_sku_id;
