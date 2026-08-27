-- M8-001 统一消息提醒平台：模板变量化与审批待办提醒。
-- 1) message.templates 增加 variables_json（模板可用变量清单，供前端下拉提示）；
-- 2) 到期提醒/业务事件模板正文改为变量模板（{{customer_name}}、{{business_no}}、
--    {{due_date}}、{{days_left}} 等），并补齐企微应用与邮件通道模板；
-- 3) 新增客户报备审批待办事件订阅（crm.registration.approval.pending），
--    业务事件订阅扩展到企微应用与邮件通道。

BEGIN;

-- 1. 模板表增加变量清单列
ALTER TABLE message.templates
  ADD COLUMN IF NOT EXISTS variables_json jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. 更新既有 in_app 业务模板为变量模板
UPDATE message.templates SET
  title_template = '订单等待处理',
  body_template = '订单【{{customer_name}}】（编号 {{business_no}}）正等待您处理，请及时审批。',
  variables_json = '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"}]'::jsonb,
  updated_at = now()
WHERE template_code = 'm1_order_approval_in_app';

UPDATE message.templates SET
  title_template = '订单已确认',
  body_template = '订单【{{customer_name}}】（编号 {{business_no}}）已确认，请及时安排后续。',
  variables_json = '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"}]'::jsonb,
  updated_at = now()
WHERE template_code = 'm1_order_confirmed_in_app';

UPDATE message.templates SET
  title_template = '订单状态已更新',
  body_template = '订单【{{customer_name}}】（编号 {{business_no}}）状态已更新，请查看详情。',
  variables_json = '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"}]'::jsonb,
  updated_at = now()
WHERE template_code = 'm1_order_event_in_app';

UPDATE message.templates SET
  title_template = '客户报备已通过',
  body_template = '您的客户报备【{{customer_name}}】（编号 {{business_no}}）已通过审批，保护期至 {{due_date}}，请及时跟进。',
  variables_json = '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"},{"name":"due_date","label":"保护期到期日"}]'::jsonb,
  updated_at = now()
WHERE template_code = 'm1_registration_approved_in_app';

UPDATE message.templates SET
  title_template = '客户报备未通过',
  body_template = '您的客户报备【{{customer_name}}】（编号 {{business_no}}）未通过审批，请查看处理意见。',
  variables_json = '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"}]'::jsonb,
  updated_at = now()
WHERE template_code = 'm1_registration_rejected_in_app';

-- 3. 更新 m3 到期提醒模板为变量模板
UPDATE message.templates SET
  title_template = '客户报备保护期即将到期',
  body_template = '报备【{{customer_name}}】（编号 {{business_no}}）保护期将于 {{due_date}} 到期，剩余 {{days_left}} 天，请及时安排后续处理。',
  variables_json = '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"},{"name":"due_date","label":"保护期到期日"},{"name":"days_left","label":"剩余天数"},{"name":"protect_days","label":"保护天数"}]'::jsonb,
  updated_at = now()
WHERE template_code IN ('m3_registration_expiring_in_app', 'm3_registration_expiring_email');

UPDATE message.templates SET
  title_template = '商机预计成交日即将到期',
  body_template = '商机【{{customer_name}}】（编号 {{business_no}}）预计成交日为 {{due_date}}，剩余 {{days_left}} 天，请及时更新进展。',
  variables_json = '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"商机编号"},{"name":"due_date","label":"预计成交日"},{"name":"days_left","label":"剩余天数"}]'::jsonb,
  updated_at = now()
WHERE template_code IN ('m3_opportunity_expected_close_in_app', 'm3_opportunity_expected_close_email');

-- 4. 补齐企微应用通道模板（到期提醒 + 业务事件）
INSERT INTO message.templates (
  template_code, version, channel_code, event_code, category_code, priority_code,
  title_template, body_template, status_code, effective_at, variables_json
) VALUES
('m3_registration_expiring_wecom_app', 1, 'wecom_app', 'crm.registration.expiring', 'business', 'strong',
 '客户报备保护期即将到期',
 '报备【{{customer_name}}】（编号 {{business_no}}）保护期将于 {{due_date}} 到期，剩余 {{days_left}} 天，请及时安排后续处理。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"},{"name":"due_date","label":"保护期到期日"},{"name":"days_left","label":"剩余天数"},{"name":"protect_days","label":"保护天数"}]'),
('m3_opportunity_expected_close_wecom_app', 1, 'wecom_app', 'crm.opportunity.expected_close', 'business', 'normal',
 '商机预计成交日即将到期',
 '商机【{{customer_name}}】（编号 {{business_no}}）预计成交日为 {{due_date}}，剩余 {{days_left}} 天，请及时更新进展。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"商机编号"},{"name":"due_date","label":"预计成交日"},{"name":"days_left","label":"剩余天数"}]'),
('m1_registration_approved_wecom_app', 1, 'wecom_app', 'crm.registration.approved', 'business', 'strong',
 '客户报备已通过',
 '您的客户报备【{{customer_name}}】（编号 {{business_no}}）已通过审批，保护期至 {{due_date}}，请及时跟进。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"},{"name":"due_date","label":"保护期到期日"}]'),
('m1_registration_approved_email', 1, 'email', 'crm.registration.approved', 'business', 'strong',
 '客户报备已通过',
 '您的客户报备【{{customer_name}}】（编号 {{business_no}}）已通过审批，保护期至 {{due_date}}，请及时跟进。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"},{"name":"due_date","label":"保护期到期日"}]'),
