-- ============================================================
-- M1-001 统一消息提醒平台：独立消息域
-- 仅新增 message 架构；不修改 ops.notifications、ops.outbox_events 的既有语义。
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS message;

CREATE TABLE IF NOT EXISTS message.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  channel_code text NOT NULL CHECK (channel_code IN ('in_app', 'wecom', 'sms', 'email')),
  event_code text NOT NULL,
  category_code text NOT NULL CHECK (category_code IN ('todo', 'business', 'system', 'security')),
  priority_code text NOT NULL CHECK (priority_code IN ('normal', 'strong', 'forced')),
  title_template text NOT NULL,
  body_template text NOT NULL,
  status_code text NOT NULL DEFAULT 'draft' CHECK (status_code IN ('draft', 'published', 'disabled')),
  effective_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_code, version),
  CHECK (expired_at IS NULL OR effective_at IS NULL OR expired_at > effective_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_templates_published_event_channel
  ON message.templates(event_code, channel_code)
  WHERE status_code = 'published' AND expired_at IS NULL;

CREATE TABLE IF NOT EXISTS message.event_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_code text NOT NULL UNIQUE,
  event_code text NOT NULL,
  event_version integer NOT NULL DEFAULT 1 CHECK (event_version > 0),
  template_code text NOT NULL,
  recipient_rule_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel_codes jsonb NOT NULL DEFAULT '["in_app"]'::jsonb,
  status_code text NOT NULL DEFAULT 'active' CHECK (status_code IN ('active', 'disabled')),
  effective_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(recipient_rule_json) = 'object'),
  CHECK (jsonb_typeof(channel_codes) = 'array'),
  CHECK (expired_at IS NULL OR effective_at IS NULL OR expired_at > effective_at)
);

CREATE INDEX IF NOT EXISTS idx_message_event_subscriptions_active
  ON message.event_subscriptions(event_code, event_version)
  WHERE status_code = 'active';

