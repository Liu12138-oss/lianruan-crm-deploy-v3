-- ============================================================
-- R01-001 管理员角色与权限体系（RBAC 权限点补全 + 角色管理底座）
-- 1. iam.roles 扩展 description / extra_json（extra_json 承载 isSystem 等语义）
-- 2. 权限点补全：经营报表 / 审核中心 / 消息渠道 / 组织架构 / 账号管理
-- 3. 现有 resource:write 拆分为 resource:create/edit/delete，自动挂到原 write 角色（能力不缩水）
-- 4. superadmin 标记为系统内置角色（isSystem），不可编辑、不可停用、不可删除
-- ============================================================

-- 1. 角色表扩展
ALTER TABLE iam.roles
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS extra_json jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN iam.roles.description IS '角色描述（管理端维护）。';
COMMENT ON COLUMN iam.roles.extra_json IS
  '角色扩展语义：isSystem（系统内置角色）、builtinTemplate（内置模板标识）、defaultScopes（模板默认组织范围）。';

-- 2. 权限点补全：新增资源与动作
WITH permission_source(resource_code, action_code, permission_name) AS (
  VALUES
    ('report','read','查看经营报表'),
    ('review','read','查看审核中心'),
    ('review','approve','审核中心审批'),
    ('message','read','查看消息渠道'),
    ('message','admin','管理消息渠道'),
    ('organization','read','查看组织架构'),
    ('organization','create','新建组织部门'),
    ('organization','edit','编辑组织部门'),
    ('organization','delete','删除组织部门'),
    ('account','read','查看账号'),
    ('account','create','新建账号'),
    ('account','edit','编辑账号'),
    ('account','delete','删除账号')
)
INSERT INTO iam.permissions (permission_code, permission_name, resource_code, action_code)
SELECT resource_code || ':' || action_code, permission_name, resource_code, action_code
FROM permission_source
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name;

-- 3. 现有 write 权限点拆分：为每个资源补发 create/edit/delete 三个权限点
WITH split_source(resource_code, action_code, permission_name) AS (
  VALUES
    ('registration','create','新建客户报备'),
    ('registration','edit','编辑客户报备'),
    ('registration','delete','删除客户报备'),
    ('opportunity','create','新建商机'),
    ('opportunity','edit','编辑商机'),
    ('opportunity','delete','删除商机'),
    ('quote','create','新建报价'),
    ('quote','edit','编辑报价'),
    ('quote','delete','删除报价'),
    ('order','create','新建订单'),
    ('order','edit','编辑订单'),
    ('order','delete','删除订单'),
    ('partner','create','新建渠道商'),
    ('partner','edit','编辑渠道商'),
    ('partner','delete','删除渠道商'),
    ('catalog','create','新建产品目录'),
    ('catalog','edit','编辑产品目录'),
    ('catalog','delete','删除产品目录')
)
INSERT INTO iam.permissions (permission_code, permission_name, resource_code, action_code)
SELECT resource_code || ':' || action_code, permission_name, resource_code, action_code
FROM split_source
ON CONFLICT (permission_code) DO NOTHING;

-- 4. 拆分权限自动挂到原 write 已分配角色（角色能力不缩水）
INSERT INTO iam.role_permissions (role_id, permission_id)
SELECT rp.role_id, sp.id
FROM iam.role_permissions rp
JOIN iam.permissions wp ON wp.id = rp.permission_id AND wp.action_code = 'write'
JOIN iam.permissions sp ON sp.resource_code = wp.resource_code AND sp.action_code IN ('create','edit','delete')
ON CONFLICT DO NOTHING;

-- 5. 新增权限点挂到 superadmin / admin / region_manager（保持原有全量权限语义）
INSERT INTO iam.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM iam.roles r
JOIN iam.permissions p ON p.resource_code IN ('report','review','message','organization','account')
WHERE r.role_code IN ('superadmin','admin','region_manager')
ON CONFLICT DO NOTHING;

-- 6. superadmin 标记系统内置角色
UPDATE iam.roles
SET extra_json = extra_json || '{"isSystem":true,"builtinTemplate":"superadmin","defaultScopes":["all"]}'::jsonb
WHERE role_code = 'superadmin';
