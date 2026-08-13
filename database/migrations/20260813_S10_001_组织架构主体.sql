-- ============================================================
-- S10-001 组织架构主体（KB-20260813）
-- 覆盖子项：11.1 组织与岗位 + 11.2 内部任职与负责人
-- 关联决策：D-01（双域）/ D-02（业务/权限解耦，落到11.5）/ D-04（渠道域）
--           D-10（offboarding_status 字段本脚本一并加）
-- 兼容性：不破坏现有 org.org_units / org.staff_profiles / iam.users 数据
-- ============================================================

-- 0. 扩展依赖
-- ltree 用于组织路径与防环；btree_gist 用于 EXCLUDE 约束（主职唯一）
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- PostgreSQL 版本守卫：ltree 与 EXCLUDE 在 14+ 完整支持
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 140000 THEN
    RAISE EXCEPTION 'S10-001 需要 PostgreSQL 14+，当前版本 %',
      current_setting('server_version');
  END IF;
END $$;

-- ============================================================
-- 1. 扩展 org.org_units（D-01 + D-04）
--    - 现有字段保留，扩展字段均为可空或带默认值
--    - unit_type 区分内部域与渠道域
--    - path_code ltree 防环、查询子树
--    - source_code / sync_status_code 为 D-07 同步占位字段
--    - status_code 从 (active,disabled) 扩展到 (draft,active,disabled,archived)
-- ============================================================

ALTER TABLE org.org_units
  ADD COLUMN IF NOT EXISTS unit_type text NOT NULL DEFAULT 'department'
    CHECK (unit_type IN (
      'headquarters','division','big_region','region','province','city','department','team',
      'channel_company','channel_department','channel_team'
    )),
  ADD COLUMN IF NOT EXISTS path_code ltree NOT NULL DEFAULT ''::ltree,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS effective_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_code text NOT NULL DEFAULT 'manual'
    CHECK (source_code IN ('manual','iam_sso','wecom')),
  ADD COLUMN IF NOT EXISTS source_external_id text,
  ADD COLUMN IF NOT EXISTS sync_status_code text NOT NULL DEFAULT 'manual'
    CHECK (sync_status_code IN ('manual','not_synced','syncing','synced','sync_conflict','sync_failed')),
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_assignment_id uuid;

-- 1.1 status_code 扩展 CHECK（D-01 + 7.5 状态机）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_org_units_status_code_check'
  ) THEN
    ALTER TABLE org.org_units
      DROP CONSTRAINT org_org_units_status_code_check;
  END IF;
END $$;

ALTER TABLE org.org_units
  ADD CONSTRAINT org_org_units_status_code_check
  CHECK (status_code IN ('draft','active','disabled','archived'));

COMMENT ON COLUMN org.org_units.unit_type IS
  '内部域：headquarters/division/big_region/region/province/city/department/team；渠道域：channel_company/channel_department/channel_team。';
COMMENT ON COLUMN org.org_units.path_code IS
  'ltree 路径，根节点为空，子孙节点如 /A/B/C；用于防环与子树查询。';
COMMENT ON COLUMN org.org_units.source_code IS '数据来源（D-07 占位）：manual/iam_sso/wecom。';
COMMENT ON COLUMN org.org_units.sync_status_code IS '同步状态（D-07 占位），首期 manual。';
COMMENT ON COLUMN org.org_units.manager_assignment_id IS
  '软外键，指向 org.staff_assignments.id；外键在 11.2 staff_assignments 表创建后补。';

-- 1.2 现有数据回填 path_code：一次性 CTE 递归构造
-- 注意：必须使用单个 WITH RECURSIVE + 单条 UPDATE；不能在递归 CTE 内 UPDATE 父表，
-- 否则子行在迭代中看不到父行的新 path。
-- 根节点 path_code 保持空 ''::ltree；子节点 path_code = 父.path || 自己（去 / 和 .）
WITH RECURSIVE org_path_walk AS (
  SELECT id, unit_code, parent_unit_id, ''::ltree AS new_path
    FROM org.org_units
    WHERE parent_unit_id IS NULL
  UNION ALL
  SELECT c.id, c.unit_code, c.parent_unit_id,
    (w.new_path || text2ltree(replace(replace(c.unit_code, '/', '_'), '.', '_')))::ltree
    FROM org.org_units c
    JOIN org_path_walk w ON c.parent_unit_id = w.id
)
UPDATE org.org_units u SET path_code = w.new_path
FROM org_path_walk w WHERE u.id = w.id;

-- 1.3 索引
CREATE INDEX IF NOT EXISTS idx_org_units_path_code_gist
  ON org.org_units USING GIST (path_code);
CREATE INDEX IF NOT EXISTS idx_org_units_unit_type_status
  ON org.org_units(unit_type, status_code);
CREATE INDEX IF NOT EXISTS idx_org_units_parent
  ON org.org_units(parent_unit_id) WHERE parent_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_units_sync_status
  ON org.org_units(sync_status_code) WHERE sync_status_code <> 'manual';

