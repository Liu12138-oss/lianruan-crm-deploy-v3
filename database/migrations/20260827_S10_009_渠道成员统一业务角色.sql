-- S10-009：组织架构、渠道商员工与企业管理员统一成员资料。
-- 业务角色仅收口“销售、技术”两类；企业管理员仍是独立渠道身份，不属于业务角色。
-- 证书继续按用户保存，颁发、到期、撤销均不自动改变业务角色或系统权限。

ALTER TABLE channel.partner_members
  ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- 已有同编码角色属于正式业务事实：若语义不一致则阻断迁移，禁止静默改名、改域或重新启用。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM org.business_roles
    WHERE role_code = 'internal_sales'
      AND (role_name <> '销售' OR domain_code <> 'internal' OR category <> 'sales' OR status_code <> 'active')
  ) OR EXISTS (
    SELECT 1
    FROM org.business_roles
    WHERE role_code = 'internal_technical'
      AND (role_name <> '技术' OR domain_code <> 'internal' OR category <> 'tech_engineer' OR status_code <> 'active')
  ) OR EXISTS (
    SELECT 1
    FROM org.business_roles
    WHERE role_code = 'channel_sales'
      AND (role_name <> '销售' OR domain_code <> 'channel' OR category <> 'sales' OR status_code <> 'active')
  ) OR EXISTS (
    SELECT 1
    FROM org.business_roles
    WHERE role_code = 'channel_technical'
      AND (role_name <> '技术' OR domain_code <> 'channel' OR category <> 'tech_engineer' OR status_code <> 'active')
  ) THEN
    RAISE EXCEPTION 'ORG_FIXED_BUSINESS_ROLE_CONFLICT: 销售或技术固定业务角色已存在但语义不一致，请先导出并人工确认；迁移不会覆盖正式角色';
  END IF;
END $$;

INSERT INTO org.business_roles (
  role_code, role_name, domain_code, category, status_code, description
)
VALUES
  ('internal_sales', '销售', 'internal', 'sales', 'active', '内部成员销售业务角色'),
  ('internal_technical', '技术', 'internal', 'tech_engineer', 'active', '内部成员技术业务角色'),
  ('channel_sales', '销售', 'channel', 'sales', 'active', '渠道成员销售业务角色'),
  ('channel_technical', '技术', 'channel', 'tech_engineer', 'active', '渠道成员技术业务角色')
ON CONFLICT (role_code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_partner_members_user_version
  ON channel.partner_members(user_id, row_version);

COMMENT ON COLUMN channel.partner_members.row_version IS
  '渠道成员资料乐观锁版本，组织架构、渠道商员工和企业管理员入口共用。';

COMMENT ON COLUMN channel.partner_members.archived_at IS
  '渠道成员从当前团队移除的时间；不物理删除，以保留角色、证书和业务历史。';

COMMENT ON COLUMN channel.partner_members.archive_reason IS
  '渠道成员移除原因，用于审计和人工恢复核对。';
