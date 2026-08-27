-- 阶段9.25：恢复被旧版兼容保存接口明确写坏的 V2 区域管理员账号。
-- 仅处理原始 V2 角色为 admin、原登录名不等于 V2 编号、当前登录名却被改为该编号的记录。
-- 不回写姓名、区域、状态等可能被后续业务正常维护过的字段。

BEGIN;

CREATE TABLE IF NOT EXISTS migration.v2_region_manager_account_repairs (
  user_id uuid PRIMARY KEY REFERENCES iam.users(id) ON DELETE CASCADE,
  v2_source_id text NOT NULL UNIQUE,
  action_code text NOT NULL CHECK (action_code IN ('restored', 'skipped_username_conflict')),
  source_username text NOT NULL,
  source_phone text,
  source_email text,
  previous_username text NOT NULL,
  previous_phone text,
  previous_email text,
  previous_extra_json jsonb NOT NULL,
  had_region_manager_role boolean NOT NULL,
  restored_phone boolean NOT NULL DEFAULT false,
  restored_email boolean NOT NULL DEFAULT false,
  repaired_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE migration.v2_region_manager_account_repairs IS
  '阶段9.25 V2区域管理员账号恢复审计。仅记录由原始V2快照可明确判定的旧保存覆盖异常。';

INSERT INTO iam.roles (role_code, role_name, status_code)
VALUES ('region_manager', '区域管理员', 'active')
ON CONFLICT (role_code) DO UPDATE
SET role_name = EXCLUDED.role_name,
    status_code = EXCLUDED.status_code;

WITH 原始V2区域管理员 AS (
  SELECT DISTINCT ON (r.source_id)
    r.source_id,
    NULLIF(btrim(migration.v2_data(r.redacted_json)->>'username'), '') AS source_username,
    NULLIF(btrim(migration.v2_data(r.redacted_json)->>'phone'), '') AS source_phone,
    NULLIF(btrim(migration.v2_data(r.redacted_json)->>'email'), '') AS source_email
  FROM migration.v2_raw_records r
  WHERE r.entity_name = 'users'
    AND COALESCE(migration.v2_data(r.redacted_json)->>'role', '') = 'admin'
  ORDER BY r.source_id, r.source_updated_at DESC NULLS LAST, r.created_at DESC
),
明确异常账号 AS (
  SELECT
    u.id AS user_id,
    u.v2_source_id,
    v.source_username,
    v.source_phone,
    v.source_email,
    u.username::text AS previous_username,
    u.phone AS previous_phone,
    u.email::text AS previous_email,
    u.extra_json AS previous_extra_json,
    EXISTS (
      SELECT 1
      FROM iam.user_roles ur
      JOIN iam.roles role ON role.id = ur.role_id
      WHERE ur.user_id = u.id
        AND role.role_code = 'region_manager'
    ) AS had_region_manager_role,
    EXISTS (
      SELECT 1
      FROM iam.users conflict_user
      WHERE conflict_user.id <> u.id
        AND lower(conflict_user.username::text) = lower(v.source_username)
    ) AS username_conflict,
    CASE
      WHEN NULLIF(btrim(COALESCE(u.phone, '')), '') IS NULL
       AND v.source_phone IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM iam.users phone_user
         WHERE phone_user.id <> u.id
           AND regexp_replace(COALESCE(phone_user.phone, ''), '[^0-9]+', '', 'g') =
               regexp_replace(v.source_phone, '[^0-9]+', '', 'g')
       )
      THEN true
      ELSE false
    END AS can_restore_phone,
    CASE
      WHEN NULLIF(btrim(COALESCE(u.email::text, '')), '') IS NULL
       AND v.source_email IS NOT NULL
      THEN true
      ELSE false
    END AS can_restore_email
  FROM iam.users u
  JOIN 原始V2区域管理员 v ON v.source_id = u.v2_source_id
  WHERE u.v2_source_id IS NOT NULL
    AND v.source_username IS NOT NULL
    AND lower(v.source_username) <> lower(u.v2_source_id)
    AND lower(u.username::text) = lower(u.v2_source_id)
),
已审计异常账号 AS (
  INSERT INTO migration.v2_region_manager_account_repairs (
    user_id,
    v2_source_id,
    action_code,
    source_username,
    source_phone,
    source_email,
    previous_username,
    previous_phone,
    previous_email,
    previous_extra_json,
    had_region_manager_role,
    restored_phone,
    restored_email
  )
  SELECT
    user_id,
    v2_source_id,
    CASE WHEN username_conflict THEN 'skipped_username_conflict' ELSE 'restored' END,
    source_username,
    source_phone,
    source_email,
    previous_username,
    previous_phone,
    previous_email,
    previous_extra_json,
    had_region_manager_role,
    can_restore_phone,
    can_restore_email
  FROM 明确异常账号
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id, action_code, source_username, source_phone, source_email, restored_phone, restored_email
),
已恢复账号 AS (
  UPDATE iam.users u
  SET username = audited.source_username::citext,
      phone = CASE WHEN audited.restored_phone THEN audited.source_phone ELSE u.phone END,
      email = CASE WHEN audited.restored_email THEN audited.source_email::citext ELSE u.email END,
      updated_at = now(),
      extra_json = u.extra_json || jsonb_build_object(
        'username', audited.source_username,
        'role', 'admin'
      )
  FROM 已审计异常账号 audited
  WHERE u.id = audited.user_id
    AND audited.action_code = 'restored'
  RETURNING u.id
)
INSERT INTO iam.user_roles (user_id, role_id)
SELECT restored.id, role.id
FROM 已恢复账号 restored
JOIN iam.roles role ON role.role_code = 'region_manager'
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  restored_count integer;
  skipped_count integer;
BEGIN
  SELECT COUNT(*) FILTER (WHERE action_code = 'restored'),
         COUNT(*) FILTER (WHERE action_code = 'skipped_username_conflict')
  INTO restored_count, skipped_count
  FROM migration.v2_region_manager_account_repairs;

  RAISE NOTICE '阶段9.25 V2区域管理员账号恢复完成：已恢复%，因登录名冲突跳过%。', restored_count, skipped_count;
END;
$$;

INSERT INTO migration.schema_migrations (version, description, checksum_sha256)
VALUES (
  '20260817_S9_025_V2区域管理员账号恢复',
  '阶段9.25 V2区域管理员账号恢复',
  '由KB-20260817-024执行并记录'
)
ON CONFLICT (version) DO UPDATE
SET description = EXCLUDED.description,
    applied_at = now();

COMMIT;
