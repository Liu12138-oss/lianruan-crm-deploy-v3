-- 阶段9.28：订单在区管确认或调价后生成正式编号。
-- 前置 LS 编号保留在 pre_region_order_no，正式编号继续使用 order_no 对外展示。

BEGIN;

ALTER TABLE channel.partners
  ADD COLUMN IF NOT EXISTS agreement_no text,
  ADD COLUMN IF NOT EXISTS country_calling_code text NOT NULL DEFAULT '86';

UPDATE channel.partners
SET country_calling_code = '86'
WHERE NULLIF(regexp_replace(COALESCE(country_calling_code, ''), '\\D', '', 'g'), '') IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_partners_country_calling_code_digits'
      AND conrelid = 'channel.partners'::regclass
  ) THEN
    ALTER TABLE channel.partners
      ADD CONSTRAINT ck_partners_country_calling_code_digits
      CHECK (country_calling_code ~ '^[0-9]{1,3}$');
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_partners_agreement_no
  ON channel.partners (agreement_no)
  WHERE NULLIF(btrim(agreement_no), '') IS NOT NULL;

ALTER TABLE crm.orders
  ADD COLUMN IF NOT EXISTS pre_region_order_no text,
  ADD COLUMN IF NOT EXISTS region_confirmed_by_user_id uuid REFERENCES iam.users(id),
  ADD COLUMN IF NOT EXISTS region_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS region_confirmed_email_prefix text,
  ADD COLUMN IF NOT EXISTS region_confirmed_username text,
  ADD COLUMN IF NOT EXISTS agreement_no_snapshot text,
  ADD COLUMN IF NOT EXISTS country_calling_code_snapshot text,
  ADD COLUMN IF NOT EXISTS contract_sequence integer,
  ADD COLUMN IF NOT EXISTS contract_year integer;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_pre_region_order_no
  ON crm.orders (pre_region_order_no)
  WHERE pre_region_order_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_region_confirmed_by_year
  ON crm.orders (region_confirmed_by_user_id, contract_year, contract_sequence)
  WHERE region_confirmed_by_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm.region_manager_contract_counters (
  region_manager_user_id uuid NOT NULL REFERENCES iam.users(id),
  contract_year integer NOT NULL CHECK (contract_year BETWEEN 2000 AND 9999),
  current_value integer NOT NULL CHECK (current_value > 0),
  PRIMARY KEY (region_manager_user_id, contract_year)
);

COMMENT ON COLUMN channel.partners.agreement_no IS '渠道商唯一有效协议编号；区管确认或调价生成正式订单编号时必填。';
COMMENT ON COLUMN channel.partners.country_calling_code IS '渠道商所属国家电话区号，保存原始数字，展示时左补零至三位。';
COMMENT ON COLUMN crm.orders.pre_region_order_no IS '区管确认前的 LS 前置订单编号；生成正式编号后永久保留用于追溯和查询。';
COMMENT ON TABLE crm.region_manager_contract_counters IS '区管用户按自然年递增的合同编号计数器；从 01 开始且不回收。';

COMMIT;
