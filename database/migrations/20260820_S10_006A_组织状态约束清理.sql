-- S10-006A：清理 S2-002 遗留状态约束（拦截 draft），保持与 S10-006 完整语义一致。
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
