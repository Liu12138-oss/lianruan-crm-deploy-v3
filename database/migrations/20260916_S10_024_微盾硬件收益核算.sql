-- S10.24：微盾＋硬件收益核算。
-- 页面入口复用硬件管理，内部成本单独版本化保存，不能写入对外报价目录。

BEGIN;

ALTER TABLE catalog.product_categories
  ADD COLUMN IF NOT EXISTS profit_scope_code text NOT NULL DEFAULT 'unclassified';
ALTER TABLE catalog.product_categories
  DROP CONSTRAINT IF EXISTS product_categories_profit_scope_code_check;
ALTER TABLE catalog.product_categories
  ADD CONSTRAINT product_categories_profit_scope_code_check
  CHECK (profit_scope_code IN ('weidun', 'xcad', 'unclassified'));

ALTER TABLE catalog.hardware_products
  ADD COLUMN IF NOT EXISTS profit_scope_code text NOT NULL DEFAULT 'unclassified';
ALTER TABLE catalog.hardware_products
  DROP CONSTRAINT IF EXISTS hardware_products_profit_scope_code_check;
ALTER TABLE catalog.hardware_products
  ADD CONSTRAINT hardware_products_profit_scope_code_check
  CHECK (profit_scope_code IN ('weidun', 'xcad', 'unclassified'));

-- 使用稳定分类编码标识产品线，不按名称正则判断。
UPDATE catalog.product_categories
SET profit_scope_code = CASE
  WHEN category_code = 'CAT-LEP' THEN 'weidun'
  WHEN category_code = 'CAT-1779261229045' THEN 'xcad'
  ELSE 'unclassified'
END;

-- 本期收益表只纳入 Excel 中的 13 个微盾硬件型号。数据库已有的 LV-7050-A
-- 是 Excel 型号 LV-7050A 的历史稳定编码，映射关系在成本规则来源中保留说明。
UPDATE catalog.hardware_products
SET profit_scope_code = CASE
  WHEN hardware_code IN (
    'LV-7050-A', 'LV-7050', '准入-N1', '准入-N2', '准入-N3',
    'UNACC-1050', 'UNACC-1100', '安渡-X2', '安渡-X3', '安渡-X3-hc',
    'P1', 'P2', 'P3'
  ) THEN 'weidun'
  ELSE 'unclassified'
END;

ALTER TABLE crm.quotes
  ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES org.regions(id);
CREATE INDEX IF NOT EXISTS idx_quotes_region_status
  ON crm.quotes(region_id, status_code, created_at DESC);

-- 只在商机和渠道商正式区域一致，或只有一方存在时补齐；冲突保持空值等待人工处理。
UPDATE crm.quotes q
SET region_id = o.region_id, updated_at = now()
FROM crm.opportunities o
WHERE q.opportunity_id = o.id
  AND q.region_id IS NULL
  AND o.region_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM channel.partners p
    WHERE p.id = q.partner_id
      AND p.region_id IS NOT NULL
      AND p.region_id <> o.region_id
  );
UPDATE crm.quotes q
SET region_id = p.region_id, updated_at = now()
FROM channel.partners p
WHERE q.partner_id = p.id AND q.region_id IS NULL AND q.opportunity_id IS NULL;

ALTER TABLE crm.quote_items
  ADD COLUMN IF NOT EXISTS item_type_code text NOT NULL DEFAULT 'unknown';
ALTER TABLE crm.quote_items
  DROP CONSTRAINT IF EXISTS quote_items_item_type_code_check;
ALTER TABLE crm.quote_items
  ADD CONSTRAINT quote_items_item_type_code_check
  CHECK (item_type_code IN ('software', 'hardware', 'service', 'unknown'));
ALTER TABLE crm.quote_items
  ADD COLUMN IF NOT EXISTS extra_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE crm.quote_items
  DROP CONSTRAINT IF EXISTS quote_items_hardware_quantity_integer_check;
ALTER TABLE crm.quote_items
  ADD CONSTRAINT quote_items_hardware_quantity_integer_check
  CHECK (product_ref_type <> 'hardware' OR quantity = trunc(quantity));

UPDATE crm.quote_items qi
SET item_type_code = CASE
  WHEN qi.product_ref_type = 'hardware' THEN 'hardware'
  WHEN qi.product_ref_type = 'feature' AND c.category_code = 'CAT-MAINTENANCE' THEN 'service'
  WHEN qi.product_ref_type = 'feature' AND c.product_type_code = 'software' THEN 'software'
  ELSE 'unknown'
