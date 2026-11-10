-- 回滚 S10.29：仅移除本次新增索引和订单质保字段。
-- 历史客户级质保保存在 crm.registrations.extra_json 中，本回滚不会删除。

BEGIN;

DROP INDEX IF EXISTS crm.idx_customers_normalized_credit_code;
DROP INDEX IF EXISTS crm.idx_orders_customer_warranty_end;

ALTER TABLE crm.orders
  DROP CONSTRAINT IF EXISTS orders_warranty_date_order_check;

ALTER TABLE crm.orders
  DROP COLUMN IF EXISTS warranty_updated_at,
  DROP COLUMN IF EXISTS warranty_updated_by_user_id,
  DROP COLUMN IF EXISTS warranty_manual_override,
  DROP COLUMN IF EXISTS maintenance_end_date,
  DROP COLUMN IF EXISTS maintenance_start_date,
  DROP COLUMN IF EXISTS warranty_end_date,
  DROP COLUMN IF EXISTS warranty_start_date;

COMMIT;
