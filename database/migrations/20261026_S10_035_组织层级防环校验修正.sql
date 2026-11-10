-- 修正组织层级防环判断：只有新父级位于当前节点子树中时才构成环。
BEGIN;

CREATE OR REPLACE FUNCTION org.assert_no_cycle(p_child_id uuid, p_new_parent_id uuid)
RETURNS void AS $$
DECLARE
  v_would_cycle boolean;
BEGIN
  IF p_new_parent_id IS NULL THEN
    RETURN;
  END IF;
  IF p_child_id = p_new_parent_id THEN
    RAISE EXCEPTION 'ORG_CYCLE: 不能将组织设为自身的父级'
      USING ERRCODE = 'check_violation';
  END IF;

  WITH RECURSIVE descendants AS (
    SELECT id FROM org.org_units WHERE parent_unit_id = p_child_id
    UNION ALL
    SELECT child.id
      FROM org.org_units child
      JOIN descendants parent ON child.parent_unit_id = parent.id
  )
  SELECT EXISTS(SELECT 1 FROM descendants WHERE id = p_new_parent_id)
    INTO v_would_cycle;

  IF v_would_cycle THEN
    RAISE EXCEPTION 'ORG_CYCLE: 禁止将组织 % 移到其子级节点 % 下', p_child_id, p_new_parent_id
      USING ERRCODE = 'check_violation';
  END IF;
END $$ LANGUAGE plpgsql;

COMMENT ON FUNCTION org.assert_no_cycle IS '组织移动防环：新父级不得位于当前节点的子树中。';

COMMIT;