END
FROM catalog.product_features f
LEFT JOIN catalog.product_modules m ON m.id = f.module_id
LEFT JOIN catalog.product_categories c ON c.id = m.category_id
WHERE qi.product_ref_type = 'feature' AND qi.product_ref_id = f.id;
UPDATE crm.quote_items
SET item_type_code = 'hardware'
WHERE product_ref_type = 'hardware';

CREATE TABLE IF NOT EXISTS catalog.hardware_profit_cost_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hardware_product_id uuid NOT NULL REFERENCES catalog.hardware_products(id) ON DELETE RESTRICT,
  internal_sale_cost numeric(18,2) NOT NULL CHECK (internal_sale_cost >= 0),
  annual_warranty_maintenance_cost numeric(18,2) CHECK (annual_warranty_maintenance_cost IS NULL OR annual_warranty_maintenance_cost >= 0),
  version_no integer NOT NULL CHECK (version_no > 0),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active', 'disabled')),
  source_code text NOT NULL CHECK (source_code IN ('excel', 'manual')),
  source_reference text NOT NULL,
  created_by_user_id uuid REFERENCES iam.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  UNIQUE (hardware_product_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_hardware_profit_cost_rules_lookup
  ON catalog.hardware_profit_cost_rules(hardware_product_id, status_code, effective_from DESC);

CREATE OR REPLACE FUNCTION catalog.防止硬件收益成本规则有效期重叠()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status_code = 'active' AND EXISTS (
    SELECT 1
    FROM catalog.hardware_profit_cost_rules existing
    WHERE existing.hardware_product_id = NEW.hardware_product_id
      AND existing.status_code = 'active'
      AND existing.id <> NEW.id
      AND tstzrange(existing.effective_from, existing.effective_to, '[)')
          && tstzrange(NEW.effective_from, NEW.effective_to, '[)')
  ) THEN
    RAISE EXCEPTION '同一硬件型号的收益成本规则有效期不能重叠。';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hardware_profit_cost_rules_no_overlap
  ON catalog.hardware_profit_cost_rules;
CREATE TRIGGER trg_hardware_profit_cost_rules_no_overlap
BEFORE INSERT OR UPDATE ON catalog.hardware_profit_cost_rules
FOR EACH ROW EXECUTE FUNCTION catalog.防止硬件收益成本规则有效期重叠();

CREATE TABLE IF NOT EXISTS crm.quote_profit_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES crm.quotes(id) ON DELETE CASCADE,
  order_id uuid REFERENCES crm.orders(id) ON DELETE RESTRICT,
  region_id uuid REFERENCES org.regions(id),
  status_code text NOT NULL CHECK (status_code IN ('draft', 'incomplete', 'frozen', 'void', 'not_applicable')),
  calculation_version integer NOT NULL CHECK (calculation_version > 0),
  formula_version text NOT NULL,
  quote_row_version bigint NOT NULL,
  approval_round integer NOT NULL DEFAULT 0 CHECK (approval_round >= 0),
  order_revision_no integer NOT NULL DEFAULT 0 CHECK (order_revision_no >= 0),
  warranty_years integer NOT NULL DEFAULT 3 CHECK (warranty_years BETWEEN 1 AND 20),
  procurement_maintenance_years integer NOT NULL DEFAULT 0 CHECK (procurement_maintenance_years BETWEEN 0 AND 20),
  software_discounted_amount numeric(24,6),
  software_public_amount numeric(24,6),
  hardware_quote_amount numeric(24,6),
  product_contract_amount numeric(24,6),
  service_contract_amount numeric(24,6),
  hardware_internal_cost numeric(24,6),
  hardware_annual_warranty_cost numeric(24,6),
  hardware_annual_maintenance_cost numeric(24,6),
  product_tax_amount numeric(24,6),
  service_tax_amount numeric(24,6),
  warranty_cost numeric(24,6),
  procurement_maintenance_cost numeric(24,6),
  effective_contract_income numeric(24,6),
  project_profit numeric(24,6),
  missing_rules_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_hash text,
  created_by_user_id uuid REFERENCES iam.users(id),
  updated_by_user_id uuid REFERENCES iam.users(id),
  frozen_by_user_id uuid REFERENCES iam.users(id),
  frozen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  CHECK (status_code <> 'frozen' OR (
    input_hash IS NOT NULL AND frozen_at IS NOT NULL AND formula_version IS NOT NULL
    AND software_discounted_amount IS NOT NULL AND software_public_amount IS NOT NULL
    AND hardware_quote_amount IS NOT NULL AND product_contract_amount IS NOT NULL
    AND service_contract_amount IS NOT NULL AND hardware_internal_cost IS NOT NULL
    AND hardware_annual_warranty_cost IS NOT NULL AND hardware_annual_maintenance_cost IS NOT NULL
    AND product_tax_amount IS NOT NULL AND service_tax_amount IS NOT NULL
    AND warranty_cost IS NOT NULL AND procurement_maintenance_cost IS NOT NULL
    AND effective_contract_income IS NOT NULL AND project_profit IS NOT NULL
  ))
);
CREATE INDEX IF NOT EXISTS idx_quote_profit_calculations_quote
  ON crm.quote_profit_calculations(quote_id, calculation_version DESC);
