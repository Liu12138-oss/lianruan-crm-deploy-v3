-- ============================================================
-- S10-006 组织架构导入导出与自动编码（KB 需求）
-- 1. org.staff_assignments.position_id 改为可空：成员导入时岗位默认空
-- 2. org.org_units.unit_code 唯一约束改为部分唯一：自动编码与手工编码共存
-- ============================================================

-- 1. 岗位可空：成员导入不要求岗位
ALTER TABLE org.staff_assignments
  ALTER COLUMN position_id DROP NOT NULL;

COMMENT ON COLUMN org.staff_assignments.position_id IS
  '岗位可空：导入成员时允许不指定岗位；有效主职约束不依赖岗位。';

-- 2. unit_code 唯一性：现有全局唯一约束改为部分唯一，
--    自动编码（AUTO- 前缀）与手工编码都可入库，但自动编码不得重复。
DO $$
BEGIN
  -- S2-002 建表时 unit_code text NOT NULL UNIQUE 由 PostgreSQL 自动生成的约束名；
  -- 若历史环境曾以 org_ 前缀显式命名，也一并清理，避免旧全局唯一约束残留。
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_units_unit_code_key' AND conrelid = 'org.org_units'::regclass
  ) THEN
    ALTER TABLE org.org_units DROP CONSTRAINT org_units_unit_code_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_org_units_unit_code_key' AND conrelid = 'org.org_units'::regclass
  ) THEN
    ALTER TABLE org.org_units DROP CONSTRAINT org_org_units_unit_code_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_units_unit_code_not_auto
  ON org.org_units(unit_code)
  WHERE unit_code NOT LIKE 'AUTO-%';
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_units_unit_code_auto
  ON org.org_units(unit_code)
  WHERE unit_code LIKE 'AUTO-%';

-- 3. 清理 S2-002 遗留的状态约束：仅允许 active/disabled 的旧 CHECK 会拦截
--    新建组织默认 draft 状态（S10-001 只删除带 org_ 前缀的约束名，旧约束残留）。
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
     WHERE conrelid = 'org.org_units'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%status_code%'
  LOOP
    IF c.def LIKE '%draft%' THEN
      RAISE NOTICE '保留状态约束 %', c.conname;
    ELSIF c.def LIKE '%active%' AND c.def LIKE '%disabled%' THEN
      EXECUTE format('ALTER TABLE org.org_units DROP CONSTRAINT %I', c.conname);
      RAISE NOTICE '删除残留旧状态约束 %', c.conname;
    END IF;
  END LOOP;
END $$;
