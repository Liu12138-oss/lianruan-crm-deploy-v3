-- S10-017 回退：仅在不存在 pending/rejected 渠道商时执行。

DO $$
DECLARE
  constraint_name text;
  pending_count bigint;
BEGIN
  SELECT COUNT(*) INTO pending_count
  FROM channel.partners
  WHERE status_code IN ('pending', 'rejected');
  IF pending_count > 0 THEN
    RAISE EXCEPTION '仍存在 % 条 pending/rejected 渠道商，禁止回退状态约束', pending_count;
  END IF;

  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'channel.partners'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status_code%'
  LOOP
    EXECUTE format('ALTER TABLE channel.partners DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE channel.partners
  ADD CONSTRAINT ck_partners_status_code_v3_legacy
  CHECK (status_code IN ('active', 'disabled', 'archived'));