('m1_registration_rejected_wecom_app', 1, 'wecom_app', 'crm.registration.rejected', 'business', 'strong',
 '客户报备未通过',
 '您的客户报备【{{customer_name}}】（编号 {{business_no}}）未通过审批，请查看处理意见。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"}]'),
('m1_registration_rejected_email', 1, 'email', 'crm.registration.rejected', 'business', 'strong',
 '客户报备未通过',
 '您的客户报备【{{customer_name}}】（编号 {{business_no}}）未通过审批，请查看处理意见。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"}]'),
('m1_order_approval_wecom_app', 1, 'wecom_app', 'crm.order.approval.pending', 'todo', 'strong',
 '订单等待处理',
 '订单【{{customer_name}}】（编号 {{business_no}}）正等待您处理，请及时审批。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"}]'),
('m1_order_approval_email', 1, 'email', 'crm.order.approval.pending', 'todo', 'strong',
 '订单等待处理',
 '订单【{{customer_name}}】（编号 {{business_no}}）正等待您处理，请及时审批。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"}]'),
('m1_order_confirmed_wecom_app', 1, 'wecom_app', 'crm.order.confirmed', 'business', 'normal',
 '订单已确认',
 '订单【{{customer_name}}】（编号 {{business_no}}）已确认，请及时安排后续。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"}]'),
('m1_order_confirmed_email', 1, 'email', 'crm.order.confirmed', 'business', 'normal',
 '订单已确认',
 '订单【{{customer_name}}】（编号 {{business_no}}）已确认，请及时安排后续。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"}]'),
('m1_order_event_wecom_app', 1, 'wecom_app', 'crm.order.status.changed', 'business', 'normal',
 '订单状态已更新',
 '订单【{{customer_name}}】（编号 {{business_no}}）状态已更新，请查看详情。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"}]'),
('m1_order_event_email', 1, 'email', 'crm.order.status.changed', 'business', 'normal',
 '订单状态已更新',
 '订单【{{customer_name}}】（编号 {{business_no}}）状态已更新，请查看详情。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"}]')
ON CONFLICT (template_code, version) DO UPDATE SET
  channel_code = EXCLUDED.channel_code,
  event_code = EXCLUDED.event_code,
  category_code = EXCLUDED.category_code,
  priority_code = EXCLUDED.priority_code,
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  status_code = 'published',
  effective_at = now(),
  expired_at = NULL,
  variables_json = EXCLUDED.variables_json,
  updated_at = now();

-- 5. 客户报备审批待办模板（三通道）
INSERT INTO message.templates (
  template_code, version, channel_code, event_code, category_code, priority_code,
  title_template, body_template, status_code, effective_at, variables_json
) VALUES
('m1_registration_approval_pending_in_app', 1, 'in_app', 'crm.registration.approval.pending', 'todo', 'strong',
 '客户报备待审批',
 '客户报备【{{customer_name}}】（编号 {{business_no}}）待您审批，请及时处理。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"}]'),
('m1_registration_approval_pending_wecom_app', 1, 'wecom_app', 'crm.registration.approval.pending', 'todo', 'strong',
 '客户报备待审批',
 '客户报备【{{customer_name}}】（编号 {{business_no}}）待您审批，请及时处理。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"}]'),
('m1_registration_approval_pending_email', 1, 'email', 'crm.registration.approval.pending', 'todo', 'strong',
 '客户报备待审批',
 '客户报备【{{customer_name}}】（编号 {{business_no}}）待您审批，请及时处理。',
 'published', now(),
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"}]')
ON CONFLICT (template_code, version) DO UPDATE SET
  channel_code = EXCLUDED.channel_code,
  event_code = EXCLUDED.event_code,
  category_code = EXCLUDED.category_code,
  priority_code = EXCLUDED.priority_code,
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  status_code = 'published',
  effective_at = now(),
  expired_at = NULL,
  variables_json = EXCLUDED.variables_json,
  updated_at = now();

-- 6. 业务事件订阅扩展到企微应用与邮件通道（系统级失败告警仍仅站内）
UPDATE message.event_subscriptions SET
  channel_codes = '["in_app","wecom_app","email"]'::jsonb,
  rule_updated_at = now(),
  updated_at = now()
WHERE subscription_code IN (
  'm1_order_approval_in_app', 'm1_order_status_in_app', 'm1_order_confirmed_in_app',
  'm1_registration_approved_in_app', 'm1_registration_rejected_in_app'
);

-- 7. 新增客户报备审批待办订阅（默认接收人为区管与超管，可在规则管理页调整范围）
INSERT INTO message.event_subscriptions (
  subscription_code, event_code, event_version, template_code, recipient_rule_json,
  channel_codes, status_code, rule_name, rule_protection_code, rule_version,
  effective_at, created_at, updated_at
) VALUES (
  'm1_registration_approval_pending', 'crm.registration.approval.pending', 1,
  'm1_registration_approval_pending_in_app',
  '{"type":"registration_pending_approver","scope":{"type":"roles","codes":["region_manager","superadmin"]}}',
  '["in_app","wecom_app","email"]', 'active', '客户报备审批待办', 'configurable', 1,
  now(), now(), now()
)
ON CONFLICT (subscription_code) DO UPDATE SET
  event_code = EXCLUDED.event_code,
  template_code = EXCLUDED.template_code,
  recipient_rule_json = EXCLUDED.recipient_rule_json,
  channel_codes = EXCLUDED.channel_codes,
  status_code = 'active',
  rule_name = EXCLUDED.rule_name,
  rule_protection_code = EXCLUDED.rule_protection_code,
  effective_at = now(),
  updated_at = now();

COMMIT;
