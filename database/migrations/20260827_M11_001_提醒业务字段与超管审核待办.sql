-- M11-001 统一消息提醒平台：补齐订单、报备业务字段与超管审核待办。
-- 订单名称按“订单项目名称、报价项目名称、商机名称”顺序由消息 Worker 读取；
-- 超管审核首期仅投递给 liulonghai，后续可在提醒规则管理页修改为其他指定用户或范围。

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM iam.users
    WHERE lower(username::text) = 'liulonghai' AND status_code = 'active'
  ) THEN
    RAISE EXCEPTION '未找到启用的超管接收账号 liulonghai，已回滚本次提醒规则迁移。';
  END IF;
END $$;

-- 一、订单三类即时提醒：必须提供订单号、订单名称、渠道商和提交人。
UPDATE message.templates
SET variables_json = '[
      {"name":"business_no","label":"订单编号"},
      {"name":"order_name","label":"订单名称"},
      {"name":"partner_name","label":"渠道商名称"},
      {"name":"submitter_name","label":"提交人"}
    ]'::jsonb,
    body_template = CASE event_code
      WHEN 'crm.order.approval.pending' THEN
        '订单待审批。订单号：{{business_no}}；订单名称：{{order_name}}；订单渠道商：{{partner_name}}；提交人：{{submitter_name}}。请及时审批。'
      WHEN 'crm.order.confirmed' THEN
        '订单确认完成。订单号：{{business_no}}；订单名称：{{order_name}}；订单渠道商：{{partner_name}}；提交人：{{submitter_name}}。请及时安排后续。'
      ELSE
        '订单状态已变化。订单号：{{business_no}}；订单名称：{{order_name}}；订单渠道商：{{partner_name}}；提交人：{{submitter_name}}。请查看详情。'
    END,
    updated_at = now()
WHERE event_code IN (
  'crm.order.approval.pending',
  'crm.order.confirmed',
  'crm.order.status.changed'
);

UPDATE message.reminder_templates
SET variable_defs = '[
      {"name":"business_no","label":"订单编号"},
      {"name":"order_name","label":"订单名称"},
      {"name":"partner_name","label":"渠道商名称"},
      {"name":"submitter_name","label":"提交人"},
      {"name":"due_date","label":"交付日期"},
      {"name":"days_left","label":"剩余天数"},
      {"name":"total_amount","label":"订单金额"}
    ]'::jsonb,
    body_template = '订单交付日期即将到期。订单号：{{business_no}}；订单名称：{{order_name}}；订单渠道商：{{partner_name}}；提交人：{{submitter_name}}；交付日期：{{due_date}}；剩余 {{days_left}} 天。',
    updated_at = now()
WHERE template_code = 'm3_order_delivery_date';

UPDATE message.reminder_templates
SET variable_defs = '[
      {"name":"business_no","label":"订单编号"},
      {"name":"order_name","label":"订单名称"},
      {"name":"partner_name","label":"渠道商名称"},
      {"name":"submitter_name","label":"提交人"}
    ]'::jsonb,
    body_template = CASE event_code
      WHEN 'crm.order.approval.pending' THEN
        '订单待审批。订单号：{{business_no}}；订单名称：{{order_name}}；订单渠道商：{{partner_name}}；提交人：{{submitter_name}}。请及时审批。'
      WHEN 'crm.order.confirmed' THEN
        '订单确认完成。订单号：{{business_no}}；订单名称：{{order_name}}；订单渠道商：{{partner_name}}；提交人：{{submitter_name}}。请及时安排后续。'
      ELSE
        '订单状态已变化。订单号：{{business_no}}；订单名称：{{order_name}}；订单渠道商：{{partner_name}}；提交人：{{submitter_name}}。请查看详情。'
    END,
    updated_at = now()
WHERE template_code IN (
  'm1_order_approval_pending',
  'm1_order_confirmed',
  'm1_order_status_changed'
);

