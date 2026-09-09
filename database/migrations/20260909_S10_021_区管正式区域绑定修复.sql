-- 修复历史兼容账号仅保存展示区域、未保存正式区域编号的问题。
-- 仅处理启用区管、正式区域为空且展示区域与唯一有效区域精确匹配的账号。

BEGIN;

CREATE TABLE IF NOT EXISTS migration.region_manager_formal_region_repairs (
  user_id uuid PRIMARY KEY REFERENCES iam.users(id) ON DELETE RESTRICT,
  previous_region_id uuid NULL REFERENCES org.regions(id) ON DELETE RESTRICT,
  applied_region_id uuid NOT NULL REFERENCES org.regions(id) ON DELETE RESTRICT,
  matched_region_name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

WITH candidates AS (
  SELECT
    u.id AS user_id,
    MIN(r.id::text)::uuid AS applied_region_id,
    MIN(r.region_name) AS matched_region_name
  FROM iam.users u
  JOIN iam.user_roles ur ON ur.user_id = u.id
  JOIN iam.roles role ON role.id = ur.role_id
  JOIN org.regions r
    ON r.region_name = NULLIF(btrim(u.extra_json->>'region'), '')
   AND r.region_level = 'region'
   AND r.status_code = 'active'
  WHERE u.status_code = 'active'
    AND u.region_id IS NULL
    AND role.role_code = 'region_manager'
    AND role.status_code = 'active'
  GROUP BY u.id
  HAVING COUNT(DISTINCT r.id) = 1
), repairs AS (
  INSERT INTO migration.region_manager_formal_region_repairs (
    user_id,
    previous_region_id,
    applied_region_id,
    matched_region_name
  )
  SELECT user_id, NULL, applied_region_id, matched_region_name
  FROM candidates
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id, applied_region_id
)
UPDATE iam.users u
SET region_id = repairs.applied_region_id,
    updated_at = now(),
    row_version = u.row_version + 1
FROM repairs
WHERE u.id = repairs.user_id
  AND u.region_id IS NULL;

COMMIT;
