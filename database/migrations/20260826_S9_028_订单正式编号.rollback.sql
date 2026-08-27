-- 阶段9.28 回退脚本。
-- 已生成的正式订单编号属于业务事实，不在回退时重编或删除。

BEGIN;

DROP INDEX IF EXISTS crm.idx_orders_region_confirmed_by_year;
DROP INDEX IF EXISTS crm.uq_orders_pre_region_order_no;
DROP TABLE IF EXISTS crm.region_manager_contract_counters;

ALTER TABLE crm.orders
  DROP COLUMN IF EXISTS contract_year,
  DROP COLUMN IF EXISTS contract_sequence,
  DROP COLUMN IF EXISTS country_calling_code_snapshot,
  DROP COLUMN IF EXISTS agreement_no_snapshot,
  DROP COLUMN IF EXISTS region_confirmed_username,
  DROP COLUMN IF EXISTS region_confirmed_email_prefix,
  DROP COLUMN IF EXISTS region_confirmed_at,
  DROP COLUMN IF EXISTS region_confirmed_by_user_id,
  DROP COLUMN IF EXISTS pre_region_order_no;

DROP INDEX IF EXISTS channel.uq_partners_agreement_no;
ALTER TABLE channel.partners
  DROP CONSTRAINT IF EXISTS ck_partners_country_calling_code_digits,
  DROP COLUMN IF EXISTS country_calling_code,
  DROP COLUMN IF EXISTS agreement_no;

COMMIT;
