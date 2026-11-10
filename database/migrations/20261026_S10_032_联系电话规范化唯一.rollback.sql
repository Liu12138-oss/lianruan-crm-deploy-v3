DROP INDEX IF EXISTS iam.ux_users_phone_normalized_unique;

CREATE UNIQUE INDEX ux_users_phone_normalized_unique
  ON iam.users (regexp_replace(COALESCE(phone, ''), '[^0-9]+', '', 'g'))
  WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]+', '', 'g') <> '';

DROP FUNCTION IF EXISTS iam.normalize_phone(text);
