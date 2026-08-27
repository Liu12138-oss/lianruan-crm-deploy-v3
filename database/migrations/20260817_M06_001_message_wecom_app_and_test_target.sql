-- ============================================================
-- M6-001 统一消息提醒平台：企微自建应用与临时测试接收人
-- 临时测试收件人仅以 AES-256-GCM 密文短暂保存，投递完成后立即清空。
-- ============================================================

BEGIN;

ALTER TABLE message.deliveries
  ADD COLUMN IF NOT EXISTS test_recipient_cipher_text text,
  ADD COLUMN IF NOT EXISTS test_recipient_nonce text,
  ADD COLUMN IF NOT EXISTS test_recipient_auth_tag text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'message.deliveries'::regclass
      AND conname = 'ck_message_deliveries_test_recipient_cipher'
  ) THEN
    ALTER TABLE message.deliveries
      ADD CONSTRAINT ck_message_deliveries_test_recipient_cipher
      CHECK (
        (test_recipient_cipher_text IS NULL AND test_recipient_nonce IS NULL AND test_recipient_auth_tag IS NULL)
        OR
        (test_recipient_cipher_text IS NOT NULL AND test_recipient_nonce IS NOT NULL AND test_recipient_auth_tag IS NOT NULL)
      );
  END IF;
END $$;

DO $$
DECLARE
  表名 regclass;
  约束名 text;
BEGIN
  FOREACH 表名 IN ARRAY ARRAY[
    'message.channel_accounts'::regclass,
    'message.templates'::regclass,
    'message.deliveries'::regclass,
    'message.delivery_attempts'::regclass
  ] LOOP
    SELECT conname INTO 约束名
      FROM pg_constraint
     WHERE conrelid = 表名
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%channel_code%'
     LIMIT 1;
    IF 约束名 IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', 表名, 约束名);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 表名
        AND conname = replace(表名::text, '.', '_') || '_channel_code_allowed'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I CHECK (channel_code IN (''in_app'', ''wecom'', ''wecom_app'', ''sms'', ''email''))',
        表名,
        replace(表名::text, '.', '_') || '_channel_code_allowed'
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
