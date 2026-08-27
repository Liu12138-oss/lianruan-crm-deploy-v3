-- 阶段9.25回退：仅回退仍保持本迁移写入结果的账号，避免覆盖后续人工维护。

BEGIN;

WITH 可安全回退账号 AS (
  SELECT repair.*
  FROM migration.v2_region_manager_account_repairs repair
  JOIN iam.users u ON u.id = repair.user_id
  WHERE repair.action_code = 'restored'
    AND lower(u.username::text) = lower(repair.source_username)
    AND u.extra_json->>'role' = 'admin'
),
已回退账号 AS (
  UPDATE iam.users u
  SET username = repair.previous_username::citext,
      phone = repair.previous_phone,
      email = repair.previous_email::citext,
      extra_json = repair.previous_extra_json,
      updated_at = now()
  FROM 可安全回退账号 repair
  WHERE u.id = repair.user_id
  RETURNING u.id
)
DELETE FROM iam.user_roles ur
USING 已回退账号 reverted
JOIN migration.v2_region_manager_account_repairs repair ON repair.user_id = reverted.id
JOIN iam.roles role ON role.role_code = 'region_manager'
WHERE ur.user_id = reverted.id
  AND ur.role_id = role.id
  AND NOT repair.had_region_manager_role;

COMMIT;
