-- S10-001A：已执行 S10-001 后的增量约束修正。
-- 本迁移不改写历史迁移，也不接管既有账号、渠道或业务归属。

ALTER TABLE org.org_units
  ADD COLUMN IF NOT EXISTS channel_partner_id uuid REFERENCES channel.partners(id),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES iam.users(id),
  ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1;

ALTER TABLE channel.partner_members
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS effective_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_code text NOT NULL DEFAULT 'manual'
    CHECK (source_code IN ('manual','iam_sso','wecom')),
  ADD COLUMN IF NOT EXISTS sync_status_code text NOT NULL DEFAULT 'manual'
    CHECK (sync_status_code IN ('manual','not_synced','syncing','synced','sync_conflict','sync_failed')),
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES iam.users(id);

CREATE INDEX IF NOT EXISTS idx_org_units_channel_partner
  ON org.org_units(channel_partner_id) WHERE channel_partner_id IS NOT NULL;

-- 历史数据可能尚不满足新规则，先以 NOT VALID 增量落地；新写入立即受约束，清洗后再验证。
ALTER TABLE org.org_units DROP CONSTRAINT IF EXISTS org_units_domain_partner_check;
ALTER TABLE org.org_units ADD CONSTRAINT org_units_domain_partner_check
  CHECK (
    (unit_type IN ('channel_company','channel_department','channel_team') AND channel_partner_id IS NOT NULL)
    OR
    (unit_type NOT IN ('channel_company','channel_department','channel_team') AND channel_partner_id IS NULL)
  ) NOT VALID;

CREATE OR REPLACE FUNCTION org.assert_unit_parent_compatible(p_unit_id uuid, p_parent_unit_id uuid)
RETURNS void AS $$
DECLARE
  v_child_type text;
  v_child_partner uuid;
  v_parent_type text;
  v_parent_partner uuid;
BEGIN
  IF p_parent_unit_id IS NULL THEN RETURN; END IF;
  SELECT unit_type, channel_partner_id INTO v_child_type, v_child_partner FROM org.org_units WHERE id = p_unit_id;
  SELECT unit_type, channel_partner_id INTO v_parent_type, v_parent_partner FROM org.org_units WHERE id = p_parent_unit_id;
  IF v_child_type IS NULL OR v_parent_type IS NULL THEN
    RAISE EXCEPTION 'ORG_UNIT_NOT_FOUND: 组织不存在' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF (v_child_type IN ('channel_company','channel_department','channel_team'))
     <> (v_parent_type IN ('channel_company','channel_department','channel_team')) THEN
    RAISE EXCEPTION 'ORG_DOMAIN_MISMATCH: 内部组织与渠道组织不能互为父子' USING ERRCODE = 'check_violation';
  END IF;
  IF v_child_type IN ('channel_company','channel_department','channel_team')
     AND v_child_partner IS DISTINCT FROM v_parent_partner THEN
    RAISE EXCEPTION 'ORG_PARTNER_MISMATCH: 渠道组织父子节点必须属于同一渠道商' USING ERRCODE = 'check_violation';
  END IF;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION org.assert_assignment_consistent(p_assignment_id uuid)
RETURNS void AS $$
DECLARE
  v_assignment_unit uuid;
  v_position_unit uuid;
BEGIN
  SELECT org_unit_id, position_id INTO v_assignment_unit, v_position_unit FROM org.staff_assignments WHERE id = p_assignment_id;
  SELECT org_unit_id INTO v_position_unit FROM org.positions WHERE id = v_position_unit;
  IF v_assignment_unit IS DISTINCT FROM v_position_unit THEN
    RAISE EXCEPTION 'ORG_POSITION_UNIT_MISMATCH: 岗位必须属于任职组织' USING ERRCODE = 'check_violation';
  END IF;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION org.rebuild_unit_paths()
RETURNS void AS $$
BEGIN
  WITH RECURSIVE tree AS (
    SELECT id, ''::ltree AS path_code
      FROM org.org_units WHERE parent_unit_id IS NULL
    UNION ALL
    SELECT child.id, tree.path_code || text2ltree(replace(replace(child.unit_code, '/', '_'), '.', '_'))
      FROM org.org_units child JOIN tree ON child.parent_unit_id = tree.id
  )
  UPDATE org.org_units unit SET path_code = tree.path_code FROM tree WHERE unit.id = tree.id;
END $$ LANGUAGE plpgsql;

CREATE UNIQUE INDEX IF NOT EXISTS uq_manager_relations_direct_active
  ON org.manager_relations(subordinate_assignment_id)
  WHERE relation_type = 'direct' AND expired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_members_primary_active
  ON channel.partner_members(user_id) WHERE is_primary AND expired_at IS NULL;