-- 二、客户报备三类即时提醒及到期提醒：明确客户、渠道商与提交人。
UPDATE message.templates
SET variables_json = CASE
      WHEN event_code = 'crm.registration.approved' THEN '[
        {"name":"customer_name","label":"客户名称"},
        {"name":"business_no","label":"报备编号"},
        {"name":"partner_name","label":"提报渠道商名称"},
        {"name":"submitter_name","label":"提交人"},
        {"name":"due_date","label":"保护期到期日"}
      ]'::jsonb
      ELSE '[
        {"name":"customer_name","label":"客户名称"},
        {"name":"business_no","label":"报备编号"},
        {"name":"partner_name","label":"提报渠道商名称"},
        {"name":"submitter_name","label":"提交人"}
      ]'::jsonb
    END,
    body_template = CASE event_code
      WHEN 'crm.registration.approval.pending' THEN
        '客户报备待审批。客户名称：{{customer_name}}；报备编号：{{business_no}}；提报渠道商：{{partner_name}}；提交人：{{submitter_name}}。请及时处理。'
      WHEN 'crm.registration.approved' THEN
        '客户报备已通过。客户名称：{{customer_name}}；报备编号：{{business_no}}；提报渠道商：{{partner_name}}；提交人：{{submitter_name}}；保护期到期日：{{due_date}}。'
      ELSE
        '客户报备未通过。客户名称：{{customer_name}}；报备编号：{{business_no}}；提报渠道商：{{partner_name}}；提交人：{{submitter_name}}。请查看处理意见。'
    END,
    updated_at = now()
WHERE event_code IN (
  'crm.registration.approval.pending',
  'crm.registration.approved',
  'crm.registration.rejected'
);

UPDATE message.reminder_templates
SET variable_defs = '[
      {"name":"customer_name","label":"客户名称"},
      {"name":"business_no","label":"报备编号"},
      {"name":"partner_name","label":"提报渠道商名称"},
      {"name":"submitter_name","label":"提交人"},
      {"name":"due_date","label":"保护期到期日"},
      {"name":"days_left","label":"剩余天数"},
      {"name":"protect_days","label":"保护天数"}
    ]'::jsonb,
    body_template = '客户报备保护期即将到期。客户名称：{{customer_name}}；报备编号：{{business_no}}；提报渠道商：{{partner_name}}；提交人：{{submitter_name}}；保护期到期日：{{due_date}}；剩余 {{days_left}} 天。',
    updated_at = now()
WHERE template_code = 'm3_registration_expiring';

UPDATE message.reminder_templates
SET variable_defs = CASE
      WHEN event_code = 'crm.registration.approved' THEN '[
        {"name":"customer_name","label":"客户名称"},
        {"name":"business_no","label":"报备编号"},
        {"name":"partner_name","label":"提报渠道商名称"},
        {"name":"submitter_name","label":"提交人"},
        {"name":"due_date","label":"保护期到期日"}
      ]'::jsonb
      ELSE '[
        {"name":"customer_name","label":"客户名称"},
        {"name":"business_no","label":"报备编号"},
        {"name":"partner_name","label":"提报渠道商名称"},
        {"name":"submitter_name","label":"提交人"}
      ]'::jsonb
    END,
    body_template = CASE event_code
      WHEN 'crm.registration.approval.pending' THEN
        '客户报备待审批。客户名称：{{customer_name}}；报备编号：{{business_no}}；提报渠道商：{{partner_name}}；提交人：{{submitter_name}}。请及时处理。'
      WHEN 'crm.registration.approved' THEN
        '客户报备已通过。客户名称：{{customer_name}}；报备编号：{{business_no}}；提报渠道商：{{partner_name}}；提交人：{{submitter_name}}；保护期到期日：{{due_date}}。'
      ELSE
        '客户报备未通过。客户名称：{{customer_name}}；报备编号：{{business_no}}；提报渠道商：{{partner_name}}；提交人：{{submitter_name}}。请查看处理意见。'
    END,
    updated_at = now()
WHERE template_code IN (
  'm1_registration_approval_pending',
  'm1_registration_approved',
  'm1_registration_rejected'
);

