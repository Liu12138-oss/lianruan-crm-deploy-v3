-- 账号审批按当前阶段实时解析接收人：区管初审提醒本区域区管，终审提醒超管。
-- 兼容已存在环境：只替换账号审批订阅规则，不改动其他消息规则。

UPDATE message.reminder_templates
SET default_recipient_rule_json = '{"type":"account_current_approver","scope":{}}'::jsonb,
    description = '账号审批提交及阶段推进时，按当前审批阶段提醒本区域区管或超管。',
    updated_at = now()
WHERE template_code = 'm1_account_approval_pending';

UPDATE message.event_subscriptions
SET recipient_rule_json = '{"type":"account_current_approver","scope":{}}'::jsonb,
    rule_name = '账号审批阶段待办',
    rule_version = rule_version + 1,
    rule_updated_at = now(),
    updated_at = now()
WHERE subscription_code = 'm1_account_approval_pending';
