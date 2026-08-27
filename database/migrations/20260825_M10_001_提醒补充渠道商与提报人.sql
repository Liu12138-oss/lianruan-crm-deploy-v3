-- M10-001 统一提醒平台：补齐渠道商名称与提报人变量。
-- 仅影响后续渲染和投递；已生成通知保留原始正文，确保审计事实不可变。

BEGIN;

-- 自建提醒模板是事件和到期提醒渲染的唯一目录。
UPDATE message.reminder_templates
SET variable_defs =
      (CASE
        WHEN variable_defs @> '[{"name":"partner_name"}]'::jsonb THEN variable_defs
        ELSE variable_defs || '[{"name":"partner_name","label":"渠道商名称"}]'::jsonb
      END) ||
      (CASE
        WHEN variable_defs @> '[{"name":"submitter_name"}]'::jsonb THEN '[]'::jsonb
        ELSE '[{"name":"submitter_name","label":"提报人"}]'::jsonb
      END),
    body_template = CASE
      WHEN body_template LIKE '渠道商【{{partner_name}}】、提报人【{{submitter_name}}】。%' THEN body_template
      ELSE '渠道商【{{partner_name}}】、提报人【{{submitter_name}}】。' || body_template
    END,
    updated_at = now()
WHERE COALESCE(event_code, reminder_code) LIKE 'crm.%';

-- 通道模板供站内、企微应用和邮件使用，变量及文案必须与自建提醒模板一致。
UPDATE message.templates
SET variables_json =
      (CASE
        WHEN variables_json @> '[{"name":"partner_name"}]'::jsonb THEN variables_json
        ELSE variables_json || '[{"name":"partner_name","label":"渠道商名称"}]'::jsonb
      END) ||
      (CASE
        WHEN variables_json @> '[{"name":"submitter_name"}]'::jsonb THEN '[]'::jsonb
        ELSE '[{"name":"submitter_name","label":"提报人"}]'::jsonb
      END),
    body_template = CASE
      WHEN body_template LIKE '渠道商【{{partner_name}}】、提报人【{{submitter_name}}】。%' THEN body_template
      ELSE '渠道商【{{partner_name}}】、提报人【{{submitter_name}}】。' || body_template
    END,
    updated_at = now()
WHERE event_code LIKE 'crm.%';

COMMIT;
