-- S10-011：组织成员一致性与停用归档授权留痕。
-- 本迁移只增加约束、审计快照和写入保护，不修改现有登录、单点登录或业务归属。

-- 1. 任职部门与岗位所属部门必须在所有写入路径保持一致。
-- 使用可延迟约束触发器，允许同一事务内按顺序调整任职，最终提交状态必须合法。
CREATE OR REPLACE FUNCTION org.enforce_assignment_consistency_trigger()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM org.staff_assignments WHERE id = NEW.id) THEN
    PERFORM org.assert_assignment_consistent(NEW.id);
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_assignments_consistency ON org.staff_assignments;
CREATE CONSTRAINT TRIGGER trg_staff_assignments_consistency
AFTER INSERT OR UPDATE ON org.staff_assignments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION org.enforce_assignment_consistency_trigger();

COMMENT ON FUNCTION org.enforce_assignment_consistency_trigger() IS
  '任职写入事务提交前强制校验部门与岗位归属，覆盖接口、导入、同步和管理账号归集路径。';

-- 2. 统一成员资料采用证书模板勾选语义：同一人员同一模板只能有一份有效证书。
-- 若存在历史重复数据则阻断迁移，禁止自动撤销或合并正式证书。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM org.member_certifications
    WHERE status_code = 'active'
    GROUP BY user_id, certification_template_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'ORG_CERTIFICATION_DUPLICATE_ACTIVE: 同一人员同一模板存在多份有效证书，请先导出并人工确认；迁移不会自动撤销正式证书';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_member_certifications_user_template_active
  ON org.member_certifications(user_id, certification_template_id)
  WHERE status_code = 'active';

COMMENT ON INDEX org.ux_member_certifications_user_template_active IS
  '统一成员资料按模板勾选授权；同一人员同一证书模板仅允许一份有效证书。';

-- 3. 证书与业务角色完全解耦。保留历史自动授予记录供审计，拒绝新增自动联动事实。
CREATE OR REPLACE FUNCTION org.reject_new_auto_certification_role()
RETURNS trigger AS $$
BEGIN
  IF NEW.source_code = 'auto_certification' THEN
    RAISE EXCEPTION 'ORG_CERTIFICATION_ROLE_LINK_DISABLED: 证书与业务角色已解耦，禁止新增证书自动授予角色记录';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_member_business_roles_reject_auto_certification
  ON org.member_business_roles;
CREATE TRIGGER trg_member_business_roles_reject_auto_certification
BEFORE INSERT OR UPDATE OF source_code, certification_id ON org.member_business_roles
FOR EACH ROW
WHEN (NEW.source_code = 'auto_certification')
EXECUTE FUNCTION org.reject_new_auto_certification_role();

COMMENT ON FUNCTION org.reject_new_auto_certification_role() IS
  '保留历史证书自动授予角色记录供只读审计，但禁止产生新的自动联动记录。';

-- 4. 停用归档前永久保存当前系统角色事实，撤销运行时授权后仍可审计和人工核对。
CREATE TABLE IF NOT EXISTS org.offboarding_role_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES org.offboarding_handover(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES iam.roles(id) ON DELETE RESTRICT,
  role_code text NOT NULL,
  role_name text NOT NULL,
  captured_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (handover_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_offboarding_role_snapshots_user
  ON org.offboarding_role_snapshots(user_id, captured_at DESC);

COMMENT ON TABLE org.offboarding_role_snapshots IS
  '停用归档发起时的系统角色完整快照；只作历史审计和人工恢复核对，不自动恢复授权。';
COMMENT ON COLUMN org.offboarding_role_snapshots.role_id IS
  '停用前实际授权的角色标识，用于区别同编码历史变更并保留可追溯依据。';

