-- S10-008：组织停用归档交接安全加固。
-- 仅新增交接资格快照；不修改存量账号状态、业务归属、证书或角色授权。

ALTER TABLE org.offboarding_handover
  ADD COLUMN IF NOT EXISTS target_role_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS target_region_id uuid REFERENCES org.regions(id) ON DELETE SET NULL;

UPDATE org.offboarding_handover handover
SET target_role_codes = 快照.role_codes,
    target_region_id = COALESCE(用户.region_id, 主职.region_id)
FROM iam.users 用户
LEFT JOIN LATERAL (
  SELECT COALESCE(array_agg(角色.role_code ORDER BY 角色.role_code), ARRAY[]::text[]) AS role_codes
  FROM iam.user_roles 用户角色
  JOIN iam.roles 角色 ON 角色.id = 用户角色.role_id AND 角色.status_code = 'active'
  WHERE 用户角色.user_id = 用户.id
) 快照 ON true
LEFT JOIN LATERAL (
  SELECT 组织.region_id
  FROM org.staff_assignments 任职
  JOIN org.org_units 组织 ON 组织.id = 任职.org_unit_id
  WHERE 任职.user_id = 用户.id AND 任职.expired_at IS NULL
  ORDER BY 任职.is_primary DESC, 任职.effective_at DESC
  LIMIT 1
) 主职 ON true
WHERE handover.user_id = 用户.id
  AND cardinality(handover.target_role_codes) = 0;

COMMENT ON COLUMN org.offboarding_handover.target_role_codes IS
  '发起停用归档时的有效系统角色快照；后台任务据此复核接收人资格。';
COMMENT ON COLUMN org.offboarding_handover.target_region_id IS
  '发起停用归档时的账号有效区域快照；优先账号区域，其次主任职组织区域。';
