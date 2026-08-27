-- M10-002 统一提醒平台：八类业务提醒启用站内、企微自建应用和邮件。
-- 不改变接收人、启停状态、模板、通道凭据或既有投递事实；群机器人不承载业务明细。

BEGIN;

-- 六类即时业务事件：仅调整当前已启用规则的通道组合。
UPDATE message.event_subscriptions
SET channel_codes = '["in_app","wecom_app","email"]'::jsonb,
    rule_version = rule_version + 1,
    rule_updated_at = now(),
    updated_at = now()
WHERE status_code = 'active'
  AND event_code IN (
    'crm.order.approval.pending',
    'crm.order.confirmed',
    'crm.order.status.changed',
    'crm.registration.approval.pending',
    'crm.registration.approved',
    'crm.registration.rejected'
  )
  AND channel_codes IS DISTINCT FROM '["in_app","wecom_app","email"]'::jsonb;

-- 两类到期提醒：保持既有提前天数、执行时点、接收人和启停状态不变。
UPDATE message.reminder_rules
SET channel_codes = '["in_app","wecom_app","email"]'::jsonb,
    rule_version = rule_version + 1,
    rule_updated_at = now(),
    updated_at = now()
WHERE status_code = 'active'
  AND reminder_code IN (
    'crm.registration.expiring',
    'crm.opportunity.expected_close'
  )
  AND channel_codes IS DISTINCT FROM '["in_app","wecom_app","email"]'::jsonb;

COMMIT;
