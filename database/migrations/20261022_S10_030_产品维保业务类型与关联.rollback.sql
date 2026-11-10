-- 回滚 S10.30：仅移除本次新增字段、索引和维保关联表。
-- 历史业务数据与消息投递记录保留，不删除。

BEGIN;

DROP TABLE IF EXISTS crm.maintenance_order_product_orders;
DROP TABLE IF EXISTS crm.maintenance_opportunity_product_orders;

DROP INDEX IF EXISTS crm.idx_orders_business_type;
DROP INDEX IF EXISTS crm.idx_quotes_business_type;
DROP INDEX IF EXISTS crm.idx_opportunities_business_type;

ALTER TABLE crm.orders
  DROP CONSTRAINT IF EXISTS orders_business_type_code_check,
  DROP COLUMN IF EXISTS business_type_code;

ALTER TABLE crm.quotes
  DROP CONSTRAINT IF EXISTS quotes_business_type_code_check,
  DROP COLUMN IF EXISTS business_type_code;

ALTER TABLE crm.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_business_type_code_check,
  DROP COLUMN IF EXISTS business_type_code;

DO $$
BEGIN
  IF to_regclass('message.reminder_templates') IS NOT NULL THEN
    UPDATE message.reminder_templates
    SET status_code = 'active', updated_at = now()
    WHERE template_code = 'm3_opportunity_next_action';
  END IF;

  IF to_regclass('message.reminder_rules') IS NOT NULL THEN
    UPDATE message.reminder_rules
    SET status_code = 'active', updated_at = now()
    WHERE template_code = 'm3_opportunity_next_action'
       OR rule_code = 'm3_opportunity_next_action';
  END IF;
END $$;

COMMIT;
