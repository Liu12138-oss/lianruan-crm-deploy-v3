-- ============================================================
-- M3-001 统一消息提醒平台：到期提醒计划与邮件模板
-- 仅新增 message 域对象；到期事实始终以 CRM 主表为准。
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION message.safe_business_date(value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN left(btrim(value), 10)::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS message.reminder_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_code text NOT NULL CHECK (reminder_code IN ('crm.registration.expiring', 'crm.opportunity.expected_close')),
  aggregate_type text NOT NULL CHECK (aggregate_type IN ('registration', 'opportunity')),
  aggregate_id uuid NOT NULL,
  recipient_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  due_on date NOT NULL,
  advance_days integer NOT NULL CHECK (advance_days BETWEEN 1 AND 365),
  digest_window_minutes integer NOT NULL DEFAULT 0 CHECK (digest_window_minutes IN (0, 15, 60)),
  dispatch_after timestamptz NOT NULL,
  semantic_key char(64) NOT NULL UNIQUE,
  status_code text NOT NULL DEFAULT 'pending'
    CHECK (status_code IN ('pending', 'processing', 'succeeded', 'cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  locked_until timestamptz,
  last_error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK (length(semantic_key) = 64)
);

CREATE INDEX IF NOT EXISTS idx_message_reminder_schedules_pending_dispatch
  ON message.reminder_schedules(status_code, dispatch_after, created_at)
  WHERE status_code IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_message_reminder_schedules_recipient_due
  ON message.reminder_schedules(recipient_user_id, due_on DESC);

COMMENT ON TABLE message.reminder_schedules IS
  '到期提醒计划事实。语义键按业务对象、负责人、到期日、提前天数和合并窗口去重。';

INSERT INTO message.templates (
  template_code, version, channel_code, event_code, category_code, priority_code,
  title_template, body_template, status_code, effective_at
) VALUES
  ('m3_registration_expiring_in_app', 1, 'in_app', 'crm.registration.expiring', 'business', 'strong',
   '客户报备保护期即将到期', '请在平台查看并安排后续处理。', 'published', now()),
  ('m3_opportunity_expected_close_in_app', 1, 'in_app', 'crm.opportunity.expected_close', 'business', 'normal',
   '商机预计成交日即将到期', '请在平台查看并更新商机进展。', 'published', now()),
  ('m3_registration_expiring_email', 1, 'email', 'crm.registration.expiring', 'business', 'strong',
   '客户报备保护期即将到期', '请登录平台查看并安排后续处理。', 'published', now()),
  ('m3_opportunity_expected_close_email', 1, 'email', 'crm.opportunity.expected_close', 'business', 'normal',
   '商机预计成交日即将到期', '请登录平台查看并更新商机进展。', 'published', now())
ON CONFLICT (template_code, version) DO NOTHING;

COMMIT;