-- 三、员工账号审核与渠道商审核事件、模板和规则。
INSERT INTO message.reminder_templates (
  template_code, template_name, reminder_type, event_code,
  category_code, priority_code, default_recipient_rule_json, default_channel_codes,
  default_advance_days, default_dispatch_time, default_workday_only, default_digest_window_minutes,
  variable_defs, title_template, body_template, is_system, status_code, description
)
SELECT
  'm1_account_approval_pending', '员工账号待审核', 'event', 'iam.account.approval.pending',
  'todo', 'strong',
  jsonb_build_object('type', 'users', 'scope', jsonb_build_object('type', 'users', 'userIds', jsonb_agg(user_account.id::text))),
  '["in_app","wecom_app","email"]'::jsonb,
  ARRAY[30,7,1], '09:00:00', true, 0,
  '[{"name":"target_name","label":"员工姓名"},{"name":"partner_name","label":"渠道商名称"},{"name":"submitter_name","label":"提交人"}]'::jsonb,
  '员工账号待审核', '员工账号待审核。员工姓名：{{target_name}}；渠道商名称：{{partner_name}}；提交人：{{submitter_name}}。请及时处理。',
  true, 'active', '渠道商员工或企业管理员账号提交审核时提醒指定超管。'
FROM iam.users user_account
WHERE lower(user_account.username::text) = 'liulonghai' AND user_account.status_code = 'active'
ON CONFLICT (template_code) DO UPDATE SET
  default_recipient_rule_json = EXCLUDED.default_recipient_rule_json,
  variable_defs = EXCLUDED.variable_defs,
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  updated_at = now();

INSERT INTO message.reminder_templates (
  template_code, template_name, reminder_type, event_code,
  category_code, priority_code, default_recipient_rule_json, default_channel_codes,
  default_advance_days, default_dispatch_time, default_workday_only, default_digest_window_minutes,
  variable_defs, title_template, body_template, is_system, status_code, description
)
SELECT
  'm1_partner_approval_pending', '渠道商待审核', 'event', 'channel.partner.approval.pending',
  'todo', 'strong',
  jsonb_build_object('type', 'users', 'scope', jsonb_build_object('type', 'users', 'userIds', jsonb_agg(user_account.id::text))),
  '["in_app","wecom_app","email"]'::jsonb,
  ARRAY[30,7,1], '09:00:00', true, 0,
  '[{"name":"partner_name","label":"渠道商名称"},{"name":"submitter_name","label":"提交人"}]'::jsonb,
  '渠道商待审核', '渠道商待审核。渠道商名称：{{partner_name}}；提交人：{{submitter_name}}。请及时处理。',
  true, 'active', '渠道商提交审核时提醒指定超管。'
FROM iam.users user_account
WHERE lower(user_account.username::text) = 'liulonghai' AND user_account.status_code = 'active'
ON CONFLICT (template_code) DO UPDATE SET
  default_recipient_rule_json = EXCLUDED.default_recipient_rule_json,
  variable_defs = EXCLUDED.variable_defs,
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  updated_at = now();

INSERT INTO message.templates (
  template_code, version, channel_code, event_code, category_code, priority_code,
  title_template, body_template, status_code, effective_at, variables_json
) VALUES
  ('m1_account_approval_pending_in_app', 1, 'in_app', 'iam.account.approval.pending', 'todo', 'strong',
   '员工账号待审核', '员工账号待审核。员工姓名：{{target_name}}；渠道商名称：{{partner_name}}；提交人：{{submitter_name}}。请及时处理。', 'published', now(),
   '[{"name":"target_name","label":"员工姓名"},{"name":"partner_name","label":"渠道商名称"},{"name":"submitter_name","label":"提交人"}]'),
  ('m1_account_approval_pending_wecom_app', 1, 'wecom_app', 'iam.account.approval.pending', 'todo', 'strong',
   '员工账号待审核', '员工账号待审核。员工姓名：{{target_name}}；渠道商名称：{{partner_name}}；提交人：{{submitter_name}}。请及时处理。', 'published', now(),
   '[{"name":"target_name","label":"员工姓名"},{"name":"partner_name","label":"渠道商名称"},{"name":"submitter_name","label":"提交人"}]'),
  ('m1_account_approval_pending_email', 1, 'email', 'iam.account.approval.pending', 'todo', 'strong',
   '员工账号待审核', '员工账号待审核。员工姓名：{{target_name}}；渠道商名称：{{partner_name}}；提交人：{{submitter_name}}。请及时处理。', 'published', now(),
   '[{"name":"target_name","label":"员工姓名"},{"name":"partner_name","label":"渠道商名称"},{"name":"submitter_name","label":"提交人"}]'),
  ('m1_partner_approval_pending_in_app', 1, 'in_app', 'channel.partner.approval.pending', 'todo', 'strong',
   '渠道商待审核', '渠道商待审核。渠道商名称：{{partner_name}}；提交人：{{submitter_name}}。请及时处理。', 'published', now(),
   '[{"name":"partner_name","label":"渠道商名称"},{"name":"submitter_name","label":"提交人"}]'),
  ('m1_partner_approval_pending_wecom_app', 1, 'wecom_app', 'channel.partner.approval.pending', 'todo', 'strong',
   '渠道商待审核', '渠道商待审核。渠道商名称：{{partner_name}}；提交人：{{submitter_name}}。请及时处理。', 'published', now(),
   '[{"name":"partner_name","label":"渠道商名称"},{"name":"submitter_name","label":"提交人"}]'),
  ('m1_partner_approval_pending_email', 1, 'email', 'channel.partner.approval.pending', 'todo', 'strong',
   '渠道商待审核', '渠道商待审核。渠道商名称：{{partner_name}}；提交人：{{submitter_name}}。请及时处理。', 'published', now(),
   '[{"name":"partner_name","label":"渠道商名称"},{"name":"submitter_name","label":"提交人"}]')