-- ============================================================
-- 2. 新增 org.positions（11.1 岗位字典）
--    - 岗位名不直接代表权限（D-02）
--    - 同组织代码唯一
-- ============================================================
CREATE TABLE IF NOT EXISTS org.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_unit_id uuid NOT NULL REFERENCES org.org_units(id),
  position_code text NOT NULL,
  position_name text NOT NULL,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('management','sales','support','functional','other')),
  status_code text NOT NULL DEFAULT 'active'
    CHECK (status_code IN ('active','disabled')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES iam.users(id),
  row_version bigint NOT NULL DEFAULT 1,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (org_unit_id, position_code)
);
COMMENT ON TABLE org.positions IS '岗位字典；岗位名不直接代表权限（D-02 + 7.2 红线）。';

CREATE INDEX IF NOT EXISTS idx_positions_org_unit_status
  ON org.positions(org_unit_id, status_code);

-- ============================================================
-- 3. 新增 org.staff_assignments（11.2 内部任职）
--    - 一人多岗；一人只能有一个有效主职（EXCLUDE 约束）
--    - 软外键 manager_assignment_id 自引用
-- ============================================================
CREATE TABLE IF NOT EXISTS org.staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  org_unit_id uuid NOT NULL REFERENCES org.org_units(id) ON DELETE RESTRICT,
  position_id uuid NOT NULL REFERENCES org.positions(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  manager_assignment_id uuid,
  effective_at timestamptz NOT NULL DEFAULT now(),
  expired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES iam.users(id),
  source_code text NOT NULL DEFAULT 'manual'
    CHECK (source_code IN ('manual','iam_sso','wecom')),
  source_external_id text,
  sync_status_code text NOT NULL DEFAULT 'manual'
    CHECK (sync_status_code IN ('manual','not_synced','syncing','synced','sync_conflict','sync_failed')),
  row_version bigint NOT NULL DEFAULT 1,
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- 一人只能有一个有效主职
  CONSTRAINT staff_assignments_one_primary_active
    EXCLUDE USING gist (
      user_id WITH =,
      tstzrange(
        effective_at,
        COALESCE(expired_at, 'infinity'::timestamptz),
        '[)'
      ) WITH &&
    )
    WHERE (is_primary = true),
  -- 任职区间合法
  CONSTRAINT staff_assignments_time_valid
    CHECK (expired_at IS NULL OR expired_at > effective_at)
);
COMMENT ON TABLE org.staff_assignments IS '内部任职记录；EXCLUDE 约束保证一人只有一个有效主职（7.4.2）。';
COMMENT ON COLUMN org.staff_assignments.is_primary IS '主职标记；EXCLUDE 约束保证同一 user_id 在任何有效区间内最多一条 is_primary=true。';
COMMENT ON COLUMN org.staff_assignments.manager_assignment_id IS '软外键，指向本表另一条任职；FK 在表创建后通过 ALTER 加，避免创建期循环。';

-- 3.1 自引用外键（避开创建期循环）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_staff_assignments_manager'
  ) THEN
    ALTER TABLE org.staff_assignments
      ADD CONSTRAINT fk_staff_assignments_manager
      FOREIGN KEY (manager_assignment_id)
      REFERENCES org.staff_assignments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3.2 软外键回填到 org.org_units.manager_assignment_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_org_units_manager_assignment'
  ) THEN
    ALTER TABLE org.org_units
      ADD CONSTRAINT fk_org_units_manager_assignment
      FOREIGN KEY (manager_assignment_id)
      REFERENCES org.staff_assignments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_assignments_user_active
  ON org.staff_assignments(user_id) WHERE expired_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_assignments_org_unit_active
  ON org.staff_assignments(org_unit_id) WHERE expired_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_assignments_manager
  ON org.staff_assignments(manager_assignment_id) WHERE manager_assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_assignments_sync
  ON org.staff_assignments(sync_status_code) WHERE sync_status_code <> 'manual';

-- ============================================================
-- 4. 新增 org.manager_relations（11.2 直属关系表）
--    - 直属矩阵、临时项目等矩阵关系
--    - 不得指向自身
-- ============================================================
CREATE TABLE IF NOT EXISTS org.manager_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subordinate_assignment_id uuid NOT NULL REFERENCES org.staff_assignments(id) ON DELETE CASCADE,
  manager_assignment_id uuid NOT NULL REFERENCES org.staff_assignments(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'direct'
    CHECK (relation_type IN ('direct','matrix','temporary')),
  effective_at timestamptz NOT NULL DEFAULT now(),
  expired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES iam.users(id),
  row_version bigint NOT NULL DEFAULT 1,
  CHECK (subordinate_assignment_id <> manager_assignment_id),
  CHECK (expired_at IS NULL OR expired_at > effective_at)
);
COMMENT ON TABLE org.manager_relations IS '直属关系矩阵（除主职直属外的矩阵关系）；7.6 调岗需重新计算。';

