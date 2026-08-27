-- ============================================================
-- R02-001 渠道组织编辑与证书业务角色联动
-- 1. org.regions 增加乐观锁 row_version，支持区域名称/父级编辑
-- 2. org.business_roles 增加关联证书模板，颁发证书自动授予对应业务角色
-- 3. org.member_business_roles 增加授予来源（手工/证书自动）与关联证书
-- ============================================================

-- 1. 渠道区域表乐观锁
ALTER TABLE org.regions
  ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1;

-- 2. 业务角色可关联证书模板（一个角色关联一个证书，颁发即自动授予）
ALTER TABLE org.business_roles
  ADD COLUMN IF NOT EXISTS linked_certification_template_id uuid REFERENCES org.certification_templates(id);

-- 3. 成员业务角色来源与关联证书
ALTER TABLE org.member_business_roles
  ADD COLUMN IF NOT EXISTS source_code text NOT NULL DEFAULT 'manual'
    CHECK (source_code IN ('manual','auto_certification'));
ALTER TABLE org.member_business_roles
  ADD COLUMN IF NOT EXISTS certification_id uuid REFERENCES org.member_certifications(id);

-- 4. 索引：按来源与证书反查自动授予记录
CREATE INDEX IF NOT EXISTS idx_member_business_roles_auto_cert
  ON org.member_business_roles(certification_id) WHERE source_code = 'auto_certification';
