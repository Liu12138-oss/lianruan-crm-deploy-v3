-- M9-001 统一消息提醒平台：提醒任务模板目录与超管自建任务。
-- 1) 新增 message.reminder_templates 目录表（提醒任务模板，系统预置+可扩展）；
-- 2) 放开 reminder_rules / event_subscriptions 的写死约束，支持按目录自建任务；
-- 3) 到期扫描与事件消费按目录动态驱动，接收人支持角色/用户/组织/区域/渠道商/业务动态规则；
-- 4) 渠道扩展为 站内/企微应用/企微群机器人/邮件/短信（以通道启用状态为准）。

BEGIN;

-- 1. 提醒任务模板目录表
CREATE TABLE IF NOT EXISTS message.reminder_templates (
  template_code text PRIMARY KEY,
  template_name text NOT NULL,
  reminder_type text NOT NULL CHECK (reminder_type IN ('expiry', 'event')),
  reminder_code text,
  aggregate_type text,
  data_source_code text,
  event_code text,
  category_code text NOT NULL CHECK (category_code IN ('todo', 'business', 'system', 'security')),
  priority_code text NOT NULL CHECK (priority_code IN ('normal', 'strong', 'forced')),
  default_recipient_rule_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(default_recipient_rule_json) = 'object'),
  default_channel_codes jsonb NOT NULL DEFAULT '["in_app"]'::jsonb CHECK (jsonb_typeof(default_channel_codes) = 'array'),
  default_advance_days integer[] NOT NULL DEFAULT ARRAY[30, 7, 1] CHECK (
    cardinality(default_advance_days) BETWEEN 1 AND 10
    AND default_advance_days <@ ARRAY[1, 3, 7, 14, 30, 60, 90]::integer[]
  ),
  default_dispatch_time time NOT NULL DEFAULT '09:00:00',
  default_workday_only boolean NOT NULL DEFAULT true,
  default_digest_window_minutes integer NOT NULL DEFAULT 0 CHECK (default_digest_window_minutes IN (0, 15, 60)),
  variable_defs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(variable_defs) = 'array'),
  title_template text NOT NULL,
  body_template text NOT NULL,
  is_system boolean NOT NULL DEFAULT true,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active', 'disabled')),
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_reminder_templates_type
  ON message.reminder_templates(reminder_type, status_code);

-- 2. 到期规则表扩展：允许按目录自建，接收人与渠道放开
ALTER TABLE message.reminder_rules
  ADD COLUMN IF NOT EXISTS template_code text REFERENCES message.reminder_templates(template_code),
  ADD COLUMN IF NOT EXISTS reminder_type text NOT NULL DEFAULT 'expiry' CHECK (reminder_type IN ('expiry', 'event')),
  ADD COLUMN IF NOT EXISTS data_source_code text;

DO $$
DECLARE
  目标表 regclass;
  约束名 text;
BEGIN
  FOREACH 目标表 IN ARRAY ARRAY[
    'message.reminder_rules'::regclass
  ] LOOP
    -- 删除 reminder_code 与 aggregate_type 的写死枚举约束
    FOR 约束名 IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 目标表
        AND contype = 'c'
        AND (pg_get_constraintdef(oid) LIKE '%crm.registration.expiring%' OR pg_get_constraintdef(oid) LIKE '%registration''%')
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', 目标表, 约束名);
    END LOOP;
  END LOOP;
END $$;

-- 到期规则唯一键放开：同一数据源可按不同接收人建立多个任务。
-- 约束名由 PostgreSQL 自动生成（reminder_rules_reminder_code_aggregate_type_key），
-- 不依赖固定名称，按约束定义删除，兼容不同版本建表命名。
DO $$
DECLARE
  约束名 text;
BEGIN
  FOR 约束名 IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'message.reminder_rules'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%reminder_code%'
      AND pg_get_constraintdef(oid) LIKE '%aggregate_type%'
  LOOP
    EXECUTE format('ALTER TABLE message.reminder_rules DROP CONSTRAINT %I', 约束名);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_message_reminder_rules_template
  ON message.reminder_rules(template_code, status_code);

-- 3. 事件订阅表扩展
ALTER TABLE message.event_subscriptions
  ADD COLUMN IF NOT EXISTS reminder_type text NOT NULL DEFAULT 'event' CHECK (reminder_type IN ('expiry', 'event'));

-- 4. 提醒计划增加规则来源，投递时按规则查模板
ALTER TABLE message.reminder_schedules
  ADD COLUMN IF NOT EXISTS rule_code text,
  ADD COLUMN IF NOT EXISTS rule_name text;

