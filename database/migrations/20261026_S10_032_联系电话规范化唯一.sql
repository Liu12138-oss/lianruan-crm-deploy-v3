-- 统一联系电话唯一口径：去除格式字符，并把中国大陆 0086/86 区号换算为本地 11 位号码。
CREATE OR REPLACE FUNCTION iam.normalize_phone(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN digits = '' THEN NULL
    WHEN digits ~ '^0086[0-9]{11}$' THEN substring(digits FROM 5)
    WHEN digits ~ '^86[0-9]{11}$' THEN substring(digits FROM 3)
    ELSE digits
  END
  FROM (
    SELECT regexp_replace(COALESCE(value, ''), '[^0-9]+', '', 'g') AS digits
  ) normalized;
$$;

DROP INDEX IF EXISTS iam.ux_users_phone_normalized_unique;

CREATE UNIQUE INDEX ux_users_phone_normalized_unique
  ON iam.users (iam.normalize_phone(phone))
  WHERE iam.normalize_phone(phone) IS NOT NULL
    AND iam.normalize_phone(phone) <> '';
