-- 修复已执行的 20260820_S10_006 历史迁移被改写导致的组织架构导入导出约束缺口。

ALTER TABLE org.staff_assignments
  ALTER COLUMN position_id DROP NOT NULL;

COMMENT ON COLUMN org.staff_assignments.position_id IS
  '岗位可空：导入成员时允许不指定岗位；有效主职约束不依赖岗位。';

DO $$
BEGIN
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
