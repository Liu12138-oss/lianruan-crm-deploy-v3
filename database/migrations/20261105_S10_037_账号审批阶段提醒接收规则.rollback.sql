-- 回滚为历史固定接收人规则。固定用户编号来自 M11_001 初始化迁移中的超级管理员。
UPDATE message.reminder_templates
SET default_recipient_rule_json = jsonb_build_object(
      'type', 'users',
      'scope', jsonb_build_object(
        'type', 'users',
        'userIds', jsonb_build_array('6f2fd9ae-1200-b247-9018-27de1ca8515c')
      )
    ),
    updated_at = now()
WHERE template_code = 'm1_account_approval_pending';

UPDATE message.event_subscriptions
SET recipient_rule_json = jsonb_build_object(
      'type', 'users',
      'scope', jsonb_build_object(
        'type', 'users',
        'userIds', jsonb_build_array('6f2fd9ae-1200-b247-9018-27de1ca8515c')
      )
    ),
    rule_name = '员工账号审核待办',
    rule_version = rule_version + 1,
    rule_updated_at = now(),
    updated_at = now()
WHERE subscription_code = 'm1_account_approval_pending';
