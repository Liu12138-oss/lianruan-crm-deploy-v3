-- 阶段9.29：地市区号按渠道商城市生成，兼容 2 至 4 位区号。
-- 已有正式订单编号不重编；本迁移只调整渠道商区号字段校验和说明。

BEGIN;

ALTER TABLE channel.partners
  DROP CONSTRAINT IF EXISTS ck_partners_country_calling_code_digits,
  ALTER COLUMN country_calling_code DROP NOT NULL,
  ALTER COLUMN country_calling_code DROP DEFAULT;

UPDATE channel.partners
SET country_calling_code = NULL
WHERE country_calling_code = '86';

UPDATE channel.partners
SET extra_json = extra_json - 'countryCallingCode'
WHERE extra_json->>'countryCallingCode' = '86';

ALTER TABLE channel.partners
  ADD CONSTRAINT ck_partners_country_calling_code_digits
  CHECK (country_calling_code IS NULL OR country_calling_code ~ '^[0-9]{2,4}$');

COMMENT ON COLUMN channel.partners.country_calling_code IS
  '渠道商地市电话区号兜底值，可为空；维护时须为 2 至 4 位数字，正式订单编号中不足三位时左补零，三位和四位保持不变。';

COMMIT;
