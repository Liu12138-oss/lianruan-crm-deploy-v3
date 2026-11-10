-- 回退 S10-028：仅撤销本迁移实际记录且未被后续修改的部门绑定与账号区域。

BEGIN;

UPDATE iam.users u
SET region_id = 修复.previous_region_id,
    extra_json = u.extra_json || jsonb_build_object(
      'region', COALESCE(修复.previous_region_name, ''),
      'bigRegion', COALESCE(修复.previous_big_region_name, '')
    ),
    updated_at = now(),
    row_version = u.row_version + 1
FROM migration.staff_assignment_region_repairs 修复
WHERE u.id = 修复.user_id
  AND u.region_id = 修复.applied_region_id;

UPDATE org.org_units ou
SET region_id = 绑定.previous_region_id,
    updated_at = now(),
    row_version = ou.row_version + 1
FROM migration.org_unit_region_bindings 绑定
WHERE ou.id = 绑定.org_unit_id
  AND ou.region_id = 绑定.applied_region_id;

COMMIT;
