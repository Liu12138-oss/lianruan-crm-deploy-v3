-- ============================================================
-- S10-001 回滚脚本（KB-20260813）
-- 反向顺序：视图 → 函数 → 表 → iam.users 字段
-- 警告：此脚本会删除 11.1/11.2 全部新增对象与字段，回滚前请确认无业务依赖。
-- ============================================================

-- 1. 视图
DROP VIEW IF EXISTS org.v_org_units_active_tree;

-- 2. 函数
DROP FUNCTION IF EXISTS org.assert_archivable(uuid);
DROP FUNCTION IF EXISTS org.assert_no_cycle(uuid, uuid);

-- 3. 索引（PostgreSQL 会随表删除自动删索引，但显式列出便于审计）
DROP INDEX IF EXISTS org.idx_manager_relations_mgr_active;
DROP INDEX IF EXISTS org.idx_manager_relations_sub_active;
DROP INDEX IF EXISTS org.idx_staff_assignments_sync;
DROP INDEX IF EXISTS org.idx_staff_assignments_manager;
DROP INDEX IF EXISTS org.idx_staff_assignments_org_unit_active;
DROP INDEX IF EXISTS org.idx_staff_assignments_user_active;
DROP INDEX IF EXISTS org.idx_positions_org_unit_status;
DROP INDEX IF EXISTS org.idx_org_units_sync_status;
DROP INDEX IF EXISTS org.idx_org_units_parent;
DROP INDEX IF EXISTS org.idx_org_units_unit_type_status;
DROP INDEX IF EXISTS org.idx_org_units_path_code_gist;

-- 4. 表（含外键依赖，按反向顺序）
-- 4.0 先解 org.org_units → org.staff_assignments 的外键
ALTER TABLE org.org_units DROP CONSTRAINT IF EXISTS fk_org_units_manager_assignment;

-- 4.1 解 org.staff_assignments → org.positions 的外键（CASCADE 一并清理）
DROP TABLE IF EXISTS org.manager_relations CASCADE;
DROP TABLE IF EXISTS org.staff_assignments CASCADE;
DROP TABLE IF EXISTS org.positions CASCADE;

-- 5. org.org_units 字段（外键依赖先解）
ALTER TABLE org.org_units DROP CONSTRAINT IF EXISTS fk_org_units_manager_assignment;
ALTER TABLE org.org_units DROP COLUMN IF EXISTS manager_assignment_id;
ALTER TABLE org.org_units DROP COLUMN IF EXISTS last_synced_at;
ALTER TABLE org.org_units DROP COLUMN IF EXISTS sync_status_code;
ALTER TABLE org.org_units DROP COLUMN IF EXISTS source_external_id;
ALTER TABLE org.org_units DROP COLUMN IF EXISTS source_code;
ALTER TABLE org.org_units DROP COLUMN IF EXISTS expired_at;
ALTER TABLE org.org_units DROP COLUMN IF EXISTS effective_at;
ALTER TABLE org.org_units DROP COLUMN IF EXISTS sort_order;
ALTER TABLE org.org_units DROP COLUMN IF EXISTS path_code;
ALTER TABLE org.org_units DROP COLUMN IF EXISTS unit_type;
-- 恢复原 status_code CHECK
DO $$
BEGIN
  ALTER TABLE org.org_units DROP CONSTRAINT IF EXISTS org_org_units_status_code_check;
  ALTER TABLE org.org_units
    ADD CONSTRAINT org_org_units_status_code_check
    CHECK (status_code IN ('active','disabled'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'S10-001 回滚：恢复 org_units status_code 约束失败，可能有数据违反原约束';
END $$;

-- 6. iam.users 字段（D-07 + D-10）
ALTER TABLE iam.users DROP COLUMN IF EXISTS offboarding_handover_id;
ALTER TABLE iam.users DROP COLUMN IF EXISTS offboarding_status;
DROP INDEX IF EXISTS iam.idx_users_offboarding_status;
DROP INDEX IF EXISTS iam.idx_users_origin_sync;
DROP INDEX IF EXISTS iam.idx_users_origin;
ALTER TABLE iam.users DROP COLUMN IF EXISTS origin_sync_status;
ALTER TABLE iam.users DROP COLUMN IF EXISTS origin_synced_at;
ALTER TABLE iam.users DROP COLUMN IF EXISTS origin_external_id;
ALTER TABLE iam.users DROP COLUMN IF EXISTS origin_code;

-- 7. 扩展（如其他脚本仍需 ltree/btree_gist，不要 DROP EXTENSION，留待最终清理）
-- CREATE EXTENSION IF NOT EXISTS ltree;
-- CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  RAISE NOTICE 'S10-001 回滚完成';
END $$;