CREATE INDEX IF NOT EXISTS idx_message_reminder_schedules_rule
  ON message.reminder_schedules(rule_code, status_code);

-- 6. 提醒任务模板种子：到期类
INSERT INTO message.reminder_templates (
  template_code, template_name, reminder_type, reminder_code, aggregate_type, data_source_code,
  category_code, priority_code, default_recipient_rule_json, default_channel_codes,
  default_advance_days, default_dispatch_time, default_workday_only, default_digest_window_minutes,
  variable_defs, title_template, body_template, is_system, description
) VALUES
('m3_registration_expiring', '客户报备保护期到期', 'expiry', 'crm.registration.expiring', 'registration', 'registration_expiring',
 'business', 'strong', '{"type":"business_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"},{"name":"due_date","label":"保护期到期日"},{"name":"days_left","label":"剩余天数"},{"name":"protect_days","label":"保护天数"}]'::jsonb,
 '客户报备保护期即将到期',
 '报备【{{customer_name}}】（编号 {{business_no}}）保护期将于 {{due_date}} 到期，剩余 {{days_left}} 天，请及时安排后续处理。',
 true, '报备通过后按保护期到期日提前提醒归属销售。'),
('m3_opportunity_expected_close', '商机预计成交日到期', 'expiry', 'crm.opportunity.expected_close', 'opportunity', 'opportunity_expected_close',
 'business', 'normal', '{"type":"business_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"商机编号"},{"name":"due_date","label":"预计成交日"},{"name":"days_left","label":"剩余天数"},{"name":"expected_amount","label":"预计金额"}]'::jsonb,
 '商机预计成交日即将到期',
 '商机【{{customer_name}}】（编号 {{business_no}}）预计成交日为 {{due_date}}，剩余 {{days_left}} 天，请及时更新进展。',
 true, '进行中商机按预计成交日提前提醒归属销售。'),
('m3_quote_valid_until', '报价有效期到期', 'expiry', 'crm.quote.expiring', 'quote', 'quote_valid_until',
 'business', 'normal', '{"type":"business_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报价编号"},{"name":"due_date","label":"有效期到期日"},{"name":"days_left","label":"剩余天数"},{"name":"total_amount","label":"报价金额"}]'::jsonb,
 '报价有效期即将到期',
 '报价【{{customer_name}}】（编号 {{business_no}}）有效期将于 {{due_date}} 到期，剩余 {{days_left}} 天，请及时确认客户意向。',
 false, '已提交/已通过报价按有效期到期日提前提醒归属销售。'),
('m3_order_delivery_date', '订单交付日期到期', 'expiry', 'crm.order.delivery_date', 'order', 'order_delivery_date',
 'business', 'normal', '{"type":"business_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"},{"name":"due_date","label":"交付日期"},{"name":"days_left","label":"剩余天数"},{"name":"total_amount","label":"订单金额"}]'::jsonb,
 '订单交付日期即将到期',
 '订单【{{customer_name}}】（编号 {{business_no}}）交付日期为 {{due_date}}，剩余 {{days_left}} 天，请确认交付安排。',
 false, '已确认/已完成订单按交付日期提前提醒归属销售。'),
('m3_opportunity_next_action', '商机下次跟进计划到期', 'expiry', 'crm.opportunity.next_action', 'opportunity', 'opportunity_next_action',
 'business', 'normal', '{"type":"business_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"商机编号"},{"name":"due_date","label":"下次跟进日"},{"name":"days_left","label":"剩余天数"}]'::jsonb,
 '商机跟进计划即将到期',
 '商机【{{customer_name}}】（编号 {{business_no}}）下次跟进日为 {{due_date}}，剩余 {{days_left}} 天，请及时跟进。',
 false, '进行中商机按最近一次跟进计划日期提醒归属销售。')
ON CONFLICT (template_code) DO NOTHING;

-- 7. 提醒任务模板种子：事件类
INSERT INTO message.reminder_templates (
  template_code, template_name, reminder_type, event_code,
  category_code, priority_code, default_recipient_rule_json, default_channel_codes,
  default_advance_days, default_dispatch_time, default_workday_only, default_digest_window_minutes,
  variable_defs, title_template, body_template, is_system, description
) VALUES
('m1_order_approval_pending', '订单待审批', 'event', 'crm.order.approval.pending',
 'todo', 'strong', '{"type":"order_current_approver"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"}]'::jsonb,
 '订单等待处理', '订单【{{customer_name}}】（编号 {{business_no}}）正等待您处理，请及时审批。', true, '订单提交后提醒当前审批人。'),
