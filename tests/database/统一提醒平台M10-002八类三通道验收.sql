-- M10-002 验收：八类业务提醒均为站内、企微自建应用、邮件三通道。
-- 此脚本只读校验，不写入任何业务数据或配置。

BEGIN;

DO $$
DECLARE
  目标规则数 integer;
  三通道规则数 integer;
  含群机器人规则数 integer;
BEGIN
  SELECT count(*)
    INTO 目标规则数
  FROM (
    SELECT subscription_code AS rule_code
    FROM message.event_subscriptions
    WHERE subscription_code IN (
      'm1_order_approval_in_app',
      'm1_order_confirmed_in_app',
      'm1_order_status_in_app',
      'm1_registration_approval_pending',
      'm1_registration_approved_in_app',
      'm1_registration_rejected_in_app'
    )
      AND status_code = 'active'
    UNION ALL
    SELECT reminder_code
    FROM message.reminder_rules
    WHERE rule_code IN (
      'm3_registration_expiring',
      'm3_opportunity_expected_close'
    )
      AND status_code = 'active'
  ) AS 目标规则;

  SELECT count(*)
    INTO 三通道规则数
  FROM (
    SELECT channel_codes
    FROM message.event_subscriptions
    WHERE subscription_code IN (
      'm1_order_approval_in_app',
      'm1_order_confirmed_in_app',
      'm1_order_status_in_app',
      'm1_registration_approval_pending',
      'm1_registration_approved_in_app',
      'm1_registration_rejected_in_app'
    )
      AND status_code = 'active'
    UNION ALL
    SELECT channel_codes
    FROM message.reminder_rules
    WHERE rule_code IN (
      'm3_registration_expiring',
      'm3_opportunity_expected_close'
    )
      AND status_code = 'active'
  ) AS 目标规则
  WHERE channel_codes = '["in_app","wecom_app","email"]'::jsonb;

  SELECT count(*)
    INTO 含群机器人规则数
  FROM (
    SELECT channel_codes
    FROM message.event_subscriptions
    WHERE subscription_code IN (
      'm1_order_approval_in_app',
      'm1_order_confirmed_in_app',
      'm1_order_status_in_app',
      'm1_registration_approval_pending',
      'm1_registration_approved_in_app',
      'm1_registration_rejected_in_app'
    )
      AND status_code = 'active'
    UNION ALL
    SELECT channel_codes
    FROM message.reminder_rules
    WHERE rule_code IN (
      'm3_registration_expiring',
      'm3_opportunity_expected_close'
    )
      AND status_code = 'active'
  ) AS 目标规则
  WHERE channel_codes @> '["wecom"]'::jsonb;

  IF 目标规则数 <> 8 THEN
    RAISE EXCEPTION 'M10-002 验收失败：预期 8 条已启用目标规则，实际 % 条。', 目标规则数;
  END IF;
  IF 三通道规则数 <> 8 THEN
    RAISE EXCEPTION 'M10-002 验收失败：预期 8 条三通道规则，实际 % 条。', 三通道规则数;
  END IF;
  IF 含群机器人规则数 <> 0 THEN
    RAISE EXCEPTION 'M10-002 验收失败：发现 % 条业务规则包含企微群机器人。', 含群机器人规则数;
  END IF;
END $$;

ROLLBACK;