CREATE INDEX IF NOT EXISTS idx_quote_profit_calculations_order
  ON crm.quote_profit_calculations(order_id, approval_round, order_revision_no);
CREATE UNIQUE INDEX IF NOT EXISTS ux_quote_profit_current_draft
  ON crm.quote_profit_calculations(quote_id)
  WHERE status_code IN ('draft', 'incomplete');
CREATE UNIQUE INDEX IF NOT EXISTS ux_quote_profit_frozen_round
  ON crm.quote_profit_calculations(order_id, approval_round, order_revision_no, formula_version)
  WHERE status_code = 'frozen' AND order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION crm.禁止修改已冻结收益()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status_code = 'frozen' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION '已冻结的收益快照不可修改。';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_quote_profit_frozen_read_only ON crm.quote_profit_calculations;
CREATE TRIGGER trg_quote_profit_frozen_read_only
BEFORE UPDATE ON crm.quote_profit_calculations
FOR EACH ROW EXECUTE FUNCTION crm.禁止修改已冻结收益();

-- Excel 初始成本。LV-7050A 在现有目录中的稳定硬件编码为 LV-7050-A，属于受控明确映射，不是运行时模糊匹配。
WITH 初始成本(Excel型号, 数据库型号, 内部销售成本, 年度成本, 来源行) AS (
  VALUES
    ('LV-7050A', 'LV-7050-A', 8500.00::numeric, NULL::numeric, 8),
    ('LV-7050', 'LV-7050', 13000.00, 500.00, 9),
    ('准入-N1', '准入-N1', 20000.00, 750.00, 11),
    ('准入-N2', '准入-N2', 20000.00, 1000.00, 12),
    ('准入-N3', '准入-N3', 20000.00, 1300.00, 13),
    ('UNACC-1050', 'UNACC-1050', 10000.00, 4250.00, 14),
    ('UNACC-1100', 'UNACC-1100', 13000.00, 6000.00, 15),
    ('安渡-X2', '安渡-X2', 14000.00, 2600.00, 17),
    ('安渡-X3', '安渡-X3', 25000.00, 3500.00, 18),
    ('安渡-X3-hc', '安渡-X3-hc', 25000.00, 3500.00, 19),
    ('P1', 'P1', 11000.00, 750.00, 23),
    ('P2', 'P2', 12000.00, 1125.00, 24),
    ('P3', 'P3', 17000.00, 1687.50, 25)
)
INSERT INTO catalog.hardware_profit_cost_rules (
  hardware_product_id, internal_sale_cost, annual_warranty_maintenance_cost, version_no,
  effective_from, status_code, source_code, source_reference
)
SELECT h.id, i.内部销售成本, i.年度成本, 1, '2026-05-01T00:00:00+08:00', 'active', 'excel',
       '微盾＋硬件＋渠道XCAD收益核算表-2026-05-to+龙海.xlsx／硬件产品报价清单／Excel型号=' || i.Excel型号 || '／第' || i.来源行 || '行（明确映射=' || i.数据库型号 || '）'
FROM 初始成本 i
JOIN catalog.hardware_products h ON h.hardware_code = i.数据库型号
ON CONFLICT (hardware_product_id, version_no) DO NOTHING;

COMMIT;