('m1_order_status_changed', '订单状态变更', 'event', 'crm.order.status.changed',
 'business', 'normal', '{"type":"business_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"}]'::jsonb,
 '订单状态已更新', '订单【{{customer_name}}】（编号 {{business_no}}）状态已更新，请查看详情。', true, '订单状态变化时提醒归属销售。'),
('m1_order_confirmed', '订单已确认', 'event', 'crm.order.confirmed',
 'business', 'normal', '{"type":"business_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"订单编号"}]'::jsonb,
 '订单已确认', '订单【{{customer_name}}】（编号 {{business_no}}）已确认，请及时安排后续。', true, '订单确认后提醒归属销售。'),
('m1_registration_approval_pending', '客户报备待审批', 'event', 'crm.registration.approval.pending',
 'todo', 'strong', '{"type":"registration_pending_approver","scope":{"type":"roles","codes":["region_manager","superadmin"]}}'::jsonb,
 '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"}]'::jsonb,
 '客户报备待审批', '客户报备【{{customer_name}}】（编号 {{business_no}}）待您审批，请及时处理。', true, '客户报备提交后提醒区管与超管。'),
('m1_registration_approved', '客户报备审批通过', 'event', 'crm.registration.approved',
 'business', 'strong', '{"type":"registration_creator_and_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"},{"name":"due_date","label":"保护期到期日"}]'::jsonb,
 '客户报备已通过', '您的客户报备【{{customer_name}}】（编号 {{business_no}}）已通过审批，保护期至 {{due_date}}，请及时跟进。', true, '报备通过后提醒创建人与归属销售。'),
('m1_registration_rejected', '客户报备审批驳回', 'event', 'crm.registration.rejected',
 'business', 'strong', '{"type":"registration_creator_and_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报备编号"}]'::jsonb,
 '客户报备未通过', '您的客户报备【{{customer_name}}】（编号 {{business_no}}）未通过审批，请查看处理意见。', true, '报备驳回后提醒创建人与归属销售。'),
('m1_quote_approval_pending', '报价待审批', 'event', 'crm.quote.approval.pending',
 'todo', 'strong', '{"type":"roles","scope":{"type":"roles","codes":["region_manager","superadmin"]}}'::jsonb,
 '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报价编号"},{"name":"total_amount","label":"报价金额"}]'::jsonb,
 '报价等待审批', '报价【{{customer_name}}】（编号 {{business_no}}）金额 {{total_amount}} 正等待审批，请及时处理。', false, '报价提交后提醒区管与超管。'),
('m1_quote_approved', '报价审批通过', 'event', 'crm.quote.approved',
 'business', 'normal', '{"type":"business_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报价编号"},{"name":"total_amount","label":"报价金额"}]'::jsonb,
 '报价已通过', '报价【{{customer_name}}】（编号 {{business_no}}）已通过审批，请及时转为订单。', false, '报价通过后提醒归属销售。'),
('m1_quote_rejected', '报价审批驳回', 'event', 'crm.quote.rejected',
 'business', 'normal', '{"type":"business_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"报价编号"},{"name":"total_amount","label":"报价金额"}]'::jsonb,
 '报价未通过', '报价【{{customer_name}}】（编号 {{business_no}}）未通过审批，请查看处理意见。', false, '报价驳回后提醒归属销售。'),
('m1_opportunity_won', '商机赢单', 'event', 'crm.opportunity.won',
 'business', 'strong', '{"type":"business_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"商机编号"},{"name":"expected_amount","label":"预计金额"}]'::jsonb,
 '商机赢单', '恭喜！商机【{{customer_name}}】（编号 {{business_no}}）已赢单，预计金额 {{expected_amount}}。', false, '商机转为赢单时提醒归属销售。'),
('m1_opportunity_lost', '商机输单', 'event', 'crm.opportunity.lost',
 'business', 'strong', '{"type":"business_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"商机编号"},{"name":"expected_amount","label":"预计金额"}]'::jsonb,
 '商机输单', '商机【{{customer_name}}】（编号 {{business_no}}）已输单，预计金额 {{expected_amount}}，请查看原因。', false, '商机转为输单时提醒归属销售。'),
('m1_opportunity_stage_changed', '商机阶段变更', 'event', 'crm.opportunity.stage.changed',
 'business', 'normal', '{"type":"business_owner"}'::jsonb, '["in_app","wecom_app","email"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[{"name":"customer_name","label":"客户名称"},{"name":"business_no","label":"商机编号"},{"name":"stage_name","label":"当前阶段"}]'::jsonb,
 '商机阶段更新', '商机【{{customer_name}}】（编号 {{business_no}}）阶段已更新为 {{stage_name}}，请查看详情。', false, '商机阶段变化时提醒归属销售。'),
