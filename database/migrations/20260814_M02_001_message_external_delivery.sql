-- ============================================================
-- M2-001 统一消息提醒平台：外部通道投递审计
-- 不保存完整请求、响应、Webhook、密钥或联系人明文快照。
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS message.delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES message.deliveries(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  channel_code text NOT NULL CHECK (channel_code IN ('wecom', 'sms', 'email')),
  status_code text NOT NULL CHECK (status_code IN ('success', 'retry_wait', 'failed', 'ignored')),
  retryable boolean NOT NULL DEFAULT false,
  provider_code text NOT NULL,
  http_status integer CHECK (http_status IS NULL OR (http_status >= 100 AND http_status <= 599)),
  provider_message_id text,
  response_summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_message_delivery_attempts_delivery_created
  ON message.delivery_attempts(delivery_id, created_at DESC);

COMMENT ON TABLE message.delivery_attempts IS
  '外部通道投递尝试事实，仅保存脱敏状态、供应商代码和摘要。';

COMMIT;
