-- ============================================================
-- R02-001 回滚：撤销渠道组织编辑与证书业务角色联动
-- ============================================================

DROP INDEX IF EXISTS org.idx_member_business_roles_auto_cert;

ALTER TABLE org.member_business_roles
  DROP COLUMN IF EXISTS certification_id,
  DROP COLUMN IF EXISTS source_code;

ALTER TABLE org.business_roles
  DROP COLUMN IF EXISTS linked_certification_template_id;

ALTER TABLE org.regions
  DROP COLUMN IF EXISTS row_version;