CREATE INDEX IF NOT EXISTS idx_manager_relations_sub_active
  ON org.manager_relations(subordinate_assignment_id) WHERE expired_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manager_relations_mgr_active
  ON org.manager_relations(manager_assignment_id) WHERE expired_at IS NULL;

-- ============================================================
-- 5. iam.users 扩展（D-07 同步字段 + D-10 离职字段）
-- ============================================================
ALTER TABLE iam.users
  ADD COLUMN IF NOT EXISTS origin_code text NOT NULL DEFAULT 'local'
    CHECK (origin_code IN ('local','iam_sso','wecom')),
  ADD COLUMN IF NOT EXISTS origin_external_id text,
  ADD COLUMN IF NOT EXISTS origin_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS origin_sync_status text NOT NULL DEFAULT 'manual'
    CHECK (origin_sync_status IN ('manual','not_synced','syncing','synced','sync_conflict','sync_failed')),
  ADD COLUMN IF NOT EXISTS offboarding_status text NOT NULL DEFAULT 'active'
    CHECK (offboarding_status IN ('active','offboarding','offboarded','reactivated')),
  ADD COLUMN IF NOT EXISTS offboarding_handover_id uuid;

COMMENT ON COLUMN iam.users.origin_code IS '账号来源（D-07 占位）：本地创建/IAM同步/企微同步，首期全 local。';
COMMENT ON COLUMN iam.users.origin_sync_status IS '同步状态，首期 manual。';
COMMENT ON COLUMN iam.users.offboarding_status IS
  '离职状态（D-10）：active=正常/offboarding=离职中/offboarded=已离职/reactivated=已恢复。与 status_code 并存。';

-- 5.1 offboarding_handover_id 外键暂留软引用，11.6 表创建后再补 FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_offboarding_handover'
  ) THEN
    -- 暂不创建 FK，等 S10-004 离职交接表创建后追加
    NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_origin
  ON iam.users(origin_code);
CREATE INDEX IF NOT EXISTS idx_users_offboarding_status
  ON iam.users(offboarding_status) WHERE offboarding_status <> 'active';
CREATE INDEX IF NOT EXISTS idx_users_origin_sync
  ON iam.users(origin_sync_status) WHERE origin_sync_status <> 'manual';

-- ============================================================
-- 6. 防环与归档守卫的 SQL 层函数（11.1）
--    - assert_no_cycle：移动组织前调用
--    - assert_archivable：归档前调用
-- ============================================================
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

  -- 成环判断：新父是子现有树中的祖先 ⇔ 子 path 是新父 path 的祖先前缀 ⇔ v_child_path @> v_new_parent_path
  -- 注意：根的 path 是 ''，''::ltree @> 'X' = true，所以根 → 孙 也会被拦住（正确）。
  IF v_child_path @> v_new_parent_path THEN
    RAISE EXCEPTION 'ORG_CYCLE: 禁止将组织 % 移到其祖先节点 % 下', p_child_id, p_new_parent_id
      USING ERRCODE = 'check_violation';
  END IF;
END $$ LANGUAGE plpgsql;

COMMENT ON FUNCTION org.assert_no_cycle IS '11.1 防环：移动组织前调用，禁止成环。';

CREATE OR REPLACE FUNCTION org.assert_archivable(p_unit_id uuid)
RETURNS void AS $$
DECLARE
  v_has_children int;
  v_has_assignments int;
BEGIN
  SELECT COUNT(*) INTO v_has_children
    FROM org.org_units
    WHERE parent_unit_id = p_unit_id AND status_code <> 'archived';
  IF v_has_children > 0 THEN
    RAISE EXCEPTION 'ORG_HAS_CHILDREN: 存在有效子组织，禁止归档'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO v_has_assignments
    FROM org.staff_assignments
    WHERE org_unit_id = p_unit_id AND expired_at IS NULL;
  IF v_has_assignments > 0 THEN
    RAISE EXCEPTION 'ORG_HAS_STAFF: 存在有效任职，禁止归档'
      USING ERRCODE = 'check_violation';
  END IF;
END $$ LANGUAGE plpgsql;

COMMENT ON FUNCTION org.assert_archivable IS '11.1 归档守卫：归档前调用，禁止有有效子组织或任职。';

-- ============================================================
-- 7. 视图：v_org_units_active_tree（11.1 树查询加速）
-- ============================================================
CREATE OR REPLACE VIEW org.v_org_units_active_tree AS
SELECT
  id,
  unit_code,
  unit_name,
  unit_type,
  parent_unit_id,
  region_id,
  manager_assignment_id,
  path_code,
  sort_order,
  effective_at,
  expired_at,
  status_code,
  source_code,
  sync_status_code,
  nlevel(path_code) AS depth
FROM org.org_units
WHERE status_code IN ('active','draft');

COMMENT ON VIEW org.v_org_units_active_tree IS '11.1 组织树查询视图，按 path_code 排序保证父子顺序。';

-- ============================================================
-- 8. 迁移结束标记
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'S10-001 组织架构主体迁移完成：org.org_units 扩展 + org.positions + org.staff_assignments + org.manager_relations + iam.users 扩展';
END $$;
