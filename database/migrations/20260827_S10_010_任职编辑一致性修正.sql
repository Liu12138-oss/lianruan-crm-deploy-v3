-- S10-010：支持调整唯一有效任职，并修复空岗位的一致性校验。
-- 岗位为可选字段；只有选择岗位时，才要求岗位所属部门与任职部门一致。
-- 当前业务不支持一人多任职或跨部门任职；历史任职保留，但同一用户只能有一条未结束任职。

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM org.staff_assignments
    WHERE expired_at IS NULL
    GROUP BY user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'ORG_ASSIGNMENT_DUPLICATE_ACTIVE: 存在一人多条有效任职，请先导出明细并人工确认唯一任职；迁移不会自动删除或结束历史数据';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_staff_assignments_user_single_active
  ON org.staff_assignments(user_id)
  WHERE expired_at IS NULL;

CREATE OR REPLACE FUNCTION org.assert_assignment_consistent(p_assignment_id uuid)
RETURNS void AS $$
DECLARE
  v_assignment_unit uuid;
  v_position_id uuid;
  v_position_unit uuid;
BEGIN
  SELECT org_unit_id, position_id
    INTO v_assignment_unit, v_position_id
    FROM org.staff_assignments
   WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORG_ASSIGNMENT_NOT_FOUND: 任职不存在' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_position_id IS NULL THEN
    RETURN;
  END IF;

  SELECT org_unit_id
    INTO v_position_unit
    FROM org.positions
   WHERE id = v_position_id;

  IF v_position_unit IS NULL OR v_assignment_unit IS DISTINCT FROM v_position_unit THEN
    RAISE EXCEPTION 'ORG_POSITION_UNIT_MISMATCH: 岗位必须属于任职组织' USING ERRCODE = 'check_violation';
  END IF;
END $$ LANGUAGE plpgsql;

COMMENT ON FUNCTION org.assert_assignment_consistent(uuid) IS
  '校验任职部门与可选岗位所属部门一致；岗位为空时允许保存。';

COMMENT ON INDEX org.ux_staff_assignments_user_single_active IS
  '当前业务一人仅允许一条有效任职；调岗直接调整该记录，历史结束记录继续保留。';
