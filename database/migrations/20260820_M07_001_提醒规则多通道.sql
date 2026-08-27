-- M7-001 统一消息提醒平台：提醒规则与调度支持多通道（站内/企微应用/邮件）。
-- 放开 reminder_rules 与 reminder_schedules 的 channel_codes 写死 in_app 约束，
-- 允许在受控集合内配置 ["in_app","wecom_app","email"] 等组合。

BEGIN;

DO $$
DECLARE
  目标表 regclass;
  约束名 text;
BEGIN
  FOREACH 目标表 IN ARRAY ARRAY[
    'message.reminder_rules'::regclass,
    'message.reminder_schedules'::regclass
  ] LOOP
    SELECT conname INTO 约束名
      FROM pg_constraint
     WHERE conrelid = 目标表
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%channel_codes%'
       AND pg_get_constraintdef(oid) LIKE '%in_app%'
     LIMIT 1;
    IF 约束名 IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', 目标表, 约束名);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 目标表
        AND conname = replace(目标表::text, '.', '_') || '_channel_codes_allowed'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I CHECK (jsonb_typeof(channel_codes) = ''array'' AND channel_codes <@ ''["in_app","wecom","wecom_app","sms","email"]''::jsonb AND jsonb_array_length(channel_codes) >= 1)',
        目标表,
        replace(目标表::text, '.', '_') || '_channel_codes_allowed'
      );
    END IF;
  END LOOP;
END $$;

-- 现有种子规则补充企微应用与邮件通道（保留站内）。
UPDATE message.reminder_rules
SET channel_codes = '["in_app","wecom_app","email"]'::jsonb,
    rule_updated_at = now(),
    updated_at = now()
WHERE rule_code IN ('m3_registration_expiring', 'm3_opportunity_expected_close')
  AND channel_codes = '["in_app"]'::jsonb;

COMMIT;
