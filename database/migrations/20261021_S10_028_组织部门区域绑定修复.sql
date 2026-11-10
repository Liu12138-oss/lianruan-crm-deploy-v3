-- 修复内部部门未绑定正式区域导致区管调岗后数据范围丢失的问题。
-- 仅对启用中、区域级、名称精确且唯一匹配的部门执行绑定，不做模糊猜测。

BEGIN;

CREATE TABLE IF NOT EXISTS migration.org_unit_region_bindings (
  org_unit_id uuid PRIMARY KEY REFERENCES org.org_units(id) ON DELETE RESTRICT,
  previous_region_id uuid NULL REFERENCES org.regions(id) ON DELETE RESTRICT,
  applied_region_id uuid NOT NULL REFERENCES org.regions(id) ON DELETE RESTRICT,
  matched_region_name text NOT NULL,
  bound_at timestamptz NOT NULL DEFAULT now(),
  CHECK (previous_region_id IS NULL OR previous_region_id <> applied_region_id)
);

CREATE TABLE IF NOT EXISTS migration.staff_assignment_region_repairs (
  user_id uuid PRIMARY KEY REFERENCES iam.users(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES org.staff_assignments(id) ON DELETE RESTRICT,
  previous_region_id uuid NULL REFERENCES org.regions(id) ON DELETE RESTRICT,
  applied_region_id uuid NOT NULL REFERENCES org.regions(id) ON DELETE RESTRICT,
  previous_region_name text NULL,
  previous_big_region_name text NULL,
  repaired_at timestamptz NOT NULL DEFAULT now(),
  CHECK (previous_region_id IS NULL OR previous_region_id <> applied_region_id)
);

WITH 唯一匹配 AS (
  SELECT
    ou.id AS org_unit_id,
    min(r.id::text)::uuid AS applied_region_id,
    min(r.region_name) AS matched_region_name
  FROM org.org_units ou
  JOIN org.regions r
    ON r.region_level = 'region'
   AND r.status_code = 'active'
   AND btrim(r.region_name) = btrim(ou.unit_name)
  WHERE ou.unit_type NOT LIKE 'channel_%'
    AND ou.region_id IS NULL
  GROUP BY ou.id
  HAVING count(*) = 1
), 记录 AS (
  INSERT INTO migration.org_unit_region_bindings (
    org_unit_id,
    previous_region_id,
    applied_region_id,
    matched_region_name
  )
  SELECT org_unit_id, NULL, applied_region_id, matched_region_name
  FROM 唯一匹配
  ON CONFLICT (org_unit_id) DO NOTHING
  RETURNING org_unit_id, applied_region_id
)
UPDATE org.org_units ou
SET region_id = 记录.applied_region_id,
    updated_at = now(),
    row_version = ou.row_version + 1
FROM 记录
WHERE ou.id = 记录.org_unit_id
  AND ou.region_id IS NULL;

WITH 候选 AS (
  SELECT
    u.id AS user_id,
    sa.id AS assignment_id,
    u.region_id AS previous_region_id,
    ou.region_id AS applied_region_id,
    NULLIF(btrim(u.extra_json->>'region'), '') AS previous_region_name,
    NULLIF(btrim(u.extra_json->>'bigRegion'), '') AS previous_big_region_name
  FROM iam.users u
  JOIN org.staff_assignments sa
    ON sa.user_id = u.id
   AND sa.expired_at IS NULL
  JOIN org.org_units ou
    ON ou.id = sa.org_unit_id
   AND ou.unit_type NOT LIKE 'channel_%'
  JOIN iam.user_roles ur ON ur.user_id = u.id
  JOIN iam.roles role ON role.id = ur.role_id
   AND role.status_code = 'active'
  WHERE u.status_code = 'active'
    AND ou.region_id IS NOT NULL
    AND role.role_code IN ('admin', 'region_manager')
    AND u.region_id IS DISTINCT FROM ou.region_id
    AND NOT EXISTS (
      SELECT 1
      FROM iam.user_roles 超管任职
      JOIN iam.roles 超管角色 ON 超管角色.id = 超管任职.role_id
      WHERE 超管任职.user_id = u.id
        AND 超管角色.role_code = 'superadmin'
        AND 超管角色.status_code = 'active'
    )
), 记录账号 AS (
  INSERT INTO migration.staff_assignment_region_repairs (
    user_id,
    assignment_id,
    previous_region_id,
    applied_region_id,
    previous_region_name,
    previous_big_region_name
  )
  SELECT
    user_id,
    assignment_id,
    previous_region_id,
    applied_region_id,
    previous_region_name,
    previous_big_region_name
  FROM 候选
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id, applied_region_id
)
UPDATE iam.users u
SET region_id = 记录账号.applied_region_id,
    extra_json = u.extra_json || jsonb_build_object(
      'region', COALESCE(区域.region_name, ''),
      'bigRegion', COALESCE(大区.region_name, '')
    ),
    updated_at = now(),
    row_version = u.row_version + 1
FROM 记录账号
JOIN org.regions 区域 ON 区域.id = 记录账号.applied_region_id
LEFT JOIN org.regions 大区 ON 大区.id = 区域.parent_region_id
WHERE u.id = 记录账号.user_id
  AND u.region_id IS DISTINCT FROM 记录账号.applied_region_id;

COMMIT;
