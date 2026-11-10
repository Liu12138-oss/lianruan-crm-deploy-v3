-- 回滚到 20260813_S10_001 中的原始防环函数定义。
BEGIN;

CREATE OR REPLACE FUNCTION org.assert_no_cycle(p_child_id uuid, p_new_parent_id uuid)
RETURNS void AS $$
DECLARE
  v_child_path ltree;
  v_new_parent_path ltree;
BEGIN
  IF p_new_parent_id IS NULL THEN
    RETURN;
  END IF;
  IF p_child_id = p_new_parent_id THEN
    RAISE EXCEPTION 'ORG_CYCLE: 不能将组织设为自身的父级'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT path_code INTO v_child_path FROM org.org_units WHERE id = p_child_id;
  SELECT path_code INTO v_new_parent_path FROM org.org_units WHERE id = p_new_parent_id;

  IF v_new_parent_path IS NULL OR v_child_path IS NULL THEN
    RETURN;
  END IF;

  IF v_child_path @> v_new_parent_path THEN
    RAISE EXCEPTION 'ORG_CYCLE: 禁止将组织 % 移到其祖先节点 % 下', p_child_id, p_new_parent_id
      USING ERRCODE = 'check_violation';
  END IF;
END $$ LANGUAGE plpgsql;

COMMENT ON FUNCTION org.assert_no_cycle IS '11.1 防环：移动组织前调用，禁止成环。';

COMMIT;