CREATE TABLE IF NOT EXISTS message.event_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id uuid NOT NULL REFERENCES ops.outbox_events(id) ON DELETE RESTRICT,
  consumer_code text NOT NULL,
  event_code text NOT NULL,
  event_version integer NOT NULL DEFAULT 1 CHECK (event_version > 0),
  status_code text NOT NULL DEFAULT 'pending'
    CHECK (status_code IN ('pending', 'processing', 'retry_wait', 'succeeded', 'dead', 'cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  locked_until timestamptz,
  last_error_summary text,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (source_event_id, consumer_code)
);

CREATE INDEX IF NOT EXISTS idx_message_event_consumptions_claim
  ON message.event_consumptions(status_code, next_retry_at, locked_until, created_at)
  WHERE status_code IN ('pending', 'retry_wait', 'processing');

-- 关键消息扫描任务的连续失败状态。仅记录任务进程自身失败，不把单条业务事件的重试视为进程失败。
CREATE TABLE IF NOT EXISTS message.worker_failure_streaks (
  worker_code text PRIMARY KEY,
  consecutive_failure_count integer NOT NULL DEFAULT 0 CHECK (consecutive_failure_count >= 0),
  threshold_event_emitted boolean NOT NULL DEFAULT false,
  threshold_event_id uuid REFERENCES ops.outbox_events(id) ON DELETE SET NULL,
  last_error_summary text,
  last_failure_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  source_event_id uuid REFERENCES ops.outbox_events(id) ON DELETE SET NULL,
  event_code text NOT NULL,
  category_code text NOT NULL CHECK (category_code IN ('todo', 'business', 'system', 'security')),
  priority_code text NOT NULL CHECK (priority_code IN ('normal', 'strong', 'forced')),
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  target_action text NOT NULL CHECK (target_action IN ('view', 'process', 'approve')),
  template_version integer NOT NULL CHECK (template_version > 0),
  title text NOT NULL,
  body text NOT NULL,
  status_code text NOT NULL DEFAULT 'unread' CHECK (status_code IN ('unread', 'read', 'archived')),
  payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  archived_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payload_snapshot) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_message_notifications_recipient_status_created
  ON message.notifications(recipient_user_id, status_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_notifications_recipient_category_created
  ON message.notifications(recipient_user_id, category_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_notifications_source_event
  ON message.notifications(source_event_id) WHERE source_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS message.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES message.notifications(id) ON DELETE SET NULL,
  source_event_id uuid REFERENCES ops.outbox_events(id) ON DELETE SET NULL,
  recipient_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  channel_code text NOT NULL CHECK (channel_code IN ('in_app', 'wecom', 'sms', 'email')),
  template_code text NOT NULL,
  template_version integer NOT NULL CHECK (template_version > 0),
  semantic_key text NOT NULL,
  deduplication_key char(64) NOT NULL,
  status_code text NOT NULL DEFAULT 'pending'
    CHECK (status_code IN ('pending', 'sending', 'retry_wait', 'success', 'failed', 'cancelled', 'ignored')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_retry_at timestamptz,
  provider_message_id text,
  receipt_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (deduplication_key),
  CHECK (jsonb_typeof(receipt_json) = 'object'),
  CHECK (jsonb_typeof(cost_summary_json) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_message_deliveries_pending
  ON message.deliveries(status_code, next_retry_at, created_at)
  WHERE status_code IN ('pending', 'retry_wait', 'sending');
CREATE INDEX IF NOT EXISTS idx_message_deliveries_recipient_created
  ON message.deliveries(recipient_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES iam.users(id) ON DELETE CASCADE,
  in_app_enabled boolean NOT NULL DEFAULT true,
  wecom_enabled boolean NOT NULL DEFAULT false,
  sms_enabled boolean NOT NULL DEFAULT false,
  email_enabled boolean NOT NULL DEFAULT false,
  do_not_disturb_start time NOT NULL DEFAULT '22:00:00',
  do_not_disturb_end time NOT NULL DEFAULT '08:00:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO message.templates (
  template_code, version, channel_code, event_code, category_code, priority_code,
  title_template, body_template, status_code, effective_at
) VALUES
  ('m1_order_approval_in_app', 1, 'in_app', 'crm.order.approval.pending', 'todo', 'strong',
   '订单等待处理', '订单正等待您处理，请在平台查看详情。', 'published', now()),
  ('m1_order_event_in_app', 1, 'in_app', 'crm.order.status.changed', 'business', 'strong',
   '订单状态已更新', '订单状态已发生变化，请在平台查看详情。', 'published', now()),
  ('m1_order_confirmed_in_app', 1, 'in_app', 'crm.order.confirmed', 'business', 'strong',
   '订单已确认', '订单已确认，请在平台查看详情。', 'published', now()),
  ('m1_registration_approved_in_app', 1, 'in_app', 'crm.registration.approved', 'business', 'strong',
   '客户报备已通过', '您的客户报备已通过，请在平台查看详情。', 'published', now()),
  ('m1_registration_rejected_in_app', 1, 'in_app', 'crm.registration.rejected', 'business', 'strong',
   '客户报备未通过', '您的客户报备未通过，请在平台查看处理意见。', 'published', now()),
  ('m1_task_failure_in_app', 1, 'in_app', 'task.failed.excessive', 'system', 'forced',
   '消息任务连续失败', '消息任务已连续失败，请及时处理。', 'published', now())
ON CONFLICT (template_code, version) DO NOTHING;

INSERT INTO message.event_subscriptions (
  subscription_code, event_code, event_version, template_code, recipient_rule_json,
  channel_codes, status_code, effective_at
) VALUES
  ('m1_order_approval_in_app', 'crm.order.approval.pending', 1, 'm1_order_approval_in_app',
   '{"type":"order_current_approver"}'::jsonb, '["in_app"]'::jsonb, 'active', now()),
  ('m1_order_status_in_app', 'crm.order.status.changed', 1, 'm1_order_event_in_app',
   '{"type":"business_owner"}'::jsonb, '["in_app"]'::jsonb, 'active', now()),
  ('m1_order_confirmed_in_app', 'crm.order.confirmed', 1, 'm1_order_confirmed_in_app',
   '{"type":"business_owner"}'::jsonb, '["in_app"]'::jsonb, 'active', now()),
  ('m1_registration_approved_in_app', 'crm.registration.approved', 1, 'm1_registration_approved_in_app',
   '{"type":"registration_creator_and_owner"}'::jsonb, '["in_app"]'::jsonb, 'active', now()),
  ('m1_registration_rejected_in_app', 'crm.registration.rejected', 1, 'm1_registration_rejected_in_app',
   '{"type":"registration_creator_and_owner"}'::jsonb, '["in_app"]'::jsonb, 'active', now()),
  ('m1_message_task_failure_in_app', 'task.failed.excessive', 1, 'm1_task_failure_in_app',
   '{"type":"platform_administrator"}'::jsonb, '["in_app"]'::jsonb, 'active', now())
ON CONFLICT (subscription_code) DO NOTHING;

COMMIT;
