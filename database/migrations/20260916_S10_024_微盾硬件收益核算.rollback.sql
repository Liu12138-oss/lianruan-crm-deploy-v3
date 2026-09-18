-- 微盾＋硬件收益核算安全回退。
-- 存在收益计算记录、人工成本版本或收益发件箱事件时拒绝破坏性回退。

BEGIN;
DO $$
DECLARE
  v_收益记录数 bigint;
  v_人工规则数 bigint;
  v_事件数 bigint;
  v_新格式硬件数量 bigint;
BEGIN
  IF to_regclass('crm.quote_profit_calculations') IS NOT NULL THEN
    SELECT count(*) INTO v_收益记录数 FROM crm.quote_profit_calculations;
  ELSE
    v_收益记录数 := 0;
  END IF;
  IF to_regclass('catalog.hardware_profit_cost_rules') IS NOT NULL THEN
    SELECT count(*) INTO v_人工规则数 FROM catalog.hardware_profit_cost_rules WHERE source_code = 'manual';
  ELSE
    v_人工规则数 := 0;
  END IF;
  SELECT count(*) INTO v_事件数
  FROM ops.outbox_events
  WHERE event_type = 'crm.quote.profit.freeze.requested';
  IF to_regclass('crm.quote_items') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'crm'
      AND table_name = 'quote_items'
      AND column_name = 'extra_json'
  ) THEN
    SELECT count(*) INTO v_新格式硬件数量
    FROM crm.quote_items
    WHERE product_ref_type = 'hardware'
      AND extra_json->>'hardwareQuantityVersion' = 'hardware-items-v1';
  ELSE
    v_新格式硬件数量 := 0;
  END IF;
  IF v_收益记录数 > 0 OR v_人工规则数 > 0 OR v_事件数 > 0 OR v_新格式硬件数量 > 0 THEN
    RAISE EXCEPTION '收益核算回退被阻断：收益记录=%，人工成本规则=%，收益事件=%，新格式硬件数量=%。请先按保留数据方案回退应用。', v_收益记录数, v_人工规则数, v_事件数, v_新格式硬件数量;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('crm.quote_profit_calculations') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_quote_profit_frozen_read_only ON crm.quote_profit_calculations';
  END IF;
END;
$$;
DROP FUNCTION IF EXISTS crm.禁止修改已冻结收益();
DROP TABLE IF EXISTS crm.quote_profit_calculations;
DO $$
BEGIN
  IF to_regclass('catalog.hardware_profit_cost_rules') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_hardware_profit_cost_rules_no_overlap ON catalog.hardware_profit_cost_rules';
  END IF;
END;
$$;
DROP FUNCTION IF EXISTS catalog.防止硬件收益成本规则有效期重叠();
DROP TABLE IF EXISTS catalog.hardware_profit_cost_rules;
ALTER TABLE crm.quote_items DROP CONSTRAINT IF EXISTS quote_items_hardware_quantity_integer_check;
ALTER TABLE crm.quote_items DROP CONSTRAINT IF EXISTS quote_items_item_type_code_check;
ALTER TABLE crm.quote_items DROP COLUMN IF EXISTS item_type_code;
ALTER TABLE crm.quote_items DROP COLUMN IF EXISTS extra_json;
DROP INDEX IF EXISTS crm.idx_quotes_region_status;
ALTER TABLE crm.quotes DROP COLUMN IF EXISTS region_id;
ALTER TABLE catalog.hardware_products DROP CONSTRAINT IF EXISTS hardware_products_profit_scope_code_check;
ALTER TABLE catalog.hardware_products DROP COLUMN IF EXISTS profit_scope_code;
ALTER TABLE catalog.product_categories DROP CONSTRAINT IF EXISTS product_categories_profit_scope_code_check;
ALTER TABLE catalog.product_categories DROP COLUMN IF EXISTS profit_scope_code;
COMMIT;
