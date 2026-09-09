-- 只回退本次迁移写入且之后未被人工调整的正式区域编号。

UPDATE iam.users u
SET region_id = repairs.previous_region_id,
    updated_at = now(),
    row_version = u.row_version + 1
FROM migration.region_manager_formal_region_repairs repairs
WHERE u.id = repairs.user_id
  AND u.region_id = repairs.applied_region_id;

DROP TABLE IF EXISTS migration.region_manager_formal_region_repairs;
