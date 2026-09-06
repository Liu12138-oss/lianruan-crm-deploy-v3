-- S10-017：渠道商创建审批状态闭环。
-- 区域管理员提交的渠道商在审批完成前保持 pending，不得被误认为已生效。

DO $$
DECLARE
  constraint_name text;
BEGIN
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
  ADD CONSTRAINT ck_partners_status_code_v3_approval
  CHECK (status_code IN ('pending', 'active', 'rejected', 'disabled', 'archived'));

COMMENT ON COLUMN channel.partners.status_code IS
  '渠道商状态。区域管理员提交为 pending，超级管理员审批后转为 active 或 rejected。';