ON CONFLICT (template_code, version) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  status_code = 'published',
  effective_at = now(),
  expired_at = NULL,
  variables_json = EXCLUDED.variables_json,
  updated_at = now();

INSERT INTO message.event_subscriptions (
  subscription_code, event_code, event_version, template_code, recipient_rule_json,
  channel_codes, status_code, rule_name, rule_protection_code, rule_version,
  effective_at, created_at, updated_at
)
SELECT
  'm1_account_approval_pending', 'iam.account.approval.pending', 1, 'm1_account_approval_pending',
  jsonb_build_object('type', 'users', 'scope', jsonb_build_object('type', 'users', 'userIds', jsonb_agg(user_account.id::text))),
  '["in_app","wecom_app","email"]'::jsonb, 'active', '员工账号审核待办', 'configurable', 1,
  now(), now(), now()
FROM iam.users user_account
WHERE lower(user_account.username::text) = 'liulonghai' AND user_account.status_code = 'active'
ON CONFLICT (subscription_code) DO UPDATE SET
  template_code = EXCLUDED.template_code,
  recipient_rule_json = EXCLUDED.recipient_rule_json,
  channel_codes = EXCLUDED.channel_codes,
  status_code = 'active',
  rule_name = EXCLUDED.rule_name,
  rule_protection_code = EXCLUDED.rule_protection_code,
  rule_version = message.event_subscriptions.rule_version + 1,
  rule_updated_at = now(),
  updated_at = now();

INSERT INTO message.event_subscriptions (
  subscription_code, event_code, event_version, template_code, recipient_rule_json,
  channel_codes, status_code, rule_name, rule_protection_code, rule_version,
  effective_at, created_at, updated_at
)
SELECT
  'm1_partner_approval_pending', 'channel.partner.approval.pending', 1, 'm1_partner_approval_pending',
  jsonb_build_object('type', 'users', 'scope', jsonb_build_object('type', 'users', 'userIds', jsonb_agg(user_account.id::text))),
  '["in_app","wecom_app","email"]'::jsonb, 'active', '渠道商审核待办', 'configurable', 1,
  now(), now(), now()
FROM iam.users user_account
WHERE lower(user_account.username::text) = 'liulonghai' AND user_account.status_code = 'active'
ON CONFLICT (subscription_code) DO UPDATE SET
  template_code = EXCLUDED.template_code,
  recipient_rule_json = EXCLUDED.recipient_rule_json,
  channel_codes = EXCLUDED.channel_codes,
  status_code = 'active',
  rule_name = EXCLUDED.rule_name,
  rule_protection_code = EXCLUDED.rule_protection_code,
  rule_version = message.event_subscriptions.rule_version + 1,
  rule_updated_at = now(),
  updated_at = now();

COMMIT;
