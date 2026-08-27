-- ============================================================
-- M4-001 超级管理员消息通道配置中心
-- 凭据只保存 AES-256-GCM 密文；部署密钥 MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY 不入库。
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS message.channel_accounts (
  channel_code text PRIMARY KEY CHECK (channel_code IN ('wecom', 'sms', 'email')),
  enabled boolean NOT NULL DEFAULT false,
  config_version integer NOT NULL DEFAULT 1 CHECK (config_version > 0),
  cipher_text text NOT NULL,
  nonce text NOT NULL,
  auth_tag text NOT NULL,
  config_digest char(64) NOT NULL,
  configured_by_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  configured_at timestamptz NOT NULL DEFAULT now(),
  last_test_status text CHECK (last_test_status IN ('success', 'retry_wait', 'failed', 'ignored')),
  last_tested_at timestamptz,
  last_tested_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_channel_accounts_updated
  ON message.channel_accounts(updated_at DESC);

COMMENT ON TABLE message.channel_accounts IS
  '超级管理员维护的外部消息通道配置；任何凭据字段均只以 AES-256-GCM 密文保存。';

COMMIT;
