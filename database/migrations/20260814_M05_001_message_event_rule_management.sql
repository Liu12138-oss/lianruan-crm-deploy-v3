-- ============================================================
-- M5-001 统一提醒平台：事件规则管理
-- 仅扩展既有 message.event_subscriptions，不改变已上线事件、模板和投递语义。
-- ============================================================

BEGIN;

ALTER TABLE message.event_subscriptions
  ADD COLUMN IF NOT EXISTS rule_name text,
  ADD COLUMN IF NOT EXISTS rule_protection_code text NOT NULL DEFAULT 'configurable'
    CHECK (rule_protection_code IN ('mandatory', 'configurable')),
  ADD COLUMN IF NOT EXISTS rule_version integer NOT NULL DEFAULT 1 CHECK (rule_version > 0),
  ADD COLUMN IF NOT EXISTS updated_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rule_updated_at timestamptz NOT NULL DEFAULT now();

UPDATE message.event_subscriptions
SET rule_name = COALESCE(NULLIF(rule_name, ''), subscription_code),
    rule_protection_code = CASE subscription_code
      WHEN 'm1_order_approval_in_app' THEN 'mandatory'
      WHEN 'm1_registration_approved_in_app' THEN 'mandatory'
      WHEN 'm1_registration_rejected_in_app' THEN 'mandatory'
      WHEN 'm1_message_task_failure_in_app' THEN 'mandatory'
      ELSE rule_protection_code
    END,
    rule_updated_at = COALESCE(rule_updated_at, updated_at, created_at, now());

UPDATE message.event_subscriptions
SET rule_name = CASE subscription_code
  WHEN 'm1_order_approval_in_app' THEN '订单待审批'
  WHEN 'm1_order_status_in_app' THEN '订单状态变化'
  WHEN 'm1_order_confirmed_in_app' THEN '订单确认完成'
  WHEN 'm1_registration_approved_in_app' THEN '客户报备通过'
  WHEN 'm1_registration_rejected_in_app' THEN '客户报备驳回'
  WHEN 'm1_message_task_failure_in_app' THEN '消息任务连续失败'
  ELSE rule_name
END
WHERE subscription_code IN (
  'm1_order_approval_in_app',
  'm1_order_status_in_app',
  'm1_order_confirmed_in_app',
  'm1_registration_approved_in_app',
  'm1_registration_rejected_in_app',
  'm1_message_task_failure_in_app'
);

ALTER TABLE message.event_subscriptions
  ALTER COLUMN rule_name SET NOT NULL;

COMMENT ON COLUMN message.event_subscriptions.rule_protection_code IS
  'mandatory 表示强制提醒：不可关闭且必须保留站内渠道；configurable 可由超级管理员启停。';
COMMENT ON COLUMN message.event_subscriptions.rule_version IS
  '提醒规则乐观并发控制版本；每次平台管理更新递增。';

COMMIT;
