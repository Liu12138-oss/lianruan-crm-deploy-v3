-- S10.30：产品/维保业务类型与维保关联。
-- 历史商机、报价、订单统一回填为产品类型，避免按名称猜测历史维保数据。

BEGIN;

ALTER TABLE crm.opportunities
  ADD COLUMN IF NOT EXISTS business_type_code text NOT NULL DEFAULT 'product';
ALTER TABLE crm.quotes
  ADD COLUMN IF NOT EXISTS business_type_code text NOT NULL DEFAULT 'product';
ALTER TABLE crm.orders
  ADD COLUMN IF NOT EXISTS business_type_code text NOT NULL DEFAULT 'product';

ALTER TABLE crm.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_business_type_code_check;
ALTER TABLE crm.opportunities
  ADD CONSTRAINT opportunities_business_type_code_check
  CHECK (business_type_code IN ('product', 'maintenance'));

ALTER TABLE crm.quotes
  DROP CONSTRAINT IF EXISTS quotes_business_type_code_check;
ALTER TABLE crm.quotes
  ADD CONSTRAINT quotes_business_type_code_check
  CHECK (business_type_code IN ('product', 'maintenance'));

ALTER TABLE crm.orders
  DROP CONSTRAINT IF EXISTS orders_business_type_code_check;
ALTER TABLE crm.orders
  ADD CONSTRAINT orders_business_type_code_check
  CHECK (business_type_code IN ('product', 'maintenance'));

CREATE INDEX IF NOT EXISTS idx_opportunities_business_type
  ON crm.opportunities(business_type_code, customer_id, status_code);
CREATE INDEX IF NOT EXISTS idx_quotes_business_type
  ON crm.quotes(business_type_code, customer_id, status_code);
CREATE INDEX IF NOT EXISTS idx_orders_business_type
  ON crm.orders(business_type_code, customer_id, status_code);

CREATE TABLE IF NOT EXISTS crm.maintenance_opportunity_product_orders (
  opportunity_id uuid NOT NULL REFERENCES crm.opportunities(id) ON DELETE CASCADE,
  product_order_id uuid NOT NULL REFERENCES crm.orders(id) ON DELETE RESTRICT,
  created_by_user_id uuid REFERENCES iam.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, product_order_id)
);
CREATE INDEX IF NOT EXISTS idx_maintenance_opportunity_product_orders_order
  ON crm.maintenance_opportunity_product_orders(product_order_id);

CREATE TABLE IF NOT EXISTS crm.maintenance_order_product_orders (
  maintenance_order_id uuid NOT NULL REFERENCES crm.orders(id) ON DELETE CASCADE,
  product_order_id uuid NOT NULL REFERENCES crm.orders(id) ON DELETE RESTRICT,
  created_by_user_id uuid REFERENCES iam.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (maintenance_order_id, product_order_id),
  CONSTRAINT maintenance_order_product_orders_not_self
    CHECK (maintenance_order_id <> product_order_id)
);
CREATE INDEX IF NOT EXISTS idx_maintenance_order_product_orders_product
  ON crm.maintenance_order_product_orders(product_order_id);

-- 下次跟进提醒属于已取消功能：保留历史模板、规则和投递记录，只停止后续扫描。
-- 部分轻量测试库可能没有 message schema，迁移必须可重复执行且不能因此中断。
DO $$
BEGIN
  IF to_regclass('message.reminder_templates') IS NOT NULL THEN
    UPDATE message.reminder_templates
    SET status_code = 'disabled', updated_at = now()
    WHERE template_code = 'm3_opportunity_next_action';
  END IF;

  IF to_regclass('message.reminder_rules') IS NOT NULL THEN
    UPDATE message.reminder_rules
    SET status_code = 'disabled', updated_at = now()
    WHERE template_code = 'm3_opportunity_next_action'
       OR rule_code = 'm3_opportunity_next_action';
  END IF;
END $$;

COMMIT;
