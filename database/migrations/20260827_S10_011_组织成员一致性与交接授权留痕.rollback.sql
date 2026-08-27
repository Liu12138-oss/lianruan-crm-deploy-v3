-- S10-011 安全回退：撤销新增写入约束，保留已经产生的交接角色快照。
-- 角色快照属于停用归档审计事实，禁止在应用回退时删除。

DROP TRIGGER IF EXISTS trg_member_business_roles_reject_auto_certification
  ON org.member_business_roles;
DROP FUNCTION IF EXISTS org.reject_new_auto_certification_role();

DROP INDEX IF EXISTS org.ux_member_certifications_user_template_active;

DROP TRIGGER IF EXISTS trg_staff_assignments_consistency ON org.staff_assignments;
DROP FUNCTION IF EXISTS org.enforce_assignment_consistency_trigger();

DO $$
BEGIN
  RAISE NOTICE 'S10-011 已撤销新增写入约束；org.offboarding_role_snapshots 及其审计事实继续保留。';
END $$;

