-- ============================================================
-- R01-001 回滚：撤销 RBAC 权限点补全与角色管理底座
-- 1. 删除拆分与新增权限点的角色绑定
-- 2. 删除拆分与新增权限点
-- 3. 还原 superadmin 系统内置标记
-- 4. 删除 iam.roles 扩展列（本迁移新增）
-- ============================================================

-- 1. 删除本迁移新增权限点的角色绑定
DELETE FROM iam.role_permissions rp
USING iam.permissions p
WHERE rp.permission_id = p.id
  AND (
    p.resource_code IN ('report','review','message','organization','account')
    OR p.action_code IN ('create','edit','delete')
  );

-- 2. 删除本迁移新增权限点
DELETE FROM iam.permissions
WHERE resource_code IN ('report','review','message','organization','account')
   OR action_code IN ('create','edit','delete');

-- 3. 还原 superadmin 系统内置标记
UPDATE iam.roles
SET extra_json = extra_json - 'isSystem' - 'builtinTemplate' - 'defaultScopes'
WHERE role_code = 'superadmin';

-- 4. 删除扩展列
ALTER TABLE iam.roles
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS extra_json;