('m1_task_failure', '消息任务连续失败', 'event', 'task.failed.excessive',
 'system', 'forced', '{"type":"platform_administrator"}'::jsonb, '["in_app"]'::jsonb,
 ARRAY[30,7,1], '09:00:00', true, 0,
 '[]'::jsonb,
 '消息任务连续失败', '消息任务已连续失败，请及时处理。', true, '系统级强制告警，仅站内渠道，接收人固定为平台管理员。')
ON CONFLICT (template_code) DO NOTHING;

-- 7A. 回填现有到期规则（必须在到期模板种子之后执行，避免外键冲突）
UPDATE message.reminder_rules
SET template_code = 'm3_registration_expiring',
    data_source_code = 'registration_expiring',
    reminder_type = 'expiry',
    updated_at = now()
WHERE rule_code = 'm3_registration_expiring';

UPDATE message.reminder_rules
SET template_code = 'm3_opportunity_expected_close',
    data_source_code = 'opportunity_expected_close',
    reminder_type = 'expiry',
    updated_at = now()
WHERE rule_code = 'm3_opportunity_expected_close';

UPDATE message.reminder_schedules schedule
SET rule_code = rule.rule_code,
    rule_name = rule.rule_name
FROM message.reminder_rules rule
WHERE schedule.reminder_code = rule.reminder_code
  AND schedule.aggregate_type = rule.aggregate_type
  AND schedule.rule_code IS NULL;

-- 7B. 回填既有到期模板的到期代码与聚合类型（修复早期副本模板缺失字段导致无法建任务）
UPDATE message.reminder_templates
SET reminder_code = CASE data_source_code
      WHEN 'registration_expiring' THEN 'crm.registration.expiring'
      WHEN 'opportunity_expected_close' THEN 'crm.opportunity.expected_close'
      WHEN 'quote_valid_until' THEN 'crm.quote.expiring'
      WHEN 'order_delivery_date' THEN 'crm.order.delivery_date'
      WHEN 'opportunity_next_action' THEN 'crm.opportunity.next_action'
    END,
    aggregate_type = CASE data_source_code
      WHEN 'registration_expiring' THEN 'registration'
      WHEN 'opportunity_expected_close' THEN 'opportunity'
      WHEN 'quote_valid_until' THEN 'quote'
      WHEN 'order_delivery_date' THEN 'order'
      WHEN 'opportunity_next_action' THEN 'opportunity'
    END,
    updated_at = now()
WHERE reminder_type = 'expiry'
  AND data_source_code IN (
    'registration_expiring', 'opportunity_expected_close', 'quote_valid_until',
    'order_delivery_date', 'opportunity_next_action'
  )
  AND (reminder_code IS NULL OR aggregate_type IS NULL);


-- 8. 放开提醒计划的到期代码与聚合类型写死约束，允许自建到期任务写入
DO $$
DECLARE
  目标表 regclass;
  约束名 text;
BEGIN
  FOREACH 目标表 IN ARRAY ARRAY[
    'message.reminder_schedules'::regclass
  ] LOOP
    FOR 约束名 IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 目标表
        AND contype = 'c'
        AND (
          pg_get_constraintdef(oid) LIKE '%crm.registration.expiring%'
          OR pg_get_constraintdef(oid) LIKE '%registration''%'
        )
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', 目标表, 约束名);
    END LOOP;
  END LOOP;
END $$;

-- 9. 现有事件订阅的模板关联回填到任务模板目录（事件订阅保留站内渠道模板代码，
--    投递渲染以任务模板目录为准；此处把 subscription.template_code 归一化为目录代码）
UPDATE message.event_subscriptions subscription
SET template_code = catalog.template_code,
    updated_at = now()
FROM message.reminder_templates catalog
WHERE catalog.reminder_type = 'event'
  AND catalog.event_code = subscription.event_code
  AND subscription.template_code <> catalog.template_code
  AND EXISTS (
    SELECT 1
    FROM message.templates channel_template
    WHERE channel_template.template_code = subscription.template_code
      AND channel_template.status_code = 'published'
  );

-- 10. 现有事件订阅回填任务类型
UPDATE message.event_subscriptions
SET reminder_type = 'event', updated_at = now()
WHERE reminder_type = 'event';

COMMIT;
