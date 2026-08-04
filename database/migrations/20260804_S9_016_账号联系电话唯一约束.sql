-- V3账号联系电话唯一约束。
-- 规则：去掉非数字字符后，非空联系电话在所有账号中必须唯一。

DO $$
DECLARE
  duplicate_phone text;
BEGIN
  SELECT normalized_phone
  INTO duplicate_phone
  FROM (
    SELECT regexp_replace(COALESCE(phone, ''), '[^0-9]+', '', 'g') AS normalized_phone
    FROM iam.users
  ) phones
  WHERE normalized_phone <> ''
  GROUP BY normalized_phone
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_phone IS NOT NULL THEN
    RAISE EXCEPTION '账号联系电话存在重复，无法启用唯一校验：%', duplicate_phone;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone_normalized_unique
ON iam.users ((regexp_replace(COALESCE(phone, ''), '[^0-9]+', '', 'g')))
WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]+', '', 'g') <> '';
